// ============================================================
// LIFT — treino + dieta app
// Estado persistido em localStorage com try/catch.
// ============================================================

// ---------- monitoramento de erros ----------
// Captura erros do app (e violações de CSP) e grava em public.client_errors via Supabase.
// Sem serviço externo; sem dados pessoais (só mensagem, rota e navegador). A tabela só aceita INSERT
// do próprio usuário, limita 100/hora e apaga o que tem mais de 30 dias. Leitura: painel/SQL do dono.
const APP_BUILD = '2026-11-23.7';
const _errFila = [];
const _errVistos = new Set();
let _errTotal = 0;
const ERR_MAX_SESSAO = 20;
function reportarErro(kind, msg, stack){
  try{
    msg = String(msg == null ? '' : msg).slice(0,500);
    if(!msg || /^Script error\.?$/.test(msg) || /ResizeObserver loop/.test(msg)) return;
    const chave = kind + '|' + msg;
    if(_errVistos.has(chave) || _errTotal >= ERR_MAX_SESSAO) return;
    _errVistos.add(chave); _errTotal++;
    _errFila.push({
      kind, msg,
      stack: stack ? String(stack).slice(0,2000) : null,
      url: location.pathname.slice(0,300),
      ua: (navigator.userAgent || '').slice(0,300),
      build: APP_BUILD,
    });
  }catch(e){ /* o monitor nunca pode quebrar o app */ }
}
async function enviarErros(){
  try{
    if(!_errFila.length || typeof sb === 'undefined' || !usuarioAtual) return;
    const lote = _errFila.splice(0);
    await sb.from('client_errors').insert(lote);   // falha de envio é descartada de propósito (sem laço)
  }catch(e){ /* idem */ }
}
window.addEventListener('error', e=>{
  reportarErro('error', e.message || (e.error && e.error.message), (e.error && e.error.stack) || (e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : null));
});
window.addEventListener('unhandledrejection', e=>{
  const r = e.reason;
  reportarErro('rejection', (r && r.message) || r, r && r.stack);
});
document.addEventListener('securitypolicyviolation', e=>{
  reportarErro('csp', `${e.violatedDirective} bloqueou ${(e.blockedURI||'').slice(0,120)}`, `${(e.sourceFile||'').slice(0,120)}:${e.lineNumber||0}`);
});
setInterval(enviarErros, 10000);
window.addEventListener('pagehide', enviarErros);

