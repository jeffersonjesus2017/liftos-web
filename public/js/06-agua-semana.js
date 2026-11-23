// --------- hidratação ----------
function todayAgua(){
  const k = todayKey();
  return state.agua[k] || [];
}
function totalAguaHoje(){
  return todayAgua().reduce((a,b)=>a+b.ml,0);
}

// rótulo de uma hora decimal (7.5 -> "7:30", 5 -> "5h")
function rotuloHoraAgua(h){
  const hInt = Math.floor(h);
  const min = Math.round((h - hInt) * 60);
  return min > 0 ? `${hInt}:${String(min).padStart(2,'0')}` : `${hInt}h`;
}
// plano padrão: 6 slots entre 5h e 17h30 (acordo 5h, corte após 18h pra proteger o sono), meta dividida igualmente
function planoHidratacaoPadrao(meta){
  const nSlots = 6;
  const porSlot = Math.round(meta / nSlots / 50) * 50; // arredonda pra 50ml
  // horas decimais pra permitir 7.5 = 7h30
  const horas = [5, 7.5, 10, 12.5, 15, 17.5];
  return horas.map(h => ({hora:h, ml:porSlot, label:rotuloHoraAgua(h)}));
}
// valida o plano salvo pelo usuário (state.planoAgua = [{hora, ml}]); devolve a lista limpa e ordenada por hora, ou null
function planoAguaValido(lista){
  if(!Array.isArray(lista) || !lista.length) return null;
  const out = [];
  for(const s of lista){
    const hora = Number(s && s.hora), ml = Math.round(Number(s && s.ml));
    if(!(hora >= 0 && hora < 24) || !(ml >= 50 && ml <= 3000)) return null;
    out.push({hora: Math.round(hora * 60) / 60, ml});
  }
  out.sort((a,b) => a.hora - b.hora);
  return out;
}
// plano em uso: o editado pelo usuário, se houver; senão o padrão calculado a partir da meta
function planoHidratacao(){
  const custom = planoAguaValido(state.planoAgua);
  if(custom) return custom.map(s => ({...s, label:rotuloHoraAgua(s.hora)}));
  return planoHidratacaoPadrao(state.perfil.aguaMeta || 3000);
}
// ao mudar o plano, os registros do dia ligados a um slot seguem o slot de mesma hora; se o horário sumiu, viram avulsos (os ml continuam contando)
function remapearSlotsAgua(registros, planoAntigo, planoNovo){
  return registros.map(r => {
    if(r.slot === undefined) return r;
    const velho = planoAntigo[r.slot];
    const novoIdx = velho ? planoNovo.findIndex(s => Math.abs(s.hora - velho.hora) < 1/120) : -1;
    const {slot, ...resto} = r;
    return novoIdx >= 0 ? {...resto, slot:novoIdx} : resto;
  });
}

