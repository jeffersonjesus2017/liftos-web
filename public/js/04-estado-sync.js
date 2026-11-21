// --------- state helpers ----------
// aplica todas as migrações de versão sobre um state bruto (de localStorage OU do Supabase)
function aplicarMigracoes(parsed){
    // Só normaliza o formato (campos que podem faltar em versões antigas). Nenhum dado pessoal é injetado:
    // treino, plano e avaliações vêm exclusivamente da nuvem de cada conta.
    const merged = {...structuredClone(emptyState), ...parsed};
    if(!merged.perfil) merged.perfil = structuredClone(emptyState.perfil);
    if(!merged.divisoes) merged.divisoes = {};
    if(!Array.isArray(merged.planoAlimentar)) merged.planoAlimentar = [];
    if(!Array.isArray(merged.avaliacoes)) merged.avaliacoes = [];
    if(!Array.isArray(merged.historico)) merged.historico = [];
    if(!merged.refeicoes) merged.refeicoes = {};
    if(!Array.isArray(merged.alimentosCustom)) merged.alimentosCustom = [];
    // hidratação
    if(!merged.perfil.aguaMeta) merged.perfil.aguaMeta = 3000; // ml
    if(!merged.agua) merged.agua = {}; // { 'YYYY-MM-DD': [{ml, hora}] }
    // backup tracking
    if(merged.ultimoBackup === undefined) merged.ultimoBackup = null;
    // horário sugerido das refeições do plano (planos antigos sem horaSugerida)
    const horasPadrao = {r1:'07:30', r2:'10:00', r3:'12:00', r4:'16:00', r5:'19:00'};
    merged.planoAlimentar.forEach(m=>{
      if(!m.horaSugerida && horasPadrao[m.id]) m.horaSugerida = horasPadrao[m.id];
    });
    // migração v34: registros de água antigos ganham campo "slot" (inferido pela hora)
    // Associa cada registro {ml, hora} sem slot ao slot mais próximo pela hora
    const horasPlano = [5, 7.5, 10, 12.5, 15, 17.5];
    if(merged.agua){
      Object.keys(merged.agua).forEach(data=>{
        const reg = merged.agua[data];
        if(!Array.isArray(reg)) return;
        // separar com e sem slot
        const semSlot = reg.filter(r=>r.slot===undefined);
        if(semSlot.length === 0) return;
        // marcar slots já ocupados
        const ocupados = new Set(reg.filter(r=>r.slot!==undefined).map(r=>r.slot));
        // ordenar por hora (mais antigo primeiro)
        semSlot.sort((a,b)=>a.hora.localeCompare(b.hora));
        semSlot.forEach(r=>{
          const d = new Date(r.hora);
          const horaDec = d.getHours() + d.getMinutes()/60;
          // encontra slot mais próximo não ocupado
          let melhorIdx = -1, melhorDist = Infinity;
          horasPlano.forEach((h,i)=>{
            if(ocupados.has(i)) return;
            const dist = Math.abs(horaDec - h);
            if(dist < melhorDist){ melhorDist = dist; melhorIdx = i; }
          });
          if(melhorIdx >= 0){
            r.slot = melhorIdx;
            ocupados.add(melhorIdx);
          }
        });
      });
    }
    // avaliações antigas sem fase
    merged.avaliacoes.forEach(a=>{ if(!a.fase) a.fase = 'bulk'; });
    return merged;
}
// cache local — usado só como fallback offline e pra migrar dados de uma instalação
// anterior (localStorage) pra conta na nuvem no primeiro login. A fonte da verdade
// a partir do login é sempre o Supabase.
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return aplicarMigracoes(JSON.parse(raw));
  }catch(e){ return null; }
}
let state = structuredClone(emptyState); // populado de verdade em onAuthed()
let syncTimer = null;
let syncPendente = false;

