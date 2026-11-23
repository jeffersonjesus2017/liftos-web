// --------- histórico / evolução ----------
let subAtivo = 'treino';
function showSub(s){
  subAtivo = s;
  document.getElementById('sub-treino').hidden = s!=='treino';
  document.getElementById('sub-corpo').hidden = s!=='corpo';
  document.querySelectorAll('.subtabs button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.sub===s));
  if(s==='treino') renderHistTreino();
  if(s==='corpo') renderHistCorpo();
}
document.querySelectorAll('.subtabs button').forEach(b=>{
  b.addEventListener('click', ()=>showSub(b.dataset.sub));
});

function renderHistorico(){
  showSub(subAtivo);
}

function renderHistTreino(){
  const sel = document.getElementById('hist-ex-select');
  // compila lista de exercícios já registrados
  const exMap = {};
  state.historico.forEach(h=>h.exercicios.forEach(e=>{ exMap[e.id] = e.nome; }));
  const ids = Object.keys(exMap);
  if(!ids.length){
    sel.innerHTML = '<option>Nenhum exercício registrado</option>';
    document.getElementById('chart-carga').innerHTML = '';
    document.getElementById('pr-carga').textContent = '—';
    document.getElementById('vol-ult').textContent = '—';
    document.getElementById('n-sessoes').textContent = '—';
  } else {
    sel.innerHTML = ids.map(id=>`<option value="${id}">${exMap[id]}</option>`).join('');
    sel.onchange = ()=>drawChart(sel.value);
    drawChart(sel.value);
  }
  // últimas sessões
  const list = document.getElementById('hist-sessoes');
  if(!state.historico.length){
    list.innerHTML = '<div class="empty">Nenhuma sessão registrada ainda</div>';
  } else {
    // esconde a sessão que está sendo editada (se houver) pra evitar duplicata visual
    const editandoIdx = state.sessaoAtiva && typeof state.sessaoAtiva._editandoIdx === 'number' ? state.sessaoAtiva._editandoIdx : -1;
    list.innerHTML = state.historico.slice(0,10).map((h,i)=>{
      if(i === editandoIdx) return '';
      const vol = h.exercicios.reduce((s,e)=>s + e.sets.reduce((a,st)=>a + (Number(st.carga)||0)*(Number(st.reps)||0),0),0);
      return `
        <div class="food-row" style="align-items:center">
          <div class="nm">
            <div style="font-weight:600">${esc(h.nome)}</div>
            <div style="font-size:11px;color:var(--ink-mute)">${fmtDate(h.data)} · ${h.exercicios.length} exercícios</div>
          </div>
          <div class="kc">${Math.round(vol)} kg</div>
          <button class="rm" data-edit-sessao="${i}" style="color:var(--accent);font-size:13px;padding:0 4px" title="Editar">✎</button>
          <button class="rm" data-del-sessao="${i}" title="Remover">×</button>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-edit-sessao]').forEach(b=>{
      b.addEventListener('click', ()=>editarSessaoHistorico(+b.dataset.editSessao));
    });
    list.querySelectorAll('[data-del-sessao]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const ok = await confirmar('Remover esta sessão do histórico?', {okLabel:'Remover', warn:true});
        if(!ok) return;
        state.historico.splice(+b.dataset.delSessao, 1);
        saveState();
        renderHistTreino();
        toast('Sessão removida');
      });
    });
  }
}

function editarSessaoHistorico(idx){
  const sessao = state.historico[idx];
  if(!sessao) return;
  // se tem sessão ativa pendente, avisa
  if(state.sessaoAtiva){
    toast('Finalize a sessão ativa antes de editar');
    return;
  }
  // transforma sessão do histórico em sessão ativa editável
  // marca com flag _editandoIdx pra saber que é edição
  state.sessaoAtiva = {...sessao, _editandoIdx: idx};
  saveState();
  showView('treino');
  toast('Editando sessão de ' + fmtDate(sessao.data));
}

function drawChart(exId){
  const pontos = state.historico.filter(h=>h.exercicios.some(e=>e.id===exId))
    .map(h=>{
      const e = h.exercicios.find(x=>x.id===exId);
      const max = Math.max(...e.sets.map(s=>Number(s.carga)||0));
      return {data:h.data, carga:max};
    }).reverse(); // mais antigo primeiro

  const svg = document.getElementById('chart-carga');
  if(!pontos.length){ svg.innerHTML=''; return; }

  // procura meta de carga desse exercício na divisão ativa
  let metaCarga = 0;
  Object.values(state.divisoes).forEach(div=>{
    div.treinos.forEach(t=>{
      const ex = t.exercicios.find(e=>e.id===exId);
      if(ex && Number(ex.metaCarga)>0) metaCarga = Number(ex.metaCarga);
    });
  });

  const W=600, H=220, pad=36;
  const maxC = Math.max(...pontos.map(p=>p.carga), metaCarga, 1);
  const minC = Math.min(...pontos.map(p=>p.carga), 0);
  const range = Math.max(1, maxC - minC);
  const yMax = maxC + range*0.1;
  const yMin = Math.max(0, minC - range*0.1);
  const x = i => pad + (i/(Math.max(1,pontos.length-1)))*(W-pad*2);
  const y = v => H - pad - ((v-yMin)/(yMax-yMin))*(H-pad*2);

  const gridLines = [];
  for(let i=0;i<=4;i++){
    const v = yMin + (yMax-yMin)*(i/4);
    const yy = y(v);
    gridLines.push(`<line class="grid" x1="${pad}" y1="${yy}" x2="${W-pad}" y2="${yy}"/>`);
    gridLines.push(`<text x="${pad-6}" y="${yy+3}" text-anchor="end">${v.toFixed(0)}</text>`);
  }
  const path = 'M ' + pontos.map((p,i)=>`${x(i)} ${y(p.carga)}`).join(' L ');
  const dots = pontos.map((p,i)=>`<circle class="dot" cx="${x(i)}" cy="${y(p.carga)}" r="3.5"/>`).join('');
  const xLabels = pontos.map((p,i)=>{
    if(pontos.length>8 && i%2!==0 && i!==pontos.length-1) return '';
    const d = new Date(p.data);
    const lbl = `${d.getDate()}/${d.getMonth()+1}`;
    return `<text x="${x(i)}" y="${H-pad+14}" text-anchor="middle">${lbl}</text>`;
  }).join('');

  // linha de meta (se houver)
  const metaLine = metaCarga > 0 ? `
    <line x1="${pad}" y1="${y(metaCarga)}" x2="${W-pad}" y2="${y(metaCarga)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4,4" opacity="0.7"/>
    <text x="${W-pad-4}" y="${y(metaCarga)-4}" text-anchor="end" fill="var(--accent)" font-size="10" font-weight="700">META ${metaCarga}kg</text>
  ` : '';

  svg.innerHTML = `
    ${gridLines.join('')}
    <line class="axis" x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}"/>
    ${metaLine}
    <path class="line" d="${path}"/>
    ${dots}
    ${xLabels}
  `;

  // stats
  const ult = state.historico.find(h=>h.exercicios.some(e=>e.id===exId));
  const ultEx = ult.exercicios.find(e=>e.id===exId);
  const volUlt = ultEx.sets.reduce((a,s)=>a+(Number(s.carga)||0)*(Number(s.reps)||0),0);
  const prAtual = Math.max(...pontos.map(p=>p.carga));
  document.getElementById('pr-carga').textContent = prAtual;
  document.getElementById('vol-ult').textContent = Math.round(volUlt);
  document.getElementById('n-sessoes').textContent = pontos.length;
}

// --------- avaliação corporal ----------
const METRICAS = {
  peso:{lbl:'Peso',unit:'kg',bom:'up'}, // bom depende do objetivo; neutro
  mm:{lbl:'Massa magra',unit:'kg',bom:'up'},
  mg:{lbl:'Massa gorda',unit:'kg',bom:'down'},
  pctG:{lbl:'% Gordura',unit:'%',bom:'down'},
  // Circunferências
  c_braco:{lbl:'Braço',unit:'cm',bom:'up'},
  c_peito:{lbl:'Peito',unit:'cm',bom:'up'},
  c_cintura:{lbl:'Cintura',unit:'cm',bom:'down'},
  c_quadril:{lbl:'Quadril',unit:'cm',bom:null},
  c_coxa:{lbl:'Coxa',unit:'cm',bom:'up'},
  c_pant:{lbl:'Panturrilha',unit:'cm',bom:'up'},
  // Dobras cutâneas (adipometria)
  d_peitoral:{lbl:'D. Peitoral',unit:'mm',bom:'down'},
  d_triceps:{lbl:'D. Tríceps',unit:'mm',bom:'down'},
  d_abdom:{lbl:'D. Abdominal',unit:'mm',bom:'down'},
  d_coxa:{lbl:'D. Coxa',unit:'mm',bom:'down'},
  d_axilar:{lbl:'D. Axilar méd.',unit:'mm',bom:'down'},
  d_subesc:{lbl:'D. Subescapular',unit:'mm',bom:'down'},
  d_supra:{lbl:'D. Supra-ilíaca',unit:'mm',bom:'down'},
  d_soma:{lbl:'Soma 7 dobras',unit:'mm',bom:'down'},
};
// Faixas de referência masculino adulto (orientativas, não substituem avaliação profissional)
function faixaRef(key, perfil){
  if(key==='pctG'){
    // ACE: 14-17% atlético; 18-24% fitness; 25%+ obesidade
    return {min:10, max:24, alertaMin:'baixo', alertaMax:'alto'};
  }
  return null;
}

// --------- fotos de physique ----------
let _editingAvalDate = null; // se não-null, formulário está em modo edição
let _tempFotos = {}; // { frente: dataURL, costas: dataURL, lateral: dataURL }

// (comprimirImagem vive em 11-dieta.js: 1024 px, qualidade 0.75 — única definição, usada também pelas fotos de physique)
function bindPhotoDrops(){
  document.querySelectorAll('.photo-drop').forEach(drop=>{
    const inputId = drop.dataset.for;
    const input = document.getElementById(inputId);
    const pos = input.dataset.pos;
    drop.onclick = ()=>input.click();
    input.onchange = async e=>{
      const file = e.target.files[0];
      if(!file) return;
      try{
        const dataUrl = await comprimirImagem(file);
        _tempFotos[pos] = dataUrl;
        renderPhotoSlot(drop, dataUrl, pos);
      }catch(err){ toast('Erro ao processar foto'); }
    };
  });
}
function renderPhotoSlot(drop, dataUrl, pos){
  if(dataUrl){
    drop.innerHTML = `<img src="${dataUrl}" alt="${pos}"><button class="rm" data-rm-pos="${pos}">×</button>`;
    drop.querySelector('.rm').onclick = e=>{
      e.stopPropagation();
      delete _tempFotos[pos];
      drop.innerHTML = '<span class="hint">+ foto</span>';
    };
  } else {
    drop.innerHTML = '<span class="hint">+ foto</span>';
  }
}
function limparFotos(){
  _tempFotos = {};
  document.querySelectorAll('.photo-drop').forEach(d=>{
    d.innerHTML = '<span class="hint">+ foto</span>';
  });
}

// --------- photo viewer ----------
function abrirFoto(src){
  document.getElementById('pv-img').src = src;
  document.getElementById('photo-viewer').classList.add('show');
}
document.getElementById('pv-close').addEventListener('click', ()=>{
  document.getElementById('photo-viewer').classList.remove('show');
});
document.getElementById('photo-viewer').addEventListener('click', e=>{
  if(e.target.id === 'photo-viewer') e.target.classList.remove('show');
});

// --------- edição de avaliação ----------
function iniciarEdicaoAval(data){
  const a = state.avaliacoes.find(av=>av.data===data);
  if(!a) return;
  _editingAvalDate = data;
  document.getElementById('aval-form-title').textContent = 'Editando avaliação de ' + new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
  document.getElementById('btn-salvar-aval').textContent = 'Atualizar avaliação';
  abrirFormAval();
  // preencher campos
  document.getElementById('av-data').value = a.data;
  const setVal = (id, k)=>{ const el = document.getElementById(id); if(el) el.value = (a[k]!==undefined && a[k]!=='') ? a[k] : ''; };
  setVal('av-peso','peso'); setVal('av-mm','mm'); setVal('av-mg','mg'); setVal('av-pct','pctG');
  setVal('av-c-braco','c_braco'); setVal('av-c-peito','c_peito'); setVal('av-c-cintura','c_cintura');
  setVal('av-c-quadril','c_quadril'); setVal('av-c-coxa','c_coxa'); setVal('av-c-pant','c_pant');
  setVal('av-obs','obs');
  document.getElementById('av-fase').value = a.fase || 'bulk';
  // fotos
  _tempFotos = {...(a.fotos||{})};
  document.querySelectorAll('.photo-drop').forEach(drop=>{
    const pos = document.getElementById(drop.dataset.for).dataset.pos;
    renderPhotoSlot(drop, _tempFotos[pos], pos);
  });
  // scroll até o form
  document.getElementById('aval-form-title').scrollIntoView({behavior:'smooth', block:'start'});
}
// formulário de avaliação fica fechado; abre pelo botão "+ Nova avaliação" ou ao editar uma existente
function abrirFormAval(){
  document.getElementById('aval-form-card').hidden = false;
  document.getElementById('aval-nova-wrap').hidden = true;
}
function fecharFormAval(){
  document.getElementById('aval-form-card').hidden = true;
  document.getElementById('aval-nova-wrap').hidden = false;
}
document.getElementById('btn-nova-aval').addEventListener('click', ()=>{
  abrirFormAval();
  document.getElementById('aval-form-title').scrollIntoView({behavior:'smooth', block:'start'});
});
function sairEdicao(){
  _editingAvalDate = null;
  _tempFotos = {};
  document.getElementById('aval-form-title').textContent = 'Nova avaliação';
  document.getElementById('btn-salvar-aval').textContent = 'Salvar avaliação';
  limparFormAval();
  limparFotos();
  fecharFormAval();
}
document.getElementById('btn-cancelar-edit').addEventListener('click', sairEdicao);

// --------- backup / banner ----------
function diasDesdeBackup(){
  if(!state.ultimoBackup) return null;
  const diff = (Date.now() - new Date(state.ultimoBackup).getTime()) / (1000*60*60*24);
  return Math.floor(diff);
}
function renderBackupBanner(){
  const wrap = document.getElementById('backup-banner-wrap');
  if(!wrap) return;
  const dias = diasDesdeBackup();
  // mostra se nunca fez backup OU se faz 7+ dias
  const temDados = state.historico.length > 0 || state.avaliacoes.length > 0;
  if(!temDados){ wrap.innerHTML = ''; return; }
  let msg = '';
  if(dias === null) msg = 'Nunca exportou seus dados. Faça um backup pra não perder histórico se trocar de aparelho.';
  else if(dias >= 7) msg = `Último backup há ${dias} dias. Hora de exportar novamente.`;
  else { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div class="backup-banner">
      <div class="msg">⚠ ${msg}</div>
      <button id="banner-export">Exportar</button>
      <button class="close-x" id="banner-close" aria-label="Dispensar">×</button>
    </div>
  `;
  document.getElementById('banner-export').onclick = ()=>{
    document.getElementById('btn-export').click();
    showView('perfil');
  };
  document.getElementById('banner-close').onclick = ()=>{
    // adia pra amanhã (marca "backup" fantasma de ontem pra não aparecer hoje)
    const ontem = new Date();
    ontem.setDate(ontem.getDate()-6); // volta a reaparecer em 24h
    state.ultimoBackup = ontem.toISOString();
    saveState();
    wrap.innerHTML = '';
  };
}

// --------- V-shape (ombro/cintura) ----------
function calcVShape(aval){
  if(aval.c_peito && aval.c_cintura){
    return +(aval.c_peito / aval.c_cintura).toFixed(3);
  }
  return null;
}
function classificaVShape(v){
  if(v >= 1.618) return {t:'Golden ratio', c:'var(--ok)'};
  if(v >= 1.5) return {t:'Excelente', c:'var(--ok)'};
  if(v >= 1.4) return {t:'Bom', c:'var(--warn)'};
  if(v >= 1.3) return {t:'Médio', c:'var(--warn)'};
  return {t:'Em desenvolvimento', c:'var(--ink-mute)'};
}

// --------- RCQ (relação cintura/quadril) ----------
function calcRCQ(aval){
  if(aval.c_cintura && aval.c_quadril){
    return +(aval.c_cintura / aval.c_quadril).toFixed(3);
  }
  return null;
}
function classificaRCQ(v, sexo){
  if(sexo === 'f'){
    if(v <= 0.75) return {t:'Excelente', c:'var(--ok)'};
    if(v <= 0.80) return {t:'Bom', c:'var(--ok)'};
    if(v <= 0.85) return {t:'Moderado', c:'var(--warn)'};
    return {t:'Risco elevado', c:'var(--crit, #e8371c)'};
  }
  if(v <= 0.85) return {t:'Excelente', c:'var(--ok)'};
  if(v <= 0.90) return {t:'Bom', c:'var(--ok)'};
  if(v <= 0.95) return {t:'Moderado', c:'var(--warn)'};
  return {t:'Risco elevado', c:'var(--crit, #e8371c)'};
}

// Contexto do IMC conforme %G e sexo (IMC não distingue massa magra de gordura)
function imcContexto(imc, pctG, sexo){
  if(imc === null || imc === undefined) return null;
  const f = sexo === 'f';
  const limMagro = f ? 25 : 18;   // abaixo disso, IMC alto = massa magra
  const limMod   = f ? 32 : 25;   // até aqui, %G moderado
  if(pctG === null || pctG === undefined || isNaN(pctG)){
    return imc >= 25 ? {cls:'warn', txt:'IMC não separa massa magra de gordura — registre %G em uma avaliação'} : null;
  }
  if(imc >= 25 && pctG < limMagro) return {cls:'ok', txt:`✓ IMC elevado por massa magra (${pctG}% gordura)`};
  if(imc >= 25 && pctG < limMod)   return {cls:'warn', txt:`IMC e %G moderados (${pctG}%) — acompanhar`};
  if(imc >= 25)                    return {cls:'crit', txt:`IMC e %G elevados (${pctG}%) — atenção`};
  if(imc < 25 && pctG < (f ? 25 : 15)) return {cls:'ok', txt:'✓ Composição corporal saudável'};
  return null;
}

