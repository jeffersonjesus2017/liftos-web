// Monitor de erros: deduplica, limita por sessão e ignora ruído conhecido.
const test = require('node:test');
const assert = require('node:assert/strict');
const { trecho, rodar } = require('./helpers');

function novo() {
  const code = trecho('const APP_BUILD', 'window.addEventListener(\'error\'') + '\nglobalThis.__a={reportarErro,_errFila,enviarErros};';
  const enviados = [];
  const ctx = rodar(code, {
    location: { pathname: '/app.html' }, navigator: { userAgent: 'UA-teste' },
    usuarioAtual: { id: 'u1' },
    sb: { from: (t) => ({ insert: async (l) => { enviados.push({ t, l }); return { error: null }; } }) },
  });
  return { ...ctx.__a, enviados };
}

test('registra erro com rota, navegador e build; sem dados pessoais', () => {
  const m = novo();
  m.reportarErro('error', 'x is not a function', 'stack...');
  assert.equal(m._errFila.length, 1);
  assert.deepEqual(Object.keys(m._errFila[0]).sort(), ['build', 'kind', 'msg', 'stack', 'ua', 'url']);
  assert.equal(m._errFila[0].url, '/app.html');
});

test('deduplica a mesma mensagem e ignora ruído conhecido', () => {
  const m = novo();
  m.reportarErro('error', 'igual'); m.reportarErro('error', 'igual');
  m.reportarErro('error', 'Script error.'); m.reportarErro('error', 'ResizeObserver loop limit exceeded'); m.reportarErro('error', '');
  assert.equal(m._errFila.length, 1);
});

test('limite de 20 por sessão e truncamento de mensagem/stack', () => {
  const m = novo();
  for (let i = 0; i < 50; i++) m.reportarErro('error', 'erro ' + i);
  assert.equal(m._errFila.length, 20);
  const g = novo(); g.reportarErro('error', 'm'.repeat(900), 's'.repeat(5000));
  assert.equal(g._errFila[0].msg.length, 500); assert.equal(g._errFila[0].stack.length, 2000);
});

test('envio em lote para client_errors e fila esvaziada', async () => {
  const m = novo();
  m.reportarErro('csp', 'script-src bloqueou x'); m.reportarErro('sync', 'falhou');
  await m.enviarErros();
  assert.equal(m.enviados.length, 1);
  assert.equal(m.enviados[0].t, 'client_errors');
  assert.equal(m.enviados[0].l.length, 2);
  assert.equal(m._errFila.length, 0);
});
