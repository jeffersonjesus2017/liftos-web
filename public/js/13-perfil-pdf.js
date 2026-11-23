// --------- perfil ----------
function renderMicroEditor(){
  const el = document.getElementById('p-micros-lista');
  if(!el) return;
  const over = state.perfil.microAlvos || {};
  const auto = alvosMicro(state.perfil.sexo, state.perfil.idade);
  el.innerHTML = MICRO_DEF.map(m=>{
    const o = over[m.k] || {};
    const modo = o.modo || (m.max ? 'max' : 'meta');
    return `<div style="display:grid;grid-template-columns:1.2fr 1fr 1.3fr;gap:6px;align-items:center;margin-bottom:6px;font-size:12px">
      <span>${m.n} <span style="color:var(--ink-mute)">(${m.u})</span></span>
      <input type="number" step="any" min="0" data-mk="${m.k}" data-f="v" placeholder="${auto[m.k]}" value="${o.v||''}">
      <select data-mk="${m.k}" data-f="modo">
        <option value="meta"${modo==='meta'?' selected':''}>Meta</option>
        <option value="max"${modo==='max'?' selected':''}>Limite (máx.)</option>
        <option value="info"${modo==='info'?' selected':''}>Só acompanhar</option>
      </select></div>`;
  }).join('');
}
function lerMicroEditor(){
  const out = {};
  document.querySelectorAll('#p-micros-lista [data-mk]').forEach(inp=>{
    const k = inp.dataset.mk; out[k] = out[k] || {};
    if(inp.dataset.f==='v'){ const v = Number(inp.value); if(v>0) out[k].v = v; }
    else out[k].modo = inp.value;
  });
  // guarda só o que difere do padrão
  Object.keys(out).forEach(k=>{
    const def = MICRO_DEF.find(m=>m.k===k);
    const padrao = def && def.max ? 'max' : 'meta';
    if(!out[k].v && out[k].modo===padrao) delete out[k];
  });
  return out;
}
function renderPerfil(){
  const p = state.perfil;
  renderMicroEditor();
  document.getElementById('p-peso').value = p.peso;
  document.getElementById('p-alt').value = p.altura;
  document.getElementById('p-idade').value = p.idade;
  document.getElementById('p-sexo').value = p.sexo;
  document.getElementById('p-ativ').value = p.atividade;
  document.getElementById('p-obj').value = p.objetivo;
  document.getElementById('p-meta-kcal').value = Number(p.metaKcal) > 0 ? p.metaKcal : '';
  document.getElementById('p-agua').value = p.aguaMeta || 3000;
  // sugestão de água baseada no peso: 25-50 ml/kg
  const min = Math.round(p.peso * 25 / 50) * 50;
  const max = Math.round(p.peso * 50 / 50) * 50;
  document.getElementById('agua-sugestao').textContent = `Faixa: ${min}–${max} ml (25–50 ml/kg)`;

  const r = calcPerfil();
  document.getElementById('r-imc').textContent = r.imc.toFixed(1);
  document.getElementById('r-tmb').textContent = r.tmb;
  document.getElementById('r-get').textContent = r.get;
  document.getElementById('r-meta').textContent = r.meta;
  document.getElementById('r-pm').textContent = r.protG;
  document.getElementById('r-pi').textContent = r.pesoIdeal;

  // marker do IMC: escala 15 a 35
  const pct = Math.max(0, Math.min(100, ((r.imc-15)/(35-15))*100));
  document.getElementById('imc-mark').style.left = pct+'%';
  const cat = imcCategoria(r.imc);
  // Contexto: se %G da última avaliação é baixo mas IMC alto → massa magra
  const ultAvalG = [...state.avaliacoes].sort((a,b)=>b.data.localeCompare(a.data)).find(a=>a.pctG!=='' && a.pctG!==undefined && a.pctG!==null);
  let imcNota = '';
  const ctxImc = imcContexto(r.imc, ultAvalG ? +ultAvalG.pctG : null, state.perfil.sexo || 'm');
  if(ctxImc){
    imcNota = `<div style="font-size:11px;color:var(--${ctxImc.cls});margin-top:6px">${ctxImc.txt}</div>`;
  }
  document.getElementById('imc-cat').innerHTML = `<span class="pill ${cat.c}">${cat.t}</span>${imcNota}`;
}

