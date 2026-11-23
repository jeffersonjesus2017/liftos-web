// --------- personalizar refeição ----------
let _customItens = []; // [{fid, grams}]
let _customMealId = null;
let _customSelectedFood = null; // alimento selecionado na busca, aguardando quantidade/unidades antes de adicionar

function abrirPersonalizar(mealId){
  const meal = state.planoAlimentar.find(m=>m.id===mealId);
  if(!meal) return;
  _customMealId = mealId;
  // começa com os itens da opção selecionada
  const sel = state._selectedOpt?.[mealId] ?? 0;
  const opt = meal.opcoes[sel];
  _customItens = opt.itens.map(it=>({fid:it.fid, grams:it.g}));
  _customSelectedFood = null;
  // Configurar o modal ANTES de renderizar o conteúdo (pra não sobrescrever)
  document.getElementById('modal-title').textContent = `Personalizar ${meal.nome}`;
  document.getElementById('modal-msg').className = 'msg';
  document.getElementById('modal-input-wrap').hidden = true;
  document.getElementById('modal-ok').textContent = 'Salvar como feita';
  document.getElementById('modal-cancel').textContent = 'Cancelar';
  renderCustomModal();
  document.getElementById('modal-backdrop').classList.add('show');
  // override temporário do resolve
  _modalResolve = (resultado)=>{
    _modalResolve = null;
    if(resultado === true) salvarPersonalizado();
    else { _customItens = []; _customMealId = null; _customSelectedFood = null; }
  };
}

function renderCustomModal(){
  const container = document.getElementById('modal-msg');
  const foods = allFoods();
  const findFood = fid => foods.find(f=>f.id===fid);
  let tot = {kc:0,p:0,c:0,g:0};
  const itensHtml = _customItens.map((it,i)=>{
    const f = findFood(it.fid);
    if(!f) return '';
    const fac = it.grams/100;
    const ikc = f.kc*fac;
    tot.kc += ikc; tot.p += f.p*fac; tot.c += f.c*fac; tot.g += f.g*fac;
    return `
      <div class="custom-item">
        <div class="info">
          <div class="nome">${esc(f.n)}</div>
          <div class="kc">${Math.round(ikc)} kcal</div>
        </div>
        <input type="number" value="${it.grams}" step="1" min="1" data-custom-i="${i}">
        <button class="rm" data-custom-rm="${i}" title="Remover">×</button>
      </div>
    `;
  }).join('');
  container.innerHTML = `
    <div style="font-size:12px;color:var(--ink-dim);margin-bottom:6px">Edite as quantidades (g ou ml), remova ou adicione itens:</div>
    <div class="custom-meal">${itensHtml}</div>
    <div class="custom-add">
      <input type="text" id="custom-busca" placeholder="buscar alimento..." autocomplete="off" value="${esc(_customSelectedFood ? _customSelectedFood.n : '')}">
      <input type="number" id="custom-qty" value="100" min="1" step="1" placeholder="g/ml">
      <button type="button" id="custom-btn-add" class="rm" style="color:var(--good, #3a8f5a);font-size:20px" title="Adicionar">+</button>
      <div class="custom-results" id="custom-results" hidden></div>
    </div>
    <div id="custom-unidade-wrap" hidden style="margin-top:6px;gap:6px;align-items:center">
      <label style="font-size:11px;color:var(--ink-mute)">Ou quantas unidades?</label>
      <input type="number" id="custom-unidades" min="0" step="0.5" placeholder="ex: 2" style="width:70px;font-size:12px;padding:5px 6px;text-align:center">
    </div>
    <div id="custom-selected-info" style="font-size:11px;color:var(--ink-mute);margin-top:4px">${_customSelectedFood ? `Por 100${medidaAlimento(_customSelectedFood)}: ${_customSelectedFood.kc} kcal · ${_customSelectedFood.p}g P · ${_customSelectedFood.c}g C · ${_customSelectedFood.g}g G${_customSelectedFood.un ? ` · 1 unidade ≈ ${_customSelectedFood.un}${medidaAlimento(_customSelectedFood)}` : ''}` : ''}</div>
    <div class="custom-total">
      <span>TOTAL</span>
      <span>${Math.round(tot.kc)} kcal · ${Math.round(tot.p)}P ${Math.round(tot.c)}C ${Math.round(tot.g)}G</span>
    </div>
  `;
  if(_customSelectedFood && _customSelectedFood.un){
    const unWrap = document.getElementById('custom-unidade-wrap');
    unWrap.hidden = false;
    unWrap.style.display = 'flex';
  }
  // bindings
  container.querySelectorAll('[data-custom-i]').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const i = +e.target.dataset.customI;
      _customItens[i].grams = Math.max(1, Number(e.target.value)||0);
      renderCustomModal();
    });
  });
  container.querySelectorAll('[data-custom-rm]').forEach(b=>{
    b.addEventListener('click', ()=>{
      _customItens.splice(+b.dataset.customRm, 1);
      renderCustomModal();
    });
  });
  const busca = document.getElementById('custom-busca');
  const results = document.getElementById('custom-results');
  busca.addEventListener('input', ()=>{
    _customSelectedFood = null; // digitar de novo invalida a seleção anterior
    const q = busca.value.trim();
    if(q.length < 2){ results.hidden = true; return; }
    const matches = buscarAlimentos(q, 8);
    if(!matches.length){ results.hidden = true; return; }
    results.innerHTML = matches.map(f=>`<button data-fid="${f.id}">${esc(f.n)} — ${f.kc}kcal/100g</button>`).join('');
    results.hidden = false;
    results.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        _customSelectedFood = allFoods().find(f=>f.id===b.dataset.fid);
        results.hidden = true;
        renderCustomModal();
      });
    });
  });
  // mesma lógica do "adicionar alimento avulso": se o alimento tem peso por unidade
  // (ovo, pão, etc.), digitar "2" preenche as gramas sozinho
  const unidadesInput = document.getElementById('custom-unidades');
  if(unidadesInput){
    unidadesInput.addEventListener('input', e=>{
      if(!_customSelectedFood || !_customSelectedFood.un) return;
      const unidades = Number(e.target.value);
      if(!unidades || unidades<=0) return;
      document.getElementById('custom-qty').value = Math.round(unidades * _customSelectedFood.un);
    });
  }
  const btnAdd = document.getElementById('custom-btn-add');
  if(btnAdd){
    btnAdd.addEventListener('click', ()=>{
      if(!_customSelectedFood){ toast('Busque e selecione um alimento primeiro'); return; }
      const qty = Number(document.getElementById('custom-qty').value) || 100;
      _customItens.push({fid: _customSelectedFood.id, grams: qty});
      _customSelectedFood = null;
      renderCustomModal();
    });
  }
}

