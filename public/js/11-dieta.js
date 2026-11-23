// --------- dieta ----------
function allFoods(){ return [...FOODS, ...state.alimentosCustom, ...TACO_FOODS]; }
// medida do alimento: 'ml' para líquidos (food.u === 'ml'), 'g' para o resto. Para o cálculo, 1 ml conta como 1 g.
function medidaAlimento(f){ return f && f.u === 'ml' ? 'ml' : 'g'; }

// Busca sem acento/maiúscula; começa-com vem antes de contém; curados/próprios antes da TACO (ordem estável)
function normBusca(t){ return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function buscarAlimentos(q, n){
  const nq = normBusca(q);
  return allFoods().map((f,i)=>({f,i,nn:normBusca(f.n)})).filter(x=>x.nn.includes(nq))
    .sort((a,b)=>(b.nn.startsWith(nq)-a.nn.startsWith(nq)) || (a.i-b.i)).slice(0,n).map(x=>x.f);
}

let selectedFood = null;
const searchInput = document.getElementById('food-search');
const resultsBox = document.getElementById('food-results');

searchInput.addEventListener('input', ()=>{
  const q = searchInput.value.trim();
  if(q.length<2){ resultsBox.hidden = true; return; }
  const matches = buscarAlimentos(q, 10);
  if(!matches.length){ resultsBox.hidden = true; return; }
  resultsBox.innerHTML = matches.map(f=>
    `<button data-fid="${f.id}">${esc(f.n)}<span class="kc">${f.kc} kcal</span></button>`
  ).join('');
  resultsBox.hidden = false;
  resultsBox.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      selectedFood = allFoods().find(f=>f.id===b.dataset.fid);
      searchInput.value = selectedFood.n;
      resultsBox.hidden = true;
      const unidadeWrap = document.getElementById('food-unidade-wrap');
      const unidadesInput = document.getElementById('food-unidades');
      const um = medidaAlimento(selectedFood);
      document.getElementById('food-qty-label').textContent = `Quantidade (${um})`;
      let info = `Por 100${um}: ${selectedFood.kc} kcal · ${selectedFood.p}g P · ${selectedFood.c}g C · ${selectedFood.g}g G`;
      if(selectedFood.un){
        info += ` · 1 unidade ≈ ${selectedFood.un}${um}`;
        unidadeWrap.hidden = false;
        unidadesInput.value = '';
      } else {
        unidadeWrap.hidden = true;
      }
      document.getElementById('food-selected').textContent = info;
    });
  });
});
document.addEventListener('click', e=>{
  if(!e.target.closest('.search-wrap')) resultsBox.hidden = true;
});

// quando a pessoa digita "quantas unidades" (ex: 2 ovos), converte pra gramas
// automaticamente no campo de quantidade — evita ter que pesar e calcular na mão.
document.getElementById('food-unidades').addEventListener('input', e=>{
  if(!selectedFood || !selectedFood.un) return;
  const unidades = Number(e.target.value);
  if(!unidades || unidades<=0) return;
  document.getElementById('food-qty').value = Math.round(unidades * selectedFood.un);
});

document.getElementById('btn-add-food').addEventListener('click', ()=>{
  if(!selectedFood){ toast('Selecione um alimento'); return; }
  const qty = Number(document.getElementById('food-qty').value)||0;
  if(qty<=0){ toast('Quantidade inválida'); return; }
  const f = selectedFood;
  const factor = qty/100;
  const r = {
    foodId:f.id, nome:f.n, grams:qty,
    kcal: f.kc*factor, p:f.p*factor, c:f.c*factor, g:f.g*factor,
    hora: new Date().toISOString()
  };
  const k = todayKey();
  state.refeicoes[k] = state.refeicoes[k]||[];
  state.refeicoes[k].push(r);
  saveState();
  selectedFood = null;
  searchInput.value = '';
  document.getElementById('food-selected').textContent = '';
  document.getElementById('food-qty').value = 100;
  document.getElementById('food-unidade-wrap').hidden = true;
  document.getElementById('food-unidades').value = '';
  renderDieta();
  toast('Adicionado ✓');
});

