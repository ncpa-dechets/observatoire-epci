/* ==========================================================================
   8. ATLAS DES COMMUNES
   ========================================================================== */
const SOCLE = ['I001','D_TVAM','D_SUP','D_DENSP','I039','D_TXRS','D_TXVAC','D_LITS','D_PRESS','I053','I096','I097','I073'];
const TOUTES = () => {
  const base = Object.keys(DATA.series).sort((a,b)=>{
    const ta = themeDe(a), tb = themeDe(b);
    return ta===tb ? a.localeCompare(b) : ta.localeCompare(tb);
  });
  return [...Object.keys(DERIVES), ...base];
};
const COURT = {I001:'Population', I039:'Logements', I053:'Log. autorisés', I096:'Concentr. emploi',
  I097:'Chômage', I073:'Niveau de vie méd.', D_TVAM:'Croissance/an', D_TXRS:'% rés. secondaires',
  D_TXVAC:'% vacants', D_LITS:"Lits d'accueil", D_PRESS:'Lits/hab',
  D_SUP:'Superficie', D_DENSP:'Densité hab.', D_DENSL2:'Densité log.', D_DENSLIT:'Densité lits'};
const nomCourt = k => COURT[k] || libDe(k);

let atlasVue='socle', atlasTri={k:'I001', asc:false};

function pageAtlas(){
  const an = +document.getElementById('atlas-annee').value;
  document.getElementById('atlas-annee-v').textContent = an;
  const cols = atlasVue==='socle' ? SOCLE : TOUTES();
  const filtre = document.getElementById('atlas-filtre').value.trim().toLowerCase();

  let lignes = COM.map(c=>{
    const o = {c, n:NOM(c), v:{}, meta:{}};
    cols.forEach(k=>{const i=gInfo(k,c,an); o.v[k]=i?i.v:null; o.meta[k]=i});
    return o;
  });
  if(filtre) lignes = lignes.filter(l=>l.n.toLowerCase().includes(filtre));
  lignes.sort((a,b)=>{
    if(atlasTri.k==='n') return atlasTri.asc ? a.n.localeCompare(b.n,'fr') : b.n.localeCompare(a.n,'fr');
    const x=a.v[atlasTri.k], y=b.v[atlasTri.k];
    if(x==null) return 1; if(y==null) return -1;
    return atlasTri.asc ? x-y : y-x;
  });

  const maxi={}; cols.forEach(k=>maxi[k]=Math.max(...lignes.map(l=>l.v[k]||0), 1e-9));
  const epci={}; cols.forEach(k=>epci[k]=E(k,an));

  const th = document.querySelector('#atlas thead');
  th.innerHTML = '<tr><th class="txt' + (atlasTri.k==='n'?' sorted'+(atlasTri.asc?' asc':''):'') +
    '" data-k="n">Commune</th>' + cols.map(k=>
    `<th data-k="${k}" class="${atlasTri.k===k?'sorted'+(atlasTri.asc?' asc':''):''}"
      title="${libDe(k)}${uniteDe(k)?' ('+uniteDe(k)+')':''}">${nomCourt(k)}</th>`).join('') +
    '</tr><tr style="background:var(--sable)"><th class="txt" style="top:29px">Ensemble EPCI</th>' +
    cols.map(k=>`<th style="top:29px;color:var(--rouge)">${epci[k]==null?'—':fmt(epci[k])}${estApprox(k)?' ≈':''}</th>`).join('') + '</tr>';
  th.querySelectorAll('th[data-k]').forEach(h=>h.onclick=()=>{
    const k=h.dataset.k;
    atlasTri = {k, asc: atlasTri.k===k ? !atlasTri.asc : (k==='n')};
    pageAtlas();
  });

  document.querySelector('#atlas tbody').innerHTML = lignes.map(l=>
    '<tr><td class="txt">'+l.n+'</td>' + cols.map(k=>{
      const v=l.v[k], mt=l.meta[k];
      if(v==null) return '<td class="muted">—</td>';
      const lg = Math.max(0, Math.min(1, v/maxi[k]))*100;
      const ecart = epci[k] ? (v-epci[k])/Math.abs(epci[k])*100 : null;
      return `<td class="bar-cell" title="${libDe(k)} — ${fmtU(v,uniteDe(k))}${mt&&mt.report?' (millésime '+mt.an+', reporté)':''}${ecart!=null?'\nÉcart EPCI : '+(ecart>0?'+':'')+fmt(ecart,0)+' %':''}">
        <i style="width:${lg}%"></i><span>${fmt(v)}${mt&&mt.report?'<sup style="color:#B0B7B6">·</sup>':''}</span></td>`;
    }).join('') + '</tr>').join('');
}

