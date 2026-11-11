/* ==========================================================================
   Briques d'interface
   ========================================================================== */
function kpi(lab, val, cap, opt){
  opt = opt||{};
  return `<div class="kpi${opt.accent?' accent':''}">
    <div class="lab">${lab}</div>
    <div class="val">${val}${opt.unit?` <small>${opt.unit}</small>`:''}</div>
    <div class="cap">${cap||''}</div></div>`;
}
function tendance(a, b, inverse){
  if(a==null||b==null||a===0) return '<span class="flat">—</span>';
  const d = (b-a)/Math.abs(a)*100, cls = Math.abs(d)<0.5?'flat':((d>0)!==!!inverse?'up':'down');
  return `<span class="trend ${cls}">${d>0?'▲':(d<0?'▼':'=')} ${fmt(Math.abs(d),1)} %</span>`;
}
const AN_REF = 2023;   // dernier millésime de recensement complet

/* ==========================================================================
   1. SYNTHÈSE
   ========================================================================== */
function pageSynthese(){
  const y = AN_REF;
  const pop = E('I001',y), rs = E('I041',y), log = E('I039',y);
  const lm = E('D_LITSM',y), ln = E('D_LITSN',y), lt = som(lm,ln), pointe = som(pop,lt);

  /* --- ruban signature --- */
  const mx = pointe || Math.max(pop||0,lt||0,1);
  const seg = (v,c,lab)=>`<div class="rub-seg" style="width:${v/mx*100}%;background:${c}" title="${lab}">${v/mx>0.13?lab:''}</div>`;
  document.getElementById('ruban').innerHTML = `
    <div class="eyebrow">Une capacité théorique, une fréquentation à mesurer</div>
    <h3 style="margin-top:5px">Population permanente et capacité d'accueil, ${y}</h3>
    <p class="kicker">Estimation : 5 lits par résidence secondaire, 2 par chambre d'hôtel et 3 par emplacement de camping. Ces conventions ne mesurent ni l'occupation effective, ni les visiteurs à la journée, ni la capacité des infrastructures.</p>
    <div class="rub-row">
      <div class="rub-lab"><b>Habitants permanents</b>recensement INSEE</div>
      <div class="rub-bar"><div class="rub-fill" style="width:100%">${seg(pop,C.rouge,'')}</div></div>
      <div class="rub-val">${fmt(pop,0)}<span>personnes</span></div>
    </div>
    <div class="rub-row">
      <div class="rub-lab"><b>Lits d'accueil</b>marchands et diffus</div>
      <div class="rub-bar"><div class="rub-fill" style="width:100%">
        ${seg(ln,C.vertF,'Résidences secondaires')}${seg(lm,C.maree,'Marchand')}</div></div>
      <div class="rub-val">${fmt(lt,0)}<span>lits</span></div>
    </div>
    <div class="rub-row">
      <div class="rub-lab"><b>Habitants + lits théoriques</b>scénario de pleine occupation</div>
      <div class="rub-bar"><div class="rub-fill" style="width:100%">
        ${seg(pop,C.rouge,'')}${seg(ln,C.vertF,'')}${seg(lm,C.maree,'')}</div></div>
      <div class="rub-val">${fmt(pointe,0)}<span>personnes</span></div>
    </div>
    <div class="mult">× ${fmt(rap(pointe,pop,1),1)} <small>la population permanente</small></div>
    <div class="legend">
      <span><i style="background:${C.rouge}"></i>Habitants permanents</span>
      <span><i style="background:${C.vertF}"></i>Lits en résidences secondaires (${fmt(ln,0)})</span>
      <span><i style="background:${C.maree}"></i>Lits marchands (${fmt(lm,0)})</span>
    </div>`;

  /* --- KPI --- */
  const revenuAn=dernierRevenuEPCI();
  document.getElementById('kpi-synth').innerHTML =
    kpi('Population municipale', fmt(pop,0),
        `${tendance(E('I001',2010), pop)} depuis 2010 · ${fmt(E('D_TVAM',y),2)} %/an`, {accent:1}) +
    kpi('Logements', fmt(log,0),
        `${fmt(rap(log,pop,1),2)} logement par habitant`) +
    kpi('Résidences secondaires', fmt(E('D_TXRS',y),1), 'du parc total', {unit:'%', accent:1}) +
    kpi('Emplois au lieu de travail', fmt(E('I095',y),0),
        `${fmt(E('I096',y),0)} emplois pour 100 actifs résidants`) +
    kpi('Lits par habitant', fmt(E('D_PRESS',y),2),
        'indice de pression touristique', {accent:1}) +
    kpi('Logements autorisés', fmt(E('I053',2024),0),
        `en 2024 · rapport commencés/autorisés : ${fmt(E('D_REAL',2024),0)} %`) +
    kpi('Niveau de vie médian EPCI', fmt(revenuAn==null?null:E('I073',revenuAn),0),
        revenuAn==null?'Valeur INSEE indisponible':`INSEE Filosofi 2 · ${revenuAn} · par unité de consommation`, {unit:'€/an'}) +
    kpi('Taux de chômage', fmt(E('I097',y),1), 'au sens du recensement', {unit:'%'});

  /* --- population EPCI --- */
  const ans = range(2010, 2023);
  lineChart(document.getElementById('c-pop'),
    [{n:'Population municipale', v:ans.map(a=>E('I001',a)), c:C.rouge}],
    {x:ans, zero:false, legend:false, u:'hab'});

  /* --- parc --- */
  const anL = [2012,2017,2023];
  stackChart(document.getElementById('c-parc'), anL, [
    {n:'Résidences principales', v:anL.map(a=>E('I040',a)), c:C.rouge},
    {n:'Résidences secondaires', v:anL.map(a=>E('I041',a)), c:C.vertF},
    {n:'Logements vacants', v:anL.map(a=>E('I042',a)), c:C.or}
  ], {u:'logements'});

  /* --- construction --- */
  const anC = range(2013,2025);
  lineChart(document.getElementById('c-constr'), [
    {n:'Autorisés', v:anC.map(a=>E('I053',a)), c:C.rouge},
    {n:'Commencés', v:anC.map(a=>E('I054',a)), c:C.maree}
  ], {x:anC, u:'logements'});

  /* --- nuage synthèse --- */
  scatter(document.getElementById('c-scat-synth'),
    COM.map(c=>({n:NOM(c), x:g('D_TXRS',c,y), y:g('D_PRESS',c,y), r:g('I001',c,y),
                 c: g('D_TXRS',c,y)>55?C.rouge:(g('D_TXRS',c,y)>25?C.or:C.maree),
                 lab: g('D_PRESS',c,y)>=8}))
       .filter(p=>p.x!=null&&p.y!=null),
    {xl:'Part de résidences secondaires (%)', yl:'Lits par habitant', rl:'Population', h:340});

  /* --- concentration --- */
  concentration(document.getElementById('c-poids'), y);
}

