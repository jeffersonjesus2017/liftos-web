// Saúde metabólica (RCQ, contexto do IMC) e escape de HTML.
const test = require('node:test');
const assert = require('node:assert/strict');
const { APP_JS, rodar } = require('./helpers');

function fn(nome) {
  const m = APP_JS.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`função ${nome} não encontrada`);
  return m[0];
}
const ctx = rodar([fn('calcRCQ'), fn('classificaRCQ'), fn('imcContexto'), fn('esc'),
  'globalThis.__a={calcRCQ,classificaRCQ,imcContexto,esc};'].join('\n'));
const { calcRCQ, classificaRCQ, imcContexto, esc } = ctx.__a;

test('RCQ: calcula com 3 casas e exige cintura e quadril', () => {
  assert.equal(calcRCQ({ c_cintura: 68, c_quadril: 99 }), 0.687);
  assert.equal(calcRCQ({ c_cintura: 68 }), null);
  assert.equal(calcRCQ({ c_cintura: '', c_quadril: 99 }), null);
});

test('RCQ: faixas por sexo', () => {
  assert.equal(classificaRCQ(0.687, 'm').t, 'Excelente');
  assert.equal(classificaRCQ(0.78, 'f').t, 'Bom');
  assert.equal(classificaRCQ(0.83, 'f').t, 'Moderado');
  assert.equal(classificaRCQ(0.90, 'f').t, 'Risco elevado');
  assert.equal(classificaRCQ(0.97, 'm').t, 'Risco elevado');
});

test('IMC: elevado com pouca gordura é massa magra; sem %G pede avaliação', () => {
  assert.equal(imcContexto(26, 12, 'm').cls, 'ok');
  assert.equal(imcContexto(28, 40, 'f').cls, 'crit');
  assert.equal(imcContexto(null, 12, 'm'), null);
  assert.equal(imcContexto(27, null, 'm').cls, 'warn');
});

test('esc(): neutraliza HTML e aceita null/números', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc(`"a" & 'b'`), '&quot;a&quot; &amp; &#39;b&#39;');
  assert.equal(esc(null), ''); assert.equal(esc(undefined), ''); assert.equal(esc(0), '0');
});
