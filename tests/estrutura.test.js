// Estrutura dos scripts: ordem no HTML, lista do service worker, sintaxe e nomes globais únicos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ARQUIVOS, JS_DIR } = require('./helpers');

const pub = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');

test('app.html carrega todos os arquivos de /js, na ordem do nome, depois das bibliotecas', () => {
  const html = pub('app.html');
  const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const meus = tags.filter(t => t.startsWith('/js/'));
  assert.deepEqual(meus, ARQUIVOS.map(f => '/js/' + f));
  const ultimaLib = Math.max(...tags.map((t, i) => (t.startsWith('/vendor/') ? i : -1)));
  assert.ok(ultimaLib < tags.indexOf(meus[0]), 'bibliotecas (vendor) antes do app');
  assert.ok(!html.includes('<script>'), 'sem script inline (CSP)');
  assert.ok(!/\son(click|change|input|submit|load|error)\s*=/i.test(html), 'sem handler inline no HTML (CSP)');
});

test('service worker lista todos os arquivos do app para uso offline', () => {
  const sw = pub('sw.js');
  for (const f of ARQUIVOS) assert.ok(sw.includes(`'/js/${f}'`), `sw.js não lista ${f}`);
  assert.ok(sw.includes("'/taco.json'"));
});

test('cada arquivo tem sintaxe válida', () => {
  for (const f of ARQUIVOS) assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), { filename: f }), f);
});

test('nenhum nome global (const/let/function/class) repetido entre arquivos', () => {
  const dono = new Map(); const dup = [];
  for (const f of ARQUIVOS) {
    const txt = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    for (const m of txt.matchAll(/^(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const nome = m[1];
      if (dono.has(nome) && dono.get(nome) !== f) dup.push(`${nome} (${dono.get(nome)} e ${f})`);
      else if (dono.has(nome)) dup.push(`${nome} repetido em ${f}`);
      dono.set(nome, f);
    }
  }
  assert.deepEqual(dup, []);
});
