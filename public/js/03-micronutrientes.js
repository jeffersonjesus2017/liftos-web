// --------- micronutrientes ----------
// Valores por 100 g, na mesma preparação do alimento em FOODS.
// Fibra, ferro, cálcio, magnésio, potássio, zinco, sódio, vit A e vit C: TACO (Unicamp) onde há alimento equivalente.
// Vit D, B12 e folato (a TACO não traz) e alimentos sem equivalente (tilápia, whey, skyr etc.): aproximações USDA/rótulo.
// Ordem: [fibra g, ferro mg, cálcio mg, magnésio mg, potássio mg, zinco mg, sódio mg, vit A µg RAE, vit C mg, vit D µg, B12 µg, folato µg]
const MICRO_DEF = [
  {k:'fib', n:'Fibra',     u:'g'},
  {k:'fe',  n:'Ferro',     u:'mg'},
  {k:'ca',  n:'Cálcio',    u:'mg'},
  {k:'mg',  n:'Magnésio',  u:'mg'},
  {k:'k',   n:'Potássio',  u:'mg'},
  {k:'zn',  n:'Zinco',     u:'mg'},
  {k:'na',  n:'Sódio',     u:'mg', max:true},
  {k:'va',  n:'Vitamina A',u:'µg'},
  {k:'vc',  n:'Vitamina C',u:'mg'},
  {k:'vd',  n:'Vitamina D',u:'µg'},
  {k:'b12', n:'Vitamina B12',u:'µg'},
  {k:'fol', n:'Folato',    u:'µg'},
];
const MICROS = {
  arroz_c:[1.6,0.1,4,2,15,0.5,1,0,0,0,0,3],
  arroz_i:[2.7,0.3,5,59,75,0.7,1,0,0,0,0,4],
  feijao_c:[8.5,1.3,27,42,255,0.7,2,0,0,0,0,80],
  feijao_p:[8.4,1.5,29,40,256,0.7,2,0,0,0,0,85],
  frango_pe:[0,0.3,5,18,387,0.8,50,0,0,0.1,0.4,6],
  tilapia:[0,0.6,14,34,380,0.5,52,0,0,3.1,1.9,27],
  salmao:[0,0.4,15,38,518,0.5,96,0,0,11,3.2,29],
  atum_f:[0,1.3,10,40,470,0.9,50,20,0,2,5,3],
  merluza:[0,0.4,36,20,364,0.9,120,0,0,1,1,10],
  frango_cx:[0,1.2,8,14,318,2.6,95,6,0,0.1,0.4,8],
  carne_pa:[0,3,5,27,421,8.1,60,0,0,0.1,2.5,10],
  carne_mu:[0,2.4,5,13,253,6.4,62,2,0,0.1,2.5,8],
  carne_mu_m:[0,2.4,5,13,253,6.4,62,2,0,0.1,2.5,8],
  carne_al:[0,3.2,5,26,385,4.8,52,0,0,0.2,2.5,8],
  carne_co:[0,2.6,4,13,239,4.7,44,2,0,0.1,2.5,8],
  carne_file:[0,2.9,4,28,326,4.1,58,0,0,0.1,2.2,9],
  carne_fr:[0,2,3,14,207,6.5,39,0,0,0.1,2.2,8],
  ovo_in:[0,1.5,49,11,139,1.2,146,150,0,2.1,1.1,44],
  ovo_mex:[0,1.5,49,11,139,1.2,146,150,0,2.1,1.1,44],
  ovo_cl:[0,0.1,6,11,146,0,181,0,0,0,0.1,4],
  polvilho:[0.2,0.5,27,4,38,0,2,0,0,0,0,0],
  batata_i:[1.3,0.2,4,5,161,0.2,2,0,3.8,0,0,9],
  batata_d:[2.2,0.2,17,11,148,0.1,3,500,23.8,0,0,11],
  macarrao:[1.5,0.9,8,18,40,0.5,1,0,0,0,0,60],
  pao_fr:[2.3,1,16,25,142,0.8,648,0,0,0,0,60],
  pao_in:[6.9,3,132,60,163,1.6,506,0,0,0,0,60],
  pao_fat:[2.5,1.5,60,25,110,0.8,500,0,0,0,0,60],
  prot_soja:[17,9,350,270,2000,5,20,0,0,0,0,300],
  farinha_a:[2.4,0.5,10,35,76,0.8,0,0,0,0,0,4],
  granola:[7,3.5,50,90,330,2.5,40,0,0,0,0,40],
  melao:[0.3,0.2,3,6,216,0.1,11,1,8.7,0,0,15],
  abacaxi:[1,0.3,22,18,131,0.1,0,3,34.6,0,0,18],
  morango:[1.7,0.3,11,10,184,0.2,0,1,63.6,0,0,24],
  uva:[0.9,0.1,7,5,162,0,0,3,3.3,0,0,2],
  pera:[3,0.1,8,6,116,0.1,0,1,2.8,0,0,7],
  tapioca:[0.4,0.1,10,1,10,0.1,1,0,0,0,0,0],
  aveia:[9.1,4.4,48,119,336,2.6,5,0,1.4,0,0,56],
  leite_in:[0,0,123,10,133,0.4,64,45,0,0.1,0.4,5],
  leite_de:[0,0,134,10,140,0.4,51,50,0,0.1,0.4,5],
  iogurte:[0,0,143,11,71,0.4,52,30,0.9,0,0.4,8],
  skyr:[0,0.1,120,11,150,0.5,40,5,0,0,0.5,8],
  kefir:[0,0.1,120,12,150,0.5,40,30,1,0.2,0.4,5],
  cottage:[0,0.1,83,8,104,0.4,330,36,0,0.1,0.5,12],
  pasta_am:[8,1.9,49,168,680,2.5,20,0,0,0,0,80],
  mel:[0,0.3,10,6,99,0.2,6,0,0.7,0,0,2],
  queijo_m:[0,0.9,579,7,105,0.3,31,130,0,0.2,0.7,8],
  queijo_mu:[0,0.3,875,24,62,3.5,581,200,0,0.3,1.3,10],
  whey:[0,1,450,70,600,2.5,450,0,0,0,1,0],
  banana:[2,0.4,8,26,358,0.1,0,16,21.6,0,0,20],
  maca:[1.3,0.1,2,2,75,0,0,2,2.4,0,0,3],
  laranja:[0.8,0.1,22,9,163,0.1,0,0,53.7,0,0,30],
  mamao:[1.8,0.2,25,17,222,0.1,3,74,78.5,0,0,37],
  abacate:[6.3,0.2,8,15,206,0.2,0,7,8.7,0,0,70],
  brocolis:[3.4,0.5,51,15,119,0.2,2,70,42,0,0,108],
  alface:[1.8,0.4,38,11,267,0.3,3,117,15.6,0,0,40],
  tomate:[1.2,0.2,7,11,222,0.1,1,27,21.2,0,0,15],
  cenoura:[3.2,0.2,23,11,315,0.2,3,663,5.1,0,0,19],
  chuchu:[1,0.1,8,7,54,0.1,2,0,5.6,0,0,12],
  abobrinha:[1.6,0.2,17,17,126,0.3,1,10,2.1,0,0,24],
  beterraba:[1.9,0.2,15,17,245,0.4,23,2,1.2,0,0,80],
  pepino:[1.1,0.1,10,9,154,0.1,0,2,5,0,0,7],
  azeite:[0,0.4,1,0,1,0,2,0,0,0,0,0],
  oleo_so:[0,0,0,0,0,0,0,0,0,0,0,0],
  manteiga:[0,0.2,9,1,15,0,579,684,0,1.5,0.2,3],
  amendoim:[8,2.5,50,171,580,3.2,0,0,0,0,0,150],
  castanha:[7.9,2.3,146,365,651,4.2,1,0,0,0,0,22],
  arroz_cru:[1.6,0.7,4,30,62,1.2,1,0,0,0,0,8],
  cafe_po:[0,0,3,10,156,0,1,0,0,0,0,0],
  achocolatado:[3.9,5.4,44,77,496,1,65,150,0,0,0,0],
  barra_cereal:[4,2.5,40,50,200,1.2,150,0,0,0,0,30],
  coxinha:[5,1.3,18,17,166,0.5,532,20,0,0.1,0.2,20],
  pastel:[1,2.5,13,14,156,1.2,1040,5,0,0,0.4,20],
  pizza_m:[1.5,1.5,200,20,190,1.5,600,80,1.5,0.2,0.6,30],
  xburger:[1.5,2.5,100,20,220,2.5,500,15,1,0.1,1,40],
  coca:[0,0,1,0,1,0,7,0,0,0,0,0],
  suco_la:[0,0,7,8,149,0,0,1,73.3,0,0,30],
  cerveja:[0,0,5,7,29,0,4,0,0,0,0,6],
  vinho_t:[0,0.5,8,10,100,0.1,4,0,0,0,0,0],
};
// Alimentos cadastrados pelas contas (ids fixos): linhas próprias (TACO onde existe; senão USDA) ou alias de um alimento da base
const MICROS_EXTRA = {
  tc_ricota:[0,0.1,253,12,112,0.5,283,100,0,0.1,0.4,12],
  tc_amendoas:[12.5,3.7,269,270,733,3.1,1,0,0,0,0,44],
  tc_tamara:[6.7,0.9,64,54,696,0.4,1,0,0,0,0,15],
  tc_chia:[34,7.7,631,335,407,4.6,16,0,1.6,0,0,49],
  tc_sardinha:[0,3.5,550,35,367,1.6,666,0,0,4.8,8.9,10],
  tc_atum_ag:[0,1,10,27,237,0.8,247,16,0,1.7,2.2,4],
  tc_berinjela:[2.5,0.2,11,9,105,0.1,1,1,0,0,0,14],
  tc_couve_fl:[2.1,0.1,16,5,80,0.3,2,0,23.7,0,0,44],
  u1793984464904:[0,2.4,5,21,386,5.1,58,0,0,0.1,2.5,9],
};
const MICRO_ALIAS = {u1793781417437:'pao_fat', u1793821828271:'leite_in', u1793821987959:'whey', u1794239859670:'abacaxi'};
// ---- TACO completa (public/taco.json, gerado por scripts/gerar-taco.mjs) ----
// Carregada em segundo plano; ids 'taco_<n>'. A TACO não traz vit. D, B12 e folato: ficam null ("sem dado").
let TACO_FOODS = [];
const TACO_MICROS = {};
function aplicarTaco(dados){
  const foods = [], micros = {};
  (dados && dados.foods || []).forEach(r=>{
    const id = 'taco_' + r[0];
    foods.push({id, n:r[1], kc:r[2], p:r[3], c:r[4], g:r[5], taco:true});
    micros[id] = r[6];
  });
  TACO_FOODS = foods;
  Object.keys(TACO_MICROS).forEach(k=>delete TACO_MICROS[k]);
  Object.assign(TACO_MICROS, micros);
}
async function carregarTaco(){
  try{
    const r = await fetch('/taco.json');
    if(!r.ok) throw new Error('taco.json HTTP ' + r.status);
    aplicarTaco(await r.json());
    rerenderAtual();   // registros com alimentos TACO passam a ter micronutrientes
  }catch(e){ console.error('[taco]', e); reportarErro('error', 'falha ao carregar taco.json: ' + (e && e.message)); }
}
// Alimento próprio com micros digitados do rótulo: food.m = {fib, na, ...} por 100 g (chaves de MICRO_DEF; ausente = sem dado)
function microRowCustom(fid){
  const lista = (typeof state !== 'undefined' && state && state.alimentosCustom) || [];
  const f = lista.find(x=>x.id === fid);
  if(!f || !f.m || typeof f.m !== 'object') return null;
  const row = MICRO_DEF.map(d=>{ const v = f.m[d.k]; return (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v); });
  return row.some(v=>v !== null) ? row : null;
}
function microRow(fid){
  if(!fid) return null;
  return MICROS[fid] || MICROS_EXTRA[fid] || (MICRO_ALIAS[fid] && MICROS[MICRO_ALIAS[fid]]) || TACO_MICROS[fid] || microRowCustom(fid) || null;
}
// Alvos diários (RDA/AI — DRI/IOM) por sexo e idade; sódio é teto (OMS: 2000 mg)
function alvosMicro(sexo, idade, over){
  const f = sexo === 'f';
  const id = Number(idade) || 30;
  const base = {
    fib: f ? (id>50?21:25) : (id>50?30:38),
    fe:  f ? (id>50?8:18) : 8,
    ca:  f ? (id>50?1200:1000) : (id>70?1200:1000),
    mg:  f ? (id>30?320:310) : (id>30?420:400),
    k:   f ? 2600 : 3400,
    zn:  f ? 8 : 11,
    na:  2000,
    va:  f ? 700 : 900,
    vc:  f ? 75 : 90,
    vd:  id>70 ? 20 : 15,
    b12: 2.4,
    fol: 400,
  };
  if(over) Object.keys(over).forEach(k=>{ if(base[k]!==undefined && over[k] && over[k].v>0) base[k] = over[k].v; });
  return base;
}
// modo por nutriente no perfil: 'meta' (padrão), 'max' (limite/teto) ou 'info' (só acompanhar, sem meta nem sugestão)
function modoMicro(m, over){
  const o = over && over[m.k];
  if(o && o.modo) return o.modo;
  return m.max ? 'max' : 'meta';
}
// Soma micros de uma lista de registros; itens sem dados (foto/alimento próprio) contam em `semDados`
function totaisMicro(list){
  const tot = {}; MICRO_DEF.forEach(m=>tot[m.k]=0);
  let semDados = 0;
  (list||[]).forEach(r=>{
    const row = microRow(r.foodId);
    if(!row){ semDados++; return; }
    const fator = (r.grams||0)/100;
    MICRO_DEF.forEach((m,i)=>{ tot[m.k] += (row[i]||0)*fator; });
  });
  return {tot, semDados};
}
// Alimentos que mais ajudam a fechar um nutriente (por %DRI a cada 100 kcal), sem ultraprocessados/bebidas
const MICRO_EXCLUIR = new Set(['azeite','oleo_so','manteiga','cafe_po','achocolatado','barra_cereal','coxinha','pastel','pizza_m','xburger','coca','cerveja','vinho_t','mel','polvilho','tapioca','farinha_a','arroz_cru','whey','prot_soja']);
function sugestoesMicro(key, falta, alvo, n){
  const idx = MICRO_DEF.findIndex(m=>m.k===key);
  return FOODS
    .filter(f=>MICROS[f.id] && !MICRO_EXCLUIR.has(f.id) && f.kc>0 && MICROS[f.id][idx]>0)
    .map(f=>{
      const por100 = MICROS[f.id][idx];
      return {f, dens: (por100/alvo*100)/(f.kc/100), g: Math.round(falta/por100*100)};
    })
    .filter(s=>s.g>0 && s.g<=400 && !(s.f.un && s.g/s.f.un>8))
    .sort((a,b)=>b.dens-a.dens)
    .slice(0, n||3);
}
function renderMicrosDieta(){
  const el = document.getElementById('dieta-micros');
  if(!el) return;
  const over = state.perfil.microAlvos || {};
  const alvos = alvosMicro(state.perfil.sexo, state.perfil.idade, over);
  const list = state.refeicoes[todayKey()]||[];
  const {tot, semDados} = totaisMicro(list);
  // projeção: registrado hoje + opção selecionada das refeições do plano ainda não feitas
  let proj = {...tot}, nPend = 0;
  const foodsAll = allFoods();
  const itensDia = list.map(r=>({foodId:r.foodId, nome:r.nome, grams:r.grams||0, origem:'reg'}));
  try{
    const feitas = countRefHoje();
    const sels = state._selectedOpt || {};
    const pend = [];
    (state.planoAlimentar||[]).forEach(meal=>{
      if(feitas[meal.id]) return;
      const opt = meal.opcoes && meal.opcoes[sels[meal.id] ?? 0];
      if(!opt) return;
      nPend++;
      opt.itens.forEach(it=>{
        pend.push({foodId:it.fid, grams:it.g});
        const fd = foodsAll.find(f=>f.id===it.fid);
        itensDia.push({foodId:it.fid, nome:fd?fd.n:it.fid, grams:it.g, origem:'plano'});
      });
    });
    const pj = totaisMicro(pend).tot;
    MICRO_DEF.forEach(m=>{ proj[m.k] = tot[m.k] + pj[m.k]; });
  }catch(e){ proj = {...tot}; nPend = 0; }
  const linhas = MICRO_DEF.map(m=>{
    const v = tot[m.k], a = alvos[m.k];
    const pct = a ? v/a*100 : 0;
    const pctProj = a ? proj[m.k]/a*100 : 0;
    const modo = modoMicro(m, over);
    let cls, barCor;
    if(modo==='info'){ cls = 'info'; }
    else if(modo==='max'){ cls = pct>100?'crit':pct>75?'warn':'ok'; }
    else { cls = pct>=90?'ok':pct>=50?'warn':'crit'; }
    barCor = cls==='info' ? 'var(--ink-mute)' : `var(--${cls==='crit'?'crit':cls==='warn'?'warn':'ok'})`;
    const fmt = x=> x>=100 ? Math.round(x) : x>=10 ? x.toFixed(0) : x.toFixed(1);
    return {m, modo, v, a, pct, pctProj, vProj: proj[m.k], cls, barCor, fmt};
  });
  const limpa = n=>String(n||'').replace(/\s*\(.*?\)/g,'');
  const qtdTxt = (fid,g)=>{ const fd = foodsAll.find(f=>f.id===fid); return fd && fd.un ? `${Math.max(1,Math.round(g/fd.un))} un` : `${Math.round(g)} g`; };
  const contribuintes = (m, a)=>{
    const idx = MICRO_DEF.findIndex(x=>x.k===m.k);
    const agg = {};
    itensDia.forEach(it=>{
      const row = microRow(it.foodId);
      if(!row) return;
      const val = row[idx]*it.grams/100;
      if(!(val>0)) return;
      const key = it.foodId;
      agg[key] = agg[key] || {nome:it.nome, fid:it.foodId, val:0, g:0, reg:false, plano:false};
      agg[key].val += val; agg[key].g += it.grams;
      if(it.origem==='reg') agg[key].reg = true; else agg[key].plano = true;
    });
    return Object.values(agg).sort((x,y)=>y.val-x.val);
  };
  const faltam = linhas.filter(l=>l.modo==='meta' && l.pctProj<90).sort((a,b)=>a.pctProj-b.pctProj);
  const sug = faltam.map(l=>{
    const s = sugestoesMicro(l.m.k, l.a-l.vProj, l.a, 5);
    if(!s.length) return '';
    const itens = s.map(x=>{
      const qtd = x.f.un ? `${Math.max(1,Math.round(x.g/x.f.un))} un` : `${Math.round(x.g/10)*10||x.g} g`;
      return `${esc(x.f.n.replace(/\s*\(.*?\)/g,''))} (${qtd})`;
    }).join(' · ');
    return `<div style="font-size:12px;margin-top:8px"><strong>${l.m.n}</strong> <span style="color:var(--ink-mute)">(faltam ${l.fmt(Math.max(0,l.a-l.vProj))} ${l.m.u})</span><div style="color:var(--ink-dim);margin-top:2px">${itens}</div></div>`;
  }).join('');
  el.innerHTML = `
    <details style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase">
        Micronutrientes <span style="font-weight:400;color:var(--ink-mute);text-transform:none">· ${linhas.filter(l=>l.modo==='meta'&&l.pct>=90).length}/${linhas.filter(l=>l.modo==='meta').length} no alvo${nPend?` · ${linhas.filter(l=>l.modo==='meta'&&l.pctProj>=90).length} com o plano`:''}</span>
      </summary>
      <div style="margin-top:10px">
        <div style="font-size:11px;color:var(--ink-mute);margin-bottom:10px;line-height:1.55">
          <strong style="color:var(--ink-dim)">%</strong> = quanto você já consumiu hoje da meta diária.
          <span style="white-space:nowrap"><span style="color:var(--ok)">●</span> 90% ou mais</span> &nbsp;<span style="white-space:nowrap"><span style="color:var(--warn)">●</span> 50–89%</span> &nbsp;<span style="white-space:nowrap"><span style="color:var(--crit)">●</span> abaixo de 50%</span>.${nPend?' A parte clara da barra é o que o plano ainda acrescenta.':''} Em "limite" (sódio), menos é melhor.
        </div>
        ${linhas.map(l=>{
          const cs = contribuintes(l.m, l.a);
          const corpo = cs.length ? cs.map(c=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:2px 0;color:var(--ink-dim)"><span>${esc(limpa(c.nome))} <span style="color:var(--ink-mute)">· ${qtdTxt(c.fid,c.g)}${c.plano&&!c.reg?' · plano':''}</span></span><span style="font-family:'JetBrains Mono',monospace;white-space:nowrap">${l.fmt(c.val)} ${l.m.u} · ${Math.round(c.val/l.a*100)}%</span></div>`).join('') : '<div style="font-size:11px;color:var(--ink-mute);padding:2px 0">Nenhum alimento com este nutriente no dia</div>';
          // alimentos do dia sem dado deste nutriente (ex.: TACO não traz vit. D, B12 e folato)
          const idxN = MICRO_DEF.findIndex(x=>x.k===l.m.k), vistosN = new Set(), lac = [];
          itensDia.forEach(it=>{ const rw = microRow(it.foodId); if(rw && rw[idxN]==null && !vistosN.has(it.foodId)){ vistosN.add(it.foodId); lac.push(limpa(it.nome)); } });
          const aviso = lac.length ? `<div style="font-size:11px;color:var(--warn);padding:4px 0 2px">⚠ Sem dado de ${l.m.n} na TACO para: ${esc(lac.slice(0,6).join(', '))}${lac.length>6?` e mais ${lac.length-6}`:''}. O total pode estar subestimado.</div>` : '';
          return `
          <details style="margin-bottom:8px">
            <summary style="cursor:pointer;list-style:none">
            <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px">
              <span>${l.m.n}${lac.length?'*':''}${l.modo==='max'?' <span style="color:var(--ink-mute)">(limite)</span>':l.modo==='info'?' <span style="color:var(--ink-mute)">(só acompanhar)</span>':''}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;color:${l.barCor}">${Math.round(l.pct)}%</span>
            </div>
            <div style="position:relative;height:6px;background:var(--surface);border-radius:3px;overflow:hidden;margin-top:3px">
              ${nPend && l.modo!=='info' ? `<div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100,l.pctProj)}%;background:${l.barCor};opacity:.28"></div>` : ''}
              <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100,l.pct)}%;background:${l.barCor}"></div>
            </div>
            <div style="font-size:11px;color:var(--ink-mute);margin-top:3px">${l.fmt(l.v)} de ${l.fmt(l.a)} ${l.m.u}${nPend && l.modo!=='info' ? ` · com o plano: <span style="color:var(--ink-dim)">${Math.round(l.pctProj)}%</span>` : ''}${l.modo==='max'?' · menos é melhor':''}</div>
            </summary>
            <div style="margin:6px 0 2px 8px;padding-left:8px;border-left:2px solid var(--line)">${corpo}${aviso}</div>
          </details>`;}).join('')}
        ${sug ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-mute);font-weight:700">${nPend?'Mesmo seguindo o plano, ainda falta':'Ainda falta para fechar o alvo'}</div>${sug}</div>` : (list.length ? `<div style="margin-top:10px;font-size:12px;color:var(--ok)">✓ ${nPend?'O plano do dia fecha os alvos principais':'Alvos principais atingidos hoje'}</div>` : '')}
        <div style="margin-top:10px;font-size:10px;color:var(--ink-mute)">Toque em um nutriente para ver de quais alimentos vem. Alvos RDA/AI por sexo e idade do perfil. Fibra, minerais e vit. A/C vêm da TACO; vit. D, B12 e folato são aproximações (USDA).${nPend?' "Com o plano" = projeção se seguir a opção selecionada de cada refeição ainda não registrada.':''}${semDados?` ${semDados} ${semDados===1?'item sem':'itens sem'} dados (foto/alimento próprio) não entram na soma.`:''}</div>
      </div>
    </details>`;
}

