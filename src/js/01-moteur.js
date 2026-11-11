/* ==========================================================================
   Observatoire NCPA — moteur du tableau de bord
   ========================================================================== */
const C = {rouge:'#B91E27', vert:'#B1B993', vertF:'#7C8560', maree:'#2A6F7F',
           mareeC:'#8FBAC4', encre:'#1B211F', ardoise:'#5F6B6D', trait:'#E2DED5',
           sable:'#F6F4EF', or:'#C98A2B', prune:'#6E4B63'};
const PALETTE = [C.rouge, C.maree, C.vertF, C.or, C.prune, C.mareeC, C.vert, C.ardoise];

/* --- indicateurs stockés en fraction (0-1) alors que l'unité annoncée est % --- */
const FRACTION = new Set(['I092','I093','I094','I097','I099','I383']);

/* --- règles d'agrégation à l'échelle EPCI ---------------------------------- */
const AGG = {};
['I001','I002','I039','I040','I041','I042','I053','I054','I057','I374','I375','I376',
 'I377','I091','I378','I379','I380','I381','I382','I095','I384','I385','I386','I387',
 'I388','I389','I390','I391','I392','I393','I394','I395','I396'].forEach(k=>AGG[k]={m:'somme'});
AGG.I092 = {m:'ratio', num:'I091', den:'I378'};
/* taux d'emploi = (actifs − chômeurs) ÷ population 15-64, vérifié contre les valeurs
   communales : écart maximal 0,012 point. La formule I380 ÷ I378 donnerait 1,5 point de trop. */
AGG.I093 = {m:'calc', f:an=>rap(diff(E('I091',an),E('I379',an)), E('I378',an), 100)};
AGG.I097 = {m:'ratio', num:'I379', den:'I091'};
AGG.I096 = {m:'ratio', num:'I095', den:'I380', f:100};
AGG.I383 = {m:'ratio', num:'I382', den:'I381'};
AGG.I099 = {m:'moyp', p:'I380'};
AGG.I094 = {m:'moyp', p:'I378', approx:true};
AGG.I073 = {m:'moyp', p:'I001', approx:true};
AGG.I074 = {m:'moyp', p:'I001', approx:true};
AGG.I075 = {m:'moyp', p:'I001', approx:true};
AGG.I079 = {m:'moyp', p:'I001', approx:true};
AGG.I076 = {m:'moyp', p:'I001', approx:true};
AGG.I055 = {m:'moyp', p:'I053'};
AGG.I056 = {m:'moyp', p:'I053'};
AGG.I078 = {m:'moyp', p:'I001', approx:true};

/* --- indicateurs calculés ici, absents du classeur ------------------------- */
const DERIVES = {
  D_TXRS  :{l:"Part de résidences secondaires", u:"%", t:"Calculé", f:(c,y)=>rap(g('I041',c,y), g('I039',c,y), 100)},
  D_TXVAC :{l:"Part de logements vacants", u:"%", t:"Calculé", f:(c,y)=>rap(g('I042',c,y), g('I039',c,y), 100)},
  D_LITSM :{l:"Lits marchands", u:"lits", t:"Calculé",
            f:(c,y)=>som(mult(g('I385',c,y),2), mult(g('I387',c,y),3), g('I390',c,y))},
  D_LITSN :{l:"Lits non marchands (résidences secondaires)", u:"lits", t:"Calculé",
            f:(c,y)=>{const rs=g('I041',c,y); return rs==null?null:rs*5}},
  D_LITS  :{l:"Capacité d'accueil totale", u:"lits", t:"Calculé",
            f:(c,y)=>som(DERIVES.D_LITSM.f(c,y), DERIVES.D_LITSN.f(c,y))},
  D_PRESS :{l:"Indice de pression touristique", u:"lits/hab", t:"Calculé",
            f:(c,y)=>rap(DERIVES.D_LITS.f(c,y), g('I001',c,y), 1)},
  D_POINTE:{l:"Population permanente + capacité théorique", u:"personnes", t:"Calculé",
            f:(c,y)=>som(g('I001',c,y), DERIVES.D_LITS.f(c,y))},
  D_TVAM  :{l:"Croissance annuelle moyenne depuis 2010", u:"%/an", t:"Calculé",
            f:(c,y)=>{const a=raw('I001',c,2010), b=raw('I001',c,y);
              return (a?.v>0&&b?.v>0&&b.an>2010)?(Math.pow(b.v/a.v,1/(b.an-2010))-1)*100:null}},
  D_REAL  :{l:"Rapport annuel commencés / autorisés", u:"%", t:"Calculé",
            f:(c,y)=>rap(g('I054',c,y), g('I053',c,y), 100)},
  D_AUT1K :{l:"Logements autorisés pour 1 000 habitants", u:"log./1000 hab", t:"Calculé",
            f:(c,y)=>rap(g('I053',c,y), g('I001',c,y), 1000)},
  D_DENSL :{l:"Logements par habitant", u:"log./hab", t:"Calculé",
            f:(c,y)=>rap(g('I039',c,y), g('I001',c,y), 1)}
};
/* --- superficies issues du fond communal embarqué (ha -> km²) -------------- */
/* SUPERFICIES (km²) est injecté à la construction depuis data/processed/communes.csv */
const SUP = (typeof SUPERFICIES !== 'undefined') ? SUPERFICIES : {};
const SUP_EPCI = Object.values(SUP).reduce((a,b)=>a+b, 0);

