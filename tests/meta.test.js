// Meta de calorias do dia: soma do plano, meta fixa editável e fallback.
const test = require('node:test');
const assert = require('node:assert/strict');
const { trecho, rodar } = require('./helpers');

const codigo = trecho('// soma kcal/macros da 1ª opção', 'function imcCategoria') + '\nglobalThis.__a = { metaDoPlano, calcPerfil, setState: s => { state = s; } };';
const FOODS = [{ id: 'a', n: 'A', kc: 100, p: 10, c: 10, g: 2 }, { id: 'b', n: 'B', kc: 200, p: 5, c: 30, g: 6 }];
const ctx = rodar('let state={};\n' + codigo, { allFoods: () => FOODS });
const api = ctx.__a;

const plano = [
  { id: 'r1', opcoes: [{ itens: [{ fid: 'a', g: 100 }, { fid: 'b', g: 100 }] }, { itens: [{ fid: 'b', g: 500 }] }] },   // 1ª opção = 300 kcal
  { id: 'r2', opcoes: [{ itens: [{ fid: 'b', g: 200 }] }] },                                                          // 400 kcal
];
const perfil = (extra = {}) => ({ peso: 70, altura: 170, idade: 30, sexo: 'm', atividade: 1.5, objetivo: 300, ...extra });

test('sem meta fixa: meta = soma da 1ª opção de cada refeição (as outras opções não contam)', () => {
  api.setState({ perfil: perfil(), planoAlimentar: plano });
  assert.equal(api.metaDoPlano().kcal, 700);
  const r = api.calcPerfil();
  assert.equal(r.meta, 700);
  assert.deepEqual([r.protG, r.carbG, r.gordG], [25, 100, 20]);
});

test('meta fixa tem prioridade e escala os macros na mesma proporção', () => {
  api.setState({ perfil: perfil({ metaKcal: 1400 }), planoAlimentar: plano });
  const r = api.calcPerfil();
  assert.equal(r.meta, 1400);
  assert.deepEqual([r.protG, r.carbG, r.gordG], [50, 200, 40]);   // 1400 = dobro de 700 → macros dobram
});

test('meta fixa 0, vazia ou inválida é ignorada', () => {
  for (const v of [0, '', null, undefined, -50, 'abc']) {
    api.setState({ perfil: perfil({ metaKcal: v }), planoAlimentar: plano });
    assert.equal(api.calcPerfil().meta, 700, `metaKcal=${v}`);
  }
});

test('plano vazio: usa a meta fixa; sem ela, cai no gasto + objetivo', () => {
  api.setState({ perfil: perfil({ metaKcal: 3300 }), planoAlimentar: [] });
  const fixa = api.calcPerfil();
  assert.equal(fixa.meta, 3300);
  assert.equal(fixa.protG, 140);          // 2 g/kg × 70 kg
  api.setState({ perfil: perfil(), planoAlimentar: [] });
  const r = api.calcPerfil();
  assert.equal(r.meta, Math.round(r.get + 300));
});
