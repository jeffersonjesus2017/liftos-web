// Carrega trechos de public/app.js num contexto isolado (vm) para testar sem navegador.
// O app ainda é um arquivo único; a divisão em módulos (passo 4d) vai simplificar isto.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_JS = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function trecho(ini, fim) {
  const a = APP_JS.indexOf(ini);
  const b = APP_JS.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error(`Marcadores não encontrados em app.js: "${ini}" .. "${fim}"`);
  return APP_JS.slice(a, b);
}

function foods() {
  const m = APP_JS.match(/const FOODS = \[[\s\S]*?\n\];/);
  if (!m) throw new Error('FOODS não encontrado');
  return m[0];
}

// Executa código num contexto novo e devolve o próprio contexto (funções/const via globalThis)
function rodar(codigo, globais = {}) {
  const ctx = vm.createContext({ console, structuredClone, JSON, Math, Date, ...globais });
  vm.runInContext(codigo, ctx);
  return ctx;
}

module.exports = { APP_JS, trecho, foods, rodar };