Object.assign(DERIVES, {
  D_SUP   :{l:"Superficie cadastrale", u:"km²", t:"Calculé", f:c=>SUP[c]??null},
  D_DENSP :{l:"Densité de population", u:"hab/km²", t:"Calculé",
            f:(c,y)=>rap(g('I001',c,y), SUP[c], 1)},
  D_DENSL2:{l:"Densité de logements", u:"log./km²", t:"Calculé",
            f:(c,y)=>rap(g('I039',c,y), SUP[c], 1)},
  D_DENSLIT:{l:"Densité de lits d'accueil", u:"lits/km²", t:"Calculé",
            f:(c,y)=>rap(DERIVES.D_LITS.f(c,y), SUP[c], 1)}
});

function rap(a,b,f){return (a==null||b==null||b===0)?null:a/b*f}
function mult(a,b){return a==null||b==null?null:a*b}
function diff(a,b){return a==null||b==null?null:a-b}
function som(...a){return a.some(x=>x==null)?null:a.reduce((s,x)=>s+x,0)}

/* ==========================================================================
   Accès aux valeurs
   ========================================================================== */
const COM = Object.keys(DATA.communes).sort((a,b)=>DATA.communes[a].localeCompare(DATA.communes[b],'fr'));
const NOM = c=>DATA.communes[c]||c;
let ANNEES = DATA.annees;
const AN_MIN = Math.min(...ANNEES), AN_MAX = Math.max(...ANNEES);

/* Seuls les stocks RP peuvent être reportés. Une observation manquante à un
   millésime présent dans la série reste manquante (pas de comblement du secret). */
const REPORTABLE = new Set(['I001','I002','I039','I040','I041','I042',
  'I091','I092','I093','I094','I095','I096','I097','I099',
  'I375','I376','I377','I378','I379','I380','I381','I382','I383']);
const MILLESIMES = Object.fromEntries(Object.entries(DATA.series).map(([k,s])=>
  [k,new Set(Object.values(s).flatMap(d=>Object.keys(d).map(Number)))]));