function range(a,b){const r=[]; for(let i=a;i<=b;i++)r.push(i); return r}

function concentration(host, y){
  const jeux = [
    {n:'Population', k:'I001', c:C.rouge},
    {n:'Résidences secondaires', k:'I041', c:C.vertF},
    {n:"Capacité d'accueil", k:'D_LITS', c:C.maree},
    {n:'Emplois locaux', k:'I095', c:C.or}
  ];
  const W=largeur(host), H=300, m={t:26,r:130,b:34,l:48}, w=W-m.l-m.r, h=H-m.t-m.b;
  const s = svg(W,H); host.innerHTML=''; host.appendChild(s);
  for(let p=0;p<=100;p+=25){
    const yy = m.t+h-p/100*h;
    el(s,'line',{x1:m.l,x2:m.l+w,y1:yy,y2:yy,stroke:C.trait});
    el(s,'text',{x:m.l-8,y:yy+4,'text-anchor':'end','font-size':11,fill:C.ardoise}, p+' %');
  }
  [1,5,10,19,38].forEach(n=>{
    const x = m.l+(n-1)/37*w;
    el(s,'text',{x,y:m.t+h+17,'text-anchor':'middle','font-size':11,fill:C.ardoise}, n);
  });
  el(s,'text',{x:m.l+w/2,y:H-3,'text-anchor':'middle','font-size':11.5,fill:C.ardoise,'font-weight':600},
     'nombre de communes, classées par ordre décroissant');
  jeux.forEach((j,k)=>{
    const v = vals(j.k,y).map(o=>o.v).sort((a,b)=>b-a);
    const tot = v.reduce((a,b)=>a+b,0); if(!tot) return;
    let acc=0, d='';
    v.forEach((x,i)=>{acc+=x; d += (i?'L':'M') + (m.l+i/37*w) + ',' + (m.t+h-acc/tot*h) + ' '});
    el(s,'path',{d,fill:'none',stroke:j.c,'stroke-width':2.2,'stroke-linejoin':'round'});
    const p3 = v.slice(0,3).reduce((a,b)=>a+b,0)/tot*100;
    el(s,'text',{x:m.l+w+9, y:m.t+18+k*20,'font-size':11.5,fill:j.c,'font-weight':600},
       `${j.n} · ${fmt(p3,0)} %`);
  });
  el(s,'text',{x:m.l+w+9, y:m.t+18+jeux.length*20+6,'font-size':10.5,fill:C.ardoise}, 'part des 3 premières');
}

