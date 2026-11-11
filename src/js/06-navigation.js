/* ==========================================================================
   Navigation & initialisation
   ========================================================================== */
const RENDU = {synthese:pageSynthese, demo:pageDemo, logement:pageLogement,
  construction:pageConstruction, emploi:pageEmploi, tourisme:pageTourisme,
  revenus:pageRevenus, communes:pageAtlas, duel:pageDuel, donnees:pageDonnees,
  carte:()=>{initCarte(); if(GEO) montreCarte()}};
const FAIT = {};

function ouvre(p){
  document.querySelectorAll('.page').forEach(s=>s.classList.toggle('on', s.id==='p-'+p));
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on', b.dataset.p===p));
  if(!FAIT[p]){ RENDU[p] && RENDU[p](); FAIT[p]=1 }
  else if(p==='carte'){ RENDU.carte() }
  scrollTo({top:0, behavior:'instant'});
}
document.getElementById('nav').addEventListener('click', e=>{
  const b=e.target.closest('button'); if(b) ouvre(b.dataset.p);
});

let tRedim;
addEventListener('resize', ()=>{
  clearTimeout(tRedim);
  tRedim = setTimeout(()=>{
    const p = document.querySelector('#nav button.on').dataset.p;
    RENDU[p] && RENDU[p]();
    if(LMAP) LMAP.resize();
  }, 220);
});

function initSliders(){
  [['atlas-annee',2023],['duel-annee',2023],['map-annee',2023]].forEach(([id,def])=>{
    const s=document.getElementById(id);
    s.min=AN_MIN; s.max=AN_MAX; s.value=def; s.step=1;
    document.getElementById(id+'-v').textContent = def;
  });
  document.getElementById('atlas-annee').oninput = pageAtlas;
  document.getElementById('atlas-filtre').oninput = pageAtlas;
  document.getElementById('atlas-csv').onclick = exportCSV;
  document.querySelectorAll('[data-vue]').forEach(b=>b.onclick=()=>{
    atlasVue=b.dataset.vue;
    document.querySelectorAll('[data-vue]').forEach(x=>x.classList.toggle('on', x===b));
    pageAtlas();
  });
  const opts = COM.map(c=>`<option value="${c}">${NOM(c)}</option>`).join('');
  const a=document.getElementById('duel-a'), b=document.getElementById('duel-b');
  a.innerHTML=opts; b.innerHTML=opts;
  a.value='14117'; b.value='14225';
  a.onchange=b.onchange=pageDuel;
  document.getElementById('duel-annee').oninput = pageDuel;
}
initSliders();
document.getElementById('data-counts').innerHTML = `${COM.length} communes · ${AN_MIN}–${AN_MAX}<br>${Object.keys(DATA.indicateurs).length} indicateurs communaux renseignés · ${NF.format(DATA.nb_valeurs)} valeurs`;
ouvre('synthese');