document.getElementById('btn-add-custom').addEventListener('click', ()=>{
  const nome = document.getElementById('cf-nome').value.trim();
  const porcao = Number(document.getElementById('cf-porcao').value)||100;
  const kcal = Number(document.getElementById('cf-kcal').value)||0;
  const p = Number(document.getElementById('cf-p').value)||0;
  const c = Number(document.getElementById('cf-c').value)||0;
  const g = Number(document.getElementById('cf-g').value)||0;
  const un = Number(document.getElementById('cf-un').value)||0;
  if(!nome || !kcal){ toast('Nome e kcal são obrigatórios'); return; }
  // normalizar para 100g
  const f = porcao/100;
  const novo = {
    id:'u'+Date.now(), n:nome,
    kc: Math.round(kcal/f), p:+(p/f).toFixed(1), c:+(c/f).toFixed(1), g:+(g/f).toFixed(1)
  };
  if(document.getElementById('cf-medida').value === 'ml') novo.u = 'ml'; // líquido: quantidades em ml
  if(un>0) novo.un = un; // peso de 1 unidade (g) — permite lançar "2 unidades" em vez de pesar
  // micros opcionais do rótulo (mesma porção dos demais valores), guardados por 100 g em novo.m
  const m = {};
  [['fib','cf-fib'],['na','cf-na']].forEach(([k,id])=>{
    const txt = document.getElementById(id).value.trim();
    if(txt !== '' && Number(txt) >= 0) m[k] = +(Number(txt)/f).toFixed(1);
  });
  if(Object.keys(m).length) novo.m = m;
  state.alimentosCustom.push(novo);
  saveState();
  const avisoBaixo = novo.kc < 15;
  ['cf-nome','cf-kcal','cf-p','cf-c','cf-g','cf-un','cf-fib','cf-na'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cf-porcao').value = 100;
  document.getElementById('cf-medida').value = 'g';
  toast(avisoBaixo ? `⚠ Salvo com só ${novo.kc} kcal/100 g — confira se a porção (g) está certa` : 'Alimento salvo ✓');
});

// --------- registrar alimento por foto (análise automática via IA) ----------
let _fotoItens = [];

function comprimirImagem(file, maxDim=1024, qualidade=0.75){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let {width, height} = img;
        if(width > maxDim || height > maxDim){
          if(width > height){ height = Math.round(height * maxDim/width); width = maxDim; }
          else { width = Math.round(width * maxDim/height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderFotoResultado(){
  const wrap = document.getElementById('foto-resultado');
  if(!wrap) return;
  if(!_fotoItens.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-mute);font-weight:700;margin:12px 0 8px">Itens identificados — revise antes de adicionar</div>
    ${_fotoItens.map((it,i)=>`
      <div class="foto-item">
        <button class="rm" data-foto-rm="${i}" title="Remover">×</button>
        <input type="text" value="${esc(it.nome)}" data-foto-field="nome" data-foto-i="${i}">
        <div class="macros-grid">
          <div><label>Gramas</label><input type="number" value="${Math.round(it.quantidade_g)}" min="0" step="1" data-foto-field="quantidade_g" data-foto-i="${i}"></div>
          <div><label>Kcal</label><input type="number" value="${Math.round(it.kcal)}" min="0" step="1" data-foto-field="kcal" data-foto-i="${i}"></div>
          <div><label>Prot.</label><input type="number" value="${Math.round(it.proteina_g)}" min="0" step="1" data-foto-field="proteina_g" data-foto-i="${i}"></div>
          <div><label>Carb.</label><input type="number" value="${Math.round(it.carboidrato_g)}" min="0" step="1" data-foto-field="carboidrato_g" data-foto-i="${i}"></div>
          <div><label>Gord.</label><input type="number" value="${Math.round(it.gordura_g)}" min="0" step="1" data-foto-field="gordura_g" data-foto-i="${i}"></div>
        </div>
      </div>
    `).join('')}
    <div style="margin-top:10px">
      <label style="margin-bottom:6px">Adicionar em:</label>
      <select id="foto-dest-meal" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);font:inherit;font-size:13px;margin-bottom:8px">
        ${(()=>{
          const c = countRefHoje();
          const prox = state.planoAlimentar.find(m=>!c[m.id]);
          return state.planoAlimentar.map(m =>
            `<option value="${m.id}"${m.id===(prox&&prox.id)?' selected':''}>${esc(m.nome)}${c[m.id]?' ✓':''}</option>`
          ).join('') + '<option value="_avulso">Avulso (sem refeição)</option>';
        })()}
      </select>
      <button class="primary" id="btn-foto-add-tudo" style="width:100%">Adicionar ${_fotoItens.length} ${_fotoItens.length===1?'item':'itens'} 📷</button>
    </div>
  `;
  wrap.querySelectorAll('[data-foto-field]').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const i = Number(e.target.dataset.fotoI);
      const field = e.target.dataset.fotoField;
      const it = _fotoItens[i];
      if(field==='nome'){
        it.nome = e.target.value;
      } else if(field==='quantidade_g' && it._kcalPorG !== undefined){
        // recalcula macros proporcionalmente ao alterar gramas
        const novaG = Number(e.target.value)||0;
        it.quantidade_g = novaG;
        it.kcal = Math.round(novaG * it._kcalPorG);
        it.proteina_g = Math.round(novaG * it._protPorG);
        it.carboidrato_g = Math.round(novaG * it._carbPorG);
        it.gordura_g = Math.round(novaG * it._gordPorG);
        // atualiza os campos visuais dos macros
        const row = e.target.closest('.foto-item');
        row.querySelector('[data-foto-field="kcal"]').value = it.kcal;
        row.querySelector('[data-foto-field="proteina_g"]').value = it.proteina_g;
        row.querySelector('[data-foto-field="carboidrato_g"]').value = it.carboidrato_g;
        row.querySelector('[data-foto-field="gordura_g"]').value = it.gordura_g;
      } else {
        it[field] = Number(e.target.value)||0;
      }
    });
  });
  wrap.querySelectorAll('[data-foto-rm]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const i = Number(e.currentTarget.dataset.fotoRm);
      _fotoItens.splice(i,1);
      renderFotoResultado();
    });
  });
  const btnAddTudo = document.getElementById('btn-foto-add-tudo');
  if(btnAddTudo){
    btnAddTudo.addEventListener('click', ()=>{
      const k = todayKey();
      state.refeicoes[k] = state.refeicoes[k]||[];
      const horaAgora = new Date().toISOString();

      const destId = document.getElementById('foto-dest-meal').value;

      if(destId !== '_avulso'){
        // Adiciona vinculado à refeição escolhida
        const meal = state.planoAlimentar.find(m=>m.id===destId);
        if(meal){
          const existentes = state.refeicoes[k].filter(r=>r.refId===meal.id);
          const grupo = existentes.length>0 ? Math.max(...existentes.map(r=>r._mealGroup||1)) + 1 : 1;
          _fotoItens.forEach(it=>{
            state.refeicoes[k].push({
              foodId: null,
              nome: it.nome || 'Alimento (foto)',
              grams: it.quantidade_g,
              kcal: it.kcal, p: it.proteina_g, c: it.carboidrato_g, g: it.gordura_g,
              hora: horaAgora,
              ref: meal.nome,
              refId: meal.id,
              _mealGroup: grupo,
              opcaoNome: 'Foto 📷',
              origem: 'foto'
            });
          });
          toast(`${meal.nome} registrada via foto ✓`);
        }
      } else {
        // Avulso — sem vínculo a refeição
        _fotoItens.forEach(it=>{
          state.refeicoes[k].push({
            foodId: null,
            nome: it.nome || 'Alimento (foto)',
            grams: it.quantidade_g,
            kcal: it.kcal, p: it.proteina_g, c: it.carboidrato_g, g: it.gordura_g,
            hora: horaAgora,
            origem: 'foto'
          });
        });
        toast(`${_fotoItens.length} ${_fotoItens.length===1?'item adicionado':'itens adicionados'} ✓`);
      }

      saveState();
      renderDieta();
      _fotoItens = [];
      renderFotoResultado();
      document.getElementById('foto-preview-wrap').hidden = true;
      document.getElementById('foto-status').textContent = '';
    });
  }
}

document.getElementById('btn-foto-camera').addEventListener('click', ()=>{
  document.getElementById('foto-input-cam').click();
});
document.getElementById('btn-foto-galeria').addEventListener('click', ()=>{
  document.getElementById('foto-input-gal').click();
});

async function handleFotoSelecionada(e){
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  const statusEl = document.getElementById('foto-status');
  const previewWrap = document.getElementById('foto-preview-wrap');
  const previewImg = document.getElementById('foto-preview-img');
  _fotoItens = [];
  renderFotoResultado();
  try{
    statusEl.textContent = 'Preparando imagem...';
    const dataUrl = await comprimirImagem(file);
    previewImg.src = dataUrl;
    previewWrap.hidden = false;
    statusEl.textContent = '🔎 Analisando a foto… isso pode levar alguns segundos';
    const base64 = dataUrl.split(',')[1];
    const { data:{ session: sess } } = await sb.auth.getSession();
    const resp = await fetch('/api/analisar-foto', {
      method: 'POST',
      headers: {
        'content-type':'application/json',
        'authorization': 'Bearer ' + (sess ? sess.access_token : '')
      },
      body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok || data.error){
      statusEl.textContent = '⚠ ' + (data.error || 'Não foi possível analisar a foto.');
      return;
    }
    if(!data.itens || !data.itens.length){
      statusEl.textContent = data.observacao || 'Não consegui identificar alimentos nessa foto. Tente outro ângulo ou mais luz.';
      return;
    }
    _fotoItens = data.itens.map(it=>{
      const g = Number(it.quantidade_g)||1; // evita divisão por 0
      return {
        nome: it.nome || 'Alimento',
        quantidade_g: g,
        kcal: Number(it.kcal)||0,
        proteina_g: Number(it.proteina_g)||0,
        carboidrato_g: Number(it.carboidrato_g)||0,
        gordura_g: Number(it.gordura_g)||0,
        // macros por grama (base pra recalcular ao editar gramas)
        _kcalPorG: (Number(it.kcal)||0)/g,
        _protPorG: (Number(it.proteina_g)||0)/g,
        _carbPorG: (Number(it.carboidrato_g)||0)/g,
        _gordPorG: (Number(it.gordura_g)||0)/g,
      };
    });
    statusEl.textContent = data.observacao ? `ℹ ${data.observacao}` : 'Confira e ajuste os valores antes de adicionar:';
    renderFotoResultado();
  }catch(err){
    statusEl.textContent = '⚠ Erro ao analisar a foto. Tente novamente.';
  }
}
document.getElementById('foto-input-cam').addEventListener('change', handleFotoSelecionada);
document.getElementById('foto-input-gal').addEventListener('change', handleFotoSelecionada);

function countRefHoje(){
  const k = todayKey();
  const list = state.refeicoes[k]||[];
  const counts = {};
  list.forEach(r=>{
    if(r.refId){
      counts[r.refId] = counts[r.refId]||{n:0, hora:null};
      counts[r.refId].n = Math.max(counts[r.refId].n, (r._mealGroup||1));
      // guarda a hora mais recente desse refId
      if(!counts[r.refId].hora || r.hora > counts[r.refId].hora) counts[r.refId].hora = r.hora;
    }
  });
  return counts;
}

function renderProgress(){
  const counts = countRefHoje();
  const feitas = state.planoAlimentar.filter(m=>counts[m.id]?.n > 0).length;
  const total = state.planoAlimentar.length;
  document.getElementById('progress-count').textContent = `${feitas} de ${total} refeições`;
  const bar = document.getElementById('progress-bar');
  bar.innerHTML = state.planoAlimentar.map((m,i)=>{
    const info = counts[m.id];
    const n = m.nome.match(/\d+/)?.[0] || (i+1);
    const mult = info && info.n > 1 ? `<span class="mult">×${info.n}</span>` : '';
    return `<div class="dot ${info?'done':''}"><span class="n">R${n}</span>${mult}</div>`;
  }).join('');
}