/* ==========================================================================
   2. DÉMOGRAPHIE
   ========================================================================== */
function pageDemo(){
  const ans = range(2010,2023);
  const pop23 = E('I001',2023), pop10 = E('I001',2010);
  const t = vals('D_TVAM',2023).sort((a,b)=>b.v-a.v);
  document.getElementById('kpi-demo').innerHTML =
    kpi('Population 2023', fmt(pop23,0), tendance(pop10,pop23)+' depuis 2010', {accent:1}) +
    kpi('Croissance annuelle', fmt(E('D_TVAM',2023),2), 'moyenne EPCI 2010–2023', {unit:'%/an'}) +
    kpi('Communes en croissance', t.filter(o=>o.v>0).length+' / 38', 'sur la période 2010–2023') +
    kpi('Écart entre communes', fmt(t[0].v,1)+' à '+fmt(t[t.length-1].v,1),
        `${t[0].n} · ${t[t.length-1].n}`, {unit:'%/an'});

  const base = E('I001',2010);
  lineChart(document.getElementById('c-demo-epci'), [
    {n:'Indice base 100 en 2010', v:ans.map(a=>E('I001',a)/base*100, ), c:C.rouge}
  ], {x:ans, zero:false, legend:false, u:'indice', d:1});

  barRank(document.getElementById('c-demo-tvam'), t,
    {u:'%/an', d:2, rule:E('D_TVAM',2023), ruleLab:'EPCI', rowH:16});

  const gains = COM.map(c=>({c, n:NOM(c), v:(g('I001',c,2023)||0)-(g('I001',c,2010)||0)}))
                   .sort((a,b)=>b.v-a.v);
  barRank(document.getElementById('c-demo-gain'), gains, {u:'hab', d:0, rowH:16});

  smallMultiples(document.getElementById('c-demo-small'), ans);
}

function smallMultiples(host, ans){
  const W=largeur(host), H=300, m={t:12,r:14,b:24,l:40}, w=W-m.l-m.r, h=H-m.t-m.b;
  const s=svg(W,H); host.innerHTML=''; host.appendChild(s);
  const series = COM.map(c=>({c, n:NOM(c), v:ans.map(a=>{
    const b=g('I001',c,2010), x=g('I001',c,a); return (b&&x)?x/b*100:null})}));
  let hi=0, lo=200; series.forEach(se=>se.v.forEach(v=>{if(v!=null){hi=Math.max(hi,v);lo=Math.min(lo,v)}}));
  const A = axes(s, m.l, m.t, w, h, lo, hi, ans.map(String), {});
  const X = i => m.l + i/(ans.length-1)*w;
  const paths = [];
  series.forEach(se=>{
    let d=''; se.v.forEach((v,i)=>{if(v!=null) d += (d?'L':'M')+X(i)+','+A.Y(v)+' '});
    const p = el(s,'path',{d, fill:'none', stroke:C.ardoise, 'stroke-width':1.1, opacity:.45});
    p.style.cursor='crosshair';
    p.addEventListener('mousemove', e=>{
      paths.forEach(q=>q.setAttribute('opacity',.12));
      p.setAttribute('opacity',1); p.setAttribute('stroke',C.rouge); p.setAttribute('stroke-width',2.4);
      tipOn(e, `<b>${se.n}</b><br>2010 : ${fmt(g('I001',se.c,2010),0)} hab<br>2023 : ${fmt(g('I001',se.c,2023),0)} hab<br>indice ${fmt(se.v[se.v.length-1],1)}`);
    });
    p.addEventListener('mouseleave', ()=>{
      paths.forEach(q=>{q.setAttribute('opacity',.45); q.setAttribute('stroke',C.ardoise); q.setAttribute('stroke-width',1.1)});
      tipOff();
    });
    paths.push(p);
  });
  let d=''; ans.forEach((a,i)=>{d += (i?'L':'M')+X(i)+','+A.Y(E('I001',a)/E('I001',2010)*100)+' '});
  el(s,'path',{d, fill:'none', stroke:C.rouge, 'stroke-width':3});
  el(s,'text',{x:m.l+w-4, y:m.t+13,'text-anchor':'end','font-size':11.5,fill:C.rouge,'font-weight':700},'EPCI');
}