function salvarPersonalizado(){
  if(!_customMealId || !_customItens.length){
    _customMealId = null; _customItens = [];
    return;
  }
  const meal = state.planoAlimentar.find(m=>m.id===_customMealId);
  const foods = allFoods();
  const findFood = fid => foods.find(f=>f.id===fid);
  const k = todayKey();
  state.refeicoes[k] = state.refeicoes[k]||[];
  const existentes = state.refeicoes[k].filter(r=>r.refId===meal.id);
  const grupo = existentes.length>0 ? Math.max(...existentes.map(r=>r._mealGroup||1)) + 1 : 1;
  const horaAgora = new Date().toISOString();
  _customItens.forEach(it=>{
    const f = findFood(it.fid);
    if(!f) return;
    const factor = it.grams/100;
    state.refeicoes[k].push({
      foodId: f.id, nome: f.n, grams: it.grams,
      kcal: f.kc*factor, p: f.p*factor, c: f.c*factor, g: f.g*factor,
      hora: horaAgora,
      ref: meal.nome,
      refId: meal.id,
      _mealGroup: grupo,
      opcaoNome: 'Personalizada'
    });
  });
  saveState();
  renderDieta();
  toast(meal.nome + ' personalizada ✓');
  _customMealId = null; _customItens = [];
}