function exportCSV(){
  const an = +document.getElementById('atlas-annee').value;
  const cols = atlasVue==='socle' ? SOCLE : TOUTES();
  const sep=';';
  let out = ['code_insee','commune',...cols.map(k=>libDe(k)+(uniteDe(k)?' ('+uniteDe(k)+')':''))].join(sep)+'\n';
  COM.forEach(c=>{
    out += [c, NOM(c), ...cols.map(k=>{const v=g(k,c,an); return v==null?'':String(v).replace('.',',')})].join(sep)+'\n';
  });
  out += ['200065563','ENSEMBLE EPCI', ...cols.map(k=>{const v=E(k,an); return v==null?'':String(v).replace('.',',')})].join(sep)+'\n';
  const b = new Blob(['\ufeff'+out], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `observatoire_NCPA_${atlasVue}_${an}.csv`;
  a.click();
}

/* ==========================================================================
   9. COMPARER DEUX COMMUNES
   ========================================================================== */
function pageDuel(){
  const A=document.getElementById('duel-a').value, B=document.getElementById('duel-b').value;
  const an=+document.getElementById('duel-annee').value;
  document.getElementById('duel-annee-v').textContent = an;

  const kk = ['I001','D_TXRS','D_LITS','I096'];
  document.getElementById('duel-kpi').innerHTML = kk.map(k=>{
    const a=g(k,A,an), b=g(k,B,an);
    return `<div class="card" style="margin:0"><h3>${nomCourt(k)} <span class="sub">${uniteDe(k)}</span></h3>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px">
        <div><div style="font-size:11px;color:var(--ardoise);text-transform:uppercase;letter-spacing:.08em">${NOM(A)}</div>
             <div style="font-size:25px;font-weight:600;color:${C.rouge}">${fmt(a)}</div></div>
        <div style="font-size:12px;color:var(--ardoise);padding-bottom:5px">EPCI ${fmt(E(k,an))}</div>
        <div style="text-align:right"><div style="font-size:11px;color:var(--ardoise);text-transform:uppercase;letter-spacing:.08em">${NOM(B)}</div>
             <div style="font-size:25px;font-weight:600;color:${C.maree}">${fmt(b)}</div></div>
      </div></div>`;
  }).join('');

  /* profil sur l'amplitude EPCI */
  const lst = SOCLE;
  const host=document.getElementById('c-duel-profil');
  const W=largeur(host), rowH=34, H=lst.length*rowH+18, m={l:Math.min(168,Math.round(W*0.3)), r:74};
  const s=svg(W,H); host.innerHTML=''; host.appendChild(s);
  lst.forEach((k,i)=>{
    const y=i*rowH+20, w=W-m.l-m.r;
    const t=vals(k,an); if(!t.length) return;
    const lo=Math.min(...t.map(o=>o.v)), hi=Math.max(...t.map(o=>o.v)), rg=(hi-lo)||1;
    el(s,'text',{x:m.l-10, y:y+4,'text-anchor':'end','font-size':11.5}, nomCourt(k));
    el(s,'line',{x1:m.l, x2:m.l+w, y1:y, y2:y, stroke:C.trait,'stroke-width':6,'stroke-linecap':'round'});
    const ep=E(k,an);
    if(ep!=null) el(s,'line',{x1:m.l+(ep-lo)/rg*w, x2:m.l+(ep-lo)/rg*w, y1:y-9, y2:y+9, stroke:C.ardoise,'stroke-width':1.4,'stroke-dasharray':'3 2'});
    [[A,C.rouge],[B,C.maree]].forEach(([cc,col])=>{
      const v=g(k,cc,an); if(v==null) return;
      const x=m.l+(v-lo)/rg*w;
      const p=el(s,'circle',{cx:x, cy:y, r:6.5, fill:col, stroke:'#fff','stroke-width':2});
      p.style.cursor='crosshair';
      bindTip(p, `<b>${NOM(cc)}</b><br>${libDe(k)}<br>${fmtU(v,uniteDe(k))}`);
    });
    el(s,'text',{x:m.l+w+8, y:y+4,'font-size':10.5,fill:C.ardoise}, fmt(hi));
  });

  const ans=range(2010,2023);
  lineChart(document.getElementById('c-duel-pop'), [
    {n:NOM(A), v:ans.map(a=>g('I001',A,a)), c:C.rouge},
    {n:NOM(B), v:ans.map(a=>g('I001',B,a)), c:C.maree}
  ], {x:ans, zero:false, u:'hab', d:0});
}