/* ==========================================================================
   3. LOGEMENT
   ========================================================================== */
function pageLogement(){
  const y=2023, anL=[2012,2017,2023];
  document.getElementById('kpi-log').innerHTML =
    kpi('Logements', fmt(E('I039',y),0), tendance(E('I039',2012),E('I039',y))+' depuis 2012') +
    kpi('Résidences secondaires', fmt(E('D_TXRS',y),1), fmt(E('I041',y),0)+' logements', {unit:'%', accent:1}) +
    kpi('Logements vacants', fmt(E('D_TXVAC',y),1), fmt(E('I042',y),0)+' logements', {unit:'%'}) +
    kpi('Communes à majorité secondaire', vals('D_TXRS',y).filter(o=>o.v>50).length+' / 38', 'plus de 50 % du parc', {accent:1});

  stackChart(document.getElementById('c-log-stack'), anL, [
    {n:'Résidences principales', v:anL.map(a=>E('I040',a)), c:C.rouge},
    {n:'Résidences secondaires', v:anL.map(a=>E('I041',a)), c:C.vertF},
    {n:'Vacants', v:anL.map(a=>E('I042',a)), c:C.or}
  ], {u:'logements'});

  stackChart(document.getElementById('c-log-type'), anL, [
    {n:'Maisons', v:anL.map(a=>E('I375',a)), c:C.maree},
    {n:'Appartements', v:anL.map(a=>E('I376',a)), c:C.prune},
    {n:'Autres', v:anL.map(a=>E('I377',a)), c:C.ardoise}
  ], {u:'logements'});

  barRank(document.getElementById('c-log-rs'),
    vals('D_TXRS',y).sort((a,b)=>b.v-a.v).map(o=>({...o, hi:o.v>50})),
    {u:'%', d:1, rule:50, ruleLab:'50 %', c:C.vertF});

  barRank(document.getElementById('c-log-vac'),
    vals('D_TXVAC',y).sort((a,b)=>b.v-a.v), {u:'%', d:1, rule:E('D_TXVAC',y), ruleLab:'EPCI', c:C.or, rowH:16});

  scatter(document.getElementById('c-log-scat'),
    COM.map(c=>({n:NOM(c), x:g('D_TXRS',c,y), y:g('D_TXVAC',c,y), r:g('I039',c,y)}))
       .filter(p=>p.x!=null&&p.y!=null),
    {xl:'Résidences secondaires (%)', yl:'Vacance (%)', rl:'Logements', h:300});
}

/* ==========================================================================
   4. CONSTRUCTION
   ========================================================================== */