function renderPlano(){
  const el = document.getElementById('plano-meals');
  const foods = allFoods();
  const findFood = fid => foods.find(f=>f.id===fid);
  state._selectedOpt = state._selectedOpt || {};
  const counts = countRefHoje();
  // hora atual em minutos desde meia-noite pra comparar com horaSugerida
  const now = new Date();
  const horaAtualMin = now.getHours()*60 + now.getMinutes();
  el.innerHTML = state.planoAlimentar.map(meal=>{
    const sel = state._selectedOpt[meal.id] ?? 0;
    const opt = meal.opcoes[sel];
    const info = counts[meal.id];
    const doneClass = info ? 'done' : '';
    const badge = info ? `<span class="meal-badge">feita${info.n>1?` ×${info.n}`:''}</span>` : '';
    // chip de horário sugerido
    let horaChip = '';
    if(meal.horaSugerida){
      let horaExibida = meal.horaSugerida;
      let horaCls = '';
      let horaIcon = '🕒';
      if(info){
        // já feita — mostra hora real
        horaIcon = '✓';
        horaCls = 'feito';
        if(info.hora){
          const h = new Date(info.hora);
          horaExibida = String(h.getHours()).padStart(2,'0')+':'+String(h.getMinutes()).padStart(2,'0');
        }
      } else {
        const [hh, mm] = meal.horaSugerida.split(':').map(Number);
        const sugMin = hh*60 + mm;
        const diff = horaAtualMin - sugMin;
        if(diff > 90) { horaCls = 'atrasado'; horaIcon = '⚠'; }
        else if(diff > -60 && diff <= 90) { horaCls = 'proximo'; horaIcon = '⏰'; }
      }
      horaChip = `<span class="meal-hora ${horaCls}">${horaIcon} ${horaExibida}</span>`;
    }
    // calcular totais da opção selecionada
    let kc=0,p=0,c=0,g=0;
    const itensHtml = opt.itens.map(it=>{
      const f = findFood(it.fid);
      if(!f) return `<div class="item"><span>⚠ ${it.fid} não encontrado</span><span class="kc">—</span></div>`;
      const factor = it.g/100;
      const ikc = f.kc*factor, ip = f.p*factor, ic = f.c*factor, ig = f.g*factor;
      kc+=ikc; p+=ip; c+=ic; g+=ig;
      const qty = f.un ? `${Math.round(it.g/f.un)} un` : `${it.g}${medidaAlimento(f)}`;
      return `<div class="item"><span>${qty} ${esc(f.n)}</span><span class="kc">${Math.round(ikc)} kcal</span></div>`;
    }).join('');
    const btnLabel = info ? 'Adicionar novamente' : 'Adicionar ao diário';
    return `
      <div class="meal ${doneClass}">
        <div class="meal-head">
          <span class="meal-nome">${esc(meal.nome)}${horaChip}${badge}</span>
          <span class="meal-stats">${Math.round(kc)} kcal · ${Math.round(p)}P ${Math.round(c)}C ${Math.round(g)}G</span>
        </div>
        <div class="meal-opts">
          ${meal.opcoes.map((o,oi)=>`<button class="opt-chip" aria-pressed="${oi===sel}" data-m="${meal.id}" data-oi="${oi}">${esc(o.nome)}</button>`).join('')}
        </div>
        <div class="meal-items">${itensHtml}</div>
        <div style="display:flex;gap:6px">
          <button class="primary" data-add-meal="${meal.id}" style="flex:1">${btnLabel}</button>
          <button class="secondary" data-custom-meal="${meal.id}" title="Personalizar itens e quantidades" style="padding:12px 14px">✎</button>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.opt-chip').forEach(b=>{
    b.addEventListener('click', ()=>{
      state._selectedOpt[b.dataset.m] = +b.dataset.oi;
      renderPlano();
    });
  });
  el.querySelectorAll('[data-add-meal]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const meal = state.planoAlimentar.find(m=>m.id===b.dataset.addMeal);
      const sel = state._selectedOpt[meal.id] ?? 0;
      const opt = meal.opcoes[sel];
      const k = todayKey();
      state.refeicoes[k] = state.refeicoes[k]||[];
      // conta quantas vezes essa refeição já foi registrada hoje (pra marcar o grupo)
      const existentes = state.refeicoes[k].filter(r=>r.refId===meal.id);
      const grupo = existentes.length>0 ? Math.max(...existentes.map(r=>r._mealGroup||1)) + 1 : 1;
      const horaAgora = new Date().toISOString();
      opt.itens.forEach(it=>{
        const f = findFood(it.fid);
        if(!f) return;
        const factor = it.g/100;
        state.refeicoes[k].push({
          foodId:f.id, nome:f.n, grams:it.g,
          kcal:f.kc*factor, p:f.p*factor, c:f.c*factor, g:f.g*factor,
          hora: horaAgora,
          ref: meal.nome,
          refId: meal.id,
          _mealGroup: grupo,
          opcaoNome: opt.nome
        });
      });
      saveState();
      renderDieta();
      toast(meal.nome+' adicionada ✓');
    });
  });
  el.querySelectorAll('[data-custom-meal]').forEach(b=>{
    b.addEventListener('click', ()=>abrirPersonalizar(b.dataset.customMeal));
  });
}

function renderResumoKcalDieta(){
  const el = document.getElementById('dieta-resumo');
  if(!el) return;
  const r = calcPerfil();
  const t = todayFoodTotals();
  const falta = Math.max(0, r.meta - Math.round(t.kcal));
  const pct = Math.min(100, Math.round(t.kcal/r.meta*100));
  const bateu = t.kcal >= r.meta * 0.95; // dentro de 95% já conta
  const passou = t.kcal > r.meta * 1.15; // mais de 15% acima
  let cls = 'warn', msg = `Faltam ${falta} kcal para a meta`;
  if(bateu && !passou){ cls = 'ok'; msg = '✓ Meta alcançada'; }
  else if(passou){ cls = 'warn'; msg = `+${Math.round(t.kcal - r.meta)} kcal acima da meta`; }
  el.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <div>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:0.02em;color:var(--ink)">${Math.round(t.kcal)}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-mute)"> / ${r.meta} kcal</span>
        </div>
        <span class="pill ${cls}">${msg}</span>
      </div>
      <div style="height:6px;background:var(--surface);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${passou?'var(--crit)':'var(--accent)'};transition:width .3s"></div>
      </div>
    </div>
  `;
}

function renderDieta(){
  renderResumoKcalDieta();
  renderMicrosDieta();
  renderProgress();
  renderPlano();
  const k = todayKey();
  const list = state.refeicoes[k]||[];
  const el = document.getElementById('refeicoes-list');
  if(!list.length){
    el.innerHTML = '<div class="empty">Nenhum alimento registrado hoje</div>';
    return;
  }

  // agrupa: refeições do plano por refId+_mealGroup, avulsos num bloco só
  const groups = []; // {tipo:'meal'|'avulso', refId, nome, opcao, hora, grupo, items:[{r, idx}]}
  const grupMap = {};
  list.forEach((r,idx)=>{
    if(r.refId){
      const key = `${r.refId}#${r._mealGroup||1}`;
      if(!grupMap[key]){
        const g = {tipo:'meal', refId:r.refId, nome:r.ref, opcao:r.opcaoNome, hora:r.hora, grupo:r._mealGroup||1, items:[]};
        grupMap[key] = g;
        groups.push(g);
      }
      grupMap[key].items.push({r, idx});
    } else {
      // avulso: um grupo só por dia
      if(!grupMap['_avulso']){
        const g = {tipo:'avulso', nome:'Avulso', items:[]};
        grupMap['_avulso'] = g;
        groups.push(g);
      }
      grupMap['_avulso'].items.push({r, idx});
    }
  });
  // ordena por hora (meal pelo horário de fechamento, avulso vai sempre no fim)
  groups.sort((a,b)=>{
    if(a.tipo==='avulso') return 1;
    if(b.tipo==='avulso') return -1;
    return a.hora.localeCompare(b.hora);
  });

  el.innerHTML = groups.map(g=>{
    const tot = g.items.reduce((acc,{r})=>{
      acc.kc+=r.kcal; acc.p+=r.p; acc.c+=r.c; acc.g+=r.g; return acc;
    },{kc:0,p:0,c:0,g:0});
    const horaStr = g.hora ? new Date(g.hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    const titulo = g.tipo==='meal'
      ? `${esc(g.nome)}${g.grupo>1?` (${g.grupo}ª vez)`:''}${g.opcao?` · ${esc(g.opcao)}`:''}`
      : g.nome;
    const itensHtml = g.items.map(({r,idx})=>{
      const horaItem = g.tipo==='avulso'
        ? `<span class="kc">${new Date(r.hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>`
        : '';
      return `
        <div class="dg-item">
          <span class="nome">${Math.round(r.grams)}${medidaAlimento(r.foodId ? allFoods().find(x=>x.id===r.foodId) : null)} ${esc(r.nome)}</span>
          ${horaItem}
          <span class="kc">${Math.round(r.kcal)} kcal</span>
          <button class="rm" data-rm="${idx}" title="Remover">×</button>
        </div>
      `;
    }).join('');
    return `
      <div class="diary-group ${g.tipo==='meal'?'meal-block':'avulso'}">
        <div class="dg-head">
          <span class="dg-nome">${titulo}</span>
          ${horaStr?`<span class="dg-hora">${horaStr}</span>`:''}
        </div>
        <div class="dg-items">${itensHtml}</div>
        <div class="dg-foot">
          <span class="tot">${Math.round(tot.kc)} kcal</span>
          <span class="mac">${Math.round(tot.p)}P · ${Math.round(tot.c)}C · ${Math.round(tot.g)}G</span>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('[data-rm]').forEach(b=>{
    b.addEventListener('click', ()=>{
      list.splice(+b.dataset.rm,1);
      saveState(); renderDieta();
    });
  });
}