function renderAgua(){
  const stats = document.getElementById('agua-stats');
  if(!stats) return;
  const meta = state.perfil.aguaMeta || 3000;
  const atual = totalAguaHoje();
  const pct = Math.min(100, Math.round(atual/meta*100));
  stats.textContent = `${atual} / ${meta} ml · ${pct}%`;
  const progressFill = document.getElementById('agua-progress-fill');
  if(progressFill) progressFill.style.width = pct + '%';

  const plano = planoHidratacao();
  const now = new Date();
  const horaAtual = now.getHours() + now.getMinutes()/60;
  const registros = todayAgua();

  // próximo slot não concluído
  const proxIdx = plano.findIndex((s,i) => !registros.some(r=>r.slot===i) && s.hora > horaAtual - 1);
  const proxEl = document.getElementById('agua-proxima');
  if(atual >= meta){
    proxEl.textContent = '✓ meta atingida';
  } else if(proxIdx === -1){
    if(horaAtual >= 18) proxEl.textContent = `faltam ${meta-atual}ml · evitar após 18h`;
    else proxEl.textContent = `faltam ${meta-atual}ml`;
  } else {
    const prox = plano[proxIdx];
    const falta = Math.max(0, meta - atual);
    proxEl.textContent = `próximo: ${prox.label} · faltam ${falta}ml`;
  }

  const planoEl = document.getElementById('water-plan');
  planoEl.innerHTML = plano.map((s,i)=>{
    // encontra registro desse slot específico
    const reg = registros.find(r=>r.slot===i);
    const feito = !!reg;
    const atrasado = !feito && s.hora < horaAtual - 1.5; // mais de 1h30 atrasado
    const proximo = !feito && i === proxIdx;
    const horaFeita = feito ? new Date(reg.hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    return `
      <div class="water-slot ${feito?'feito':''} ${proximo?'proximo':''} ${atrasado?'atrasado':''}" data-slot="${i}">
        <div class="fill" style="height:${feito?100:0}%"></div>
        <div class="hora">${feito?'✓':s.label}</div>
        <div class="ml">${feito?horaFeita:s.ml+'ml'}</div>
      </div>
    `;
  }).join('');

  planoEl.querySelectorAll('.water-slot').forEach(el=>{
    el.addEventListener('click', ()=>{
      const i = +el.dataset.slot;
      const jaFeito = registros.some(r=>r.slot===i);
      if(jaFeito){
        // desfaz esse slot
        const k = todayKey();
        state.agua[k] = state.agua[k].filter(r=>r.slot!==i);
        saveState();
        renderAgua();
        toast(`Slot ${plano[i].label} desfeito`);
      } else {
        addAguaSlot(i, plano[i].ml);
      }
    });
  });
}

function addAguaSlot(slotIdx, ml){
  const k = todayKey();
  state.agua[k] = state.agua[k] || [];
  state.agua[k].push({ml, hora: new Date().toISOString(), slot: slotIdx});
  saveState();
  renderAgua();
  toast(`+${ml}ml ✓`);
}

function addAgua(ml){
  const k = todayKey();
  state.agua[k] = state.agua[k] || [];
  // avulso, sem slot
  state.agua[k].push({ml, hora: new Date().toISOString()});
  saveState();
  renderAgua();
  toast(`+${ml}ml ✓`);
}

document.querySelectorAll('.agua-btn').forEach(b=>{
  b.addEventListener('click', ()=>addAgua(+b.dataset.ml));
});
(()=>{
  const input = document.getElementById('agua-custom-ml');
  const btn = document.getElementById('btn-agua-custom');
  if(!input || !btn) return;
  const addCustom = ()=>{
    const ml = Number(input.value);
    if(!ml || ml<=0){ toast('Digite uma quantidade válida'); return; }
    addAgua(Math.round(ml));
    input.value = '';
  };
  btn.addEventListener('click', addCustom);
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); addCustom(); }
  });
})();
document.getElementById('btn-agua-undo').addEventListener('click', ()=>{
  const k = todayKey();
  const list = state.agua[k] || [];
  if(!list.length){ toast('Nada pra desfazer'); return; }
  const removido = list.pop();
  saveState();
  renderAgua();
  toast(`−${removido.ml}ml`);
});