// --------- log de diagnóstico ----------
// registra eventos de ciclo de vida (visibilidade, sync, onAuthed) pra conseguir
// investigar de verdade relatos de "sumiu registro" em vez de só supor a causa.
const DEBUG_LOG_KEY = 'cargabruta.debuglog.v1';
function logDebug(msg){
  try{
    const log = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]');
    log.push({ t: new Date().toISOString(), msg });
    while(log.length > 150) log.shift();
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(log));
  }catch(e){ /* diagnóstico não pode quebrar o app */ }
}
document.addEventListener('visibilitychange', ()=>{
  logDebug(`visibilitychange -> ${document.visibilityState} | syncPendente=${syncPendente}`);
});
window.addEventListener('pageshow', (e)=>{
  logDebug(`pageshow | persisted=${e.persisted} | sessaoAtiva=${!!state.sessaoAtiva}`);
});
function saveState(){
  state.updatedAt = Date.now();
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch(e){ toast('Falha ao salvar — storage cheio ou bloqueado'); }
  agendarSync();
}

// --------- Supabase: auth + sincronização ----------
const SUPABASE_URL = 'https://xmxdxevrnvmczzlkxqxy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CxKPsJr-My_yqWL0S5gQLQ_ixZhPpDj';
// Leituras sempre direto da rede (cache: 'no-store'): uma resposta velha reaproveitada pelo navegador/rede faz o app
// achar que "a nuvem mudou" e descartar o que só existe neste aparelho (bug de 21/11: sessão de treino cancelada).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: (url, opts) => fetch(url, { ...(opts || {}), cache: 'no-store' }) }
});
let usuarioAtual = null;

function setSyncStatus(txt){
  const el = document.getElementById('sync-status');
  if(el) el.textContent = txt;
}

function agendarSync(){
  if(!usuarioAtual) return; // ainda sem login — só grava local
  syncPendente = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncAgora, 1200);
}

// ---- controle de concorrência (multi-aparelho) ----
// cloudRev = revisão da linha na nuvem que este aparelho conhece; baseState = cópia do que a nuvem tinha
// nessa revisão (base do merge de 3 vias). Gravação só passa se a revisão ainda for a mesma;
// se outro aparelho (ou SQL) alterou a nuvem, busca, faz merge e reenvia — nada é sobrescrito às cegas.
const LS_BASE_KEY = 'cargabruta.base.v1';
let cloudRev = null, baseState = null;
let syncEmAndamento = false, conflitosSeguidos = 0;

function guardarBase(rev, data){
  cloudRev = rev;
  baseState = structuredClone(data);
  try{ localStorage.setItem(LS_BASE_KEY, JSON.stringify({ uid: usuarioAtual && usuarioAtual.id, rev, data })); }catch(e){}
}
function lerBase(uid){
  try{ const b = JSON.parse(localStorage.getItem(LS_BASE_KEY)); return (b && b.uid === uid) ? b : null; }catch(e){ return null; }
}
const _jstr = x => JSON.stringify(x);
const _semUpd = st => _jstr({ ...st, updatedAt: 0, _selectedOpt: undefined });

