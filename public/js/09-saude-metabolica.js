// --------- card integrado de saúde metabólica ----------
function renderSaudeMetabolica(aval){
  const sexo = state.perfil.sexo || 'm';
  const vshape = calcVShape(aval);
  const rcq = calcRCQ(aval);
  // IMC e %G mais recentes (pode vir de outra avaliação se esta não tem peso)
  const avalList = [...state.avaliacoes].sort((a,b)=>a.data.localeCompare(b.data));
  const ultComPeso = [...avalList].reverse().find(a=>a.peso);
  const ultComPctG = [...avalList].reverse().find(a=>a.pctG!=='' && a.pctG!==undefined && a.pctG!==null);
  const peso = ultComPeso ? ultComPeso.peso : state.perfil.peso;
  const altM = state.perfil.altura / 100;
  const imc = peso && altM ? +(peso / (altM*altM)).toFixed(1) : null;
  const pctG = ultComPctG ? +ultComPctG.pctG : null;

  if(!vshape && !rcq && !imc) return '';

  let items = [];

  // V-Shape
  if(vshape){
    const vc = classificaVShape(vshape);
    items.push(`<div class="saude-item">
      <div class="saude-lbl">V-Shape</div>
      <div class="saude-val">${vshape}</div>
      <div class="saude-ref" style="color:${vc.c}">${vc.t} · ref: 1,618</div>
    </div>`);
  }

  // RCQ
  if(rcq){
    const rc = classificaRCQ(rcq, sexo);
    items.push(`<div class="saude-item">
      <div class="saude-lbl">RCQ (cintura/quadril)</div>
      <div class="saude-val">${rcq}</div>
      <div class="saude-ref" style="color:${rc.c}">${rc.t} · ref ${sexo==='m'?'♂ <0,90':'♀ <0,80'}</div>
    </div>`);
  }

  // IMC contextualizado
  if(imc){
    const cat = imcCategoria(imc);
    const ctx = imcContexto(imc, pctG, sexo);
    const nota = ctx ? `<div class="saude-nota ${ctx.cls}">${ctx.txt}</div>` : '';
    items.push(`<div class="saude-item">
      <div class="saude-lbl">IMC</div>
      <div class="saude-val">${imc}</div>
      <div class="saude-ref" style="color:var(--${cat.c})">${cat.t}</div>
      ${nota}
    </div>`);
  }

  // Cintura isolada (risco cardiovascular)
  if(aval.c_cintura){
    const limCint = sexo === 'm' ? 94 : 80;
    const limAlto = sexo === 'm' ? 102 : 88;
    let cintCls, cintTxt;
    if(aval.c_cintura < limCint){ cintCls = 'ok'; cintTxt = 'Baixo risco'; }
    else if(aval.c_cintura < limAlto){ cintCls = 'warn'; cintTxt = 'Risco moderado'; }
    else { cintCls = 'crit'; cintTxt = 'Risco elevado'; }
    items.push(`<div class="saude-item">
      <div class="saude-lbl">Cintura</div>
      <div class="saude-val">${aval.c_cintura} cm</div>
      <div class="saude-ref" style="color:var(--${cintCls})">${cintTxt} · ref ${sexo==='m'?'♂ <94':'♀ <80'} cm</div>
    </div>`);
  }

  return `
    <div style="margin-top:14px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-mute);font-weight:700">Saúde metabólica</div>
    <div class="saude-card">${items.join('')}</div>
  `;
}
function renderFotosRow(aval){
  if(!aval.fotos || Object.keys(aval.fotos).length === 0) return '';
  const posicoes = ['frente','costas','lateral'];
  return `
    <div style="margin-top:14px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-mute);font-weight:700">Fotos</div>
    <div class="photos-row">
      ${posicoes.map(p=>{
        const src = aval.fotos[p];
        if(!src) return `<div style="aspect-ratio:3/4;border:1px dashed var(--line);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--ink-mute);text-transform:uppercase">${p}</div>`;
        return `<div class="ph" data-src="${src}"><img src="${src}" alt="${p}"><div class="pos">${p}</div></div>`;
      }).join('')}
    </div>
  `;
}

