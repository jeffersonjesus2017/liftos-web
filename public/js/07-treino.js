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
      </div>
    `;
  }).join('');

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