// listas de itens (por conteúdo): mantém o que a nuvem tem, aplica remoções e adições feitas localmente
function merge3Lista(l, c, b){
  l = l || []; c = c || []; b = b || [];
  const bs = new Set(b.map(_jstr)), ls = new Set(l.map(_jstr));
  const removidos = new Set(b.filter(x=>!ls.has(_jstr(x))).map(_jstr));
  // remove itens apagados localmente e duplicatas idênticas (mesmo JSON) que já estejam na nuvem
  const vistos = new Set();
  const out = c.filter(x=>{ const k=_jstr(x); if(removidos.has(k) || vistos.has(k)) return false; vistos.add(k); return true; });
  const tem = new Set(out.map(_jstr));
  l.forEach(x=>{ const k=_jstr(x); if(!bs.has(k) && !tem.has(k)){ out.push(x); tem.add(k); } });
  return out;
}
// base == null (aparelho ainda sem base): só une as listas (nunca apaga) e escolhe um lado para o resto
function mergeEstado(local, cloud, base, preferirLocalSemBase){
  const LISTAS = ['historico','avaliacoes','alimentosCustom'];
  const DIAS = ['refeicoes','agua'];
  const out = { ...cloud };
  const semBase = !base;
  const bs = base || {};
  Object.keys({ ...cloud, ...local }).forEach(k=>{
    if(k === 'updatedAt') return;
    if(LISTAS.includes(k)){
      out[k] = merge3Lista(local[k], cloud[k], semBase ? [] : bs[k]);
    } else if(DIAS.includes(k)){
      const dias = new Set([...Object.keys(local[k]||{}), ...Object.keys(cloud[k]||{})]);
      const r = {};
      dias.forEach(d=>{
        const m = merge3Lista((local[k]||{})[d], (cloud[k]||{})[d], semBase ? [] : (bs[k]||{})[d]);
        if(m.length) r[d] = m;
      });
      out[k] = r;
    } else if(semBase){
      if(preferirLocalSemBase) out[k] = local[k];
    } else if(_jstr(local[k]) !== _jstr(bs[k])){
      out[k] = local[k]; // este aparelho alterou: vale o local; senão fica o da nuvem
    }
  });
  out.updatedAt = Date.now();
  return out;
}

function rerenderAtual(){
  const btn = document.querySelector('.tabbar button[aria-current="page"]');
  const v = btn && btn.dataset.view;
  try{
    if(v==='hoje') renderHoje();
    else if(v==='treino') renderTreino();
    else if(v==='hist') renderHistorico();
    else if(v==='dieta') renderDieta();
    else if(v==='perfil') renderPerfil();
  }catch(e){ console.error('[rerender]', e); }
}

// A revisão da nuvem só cresce. Se a leitura veio com revisão MENOR que a que este aparelho já conhece, ela é velha
// (cache/atraso): nunca mesclar com ela, senão o app "desfaz" o que já tinha sincronizado.
function nuvemDefasada(revNuvem, revConhecida){
  return revConhecida != null && revNuvem != null && Number(revNuvem) < Number(revConhecida);
}
// lê a linha da nuvem; se vier defasada, tenta de novo uma vez e, persistindo, falha (o sync tenta mais tarde, sem tocar no local)
async function lerLinhaNuvem(){
  for(let i = 0; i < 2; i++){
    const { data: row, error } = await sb.from('app_state').select('data,rev').eq('user_id', usuarioAtual.id).maybeSingle();
    if(error) throw error;
    if(!row || !nuvemDefasada(row.rev, cloudRev)) return row;
    logDebug(`leitura defasada: nuvem rev=${row.rev} < conhecida ${cloudRev} (tentativa ${i + 1})`);
  }
  throw new Error('leitura da nuvem defasada');
}
// guarda o estado local antes de mesclar; não sobrescreve um registro de menos de 10 min (o do início do app é o que importa)
function guardarPremerge(local){
  try{
    const p = JSON.parse(localStorage.getItem('cargabruta.premerge') || 'null');
    if(p && p.t && Date.now() - p.t < 10 * 60 * 1000) return;
    localStorage.setItem('cargabruta.premerge', JSON.stringify({ t: Date.now(), local }));
  }catch(e){}
}

