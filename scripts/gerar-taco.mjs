// Gera public/taco.json a partir de data/taco/*.csv (TACO 4ª ed., via raulfdm/taco-api).
// Uso: node scripts/gerar-taco.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// IDs da TACO que o app já tem curados à mão em FOODS (com porções/unidades): não duplicar na busca.
const JA_NO_APP = new Set([1, 3, 4, 7, 31, 52, 53, 56, 70, 78, 88, 91, 97, 100, 110, 112, 142, 146, 157, 163, 164, 182, 214, 215, 222,
  225, 236, 239, 243, 256, 260, 261, 272, 301, 317, 351, 361, 370, 371, 377, 386, 396, 410, 448, 457, 458, 461, 463, 471, 474, 480,
  486, 488, 491, 507, 557, 561, 567, 589]);

// Categorias onde fibra / vitamina C em branco significam, na prática, zero (não existem no alimento)
const SEM_FIBRA = new Set([4, 5, 6, 7, 8, 9, 10]);          // óleos, pescados, carnes, leite, bebidas, ovos, açúcares
const SEM_VITC = new Set([4, 5, 6, 7, 8, 10]);
// Vitamina A em branco = traços/ausente: as fontes ricas (cenoura, abóbora, ovo, fígado...) estão todas quantificadas

function csv(arquivo) {
  const t = fs.readFileSync(path.join(raiz, 'data/taco', arquivo), 'utf8').replace(/^﻿/, '');
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) { if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch; }
    else if (ch === '"') aspas = true;
    else if (ch === ',') { linha.push(campo); campo = ''; }
    else if (ch === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.filter(l => l.length === cab.length).map(l => Object.fromEntries(cab.map((c, i) => [c, l[i]])));
}

const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const arred = (v, d) => v === null ? null : Math.round(v * 10 ** d) / 10 ** d;

const nut = new Map(csv('nutrients.csv').map(r => [Number(r.foodId), r]));
const saida = [];
let semKcal = 0;
for (const f of csv('food.csv')) {
  const id = Number(f.id), cat = Number(f.categoryId);
  if (JA_NO_APP.has(id)) continue;
  const r = nut.get(id);
  if (!r || num(r.kcal) === null) { semKcal++; continue; }
  let fib = num(r.dietaryFiber), vc = num(r.vitaminC), va = num(r.rae);
  if (fib === null && SEM_FIBRA.has(cat)) fib = 0;
  if (vc === null && SEM_VITC.has(cat)) vc = 0;
  if (va === null) va = 0;
  // ordem = MICRO_DEF do app: fibra, ferro, cálcio, magnésio, potássio, zinco, sódio, vit A, vit C, vit D, B12, folato
  const micros = [arred(fib, 1), arred(num(r.iron), 2), arred(num(r.calcium), 0), arred(num(r.magnesium), 0), arred(num(r.potassium), 0),
    arred(num(r.zinc), 2), arred(num(r.sodium), 0), arred(va, 0), arred(vc, 1), null, null, null];
  if (cat === 4) for (let i = 1; i <= 6; i++) if (micros[i] === null) micros[i] = 0;   // óleos/gorduras: sem minerais
  saida.push([id, f.name.trim(), arred(num(r.kcal), 0), arred(num(r.protein) ?? 0, 1), arred(num(r.carbohydrates) ?? 0, 1), arred(num(r.lipids) ?? 0, 1), micros]);
}
const json = { v: 1, fonte: 'TACO 4ª ed. (NEPA/Unicamp) via raulfdm/taco-api', ordem: 'id, nome, kcal, P, C, G (por 100 g), [fibra, ferro, cálcio, magnésio, potássio, zinco, sódio, vitA, vitC, vitD, B12, folato]', foods: saida };
fs.writeFileSync(path.join(raiz, 'public/taco.json'), JSON.stringify(json));
console.log(`${saida.length} alimentos gravados (${semKcal} sem kcal descartados); ${(fs.statSync(path.join(raiz, 'public/taco.json')).size / 1024).toFixed(1)} KB`);