document.getElementById('btn-salvar-perfil').addEventListener('click', ()=>{
  // valida inputs antes de salvar
  const peso = Number(document.getElementById('p-peso').value);
  const altura = Number(document.getElementById('p-alt').value);
  const idade = Number(document.getElementById('p-idade').value);
  if(!(peso >= 30 && peso <= 300)){ toast('Peso inválido (30-300 kg)'); return; }
  if(!(altura >= 100 && altura <= 250)){ toast('Altura inválida (100-250 cm)'); return; }
  if(!(idade >= 10 && idade <= 120)){ toast('Idade inválida (10-120 anos)'); return; }
  const aguaAnterior = state.perfil.aguaMeta;
  state.perfil = {
    peso, altura, idade,
    sexo: document.getElementById('p-sexo').value,
    atividade: Number(document.getElementById('p-ativ').value),
    objetivo: Number(document.getElementById('p-obj').value),
    metaKcal: Math.max(0, Math.round(Number(document.getElementById('p-meta-kcal').value) || 0)),
    aguaMeta: Number(document.getElementById('p-agua').value) || 3000,
    microAlvos: lerMicroEditor(),
    tema: state.perfil.tema || 'system' // controlado pelo botão de tema rápido no topo, não aqui
  };
  // mudou a meta de água no Perfil: o plano volta a ser calculado a partir dela (descarta horários/ml editados)
  if(state.perfil.aguaMeta !== aguaAnterior) state.planoAgua = null;
  saveState();
  aplicarTema();
  renderPerfil();
  toast('Perfil salvo ✓');
});

function aplicarTema(){
  const t = state.perfil.tema || 'system';
  const root = document.documentElement;
  if(t === 'system'){
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', t);
  }
}
// detecta tema atual (considerando "system")
function temaAtualEfetivo(){
  const t = state.perfil.tema || 'system';
  if(t !== 'system') return t;
  // system: checa prefers-color-scheme
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch(e){ return 'dark'; }
}
// toggle rápido pelo botão do topbar: alterna entre light e dark explícitos
document.getElementById('btn-tema-quick').addEventListener('click', ()=>{
  const atual = temaAtualEfetivo();
  state.perfil.tema = atual === 'dark' ? 'light' : 'dark';
  saveState();
  aplicarTema();
  toast(state.perfil.tema === 'dark' ? '🌙 Tema escuro' : '☀ Tema claro');
});

document.getElementById('btn-export').addEventListener('click', ()=>{
  // baixa o backup como arquivo .json de verdade (mais confiável que Web Share/clipboard,
  // que dependiam de APIs nem sempre disponíveis no navegador/dispositivo)
  const data = JSON.stringify(state, null, 2);
  const nomeArquivo = `liftos-backup-${todayKey()}.json`;
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  // marca backup feito
  state.ultimoBackup = new Date().toISOString();
  saveState();
  toast('Arquivo baixado ✓');
});

