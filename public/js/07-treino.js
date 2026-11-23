// --------- treino ----------
function renderTreino(){
  atualizarNotifTabbar();
  // chips de divisão
  const chips = document.getElementById('divisao-chips');
  chips.innerHTML = Object.keys(state.divisoes).map(k=>
    `<button class="div-chip" aria-pressed="${k===state.divisaoAtiva}" data-div="${k}">${k}</button>`
  ).join('');
  chips.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.divisaoAtiva = b.dataset.div;
      saveState();
      renderTreino();
    });
  });

  // select de treinos
  const div = state.divisoes[state.divisaoAtiva];
  const sel = document.getElementById('treino-select');
  if(!div){ sel.innerHTML = '<option value="">Nenhum treino cadastrado</option>'; return; }
  sel.innerHTML = div.treinos.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
  const info = proximoTreinoInfo();
  if(info && info.treino) sel.value = info.treino.id;
  // label dinâmico (sem aviso de concluído hoje — essa info fica só na aba Hoje)
  const labelEl = document.getElementById('treino-select-label');
  const btnIniciar = document.getElementById('btn-iniciar');
  if(info && info.jaConcluiuHoje){
    labelEl.firstChild.textContent = 'Próximo treino';
    btnIniciar.textContent = 'Adiantar próximo';
  } else {
    labelEl.firstChild.textContent = 'Treino de hoje';
    btnIniciar.textContent = 'Iniciar sessão';
  }

  // sessão ativa
  renderSessaoAtiva();

  // editor
  renderEditorDivisao();
}

document.getElementById('btn-iniciar').addEventListener('click', ()=>{
  const tid = document.getElementById('treino-select').value;
  iniciarSessaoDireta(tid);
});

function iniciarSessaoDireta(treinoId){
  const div = state.divisoes[state.divisaoAtiva];
  const t = div.treinos.find(x=>x.id===treinoId);
  if(!t) return;
  state.sessaoAtiva = {
    divisao: state.divisaoAtiva,
    treinoId: t.id,
    nome: t.nome,
    data: new Date().toISOString(),
    exercicios: t.exercicios.map(e=>({
      id:e.id, nome:e.nome, reps:e.reps, obs:e.obs||'',
      sets: Array.from({length:e.series},()=>({carga:'',reps:''}))
    }))
  };
  saveState();
  showView('treino');
  toast('Sessão iniciada');
}

