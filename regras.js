/* ==========================================================================
   IgoON! - regras.js  (motor de regras do Go / Igo / 囲碁, sem interface)
   Funciona no navegador (window.Go), no Web Worker e no Node. Escrito do zero.

   Pontos do tabuleiro: índice i = y * n + x, com x = coluna (0 = esquerda) e y = linha (0 = topo).
   Cores: 0 vazio, 1 preto (kuro), 2 branco (shiro). PASSE = -1.

   Jogo (objeto simples; use Go.copiar/Go.serializar para guardar):
     n, regras ('jp' japonesa | 'cn' chinesa), komi, handicap
     b[]       tabuleiro atual           vez        de quem é a vez (1 ou 2)
     cap[1], cap[2]   prisioneiros: cap[1] = pedras brancas que o preto capturou, cap[2] = o contrário
     passes    passes seguidos            fase 'jogando' | 'marcando' | 'fim'
     lances[]  { c, p, cap[] } (p = -1 passe, p = -2 "retomar o jogo")
     setup     pedras colocadas antes do 1º lance: { 1: [índices], 2: [índices] } (handicap = pretas)
     resultado null ou { tipo: 'pontos'|'desistencia'|'sem-resultado', vencedor, texto, ... }
   Regras implementadas
     - suicídio proibido nas duas regras;
     - ko simples (não recriar a posição de antes do último lance) nas duas;
     - japonesa: se a mesma posição (com a mesma vez) aparecer pela 3ª vez, o jogo termina sem resultado (無勝負);
     - chinesa: superko posicional (nenhuma posição de tabuleiro pode se repetir);
     - fim por dois passes seguidos, depois marcação das pedras mortas e contagem;
     - japonesa: território + prisioneiros (inclui as pedras mortas); chinesa: área (pedras vivas + território).
   ========================================================================== */