// --------- gerador de PDF mensal ----------
async function gerarRelatorioPDF(){
  // tenta carregar jsPDF se ainda não carregou (lazy fallback)
  if(typeof window.jspdf === 'undefined'){
    toast('Carregando biblioteca PDF...');
    await new Promise((resolve)=>{
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
      // timeout de segurança
      setTimeout(resolve, 5000);
    });
    if(typeof window.jspdf === 'undefined'){
      toast('Não foi possível carregar a biblioteca PDF. Verifique conexão.');
      return;
    }
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'mm', format:'a4'});

  const now = new Date();
  const mesRef = now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const dataRef = now.toLocaleDateString('pt-BR');

  // janela do mês atual (primeiro dia do mês até hoje)
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesStr = localDateStr(inicioMes);

  // === cabeçalho ===
  doc.setFillColor(232, 55, 28); // accent
  doc.rect(0, 0, 210, 25, 'F');
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('LIFT — Relatório Mensal', 15, 12);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`${mesRef.charAt(0).toUpperCase()+mesRef.slice(1)} · Gerado em ${dataRef}`, 15, 19);

  let y = 35;
  doc.setTextColor(0);

  // === seção perfil ===
  const p = state.perfil;
  const r = calcPerfil();
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Perfil', 15, y); y += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const perfilLines = [
    `Peso atual: ${p.peso} kg · Altura: ${p.altura} cm · Idade: ${p.idade} anos · Sexo: ${p.sexo==='m'?'Masculino':'Feminino'}`,
    `IMC: ${r.imc.toFixed(1)} · TMB: ${r.tmb} kcal · GET: ${r.get} kcal`,
    `Meta diária: ${r.meta} kcal (baseada no plano alimentar) · GET estimado: ${r.get} kcal`,
    `Macros alvo: ${r.protG}g proteína · ${r.carbG}g carbo · ${r.gordG}g gordura`,
    `Meta hidratação: ${(p.aguaMeta||3000)} ml/dia`,
  ];
  perfilLines.forEach(l=>{ doc.text(l, 15, y); y += 5; });
  y += 4;

  // === última avaliação corporal ===
  const avaliacoes = [...state.avaliacoes].sort((a,b)=>a.data.localeCompare(b.data));
  const ultAval = avaliacoes[avaliacoes.length-1];
  if(ultAval){
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Última avaliação corporal', 15, y); y += 7;
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    const dtA = new Date(ultAval.data+'T12:00:00').toLocaleDateString('pt-BR');
    doc.text(`Data: ${dtA} · Fase: ${(ultAval.fase||'bulk').toUpperCase()}`, 15, y); y += 5;
    const linhasAval = [];
    if(ultAval.peso) linhasAval.push(`Peso: ${ultAval.peso} kg`);
    if(ultAval.mm) linhasAval.push(`Massa magra: ${ultAval.mm} kg`);
    if(ultAval.mg) linhasAval.push(`Massa gorda: ${ultAval.mg} kg`);
    if(ultAval.pctG) linhasAval.push(`% Gordura: ${ultAval.pctG}%`);
    if(ultAval.d_soma) linhasAval.push(`Soma 7 dobras: ${ultAval.d_soma} mm`);
    if(linhasAval.length) { doc.text(linhasAval.join(' · '), 15, y); y += 5; }
    // circunferências
    const circ = [];
    if(ultAval.c_braco) circ.push(`Braço ${ultAval.c_braco}cm`);
    if(ultAval.c_peito) circ.push(`Peito ${ultAval.c_peito}cm`);
    if(ultAval.c_cintura) circ.push(`Cintura ${ultAval.c_cintura}cm`);
    if(ultAval.c_quadril) circ.push(`Quadril ${ultAval.c_quadril}cm`);
    if(ultAval.c_coxa) circ.push(`Coxa ${ultAval.c_coxa}cm`);
    if(ultAval.c_pant) circ.push(`Panturrilha ${ultAval.c_pant}cm`);
    if(circ.length){ doc.text('Circunferências: ' + circ.join(' · '), 15, y); y += 5; }
    y += 4;
  }

  // === variação na fase atual ===
  if(ultAval){
    const faseAtual = ultAval.fase || 'bulk';
    const mesmaFase = avaliacoes.filter(a=>a.fase === faseAtual);
    if(mesmaFase.length >= 2){
      const primeira = mesmaFase[0];
      const dias = Math.floor((new Date(ultAval.data) - new Date(primeira.data))/(1000*60*60*24));
      doc.setFontSize(13); doc.setFont(undefined, 'bold');
      doc.text(`Evolução da fase atual (${faseAtual})`, 15, y); y += 7;
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      const dtP = new Date(primeira.data+'T12:00:00').toLocaleDateString('pt-BR');
      const dtU = new Date(ultAval.data+'T12:00:00').toLocaleDateString('pt-BR');
      doc.text(`Período: ${dtP} → ${dtU} (${dias} dias)`, 15, y); y += 5;
      const mk = (lbl, k, unit)=>{
        if(primeira[k] && ultAval[k]){
          const d = (ultAval[k]-primeira[k]).toFixed(2);
          const sgn = d>=0?'+':'';
          return `${lbl}: ${sgn}${d}${unit}`;
        }
        return null;
      };
      const vars = [mk('Peso','peso','kg'), mk('MM','mm','kg'), mk('MG','mg','kg'), mk('%G','pctG','%'), mk('Dobras','d_soma','mm')].filter(Boolean);
      if(vars.length){
        doc.text(vars.join(' · '), 15, y); y += 5;
      }
      y += 4;
    }
  }

  // === resumo dieta do mês ===
  const diasMes = Object.keys(state.refeicoes).filter(d=>d >= inicioMesStr).sort();
  if(diasMes.length){
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Dieta no mês', 15, y); y += 7;
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    let somaKcal = 0, somaP = 0, somaC = 0, somaG = 0, diasNoAlvo = 0;
    diasMes.forEach(d=>{
      const refs = state.refeicoes[d] || [];
      const kc = refs.reduce((s,x)=>s+x.kcal,0);
      const p = refs.reduce((s,x)=>s+x.p,0);
      const c = refs.reduce((s,x)=>s+x.c,0);
      const g = refs.reduce((s,x)=>s+x.g,0);
      somaKcal += kc; somaP += p; somaC += c; somaG += g;
      if(kc >= r.meta*0.85 && kc <= r.meta*1.15) diasNoAlvo++;
    });
    const n = diasMes.length;
    doc.text(`Dias registrados: ${n}`, 15, y); y += 5;
    doc.text(`Dias no alvo (±15%): ${diasNoAlvo}/${n} (${Math.round(diasNoAlvo/n*100)}%)`, 15, y); y += 5;
    doc.text(`Média diária: ${Math.round(somaKcal/n)} kcal · ${Math.round(somaP/n)}g P · ${Math.round(somaC/n)}g C · ${Math.round(somaG/n)}g G`, 15, y); y += 5;
    y += 4;
  }

  // === resumo treino do mês ===
  const treinosMes = state.historico.filter(h=>localDateStr(h.data) >= inicioMesStr);
  if(treinosMes.length){
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Treinos no mês', 15, y); y += 7;
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    const diasUnicos = new Set(treinosMes.map(h=>localDateStr(h.data))).size;
    doc.text(`Total de sessões: ${treinosMes.length} · Dias únicos: ${diasUnicos}`, 15, y); y += 5;
    // volume total
    const volTotal = treinosMes.reduce((s,h)=>s + h.exercicios.reduce((s2,e)=>s2 + e.sets.reduce((s3,st)=>s3 + (Number(st.carga)||0)*(Number(st.reps)||0),0),0),0);
    doc.text(`Volume total: ${Math.round(volTotal)} kg · Média por sessão: ${Math.round(volTotal/treinosMes.length)} kg`, 15, y); y += 5;
    // frequência por treino da divisão
    const freq = {};
    treinosMes.forEach(h=>{
      freq[h.nome] = (freq[h.nome]||0)+1;
    });
    y += 2;
    doc.setFont(undefined, 'bold');
    doc.text('Frequência por treino:', 15, y); y += 5;
    doc.setFont(undefined, 'normal');
    Object.entries(freq).sort((a,b)=>b[1]-a[1]).forEach(([nome, qt])=>{
      if(y > 275){ doc.addPage(); y = 20; }
      doc.text(`  • ${nome}: ${qt}x`, 15, y); y += 5;
    });
    y += 4;
  }

  // === PRs do mês (cargas máximas) ===
  if(treinosMes.length){
    if(y > 230){ doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Maiores cargas do mês', 15, y); y += 7;
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    const prs = {};
    treinosMes.forEach(h=>{
      h.exercicios.forEach(e=>{
        const maxCarga = Math.max(...e.sets.map(s=>Number(s.carga)||0));
        if(!prs[e.nome] || prs[e.nome] < maxCarga){
          prs[e.nome] = maxCarga;
        }
      });
    });
    const ordenado = Object.entries(prs).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    ordenado.slice(0,15).forEach(([nome, carga])=>{
      if(y > 275){ doc.addPage(); y = 20; }
      doc.text(`  • ${nome}: ${carga} kg`, 15, y); y += 5;
    });
    y += 4;
  }

  // === rodapé ===
  const nPages = doc.internal.getNumberOfPages();
  for(let i=1; i<=nPages; i++){
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`LIFT · Página ${i}/${nPages} · ${dataRef}`, 105, 290, {align:'center'});
  }

  const nomeArq = `liftos-relatorio-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.pdf`;
  const blob = doc.output('blob');

  // PDFs em iframe quase nunca renderizam em celular (política de segurança).
  // Estratégia: priorizar o Compartilhar nativo direto. Modal só como backup.
  if(navigator.share && navigator.canShare){
    try {
      const file = new File([blob], nomeArq, {type:'application/pdf'});
      if(navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:'LIFT Relatório Mensal'});
        toast('Compartilhado ✓');
        return;
      }
    } catch(e){
      if(e.name === 'AbortError') return; // usuário cancelou
      // outros erros caem no modal abaixo
    }
  }
  // fallback: abre modal com informações + tenta renderizar
  abrirPDFViewer(blob, nomeArq);
  toast('Relatório gerado ✓');
}

