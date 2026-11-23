// Plano de hidratação editável: padrão, validação do plano salvo e remapeamento dos registros do dia.
const test = require('node:test');
const assert = require('node:assert/strict');
const { trecho, rodar } = require('./helpers');

const codigo = trecho('// rótulo de uma hora decimal', 'function renderAgua(){') +
  '\nglobalThis.__a = { planoHidratacao, planoHidratacaoPadrao, planoAguaValido, remapearSlotsAgua, rotuloHoraAgua };';
const state = { perfil: { aguaMeta: 3000 }, planoAgua: null };
const ctx = rodar(codigo, { state });
const a = ctx.__a;

test('sem plano editado, usa o padrão: 6 slots dividindo a meta', () => {
  const p = a.planoHidratacao();
  assert.equal(p.length, 6);
  assert.equal(p[0].ml, 500);
  assert.equal(p[1].label, '7:30');
  assert.equal(p[0].label, '5h');
});

test('plano editado tem prioridade, vem ordenado por hora e com rótulo', () => {
  state.planoAgua = [{ hora: 14, ml: 700 }, { hora: 6.5, ml: 300 }];
  const p = a.planoHidratacao();
  assert.equal(JSON.stringify(p.map(s => [s.hora, s.ml, s.label])), JSON.stringify([[6.5, 300, '6:30'], [14, 700, '14h']]));
  state.planoAgua = null;
});

test('plano inválido é ignorado (volta ao padrão)', () => {
  assert.equal(a.planoAguaValido([]), null);
  assert.equal(a.planoAguaValido([{ hora: NaN, ml: 300 }]), null);
  assert.equal(a.planoAguaValido([{ hora: 8, ml: 10 }]), null);
  assert.equal(a.planoAguaValido([{ hora: 8, ml: 5000 }]), null);
  assert.equal(a.planoAguaValido([{ hora: 25, ml: 300 }]), null);
  state.planoAgua = [{ hora: 8, ml: 5 }];
  assert.equal(a.planoHidratacao().length, 6);
  state.planoAgua = null;
});

test('registros do dia seguem o slot de mesma hora; horário removido vira avulso e os ml permanecem', () => {
  const antigo = [{ hora: 5, ml: 500 }, { hora: 7.5, ml: 500 }, { hora: 10, ml: 500 }];
  const novo = [{ hora: 6, ml: 400 }, { hora: 7.5, ml: 600 }, { hora: 10, ml: 500 }];
  const regs = [{ ml: 500, slot: 0 }, { ml: 500, slot: 2 }, { ml: 250 }];
  const r = a.remapearSlotsAgua(regs, antigo, novo);
  assert.equal(r.length, 3);
  assert.equal(r[0].slot, undefined, '5h não existe mais');
  assert.equal(r[0].ml, 500);
  assert.equal(r[1].slot, 2);
  assert.equal(r[2].slot, undefined);
});
