/* ==========================================================================
   IgoON! - tsume.js  (solucionador de problemas de vida e morte)
   Busca completa (todas as respostas de todos os lados) dentro da área do problema:
     - o atacante vence se capturar todas as pedras do alvo;
     - o defensor vence se uma pedra do alvo ficar viva sem poder ser capturada (vida incondicional de Benson)
       ou se os dois passarem sem que o alvo tenha sido capturado (inclui seki);
     - repetição de posição no mesmo caminho conta como "ciclo" (ko ou parecido) e NÃO é vitória de ninguém.
   Só entram no site problemas cujo resultado é decisivo (sem depender de ko).
   ========================================================================== */
(function (raiz) {
  'use strict';
  const Go = raiz.Go || (typeof require !== 'undefined' ? require('./regras.js') : null);
  const IA = raiz.IA || (typeof require !== 'undefined' ? require('./ia.js') : null);

  const A = 1, L = 0, D = -1;      // do ponto de vista do atacante

  // Um problema: { n, linhas:['.XO'…], atacante:1|2, vez:1|2 (quem joga primeiro), alvo:[indices] ou 'auto', regiao:[indices] ou 'auto' }
  function montar(p) {
    const n = p.n || 9;
    const b = new Uint8Array(n * n);
    const linhas = p.linhas;
    for (let y = 0; y < n; y++) {
      const ln = linhas[y] || '';
      for (let x = 0; x < n; x++) { const c = ln[x] || '.'; b[y * n + x] = c === 'X' ? 1 : (c === 'O' ? 2 : 0); }
    }
    const atac = p.atacante, def = 3 - atac;
    // alvo: todas as pedras do defensor, se não informado
    let alvo = p.alvo;
    if (!alvo || alvo === 'auto') { alvo = []; for (let i = 0; i < n * n; i++) if (b[i] === def) alvo.push(i); }
    // região: pontos vazios ligados à área (por padrão, todos os vazios que tocam o defensor ou um vazio já na região)
    let regiao = p.regiao;
    if (!regiao || regiao === 'auto') {
      const viz = IA.Tab.prototype ? null : null; void viz;
      const g = Go.vizinhos(n), vis = new Set(), pil = [];
      for (let i = 0; i < n * n; i++) if (b[i] === 0 && g[i].some((q) => b[q] === def)) { vis.add(i); pil.push(i); }
      for (let k = 0; k < pil.length; k++) for (const q of g[pil[k]]) if (b[q] === 0 && !vis.has(q)) { vis.add(q); pil.push(q); }
      regiao = pil.slice().sort((a, c) => a - c);
    }
    return { n: n, b: b, atac: atac, def: def, vez: p.vez || atac, alvo: alvo, regiao: regiao };
  }

  // área selada: todo vazio ligado à região está dentro dela (nenhuma liberdade escapa para fora)
  function selada(P) {
    const g = Go.vizinhos(P.n), reg = new Set(P.regiao);
    for (const i of P.regiao) for (const q of g[i]) if (P.b[q] === 0 && !reg.has(q)) return false;
    // pedras do alvo não podem ter liberdade fora da região
    for (const i of P.alvo) for (const q of g[i]) if (P.b[q] === 0 && !reg.has(q)) return false;
    return true;
  }

  function chaveDe(b, vez, passes, ko) {
    let s = '';
    for (let i = 0; i < b.length; i++) s += b[i];
    return s + vez + passes + ko;
  }

  function Solver(P, opc) {
    opc = opc || {};
    this.P = P;
    this.limiteNos = opc.limiteNos || 3e6;
    this.nos = 0;
    this.estouro = false;
    this.tt = new Map();
    this.alvoSet = P.alvo.slice();
    this.reg = P.regiao.slice();
    this.regSet = new Set(this.reg);
    this.maxProf = opc.maxProf || 60;
  }
  // estado: { t: Tab, vez, passes }
  Solver.prototype.alvoCapturado = function (b) {
    for (let i = 0; i < this.alvoSet.length; i++) if (b[this.alvoSet[i]] === this.P.def) return false;
    return true;
  };
  Solver.prototype.alvoVivoBenson = function (b) {
    // vida incondicional do defensor
    const P = this.P;
    const vivas = Go.benson(Array.from(b), P.n, P.def);
    if (!vivas.length) return false;
    const s = new Set(vivas);
    for (let i = 0; i < this.alvoSet.length; i++) if (s.has(this.alvoSet[i])) return true;
    return false;
  };
  // Valor do ponto de vista do atacante. Devolve {v, d}: resultado e nº de lances até o fim com jogo ótimo.
  Solver.prototype.resolver = function (t, vez, passes, caminho, prof) {
    const P = this.P;
    if (this.alvoCapturado(t.b)) return { v: A, d: 0 };
    if (this.alvoVivoBenson(t.b)) return { v: D, d: 0 };
    if (passes >= 2) return { v: D, d: 0 };
    if (prof > this.maxProf) { this.estouro = true; return { v: L, d: 0 }; }
    if (++this.nos > this.limiteNos) { this.estouro = true; return { v: L, d: 0 }; }
    const chave = chaveDe(t.b, vez, passes, t.ko);
    const gravado = this.tt.get(chave);
    if (gravado) return gravado;
    if (caminho.has(chave)) return { v: L, d: 0 };
    caminho.add(chave);

    const atacando = vez === P.atac;
    // lances possíveis: pontos da região + passe
    const lances = [];
    const salvaB = t.b.slice(), salvaKo = t.ko;
    for (let k = 0; k < this.reg.length; k++) {
      const p = this.reg[k];
      if (t.b[p] !== 0) continue;
      const r = t.jogar(p, vez, false);
      if (r < 0) continue;
      // jogou: guardar o estado e restaurar
      const resultado = { p: p, b: t.b.slice(), ko: t.ko };
      lances.push(resultado);
      t.b.set(salvaB); t.ko = salvaKo;
    }
    let melhor = null;
    // passe
    lances.push({ p: -1, b: salvaB, ko: -1 });
    // ordem: lances com mais capturas / perto do alvo primeiro não é necessário para a correção
    for (let k = 0; k < lances.length; k++) {
      const m = lances[k];
      t.b.set(m.b); t.ko = m.ko;
      const r = this.resolver(t, 3 - vez, m.p < 0 ? passes + 1 : 0, caminho, prof + 1);
      const val = { v: r.v, d: r.d + 1 };
      if (melhor === null || melhorQue(val, melhor, atacando)) melhor = val;
      // corte: já achou vitória do próprio lado (a menor distância não importa para a correção do valor)
      if ((atacando && val.v === A) || (!atacando && val.v === D)) {
        // continua só se quiser a menor distância; aqui basta o valor, d é aproximado
        break;
      }
    }
    t.b.set(salvaB); t.ko = salvaKo;
    caminho.delete(chave);
    if (melhor.v !== L && !this.estouro) this.tt.set(chave, melhor);
    else if (melhor.v !== L) this.tt.set(chave, melhor);
    return melhor;
  };
  function melhorQue(a, b, atacando) {
    const sa = atacando ? a.v : -a.v, sb = atacando ? b.v : -b.v;
    if (sa !== sb) return sa > sb;
    // mesmo resultado: quem vence quer terminar logo; quem perde quer resistir
    if (sa > 0) return a.d < b.d;
    return a.d > b.d;
  }

  // Avalia todos os lances de quem joga numa posição: devolve [{p, v, d}] ordenados do melhor para o pior (para quem joga)
  Solver.prototype.avaliar = function (b, vez, ko, passes) {
    const P = this.P;
    const t = new IA.Tab(P.n);
    t.b.set(b); t.ko = ko == null ? -1 : ko;
    const atacando = vez === P.atac;
    const salvaB = t.b.slice(), salvaKo = t.ko, res = [];
    const cand = this.reg.filter((p) => t.b[p] === 0).concat([-1]);
    for (const p of cand) {
      t.b.set(salvaB); t.ko = salvaKo;
      let np = 0;
      if (p >= 0) { const r = t.jogar(p, vez, false); if (r < 0) continue; } else { t.ko = -1; np = (passes || 0) + 1; }
      const r = this.resolver(t, 3 - vez, np, new Set([chaveDe(salvaB, vez, passes || 0, salvaKo)]), 1);
      res.push({ p: p, v: r.v, d: r.d + 1 });
    }
    res.sort((x, y) => (melhorQue(x, y, atacando) ? -1 : (melhorQue(y, x, atacando) ? 1 : 0)));
    // com o mesmo resultado, jogar numa pedra é mais instrutivo do que passar
    if (res.length && res[0].p < 0) {
      const k = res.findIndex((m) => m.p >= 0 && m.v === res[0].v);
      if (k > 0) { const m = res.splice(k, 1)[0]; res.unshift(m); }
    }
    return res;
  };

  // Sequência principal (os dois lados jogam o melhor possível; quem perde resiste o máximo).
  // `primeiro` (opcional) força o primeiro lance. Devolve [{p, c}] e o motivo do fim.
  Solver.prototype.principal = function (b, vez, ko, passes, primeiro, maxLances) {
    const P = this.P, t = new IA.Tab(P.n);
    t.b.set(b); t.ko = ko == null ? -1 : ko;
    const seq = [];
    let np = passes || 0, fim = 'limite';
    for (let i = 0; i < (maxLances || 30); i++) {
      if (this.alvoCapturado(t.b)) { fim = 'capturado'; break; }
      if (this.alvoVivoBenson(t.b)) { fim = 'vivo'; break; }
      if (np >= 2) { fim = 'passes'; break; }
      const lst = this.avaliar(t.b, vez, t.ko, np);
      let m = lst[0];
      if (i === 0 && primeiro != null) m = lst.find((x) => x.p === primeiro) || m;
      if (!m) break;
      if (m.p < 0) { t.ko = -1; np++; } else { t.jogar(m.p, vez, false); np = 0; }
      seq.push({ p: m.p, c: vez });
      vez = 3 - vez;
    }
    return { seq: seq, fim: fim };
  };

  // Resolve o problema inteiro
  function resolverProblema(def, opc) {
    const P = montar(def);
    const S = new Solver(P, opc);
    if (!selada(P)) return { erro: 'área não selada', P: P };
    const lances = S.avaliar(P.b, P.vez, -1, 0);
    const melhorV = lances.length ? lances[0].v : L;
    const atacando = P.vez === P.atac;
    // resultado do ponto de vista de quem joga primeiro
    let resultado;
    if (melhorV === A) resultado = 'atacante vence';
    else if (melhorV === D) resultado = 'defensor vence';
    else resultado = 'ciclo';
    const certos = lances.filter((m) => m.v === melhorV && m.p >= 0).map((m) => m.p);
    return { P: P, resultado: resultado, valor: melhorV, certos: certos, lances: lances, nos: S.nos, estouro: S.estouro, solver: S };
  }

  raiz.Tsume = { montar: montar, selada: selada, Solver: Solver, resolverProblema: resolverProblema, A: A, D: D, L: L };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Tsume;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