async function resolverConflito(){
  conflitosSeguidos++;
  logDebug(`conflito #${conflitosSeguidos}: nuvem mudou (rev local=${cloudRev}) — buscando e mesclando`);
  if(conflitosSeguidos > 5){
    setSyncStatus('Conflito de sincronização — recarregue o app');
    throw new Error('conflitos demais seguidos');
  }
  const row = await lerLinhaNuvem();
  if(!row){
    // linha não existe mais: recria com o que temos
    const { data: ins, error: e2 } = await sb.from('app_state').insert({ user_id: usuarioAtual.id, data: state }).select('rev');
    if(e2) throw e2;
    guardarBase(ins[0].rev, state);
    return;
  }
  const cloud = aplicarMigracoes(row.data);
  // rede de segurança: guarda a versão local antes de mesclar (recuperável pelo suporte)
  guardarPremerge(state);
  state = mergeEstado(state, cloud, baseState, false);
  guardarBase(row.rev, cloud);
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
  if(_semUpd(state) !== _semUpd(cloud)){
    syncPendente = true; // há algo local a enviar sobre a revisão nova
    clearTimeout(syncTimer); syncTimer = setTimeout(syncAgora, 0);
  } else {
    conflitosSeguidos = 0;
  }
  rerenderAtual();
}

async function syncAgora(){
  if(!usuarioAtual || !syncPendente) return;
  if(syncEmAndamento) return; // o finally reagenda se chegou alteração nova
  syncEmAndamento = true; syncPendente = false;
  let falhou = false;
  setSyncStatus('Sincronizando…');
  logDebug(`syncAgora: start | rev=${cloudRev} | updatedAt=${state.updatedAt} | sessaoAtiva=${!!state.sessaoAtiva}`);
  try{
    const enviado = structuredClone(state);
    const { data: rows, error } = await sb.from('app_state')
      .update({ data: enviado }).eq('user_id', usuarioAtual.id).eq('rev', cloudRev).select('rev');
    if(error) throw error;
    if(!rows || !rows.length){
      await resolverConflito();
    } else {
      conflitosSeguidos = 0;
      guardarBase(rows[0].rev, enviado);
      setSyncStatus('Sincronizado ✓ ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
      logDebug(`syncAgora: ok rev=${rows[0].rev}`);
    }
  }catch(e){
    falhou = true;
    console.error('[sync]', e);
    reportarErro('sync', e && e.message, e && e.stack);
    setSyncStatus('Falha ao sincronizar — tentando de novo em breve');
    logDebug(`syncAgora: ERRO ${e && e.message}`);
    syncPendente = true;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncAgora, 8000);
  } finally {
    syncEmAndamento = false;
    if(syncPendente && !falhou){ clearTimeout(syncTimer); syncTimer = setTimeout(syncAgora, 300); }
  }
}

// ao voltar para o app: envia o que está pendente ou busca mudanças feitas em outro aparelho
async function puxarDaNuvem(){
  if(!usuarioAtual || syncEmAndamento) return;
  if(syncPendente){ clearTimeout(syncTimer); await syncAgora(); return; }
  try{
    const { data: r, error } = await sb.from('app_state').select('rev').eq('user_id', usuarioAtual.id).maybeSingle();
    if(error || !r || r.rev === cloudRev) return;
    if(nuvemDefasada(r.rev, cloudRev)){ logDebug(`puxar: leitura defasada ignorada (nuvem rev=${r.rev} < ${cloudRev})`); return; }
    conflitosSeguidos = 0;
    await resolverConflito();
  }catch(e){ console.error('[puxar]', e); }
}

function mostrarAuthGate(){
  document.getElementById('auth-gate').style.display = 'flex';
  document.getElementById('app-root').hidden = true;
}
function esconderAuthGate(){
  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('app-root').hidden = false;
}

