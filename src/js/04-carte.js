/* ==========================================================================
   10. CARTE — MapLibre GL
   Fond : OpenFreeMap Positron par défaut, orthophoto IGN en bascule.
   Hors connexion, le fond se replie sur un aplat neutre : les contours
   communaux, embarqués dans le fichier, restent affichés.
   ========================================================================== */
let LMAP = null, GEO = null, CARTE_PRETE = false, SURVOL = null;
const STYLE_POSITRON = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_VIDE = {version:8, sources:{}, layers:[
  {id:'aplat', type:'background', paint:{'background-color':'#F2F0EB'}}]};
const TUILES_IGN = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
  + '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg'
  + '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const CLE_INSEE = ['code_insee','INSEE_COM','insee_com','codgeo','CODGEO','code','insee','id','com','COM'];
const PALETTE_CARTE = ['#EDF2F0','#C9DBD8','#8FBAC4','#4E8E9C','#2A6F7F'];

function initCarte(){
  const sel = document.getElementById('map-ind');
  if(sel.options.length){ if(!GEO && typeof GEO_NCPA!=='undefined') fondEmbarque(); return }
  const liste = [...Object.keys(DERIVES), ...Object.keys(DATA.series)];
  sel.innerHTML = liste.map(k=>`<option value="${k}">${libDe(k)}</option>`).join('');
  sel.value = 'D_TXRS';
  const drop = document.getElementById('map-drop');
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault(); drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault(); drop.classList.remove('over')}));
  drop.addEventListener('drop', e=>{ if(e.dataTransfer.files[0]) lireGeo(e.dataTransfer.files[0]) });
  document.getElementById('map-file').addEventListener('change', e=>{ if(e.target.files[0]) lireGeo(e.target.files[0]) });
  document.getElementById('map-reset').onclick = ()=>{
    document.getElementById('map-drop').style.display = 'block';
    document.getElementById('map').style.display = 'none';
  };
  sel.onchange = dessineCarte;
  document.getElementById('map-annee').oninput = dessineCarte;
  document.getElementById('map-fond').onchange = basculeFond;
  if(typeof GEO_NCPA !== 'undefined') fondEmbarque();
}

function fondEmbarque(){ chargeGeo(GEO_NCPA) }

function chargeGeo(j){
  GEO = JSON.parse(JSON.stringify(j));          /* copie : les propriétés de style sont réécrites */
  document.getElementById('map-drop').style.display = 'none';
  document.getElementById('map').style.display = 'block';
  if(CARTE_PRETE){ LMAP.getSource('communes').setData(GEO); cadre(); dessineCarte() }
  else montreCarte();
}

function lireGeo(f){
  const r = new FileReader();
  r.onload = ev=>{
    try{
      const j = JSON.parse(ev.target.result);
      chargeGeo(j.type==='FeatureCollection' ? j : {type:'FeatureCollection', features:[j]});
    }catch(err){
      document.getElementById('map-drop').innerHTML =
        `<b style="color:var(--rouge)">Fichier illisible.</b><br>Attendu : un GeoJSON valide en WGS84. Détail : ${err.message}`;
    }
  };
  r.readAsText(f);
}

function cleGeo(props){
  for(const k of CLE_INSEE) if(props[k]!=null) return String(props[k]).trim();
  for(const k in props){ const v=String(props[k]).trim(); if(/^\d{5}$/.test(v)&&DATA.communes[v]) return v }
  return null;
}

function montreCarte(){
  if(LMAP){ LMAP.resize(); if(CARTE_PRETE) dessineCarte(); return }
  LMAP = new maplibregl.Map({
    container:'map', style:STYLE_POSITRON, center:[-0.08,49.24], zoom:10.2,
    attributionControl:{compact:true}, cooperativeGestures:false
  });
  LMAP.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-left');

  let repli = false;
  const passerEnRepli = ()=>{
    if(CARTE_PRETE || repli) return;
    repli = true;
    LMAP.setStyle(STYLE_VIDE);
    const attente = setInterval(()=>{ if(LMAP.isStyleLoaded()){ clearInterval(attente); ajouteCouches(true) } }, 100);
  };
  LMAP.on('load', ()=>{ if(!repli) ajouteCouches(false) });
  LMAP.on('error', e=>{
    const u = String((e.error && (e.error.url || e.error.message)) || '');
    if(!CARTE_PRETE && u.includes('styles/positron')) passerEnRepli();
  });
  setTimeout(passerEnRepli, 8000);     /* réseau bloqué ou très lent */
}