function pageConstruction(){
  const ans = range(2013,2025);
  const der = 2024;
  document.getElementById('kpi-constr').innerHTML =
    kpi('Logements autorisés', fmt(E('I053',der),0), 'en '+der+' · '+tendance(E('I053',2013),E('I053',der))+' vs 2013', {accent:1}) +
    kpi('Logements commencés', fmt(E('I054',der),0), 'en '+der) +
    kpi('Rapport commencés / autorisés', fmt(E('D_REAL',der),0), 'flux de '+der+' · autorisations et chantiers de cohortes différentes', {unit:'%', accent:1}) +
    kpi('Cumul 2013–2024', fmt(som(...range(2013,2024).map(y=>E('I053',y))),0),
        'logements autorisés sur 12 ans');

  lineChart(document.getElementById('c-cst-serie'), [
    {n:'Autorisés', v:ans.map(a=>E('I053',a)), c:C.rouge},
    {n:'Commencés', v:ans.map(a=>E('I054',a)), c:C.maree},
    {n:'Permis déposés', v:ans.map(a=>E('I374',a)), c:C.ardoise, dash:'4 3'}
  ], {x:ans, u:'unités'});

  lineChart(document.getElementById('c-cst-taux'),
    [{n:'Commencés ÷ autorisés', v:ans.map(a=>E('D_REAL',a)), c:C.vertF}],
    {x:ans, legend:false, u:'%', d:0, rule:100, ruleLab:'équilibre'});

  stackChart(document.getElementById('c-cst-mix'), ans, [
    {n:'Individuel', v:ans.map(a=>E('I055::part_individuel',a)), c:C.vertF},
    {n:'Collectif', v:ans.map(a=>E('I055::part_collectif_hors_residence',a)), c:C.maree},
    {n:'Résidence', v:ans.map(a=>E('I055::part_residence',a)), c:C.prune}
  ], {pct:true, u:'%'});

  lineChart(document.getElementById('c-cst-surf'), [
    {n:'Autorisés', v:ans.map(a=>E('I056::autorises',a)), c:C.rouge},
    {n:'Commencés', v:ans.map(a=>E('I056::commences',a)), c:C.maree}
  ], {x:ans, zero:false, u:'m²', d:0});

  const moy = COM.map(c=>{
    let s=0,n=0; range(2019,2025).forEach(y=>{const v=g('D_AUT1K',c,y); if(v!=null){s+=v;n++}});
    return {c, n:NOM(c), v:n?s/n:null};
  }).filter(o=>o.v!=null).sort((a,b)=>b.v-a.v);
  barRank(document.getElementById('c-cst-com'), moy, {u:'log./1000 hab', d:1, c:C.rouge});
}

/* ==========================================================================
   5. EMPLOI
   ========================================================================== */
function pageEmploi(){
  const y=2023, anL=[2012,2017,2023];
  document.getElementById('kpi-emp').innerHTML =
    kpi("Emplois au lieu de travail", fmt(E('I095',y),0),
        tendance(E('I095',2012),E('I095',y))+' depuis 2012', {accent:1}) +
    kpi('Actifs occupés résidants', fmt(E('I380',y),0), 'habitants qui travaillent') +
    kpi("Concentration d'emploi", fmt(E('I096',y),0), 'emplois pour 100 actifs résidants', {accent:1}) +
    kpi('Taux de chômage', fmt(E('I097',y),1), 'au sens du recensement, 2023', {unit:'%'});

  lineChart(document.getElementById('c-emp-serie'), [
    {n:"Taux d'activité", v:anL.map(a=>E('I092',a)), c:C.maree},
    {n:"Taux d'emploi", v:anL.map(a=>E('I093',a)), c:C.vertF},
    {n:'Taux de chômage', v:anL.map(a=>E('I097',a)), c:C.rouge}
  ], {x:anL, u:'%', d:1});

  lineChart(document.getElementById('c-emp-eff'), [
    {n:'Emplois locaux', v:anL.map(a=>E('I095',a)), c:C.rouge},
    {n:'Actifs occupés résidants', v:anL.map(a=>E('I380',a)), c:C.maree},
    {n:'Population 15–64 ans', v:anL.map(a=>E('I378',a)), c:C.ardoise, dash:'4 3'}
  ], {x:anL, u:'personnes', d:0});

  barRank(document.getElementById('c-emp-conc'),
    vals('I096',y).sort((a,b)=>b.v-a.v).map(o=>({...o, hi:o.v>100})),
    {u:'indice', d:0, rule:100, ruleLab:'équilibre', c:C.maree});

  barRank(document.getElementById('c-emp-cho'),
    vals('I097',y).sort((a,b)=>b.v-a.v), {u:'%', d:1, rule:E('I097',y), ruleLab:'EPCI', c:C.rouge, rowH:16});
  barRank(document.getElementById('c-emp-tp'),
    vals('I383',y).sort((a,b)=>b.v-a.v), {u:'%', d:1, rule:E('I383',y), ruleLab:'EPCI', c:C.prune, rowH:16});
}

