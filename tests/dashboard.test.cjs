const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8').replace(/\r\n/g,'\n');
const data = JSON.parse(html.match(/const DATA = (.*);\r?\n/)[1]);
const surfaces = JSON.parse(html.match(/const SUPERFICIES = (.*);\r?\n/)[1]);
const modules = fs.readdirSync(path.join(root,'src/js')).filter(f=>f.endsWith('.js')).sort()
  .map(f=>fs.readFileSync(path.join(root,'src/js',f),'utf8').replace(/\r\n/g,'\n'));

// Un double de DOM minimal permet d'exécuter les fonctions de restitution.
// Ces tests vérifient les valeurs et attributs produits, pas la mise en page navigateur.
class Element {
  constructor(){
    this.style={}; this.attrs={}; this.children=[]; this.dataset={}; this.options=[];
    this.classList={toggle(){},add(){},remove(){}}; this.clientWidth=1000; this.value='';
  }
  set innerHTML(value){this.markup=value;this.children=[]}
  get innerHTML(){return this.markup||''}
  setAttribute(k,v){this.attrs[k]=String(v)}
  appendChild(e){this.children.push(e);return e}
  addEventListener(){}
  querySelectorAll(){return []}
}
function app(mutator=()=>{}){
  const fixture=structuredClone(data);mutator(fixture);
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
  const context=vm.createContext({console,document:{getElementById:node,querySelector:node,
    querySelectorAll:()=>[],createElement:()=>new Element(),createElementNS:()=>new Element()},
    addEventListener(){},scrollTo(){},setTimeout,clearTimeout,Blob,URL});
  vm.runInContext(`const DATA=${JSON.stringify(fixture)}; const SUPERFICIES=${JSON.stringify(surfaces)};`,context);
  vm.runInContext(modules.join('\n'),context);
  return {run:code=>vm.runInContext(code,context),node};
}
function close(actual,expected){assert.ok(Math.abs(actual-expected)<0.001,`${actual} != ${expected}`)}

test('un seul livrable contient les données et les modules actuels',()=>{
  const entry=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(!entry.includes('const DATA'));
  assert.ok(entry.includes('href="dist/index.html"'));
  modules.forEach(source=>assert.ok(html.includes(source)));
  assert.ok(!html.includes('@@SCRIPTS@@'));
  const a=app();
  close(a.run("g('I097','14117',2023)"),14);
  assert.equal(a.run("g('I041','14117',2023)"),8774);
});

test('les flux annuels et les revenus ne sont pas reportés',()=>{
  const a=app();
  assert.equal(a.run("E('I054',2024)"),222);
  assert.equal(a.run("E('I054',2025)"),null);
  assert.equal(a.run("E('D_REAL',2025)"),null);
  assert.equal(a.run("g('I073','14117',2023)"),null);
  assert.equal(a.run("g('I385','14117',2027)"),null);
});

test('les stocks reportés conservent les millésimes de leurs composantes',()=>{
  const a=app();
  assert.equal(a.run("gInfo('D_TXRS','14117',2026).an"),2023);
  assert.equal(a.run("gInfo('D_TXRS','14117',2026).report"),true);
  assert.equal(a.run("gInfo('D_AUT1K','14117',2025).annees.join('|')"),'2023|2025');
  assert.equal(a.run("gInfo('D_AUT1K','14117',2025).report"),true);
  close(a.run("g('D_TVAM','14117',2026)"),a.run("g('D_TVAM','14117',2023)"));
  close(a.run("E('D_TVAM',2026)"),a.run("E('D_TVAM',2023)"));
});

test('une lacune à un millésime connu ne récupère pas une valeur antérieure',()=>{
  const a=app(d=>delete d.series.I001['14117']['2023']);
  assert.equal(a.run("g('I001','14117',2023)"),null);
  assert.equal(a.run("g('I001','14117',2026)"),null);
  assert.equal(a.run("E('I001',2023)"),null);
  assert.equal(a.run("E('D_DENSP',2023)"),null);
  assert.match(a.node('kpi-synth').innerHTML,/Population municipale<\/div>\s*<div class="val">—/);
});

test('une absence touristique ne devient ni un zéro ni un total partiel',()=>{
  const a=app();
  for(const k of ['D_LITSM','D_LITS','D_PRESS','D_POINTE']){
    assert.equal(a.run(`g('${k}','14117',2010)`),null);
    assert.equal(a.run(`E('${k}',2010)`),null);
  }
  const missing=app(d=>delete d.series.I385['14117']['2023']);
  assert.equal(missing.run("g('D_LITSM','14117',2023)"),null);
  assert.equal(missing.run("E('D_LITS',2023)"),null);
  const zero=app(d=>{for(const k of ['I385','I387','I390'])d.series[k]['14117']['2023']=0});
  assert.equal(zero.run("g('D_LITSM','14117',2023)"),0);
});

test('les surfaces des logements commencés sont pondérées par les commencés',()=>{
  const a=app();
  close(a.run("E('I056::commences',2023)"),97.15325670498085);
  close(a.run("E('I056::commences',2024)"),85.86486486486487);
  assert.equal(a.run("E('I056::commences',2025)"),null);
});