let TRACE = null;
function raw(key, com, an){
  const d = DATA.series[key]?.[com];
  let r = null;
  if(d?.[an]!=null) r={v:d[an], an:+an, report:false};
  else if(d && REPORTABLE.has(key.split('::')[0]) && !MILLESIMES[key].has(+an)){
    const years=[...MILLESIMES[key]].filter(y=>y<=an);
    const best=years.length?Math.max(...years):null;
    if(best!=null && d[best]!=null) r={v:d[best], an:best, report:true};
  }
  if(TRACE) TRACE.push(r ? {...r, key} : {key, manque:true});
  return r;
}
/* valeur normalisée (fractions converties en %) */
function g(key, com, an){
  if(key.startsWith('D_')) return DERIVES[key].f(com, an);
  const r = raw(key, com, an); if(!r) return null;
  return FRACTION.has(key.split('::')[0]) ? r.v*100 : r.v;
}
function gInfo(key, com, an){
  return mesureInfo(()=>g(key,com,an), key, an, false);
}
function mesureInfo(calcul, key, an, epci){
  const precedent=TRACE;
  TRACE=[];
  let v, traces;
  try{v=calcul(); traces=TRACE}finally{TRACE=precedent}
  const annees=[...new Set(traces.filter(r=>!r.manque).map(r=>r.an))].sort((a,b)=>a-b);
  const officiel=epci && DATA.epci?.[key]?.[an];
  const estimation=['D_LITSM','D_LITSN','D_LITS','D_PRESS','D_POINTE','D_DENSLIT'].includes(key);
  const sources=officiel?[officiel.source]:[...new Set(traces.map(r=>{
    const code=DATA.indicateurs[r.key.split('::')[0]]?.src;
    return DATA.sources[code]?.url || DATA.sources[code]?.s || '';
  }).filter(Boolean))];
  if(key==='D_SUP'||key.startsWith('D_DENS')) sources.push('IGN — superficie cadastrale');
  return {v, an:annees.length?Math.max(...annees):null, annees, sources,
    report:traces.some(r=>r.report), partiel:traces.some(r=>r.manque),
    statut:v==null?'absent':officiel?'publié INSEE':epci&&estApprox(key,an)?'approximation':
      estimation?'estimation':key.startsWith('D_')||epci?'calculé':'observé'};
}
function EInfo(key,an){return mesureInfo(()=>E(key,an),key,an,true)}
function metaTexte(info){
  if(!info || info.v==null) return 'Donnée absente';
  return info.statut+(info.annees.length?' · '+info.annees.join(' / '):' · sans millésime')+
    (info.report?' · report':'')+(info.partiel?' · couverture partielle':'');
}
function dernierRevenuEPCI(){
  const annees=Object.keys(DATA.epci?.I073||{}).map(Number)
    .filter(y=>DATA.epci?.I075?.[y]);
  return annees.length?Math.max(...annees):null;
}
function medianeCommunes(key,an){
  const v=vals(key,an).map(o=>o.v).sort((a,b)=>a-b), n=v.length;
  return n?(v[Math.floor((n-1)/2)]+v[Math.floor(n/2)])/2:null;
}

/* agrégat EPCI */
function E(key, an){
  const officiel=DATA.epci?.[key]?.[an];
  if(officiel){
    if(TRACE) TRACE.push({key,an:+an,report:false});
    return officiel.v;
  }
  // Filosofi 2 : ne jamais substituer une moyenne communale au chiffre EPCI publié.
  if((key==='I073'||key==='I075') && an>=2023){
    if(TRACE) TRACE.push({key,manque:true});
    return null;
  }
  if(key.startsWith('D_')){
    switch(key){
      case 'D_TXRS' : return rap(E('I041',an), E('I039',an), 100);
      case 'D_TXVAC': return rap(E('I042',an), E('I039',an), 100);
      case 'D_PRESS': return rap(E('D_LITS',an), E('I001',an), 1);
      case 'D_REAL' : return rap(E('I054',an), E('I053',an), 100);
      case 'D_AUT1K': return rap(E('I053',an), E('I001',an), 1000);
      case 'D_DENSL': return rap(E('I039',an), E('I001',an), 1);
      case 'D_SUP'  : return SUP_EPCI;
      case 'D_DENSP': return rap(E('I001',an), SUP_EPCI, 1);
      case 'D_DENSL2': return rap(E('I039',an), SUP_EPCI, 1);
      case 'D_DENSLIT': return rap(E('D_LITS',an), SUP_EPCI, 1);
      case 'D_TVAM' : {const a=E('I001',2010), b=E('I001',an);
                       const fin=Math.max(...[...MILLESIMES.I001].filter(y=>y<=an));
                       return (a&&b&&fin>2010)?(Math.pow(b/a,1/(fin-2010))-1)*100:null}
      default: return som(...COM.map(c=>DERIVES[key].f(c,an)));
    }
  }
  const base = key.split('::')[0], r = AGG[base] || {m:'moyp', p:'I001', approx:true};
  if(r.m==='somme') return som(...COM.map(c=>g(key,c,an)));
  if(r.m==='ratio'){ return rap(E(r.num,an), E(r.den,an), r.f||100) }
  if(r.m==='calc'){ return r.f(an) }
  let sw=0, sv=0;
  const poids=key==='I056::commences'?'I054':r.p;
  let incomplet=false;
  COM.forEach(c=>{
    const v=g(key,c,an), w=g(poids,c,an);
    if(!r.approx && (w==null || (w>0 && v==null))) incomplet=true;
    if(v!=null&&w!=null){sv+=v*w; sw+=w}
  });
  if(incomplet) return null;
  return sw?sv/sw:null;
}
function estApprox(key,an){
  if(DATA.epci?.[key]?.[an]) return false;
  const r=AGG[key.split('::')[0]]; return !!(r&&r.approx);
}