/* ==========================================================================
   6. TOURISME
   ========================================================================== */
function pageTourisme(){
  const y=2023, ans=range(2015,2026);
  document.getElementById('flag-tour').innerHTML =
    `<b>Vérifié dans le classeur :</b> l'indicateur I390 « autres hébergements collectifs — places-lits »
     est déjà le total de I392 (villages vacances), I394 (résidences de tourisme) et I396 (auberges).
     L'identité est exacte sur les 456 couples commune × année testés. Les additionner reviendrait à
     compter deux fois environ 3 800 lits. Le calcul ci-dessous ne retient que le total.`;

  const lm=E('D_LITSM',y), ln=E('D_LITSN',y);
  document.getElementById('kpi-tour').innerHTML =
    kpi("Capacité d'accueil", fmt(som(lm,ln),0), 'estimation de lits, marchands et diffus confondus', {accent:1}) +
    kpi('Lits marchands', fmt(lm,0), fmt(rap(lm,som(lm,ln),100),0)+' % de la capacité théorique') +
    kpi('Emplacements de camping', fmt(E('I387',y),0), fmt(E('I386',y),0)+' campings recensés') +
    kpi("Chambres d'hôtel", fmt(E('I385',y),0), fmt(E('I384',y),0)+' hôtels recensés');

  stackChart(document.getElementById('c-tour-stack'), ans, [
    {n:'Camping (× 3)', v:ans.map(a=>mult(E('I387',a),3)), c:C.vertF},
    {n:'Hôtellerie (× 2)', v:ans.map(a=>mult(E('I385',a),2)), c:C.rouge},
    {n:'Autres hébergements collectifs', v:ans.map(a=>E('I390',a)), c:C.maree}
  ], {u:'lits'});

  lineChart(document.getElementById('c-tour-etab'), [
    {n:'Hôtels', v:ans.map(a=>E('I384',a)), c:C.rouge},
    {n:'Campings', v:ans.map(a=>E('I386',a)), c:C.vertF},
    {n:'Autres hébergements', v:ans.map(a=>E('I388',a)), c:C.maree}
  ], {x:ans, u:'établissements', d:0});

  barRank(document.getElementById('c-tour-com'),
    vals('D_LITS',y).sort((a,b)=>b.v-a.v).map(o=>({...o,
      sub:`dont ${fmt(g('D_LITSM',o.c,y),0)} lits marchands`})),
    {u:'lits', d:0, c:C.vertF});

  barRank(document.getElementById('c-tour-press'),
    vals('D_PRESS',y).sort((a,b)=>b.v-a.v).map(o=>({...o, hi:o.v>5})),
    {u:'lits/hab', d:2, rule:E('D_PRESS',y), ruleLab:'EPCI', c:C.maree, rowH:16});

  const top = vals('D_LITS',y).sort((a,b)=>b.v-a.v).slice(0,10);
  const host = document.getElementById('c-tour-mix');
  const W=largeur(host), rowH=26, H=top.length*rowH+30, m={l:Math.min(150,Math.round(W*0.32)),r:64};
  const s=svg(W,H); host.innerHTML=''; host.appendChild(s);
  top.forEach((o,i)=>{
    const yy=i*rowH+14, lm2=g('D_LITSM',o.c,y)||0, ln2=g('D_LITSN',o.c,y)||0;
    const w=(W-m.l-m.r), tt=lm2+ln2||1;
    el(s,'text',{x:m.l-8,y:yy+13,'text-anchor':'end','font-size':11.5}, o.n);
    let x=m.l;
    [[ln2,C.vertF,'Résidences secondaires'],[lm2,C.maree,'Marchand']].forEach(([v,c,lab])=>{
      const bw=v/tt*w;
      const r=el(s,'rect',{x, y:yy+2, width:Math.max(bw,.5), height:rowH-10, fill:c});
      r.style.cursor='crosshair';
      bindTip(r,`<b>${o.n}</b><br>${lab} : ${fmt(v,0)} lits (${fmt(v/tt*100,0)} %)`);
      x+=bw;
    });
    el(s,'text',{x:x+6,y:yy+13,'font-size':11,fill:C.ardoise}, fmt(lm2/(lm2+ln2)*100,0)+' % march.');
  });
}

