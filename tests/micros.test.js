// Micronutrientes: alvos por sexo/idade, somas, sugestões e integridade da tabela.
const test = require('node:test');
const assert = require('node:assert/strict');
const { foods, trecho, rodar } = require('./helpers');

const codigo = foods() + '\n' + trecho('// --------- micronutrientes', '// --------- state helpers') +
  '\nglobalThis.__api = { alvosMicro, modoMicro, totaisMicro, sugestoesMicro, microRow, microRowCustom, MICRO_DEF, MICROS, FOODS };';
const ctx = rodar(codigo, {
  document: { getElementById: () => null }, esc: v => String(v), allFoods: () => [],
  state: { perfil: {}, refeicoes: {} }, todayKey: () => 'd', countRefHoje: () => ({}),
});
const api = ctx.__api;

test('alvos: virada dos 50 → 51 anos para mulheres (ferro, cálcio, fibra)', () => {
  const f50 = api.alvosMicro('f', 50), f51 = api.alvosMicro('f', 51);
  assert.deepEqual([f50.fe, f50.ca, f50.fib], [18, 1000, 25]);
  assert.deepEqual([f51.fe, f51.ca, f51.fib], [8, 1200, 21]);
});

test('alvos: homem de 28 anos', () => {
  const m = api.alvosMicro('m', 28);
  assert.equal(m.fib, 38); assert.equal(m.fe, 8); assert.equal(m.k, 3400); assert.equal(m.zn, 11);
  assert.equal(m.na, 2000);
});

test('alvos: override do perfil substitui só o nutriente informado', () => {
  const base = api.alvosMicro('f', 50);
  const com = api.alvosMicro('f', 50, { ca: { v: 1300 } });
  assert.equal(com.ca, 1300);
  assert.equal(com.fe, base.fe);
  assert.equal(api.alvosMicro('f', 50, { ca: { v: 0 } }).ca, base.ca, 'valor 0 é ignorado');
});

test('modo: sódio é teto por padrão e "info" vem do perfil', () => {
  const sodio = api.MICRO_DEF.find(m => m.k === 'na'), ferro = api.MICRO_DEF.find(m => m.k === 'fe');
  assert.equal(api.modoMicro(sodio, {}), 'max');
  assert.equal(api.modoMicro(ferro, {}), 'meta');
  assert.equal(api.modoMicro(ferro, { fe: { modo: 'info' } }), 'info');
});

test('totais: escalam pelos gramas e contam itens sem dados', () => {
  const id = Object.keys(api.MICROS)[0];
  const linha = api.MICROS[id];
  const { tot: t100, semDados: s0 } = api.totaisMicro([{ foodId: id, grams: 100 }]);
  const { tot: t200 } = api.totaisMicro([{ foodId: id, grams: 200 }]);
  api.MICRO_DEF.forEach((m, i) => {
    assert.ok(Math.abs(t100[m.k] - linha[i]) < 1e-9, `${m.k} = valor por 100 g`);
    assert.ok(Math.abs(t200[m.k] - 2 * linha[i]) < 1e-9, `${m.k} dobra com o dobro de gramas`);
  });
  assert.equal(s0, 0);
  assert.equal(api.totaisMicro([{ foodId: 'nao_existe', grams: 100 }, { grams: 50 }]).semDados, 2);
  assert.equal(api.totaisMicro(null).semDados, 0);
});

test('sugestões: porções realistas (≤ 400 g, ≤ 8 unidades)', () => {
  for (const key of ['ca', 'mg', 'k', 'fib', 'vc', 'vd', 'fol']) {
    const alvo = api.alvosMicro('f', 50)[key];
    const lista = api.sugestoesMicro(key, alvo * 0.5, alvo, 8);
    assert.ok(lista.length > 0, `há sugestões para ${key}`);
    for (const s of lista) {
      assert.ok(s.g > 0 && s.g <= 400, `${key}: ${s.f.n} ${s.g} g`);
      if (s.f.un) assert.ok(s.g / s.f.un <= 8, `${key}: ${s.f.n} ≤ 8 unidades`);
    }
  }
});

test('tabela: ids únicos em FOODS, 12 colunas por linha, sem valores negativos', () => {
  const ids = api.FOODS.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, 'ids de FOODS duplicados');
  for (const [id, row] of Object.entries(api.MICROS)) {
    assert.equal(row.length, api.MICRO_DEF.length, `${id}: número de colunas`);
    assert.ok(row.every(v => typeof v === 'number' && v >= 0), `${id}: valores inválidos`);
  }
});

test('cobertura: todo alimento do cardápio base tem micros (ou alias)', () => {
  const sem = api.FOODS.filter(f => !api.microRow(f.id)).map(f => f.id);
  // Limite conhecido; o passo 4c (TACO completa) deve reduzir isto
  assert.ok(sem.length <= 30, `muitos alimentos sem micros (${sem.length}): ${sem.join(', ')}`);
});

test('alimento próprio com micros do rótulo (m) entra nos totais; o que não foi informado fica "sem dado"', () => {
  ctx.state.alimentosCustom = [{ id: 'u_teste', n: 'Pão X', kc: 261, p: 12, c: 41, g: 5.4, un: 25, m: { fib: 6.2, na: 326 } }];
  const row = api.microRow('u_teste');
  const iFib = api.MICRO_DEF.findIndex(m => m.k === 'fib'), iNa = api.MICRO_DEF.findIndex(m => m.k === 'na'), iFe = api.MICRO_DEF.findIndex(m => m.k === 'fe');
  assert.equal(row[iFib], 6.2); assert.equal(row[iNa], 326); assert.equal(row[iFe], null);
  const { tot, semDados } = api.totaisMicro([{ foodId: 'u_teste', grams: 50 }]);
  assert.ok(Math.abs(tot.fib - 3.1) < 1e-9); assert.ok(Math.abs(tot.na - 163) < 1e-9);
  assert.equal(tot.fe, 0); assert.equal(semDados, 0);
  // sem m, ou m vazio/lixo → sem linha de micros
  ctx.state.alimentosCustom = [{ id: 'u_a', kc: 1 }, { id: 'u_b', kc: 1, m: {} }, { id: 'u_c', kc: 1, m: { fib: 'x' } }];
  ['u_a', 'u_b', 'u_c'].forEach(id => assert.equal(api.microRow(id), null));
  ctx.state.alimentosCustom = [];
});