async function onAuthed(user){
  usuarioAtual = user;
  const emailEl = document.getElementById('conta-email');
  if(emailEl) emailEl.textContent = user.email;
  setSyncStatus('Carregando dados…');
  logDebug('onAuthed: chamado');
  try{
    const base = lerBase(user.id);
    let { data: row, error } = await sb.from('app_state').select('data,rev').eq('user_id', user.id).maybeSingle();
    if(error) throw error;
    if(row && base && nuvemDefasada(row.rev, base.rev)){
      logDebug(`onAuthed: leitura defasada (nuvem rev=${row.rev} < base ${base.rev}) — lendo de novo`);
      const r2 = await sb.from('app_state').select('data,rev').eq('user_id', user.id).maybeSingle();
      if(r2.error) throw r2.error;
      row = r2.data;
    }
    const cloud = (row && row.data && Object.keys(row.data).length) ? aplicarMigracoes(row.data) : null;
    const local = loadState();
    logDebug(`onAuthed: cloud.rev=${row?row.rev:'null'} base.rev=${base?base.rev:'null'} local.updatedAt=${local?local.updatedAt:'null'}`);
    let enviar = false;
    if(cloud && local){
      if(base && nuvemDefasada(row.rev, base.rev)){
        // continua defasada: não mescla com ela (descartaria o que este aparelho já sincronizou, ex.: treino em andamento).
        // Mantém o LOCAL e a base conhecida; a gravação só passa se a nuvem realmente estiver nessa revisão.
        state = local; cloudRev = base.rev; baseState = structuredClone(base.data);
        enviar = _semUpd(local) !== _semUpd(base.data);
        logDebug(`onAuthed: nuvem defasada (rev=${row.rev} < ${base.rev}) — manteve LOCAL`);
        reportarErro('sync', `leitura defasada no boot: nuvem rev=${row.rev} < base ${base.rev}`);
      } else if(base && base.rev === row.rev){
        // a nuvem não mudou desde a última sincronização deste aparelho: vale o local (pode ter pendências)
        state = local; cloudRev = row.rev; baseState = structuredClone(base.data);
        enviar = _semUpd(local) !== _semUpd(base.data);
        logDebug('onAuthed: nuvem inalterada — usou LOCAL' + (enviar ? ' (com pendências)' : ''));
      } else if(base){
        // a nuvem avançou (outro aparelho/SQL): merge de 3 vias em vez de sobrescrever
        try{ localStorage.setItem('cargabruta.premerge', JSON.stringify({ t: Date.now(), local })); }catch(e){}   // aqui sempre sobrescreve: é o estado do início do app
        state = mergeEstado(local, cloud, base.data, false);
        guardarBase(row.rev, cloud);
        enviar = _semUpd(state) !== _semUpd(cloud);
        logDebug('onAuthed: nuvem avançou — merge local+nuvem');
      } else {
        // primeira vez com controle de revisão neste aparelho: une listas (nunca apaga) e usa o lado mais recente
        try{ localStorage.setItem('cargabruta.premerge', JSON.stringify({ t: Date.now(), local })); }catch(e){}
        state = mergeEstado(local, cloud, null, (local.updatedAt||0) > (cloud.updatedAt||0));
        guardarBase(row.rev, cloud);
        enviar = _semUpd(state) !== _semUpd(cloud);
        logDebug('onAuthed: sem base — união de listas');
      }
    } else if(cloud){
      state = cloud;
      guardarBase(row.rev, cloud);
      logDebug('onAuthed: usou NUVEM (sem cache local)');
    } else {
      // primeiro login nessa conta: migra dados locais (se existirem nesse aparelho) pra nuvem;
      // sem dados locais, começa do zero com o estado neutro.
      state = local || structuredClone(emptyState);
      logDebug('onAuthed: primeiro login — migrou local (ou default) pra nuvem');
      const { data: ins, error: eIns } = await sb.from('app_state')
        .upsert({ user_id: user.id, data: state }, { onConflict: 'user_id' }).select('rev');
      if(eIns) throw eIns;
      guardarBase(ins[0].rev, state);
    }
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    setSyncStatus('Sincronizado ✓');
    if(enviar){ agendarSync(); }
  }catch(e){
    console.error('[onAuthed]', e);
    state = loadState() || structuredClone(emptyState);
    const b = lerBase(user.id);
    if(b){ cloudRev = b.rev; baseState = structuredClone(b.data); }
    setSyncStatus('Offline — usando dados salvos neste aparelho');
  }
  esconderAuthGate();
  aplicarTema();
  bindPhotoDrops();
  renderHeader();
  renderHoje();
}