function renderSessaoAtiva(){
  const card = document.getElementById('sessao-ativa-card');
  const s = state.sessaoAtiva;
  if(!s){ card.hidden = true; return; }
  card.hidden = false;
  const ehEdicao = typeof s._editandoIdx === 'number';
  const prefixo = ehEdicao ? `✎ Editando ${fmtDate(s.data)} — ` : '';
  document.getElementById('sessao-nome').textContent = prefixo + s.nome;
  // data editável (default = data da sessão, geralmente hoje)
  const dataInp = document.getElementById('sessao-data');
  if(dataInp) dataInp.value = localDateStr(s.data);
  const container = document.getElementById('sessao-exercicios');
  container.innerHTML = s.exercicios.map((ex,ei)=>{
    const sug = sugerirCarga(ex.id);
    // meta de carga + progresso atual
    const metaCarga = Number(ex.metaCarga) || 0;
    const cargaAtual = Math.max(...ex.sets.map(s=>Number(s.carga)||0), 0);
    let metaHtml = '';
    if(metaCarga > 0){
      const pct = Math.min(100, Math.round(cargaAtual/metaCarga*100));
      const atingido = cargaAtual >= metaCarga;
      metaHtml = `
        <div style="margin-top:4px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-mute)">
          <span>Meta: <strong style="color:var(--accent)">${metaCarga}kg</strong></span>
          ${atingido?'<span style="color:var(--ok);font-weight:700">✓ atingida</span>':`<span>${pct}%</span>`}
        </div>
        <div class="meta-carga-progress"><div class="fill ${atingido?'atingido':''}" style="width:${pct}%"></div></div>
      `;
    }
    return `
      <div class="ex-item">
        <div class="head">
          <span class="name">${esc(ex.nome)}</span>
          <span class="meta">${ex.reps} reps</span>
        </div>
        ${ex.subDe ? `<div class="obs">↻ no lugar de ${esc(ex.subDe)}</div>` : (ex.extra ? '<div class="obs">+ exercício extra</div>' : '')}
        ${ex.obs ? `<div class="obs">${esc(ex.obs)}</div>` : ''}
        ${metaHtml}
        <div class="sets-grid">
          <div class="hdr">#</div><div class="hdr">Carga (kg)</div><div class="hdr">Reps</div><div></div>
          ${ex.sets.map((s,si)=>`
            <div class="idx">${si+1}</div>
            <input type="number" step="0.5" value="${s.carga}" data-ei="${ei}" data-si="${si}" data-f="carga" placeholder="${sug.carga||'—'}">
            <input type="number" value="${s.reps}" data-ei="${ei}" data-si="${si}" data-f="reps" placeholder="${sug.reps||'—'}">
            <button class="rm" data-del="${ei}-${si}" title="Remover série">×</button>
          `).join('')}
        </div>
        ${sug.carga ? `<div class="suggestion">Sugestão: ${sug.carga}kg × ${sug.reps} (última: ${sug.ultima})</div>`:''}
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="ghost" data-add-set="${ei}">+ Adicionar série</button>
          <span style="color:var(--ink-mute);font-size:11px">·</span>
          <button class="btn-rest" data-rest="60">60s</button>
          <button class="btn-rest" data-rest="90">90s</button>
          <button class="btn-rest" data-rest="120">2min</button>
          <button class="btn-rest" data-rest="custom">custom</button>
        </div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="ghost" data-troca="${ei}">↻ Trocar exercício</button>
          <button class="ghost" data-rmex="${ei}">Remover exercício</button>
        </div>
      </div>
    `;
  }).join('') + '<button class="secondary" id="btn-add-ex" style="width:100%;margin-top:4px">+ Adicionar exercício</button>';
  container.querySelectorAll('[data-troca]').forEach(b=> b.addEventListener('click', ()=>trocarExercicio(+b.dataset.troca)));
  container.querySelectorAll('[data-rmex]').forEach(b=> b.addEventListener('click', ()=>removerExercicio(+b.dataset.rmex)));
  document.getElementById('btn-add-ex').addEventListener('click', adicionarExercicio);

  container.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const {ei,si,f} = e.target.dataset;
      state.sessaoAtiva.exercicios[ei].sets[si][f] = e.target.value;
      saveState();
    });
  });
  container.querySelectorAll('[data-add-set]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const ei = +b.dataset.addSet;
      state.sessaoAtiva.exercicios[ei].sets.push({carga:'',reps:''});
      saveState(); renderSessaoAtiva();
    });
  });
  container.querySelectorAll('[data-del]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const [ei,si] = b.dataset.del.split('-').map(Number);
      state.sessaoAtiva.exercicios[ei].sets.splice(si,1);
      saveState(); renderSessaoAtiva();
    });
  });
  // botões de descanso
  container.querySelectorAll('.btn-rest').forEach(b=>{
    b.addEventListener('click', async ()=>{
      // pede permissão de notificação já no clique direto, antes de qualquer await —
      // no iOS, pedir depois de um await (ex: o prompt do "descanso custom") quebra o
      // gesto do usuário e o navegador ignora a solicitação sem avisar nada.
      pedirPermissaoNotificacao();
      const v = b.dataset.rest;
      if(v === 'custom'){
        const txt = await prompt2('Descanso em segundos (máx 600):', '90', {title:'Descanso custom', type:'number'});
        if(txt === false || txt === null || txt === '') return;
        const n = parseInt(txt);
        if(n && n > 0 && n <= 600) iniciarRestTimer(n);
        else toast('Valor inválido');
      } else {
        iniciarRestTimer(parseInt(v));
      }
    });
  });
}

