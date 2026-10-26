/* ==========================================================================
   IgoON! - ia.js  (o computador)
   Busca em árvore Monte Carlo (MCTS) com RAVE, escrita do zero para este projeto.
   Não usa código de outros programas de Go. Funciona na página, no Web Worker (motor.js) e no Node.

   Como pensa: joga muitas partidas rápidas "de mentirinha" a partir da posição (as jogadas dessas
   partidas seguem regras simples: capturar, salvar pedras em atari, não tapar o próprio olho) e
   escolhe o lance que mais venceu. Quanto mais partidas, mais forte (os 5 níveis só mudam isso).

   Limites honestos: a força não é calibrada em kyu/dan; em 19x19 o computador é bem mais fraco
   que em 9x9 (o tabuleiro é grande demais para tantas partidas de mentirinha); ele não desiste.
   Dentro da busca vale só o ko simples; a conferência final dos lances (inclusive superko) é feita
   com regras.js, o mesmo motor que arbitra a partida.
   ========================================================================== */
(function (raiz) {
  'use strict';
  const Go = raiz.Go || (typeof require !== 'undefined' ? require('./regras.js') : null);

  /* ---------- sorteio com semente (xorshift32) ---------- */
  function Sorteio(semente) {
    let s = (semente | 0) || 0x9e3779b9;
    this.prox = function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0); };
    this.ate = function (k) { return this.prox() % k; };
    this.f = function () { return this.prox() / 4294967296; };
  }

  /* ---------- tabuleiro rápido ---------- */
  const cacheGeo = {};
  function geo(n) {
    if (cacheGeo[n]) return cacheGeo[n];
    const N = n * n, viz = [], diag = [], borda = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % n, y = (i / n) | 0, v = [], d = [];
      if (y > 0) v.push(i - n); if (x > 0) v.push(i - 1); if (x < n - 1) v.push(i + 1); if (y < n - 1) v.push(i + n);
      if (x > 0 && y > 0) d.push(i - n - 1); if (x < n - 1 && y > 0) d.push(i - n + 1);
      if (x > 0 && y < n - 1) d.push(i + n - 1); if (x < n - 1 && y < n - 1) d.push(i + n + 1);
      viz.push(Int16Array.from(v)); diag.push(Int16Array.from(d)); borda[i] = v.length < 4 ? 1 : 0;
    }
    return (cacheGeo[n] = { n: n, N: N, viz: viz, diag: diag, borda: borda });
  }

  function Tab(n) {
    const G = geo(n);
    this.n = n; this.N = G.N; this.viz = G.viz; this.diag = G.diag; this.borda = G.borda;
    this.b = new Uint8Array(G.N);
    this.ko = -1;
    this.visto = new Uint32Array(G.N); this.lvisto = new Uint32Array(G.N); this.marca = 0;
    this.gst = new Int16Array(G.N); this.gn = 0; this.umaLib = -1;
    this.lp = 0; this.tp = 0;
  }
  Tab.prototype.copiarDe = function (o) { this.b.set(o.b); this.ko = o.ko; };
  // percorre o grupo de p; devolve o número de liberdades; deixa as pedras em gst[0..gn) e uma liberdade em umaLib
  Tab.prototype.explorar = function (p) {
    const b = this.b, cor = b[p], viz = this.viz, gst = this.gst, visto = this.visto, lvisto = this.lvisto;
    const m = ++this.marca;
    let gn = 0, libs = 0, ult = -1;
    gst[gn++] = p; visto[p] = m;
    for (let k = 0; k < gn; k++) {
      const vs = viz[gst[k]];
      for (let j = 0; j < vs.length; j++) {
        const q = vs[j], v = b[q];
        if (v === 0) { if (lvisto[q] !== m) { lvisto[q] = m; libs++; ult = q; } }
        else if (v === cor && visto[q] !== m) { visto[q] = m; gst[gn++] = q; }
      }
    }
    this.gn = gn; this.umaLib = ult;
    return libs;
  };
  // joga a pedra de cor c em p. Devolve nº de capturas, -1 se ilegal (ocupado, ko, suicídio),
  // -2 se rejeitada por ser auto-atari (só quando `evitar`), e então o tabuleiro fica como estava.
  Tab.prototype.jogar = function (p, c, evitar) {
    const b = this.b, viz = this.viz;
    if (b[p] !== 0 || p === this.ko) return -1;
    const o = 3 - c, koAntes = this.ko, vs = viz[p];
    b[p] = c;
    let cap = 0, ponto = -1;
    for (let j = 0; j < vs.length; j++) {
      const q = vs[j];
      if (b[q] === o && this.explorar(q) === 0) {
        for (let k = 0; k < this.gn; k++) { b[this.gst[k]] = 0; }
        cap += this.gn; ponto = this.gst[0];
      }
    }
    const l = this.explorar(p);
    if (l === 0) { b[p] = 0; return -1; }       // suicídio (só acontece sem capturas)
    if (evitar && cap === 0 && l === 1) { b[p] = 0; this.ko = koAntes; return -2; }
    this.lp = l; this.tp = this.gn;
    this.ko = (cap === 1 && this.gn === 1 && l === 1) ? ponto : -1;
    return cap;
  };
  Tab.prototype.ehOlho = function (p, c) {
    const b = this.b, vs = this.viz[p];
    for (let j = 0; j < vs.length; j++) if (b[vs[j]] !== c) return false;
    const ds = this.diag[p], o = 3 - c;
    let e = 0;
    for (let j = 0; j < ds.length; j++) if (b[ds[j]] === o) e++;
    return this.borda[p] ? e < 1 : e < 2;
  };
  // pontuação por área: preto menos branco (sem komi)
  Tab.prototype.area = function () {
    const b = this.b, N = this.N, viz = this.viz, visto = this.visto, m = ++this.marca, gst = this.gst;
    let pb = 0, pw = 0;
    for (let i = 0; i < N; i++) {
      const v = b[i];
      if (v === 1) pb++; else if (v === 2) pw++;
      else if (visto[i] !== m) {
        let gn = 0, tocaB = false, tocaW = false;
        gst[gn++] = i; visto[i] = m;
        for (let k = 0; k < gn; k++) {
          const vs = viz[gst[k]];
          for (let j = 0; j < vs.length; j++) {
            const q = vs[j], w = b[q];
            if (w === 0) { if (visto[q] !== m) { visto[q] = m; gst[gn++] = q; } }
            else if (w === 1) tocaB = true; else tocaW = true;
          }
        }
        if (tocaB && !tocaW) pb += gn; else if (tocaW && !tocaB) pw += gn;
      }
    }
    return pb - pw;
  };

  /* ---------- partida de mentirinha ---------- */
  // joga até os dois lados não terem mais o que jogar. `seq` registra (ponto, cor) para o RAVE.
  function simular(t, vez, ultimo, rnd, seq, nseq, limite) {
    let passes = 0, nm = 0;
    const N = t.N, b = t.b, viz = t.viz;
    while (passes < 2 && nm < limite) {
      let p = -1;
      // 1) capturar ou salvar perto do último lance
      if (ultimo >= 0) {
        const vs = viz[ultimo];
        let candCap = -1, candSalva = -1;
        for (let j = 0; j < vs.length; j++) {
          const q = vs[j], v = b[q];
          if (v === 0) continue;
          if (t.explorar(q) === 1) { if (v === vez) { if (candSalva < 0) candSalva = t.umaLib; } else if (candCap < 0) candCap = t.umaLib; }
        }
        if (b[ultimo] !== 0 && b[ultimo] !== vez && t.explorar(ultimo) === 1 && candCap < 0) candCap = t.umaLib;
        if (candCap >= 0 && t.jogar(candCap, vez, false) >= 0) p = candCap;
        else if (candSalva >= 0 && rnd.f() < 0.9 && t.jogar(candSalva, vez, true) >= 0) p = candSalva;
      }
      // 2) sorteio
      if (p < 0) {
        const ini = rnd.ate(N);
        for (let k = 0; k < N; k++) {
          let q = ini + k; if (q >= N) q -= N;
          if (b[q] !== 0 || q === t.ko) continue;
          if (t.ehOlho(q, vez)) continue;
          const r = t.jogar(q, vez, rnd.f() < 0.95);
          if (r >= 0) { p = q; break; }
        }
      }
      if (p < 0) { passes++; ultimo = -1; t.ko = -1; } else { passes = 0; ultimo = p; }
      if (nseq !== null) { seq.p[nseq.n] = p; seq.c[nseq.n] = vez; nseq.n++; }
      nm++;
      vez = 3 - vez;
    }
    return t.area();
  }

  /* ---------- árvore ---------- */
  function No(p, c) { this.p = p; this.c = c; this.h = 0; this.n = 0; this.w = 0; this.an = 0; this.aw = 0; this.hijos = []; this.nao = null; this.idx = null; }

  function koDe(g) {
    // ponto de ko simples, se o último lance foi uma captura de ko
    const L = g.lances;
    for (let i = L.length - 1; i >= 0; i--) {
      const l = L[i];
      if (l.p === Go.RETOMAR) continue;
      if (l.p < 0 || !l.cap || l.cap.length !== 1) return -1;
      const gr = Go.grupo(g.b, g.n, l.p);
      return gr.pedras.length === 1 && gr.libs.length === 1 && gr.libs[0] === l.cap[0] ? l.cap[0] : -1;
    }
    return -1;
  }
  function ultimoLance(g) {
    for (let i = g.lances.length - 1; i >= 0; i--) { if (g.lances[i].p !== Go.RETOMAR) return g.lances[i]; }
    return null;
  }

  // candidatos para o nó: pontos vazios que não são olho próprio (e, em tabuleiros grandes, perto das pedras)
  function candidatos(t, vez, prof) {
    const N = t.N, b = t.b, n = t.n, res = [];
    let usaPerto = n >= 11, perto = null;
    if (usaPerto) {
      perto = new Uint8Array(N);
      let pedras = 0;
      for (let i = 0; i < N; i++) if (b[i]) {
        pedras++;
        const x = i % n, y = (i / n) | 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 4) continue;
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < n && yy < n) perto[yy * n + xx] = 1;
        }
      }
      if (pedras < 6) {
        for (let i = 0; i < N; i++) { const x = i % n, y = (i / n) | 0; const e = Math.min(x, y, n - 1 - x, n - 1 - y); if (e === 2 || e === 3) perto[i] = 1; }
      }
    }
    for (let i = 0; i < N; i++) {
      if (b[i] !== 0) continue;
      if (usaPerto && !perto[i]) continue;
      if (t.ehOlho(i, vez)) continue;
      res.push(i);
    }
    return res;
  }

  const K_RAVE = 300, C_UCT = 0.08, C_BIAS = 0.4;

  // Palpite tático barato (antes de jogar em p): capturar ou salvar pedras em atari ajudam; lances soltos na borda atrapalham
  function palpite(t, p, vez) {
    const b = t.b, vs = t.viz[p];
    let h = 0, vizPedras = 0;
    for (let j = 0; j < vs.length; j++) {
      const q = vs[j], v = b[q];
      if (v === 0) continue;
      vizPedras++;
      const l = t.explorar(q);
      if (v !== vez) { if (l === 1) h = Math.max(h, 1); else if (l === 2) h = Math.max(h, 0.25); }
      else if (l === 1) h = Math.max(h, 0.7);
    }
    if (!vizPedras) {
      const n = t.n, x = p % n, y = (p / n) | 0, e = Math.min(x, y, n - 1 - x, n - 1 - y);
      if (e === 0) h -= 0.3; else if (e === 1) h -= 0.1;
    }
    return h;
  }

  function melhorFilho(no) {
    const lnN = Math.log(no.n + 1);
    const beta = Math.sqrt(K_RAVE / (3 * no.n + K_RAVE));
    let melhor = null, mv = -1;
    for (let i = 0; i < no.hijos.length; i++) {
      const f = no.hijos[i];
      const q = f.n ? f.w / f.n : 0.5;
      const a = f.an ? f.aw / f.an : 0.5;
      const v = (1 - beta) * q + beta * a + C_UCT * Math.sqrt(lnN / (f.n + 1)) + C_BIAS * f.h / Math.sqrt(f.n + 1);
      if (v > mv) { mv = v; melhor = f; }
    }
    return melhor;
  }

  /* ---------- níveis ---------- */
  // sims: partidas de mentirinha; ms: limite de segurança de tempo (muda com a velocidade do aparelho)
  const NIVEIS = {
    1: { sims: 0, ms: 0 },
    2: { sims: 120, ms: 1500 },
    3: { sims: 600, ms: 3000 },
    4: { sims: 2500, ms: 7000 },
    5: { sims: 9000, ms: 15000 }
  };

  // Escolhe o lance do computador (jogador g.vez). opc: {nivel, sims, ms, semente, ritmo(fn de progresso)}
  function escolher(g, opc) {
    opc = opc || {};
    const nivel = opc.nivel || 3;
    const cfg = NIVEIS[nivel] || NIVEIS[3];
    const sims = opc.sims != null ? opc.sims : cfg.sims;
    const ms = opc.ms != null ? opc.ms : cfg.ms;
    const rnd = new Sorteio(opc.semente != null ? opc.semente : (Date.now() ^ (g.lances.length * 7919)));
    const n = g.n, N = n * n, cor = g.vez;
    const ini = Date.now();
    const ult = ultimoLance(g);
    const oponentePassou = !!(ult && ult.p === Go.PASSE && ult.c !== cor);
    const t0 = new Tab(n);
    for (let i = 0; i < N; i++) t0.b[i] = g.b[i];
    t0.ko = koDe(g);

    // lances legais pelo motor oficial (inclui superko)
    const legais = [];
    for (let i = 0; i < N; i++) if (g.b[i] === 0 && !Go.tentar(g, i).erro) legais.push(i);
    const legalSet = new Set(legais);

    let cands = candidatos(t0, cor).filter((i) => legalSet.has(i));
    const nlances = g.lances.length;

    // nível 1: sem busca. Regras simples: captura, salva em atari, senão sorteia
    if (nivel === 1 || sims === 0) {
      return nivel1(g, t0, cands, legalSet, rnd, oponentePassou);
    }
    if (!cands.length) return { p: Go.PASSE, vr: 0.5, sims: 0, ms: Date.now() - ini, motivo: 'sem lances úteis' };

    const raizNo = new No(-1, 3 - cor);   // "quem jogou" para chegar aqui: o oponente
    raizNo.nao = cands.slice();
    // embaralha
    for (let i = raizNo.nao.length - 1; i > 0; i--) { const j = rnd.ate(i + 1); const x = raizNo.nao[i]; raizNo.nao[i] = raizNo.nao[j]; raizNo.nao[j] = x; }
    const passe = (oponentePassou || nlances > N * 0.7) ? new No(Go.PASSE, cor) : null;
    if (passe) { raizNo.hijos.push(passe); }
    raizNo.idx = new Int16Array(N + 1).fill(-1);
    if (passe) raizNo.idx[N] = 0;

    const t = new Tab(n);
    const seq = { p: new Int16Array(N * 3 + 80), c: new Uint8Array(N * 3 + 80) };
    const ns = { n: 0 };
    const limite = N * 2 + 40;
    const komi = g.komi;
    let feitas = 0;
    const caminho = [];

    while (feitas < sims) {
      if ((feitas & 15) === 0 && ms && Date.now() - ini > ms) break;
      t.copiarDe(t0);
      caminho.length = 0; ns.n = 0;
      let no = raizNo, vez = cor, ultimo = ult && ult.p >= 0 ? ult.p : -1, passesSeg = oponentePassou ? 1 : 0;
      caminho.push(no);
      let terminal = false;
      // seleção + expansão
      for (;;) {
        if (no.nao === null) { no.nao = candidatos(t, vez); no.idx = new Int16Array(N + 1).fill(-1); embaralhar(no.nao, rnd); }
        let filho = null;
        // expandir um lance ainda não tentado
        while (no.nao.length) {
          const p = no.nao.pop();
          const h = palpite(t, p, vez);
          const r = t.jogar(p, vez, false);
          if (r < 0) continue;
          filho = new No(p, vez); filho.h = h;
          no.idx[p] = no.hijos.length; no.hijos.push(filho);
          seq.p[ns.n] = p; seq.c[ns.n] = vez; ns.n++;
          ultimo = p; passesSeg = 0; vez = 3 - vez;
          break;
        }
        if (filho) { no = filho; caminho.push(no); break; }
        if (!no.hijos.length) { terminal = true; break; }
        // escolher entre os filhos (o filho "passe" do raiz também entra)
        const f = melhorFilho(no);
        if (f.p === Go.PASSE) {
          passesSeg++;
          seq.p[ns.n] = -1; seq.c[ns.n] = vez; ns.n++;
          t.ko = -1; ultimo = -1; vez = 3 - vez;
          no = f; caminho.push(no);
          if (passesSeg >= 2) { terminal = true; break; }
          continue;
        }
        const r = t.jogar(f.p, vez, false);
        if (r < 0) {   // não deveria acontecer; descarta o filho
          no.hijos.splice(no.hijos.indexOf(f), 1);
          no.idx.fill(-1); no.hijos.forEach((h, i) => { no.idx[h.p < 0 ? N : h.p] = i; });
          if (!no.hijos.length) { terminal = true; break; }
          continue;
        }
        seq.p[ns.n] = f.p; seq.c[ns.n] = vez; ns.n++;
        ultimo = f.p; passesSeg = 0; vez = 3 - vez;
        no = f; caminho.push(no);
      }
      // simulação
      let dif;
      if (terminal && passesSeg >= 2) dif = t.area();
      else {
        const base = ns.n;
        dif = simular(t, vez, ultimo, rnd, seq, ns, limite);
        void base;
      }
      dif -= komi;
      const venceu = dif > 0 ? 1 : (dif < 0 ? 2 : 0);
      // retropropagação + RAVE
      for (let d = 0; d < caminho.length; d++) {
        const nd = caminho[d];
        nd.n++;
        if (venceu === nd.c) nd.w++; else if (venceu === 0) nd.w += 0.5;
      }
      for (let d = 0; d < caminho.length; d++) {
        const nd = caminho[d];
        if (!nd.idx) continue;
        const q = d === 0 ? cor : 3 - nd.c;      // quem joga a partir deste nó
        // lances de q posteriores ao nó (a posição d na sequência é o d-ésimo lance)
        const vistos = new Set();
        for (let k = d; k < ns.n; k++) {
          if (seq.c[k] !== q) continue;
          const p = seq.p[k] < 0 ? N : seq.p[k];
          if (p === N && d > 0) continue;
          if (vistos.has(p)) continue;
          vistos.add(p);
          const ci = nd.idx[p];
          if (ci < 0) continue;
          const f = nd.hijos[ci];
          f.an++;
          if (venceu === q) f.aw++; else if (venceu === 0) f.aw += 0.5;
        }
      }
      feitas++;
    }

    // resultado: filho mais visitado
    let melhor = null;
    for (const f of raizNo.hijos) {
      if (!melhor || f.n > melhor.n || (f.n === melhor.n && f.w > melhor.w)) melhor = f;
    }
    const wr = (f) => (f && f.n ? f.w / f.n : 0);
    let escolhido = melhor;
    if (passe && melhor !== passe) {
      // com o oponente passando, passar é a resposta certa quando não perde nada
      if (oponentePassou && wr(passe) >= wr(melhor) - 0.03) escolhido = passe;
      else if (!oponentePassou && wr(passe) > wr(melhor) + 0.02) escolhido = passe;
    }
    if (!escolhido) return { p: Go.PASSE, vr: 0.5, sims: feitas, ms: Date.now() - ini, motivo: 'sem filhos' };
    if (escolhido.p !== Go.PASSE && !legalSet.has(escolhido.p)) return { p: Go.PASSE, vr: wr(escolhido), sims: feitas, ms: Date.now() - ini, motivo: 'ilegal' };
    return { p: escolhido.p, vr: wr(escolhido), sims: feitas, ms: Date.now() - ini,
      ranking: raizNo.hijos.filter((f) => f.p >= 0).sort((a, b) => b.n - a.n).slice(0, 5).map((f) => ({ p: f.p, n: f.n, vr: wr(f) })) };
  }
  function embaralhar(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = rnd.ate(i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; } }

  // nível 1: iniciante. Captura se vê, salva grupo em atari às vezes, senão sorteia. Nunca tapa o próprio olho.
  function nivel1(g, t0, cands, legalSet, rnd, oponentePassou) {
    const n = g.n, N = n * n, cor = g.vez, o = 3 - cor, b = g.b;
    if (oponentePassou) return { p: Go.PASSE, vr: 0.5, sims: 0, ms: 0, motivo: 'iniciante passa quando o outro passa' };
    const capturas = [], salvas = [];
    const vistos = new Set();
    for (let i = 0; i < N; i++) {
      if (!b[i] || vistos.has(i)) continue;
      const gr = Go.grupo(b, n, i);
      gr.pedras.forEach((s) => vistos.add(s));
      if (gr.libs.length === 1 && legalSet.has(gr.libs[0])) {
        if (gr.cor === o) capturas.push(gr.libs[0]);
        else if (rnd.f() < 0.6) salvas.push(gr.libs[0]);
      }
    }
    const todos = [];
    for (let i = 0; i < N; i++) if (legalSet.has(i) && !t0.ehOlho(i, cor)) todos.push(i);
    const escolha = capturas.length ? capturas[rnd.ate(capturas.length)]
      : salvas.length && rnd.f() < 0.7 ? salvas[rnd.ate(salvas.length)]
        : todos.length ? todos[rnd.ate(todos.length)] : Go.PASSE;
    return { p: escolha, vr: 0.5, sims: 0, ms: 0 };
  }

  /* ---------- estimativa de território e pedras mortas ---------- */
  // Joga `sims` partidas de mentirinha a partir da posição e mede quem fica com cada ponto.
  // Devolve dono[i] em [-1, 1] (positivo = preto), e probB/probW
  function estimar(g, opc) {
    opc = opc || {};
    const sims = opc.sims || 300, n = g.n, N = n * n;
    const rnd = new Sorteio(opc.semente != null ? opc.semente : Date.now());
    const t0 = new Tab(n);
    for (let i = 0; i < N; i++) t0.b[i] = g.b[i];
    t0.ko = koDe(g);
    const t = new Tab(n);
    const soma = new Float64Array(N);
    const limite = N * 2 + 40;
    const ini = Date.now();
    let feitas = 0, somaDif = 0;
    const visto = new Uint32Array(N); let marca = 0;
    for (let s = 0; s < sims; s++) {
      if (opc.ms && (s & 7) === 0 && Date.now() - ini > opc.ms) break;
      t.copiarDe(t0);
      const vez = (s & 1) ? 1 : 2;      // metade das vezes cada cor começa
      const ultimo = -1;
      simular(t, vez, ultimo, rnd, null, null, limite);
      // dono final de cada ponto (pedra ou território simples)
      marca++;
      for (let i = 0; i < N; i++) {
        const v = t.b[i];
        if (v) { soma[i] += v === 1 ? 1 : -1; continue; }
        if (visto[i] === marca) continue;
        const pts = [i]; visto[i] = marca; let tB = false, tW = false;
        for (let k = 0; k < pts.length; k++) {
          const vs = t.viz[pts[k]];
          for (let j = 0; j < vs.length; j++) {
            const q = vs[j], w = t.b[q];
            if (w === 0) { if (visto[q] !== marca) { visto[q] = marca; pts.push(q); } } else if (w === 1) tB = true; else tW = true;
          }
        }
        const d = tB && !tW ? 1 : (tW && !tB ? -1 : 0);
        for (let k = 0; k < pts.length; k++) soma[pts[k]] += d;
      }
      somaDif += t.area();
      feitas++;
    }
    const dono = new Array(N);
    for (let i = 0; i < N; i++) dono[i] = feitas ? soma[i] / feitas : 0;
    return { dono: dono, sims: feitas, margem: feitas ? somaDif / feitas - g.komi : 0 };
  }

  // Sugere quais grupos estão mortos e quais regiões são neutras (seki/dame) na fase de marcação.
  function sugerirMortas(g, opc) {
    opc = opc || {};
    const n = g.n, N = n * n, b = g.b;
    const est = estimar(g, { sims: (opc.sims || 400), ms: opc.ms || 4000, semente: opc.semente });
    const dono = est.dono;
    const vivasBenson = { 1: new Set(Go.benson(b, n, 1)), 2: new Set(Go.benson(b, n, 2)) };
    const mortas = [], vistos = new Set();
    const cadeiaVidaPlayout = [];
    for (let i = 0; i < N; i++) {
      if (!b[i] || vistos.has(i)) continue;
      const gr = Go.grupo(b, n, i);
      gr.pedras.forEach((s) => vistos.add(s));
      if (vivasBenson[gr.cor].has(i)) continue;
      let m = 0;
      gr.pedras.forEach((s) => { m += (gr.cor === 1 ? dono[s] : -dono[s]); });
      m /= gr.pedras.length;          // 1 = sempre viva, -1 = sempre morta
      if (m < -0.3) gr.pedras.forEach((s) => mortas.push(s));
      else cadeiaVidaPlayout.push({ cor: gr.cor, m: m });
    }
    // regiões vazias sem dono claro (depois de retirar as mortas) -> neutras
    const b2 = b.slice(); mortas.forEach((s) => { b2[s] = 0; });
    const neutros = [];
    Go.regioes(b2, n).forEach((r) => {
      if (r.bordas[1] && r.bordas[2]) {
        let m = 0; r.pontos.forEach((s) => { m += Math.abs(dono[s]); }); m /= r.pontos.length;
        if (m < 0.5) r.pontos.forEach((s) => neutros.push(s));
      }
    });
    return { mortas: mortas, neutros: neutros, dono: dono, margem: est.margem, sims: est.sims };
  }

  raiz.IA = { escolher: escolher, estimar: estimar, sugerirMortas: sugerirMortas, NIVEIS: NIVEIS, Tab: Tab, simular: simular, Sorteio: Sorteio, koDe: koDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.IA;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
