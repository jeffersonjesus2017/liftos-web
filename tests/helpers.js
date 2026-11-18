// Carrega trechos do JS do app (public/js/*.js, na ordem do nome) num contexto isolado (vm), sem navegador.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'public', 'js');
const ARQUIVOS = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort();
// Mesma ordem em que o navegador executa os <script>; um único texto para os marcadores de trecho()
const APP_JS = ARQUIVOS.map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8')).join('');

function trecho(ini, fim) {
  const a = APP_JS.indexOf(ini);
  const b = APP_JS.indexOf(fim, a + 1);
  if (a < 0 || b < 0) throw new Error(`Marcadores não encontrados em public/js: "${ini}" .. "${fim}"`);
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

module.exports = { ARQUIVOS, JS_DIR, APP_JS, trecho, foods, rodar };
