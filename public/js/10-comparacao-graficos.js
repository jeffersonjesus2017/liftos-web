// --------- comparação de fotos ----------
let _compareLeft = null, _compareRight = null; // datas selecionadas
function renderCompararFotos(){
  const el = document.getElementById('compare-fotos');
  if(!el) return;
  const comFotos = state.avaliacoes
    .filter(a=>a.fotos && Object.keys(a.fotos).length > 0)
    .sort((a,b)=>a.data.localeCompare(b.data));
  if(comFotos.length === 0){
    el.innerHTML = '<div class="empty">Adicione fotos em avaliações para comparar aqui</div>';
    return;
  }
  // defaults: primeira à esquerda, última à direita
  if(!_compareLeft || !comFotos.some(a=>a.data===_compareLeft)) _compareLeft = comFotos[0].data;
  if(!_compareRight || !comFotos.some(a=>a.data===_compareRight)) _compareRight = comFotos[comFotos.length-1].data;

  const options = comFotos.map(a=>{
    const dt = new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'});
    return {data:a.data, label:dt};
  });

  const makeSelect = (id, selected)=>`
    <select id="${id}">
      ${options.map(o=>`<option value="${o.data}" ${o.data===selected?'selected':''}>${o.label}</option>`).join('')}
    </select>
  `;

  const avalLeft = comFotos.find(a=>a.data===_compareLeft);
  const avalRight = comFotos.find(a=>a.data===_compareRight);
  const posicoes = ['frente','costas','lateral'];
  const col = (aval)=>{
    const dt = new Date(aval.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'});
    const stats = [];
    if(aval.peso) stats.push(`${aval.peso}kg`);
    if(aval.pctG) stats.push(`${aval.pctG}%G`);
    const statsStr = stats.length ? ' · ' + stats.join(' · ') : '';
    return `
      <div class="compare-col">
        <div class="data-lbl">${dt}${statsStr}</div>
        <div class="fotos">
          ${posicoes.map(p=>{
            const src = aval.fotos && aval.fotos[p];
            if(src) return `<div class="ph" data-src="${src}"><img src="${src}" alt="${p}"><div class="pos">${p}</div></div>`;
            return `<div class="ph vazio">sem ${p}</div>`;
          }).join('')}
        </div>
      </div>
    `;
  };

  el.innerHTML = `
    <div class="compare-selects">
      ${makeSelect('compare-left', _compareLeft)}
      ${makeSelect('compare-right', _compareRight)}
    </div>
    <div class="compare-wrap">
      ${col(avalLeft)}
      ${col(avalRight)}
    </div>
  `;

  document.getElementById('compare-left').addEventListener('change', e=>{
    _compareLeft = e.target.value; renderCompararFotos();
  });
  document.getElementById('compare-right').addEventListener('change', e=>{
    _compareRight = e.target.value; renderCompararFotos();
  });
  el.querySelectorAll('.compare-wrap .ph[data-src]').forEach(ph=>{
    ph.onclick = ()=>abrirFoto(ph.dataset.src);
  });
}

function drawChartCorpo(){
  const svg = document.getElementById('chart-corpo');
  const key = document.getElementById('met-select').value;
  // trata V-shape como derivada
  let list;
  if(key === '_vshape'){
    list = [...state.avaliacoes]
      .map(a=>({...a, _vshape: calcVShape(a)}))
      .filter(a=>a._vshape!==null)
      .sort((a,b)=>a.data.localeCompare(b.data));
  } else if(key === '_rcq'){
    list = [...state.avaliacoes]
      .map(a=>({...a, _rcq: calcRCQ(a)}))
      .filter(a=>a._rcq!==null)
      .sort((a,b)=>a.data.localeCompare(b.data));
  } else {
    list = [...state.avaliacoes].filter(a=>a[key]!==undefined && a[key]!=='').sort((a,b)=>a.data.localeCompare(b.data));
  }
  if(list.length<2){ svg.innerHTML = `<text x="300" y="110" text-anchor="middle" fill="var(--ink-mute)">Precisa de ao menos 2 avaliações</text>`; return; }
  const W=600,H=220,pad=36;
  const vals = list.map(a=>Number(a[key]));
  const maxV = Math.max(...vals), minV = Math.min(...vals);
  const range = Math.max(0.5, maxV-minV);
  const yMax = maxV + range*0.15, yMin = Math.max(0, minV - range*0.15);
  const x = i => pad + (i/Math.max(1,list.length-1))*(W-pad*2);
  const y = v => H-pad - ((v-yMin)/(yMax-yMin))*(H-pad*2);
  const grid=[];
  for(let i=0;i<=4;i++){
    const v = yMin + (yMax-yMin)*(i/4);
    const yy = y(v);
    grid.push(`<line class="grid" x1="${pad}" y1="${yy}" x2="${W-pad}" y2="${yy}"/>`);
    grid.push(`<text x="${pad-6}" y="${yy+3}" text-anchor="end">${v.toFixed(1)}</text>`);
  }
  const path = 'M '+list.map((a,i)=>`${x(i)} ${y(Number(a[key]))}`).join(' L ');
  const dots = list.map((a,i)=>`<circle class="dot" cx="${x(i)}" cy="${y(Number(a[key]))}" r="3.5"/>`).join('');
  const xLabels = list.map((a,i)=>{
    if(list.length>8 && i%2!==0 && i!==list.length-1) return '';
    const d = new Date(a.data+'T12:00:00');
    return `<text x="${x(i)}" y="${H-pad+14}" text-anchor="middle">${d.getDate()}/${d.getMonth()+1}</text>`;
  }).join('');
  svg.innerHTML = `
    ${grid.join('')}
    <line class="axis" x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}"/>
    <path class="line" d="${path}"/>
    ${dots}
    ${xLabels}
  `;
}

function renderResumoFase(){
  // resumo da fase atual: primeira vs última, dias em curso, variações principais
  const list = [...state.avaliacoes].sort((a,b)=>a.data.localeCompare(b.data));
  if(list.length < 2) return '';
  const ult = list[list.length-1];
  const faseAtual = ult.fase || 'bulk';
  const mesmasFase = list.filter(a=>a.fase === faseAtual);
  if(mesmasFase.length < 2) return '';
  const primeira = mesmasFase[0];
  const dias = Math.floor((new Date(ult.data) - new Date(primeira.data)) / (1000*60*60*24));
  // KPI helper
  const kpi = (lbl, k, unit, bomUp = true)=>{
    const vPrim = primeira[k], vUlt = ult[k];
    // busca último valor da mesma fase que tenha a métrica, pra garantir que pega
    let vUltReal = vUlt;
    let dataUltReal = ult.data;
    if(vUltReal===undefined || vUltReal==='' || vUltReal===null){
      for(let i=mesmasFase.length-1; i>=0; i--){
        const v = mesmasFase[i][k];
        if(v!==undefined && v!=='' && v!==null && !isNaN(v)){
          vUltReal = v; dataUltReal = mesmasFase[i].data; break;
        }
      }
    }
    if(vPrim===undefined || vPrim==='' || vPrim===null || vUltReal===undefined || vUltReal==='' || vUltReal===null){
      return `<div class="kpi"><div class="k">${lbl}</div><div class="v">—</div></div>`;
    }
    const diff = +(vUltReal - vPrim).toFixed(2);
    const pct = vPrim !== 0 ? +(diff/vPrim*100).toFixed(1) : 0;
    const sgn = diff >= 0 ? '+' : '';
    const bom = Math.abs(diff) < 0.05 ? 'neutral' : (bomUp ? (diff>0?'good':'bad') : (diff<0?'good':'bad'));
    return `<div class="kpi">
      <div class="k">${lbl}</div>
      <div class="v ${bom}">${sgn}${diff}${unit}</div>
      <div class="pct">${sgn}${pct}% em ${dias}d</div>
    </div>`;
  };
  const faseLabels = {bulk:'Bulk', cutting:'Cutting', manutencao:'Manutenção', transicao:'Transição'};
  const primeiraStr = new Date(primeira.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  const ultStr = new Date(ult.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  return `
    <div class="fase-resumo">
      <div class="titulo">${(faseLabels[faseAtual]||faseAtual).toUpperCase()} em curso</div>
      <div class="subt">${primeiraStr} → ${ultStr} · ${dias} dias · ${mesmasFase.length} avaliações</div>
      <div class="kpis">
        ${kpi('Peso', 'peso', 'kg', faseAtual==='bulk')}
        ${kpi('Massa magra', 'mm', 'kg', true)}
        ${kpi('Massa gorda', 'mg', 'kg', false)}
        ${kpi('% Gordura', 'pctG', '%', false)}
      </div>
    </div>
  `;
}

// conjunto de cards já expandidos (sobrevive a re-render, some ao trocar de view)
const _avalExpandido = new Set();
// se o bloco "evolução desde o início da fase" está aberto no destaque do topo
let _verEvolucaoFase = false;

function renderTabelaAval(){
  const tab = document.getElementById('tab-aval');
  const list = [...state.avaliacoes].sort((a,b)=>b.data.localeCompare(a.data));
  if(!list.length){ tab.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--ink-mute);font-style:italic">Nenhuma avaliação ainda</div>'; return; }

  // resumo direto: o que você olha todo dia
  const colsResumo = ['peso','mm','mg','pctG']; // peso, massa magra, massa gorda e % de gordura
  // detalhes: só quando pedir pra ver
  const colsDetalhe = ['c_braco','c_peito','c_cintura','c_quadril','c_coxa','c_pant']; // circunferências

  // helper: encontra anterior da MESMA fase pra uma métrica específica
  // list está desc (recente primeiro), então "anterior" = índice maior
  const anteriorNaFase = (aval, idxDesc, k)=>{
    const fase = aval.fase;
    for(let i=idxDesc+1; i<list.length; i++){
      if(fase && list[i].fase !== fase) continue;
      const v = list[i][k];
      if(v!==undefined && v!==null && v!=='' && !isNaN(v)) return v;
    }
    return null;
  };

  const celulaComVariacao = (a, idxDesc, k)=>{
    const v = a[k];
    const m = METRICAS[k];
    if(v===undefined || v===null || v===''){ return ''; } // campo vazio não aparece
    const prev = anteriorNaFase(a, idxDesc, k);
    let pctHtml = '';
    if(prev !== null && prev !== 0){
      const diff = +(v - prev).toFixed(2);
      if(Math.abs(diff) < 0.05){
        pctHtml = `<span class="pct neutral">◆ 0 ${m.unit}</span>`;
      } else {
        const arrow = diff>0?'▲':'▼';
        let cls='neutral';
        if(m.bom==='up') cls = diff>0?'good':'bad';
        else if(m.bom==='down') cls = diff<0?'good':'bad';
        const sgn = diff>0?'+':'';
        pctHtml = `<span class="pct ${cls}">${arrow} ${sgn}${diff}${m.unit}</span>`;
      }
    }
    return `<div class="cell"><span class="lbl">${m.lbl}</span><span class="val">${v} ${m.unit}</span>${pctHtml}</div>`;
  };

  tab.innerHTML = list.map((a,i)=>{
    const data = new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const faseBadge = a.fase ? `<span class="fase-badge ${a.fase}">${a.fase.slice(0,3)}</span>` : '';
    const expandido = _avalExpandido.has(a.data);
    const temDetalhe = colsDetalhe.some(k=>a[k]!==undefined && a[k]!=='' && a[k]!==null);
    return `
      <div class="aval-card${expandido?' expandido':''}" data-aval-card="${a.data}">
        <div class="ac-head">
          <div class="ac-data">${data}${faseBadge}</div>
          <div class="ac-actions">
            <button data-edit-aval="${a.data}" style="color:var(--accent)" title="Editar">✎</button>
            <button data-del-aval="${a.data}-${i}" style="color:var(--ink-mute)" title="Remover">×</button>
          </div>
        </div>
        <div class="ac-resumo">
          ${colsResumo.map(k=>celulaComVariacao(a,i,k)).join('')}
        </div>
        ${temDetalhe ? `
          <button class="ac-ver-mais" data-toggle-aval="${a.data}">${expandido?'Ver menos ▲':'Ver detalhes ▼'}</button>
          <div class="ac-detalhes">
            <div class="ac-detalhes-grid">
              ${colsDetalhe.map(k=>celulaComVariacao(a,i,k)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  tab.querySelectorAll('[data-toggle-aval]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const data = b.dataset.toggleAval;
      if(_avalExpandido.has(data)) _avalExpandido.delete(data);
      else _avalExpandido.add(data);
      renderTabelaAval();
    });
  });
  tab.querySelectorAll('[data-edit-aval]').forEach(b=>{
    b.addEventListener('click', ()=>iniciarEdicaoAval(b.dataset.editAval));
  });
  tab.querySelectorAll('[data-del-aval]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const okRem = await confirmar('Remover esta avaliação?', {okLabel:'Remover', warn:true});
      if(!okRem) return;
      // reconstrói chave composta (data pode ter -)
      const parts = b.dataset.delAval.split('-');
      const idx = parseInt(parts[parts.length-1]);
      // encontra pela posição na ordenação exibida
      const sorted = [...state.avaliacoes].sort((a,b)=>b.data.localeCompare(a.data));
      const alvo = sorted[idx];
      state.avaliacoes = state.avaliacoes.filter(a=>a!==alvo);
      saveState(); renderHistCorpo();
    });
  });
}

// Listener do select de métrica
document.getElementById('met-select').addEventListener('change', drawChartCorpo);

// Salvar avaliação
document.getElementById('btn-salvar-aval').addEventListener('click', async ()=>{
  const data = document.getElementById('av-data').value;
  if(!data){ toast('Informe a data'); return; }
  const num = id=>{
    const v = document.getElementById(id).value;
    return v==='' ? '' : Number(v);
  };
  const peso = num('av-peso');
  const mm = num('av-mm');
  const mg = num('av-mg');
  // o app só registra e mostra: nada é calculado aqui (os números vêm da avaliação profissional)
  const nova = {
    data, peso, mm, mg,
    pctG: num('av-pct'),
    c_braco: num('av-c-braco'),
    c_peito: num('av-c-peito'),
    c_cintura: num('av-c-cintura'),
    c_quadril: num('av-c-quadril'),
    c_coxa: num('av-c-coxa'),
    c_pant: num('av-c-pant'),
    fase: document.getElementById('av-fase').value,
    obs: document.getElementById('av-obs').value.trim()
  };
  if(peso==='' && mm==='' && mg==='' && nova.pctG==='' && nova.c_braco==='' && nova.c_cintura==='' && Object.keys(_tempFotos).length===0){
    toast('Preencha ao menos um campo'); return;
  }
  // fotos
  if(Object.keys(_tempFotos).length > 0){
    nova.fotos = {..._tempFotos};
  }

  // modo edição: atualiza avaliação com data original (mesmo se data mudou)
  if(_editingAvalDate){
    const idxEdit = state.avaliacoes.findIndex(a=>a.data===_editingAvalDate);
    if(idxEdit >= 0){
      // dobras já registradas (campos d_*) não têm mais tela de edição: preserva o que existe
      const antiga = state.avaliacoes[idxEdit];
      Object.keys(antiga).filter(k=>/^d_/.test(k)).forEach(k=>{ nova[k] = antiga[k]; });
      state.avaliacoes[idxEdit] = nova;
    }
    sairEdicao();
  } else {
    // criação: checar duplicata
    const idx = state.avaliacoes.findIndex(a=>a.data===data);
    if(idx>=0){
      const okSobre = await confirmar(`Já existe avaliação em ${data}. Sobrescrever?`, {okLabel:'Sobrescrever'});
      if(!okSobre) return;
      Object.keys(state.avaliacoes[idx]).filter(k=>/^d_/.test(k)).forEach(k=>{ nova[k] = state.avaliacoes[idx][k]; });
      state.avaliacoes[idx] = nova;
    } else {
      state.avaliacoes.push(nova);
    }
    limparFormAval();
    limparFotos();
  }

  // atualiza o peso do perfil APENAS se esta avaliação for a mais recente —
  // editar uma avaliação antiga (ex: apagar fotos de março) não deve
  // sobrescrever o peso atual do perfil.
  if(peso!==''){
    const maisRecente = [...state.avaliacoes]
      .filter(a=>a.peso)
      .sort((a,b)=>b.data.localeCompare(a.data))[0];
    if(maisRecente && maisRecente.data === data){
      state.perfil.peso = peso;
    }
  }
  saveState();
  fecharFormAval();
  toast('Avaliação salva ✓');
  renderHistCorpo();
});

document.getElementById('btn-limpar-aval').addEventListener('click', limparFormAval);
function limparFormAval(){
  const ids = [
    'av-peso','av-mm','av-mg','av-pct',
    'av-c-braco','av-c-peito','av-c-cintura','av-c-quadril','av-c-coxa','av-c-pant',
    'av-obs'
  ];
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  document.getElementById('av-data').value = todayKey();
  document.getElementById('av-fase').value = 'bulk';
}

