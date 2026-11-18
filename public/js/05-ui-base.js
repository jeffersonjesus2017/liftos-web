// --------- modal de confirmação (substitui confirm/prompt que não funcionam em artifact) ----------
let _modalResolve = null;
function fecharModal(resultado){
  const bd = document.getElementById('modal-backdrop');
  bd.classList.remove('show');
  if(_modalResolve){
    _modalResolve(resultado);
    _modalResolve = null;
  }
}
function confirmar(msg, opts = {}){
  return new Promise(resolve=>{
    _modalResolve = resolve;
    document.getElementById('modal-title').textContent = opts.title || 'Confirmar';
    const msgEl = document.getElementById('modal-msg');
    msgEl.textContent = msg;
    msgEl.className = 'msg' + (opts.warn ? ' warn' : '');
    document.getElementById('modal-ok').textContent = opts.okLabel || 'Confirmar';
    document.getElementById('modal-cancel').textContent = opts.cancelLabel || 'Voltar';
    document.getElementById('modal-input-wrap').hidden = true;
    document.getElementById('modal-backdrop').classList.add('show');
  });
}
function prompt2(msg, defaultVal = '', opts = {}){
  return new Promise(resolve=>{
    _modalResolve = resolve;
    document.getElementById('modal-title').textContent = opts.title || 'Digite';
    const msgEl = document.getElementById('modal-msg');
    msgEl.textContent = msg;
    msgEl.className = 'msg';
    const inp = document.getElementById('modal-input');
    const ta = document.getElementById('modal-textarea');
    const multi = opts.multiline === true;
    inp.hidden = multi;
    ta.hidden = !multi;
    if(multi){
      ta.value = defaultVal;
    } else {
      inp.value = defaultVal;
      inp.type = opts.type || 'text';
    }
    document.getElementById('modal-input-wrap').hidden = false;
    document.getElementById('modal-ok').textContent = 'OK';
    document.getElementById('modal-cancel').textContent = 'Cancelar';
    document.getElementById('modal-backdrop').classList.add('show');
    setTimeout(()=>(multi?ta:inp).focus(), 50);
  });
}
document.getElementById('modal-ok').addEventListener('click', ()=>{
  const inpWrap = document.getElementById('modal-input-wrap');
  if(!inpWrap.hidden){
    const ta = document.getElementById('modal-textarea');
    const inp = document.getElementById('modal-input');
    fecharModal(!ta.hidden ? ta.value : inp.value);
  } else {
    fecharModal(true);
  }
});
document.getElementById('modal-cancel').addEventListener('click', ()=>fecharModal(false));
document.getElementById('modal-backdrop').addEventListener('click', e=>{
  if(e.target.id === 'modal-backdrop') fecharModal(false);
});
document.addEventListener('keydown', e=>{
  if(!document.getElementById('modal-backdrop').classList.contains('show')) return;
  if(e.key === 'Escape') fecharModal(false);
  if(e.key === 'Enter' && !document.getElementById('modal-input-wrap').hidden){
    document.getElementById('modal-ok').click();
  }
});

carregarTaco();

// --------- service worker (necessário pro iOS mostrar notificação local) ----------
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(e=>console.error('[sw]', e));
}