function renderHistCorpo(){
  // destaque
  const list = [...state.avaliacoes].sort((a,b)=>a.data.localeCompare(b.data));
  const el = document.getElementById('aval-destaque');
  if(!list.length){
    el.innerHTML = '<div class="empty">Nenhuma avaliação registrada ainda. Preencha o formulário abaixo com os dados da próxima consulta (peso, %G, cintura e quadril).</div>' + renderSaudeMetabolica({});
  } else {
    const ult = list[list.length-1];
    const ant = list.length>1 ? list[list.length-2] : null;
    // helper: encontra a PRIMEIRA avaliação da MESMA FASE com aquela métrica
    // (base do ciclo atual — ignora avaliações de fases anteriores como cutting prévio)
    const faseAtual = ult.fase || null;
    // compara sempre com a avaliação IMEDIATAMENTE ANTERIOR da mesma fase (não a primeira
    // da fase) — o que importa no dia a dia é "o que mudou desde a última vez", não o
    // acumulado desde o início do ciclo (isso fica em "ver evolução desde o início").
    const valorAnterior = (k, idxAtual)=>{
      for(let i=idxAtual-1; i>=0; i--){
        // ignora avaliações de fase diferente da atual
        if(faseAtual && list[i].fase && list[i].fase !== faseAtual) continue;
        const v = list[i][k];
        if(v!==undefined && v!==null && v!=='' && !isNaN(v)) return {val:v, data:list[i].data};
      }
      return null;
    };
    const ultIdx = list.length - 1;
    const tile = (k)=>{
      const v = ult[k];
      if(v===undefined || v===null || v==='') return '';
      const m = METRICAS[k];
      const prev = valorAnterior(k, ultIdx);
      let deltaHtml = '';
      if(prev){
        const d = v - prev.val;
        const dAbs = Math.abs(d);
        if(dAbs < 0.05){
          deltaHtml = `<span class="delta flat" title="sem variação">◆ ${dAbs.toFixed(1)}</span>`;
        } else {
          const arrow = d>0?'▲':'▼';
          let cls='flat';
          if(m.bom==='up') cls = d>0?'goal-ok':'goal-bad';
          else if(m.bom==='down') cls = d<0?'goal-ok':'goal-bad';
          else cls = d>0?'up':'down';
          const dataPrev = new Date(prev.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
          deltaHtml = `<span class="delta ${cls}" title="vs ${dataPrev} (${prev.val}${m.unit})">${arrow} ${dAbs.toFixed(1)}</span>`;
        }
      } else {
        deltaHtml = `<span class="delta flat" title="primeira medida">● novo</span>`;
      }
      // alerta de faixa
      let alerta = '';
      const faixa = faixaRef(k);
      if(faixa){
        if(v < faixa.min) alerta = `<div style="font-size:10px;color:var(--warn);margin-top:4px">⚠ ${faixa.alertaMin}</div>`;
        else if(v > faixa.max) alerta = `<div style="font-size:10px;color:var(--warn);margin-top:4px">⚠ ${faixa.alertaMax}</div>`;
      }
      return `<div class="tile">
        <div class="k">${m.lbl}</div>
        <div class="v">${v}<span class="u">${m.unit}</span></div>
        <div style="margin-top:4px">${deltaHtml}</div>
        ${alerta}
      </div>`;
    };
    // helper: gera o bloco de tiles, só renderiza o título se tiver pelo menos 1 tile
    const bloco = (titulo, keys)=>{
      const tiles = keys.map(tile).filter(s=>s!=='');
      if(tiles.length === 0) return '';
      return `
        <div style="margin-top:14px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-mute);font-weight:700">${titulo}</div>
        <div class="tiles" style="margin-top:6px">${tiles.join('')}</div>
      `;
    };
    const dataStr = new Date(ult.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
    // avaliação anterior (mesma fase) usada como referência dos deltas acima
    const antNaFase = ant; // já é a imediatamente anterior na lista geral; os tiles filtram por fase internamente
    const refDate = antNaFase
      ? `vs ${new Date(antNaFase.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} (anterior)`
      : 'primeira avaliação';
    const faseLabel = faseAtual ? ` · ${faseAtual.toUpperCase()}` : '';
    const resumoFaseHtml = renderResumoFase();
    el.innerHTML = `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">
        ${dataStr}${faseLabel} · ${refDate}
      </div>
      ${bloco('Composição', ['peso','mm','mg','pctG'])}
      ${bloco('Dobras cutâneas', ['d_soma','d_peitoral','d_triceps','d_abdom','d_coxa','d_axilar','d_subesc','d_supra'])}
      ${bloco('Circunferências', ['c_braco','c_peito','c_cintura','c_quadril','c_coxa','c_pant'])}
      ${renderSaudeMetabolica(ult)}
      ${renderFotosRow(ult)}
      ${ult.obs?`<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--ink-dim)"><strong>Obs:</strong> ${esc(ult.obs)}</div>`:''}
      ${resumoFaseHtml ? `
        <button class="ac-ver-mais" id="btn-ver-evolucao-fase" style="margin-top:14px">${_verEvolucaoFase?'Ver menos ▲':'Ver evolução desde o início da fase ▼'}</button>
        <div id="evolucao-fase-wrap" style="display:${_verEvolucaoFase?'block':'none'};margin-top:10px">${resumoFaseHtml}</div>
      ` : ''}
    `;
    const btnEvFase = document.getElementById('btn-ver-evolucao-fase');
    if(btnEvFase) btnEvFase.addEventListener('click', ()=>{
      _verEvolucaoFase = !_verEvolucaoFase;
      renderHistCorpo();
    });
    // bind clique nas fotos
    el.querySelectorAll('.photos-row .ph').forEach(ph=>{
      ph.onclick = ()=>abrirFoto(ph.dataset.src);
    });
  }

  drawChartCorpo();
  renderCompararFotos();
  renderTabelaAval();

  // set data default = hoje
  document.getElementById('av-data').value = todayKey();
}

