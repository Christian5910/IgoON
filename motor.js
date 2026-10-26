/* IgoON! - motor.js (Web Worker): roda o computador (ia.js) e o solucionador de tsume (tsume.js) fora da tela,
   para o site não travar. Mensagens: { id, op, ... } → resposta { id, op, ... } ou { id, erro }. */
importScripts('regras.js', 'ia.js', 'tsume.js');

const solvers = {};

self.onmessage = function (e) {
  const m = e.data || {};
  try {
    if (m.op === 'tsume') {
      // m.def = { n, linhas, atacante }, m.b = tabuleiro atual, m.vez, m.ko, m.passes
      const chave = m.pid || 'x';
      let S = solvers[chave];
      if (!S) {
        const P = Tsume.montar(m.def);
        S = solvers[chave] = new Tsume.Solver(P, { limiteNos: 4e6 });
      }
      S.nos = 0; S.estouro = false;
      const lista = S.avaliar(Uint8Array.from(m.b), m.vez, m.ko, m.passes || 0);
      self.postMessage({ id: m.id, op: m.op, lista: lista, estouro: S.estouro });
      return;
    }
    const g = Go.restaurar(m.jogo);
    if (!g) { self.postMessage({ id: m.id, erro: 'jogo inválido' }); return; }
    if (m.op === 'jogar' || m.op === 'dica') {
      const r = IA.escolher(g, { nivel: m.op === 'dica' ? Math.max(4, m.nivel || 4) : m.nivel, semente: m.semente, ms: m.ms });
      self.postMessage({ id: m.id, op: m.op, p: r.p, vr: r.vr, sims: r.sims, ranking: r.ranking || [] });
    } else if (m.op === 'estimar') {
      const r = IA.estimar(g, { sims: m.sims || 300, ms: m.ms || 3000 });
      self.postMessage({ id: m.id, op: m.op, dono: r.dono, margem: r.margem });
    } else if (m.op === 'mortas') {
      const r = IA.sugerirMortas(g, { sims: m.sims || 400, ms: m.ms || 4000 });
      self.postMessage({ id: m.id, op: m.op, mortas: r.mortas, neutros: r.neutros, margem: r.margem });
    } else {
      self.postMessage({ id: m.id, erro: 'operação desconhecida' });
    }
  } catch (err) {
    self.postMessage({ id: m.id, erro: String(err && err.message || err) });
  }
};
