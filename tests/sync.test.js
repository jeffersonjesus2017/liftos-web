// Sincronização multi-aparelho: concorrência otimista (rev) + merge de 3 vias.
const test = require('node:test');
const assert = require('node:assert/strict');
const { trecho } = require('./helpers');

const code = trecho('function agendarSync(){', 'function mostrarAuthGate(){');

function novaNuvem() { return { row: { user_id: 'u1', data: {}, rev: 0 } }; }

// Supabase falso: uma linha, rev incrementa a cada update (como o trigger do banco)
function sbFalso(nuvem) {
  return { from() {
    const q = { _f: {} };
    q.select = function () { if (this._op === 'update') return this._run(); this._op = this._op || 'select'; return this; };
    q.update = function (p) { this._op = 'update'; this._p = p; return this; };
    q.insert = function (p) { this._op = 'insert'; this._p = p; return this; };
    q.eq = function (k, v) { this._f[k] = v; return this; };
    q.maybeSingle = () => Promise.resolve({ data: nuvem.row ? { data: structuredClone(nuvem.row.data), rev: nuvem.row.rev } : null, error: null });
    q._run = function () {
      if (this._op === 'update') {
        if (nuvem.row && nuvem.row.rev === this._f.rev) {
          nuvem.row.data = structuredClone(this._p.data); nuvem.row.rev++;
          return Promise.resolve({ data: [{ rev: nuvem.row.rev }], error: null });
        }
        return Promise.resolve({ data: [], error: null });   // rev antigo: ninguém atualizado
      }
      return Promise.resolve({ data: null, error: null });
    };
    return q;
  } };
}

function aparelho(nuvem, inicial) {
  const f = new Function('sb', 'localStorage', 'logDebug', 'setSyncStatus', 'aplicarMigracoes', 'LS_KEY', 'document',
    `let state=${JSON.stringify(inicial)}; let usuarioAtual={id:'u1'}; let syncPendente=false, syncTimer=null;
     function renderHoje(){}function renderTreino(){}function renderHistorico(){}function renderDieta(){}function renderPerfil(){}
     function reportarErro(){}
     ${code}
     return {get state(){return state}, set state(v){state=v},
       sync:async()=>{syncPendente=true;await syncAgora();let n=0;while(syncPendente&&n++<6){await syncAgora();}},
       pull:puxarDaNuvem, raw:syncAgora, guardarBase, mergeEstado, nuvemDefasada, guardarPremerge,
       get pendente(){return syncPendente},
       get rev(){return cloudRev}, set pend(v){syncPendente=v}};`);
  const ls = {};
  const localStorage = { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; } };
  const ap = f(sbFalso(nuvem), localStorage, () => {}, () => {}, x => x, 'k', { querySelector: () => null });
  ap.ls = () => ls;
  return ap;
}

const J = x => JSON.parse(JSON.stringify(x));
const base0 = { perfil: { peso: 70 }, refeicoes: { '2026-11-18': [{ hora: 't1', nome: 'ovo' }] }, agua: {}, historico: [],
  avaliacoes: [{ data: '2026-10-18', peso: 76.3 }], alimentosCustom: [], sessaoAtiva: null, planoAlimentar: [], updatedAt: 1 };

// timers reais atrapalham: o sync é chamado manualmente
test.before(() => { test.mock.timers.enable({ apis: ['setTimeout'] }); });
test.after(() => { test.mock.timers.reset(); });

test('edição feita por SQL e edição local convivem (bug real de 03/11)', async () => {
  const nuvem = novaNuvem(); nuvem.row.data = J(base0); nuvem.row.rev = 5;
  const A = aparelho(nuvem, base0); A.guardarBase(5, base0);
  nuvem.row.data.avaliacoes.push({ data: '2026-11-03', c_cintura: 68 }); nuvem.row.rev = 6;   // via SQL
  A.state.refeicoes['2026-11-18'].push({ hora: 't2', nome: 'arroz' });                        // local
  await A.sync();
  assert.equal(nuvem.row.data.avaliacoes.length, 2);
  assert.equal(nuvem.row.data.refeicoes['2026-11-18'].length, 2);
});

test('dois aparelhos editam sem perder nada, e o pull traz o que o outro fez', async () => {
  const nuvem = novaNuvem(); nuvem.row.data = J(base0); nuvem.row.rev = 1;
  const P = aparelho(nuvem, base0), C = aparelho(nuvem, base0); P.guardarBase(1, base0); C.guardarBase(1, base0);
  P.state.agua = { '2026-11-18': [{ ml: 300, hora: 'a' }] }; await P.sync();
  C.state.refeicoes['2026-11-18'].push({ hora: 't3', nome: 'frango' }); C.state.perfil = { peso: 71 }; await C.sync();
  assert.equal(nuvem.row.data.agua['2026-11-18'].length, 1);
  assert.equal(nuvem.row.data.refeicoes['2026-11-18'].length, 2);
  assert.equal(nuvem.row.data.perfil.peso, 71);
  await P.pull();
  assert.equal(P.state.refeicoes['2026-11-18'].length, 2);
  assert.equal(P.state.agua['2026-11-18'].length, 1);
});