// ---- editar plano de hidratação (horários e ml de cada slot) ----
function horaAguaParaInput(h){
  const t = Math.round(h * 60);
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function horaAguaDoInput(v){
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  return m ? (+m[1] + (+m[2])/60) : NaN;
}
function linhaPlanoAguaHtml(s){
  return `<div class="agm-row">
    <input type="time" class="agm-hora" value="${horaAguaParaInput(s.hora)}">
    <input type="number" class="agm-ml" value="${s.ml}" min="50" max="3000" step="50" inputmode="numeric"><span class="agm-un">ml</span>
    <button type="button" class="ghost agm-rm" aria-label="Remover horário">✕</button>
  </div>`;
}
function lerLinhasPlanoAgua(){
  return [...document.querySelectorAll('#agm-lista .agm-row')].map(row => ({
    hora: horaAguaDoInput(row.querySelector('.agm-hora').value),
    ml: Number(row.querySelector('.agm-ml').value)
  }));
}
function atualizarTotalPlanoAgua(){
  const tot = lerLinhasPlanoAgua().reduce((a,s) => a + (s.ml > 0 ? s.ml : 0), 0);
  document.getElementById('agm-total').textContent = `Total do dia: ${tot} ml`;
}
function abrirEditorPlanoAgua(){
  document.getElementById('agm-lista').innerHTML = planoHidratacao().map(linhaPlanoAguaHtml).join('');
  atualizarTotalPlanoAgua();
  document.getElementById('agua-modal-backdrop').classList.add('show');
}
function fecharEditorPlanoAgua(){
  document.getElementById('agua-modal-backdrop').classList.remove('show');
}
function salvarPlanoAgua(){
  const novo = planoAguaValido(lerLinhasPlanoAgua());
  if(!novo){ toast('Confira os horários e as quantidades (50 a 3000 ml cada)'); return; }
  const antigo = planoHidratacao();
  const k = todayKey();
  if(state.agua[k]) state.agua[k] = remapearSlotsAgua(state.agua[k], antigo, novo);
  state.planoAgua = novo;
  state.perfil.aguaMeta = novo.reduce((a,s) => a + s.ml, 0); // a meta do dia passa a ser a soma do plano
  saveState();
  fecharEditorPlanoAgua();
  renderAgua();
  toast(`Plano salvo · meta ${state.perfil.aguaMeta} ml`);
}
(()=>{
  const lista = document.getElementById('agm-lista');
  if(!lista) return;
  lista.addEventListener('input', atualizarTotalPlanoAgua);
  lista.addEventListener('click', e => {
    const b = e.target.closest('.agm-rm');
    if(!b) return;
    b.closest('.agm-row').remove();
    atualizarTotalPlanoAgua();
  });
  document.getElementById('btn-agua-edit').addEventListener('click', abrirEditorPlanoAgua);
  document.getElementById('agm-add').addEventListener('click', () => {
    const atuais = lerLinhasPlanoAgua();
    const ult = atuais.length ? atuais[atuais.length - 1] : {hora:12, ml:500};
    const h = Number.isFinite(ult.hora) ? Math.min(23.5, ult.hora + 1) : 12;
    lista.insertAdjacentHTML('beforeend', linhaPlanoAguaHtml({hora:h, ml: ult.ml > 0 ? ult.ml : 500}));
    atualizarTotalPlanoAgua();
  });
  document.getElementById('agm-reset').addEventListener('click', () => {
    // volta ao padrão para a meta atual (só vale ao confirmar)
    lista.innerHTML = planoHidratacaoPadrao(state.perfil.aguaMeta || 3000).map(linhaPlanoAguaHtml).join('');
    atualizarTotalPlanoAgua();
  });
  document.getElementById('agm-cancel').addEventListener('click', fecharEditorPlanoAgua);
  document.getElementById('agm-ok').addEventListener('click', salvarPlanoAgua);
  document.getElementById('agua-modal-backdrop').addEventListener('click', e => { if(e.target.id === 'agua-modal-backdrop') fecharEditorPlanoAgua(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && document.getElementById('agua-modal-backdrop').classList.contains('show')) fecharEditorPlanoAgua();
  });
})();

// --------- semana de treino ----------
function inicioSemana(){
  // segunda = início da semana
  const now = new Date();
  const dia = now.getDay(); // 0=dom, 1=seg...
  const offset = dia === 0 ? -6 : 1 - dia; // volta até segunda
  const seg = new Date(now);
  seg.setDate(now.getDate() + offset);
  seg.setHours(0,0,0,0);
  return seg;
}
function diasDaSemana(){
  const seg = inicioSemana();
  const dias = [];
  for(let i=0; i<7; i++){
    const d = new Date(seg);
    d.setDate(seg.getDate()+i);
    dias.push({
      data: localDateStr(d),
      label: ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'][i],
      numero: d.getDate(),
      isHoje: d.toDateString() === new Date().toDateString()
    });
  }
  return dias;
}
function treinosFeitosNaSemana(){
  const seg = inicioSemana();
  const segStr = localDateStr(seg);
  return state.historico.filter(h=>localDateStr(h.data) >= segStr);
}
function metaSemanalTreinos(){
  // baseado na divisão ativa — conta treinos únicos
  const div = state.divisoes[state.divisaoAtiva];
  if(!div) return 5;
  // a meta semanal é o número de treinos da divisão ativa (ex.: 5 treinos = 5x/semana)
  return div.treinos.length;
}

function renderSemanaTreino(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const dias = diasDaSemana();
  const feitos = treinosFeitosNaSemana();
  const diasFeitos = new Set(feitos.map(h=>localDateStr(h.data)));
  const meta = metaSemanalTreinos();
  const nFeitos = diasFeitos.size;
  // streak de dias consecutivos (olhando pra trás a partir de hoje/ontem)
  let streak = 0;
  const hoje = new Date();
  for(let i=0; i<30; i++){
    const d = new Date(hoje);
    d.setDate(hoje.getDate()-i);
    const ds = localDateStr(d);
    const foiTreino = state.historico.some(h=>localDateStr(h.data)===ds);
    if(foiTreino){ streak++; }
    else if(i>0) break; // tolera hoje ainda não ter treinado
  }
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px">
      <div>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:0.04em">${nFeitos}/${meta}</span>
        <span style="font-size:11px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em;font-weight:700;margin-left:4px">treinos essa semana</span>
      </div>
      ${streak > 1 ? `<span class="streak-badge ${streak>=3?'hot':''}">🔥 ${streak} dias</span>` : ''}
    </div>
    <div class="week-grid">
      ${dias.map(d=>{
        const feito = diasFeitos.has(d.data);
        const classe = feito ? 'feito' : '';
        const hojeClass = d.isHoje ? 'hoje' : '';
        return `<div class="week-day ${classe} ${hojeClass}">
          <div class="dia">${d.label}</div>
          <div class="num">${d.numero}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// --------- dashboard semanal ----------
function renderDashboardSemana(){
  const el = document.getElementById('dashboard-semana');
  if(!el) return;
  // KPIs: treinos, aderência dieta, hidratação média, variação peso
  const dias = diasDaSemana();
  const segStr = localDateStr(inicioSemana());

  // 1. Treinos
  const feitos = treinosFeitosNaSemana();
  const diasComTreino = new Set(feitos.map(h=>localDateStr(h.data))).size;
  const metaTreinos = metaSemanalTreinos();
  const pctTreinos = Math.round(diasComTreino/metaTreinos*100);

  // 2. Aderência dieta (quantos dias bateu meta de kcal nessa semana)
  const r = calcPerfil();
  let diasDieta = 0, diasComRegistro = 0;
  dias.forEach(d=>{
    const refs = state.refeicoes[d.data];
    if(refs && refs.length){
      diasComRegistro++;
      const kcal = refs.reduce((s,x)=>s+x.kcal,0);
      if(kcal >= r.meta * 0.85 && kcal <= r.meta * 1.15) diasDieta++;
    }
  });

  // 3. Hidratação média
  const metaAgua = state.perfil.aguaMeta || 3000;
  let somaAgua = 0, diasComAgua = 0;
  dias.forEach(d=>{
    const regs = state.agua[d.data];
    if(regs && regs.length){
      diasComAgua++;
      somaAgua += regs.reduce((s,r)=>s+r.ml,0);
    }
  });
  const mediaAgua = diasComAgua > 0 ? Math.round(somaAgua / diasComAgua) : 0;
  const pctAgua = Math.round(mediaAgua / metaAgua * 100);

  // 4. Variação peso (compara última avaliação com uma de 7 dias atrás, aproximado)
  const avaliacoesOrdenadas = [...state.avaliacoes].sort((a,b)=>a.data.localeCompare(b.data));
  const ultAval = avaliacoesOrdenadas[avaliacoesOrdenadas.length-1];
  const pesoAtual = ultAval && ultAval.peso ? ultAval.peso : state.perfil.peso;
  // encontra avaliação de ~7 dias antes
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate()-7);
  const seteStr = localDateStr(seteDiasAtras);
  const anteriorSemana = avaliacoesOrdenadas.filter(a=>a.peso && a.data < seteStr).pop();
  const variacaoPeso = anteriorSemana ? +(pesoAtual - anteriorSemana.peso).toFixed(1) : null;

  // Sparkline: vetor de valores numéricos → SVG inline
  const sparkline = (vals, binary = false) => {
    if(!vals || vals.length < 2) return '';
    const W = 100, H = 28, pad = 2;
    const max = Math.max(...vals, 1);
    const min = binary ? 0 : Math.min(...vals, 0);
    const range = Math.max(0.1, max - min);
    const xf = i => pad + (i/(vals.length-1))*(W-pad*2);
    const yf = v => H - pad - ((v-min)/range)*(H-pad*2);
    const pathLine = vals.map((v,i)=>`${i===0?'M':'L'} ${xf(i).toFixed(2)} ${yf(v).toFixed(2)}`).join(' ');
    const areaPath = pathLine + ` L ${xf(vals.length-1).toFixed(2)} ${H-pad} L ${xf(0).toFixed(2)} ${H-pad} Z`;
    const lastX = xf(vals.length-1), lastY = yf(vals[vals.length-1]);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path class="area" d="${areaPath}"/>
      <path class="line" d="${pathLine}"/>
      <circle cx="${lastX.toFixed(2)}" cy="${lastY.toFixed(2)}"/>
    </svg>`;
  };

  // Coleta séries para cada KPI (últimos 7 dias)
  // 1. Treinos — série binária: 1 se treinou no dia, 0 se não
  const sparkTreinos = dias.map(d=>{
    return state.historico.some(h=>localDateStr(h.data)===d.data) ? 1 : 0;
  });
  // 2. Dieta — % da meta a cada dia
  const sparkDieta = dias.map(d=>{
    const refs = state.refeicoes[d.data];
    if(!refs || !refs.length) return 0;
    const kcal = refs.reduce((s,x)=>s+x.kcal,0);
    return Math.min(1.5, kcal/r.meta);
  });
  // 3. Hidratação — % da meta a cada dia
  const sparkAgua = dias.map(d=>{
    const regs = state.agua[d.data];
    if(!regs || !regs.length) return 0;
    const ml = regs.reduce((s,r)=>s+r.ml,0);
    return Math.min(1.5, ml/metaAgua);
  });
  // 4. Peso — últimas avaliações com peso (até 7)
  const sparkPeso = avaliacoesOrdenadas
    .filter(a=>a.peso)
    .slice(-7)
    .map(a=>Number(a.peso));

  // classificar status
  const dashTile = (lbl, big, sub, ok, warn, spark = '')=>{
    const cls = ok ? 'ok' : (warn ? 'warn' : '');
    return `<div class="dash-tile ${cls}">
      <div class="lbl">${lbl}</div>
      <div class="big">${big}</div>
      <div class="sub">${sub}</div>
      ${spark}
    </div>`;
  };

  el.innerHTML = `<div class="dash-grid">
    ${dashTile('Treinos', `${diasComTreino}/${metaTreinos}`, `${pctTreinos}% da meta`, pctTreinos>=100, pctTreinos<60, sparkline(sparkTreinos, true))}
    ${dashTile('Dieta no alvo', `${diasDieta}d`, diasComRegistro>0?`de ${diasComRegistro} registrados`:'sem registros', diasDieta>=4, diasDieta===0 && diasComRegistro>0, sparkline(sparkDieta))}
    ${dashTile('Hidratação média', `${(mediaAgua/1000).toFixed(1)}L`, `${pctAgua}% da meta ${(metaAgua/1000)}L`, pctAgua>=90, pctAgua<60, sparkline(sparkAgua))}
    ${dashTile('Peso', variacaoPeso!==null ? `${variacaoPeso>=0?'+':''}${variacaoPeso}kg` : `${pesoAtual}kg`, variacaoPeso!==null?'vs 7 dias':'atual', false, false, sparkline(sparkPeso))}
  </div>`;
}

function atualizarNotifTabbar(){
  const btn = document.querySelector('.tabbar button[data-view="treino"]');
  if(!btn) return;
  if(state.sessaoAtiva){
    btn.classList.add('has-notif');
  } else {
    btn.classList.remove('has-notif');
  }
}

function renderSessaoPendente(){
  atualizarNotifTabbar();
  const wrap = document.getElementById('sessao-pendente-wrap');
  if(!wrap) return;
  const s = state.sessaoAtiva;
  if(!s){ wrap.innerHTML = ''; return; }
  // conta séries preenchidas
  const preenchidas = s.exercicios.reduce((n,ex)=>n+ex.sets.filter(st=>st.carga!=='' || st.reps!=='').length, 0);
  const total = s.exercicios.reduce((n,ex)=>n+ex.sets.length, 0);
  const iniciadaEm = new Date(s.data);
  const hora = iniciadaEm.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  wrap.innerHTML = `
    <div style="background:color-mix(in srgb,var(--accent) 15%,transparent);border:1px solid var(--accent);border-radius:10px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.06em;font-weight:700">⏵ Sessão em andamento</div>
        <div style="font-weight:700;font-size:14px;margin-top:2px">${esc(s.nome)}</div>
        <div style="font-size:11px;color:var(--ink-mute);font-family:'JetBrains Mono',monospace">Iniciada ${hora} · ${preenchidas}/${total} séries</div>
      </div>
      <button class="primary" style="flex-shrink:0;padding:8px 14px;font-size:12px" data-act="goto-view" data-view="treino">Continuar</button>
    </div>
  `;
}

function renderHoje(){
  const r = calcPerfil();
  const t = todayFoodTotals();
  renderBackupBanner();
  renderSessaoPendente();
  renderAgua();
  renderSemanaTreino('semana-treino-hoje');
  renderDashboardSemana();
  const saldo = Math.round(t.kcal - r.meta);
  document.getElementById('saldo-kcal').textContent = (saldo>=0?'+':'') + saldo;
  document.getElementById('meta-kcal-hoje').textContent = r.meta;
  document.getElementById('consumido-kcal').textContent = Math.round(t.kcal);

  const msg = document.getElementById('saldo-msg');
  const obj = Number(state.perfil.objetivo);
  // falta/excesso em relação à META (consistente com a tela Dieta)
  const diff = Math.round(t.kcal - r.meta); // negativo = faltam, positivo = acima
  const faltam = -diff;
  let txt, cls;
  const tol = 100; // tolerância de ±100 kcal
  if(diff >= -tol && diff <= tol){
    // dentro da meta
    if(obj>0) {txt='✓ Meta de bulk atingida'; cls='ok';}
    else if(obj<0) {txt='✓ Meta de cutting atingida'; cls='ok';}
    else {txt='✓ Manutenção no alvo'; cls='ok';}
  } else if(diff < -tol){
    // ainda falta comer
    if(obj>0) txt = `Faltam ${faltam} kcal para a meta de bulk`;
    else if(obj<0) txt = `Faltam ${faltam} kcal para a meta de cutting`;
    else txt = `Faltam ${faltam} kcal para manutenção`;
    cls = 'warn';
  } else {
    // passou da meta
    if(obj>0) txt = `+${diff} kcal acima da meta de bulk`;
    else if(obj<0) txt = `+${diff} kcal acima da meta de cutting`;
    else txt = `+${diff} kcal acima da manutenção`;
    cls = 'warn';
  }
  msg.innerHTML = `<span class="pill ${cls}">${txt}</span>`;

  // macros
  const set = (gId, mId, fillId, val, max)=>{
    document.getElementById(gId).textContent = Math.round(val);
    document.getElementById(mId).textContent = max;
    document.getElementById(fillId).style.width = Math.min(100,(val/max)*100)+'%';
  };
  set('p-g','p-m','p-fill',t.p,r.protG);
  set('c-g','c-m','c-fill',t.c,r.carbG);
  set('g-g','g-m','g-fill',t.g,r.gordG);

  // treino de hoje — mostra só o treino do dia; sem opção de adiantar o próximo
  // (próximo treino + adiantar fica só na aba Treino)
  const div = state.divisoes[state.divisaoAtiva];
  const el = document.getElementById('treino-hoje');
  if(!div){ el.innerHTML = '<div class="empty">Nenhuma divisão ativa</div>'; return; }
  const info = proximoTreinoInfo();
  if(!info || !info.treino){ el.innerHTML = '<div class="empty">Sem treinos configurados</div>'; return; }
  if(info.jaConcluiuHoje){
    el.innerHTML = `
      <div style="font-size:11px;color:var(--ok);text-transform:uppercase;letter-spacing:0.06em;font-weight:700;margin-bottom:4px">✓ ${info.ultimoFeitoNome} concluído hoje</div>
      <div style="font-size:12px;color:var(--ink-mute)">Treino de hoje já concluído. Bom descanso!</div>
    `;
  } else {
    el.innerHTML = `
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);font-weight:700;margin-bottom:4px">Treino de hoje</div>
      <div style="font-weight:600;font-size:16px;margin-bottom:4px">${esc(info.treino.nome)}</div>
      <div style="font-size:12px;color:var(--ink-mute);margin-bottom:10px">${info.treino.exercicios.length} exercícios · ${info.treino.exercicios.reduce((s,e)=>s+e.series,0)} séries totais</div>
      <button class="primary" data-act="iniciar-sessao-direta" data-tid="${esc(info.treino.id)}">Começar agora</button>
    `;
  }
}

// Retorna {treino, jaConcluiuHoje, ultimoFeitoNome}
function proximoTreinoInfo(){
  const div = state.divisoes[state.divisaoAtiva];
  if(!div || !div.treinos.length) return null;
  const hoje = todayKey();
  // último treino registrado dessa divisão
  const ultimos = state.historico
    .filter(h=>h.divisao===state.divisaoAtiva)
    .sort((a,b)=>b.data.localeCompare(a.data));
  if(!ultimos.length){
    return {treino: div.treinos[0], jaConcluiuHoje:false, ultimoFeitoNome:null};
  }
  const ultimo = ultimos[0];
  const ultimoDia = localDateStr(ultimo.data); // YYYY-MM-DD local
  const idx = div.treinos.findIndex(t=>t.id===ultimo.treinoId);
  if(ultimoDia === hoje){
    // treinou hoje — mostra o PRÓXIMO pra amanhã
    return {treino: div.treinos[(idx+1) % div.treinos.length], jaConcluiuHoje:true, ultimoFeitoNome: ultimo.nome};
  } else {
    // último foi antes de hoje — mostra o próximo pendente (não concluído ainda)
    return {treino: div.treinos[(idx+1) % div.treinos.length], jaConcluiuHoje:false, ultimoFeitoNome:null};
  }
}

// Mantém função legacy pra compatibilidade (usada em outros lugares)
function proximoTreino(){
  const info = proximoTreinoInfo();
  return info ? info.treino : null;
}