/* liste des communes valuées pour une série/année */
function vals(key, an){
  return COM.map(c=>({c, n:NOM(c), v:g(key,c,an)})).filter(o=>o.v!=null);
}

/* ==========================================================================
   Formatage
   ========================================================================== */
const NF = new Intl.NumberFormat('fr-FR');
function fmt(v, d){
  if(v==null||isNaN(v)) return '—';
  const dec = d==null ? (Math.abs(v)>=100?0:(Math.abs(v)>=10?1:2)) : d;
  return v.toLocaleString('fr-FR',{minimumFractionDigits:dec, maximumFractionDigits:dec});
}
function fmtU(v, u, d){
  if(v==null) return '—';
  const s = fmt(v,d);
  if(u==='%'||u==='%/an') return s+' %';
  if(u&&u.startsWith('€')) return s+' €';
  return s;
}
const uniteDe = key => key.startsWith('D_') ? DERIVES[key].u
  : (FRACTION.has(key.split('::')[0]) ? '%' : (DATA.indicateurs[key.split('::')[0]]||{}).u||'');
function libDe(key){
  if(key.startsWith('D_')) return DERIVES[key].l;
  const [b,sc] = key.split('::');
  const i = DATA.indicateurs[b]; if(!i) return key;
  return i.l + (sc ? ' — '+sc.replace(/_/g,' ') : '');
}
const themeDe = key => key.startsWith('D_') ? 'Indicateurs calculés'
  : (DATA.indicateurs[key.split('::')[0]]||{}).t||'';

/* ==========================================================================
   Infobulle
   ========================================================================== */
const TIP = document.getElementById('tip');
function tipOn(e, html){
  TIP.innerHTML = html; TIP.style.opacity = 1;
  const r = TIP.getBoundingClientRect();
  let x = e.clientX+14, y = e.clientY-10;
  if(x+r.width>innerWidth-8) x = e.clientX-r.width-14;
  if(y+r.height>innerHeight-8) y = innerHeight-r.height-8;
  TIP.style.left = x+'px'; TIP.style.top = y+'px';
}
const tipOff = ()=>TIP.style.opacity = 0;
function bindTip(el, html){
  el.addEventListener('mousemove', e=>tipOn(e,html));
  el.addEventListener('mouseleave', tipOff);
}

/* ==========================================================================
   Librairie SVG
   ========================================================================== */