function abrirPDFViewer(blob, nomeArq){
  // cria blob URL (mais compatível que data URI)
  const blobUrl = URL.createObjectURL(blob);
  let viewer = document.getElementById('pdf-viewer');
  if(viewer) viewer.remove();
  viewer = document.createElement('div');
  viewer.id = 'pdf-viewer';
  viewer.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:70;display:flex;flex-direction:column;padding:12px;gap:8px';
  const tamKb = Math.round(blob.size/1024);
  viewer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="color:#fff;font-size:12px;font-family:'JetBrains Mono',monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${nomeArq} · ${tamKb}KB</div>
      <button id="pdf-close" style="background:rgba(255,255,255,0.15);color:#fff;border:0;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
    </div>
    <div style="background:#fff;border-radius:8px;padding:24px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
      <div style="font-size:48px">📄</div>
      <div style="font-size:16px;font-weight:700;color:#111">Relatório pronto</div>
      <div style="font-size:13px;color:#555;max-width:320px;line-height:1.5">PDFs não abrem direto no visualizador deste app por limitação de segurança do navegador. Use um dos botões abaixo:</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        <button id="pdf-share2" style="background:#e8371c;color:#fff;border:0;padding:12px 20px;border-radius:8px;font:inherit;font-size:14px;font-weight:700;cursor:pointer">📤 Compartilhar</button>
        <a id="pdf-open" href="${blobUrl}" target="_blank" rel="noopener" style="background:#444;color:#fff;border:0;padding:12px 20px;border-radius:8px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block">↗ Abrir em nova aba</a>
      </div>
      <div style="font-size:11px;color:#888;margin-top:8px">A nova aba abre o PDF nativamente — de lá dá pra salvar no Drive, Downloads, etc.</div>
    </div>
  `;
  document.body.appendChild(viewer);
  document.getElementById('pdf-close').addEventListener('click', ()=>{
    URL.revokeObjectURL(blobUrl);
    viewer.remove();
  });
  document.getElementById('pdf-share2').onclick = async ()=>{
    try {
      if(navigator.share && navigator.canShare){
        const file = new File([blob], nomeArq, {type:'application/pdf'});
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file], title:'LIFT Relatório Mensal'});
          toast('Compartilhado ✓');
          return;
        }
      }
      toast('Compartilhamento não suportado neste dispositivo');
    } catch(e){
      if(e.name !== 'AbortError') toast('Compartilhamento falhou');
    }
  };
}

document.getElementById('btn-pdf').addEventListener('click', async ()=>{
  toast('Gerando relatório...');
  try { await gerarRelatorioPDF(); }
  catch(e){ toast('Erro: '+e.message); console.error(e); }
});

document.getElementById('btn-import').addEventListener('click', ()=>{
  document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  e.target.value = ''; // permite escolher o mesmo arquivo de novo numa próxima vez
  if(!file) return;
  const ok = await confirmar(
    `Importar "${file.name}" vai SUBSTITUIR todos os dados atuais (treino, dieta, histórico, avaliações). Essa ação não pode ser desfeita. Continuar?`,
    {title:'Importar backup', okLabel:'Importar e substituir', warn:true}
  );
  if(!ok) return;
  try{
    const texto = await file.text();
    const parsed = JSON.parse(texto);
    state = {...structuredClone(emptyState), ...parsed};
    saveState();
    toast('Dados importados ✓');
    showView('hoje');
  }catch(e){ toast('Arquivo inválido — confira se é um backup .json do LIFT'); }
});

document.getElementById('btn-reset').addEventListener('click', async ()=>{
  const ok = await confirmar('Apagar TODOS os dados? Essa ação não pode ser desfeita.', {
    title:'Resetar aplicativo',
    okLabel:'Apagar tudo',
    warn:true
  });
  if(!ok) return;
  state = structuredClone(emptyState);
  saveState();
  toast('Resetado');
  renderPerfil();
  showView('hoje');
});

document.getElementById('btn-logout').addEventListener('click', async ()=>{
  const ok = await confirmar('Sair da sua conta?', {title:'Sair', okLabel:'Sair'});
  if(!ok) return;
  await sb.auth.signOut();
});

document.getElementById('btn-copiar-diag').addEventListener('click', async ()=>{
  let log = [];
  try{ log = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]'); }catch(e){}
  const texto = log.map(l=>`${l.t}  ${l.msg}`).join('\n') || '(log vazio)';
  try{
    await navigator.clipboard.writeText(texto);
    toast('Log copiado — cola numa mensagem pra mim');
  }catch(e){
    // fallback pra navegadores sem permissão de clipboard
    prompt('Copia manualmente o texto abaixo:', texto);
  }
});