(function (raiz) {
  'use strict';

  const PASSE = -1, RETOMAR = -2;
  const oposta = (c) => 3 - c;
  const LETRAS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';   // sem o I, como no Go

  /* ----- vizinhança (cache por tamanho) ----- */
  const VIZ = {};
  function vizinhos(n) {
    if (VIZ[n]) return VIZ[n];
    const v = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const a = [];
        if (y > 0) a.push((y - 1) * n + x);
        if (x > 0) a.push(y * n + x - 1);
        if (x < n - 1) a.push(y * n + x + 1);
        if (y < n - 1) a.push((y + 1) * n + x);
        v.push(a);
      }
    }
    VIZ[n] = v;
    return v;
  }

  /* ----- nomes de coordenadas ----- */
  function nomePonto(i, n) {
    if (i === PASSE) return 'passe';
    return LETRAS[i % n] + (n - Math.floor(i / n));
  }
  function indiceDe(nome, n) {
    const m = /^([A-HJ-Z])(\d{1,2})$/i.exec(String(nome).trim());
    if (!m) return -1;
    const x = LETRAS.indexOf(m[1].toUpperCase()), y = n - parseInt(m[2], 10);
    if (x < 0 || x >= n || y < 0 || y >= n) return -1;
    return y * n + x;
  }

  /* ----- grupos (cadeias) ----- */
  // devolve { pedras: [i...], libs: [i...] } da cadeia que contém o ponto i
  function grupo(b, n, i) {
    const cor = b[i], viz = vizinhos(n);
    const pedras = [i], vistos = new Set([i]), libs = new Set();
    for (let k = 0; k < pedras.length; k++) {
      const p = pedras[k], vs = viz[p];
      for (let j = 0; j < vs.length; j++) {
        const q = vs[j];
        if (b[q] === 0) libs.add(q);
        else if (b[q] === cor && !vistos.has(q)) { vistos.add(q); pedras.push(q); }
      }
    }
    return { pedras: pedras, libs: Array.from(libs), cor: cor };
  }

  const chave = (b) => b.join('');

  /* ----- pontos de handicap ----- */
  function pontosHandicap(n, k) {
    if (k < 2 || k > 9 || n < 7) return null;
    if (n === 7 && k > 4) return null;
    if (n === 9 && k > 5) return null;
    const a = n >= 13 ? 3 : 2, c = n - 1 - a, m = (n - 1) / 2;
    if (m !== Math.floor(m) && k > 4) return null;   // tamanho par não tem centro nem meios
    const P = (x, y) => y * n + x;
    const ur = P(c, a), ll = P(a, c), lr = P(c, c), ul = P(a, a);
    const ordem = { 2: [ur, ll], 3: [ur, ll, lr], 4: [ur, ll, lr, ul] };
    if (k <= 4) return ordem[k];
    const cantos = [ur, ll, lr, ul];
    const centro = P(m, m), esq = P(a, m), dir = P(c, m), cima = P(m, a), baixo = P(m, c);
    if (k === 5) return cantos.concat([centro]);
    if (k === 6) return cantos.concat([esq, dir]);
    if (k === 7) return cantos.concat([esq, dir, centro]);
    if (k === 8) return cantos.concat([esq, dir, cima, baixo]);
    return cantos.concat([esq, dir, cima, baixo, centro]);
  }

  function komiPadrao(regras, handicap) {
    if (handicap >= 2) return 0.5;
    return regras === 'cn' ? 7.5 : 6.5;
  }

  /* ----- novo jogo ----- */
  function novo(n, opc) {
    opc = opc || {};
    const regras = opc.regras === 'cn' ? 'cn' : 'jp';
    const handicap = opc.handicap >= 2 ? opc.handicap | 0 : 0;
    const g = {
      n: n, regras: regras, handicap: handicap,
      komi: typeof opc.komi === 'number' ? opc.komi : komiPadrao(regras, handicap),
      b: new Array(n * n).fill(0), vez: 1, cap: [0, 0, 0], passes: 0, fase: 'jogando',
      lances: [], setup: { 1: [], 2: [] }, resultado: null
    };
    let pre = opc.setup;
    if (!pre && handicap >= 2) {
      const pts = pontosHandicap(n, handicap);
      if (pts) { pre = { 1: pts, 2: [] }; g.vez = 2; } else g.handicap = 0;
    }
    if (pre) {
      [1, 2].forEach((c) => (pre[c] || []).forEach((i) => { if (g.b[i] === 0) { g.b[i] = c; g.setup[c].push(i); } }));
    }
    if (opc.primeiro === 1 || opc.primeiro === 2) g.vez = opc.primeiro;
    g.vezInicial = g.vez;
    iniciarHistorico(g);
    return g;
  }

  // dados derivados (não vão para o armazenamento: refeitos pelo refazer)
  function iniciarHistorico(g) {
    const k = chave(g.b);
    Object.defineProperty(g, '_pos', { value: [k], writable: true, enumerable: false, configurable: true });
    Object.defineProperty(g, '_set', { value: new Set([k]), writable: true, enumerable: false, configurable: true });
    Object.defineProperty(g, '_rep', { value: {}, writable: true, enumerable: false, configurable: true });
    g._rep[k + g.vez] = 1;
  }

  /* ----- testar um lance sem aplicar ----- */
  // devolve { erro } ou { b: novoTabuleiro, capturas: [...] }
  function tentar(g, p) {
    const n = g.n, b = g.b;
    if (!Number.isInteger(p) || p < 0 || p >= n * n) return { erro: 'fora' };
    if (b[p] !== 0) return { erro: 'ocupado' };
    const c = g.vez, o = oposta(c), viz = vizinhos(n);
    const b2 = b.slice();
    b2[p] = c;
    const capturas = [];
    const feitos = new Set();
    for (let j = 0; j < viz[p].length; j++) {
      const q = viz[p][j];
      if (b2[q] !== o || feitos.has(q)) continue;
      const gr = grupo(b2, n, q);
      gr.pedras.forEach((s) => feitos.add(s));
      if (gr.libs.length === 0) gr.pedras.forEach((s) => { capturas.push(s); });
    }
    capturas.forEach((s) => { b2[s] = 0; });
    if (grupo(b2, n, p).libs.length === 0) return { erro: 'suicidio' };
    const k2 = chave(b2), pos = g._pos;
    if (pos.length >= 2 && k2 === pos[pos.length - 2]) return { erro: 'ko' };
    if (g.regras === 'cn' && g._set.has(k2)) return { erro: 'superko' };
    return { b: b2, capturas: capturas, chave: k2 };
  }

  function legal(g, p) {
    if (g.fase !== 'jogando') return false;
    return !tentar(g, p).erro;
  }

  function lancesLegais(g) {
    const r = [];
    if (g.fase !== 'jogando') return r;
    for (let i = 0; i < g.n * g.n; i++) if (g.b[i] === 0 && !tentar(g, i).erro) r.push(i);
    return r;
  }

  /* ----- jogar, passar, desistir, retomar ----- */
  function jogar(g, p) {
    if (g.fase === 'fim') return { ok: false, erro: 'fim' };
    if (g.fase === 'marcando') return { ok: false, erro: 'marcando' };
    const c = g.vez;
    if (p === PASSE) {
      g.lances.push({ c: c, p: PASSE, cap: [] });
      g.passes++;
      g.vez = oposta(c);
      g._pos.push(g._pos[g._pos.length - 1]);
      if (g.passes >= 2) g.fase = 'marcando';
      return { ok: true, passe: true, capturas: [] };
    }
    const t = tentar(g, p);
    if (t.erro) return { ok: false, erro: t.erro };
    g.b = t.b;
    g.cap[c] += t.capturas.length;
    g.lances.push({ c: c, p: p, cap: t.capturas });
    g.passes = 0;
    g.vez = oposta(c);
    g._pos.push(t.chave);
    g._set.add(t.chave);
    contarRepeticao(g);
    return { ok: true, capturas: t.capturas };
  }

  // regra japonesa: 3ª ocorrência da mesma posição com a mesma vez = sem resultado
  function contarRepeticao(g) {
    const k = g._pos[g._pos.length - 1] + g.vez;
    g._rep[k] = (g._rep[k] || 0) + 1;
    if (g.regras === 'jp' && g._rep[k] >= 3 && g.fase !== 'fim') {
      g.fase = 'fim';
      g.resultado = { tipo: 'sem-resultado', vencedor: 0, texto: 'Sem resultado' };
    }
  }

  function desistir(g, cor) {
    if (g.fase === 'fim') return false;
    const c = cor || g.vez;
    g.fase = 'fim';
    g.resultado = { tipo: 'desistencia', vencedor: oposta(c), texto: (c === 1 ? 'W' : 'B') + '+R', desistiu: c };
    return true;
  }

  function retomar(g) {
    if (g.fase !== 'marcando') return false;
    g.fase = 'jogando';
    g.passes = 0;
    g.lances.push({ c: g.vez, p: RETOMAR, cap: [] });
    return true;
  }

  /* ----- refazer a partir da lista de lances (desfazer, abrir partida, revisão) ----- */
  function copiarConfig(g) {
    return { regras: g.regras, komi: g.komi, handicap: g.handicap, setup: { 1: g.setup[1].slice(), 2: g.setup[2].slice() }, vezInicial: g.vezInicial };
  }

  function refazer(n, cfg, lances, ate) {
    const g = novo(n, { regras: cfg.regras, komi: cfg.komi, handicap: 0, setup: cfg.setup || { 1: [], 2: [] }, primeiro: cfg.vezInicial });
    g.handicap = cfg.handicap || 0;
    const lim = typeof ate === 'number' ? Math.min(ate, lances.length) : lances.length;
    for (let i = 0; i < lim; i++) {
      const l = lances[i];
      if (l.p === RETOMAR) { retomar(g); continue; }
      if (g.fase === 'marcando') retomar(g);
      // respeita a cor registrada (partidas importadas podem ter a mesma cor duas vezes seguidas)
      if (l.c && l.c !== g.vez) g.vez = l.c;
      const r = jogar(g, l.p);
      if (!r.ok) return { erro: r.erro, indice: i, g: g };
    }
    return { g: g };
  }

  // tira os últimos "quantos" lances de verdade (passes contam; os marcadores de "retomar" não)
  function desfazer(g, quantos) {
    let k = quantos || 1, i = g.lances.length;
    while (i > 0 && k > 0) { i--; if (g.lances[i].p !== RETOMAR) k--; }
    const r = refazer(g.n, copiarConfig(g), g.lances, i);
    return r.g;
  }

  /* Monta um jogo a partir de um desenho em texto (usado nas lições e nos problemas):
       'X' preto, 'O' branco, '.' vazio; linhas = linhas do tabuleiro, de cima para baixo. */
  function deTabuleiro(linhas, opc) {
    opc = opc || {};
    const n = linhas.length, setup = { 1: [], 2: [] };
    linhas.forEach((l, y) => {
      if (l.length !== n) throw new Error('tabuleiro não é quadrado');
      for (let x = 0; x < n; x++) { const ch = l[x]; if (ch === 'X') setup[1].push(y * n + x); else if (ch === 'O') setup[2].push(y * n + x); }
    });
    const g = novo(n, { regras: opc.regras, komi: opc.komi, setup: setup, primeiro: opc.vez || 1 });
    return g;
  }

  /* ----- cópia e armazenamento ----- */
  function serializar(g) {
    return { n: g.n, regras: g.regras, komi: g.komi, handicap: g.handicap, setup: g.setup, vezInicial: g.vezInicial, lances: g.lances, fase: g.fase, resultado: g.resultado };
  }
  function restaurar(d) {
    if (!d || !Number.isInteger(d.n) || d.n < 2 || d.n > 25 || !Array.isArray(d.lances)) return null;
    const ponto = (p) => Number.isInteger(p) && p >= 0 && p < d.n * d.n;
    if (d.komi != null && !Number.isFinite(d.komi)) return null;
    if (d.vezInicial != null && d.vezInicial !== 1 && d.vezInicial !== 2) return null;
    if (d.regras != null && d.regras !== 'jp' && d.regras !== 'cn') return null;
    if (d.handicap != null && (!Number.isInteger(d.handicap) || d.handicap < 0 || d.handicap > d.n * d.n)) return null;
    if (d.setup && (!Array.isArray(d.setup[1]) || !Array.isArray(d.setup[2]) ||
      !d.setup[1].every(ponto) || !d.setup[2].every(ponto) || d.setup[1].some((p) => d.setup[2].includes(p)))) return null;
    if (!d.lances.every((l) => l && (l.c === 1 || l.c === 2) && (ponto(l.p) || l.p === PASSE || l.p === RETOMAR))) return null;
    if (d.fase != null && !['jogando', 'marcando', 'fim'].includes(d.fase)) return null;
    if (d.fase === 'fim') {
      const res = d.resultado, pl = res && res.placar;
      if (!res || !['pontos', 'desistencia', 'sem-resultado', 'importado'].includes(res.tipo) ||
        ![0, 1, 2].includes(res.vencedor) || typeof res.texto !== 'string') return null;
      if (pl && (!Array.isArray(pl.territorios) || !pl.territorios.every((t) => t && [1, 2].includes(t.dono) && Array.isArray(t.pontos) && t.pontos.every(ponto)) ||
        !Array.isArray(pl.mortas) || !pl.mortas.every(ponto) || !Number.isFinite(pl.komi) ||
        ![pl.preto, pl.branco].every((c) => c && ['territorio', 'total', d.regras === 'cn' ? 'pedras' : 'prisioneiros'].every((k) => Number.isFinite(c[k]))))) return null;
    }
    const r = refazer(d.n, { regras: d.regras, komi: d.komi, handicap: d.handicap, setup: d.setup, vezInicial: d.vezInicial }, d.lances);
    if (r.erro) return null;
    const g = r.g;
    if (d.fase === 'fim' && g.fase !== 'fim') { g.fase = 'fim'; g.resultado = d.resultado; }
    else if (d.fase === 'fim') g.resultado = g.resultado || d.resultado;
    return g;
  }

  /* ==========================================================================
     Território, área, pedras vivas
     ========================================================================== */
  // regiões de pontos vazios (depois de tirar as mortas): { pontos, bordas:{1,2} }
  function regioes(b, n) {
    const viz = vizinhos(n), visto = new Array(n * n).fill(false), res = [];
    for (let i = 0; i < n * n; i++) {
      if (b[i] !== 0 || visto[i]) continue;
      const pontos = [i], bordas = { 1: false, 2: false };
      visto[i] = true;
      for (let k = 0; k < pontos.length; k++) {
        const vs = viz[pontos[k]];
        for (let j = 0; j < vs.length; j++) {
          const q = vs[j];
          if (b[q] === 0) { if (!visto[q]) { visto[q] = true; pontos.push(q); } }
          else bordas[b[q]] = true;
        }
      }
      res.push({ pontos: pontos, bordas: bordas });
    }
    return res;
  }

  /* Contagem final.
       mortas  : índices de pedras marcadas como mortas (qualquer cor);
       neutros : índices de regiões vazias que o jogador marcou como "seki" (nenhum ponto, só na regra japonesa).
     Devolve também "donos": 0 neutro, 1 preto, 2 branco para cada ponto (pedras vivas e território). */
  function pontuar(g, mortas, neutros) {
    const n = g.n, b = g.b.slice();
    const mortasSet = new Set(mortas || []);
    const neutroSet = new Set(neutros || []);
    const mortasDe = { 1: 0, 2: 0 };
    mortasSet.forEach((i) => { if (b[i] !== 0) { mortasDe[b[i]]++; b[i] = 0; } });
    const donos = new Array(n * n).fill(0);
    const terr = { 1: 0, 2: 0 }, pedras = { 1: 0, 2: 0 };
    for (let i = 0; i < n * n; i++) if (b[i]) { donos[i] = b[i]; pedras[b[i]]++; }
    const regs = regioes(b, n), territorios = [];
    regs.forEach((r) => {
      const d = r.bordas[1] && !r.bordas[2] ? 1 : (r.bordas[2] && !r.bordas[1] ? 2 : 0);
      if (!d) return;
      if (g.regras === 'jp' && r.pontos.some((i) => neutroSet.has(i))) return;
      terr[d] += r.pontos.length;
      r.pontos.forEach((i) => { donos[i] = d; });
      territorios.push({ dono: d, pontos: r.pontos });
    });
    let preto, branco;
    if (g.regras === 'jp') {
      const prisPreto = g.cap[1] + mortasDe[2], prisBranco = g.cap[2] + mortasDe[1];
      preto = { territorio: terr[1], prisioneiros: prisPreto, total: terr[1] + prisPreto };
      branco = { territorio: terr[2], prisioneiros: prisBranco, total: terr[2] + prisBranco + g.komi };
    } else {
      preto = { territorio: terr[1], pedras: pedras[1], total: terr[1] + pedras[1] };
      branco = { territorio: terr[2], pedras: pedras[2], total: terr[2] + pedras[2] + g.komi };
    }
    const dif = preto.total - branco.total;
    const vencedor = dif > 0 ? 1 : (dif < 0 ? 2 : 0);
    const mag = Math.abs(dif);
    const fm = (x) => (Number.isInteger(x) ? String(x) : String(x).replace(/\.0$/, ''));
    return {
      regras: g.regras, preto: preto, branco: branco, komi: g.komi, diferenca: mag, vencedor: vencedor,
      texto: vencedor === 0 ? 'Empate' : (vencedor === 1 ? 'B+' : 'W+') + fm(mag),
      donos: donos, territorios: territorios, mortas: Array.from(mortasSet), mortasDe: mortasDe
    };
  }

  function encerrar(g, mortas, neutros) {
    const r = pontuar(g, mortas, neutros);
    g.fase = 'fim';
    g.resultado = { tipo: 'pontos', vencedor: r.vencedor, texto: r.texto, placar: r };
    return r;
  }

  /* ----- Benson: cadeias que não podem ser capturadas nunca (vida incondicional) ----- */
  function benson(b, n, cor) {
    const viz = vizinhos(n), N = n * n;
    // cadeias da cor
    const idCadeia = new Array(N).fill(-1), cadeias = [];
    for (let i = 0; i < N; i++) {
      if (b[i] !== cor || idCadeia[i] >= 0) continue;
      const gr = grupo(b, n, i);
      gr.pedras.forEach((s) => { idCadeia[s] = cadeias.length; });
      cadeias.push({ pedras: gr.pedras, libs: new Set(gr.libs) });
    }
    // regiões: componentes de pontos que não são da cor
    const idReg = new Array(N).fill(-1), regs = [];
    for (let i = 0; i < N; i++) {
      if (b[i] === cor || idReg[i] >= 0) continue;
      const pts = [i];
      idReg[i] = regs.length;
      for (let k = 0; k < pts.length; k++) {
        const vs = viz[pts[k]];
        for (let j = 0; j < vs.length; j++) { const q = vs[j]; if (b[q] !== cor && idReg[q] < 0) { idReg[q] = regs.length; pts.push(q); } }
      }
      const vazios = pts.filter((p) => b[p] === 0);
      const vizCad = new Set();
      pts.forEach((p) => viz[p].forEach((q) => { if (b[q] === cor) vizCad.add(idCadeia[q]); }));
      regs.push({ pontos: pts, vazios: vazios, cadeias: vizCad });
    }
    let cadVivas = new Set(cadeias.map((_, i) => i));
    let regVivas = new Set(regs.map((_, i) => i));
    // uma região é "vital" para uma cadeia se todos os seus pontos vazios são liberdades da cadeia
    const vital = (ri, ci) => {
      const r = regs[ri];
      if (!r.cadeias.has(ci)) return false;
      if (!r.vazios.length) return false;
      return r.vazios.every((p) => cadeias[ci].libs.has(p));
    };
    let mudou = true;
    while (mudou) {
      mudou = false;
      cadVivas.forEach((ci) => {
        let cont = 0;
        regVivas.forEach((ri) => { if (vital(ri, ci)) cont++; });
        if (cont < 2) { cadVivas.delete(ci); mudou = true; }
      });
      regVivas.forEach((ri) => {
        let ok = true;
        regs[ri].cadeias.forEach((ci) => { if (!cadVivas.has(ci)) ok = false; });
        if (!ok) { regVivas.delete(ri); mudou = true; }
      });
    }
    const vivas = [];
    cadVivas.forEach((ci) => cadeias[ci].pedras.forEach((p) => vivas.push(p)));
    return vivas;
  }

  /* ----- texto de apoio ----- */
  const ERROS = {
    ocupado: 'Esse ponto já tem uma pedra.',
    suicidio: 'Suicídio não vale: a sua pedra ficaria sem liberdades e não capturaria nada.',
    ko: 'Ko: você não pode recriar a posição de antes do último lance. Jogue em outro lugar primeiro.',
    superko: 'Repetição: esse lance recriaria uma posição que já apareceu na partida (regra chinesa).',
    fora: 'Esse ponto está fora do tabuleiro.',
    fim: 'A partida terminou.',
    marcando: 'Os dois passaram: marque as pedras mortas ou continue o jogo.'
  };

  function copiar(g) {
    return restaurar(serializar(g));
  }

  raiz.Go = {
    PASSE: PASSE, RETOMAR: RETOMAR, ERROS: ERROS, LETRAS: LETRAS,
    oposta: oposta, vizinhos: vizinhos, nomePonto: nomePonto, indiceDe: indiceDe,
    grupo: grupo, regioes: regioes, benson: benson,
    pontosHandicap: pontosHandicap, komiPadrao: komiPadrao,
    novo: novo, deTabuleiro: deTabuleiro, tentar: tentar, legal: legal, lancesLegais: lancesLegais,
    jogar: jogar, desistir: desistir, retomar: retomar, refazer: refazer, desfazer: desfazer,
    serializar: serializar, restaurar: restaurar, copiar: copiar,
    pontuar: pontuar, encerrar: encerrar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Go;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