const NS = 'http://www.w3.org/2000/svg';
function largeur(host){
  const w = host.clientWidth || host.parentElement && host.parentElement.clientWidth || 700;
  return Math.round(Math.max(320, Math.min(1360, w)));
}
function svg(w, h){
  const s = document.createElementNS(NS,'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('preserveAspectRatio','xMidYMid meet');
  return s;
}
function el(p, tag, attrs, txt){
  const e = document.createElementNS(NS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  if(txt!=null) e.textContent = txt;
  p.appendChild(e); return e;
}
/* place les vignettes de légende sur une ou plusieurs lignes selon la largeur
   disponible, pour éviter les chevauchements sur écran étroit */
function legende(s, items, x0, w, y0){
  const large = Math.max(...items.map(o=>o.n.length))*6.2 + 22;
  const parLigne = Math.max(1, Math.min(items.length, Math.floor(w/large)));
  items.forEach((o,k)=>{
    const col = k % parLigne, lig = Math.floor(k/parLigne);
    const x = x0 + col*(w/parLigne), y = y0 + lig*14;
    el(s,'rect',{x, y:y-9, width:11, height:11, rx:3, fill:o.c});
    el(s,'text',{x:x+16, y:y+0.5, 'font-size':11.5, fill:C.ardoise}, o.n);
  });
  return Math.ceil(items.length/parLigne);
}
function nice(max, min){
  min = min||0;
  const span = max-min || 1, p = Math.pow(10, Math.floor(Math.log10(span)));
  const step = span/p<=2?p/2 : span/p<=5?p : p*2;
  return {hi: Math.ceil(max/step)*step, lo: Math.floor(min/step)*step, step};
}
function axes(s, x0, y0, w, h, lo, hi, labelsX, opts){
  opts = opts||{};
  const n = nice(hi, lo); const rng = n.hi-n.lo || 1;
  const Y = v => y0+h - (v-n.lo)/rng*h;
  for(let v=n.lo; v<=n.hi+1e-9; v+=n.step){
    el(s,'line',{x1:x0, x2:x0+w, y1:Y(v), y2:Y(v), stroke:C.trait, 'stroke-width':1});
    el(s,'text',{x:x0-8, y:Y(v)+4, 'text-anchor':'end', 'font-size':11, fill:C.ardoise},
       opts.fy?opts.fy(v):fmt(v, (Math.abs(v)>=10||Number.isInteger(v))?0:1));
  }
  if(labelsX){
    const step = Math.ceil(labelsX.length/ (opts.maxX||9));
    labelsX.forEach((lab,i)=>{
      if(i%step && i!==labelsX.length-1) return;
      const ins = opts.inset||0;
      const x = x0 + ins + (labelsX.length===1?(w-2*ins)/2:i/(labelsX.length-1)*(w-2*ins));
      el(s,'text',{x, y:y0+h+17, 'text-anchor':'middle', 'font-size':11, fill:C.ardoise}, lab);
    });
  }
  return {Y, n};
}

/* --- graphique linéaire multi-séries -------------------------------------- */
function lineChart(host, series, opts){
  opts = opts||{};
  const W = largeur(host);
  const mL = opts.l||52, wDispo = W-mL-14;
  const nLig = opts.legend===false ? 0 :
    Math.ceil(series.length / Math.max(1, Math.min(series.length,
      Math.floor(wDispo/(Math.max(...series.map(se=>se.n.length))*6.2+22)))));
  const m = {t: opts.legend===false?10:(12+nLig*14), r:14, b:26, l:mL};
  const H = (opts.h||280) + Math.max(0,(nLig-1))*14;
  const w = W-m.l-m.r, h = H-m.t-m.b;
  const s = svg(W,H); host.innerHTML=''; host.appendChild(s);
  const xs = opts.x;
  let hi = -Infinity, lo = opts.zero===false ? Infinity : 0;
  series.forEach(se=>se.v.forEach(v=>{if(v!=null){hi=Math.max(hi,v); lo=Math.min(lo,v)}}));
  if(hi===-Infinity){host.innerHTML='<p class="note">Aucune donnée disponible.</p>'; return}
  const A = axes(s, m.l, m.t, w, h, lo, hi, xs.map(String), opts);
  const X = i => m.l + (xs.length===1?w/2:i/(xs.length-1)*w);
  series.forEach((se,k)=>{
    const col = se.c || PALETTE[k%PALETTE.length];
    let d='', open=false;
    se.v.forEach((v,i)=>{ if(v==null){open=false; return}
      d += (open?'L':'M') + X(i) + ',' + A.Y(v) + ' '; open=true; });
    el(s,'path',{d, fill:'none', stroke:col, 'stroke-width':se.w||2.2,
                 'stroke-linejoin':'round','stroke-linecap':'round',
                 'stroke-dasharray':se.dash||''});
    se.v.forEach((v,i)=>{ if(v==null) return;
      const cc = el(s,'circle',{cx:X(i), cy:A.Y(v), r:3.4, fill:'#fff', stroke:col, 'stroke-width':2});
      cc.style.cursor='crosshair';
      bindTip(cc, `<b>${xs[i]}</b> · ${se.n}<br>${fmtU(v, opts.u, opts.d)}`);
    });
  });
  if(opts.legend!==false)
    legende(s, series.map((se,k)=>({n:se.n, c:se.c||PALETTE[k%PALETTE.length]})), m.l, w, 11);
  if(opts.rule!=null){
    el(s,'line',{x1:m.l, x2:m.l+w, y1:A.Y(opts.rule), y2:A.Y(opts.rule),
                 stroke:C.rouge, 'stroke-width':1.4, 'stroke-dasharray':'5 4'});
    el(s,'text',{x:m.l+w, y:A.Y(opts.rule)-6, 'text-anchor':'end', 'font-size':11, fill:C.rouge}, opts.ruleLab||'');
  }
}

/* --- barres horizontales classées ----------------------------------------- */
function barRank(host, items, opts){
  opts = opts||{};
  const rowH = opts.rowH||17, W = largeur(host);
  const m = {t:6, r:58, b:opts.axis?24:6, l:Math.min(opts.l||132, Math.round(W*0.34))};
  const H = m.t + items.length*rowH + m.b;
  const w = W-m.l-m.r;
  const s = svg(W,H); host.innerHTML=''; host.appendChild(s);
  if(!items.length){host.innerHTML='<p class="note">Aucune donnée disponible.</p>'; return}
  const mxP = Math.max(0, ...items.map(o=>o.v));
  const mxN = Math.max(0, ...items.map(o=>-o.v));
  const neg = mxN > 0;
  /* l'axe zéro est placé au prorata des amplitudes : une barre négative ne peut plus
     déborder sur la colonne des libellés, quelle que soit sa longueur */
  const etendue = (mxP + mxN) || 1e-9;
  const scale = w / etendue;
  const zero = m.l + mxN * scale;
  items.forEach((o,i)=>{
    const y = m.t + i*rowH, bw = Math.abs(o.v)*scale;
    const col = o.col || (o.v<0 ? C.rouge : (opts.c||C.maree));
    el(s,'text',{x:m.l-8, y:y+rowH/2+4, 'text-anchor':'end', 'font-size':11.5,
                 fill: o.hi?C.rouge:C.encre, 'font-weight':o.hi?700:400}, o.n);
    const r = el(s,'rect',{x:o.v<0?zero-bw:zero, y:y+2, width:Math.max(bw,.5), height:rowH-5,
                           rx:2, fill:col, opacity:o.hi?1:.86});
    r.style.cursor='crosshair';
    bindTip(r, `<b>${o.n}</b><br>${fmtU(o.v, opts.u, opts.d)}${o.sub?'<br>'+o.sub:''}`);
    /* colonne de valeurs alignée à droite : jamais de chevauchement avec les libellés,
       quelle que soit la longueur ou le signe de la barre */
    el(s,'text',{x:W-m.r+6, y:y+rowH/2+4, 'text-anchor':'start', 'font-size':11, fill:C.ardoise},
       fmt(o.v, opts.d));
  });
  if(opts.rule!=null){
    const x = zero + opts.rule*scale;
    el(s,'line',{x1:x, x2:x, y1:m.t-2, y2:H-m.b+2, stroke:C.rouge, 'stroke-width':1.4, 'stroke-dasharray':'5 4'});
    el(s,'text',{x:x+5, y:H-m.b-1, 'font-size':10.5, fill:C.rouge, 'font-weight':600}, opts.ruleLab||'');
  }
  if(neg) el(s,'line',{x1:zero, x2:zero, y1:m.t, y2:H-m.b, stroke:C.ardoise, 'stroke-width':1});
}

/* --- barres empilées (par année) ------------------------------------------ */
function stackChart(host, xs, couches, opts){
  opts = opts||{};
  const W=largeur(host), mL=opts.l||56, wD=W-mL-14;
  const nLig = Math.ceil(couches.length / Math.max(1, Math.min(couches.length,
    Math.floor(wD/(Math.max(...couches.map(c=>c.n.length))*6.2+22)))));
  const m={t:12+nLig*14, r:14, b:26, l:mL};
  const H=(opts.h||280)+Math.max(0,(nLig-1))*14;
  const w=W-m.l-m.r, h=H-m.t-m.b;
  const s=svg(W,H); host.innerHTML=''; host.appendChild(s);
  const tot = xs.map((_,i)=>som(...couches.map(cch=>cch.v[i])));
  const hi = Math.max(...tot.filter(v=>v!=null), 1e-9);
  const bw0 = Math.min(38, w/xs.length*0.68);
  const A = axes(s, m.l, m.t, w, h, 0, opts.pct?100:hi, xs.map(String),
                 Object.assign({}, opts, {inset: bw0/2+3}));
  const bw = Math.min(38, w/xs.length*0.68);
  const pad = bw/2 + 3;                       /* évite le débordement sur l'axe */
  xs.forEach((x,i)=>{
    const cx = m.l + pad + (xs.length===1?(w-2*pad)/2:i/(xs.length-1)*(w-2*pad));
    if(tot[i]==null){
      el(s,'text',{x:cx,y:m.t+h-6,'text-anchor':'middle','font-size':12,fill:C.ardoise},'—');
      return;
    }
    let acc = 0;
    couches.forEach((cch,k)=>{
      let v = cch.v[i]||0;
      if(opts.pct) v = tot[i] ? v/tot[i]*100 : 0;
      if(v<=0) return;
      const y0 = A.Y(acc+v), y1 = A.Y(acc);
      const r = el(s,'rect',{x:cx-bw/2, y:y0, width:bw, height:Math.max(y1-y0,0.5),
                             fill:cch.c||PALETTE[k%PALETTE.length]});
      r.style.cursor='crosshair';
      bindTip(r, `<b>${x}</b> · ${cch.n}<br>${fmtU(opts.pct?v:cch.v[i], opts.pct?'%':opts.u, opts.d)}`);
      acc += v;
    });
  });
  legende(s, couches.map((c,k)=>({n:c.n, c:c.c||PALETTE[k%PALETTE.length]})), m.l, w, 11);
}

/* --- nuage de points ------------------------------------------------------- */
function scatter(host, pts, opts){
  opts = opts||{};
  const W=largeur(host), H=opts.h||320, m={t:14, r:16, b:42, l:58};
  const w=W-m.l-m.r, h=H-m.t-m.b;
  const s=svg(W,H); host.innerHTML=''; host.appendChild(s);
  if(!pts.length){host.innerHTML='<p class="note">Aucune donnée disponible.</p>'; return}
  const xh=Math.max(...pts.map(p=>p.x)), xl=Math.min(0,...pts.map(p=>p.x));
  const yh=Math.max(...pts.map(p=>p.y)), yl=Math.min(0,...pts.map(p=>p.y));
  const nx=nice(xh,xl), ny=nice(yh,yl);
  const X=v=>m.l+(v-nx.lo)/((nx.hi-nx.lo)||1)*w, Y=v=>m.t+h-(v-ny.lo)/((ny.hi-ny.lo)||1)*h;
  for(let v=ny.lo; v<=ny.hi+1e-9; v+=ny.step){
    el(s,'line',{x1:m.l,x2:m.l+w,y1:Y(v),y2:Y(v),stroke:C.trait});
    el(s,'text',{x:m.l-8,y:Y(v)+4,'text-anchor':'end','font-size':11,fill:C.ardoise}, fmt(v,v>=10?0:1));
  }
  for(let v=nx.lo; v<=nx.hi+1e-9; v+=nx.step){
    el(s,'line',{x1:X(v),x2:X(v),y1:m.t,y2:m.t+h,stroke:C.trait});
    el(s,'text',{x:X(v),y:m.t+h+16,'text-anchor':'middle','font-size':11,fill:C.ardoise}, fmt(v,v>=10?0:1));
  }
  el(s,'text',{x:m.l+w/2, y:H-4,'text-anchor':'middle','font-size':11.5,fill:C.ardoise,'font-weight':600}, opts.xl||'');
  el(s,'text',{x:-(m.t+h/2), y:12, transform:'rotate(-90)','text-anchor':'middle','font-size':11.5,fill:C.ardoise,'font-weight':600}, opts.yl||'');
  const rh = Math.max(...pts.map(p=>p.r||1));
  pts.forEach(p=>{
    const rr = 4 + (p.r?Math.sqrt(p.r/rh)*11:0);
    const cc = el(s,'circle',{cx:X(p.x), cy:Y(p.y), r:rr, fill:p.c||C.maree, opacity:.6,
                              stroke:p.c||C.maree, 'stroke-width':1.2});
    cc.style.cursor='crosshair';
    bindTip(cc, `<b>${p.n}</b><br>${opts.xl} : ${fmt(p.x)}<br>${opts.yl} : ${fmt(p.y)}${p.r?'<br>'+(opts.rl||'')+' : '+fmt(p.r,0):''}`);
    if(p.lab) el(s,'text',{x:X(p.x), y:Y(p.y)-rr-4,'text-anchor':'middle','font-size':10.5,fill:C.encre}, p.n);
  });
}