// --------- rest timer ----------
let restState = {
  total: 0,
  remaining: 0,
  intervalId: null,
  startTs: 0,
};
function pedirPermissaoNotificacao(){
  try{
    if(!('Notification' in window)){
      logDebug('pedirPermissaoNotificacao: Notification API não existe nesse navegador');
      return;
    }
    logDebug(`pedirPermissaoNotificacao: permission atual = ${Notification.permission} | standalone=${window.navigator.standalone}`);
    if(Notification.permission === 'default'){
      Notification.requestPermission().then(p=>{
        logDebug(`pedirPermissaoNotificacao: requestPermission resolveu com "${p}"`);
      }).catch(e=>{
        logDebug(`pedirPermissaoNotificacao: requestPermission ERRO ${e && e.message}`);
      });
    }
  }catch(e){
    logDebug(`pedirPermissaoNotificacao: EXCEPTION ${e && e.message}`);
  }
}
async function notificarDescansoCompleto(){
  try{
    if(!('Notification' in window) || Notification.permission !== 'granted'){
      logDebug(`notificarDescansoCompleto: abortado (Notification ${('Notification' in window) ? Notification.permission : 'inexistente'})`);
      return;
    }
    if(!('serviceWorker' in navigator)){
      logDebug('notificarDescansoCompleto: abortado (sem serviceWorker)');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Descanso completo 💪', {
      body: 'Hora da próxima série.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 400],
      tag: 'lift-os-rest-timer',
      renotify: true,
    });
    logDebug('notificarDescansoCompleto: notificação disparada');
  }catch(e){
    logDebug(`notificarDescansoCompleto: ERRO ${e && e.message}`);
    console.error('[notificarDescansoCompleto]', e);
  }
}
function iniciarRestTimer(segundos){
  pedirPermissaoNotificacao();
  const timer = document.getElementById('rest-timer');
  const label = document.getElementById('rt-label');
  // reset estado anterior
  if(restState.intervalId){
    clearInterval(restState.intervalId);
    restState.intervalId = null;
  }
  restState.total = segundos;
  restState.remaining = segundos;
  restState.startTs = Date.now();
  timer.classList.add('active');
  timer.classList.remove('done');
  label.textContent = `Descanso ${formatRest(segundos)}`;
  renderRest();
  restState.intervalId = setInterval(tickRest, 250); // 4x/s pra barra suave
}
function tickRest(){
  const elapsed = Math.floor((Date.now() - restState.startTs)/1000);
  restState.remaining = Math.max(0, restState.total - elapsed);
  renderRest();
  if(restState.remaining <= 0){
    pararRestTimer(true);
  }
}
function renderRest(){
  document.getElementById('rt-time').textContent = formatRest(restState.remaining);
  const pct = restState.total > 0 ? (restState.remaining / restState.total * 100) : 0;
  document.getElementById('rt-fill').style.width = pct + '%';
}
function formatRest(seg){
  const m = Math.floor(seg/60);
  const s = seg % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function pararRestTimer(ehDone){
  if(restState.intervalId){
    clearInterval(restState.intervalId);
    restState.intervalId = null;
  }
  const timer = document.getElementById('rest-timer');
  if(ehDone){
    timer.classList.add('done');
    document.getElementById('rt-label').textContent = 'Descanso completo';
    if(document.visibilityState === 'hidden'){
      // app em segundo plano (outro app aberto) — avisa por notificação do sistema
      notificarDescansoCompleto();
    } else {
      // app visível — vibração já é aviso suficiente
      try { if(navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch(e){}
    }
    // esconde automaticamente após 10s se usuário não fechar
    setTimeout(()=>{
      if(timer.classList.contains('done')){
        timer.classList.remove('active','done');
      }
    }, 10000);
  } else {
    timer.classList.remove('active','done');
  }
}
function ajustarRestTimer(delta){
  if(!restState.intervalId) return;
  const novo = Math.max(5, restState.remaining + delta);
  restState.total = Math.max(novo, restState.total);
  // recalcula startTs pra manter o remaining correto
  restState.startTs = Date.now() - (restState.total - novo) * 1000;
  restState.remaining = novo;
  renderRest();
}
// handlers do widget
document.getElementById('rt-close').addEventListener('click', ()=>pararRestTimer(false));
document.getElementById('rt-reiniciar').addEventListener('click', ()=>{
  if(restState.total > 0) iniciarRestTimer(restState.total);
});
document.querySelectorAll('[data-rt-add]').forEach(b=>{
  b.addEventListener('click', ()=>ajustarRestTimer(parseInt(b.dataset.rtAdd)));
});

// --------- cálculos de perfil ----------
// soma kcal/macros da 1ª opção de cada refeição do plano alimentar real
// (o que o nutricionista prescreveu), pra usar como meta do dia em vez
// de uma fórmula genérica de TMB.
function metaDoPlano(){
  const foods = allFoods();
  let kcal=0, p=0, c=0, g=0;
  (state.planoAlimentar||[]).forEach(meal=>{
    const opt = meal.opcoes && meal.opcoes[0];
    if(!opt) return;
    opt.itens.forEach(it=>{
      const f = foods.find(x=>x.id===it.fid);
      if(!f) return;
      const factor = it.g/100;
      kcal += f.kc*factor; p += f.p*factor; c += f.c*factor; g += f.g*factor;
    });
  });
  return {kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), g: Math.round(g)};
}

function calcPerfil(){
  const p = state.perfil;
  const altM = p.altura/100;
  const imc = p.peso / (altM*altM);
  // Mifflin-St Jeor — só referência (TMB/GET), não define mais a meta do dia
  const tmb = p.sexo==='m'
    ? (10*p.peso + 6.25*p.altura - 5*p.idade + 5)
    : (10*p.peso + 6.25*p.altura - 5*p.idade - 161);
  const get = tmb * p.atividade;
  // meta e macros do dia vêm do plano alimentar real (nutricionista)
  const plano = metaDoPlano();
  const meta = plano.kcal || Math.round(get + Number(p.objetivo)); // fallback se o plano estiver vazio
  const protG = plano.kcal ? plano.p : Math.round(p.peso * 2);
  const gordG = plano.kcal ? plano.g : Math.round(p.peso * 1);
  const carbG = plano.kcal ? plano.c : Math.max(0, Math.round((meta - (protG*4 + gordG*9))/4));
  const pesoIdeal = Math.round(22.5 * altM * altM);
  return {imc, tmb:Math.round(tmb), get:Math.round(get), meta, protG, gordG, carbG, pesoIdeal};
}

function imcCategoria(imc){
  if(imc<18.5) return {t:'Abaixo do peso', c:'warn'};
  if(imc<25) return {t:'Peso saudável', c:'ok'};
  if(imc<30) return {t:'Sobrepeso', c:'warn'};
  return {t:'Obesidade', c:'crit'};
}

// --------- tabs ----------
document.querySelectorAll('.tabbar button').forEach(b=>{
  b.addEventListener('click', ()=>showView(b.dataset.view));
});
function showView(v){
  document.querySelectorAll('.view').forEach(s=>s.hidden = s.id!=='view-'+v);
  document.querySelectorAll('.tabbar button').forEach(b=>{
    if(b.dataset.view===v) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  if(v==='hoje') renderHoje();
  if(v==='treino') renderTreino();
  if(v==='hist') renderHistorico();
  if(v==='dieta') renderDieta();
  if(v==='perfil') renderPerfil();
  window.scrollTo({top:0,behavior:'instant'});
}

// --------- today / dashboard ----------
function todayFoodTotals(){
  const list = state.refeicoes[todayKey()]||[];
  return list.reduce((acc,r)=>{
    acc.kcal += r.kcal; acc.p += r.p; acc.c += r.c; acc.g += r.g; return acc;
  },{kcal:0,p:0,c:0,g:0});
}

