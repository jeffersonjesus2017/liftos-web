// Dados da TACO importada (public/taco.json) e integração com busca/totais.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APP_JS, foods, trecho, rodar } = require('./helpers');

const taco = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'taco.json'), 'utf8'));

test('taco.json: ~530 alimentos, ids únicos, 12 micros por linha, sem negativos', () => {
  assert.ok(taco.foods.length >= 500, `só ${taco.foods.length} alimentos`);
  const ids = taco.foods.map(f => f[0]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [id, nome, kc, p, c, g, m] of taco.foods) {
    assert.ok(typeof nome === 'string' && nome.length > 2, `nome do ${id}`);
    assert.ok([kc, p, c, g].every(v => typeof v === 'number' && v >= 0), `macros do ${id}`);
    assert.equal(m.length, 12, `colunas do ${id}`);
    assert.ok(m.every(v => v === null || (typeof v === 'number' && v >= 0)), `micros do ${id}`);
    assert.deepEqual(m.slice(9), [null, null, null], `${id}: TACO não traz vit. D, B12, folato`);
  }
});

test('taco.json: energia coerente com os macros (detecta coluna trocada na importação)', () => {
  const fora = taco.foods.filter(([, , kc, p, c, g]) => Math.abs(kc - (4 * p + 4 * c + 9 * g)) > 0.25 * kc + 30);
  assert.ok(fora.length / taco.foods.length < 0.05, `${fora.length} fora da faixa: ${fora.slice(0, 5).map(f => f[1]).join('; ')}`);
});

test('taco.json: valores de referência conferidos à mão (TACO 4ª ed.)', () => {
  const por = n => taco.foods.find(f => f[1] === n);
  const brocolis = por('Brócolis, cru');
  assert.deepEqual(brocolis.slice(2, 6), [25, 3.6, 4, 0.3]);
  assert.equal(brocolis[6][2], 86);   // cálcio mg
  assert.equal(brocolis[6][8], 34.3); // vitamina C mg
  assert.ok(!taco.foods.some(f => f[0] === 488), 'ovo (488) já é curado no app: não duplicar');
});

const codigo = foods() + '\n' + trecho('// --------- micronutrientes', '// --------- state helpers') +
  '\nfunction allFoods(){ return [...FOODS, ...state.alimentosCustom, ...TACO_FOODS]; }' +
  '\n' + APP_JS.match(/function normBusca[^\n]*\nfunction buscarAlimentos[\s\S]*?\n\}/)[0] +
  '\nglobalThis.__a = { aplicarTaco, buscarAlimentos, totaisMicro, microRow, allFoods, MICRO_DEF };';
const ctx = rodar(codigo, {
  document: { getElementById: () => null }, esc: String, state: { perfil: {}, refeicoes: {}, alimentosCustom: [{ id: 'tc_1', n: 'Meu pão caseiro', kc: 250, p: 8, c: 45, g: 3 }] },
  todayKey: () => 'd', countRefHoje: () => ({}), rerenderAtual() {}, reportarErro() {},
});
const a = ctx.__a;
a.aplicarTaco(taco);

test('busca: ignora acento e caixa, começa-com primeiro, curados antes da TACO', () => {
  const r = a.buscarAlimentos('feijao', 10).map(f => f.n);
  assert.ok(r.length > 3);
  assert.ok(r.some(n => /^Feijão/.test(n)), 'acha "Feijão" digitando "feijao"');
  assert.ok(a.buscarAlimentos('FEIJÃO', 10).length === r.length);
  const primeiro = a.buscarAlimentos('feijao', 10)[0];
  assert.ok(!primeiro.taco, 'curado vem antes da TACO');
  assert.equal(a.buscarAlimentos('pao caseiro', 5)[0].id, 'tc_1', 'alimento próprio é achado');
  assert.equal(a.buscarAlimentos('zzzxxx', 5).length, 0);
});

test('totais: alimento TACO soma micros; null conta zero e não gera NaN', () => {
  const brocolis = a.allFoods().find(f => f.n === 'Brócolis, cru');
  assert.ok(brocolis && brocolis.taco);
  const { tot, semDados } = a.totaisMicro([{ foodId: brocolis.id, grams: 200 }]);
  assert.equal(semDados, 0);
  assert.ok(Math.abs(tot.ca - 172) < 1e-9);          // 86 mg/100 g × 2
  assert.equal(tot.vd, 0); assert.equal(tot.b12, 0);  // sem dado = 0, nunca NaN
  assert.ok(Object.values(tot).every(Number.isFinite));
});

test('curados não foram sobrescritos: nenhum id da TACO colide com FOODS', () => {
  const ids = new Set(a.allFoods().map(f => f.id));
  assert.equal(ids.size, a.allFoods().length, 'ids duplicados entre curados, próprios e TACO');
});
