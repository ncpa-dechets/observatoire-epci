/* ==========================================================================
   11. DONNÉES & MÉTHODE
   ========================================================================== */
function pageDonnees(){
  /* couverture */
  const keys = Object.keys(DATA.series);
  const ans = range(AN_MIN, AN_MAX);
  const host=document.getElementById('c-heat');
  const W=largeur(host), m={l:Math.min(230,Math.round(W*0.3)), t:22};
  const cw=Math.max(14,(W-m.l-10)/ans.length), ch=13;
  const H=m.t+keys.length*ch+10;
  const s=svg(W,H); host.innerHTML=''; host.appendChild(s);
  ans.forEach((a,i)=>{ if(i%2) return;
    el(s,'text',{x:m.l+i*cw+cw/2, y:14,'text-anchor':'middle','font-size':10,fill:C.ardoise}, String(a).slice(2))});
  keys.forEach((k,r)=>{
    el(s,'text',{x:m.l-6, y:m.t+r*ch+10,'text-anchor':'end','font-size':9.5,fill:C.encre},
       libDe(k).slice(0,42));
    ans.forEach((a,i)=>{
      const n=Object.values(DATA.series[k]).filter(d=>d[a]!=null).length;
      const c = n===0?'#EDEAE3' : (n>=38?'#7C8560' : (n>=19?'#A3B197':'#C6D2C4'));
      const rr=el(s,'rect',{x:m.l+i*cw, y:m.t+r*ch, width:cw-1.5, height:ch-1.5, fill:c, class:'hm-cell'});
      if(n){rr.style.cursor='crosshair'; bindTip(rr, `<b>${libDe(k)}</b><br>${a} · ${n} commune${n>1?'s':''} renseignée${n>1?'s':''}`)}
    });
  });

  /* règles d'agrégation */
  const mode = k=>{
    const r=AGG[k];
    if(!r) return ['Moyenne pondérée par la population','#8A6100'];
    if(r.m==='somme') return ['Somme des communes','#3F6B4E'];
    if(r.m==='ratio') return [`Recalculé : ${r.num} ÷ ${r.den}`, '#2A6F7F'];
    if(r.m==='calc') return ['Recalculé : (I091 − I379) ÷ I378', '#2A6F7F'];
    return [`Moyenne pondérée par ${r.p}${r.approx?' — approximation':''}`, r.approx?'#8A6100':'#5F6B6D'];
  };
  const grp={};
  Object.keys(DATA.indicateurs).forEach(k=>{const [t,c]=mode(k); (grp[t]=grp[t]||{c, l:[]}).l.push(k)});
  document.getElementById('tbl-agreg').innerHTML =
    '<table style="font-size:13px">'+Object.entries(grp).map(([t,o])=>
      `<tr><td class="txt" style="width:44%;color:${o.c};font-weight:600">${t}</td>
       <td class="txt" style="white-space:normal;color:var(--ardoise)">${o.l.length} indicateur${o.l.length>1?'s':''} — ${o.l.slice(0,7).join(', ')}${o.l.length>7?'…':''}</td></tr>`).join('')+'</table>'+
    '<p class="note">Un taux n\'est jamais la moyenne arithmétique des taux communaux. Chaque fois que le numérateur et le dénominateur existent dans le classeur, le taux EPCI est reconstitué à partir des effectifs. Les cases marquées <b>≈</b> ailleurs dans le tableau de bord signalent une approximation assumée.</p>';

  document.getElementById('tbl-derives').innerHTML =
    '<table style="font-size:13px">'+Object.entries(DERIVES).map(([k,d])=>
      `<tr><td class="txt" style="font-weight:600;width:52%">${d.l}</td>
       <td class="txt" style="color:var(--ardoise);white-space:normal">${FORMULES[k]||''}</td></tr>`).join('')+'</table>'+
    '<p class="note">Ces indicateurs ne sont pas stockés dans le classeur : ils sont recalculés à chaque affichage à partir des valeurs sources. Aucune écriture n\'est faite dans votre fichier.</p>';

  document.getElementById('vigilance').innerHTML = VIGILANCE.map(v=>
    `<div style="display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--trait)">
      <div style="flex:0 0 26px;height:26px;border-radius:50%;background:${v.g?'#EAF0E7':'#FDF0F0'};
        color:${v.g?'#3F6B4E':C.rouge};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${v.g?'✓':'!'}</div>
      <div><b>${v.t}</b><br><span style="color:var(--ardoise);font-size:13.5px">${v.d}</span></div></div>`).join('');

  document.getElementById('tbl-sources').innerHTML =
    '<table style="font-size:13px"><thead><tr><th class="txt">Code</th><th class="txt">Source</th><th class="txt">Producteur</th><th>Valeurs</th></tr></thead><tbody>'+
    Object.entries(DATA.sources).map(([c,o])=>{
      const n=Object.keys(DATA.series).filter(k=>(DATA.indicateurs[k.split('::')[0]]||{}).src===c).length;
      return `<tr><td class="txt">${c}</td><td class="txt">${o.s}</td><td class="txt">${o.p}</td><td>${n} séries</td></tr>`;
    }).join('')+'</tbody></table>';
}