function sugerirCarga(exId){
  // pega últimas 2 sessões com esse exercício
  const sess = state.historico.filter(h => h.exercicios.some(e=>e.id===exId)).sort((a,b)=>b.data.localeCompare(a.data));
  if(!sess.length) return {};
  const ult = sess[0].exercicios.find(e=>e.id===exId);
  const cargaMax = Math.max(...ult.sets.map(s=>Number(s.carga)||0));
  const repsNaMax = ult.sets.find(s=>Number(s.carga)===cargaMax)?.reps || '';
  const repsNum = parseInt(repsNaMax)||0;
  // progressão simples: se completou todas as séries com reps >= alvo médio, sugere +2.5kg
  const todasOk = ult.sets.every(s=>Number(s.reps)>=repsNum);
  const sugCarga = todasOk && cargaMax>0 ? cargaMax + 2.5 : cargaMax;
  return {carga:sugCarga, reps:repsNaMax, ultima:`${cargaMax}kg × ${repsNaMax}`};
}

// --------- trocar / adicionar / remover exercício na sessão em andamento ----------
const _normEx = n => String(n||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
// exercícios já conhecidos (treinos configurados, histórico e sessão atual), sem repetir nome — alimenta a lista de sugestões
function catalogoExercicios(){
  const mapa = new Map();
  const add = e => {
    if(!e || !e.nome) return;
    const k = _normEx(e.nome);
    if(!k || mapa.has(k)) return;
    const series = Number(e.series) || (Array.isArray(e.sets) ? e.sets.length : 0) || 3;
    mapa.set(k, { id: e.id, nome: e.nome, reps: e.reps || '', obs: e.obs || '', series });
  };
  Object.values(state.divisoes || {}).forEach(d => (d.treinos || []).forEach(t => (t.exercicios || []).forEach(add)));
  (state.historico || []).forEach(h => (h.exercicios || []).forEach(add));
  if(state.sessaoAtiva) (state.sessaoAtiva.exercicios || []).forEach(add);
  return mapa;
}
// monta o exercício da sessão: nome já conhecido reaproveita o id (mantém sugestão de carga e histórico); nome novo ganha id próprio
function montarExercicio(r){
  const conhecido = catalogoExercicios().get(_normEx(r.nome));
  const series = Math.min(10, Math.max(1, Math.round(Number(r.series)) || 3));
  return {
    id: conhecido ? conhecido.id : 'x' + Date.now(),
    nome: conhecido ? conhecido.nome : String(r.nome).trim(),
    reps: String(r.reps || '').trim() || (conhecido && conhecido.reps) || '10-12',
    obs: (conhecido && conhecido.obs) || '',
    sets: Array.from({length: series}, () => ({carga:'', reps:''}))
  };
}
const exTemDados = ex => ex.sets.some(st => st.carga !== '' || st.reps !== '');

let _exModalResolve = null;
function fecharModalExercicio(r){
  document.getElementById('ex-modal-backdrop').classList.remove('show');
  if(_exModalResolve){ _exModalResolve(r); _exModalResolve = null; }
}
function abrirModalExercicio({titulo, sub, series, reps}){
  return new Promise(resolve => {
    _exModalResolve = resolve;
    document.getElementById('exm-titulo').textContent = titulo;
    document.getElementById('exm-sub').textContent = sub || '';
    document.getElementById('exm-nome').value = '';
    document.getElementById('exm-series').value = series || 3;
    document.getElementById('exm-reps').value = reps || '10-12';
    const cat = catalogoExercicios();
    document.getElementById('exm-lista').innerHTML = [...cat.values()]
      .sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(e => `<option value="${esc(e.nome)}"></option>`).join('');
    document.getElementById('ex-modal-backdrop').classList.add('show');
    setTimeout(() => document.getElementById('exm-nome').focus(), 50);
  });
}
document.getElementById('exm-nome').addEventListener('input', e => {
  const c = catalogoExercicios().get(_normEx(e.target.value));
  if(c){
    document.getElementById('exm-series').value = c.series;
    if(c.reps) document.getElementById('exm-reps').value = c.reps;
  }
});
document.getElementById('exm-ok').addEventListener('click', () => {
  const nome = document.getElementById('exm-nome').value.trim();
  if(!nome){ toast('Informe o nome do exercício'); return; }
  fecharModalExercicio({
    nome,
    series: document.getElementById('exm-series').value,
    reps: document.getElementById('exm-reps').value
  });
});
document.getElementById('exm-cancel').addEventListener('click', () => fecharModalExercicio(null));
document.getElementById('ex-modal-backdrop').addEventListener('click', e => { if(e.target.id === 'ex-modal-backdrop') fecharModalExercicio(null); });
document.addEventListener('keydown', e => {
  if(!document.getElementById('ex-modal-backdrop').classList.contains('show')) return;
  if(e.key === 'Escape') fecharModalExercicio(null);
  if(e.key === 'Enter') document.getElementById('exm-ok').click();
});

async function trocarExercicio(ei){
  const s = state.sessaoAtiva; if(!s) return;
  const ex = s.exercicios[ei]; if(!ex) return;
  const r = await abrirModalExercicio({ titulo:'Trocar exercício', sub:'No lugar de: ' + ex.nome, series: ex.sets.length, reps: ex.reps });
  if(!r) return;
  if(exTemDados(ex)){
    const ok = await confirmar(`As séries já preenchidas de "${ex.nome}" serão descartadas ao trocar. Continuar?`, { title:'Trocar exercício', okLabel:'Trocar', warn:true });
    if(!ok) return;
  }
  const novo = montarExercicio(r);
  novo.subDe = ex.subDe || ex.nome;   // lembra qual exercício do treino foi substituído
  if(ex.extra) novo.extra = true;
  s.exercicios[ei] = novo;
  saveState(); renderSessaoAtiva(); toast('Exercício trocado ✓');
}
async function adicionarExercicio(){
  const s = state.sessaoAtiva; if(!s) return;
  const r = await abrirModalExercicio({ titulo:'Adicionar exercício', sub:'Entra no fim da sessão', series:3, reps:'10-12' });
  if(!r) return;
  const novo = montarExercicio(r);
  novo.extra = true;
  s.exercicios.push(novo);
  saveState(); renderSessaoAtiva(); toast('Exercício adicionado ✓');
}
async function removerExercicio(ei){
  const s = state.sessaoAtiva; if(!s) return;
  const ex = s.exercicios[ei]; if(!ex) return;
  const msg = exTemDados(ex) ? `Remover "${ex.nome}"? As séries preenchidas serão perdidas.` : `Remover "${ex.nome}" desta sessão?`;
  const ok = await confirmar(msg, { title:'Remover exercício', okLabel:'Remover', warn:true });
  if(!ok) return;
  s.exercicios.splice(ei, 1);
  saveState(); renderSessaoAtiva();
}
// --------- fim: trocar / adicionar / remover exercício ----------

document.getElementById('btn-finalizar').addEventListener('click', ()=>{
  const s = state.sessaoAtiva;
  if(!s) return;
  const ehEdicao = typeof s._editandoIdx === 'number';
  // filtra séries vazias
  // usa data do input (fuso local) se preenchida; mantém hora atual pra ordenação
  const dataInputVal = document.getElementById('sessao-data')?.value;
  let dataFinal = s.data;
  if(dataInputVal){
    // cria timestamp local no YYYY-MM-DD escolhido mas mantém a hora atual pra ordenação
    const agora = new Date();
    const [yy, mm, dd] = dataInputVal.split('-').map(Number);
    const dataLocal = new Date(yy, mm-1, dd, agora.getHours(), agora.getMinutes(), agora.getSeconds());
    dataFinal = dataLocal.toISOString();
  } else if(!ehEdicao){
    dataFinal = new Date().toISOString();
  }
  const limpo = {
    ...s,
    data: dataFinal,
    exercicios: s.exercicios.map(ex=>({
      ...ex,
      sets: ex.sets.filter(st=>st.carga!=='' || st.reps!=='')
    })).filter(ex=>ex.sets.length>0)
  };
  delete limpo._editandoIdx;
  if(!limpo.exercicios.length){
    toast('Preencha ao menos uma série');
    return;
  }
  if(ehEdicao){
    state.historico[s._editandoIdx] = limpo;
    toast('Sessão atualizada ✓');
  } else {
    state.historico.push(limpo);
    toast('Sessão salva ✓');
  }
  // reordena por data (mais recente primeiro)
  state.historico.sort((a,b)=>b.data.localeCompare(a.data));
  state.sessaoAtiva = null;
  saveState();
  renderTreino();
  showView(ehEdicao ? 'hist' : 'hoje');
});

async function cancelarSessao(){
  const s = state.sessaoAtiva;
  if(!s) return;
  const ehEdicao = typeof s._editandoIdx === 'number';
  const msg = ehEdicao
    ? 'Descartar alterações e manter a sessão original do histórico?'
    : s.exercicios.some(ex=>ex.sets.some(st=>st.carga!=='' || st.reps!==''))
      ? 'Cancelar sessão em andamento? As séries preenchidas serão perdidas.'
      : 'Cancelar sessão? Nenhuma série foi preenchida ainda.';
  const ok = await confirmar(msg, {
    title: ehEdicao ? 'Descartar edição' : 'Cancelar sessão',
    okLabel: ehEdicao ? 'Descartar' : 'Sim, cancelar',
    cancelLabel: ehEdicao ? 'Continuar editando' : 'Continuar treino',
    warn: true
  });
  if(!ok) return;
  state.sessaoAtiva = null;
  pararRestTimer(false);
  saveState();
  renderTreino();
  toast(ehEdicao ? 'Edição descartada' : 'Sessão cancelada');
}
document.getElementById('btn-cancelar').addEventListener('click', cancelarSessao);
document.getElementById('btn-cancelar-topo').addEventListener('click', cancelarSessao);

function renderEditorDivisao(){
  const div = state.divisoes[state.divisaoAtiva];
  const el = document.getElementById('editor-divisao');
  if(!div){ el.innerHTML = '<div class="empty">Nenhuma divisão de treino cadastrada ainda</div>'; return; }
  el.innerHTML = div.treinos.map((t,ti)=>`
    <div class="ex-item">
      <div class="head"><span class="name">${esc(t.nome)}</span></div>
      ${t.exercicios.map((e,ei)=>`
        <div style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div style="display:grid;grid-template-columns:1fr 48px 60px;gap:6px;margin-bottom:4px">
            <input type="text" value="${esc(e.nome)}" data-ti="${ti}" data-ei="${ei}" data-f="nome" style="font-size:13px">
            <input type="number" value="${e.series}" data-ti="${ti}" data-ei="${ei}" data-f="series" style="text-align:center">
            <input type="text" value="${e.reps}" data-ti="${ti}" data-ei="${ei}" data-f="reps" style="text-align:center">
          </div>
          <input type="text" value="${esc(e.obs||'')}" data-ti="${ti}" data-ei="${ei}" data-f="obs" placeholder="observação (ex: 2s pico, cluster 4/4/4)" style="font-size:12px;font-style:italic;color:var(--ink-dim);margin-bottom:4px">
          <input type="number" step="0.5" value="${e.metaCarga||''}" data-ti="${ti}" data-ei="${ei}" data-f="metaCarga" placeholder="meta de carga (kg) — opcional" style="font-size:12px;color:var(--accent)">
        </div>
      `).join('')}
      <button class="ghost" data-add-ex="${ti}" style="margin-top:8px">+ exercício</button>
    </div>
  `).join('');
  el.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const {ti,ei,f} = e.target.dataset;
      let val = e.target.value;
      if(f==='series') val = Number(val);
      else if(f==='metaCarga') val = val==='' ? '' : Number(val);
      div.treinos[ti].exercicios[ei][f] = val;
      saveState();
    });
  });
  el.querySelectorAll('[data-add-ex]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const ti = +b.dataset.addEx;
      div.treinos[ti].exercicios.push({id:'x'+Date.now(), nome:'Novo exercício', series:3, reps:'10-12', obs:''});
      saveState(); renderEditorDivisao();
    });
  });
}

