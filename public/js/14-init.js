// --------- init ----------
function renderHeader(){
  const now = new Date();
  const dow = now.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').toUpperCase().slice(0,3);
  const dm = now.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).toUpperCase().replace('.','');
  // uptime: dias desde o primeiro registro (sessão ou avaliação ou hoje)
  const marcos = [];
  if(state.historico.length) marcos.push(state.historico[state.historico.length-1].data);
  if(state.avaliacoes.length) marcos.push([...state.avaliacoes].sort((a,b)=>a.data.localeCompare(b.data))[0].data);
  let uptime = 0;
  if(marcos.length){
    const inicio = new Date(marcos.sort()[0]);
    uptime = Math.max(0, Math.floor((now - inicio)/(1000*60*60*24)));
  }
  const upStr = uptime>0 ? ` · UP ${uptime}d` : '';
  document.getElementById('today').textContent = `${dow} ${dm}${upStr}`;
}
initAuth();

// ações declarativas (data-act) — substitui onclick inline, que o CSP bloqueia
document.addEventListener('click', e=>{
  const el = e.target.closest && e.target.closest('[data-act]');
  if(!el) return;
  if(el.dataset.act === 'goto-view') showView(el.dataset.view);
  else if(el.dataset.act === 'iniciar-sessao-direta') iniciarSessaoDireta(el.dataset.tid);
});