const FORMULES = {
  D_TXRS:'I041 ÷ I039 × 100', D_TXVAC:'I042 ÷ I039 × 100',
  D_LITSM:'I385 × 2 + I387 × 3 + I390 — I392, I394 et I396 sont exclus car déjà compris dans I390',
  D_LITSN:'I041 × 5 lits par résidence secondaire',
  D_LITS:'lits marchands + lits non marchands',
  D_PRESS:'capacité totale ÷ population municipale',
  D_POINTE:'population municipale + capacité totale',
  D_TVAM:'(P(n) ÷ P(2010))^(1/(n−2010)) − 1',
  D_REAL:'I054 ÷ I053 × 100', D_AUT1K:'I053 ÷ I001 × 1 000', D_DENSL:'I039 ÷ I001',
  D_SUP:'superficie cadastrale du fond communal IGN, convertie des hectares en km²',
  D_DENSP:'I001 ÷ superficie', D_DENSL2:'I039 ÷ superficie', D_DENSLIT:'capacité totale ÷ superficie'
};
const VIGILANCE = [
  {g:1, t:'Cohérence du parc de logements vérifiée',
   d:'I039 = I040 + I041 + I042 sur les 114 couples commune × année, à 10⁻⁵ près. Aucune correction nécessaire.'},
  {g:1, t:'Cohérence de l\'offre touristique vérifiée',
   d:'I388 et I390 sont bien les totaux de leurs sous-catégories sur les 456 couples testés. Le calcul de capacité ne les additionne pas.'},
  {g:0, t:'Deux échelles cohabitent pour les indicateurs en pourcentage',
   d:'I092, I093, I094, I097, I099 et I383 sont stockés en fraction (0,717 pour 71,7 %) alors que I055, I075, I076, I078 et I079 sont en pourcentage (0 à 100). Même unité déclarée « % », deux conventions. Le tableau de bord normalise à l\'affichage, mais un export brut vers Power BI ou QGIS reproduira l\'incohérence. À trancher dans le référentiel.'},
  {g:0, t:'Cinq indicateurs entièrement vides',
   d:'I397 à I401 (statut d\'occupation des résidences principales) comptent 570 lignes sans aucune valeur. À compléter ou à retirer du classeur : une ligne sans valeur est indiscernable d\'une donnée manquante non identifiée.'},
  {g:0, t:'Rupture de nomenclature Filosofi',
   d:'I078 mélange part_salaires_traitements, part_indemnites_chomage et part_salaires_traitements_et_chomage selon les millésimes. Les séries ne sont pas raccordables telles quelles avant et après ce changement.'},
  {g:0, t:'Deux mesures divergentes des actifs occupés',
   d:'I380 (actifs occupés résidants) et I091 − I379 (population active moins chômeurs) devraient donner le même effectif. L\'écart atteint 273 personnes à l\'échelle de l\'EPCI en 2023, soit 2,2 %, et 48 personnes sur une seule commune. Les deux viennent de tableaux INSEE différents. Le taux d\'emploi EPCI est reconstitué avec I091 − I379, qui reproduit les valeurs communales à 0,012 point près.'},
  {g:0, t:'Colonne fiabilité non discriminante',
   d:'Les 14 403 lignes portent la valeur « Confirmé ». La colonne existe mais ne porte aucune information : elle ne pourra pas servir de filtre tant qu\'elle n\'est pas différenciée.'},
  {g:1, t:'Superficies récupérées dans le fond communal',
   d:'Le GeoJSON IGN porte la propriété superficie_cadastrale, ce qui débloque les densités : 276,4 km² pour l\'EPCI. Attention, il s\'agit de la surface cadastrée, qui exclut l\'estran et certains plans d\'eau : elle diffère légèrement de la surface INSEE. À recopier dans une colonne de l\'onglet Communes pour que le classeur soit autonome.'},
  {g:0, t:'Millésimes non alignés entre thématiques',
   d:'Recensement tous les cinq ans, Sitadel et tourisme annuels, Filosofi arrêté en 2021. Le tableau de bord reporte la dernière valeur connue et signale l\'année réelle au survol. Une comparaison entre deux thématiques à une même date reste à interpréter avec précaution.'},
  {g:0, t:'Ratio de conversion des lits à valider',
   d:'5 lits par résidence secondaire, 2 par chambre d\'hôtel, 3 par emplacement de camping : ce sont les conventions usuelles, pas des mesures locales. Vos données internes — tonnages de déchets, taxe de séjour, consommation d\'eau — permettraient de les caler sur le territoire réel.'}
];