test('exclusão local é respeitada e adição remota é mantida', async () => {
  const nuvem = novaNuvem(); nuvem.row.data = J(base0); nuvem.row.rev = 1;
  const D = aparelho(nuvem, base0); D.guardarBase(1, base0);
  nuvem.row.data.refeicoes['2026-11-18'].push({ hora: 't9', nome: 'novo-remoto' }); nuvem.row.rev = 2;
  D.state.refeicoes['2026-11-18'] = D.state.refeicoes['2026-11-18'].filter(x => x.hora !== 't1');
  await D.sync();
  assert.deepEqual(nuvem.row.data.refeicoes['2026-11-18'].map(x => x.nome), ['novo-remoto']);
});

test('sem base (primeiro uso) só une listas e nunca apaga', () => {
  const nuvem = novaNuvem();
  const m = aparelho(nuvem, base0).mergeEstado(
    { perfil: { peso: 99 }, historico: [{ s: 1 }], refeicoes: {}, agua: {}, avaliacoes: [], alimentosCustom: [] },
    { perfil: { peso: 70 }, historico: [{ s: 2 }], refeicoes: { d: [{ x: 1 }] }, agua: {}, avaliacoes: [{ a: 1 }], alimentosCustom: [] },
    null, false);
  assert.equal(m.historico.length, 2);
  assert.equal(m.refeicoes.d.length, 1);
  assert.equal(m.avaliacoes.length, 1);
  assert.equal(m.perfil.peso, 70);
});

test('chamadas de sync simultâneas geram uma única gravação', async () => {
  const nuvem = novaNuvem(); nuvem.row.data = J(base0); nuvem.row.rev = 1;
  const E = aparelho(nuvem, base0); E.guardarBase(1, base0);
  E.state.perfil = { peso: 80 }; E.pend = true;
  await Promise.all([E.raw(), E.raw()]);
  assert.equal(nuvem.row.rev, 2);
});

test('merge de listas remove duplicatas idênticas já presentes na nuvem (bug das Amêndoas duplicadas)', () => {
  const { trecho: t } = require('./helpers');
  const ctx = require('./helpers').rodar('const _jstr=x=>JSON.stringify(x);' + t('function merge3Lista', 'function mergeEstado') + '\nglobalThis.m=merge3Lista;');
  const x = { id: 'u1', n: 'Amêndoas' }, y = { id: 'u2', n: 'Outro' };
  const ids = a => a.map(i => i.id);
  assert.deepEqual(ids(ctx.m([y, x], [y, x, x], [y, x])), ['u2', 'u1']);
  assert.deepEqual(ids(ctx.m([y, x], [y, x], [y])), ['u2', 'u1'], 'mesmo item novo nos dois lados não duplica');
  assert.deepEqual(ids(ctx.m([y], [y, x], [y, x])), ['u2'], 'exclusão local continua valendo');
});

// ---- bug real de 21/11: leitura velha da nuvem (rev 78 < 89) descartava o treino em andamento ----
const comSessao = () => ({ ...J(base0), sessaoAtiva: { nome: 'DOMINGO', data: '2026-11-21T11:13:00Z', exercicios: [{ id: 'j28', sets: [{ reps: '10', carga: '40' }] }] } });

test('nuvemDefasada: só é defasada se a revisão lida for MENOR que a conhecida', () => {
  const A = aparelho(novaNuvem(), base0);
  assert.equal(A.nuvemDefasada(78, 89), true);
  assert.equal(A.nuvemDefasada(89, 89), false);
  assert.equal(A.nuvemDefasada(90, 89), false);
  assert.equal(A.nuvemDefasada(5, null), false);
});

test('pull com leitura defasada da nuvem é ignorado e não derruba a sessão de treino', async () => {
  const nuvem = novaNuvem(); nuvem.row.data = J(base0); nuvem.row.rev = 78;       // leitura velha (sem sessão)
  const A = aparelho(nuvem, comSessao()); A.guardarBase(89, comSessao());          // aparelho já estava no rev 89
  await A.pull();
  assert.ok(A.state.sessaoAtiva, 'sessão de treino deve continuar');
  assert.equal(A.rev, 89);
});

test('conflito com leitura defasada não mescla: mantém o local e tenta de novo depois', async () => {
  const nuvem = novaNuvem(); nuvem.row.data = J(base0); nuvem.row.rev = 78;
  const A = aparelho(nuvem, comSessao()); A.guardarBase(89, comSessao());
  A.state.refeicoes['2026-11-18'].push({ hora: 't9', nome: 'banana' });
  await A.raw.call(null, A.pend = true);                                           // update com rev 89 não casa → resolverConflito
  assert.ok(A.state.sessaoAtiva, 'sessão de treino deve continuar');
  assert.equal(A.state.refeicoes['2026-11-18'].length, 2);
  assert.equal(A.pendente, true, 'deve reagendar o envio');
  assert.equal(nuvem.row.rev, 78, 'nuvem intocada');
});

test('registro pré-merge recente não é sobrescrito (guarda o estado do início do app)', () => {
  const nuvem = novaNuvem();
  const A = aparelho(nuvem, base0);
  A.guardarPremerge({ marca: 'primeiro' });
  A.guardarPremerge({ marca: 'segundo' });
  const ls = A.ls();
  assert.equal(JSON.parse(ls['cargabruta.premerge']).local.marca, 'primeiro');
});