function ajouteCouches(horsLigne){
  if(CARTE_PRETE) return;
  /* les couches thématiques s'insèrent sous les libellés du fond, qui restent lisibles */
  const sym = (LMAP.getStyle().layers || []).find(l=>l.type==='symbol');
  const avant = sym ? sym.id : undefined;

  LMAP.addSource('ign', {type:'raster', tiles:[TUILES_IGN], tileSize:256, maxzoom:19,
                         attribution:'© IGN – Géoplateforme'});
  LMAP.addLayer({id:'ign', type:'raster', source:'ign', layout:{visibility:'none'}}, avant);

  LMAP.addSource('communes', {type:'geojson', data:GEO});
  LMAP.addLayer({id:'communes-aplat', type:'fill', source:'communes',
    paint:{'fill-color':['coalesce',['get','_fill'],'#F2F0EB'], 'fill-opacity':0.78}}, avant);
  LMAP.addLayer({id:'communes-trait', type:'line', source:'communes',
    paint:{'line-color':'#FFFFFF','line-width':1.2}}, avant);
  LMAP.addLayer({id:'communes-survol', type:'line', source:'communes',
    filter:['==',['get','_code'],''], paint:{'line-color':C.rouge,'line-width':3}}, avant);

  LMAP.on('mousemove', 'communes-aplat', e=>{
    const p = e.features[0].properties;
    LMAP.getCanvas().style.cursor = 'pointer';
    if(SURVOL !== p._code){ SURVOL = p._code; LMAP.setFilter('communes-survol', ['==',['get','_code'],p._code||'']) }
    tipOn(e.originalEvent, p._tip || '<b>Commune non rattachée</b>');
  });
  LMAP.on('mouseleave', 'communes-aplat', ()=>{
    LMAP.getCanvas().style.cursor = ''; SURVOL = null;
    LMAP.setFilter('communes-survol', ['==',['get','_code'],'']); tipOff();
  });

  CARTE_PRETE = true;
  if(horsLigne){
    const o = document.getElementById('map-fond');
    o.title = 'Fond Positron indisponible (hors connexion) : aplat neutre affiché';
  }
  cadre();
  dessineCarte();
}

function cadre(){
  let w=180, s=90, e=-180, n=-90;
  const parcours = c => { if(typeof c[0]==='number'){ w=Math.min(w,c[0]); e=Math.max(e,c[0]); s=Math.min(s,c[1]); n=Math.max(n,c[1]) } else c.forEach(parcours) };
  GEO.features.forEach(f=>f.geometry && parcours(f.geometry.coordinates));
  if(w<e) LMAP.fitBounds([[w,s],[e,n]], {padding:24, duration:0});
}

function basculeFond(){
  if(!CARTE_PRETE) return;
  const ortho = document.getElementById('map-fond').value === 'sat';
  LMAP.setLayoutProperty('ign', 'visibility', ortho ? 'visible' : 'none');
  LMAP.setPaintProperty('communes-aplat', 'fill-opacity', ortho ? 0.55 : 0.78);
}

function dessineCarte(){
  if(!GEO || !CARTE_PRETE) return;
  const k = document.getElementById('map-ind').value, an = +document.getElementById('map-annee').value;
  document.getElementById('map-annee-v').textContent = an;
  const t = vals(k,an).map(o=>o.v).sort((a,b)=>a-b);
  if(!t.length){ document.getElementById('map-legend').innerHTML='<span>Aucune donnée pour cette année.</span>'; return }
  const q = p => t[Math.min(t.length-1, Math.floor(p*(t.length-1)))];
  const seuils = [q(.2),q(.4),q(.6),q(.8)];
  const coul = v => v==null ? null : PALETTE_CARTE[seuils.filter(s=>v>s).length];

  let trouve = 0;
  GEO.features.forEach(f=>{
    const p = f.properties || (f.properties = {});
    const c = cleGeo(p), connue = c && DATA.communes[c];
    const i = connue ? gInfo(k,c,an) : null;
    if(connue) trouve++;
    p._code = c || '';
    p._fill = i ? coul(i.v) : null;
    p._tip = connue
      ? `<b>${NOM(c)}</b><br>${libDe(k)}<br><span style="font-size:15px;font-weight:600">${i?fmtU(i.v,uniteDe(k)):'—'}</span>${i&&i.report?`<br><i>millésime ${i.an}</i>`:''}`
      : '<b>Commune non rattachée</b>';
  });
  LMAP.getSource('communes').setData(GEO);

  document.getElementById('map-legend').innerHTML =
    PALETTE_CARTE.map((c,i)=>`<span><i style="background:${c}"></i>${
      i===0?'< '+fmt(seuils[0]) : (i===4?'≥ '+fmt(seuils[3]) : fmt(seuils[i-1])+' à '+fmt(seuils[i]))}</span>`).join('') +
    `<span style="margin-left:auto;color:${trouve<38?C.rouge:C.ardoise}">${trouve} / 38 communes rattachées</span>`;
}
