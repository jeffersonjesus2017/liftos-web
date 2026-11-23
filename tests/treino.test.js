// Sessão de treino: catálogo de exercícios conhecidos e montagem de exercício trocado/adicionado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { trecho, rodar } = require('./helpers');

const codigo = trecho('const _normEx', '\nlet _exModalResolve') +
  '\nglobalThis.__a = { catalogoExercicios, montarExercicio, exTemDados, _normEx };';
const state = {
  divisoes: { A: { treinos: [{ id: 'DOM', exercicios: [
    { id: 'j30', nome: 'Agachamento hack', reps: '10-12', obs: 'pausa embaixo', series: 4 },
    { id: 'j31', nome: 'Cadeira extensora', reps: '12', series: 3 },
  ] }] } },
  historico: [{ exercicios: [{ id: 'h1', nome: 'Leg press 45°', reps: '12', sets: [{}, {}, {}, {}] }] }],
  sessaoAtiva: null,
};
const ctx = rodar(codigo, { state });
const a = ctx.__a;

test('catálogo junta treinos e histórico, sem repetir nome (ignora acento e caixa)', () => {
  state.historico.push({ exercicios: [{ id: 'h2', nome: 'AGACHAMENTO HACK', sets: [{}] }] });
  const nomes = [...a.catalogoExercicios().values()].map(e => e.nome);
  assert.deepEqual(nomes.sort(), ['Agachamento hack', 'Cadeira extensora', 'Leg press 45°']);
  state.historico.pop();
});

test('nome conhecido reaproveita id, reps e obs (mantém a sugestão de carga)', () => {
  const ex = a.montarExercicio({ nome: 'agachamento hack', series: 4, reps: '' });
  assert.equal(ex.id, 'j30'); assert.equal(ex.nome, 'Agachamento hack');
  assert.equal(ex.reps, '10-12'); assert.equal(ex.obs, 'pausa embaixo');
  assert.equal(ex.sets.length, 4);
  assert.equal(ex.sets[0].carga, ''); assert.equal(ex.sets[0].reps, '');
});

test('nome novo ganha id próprio e valores padrão; séries ficam entre 1 e 10', () => {
  const ex = a.montarExercicio({ nome: '  Cadeira flexora unilateral ', series: 99, reps: '' });
  assert.match(ex.id, /^x\d+$/);
  assert.equal(ex.nome, 'Cadeira flexora unilateral');
  assert.equal(ex.reps, '10-12');
  assert.equal(ex.sets.length, 10);
  assert.equal(a.montarExercicio({ nome: 'X', series: 0 }).sets.length, 3, 'valor inválido volta ao padrão');
  assert.equal(a.montarExercicio({ nome: 'X', series: -2 }).sets.length, 1);
  assert.equal(a.montarExercicio({ nome: 'X', series: 3, reps: '8-10' }).reps, '8-10');
});

test('exTemDados só é verdadeiro se alguma série tiver carga ou reps', () => {
  assert.equal(a.exTemDados({ sets: [{ carga: '', reps: '' }] }), false);
  assert.equal(a.exTemDados({ sets: [{ carga: '', reps: '' }, { carga: '40', reps: '' }] }), true);
});