test('les valeurs EPCI INSEE sont utilisées au bon millésime',()=>{
  const a=app();
  assert.equal(a.run("E('I073',2023)"),26780);
  assert.equal(a.run("E('I075',2023)"),10.6);
  assert.equal(a.run("EInfo('I073',2023).statut"),'publié INSEE');
  assert.equal(a.run("estApprox('I073',2023)"),false);
  assert.equal(a.run("estApprox('I073',2021)"),true);
  assert.equal(a.run("E('I073',2022)"),null);
  assert.equal(a.run("E('I073',2026)"),null);
  a.run('pageRevenus()');
  assert.match(a.node('flag-rev').innerHTML,/pas directement comparable/);
  assert.match(a.node('kpi-rev').innerHTML,/26[\s\u202f]780/);
});

test('sans base EPCI, aucune approximation ne remplace le chiffre officiel récent',()=>{
  const a=app(d=>{d.epci={};d.series.I073['14117']['2023']=30000});a.run('pageRevenus()');
  assert.match(a.node('kpi-rev').innerHTML,/Valeur INSEE indisponible/);
  assert.equal(a.run('dernierRevenuEPCI()'),null);
  assert.equal(a.run("E('I073',2023)"),null);
});

test('le repère du comparateur reste dans les bornes communales',()=>{
  const a=app();
  assert.equal(a.run(`SOCLE.every(k=>{const v=vals(k,2023).map(o=>o.v),m=medianeCommunes(k,2023);
    return !v.length || m>=Math.min(...v)&&m<=Math.max(...v)})`),true);
  a.run('pageDuel()');
  const lines=a.node('c-duel-profil').children[0].children.filter(e=>e.attrs['stroke-dasharray']==='3 2');
  assert.ok(lines.length>0);
  lines.forEach(e=>assert.ok(+e.attrs.x1>=168&&+e.attrs.x1<=926));
});

test('la carte efface les couleurs et infobulles lors du passage à une année vide',()=>{
  const a=app();
  a.run(`let updates=0;GEO={features:[{properties:{code_insee:'14117'}}]};CARTE_PRETE=true;
    LMAP={getSource:()=>({setData:()=>updates++})};
    document.getElementById('map-ind').value='D_TXRS';
    document.getElementById('map-annee').value='2023';dessineCarte();
    document.getElementById('map-annee').value='2010';dessineCarte();`);
  assert.equal(a.run('updates'),2);
  assert.equal(a.run('GEO.features[0].properties._fill'),null);
  assert.match(a.run('GEO.features[0].properties._tip'),/Donnée absente/);
  assert.match(a.node('map-legend').innerHTML,/Aucune donnée/);
});

test('le CSV conserve année demandée, sources, millésimes réels et valeurs absentes',()=>{
  const a=app();
  const csv=a.run("csvAtlas(2025,['I054','D_AUT1K'])");
  const rows=csv.trim().split('\n');
  assert.equal(rows.length,1+39*2);
  assert.match(rows[0],/millesimes_sources/);
  assert.match(rows[0],/sources/);
  assert.match(rows.find(r=>r.includes('"14117"')&&r.includes('"I054"')),/"absent"/);
  assert.match(rows.find(r=>r.includes('"14117"')&&r.includes('"D_AUT1K"')),/"2023\|2025";"calculé";"oui"/);
  assert.match(a.run("csvAtlas(2023,['I073'])"),/"26780";"€\/an";"2023";"publié INSEE"/);
});

test('le bandeau applique les proportions une seule fois et les compteurs viennent des données',()=>{
  const a=app();
  const widths=[...a.node('ruban').innerHTML.matchAll(/class="rub-fill" style="width:([^%]+)%"/g)].map(m=>+m[1]);
  assert.deepEqual(widths,[100,100,100]);
  const segments=[...a.node('ruban').innerHTML.matchAll(/class="rub-seg" style="width:([^%]+)%/g)].map(m=>+m[1]);
  close(segments[0],31981/139722.5455*100);
  assert.ok(a.node('data-counts').innerHTML.includes(Object.keys(data.indicateurs).length+' indicateurs'));
  assert.ok(a.node('data-counts').innerHTML.includes(data.nb_valeurs.toLocaleString('fr-FR')));
});

test('une barre empilée incomplète ne présente pas un total partiel',()=>{
  const a=app();
  a.run("stackChart(document.getElementById('test-stack'),[2023],[{n:'A',v:[10]},{n:'B',v:[null]}],{legend:false})");
  const graph=a.node('test-stack').children[0];
  assert.ok(graph.children.some(e=>e.textContent==='—'));
  assert.ok(!graph.children.some(e=>e.style.cursor==='crosshair'));
});

test('toutes les restitutions hors carte s’exécutent et aucun SVG ne contient NaN ou Infinity',()=>{
  const a=app();
  a.run(`for(const [nom,rendu] of Object.entries(RENDU)){if(nom!=='carte')rendu()}`);
  a.run("atlasVue='tout';pageAtlas()");
  const inspect=e=>{for(const v of Object.values(e.attrs))assert.ok(!/NaN|Infinity/.test(v),v);e.children.forEach(inspect)};
  for(const id of ['c-pop','c-constr','c-cst-surf','c-duel-profil','c-heat'])inspect(a.node(id));
});