let authModo = 'login'; // 'login' | 'cadastro'
function setAuthMsg(txt, tipo){
  const el = document.getElementById('auth-msg');
  el.textContent = txt || '';
  el.className = 'msg' + (tipo ? ' '+tipo : '');
}
function traduzErroAuth(msg){
  if(/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if(/User already registered/i.test(msg)) return 'Já existe uma conta com esse e-mail. Tenta entrar.';
  if(/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/Email not confirmed/i.test(msg)) return 'Confirma seu e-mail antes de entrar (cheque a caixa de entrada).';
  return msg;
}

document.getElementById('auth-toggle-btn').addEventListener('click', ()=>{
  authModo = authModo === 'login' ? 'cadastro' : 'login';
  document.getElementById('auth-submit').textContent = authModo === 'login' ? 'Entrar' : 'Criar conta';
  document.getElementById('auth-sub').textContent = authModo === 'login' ? 'Entre pra acessar seus dados' : 'Crie sua conta pra começar';
  document.getElementById('auth-toggle-text').textContent = authModo === 'login' ? 'Não tem conta?' : 'Já tem conta?';
  document.getElementById('auth-toggle-btn').textContent = authModo === 'login' ? 'Criar conta' : 'Entrar';
  setAuthMsg('');
});

document.getElementById('auth-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const senha = document.getElementById('auth-pass').value;
  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  setAuthMsg('');
  try{
    if(authModo === 'login'){
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if(error) throw error;
    } else {
      const { data, error } = await sb.auth.signUp({ email, password: senha });
      if(error) throw error;
      if(!data.session){
        setAuthMsg('Conta criada! Verifica seu e-mail pra confirmar antes de entrar.', 'ok');
      }
    }
  }catch(e){
    setAuthMsg(traduzErroAuth(e.message), 'err');
  }finally{
    btn.disabled = false;
  }
});

async function initAuth(){
  logDebug('initAuth: boot');
  const { data:{ session } } = await sb.auth.getSession();
  logDebug(`initAuth: getSession -> ${session ? 'tem sessão' : 'sem sessão'}`);
  if(session && session.user){ await onAuthed(session.user); }
  else { mostrarAuthGate(); }
  sb.auth.onAuthStateChange((event, session)=>{
    logDebug(`onAuthStateChange: ${event}`);
    if(event === 'SIGNED_IN' && session && (!usuarioAtual || usuarioAtual.id !== session.user.id)){
      onAuthed(session.user);
    }
    if(event === 'SIGNED_OUT'){
      usuarioAtual = null;
      logDebug('onAuthStateChange: SIGNED_OUT -> vai recarregar a página');
      location.reload();
    }
  });
}

// Ao minimizar/trocar de app, tenta sincronizar na hora em vez de esperar o debounce —
// reduz a janela em que um registro feito pouco antes de sair ainda não chegou na nuvem
// (o que importa porque, ao voltar, o app pode recarregar do zero e buscar a nuvem de novo).
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden' && syncPendente){
    clearTimeout(syncTimer);
    syncAgora();
  } else if(document.visibilityState === 'visible'){
    puxarDaNuvem();
  }
});
window.addEventListener('online', ()=>{ puxarDaNuvem(); });
window.addEventListener('pagehide', ()=>{
  if(syncPendente){
    clearTimeout(syncTimer);
    syncAgora();
  }
});

// extrai YYYY-MM-DD no fuso LOCAL (não UTC) — evita bug de timezone
function localDateStr(input){
  const d = input ? new Date(input) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function todayKey(){
  return localDateStr();
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
}

// escapa texto de usuário/LLM antes de entrar em innerHTML (evita injeção de HTML/atributos)
function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(()=>el.classList.remove('show'), 1800);
}