/* ==========================================================================
   7. REVENUS
   ========================================================================== */
function pageRevenus(){
  const nMed = vals('I073',2021).length, nPauv = vals('I075',2021).length;
  const an=dernierRevenuEPCI();
  document.getElementById('flag-rev').innerHTML =
    `<b>Deux séries distinctes :</b> les valeurs EPCI ${an??'récentes'} sont publiées directement par l'INSEE.
     <b>Filosofi 2 (à partir de 2023) n'est pas directement comparable à Filosofi 2012–2021.</b>
     Aucun taux d'évolution ne relie ces deux dispositifs.
     <a href="https://www.insee.fr/fr/statistiques/8984752" target="_blank" rel="noopener">Méthode et rupture de série INSEE</a>.<br>
     Les graphiques historiques ci-dessous s'arrêtent en 2021 : ${nMed} communes renseignées pour la médiane,
     ${nPauv} pour la pauvreté. Les moyennes pondérées marquées <b>≈</b> ne sont pas les indicateurs officiels de l'EPCI.
     Les données absentes ou couvertes par le secret statistique ne sont pas remplacées par des années antérieures.`;

  const med = vals('I073',2021).sort((a,b)=>b.v-a.v);
  document.getElementById('kpi-rev').innerHTML =
    kpi('Niveau de vie médian EPCI', fmt(an==null?null:E('I073',an),0),
        an==null?'Valeur INSEE indisponible':`INSEE Filosofi 2 · ${an} · par unité de consommation`, {unit:'€/an', accent:1}) +
    kpi('Taux de pauvreté EPCI', fmt(an==null?null:E('I075',an),1),
        an==null?'Valeur INSEE indisponible':`INSEE Filosofi 2 · ${an} · seuil de 60 %`, {unit:'%'}) +
    kpi('Part des retraites', fmt(E('I078::part_pensions_retraites_rentes',2021),1),
        'historique 2021 · communes documentées ≈', {unit:'%', accent:1}) +
    kpi('Ménages imposés', fmt(E('I079',2021),1), 'historique 2021 · communes documentées ≈', {unit:'%'});

  const ans = range(2012,2021);
  lineChart(document.getElementById('c-rev-serie'), [
    {n:'Moyenne des médianes communales ≈', v:ans.map(a=>E('I073',a)), c:C.rouge},
    {n:'Commune la plus élevée', v:ans.map(a=>{const t=vals('I073',a); return t.length?Math.max(...t.map(o=>o.v)):null}), c:C.maree, dash:'4 3'},
    {n:'Commune la plus basse', v:ans.map(a=>{const t=vals('I073',a); return t.length?Math.min(...t.map(o=>o.v)):null}), c:C.ardoise, dash:'4 3'}
  ], {x:ans, zero:false, u:'€/an', d:0});

  const parts = ['part_revenus_activite','part_pensions_retraites_rentes','part_revenus_patrimoine_autres',
                 'part_prestations_sociales','part_impots'];
  const noms = {part_revenus_activite:"Revenus d'activité", part_pensions_retraites_rentes:'Pensions et retraites',
                part_revenus_patrimoine_autres:'Patrimoine et autres', part_prestations_sociales:'Prestations sociales',
                part_impots:'Impôts (négatif)'};
  barRank(document.getElementById('c-rev-comp'),
    parts.map(p=>({n:noms[p], v:E('I078::'+p,2021)})).filter(o=>o.v!=null).sort((a,b)=>b.v-a.v),
    {u:'%', d:1, l:160, rowH:30, c:C.vertF});

  const ref = E('I073',2021);
  barRank(document.getElementById('c-rev-com'),
    med.map(o=>({n:o.n, v:o.v-ref, sub:`niveau de vie : ${fmt(o.v,0)} €/an`})),
    {u:'€/an', d:0, c:C.prune});
}
