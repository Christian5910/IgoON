/* ==========================================================================
   IgoON! - goban.js  (desenho do tabuleiro em SVG)
   Goban.criar(el, opc)   tabuleiro interativo
   Goban.mini(el)         diagrama pequeno e fixo, lido de data-* (usado no Como Jogar)
   Coordenadas internas: ponto (x, y) com x de 0 a n-1 (esquerda→direita), y de 0 a n-1 (cima→baixo);
   índice i = y*n + x, o mesmo de regras.js.
   ========================================================================== */
(function (raiz) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const LETRAS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

  function el(nome, attrs, pai) {
    const e = document.createElementNS(NS, nome);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  // pontos de estrela (hoshi) para cada tamanho
  function estrelas(n) {
    if (n === 19) return [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => [x, y]));
    if (n === 13) return [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
    if (n === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
    if (n === 7) return [[2, 2], [4, 2], [3, 3], [2, 4], [4, 4]];
    return [];
  }

  /* ---------- desenho comum ---------- */
  // janela: {x0,y0,x1,y1} em pontos do tabuleiro; borda: quais lados são a borda de verdade
  function montarBase(svg, n, janela, opc) {
    opc = opc || {};
    const j = janela || { x0: 0, y0: 0, x1: n - 1, y1: n - 1 };
    const larg = j.x1 - j.x0, alt = j.y1 - j.y0;
    const m = opc.margem != null ? opc.margem : (opc.coords ? 1.05 : 0.62);            // margem em volta (para coordenadas e pedras da borda)
    const vx = j.x0 - m, vy = j.y0 - m, vw = larg + 2 * m, vh = alt + 2 * m;
    svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const ladoT = j.y0 === 0, ladoL = j.x0 === 0, ladoB = j.y1 === n - 1, ladoR = j.x1 === n - 1;
    const g = {};
    g.fundo = el('rect', { x: vx, y: vy, width: vw, height: vh, class: 'gb-fundo', rx: 0.35 }, svg);
    g.linhas = el('g', { class: 'gb-linhas' }, svg);
    for (let x = j.x0; x <= j.x1; x++) {
      const forte = (x === 0 || x === n - 1);
      el('line', { x1: x, y1: j.y0 - (ladoT ? 0 : 0.5), x2: x, y2: j.y1 + (ladoB ? 0 : 0.5), class: forte ? 'gb-l gb-borda' : 'gb-l' }, g.linhas);
    }
    for (let y = j.y0; y <= j.y1; y++) {
      const forte = (y === 0 || y === n - 1);
      el('line', { x1: j.x0 - (ladoL ? 0 : 0.5), y1: y, x2: j.x1 + (ladoR ? 0 : 0.5), y2: y, class: forte ? 'gb-l gb-borda' : 'gb-l' }, g.linhas);
    }
    // lados cortados: traço pontilhado (a área continua além da janela)
    const corte = [];
    if (!ladoB) corte.push([j.x0 - 0.5, j.y1 + 0.5, j.x1 + 0.5, j.y1 + 0.5]);
    if (!ladoR) corte.push([j.x1 + 0.5, j.y0 - 0.5, j.x1 + 0.5, j.y1 + 0.5]);
    if (!ladoT) corte.push([j.x0 - 0.5, j.y0 - 0.5, j.x1 + 0.5, j.y0 - 0.5]);
    if (!ladoL) corte.push([j.x0 - 0.5, j.y0 - 0.5, j.x0 - 0.5, j.y1 + 0.5]);
    if (opc.marcarCorte !== false) corte.forEach((c) => el('line', { x1: c[0], y1: c[1], x2: c[2], y2: c[3], class: 'gb-corte' }, g.linhas));
    g.estrelas = el('g', { class: 'gb-estrelas' }, svg);
    estrelas(n).forEach((p) => {
      if (p[0] >= j.x0 && p[0] <= j.x1 && p[1] >= j.y0 && p[1] <= j.y1) el('circle', { cx: p[0], cy: p[1], r: n > 13 ? 0.12 : 0.14, class: 'gb-estrela' }, g.estrelas);
    });
    if (opc.coords) {
      g.coords = el('g', { class: 'gb-coords' }, svg);
      for (let x = j.x0; x <= j.x1; x++) {
        const t = el('text', { x: x, y: j.y1 + 0.95, class: 'gb-coord', 'text-anchor': 'middle' }, g.coords); t.textContent = LETRAS[x];
        const t2 = el('text', { x: x, y: j.y0 - 0.68, class: 'gb-coord', 'text-anchor': 'middle' }, g.coords); t2.textContent = LETRAS[x];
      }
      for (let y = j.y0; y <= j.y1; y++) {
        const t = el('text', { x: j.x0 - 0.74, y: y + 0.13, class: 'gb-coord', 'text-anchor': 'middle' }, g.coords); t.textContent = n - y;
        const t2 = el('text', { x: j.x1 + 0.74, y: y + 0.13, class: 'gb-coord', 'text-anchor': 'middle' }, g.coords); t2.textContent = n - y;
      }
    }
    g.camadaTerr = el('g', { class: 'gb-terr' }, svg);
    g.camadaMarcas = el('g', { class: 'gb-marcas' }, svg);
    g.camadaPedras = el('g', { class: 'gb-pedras' }, svg);
    g.camadaTopo = el('g', { class: 'gb-topo' }, svg);
    g.janela = j; g.vb = { x: vx, y: vy, w: vw, h: vh };
    return g;
  }

  function pedra(pai, x, y, cor, extra) {
    const g = el('g', { class: 'gb-pedra ' + (cor === 1 ? 'preta' : 'branca') + (extra ? ' ' + extra : ''), transform: 'translate(' + x + ' ' + y + ')' }, pai);
    el('circle', { cx: 0.04, cy: 0.06, r: 0.47, class: 'gb-sombra' }, g);
    el('circle', { cx: 0, cy: 0, r: 0.47, class: 'gb-corpo' }, g);
    el('circle', { cx: -0.14, cy: -0.16, r: 0.2, class: 'gb-brilho' }, g);
    return g;
  }

  /* ---------- tabuleiro interativo ---------- */
  function criar(host, opc) {
    opc = opc || {};
    const T = { host: host, n: opc.n || 9, janela: opc.janela || null, onToque: opc.onToque || null, onMover: opc.onMover || null };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gb-svg'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Tabuleiro de Go');
    host.innerHTML = '';
    host.appendChild(svg);
    T.svg = svg;
    let base = null, tab = null;
    let fantasma = null, cursor = null;
    const estado = { fantasmaCor: 1, fantasmaP: -1, kbd: -1 };

    T.config = function (n, janela, o) {
      T.n = n; T.janela = janela || null; T.opcDesenho = o || {};
      svg.innerHTML = '';
      base = montarBase(svg, n, T.janela, { coords: T.opcDesenho.coords !== false });
      T.base = base;
      fantasma = null; cursor = null;
      T.pedras = {};
    };

    // dados: {b:[...], ult:p, ko:p, marcas:{p:'tipo'}, terr:{p:1|2}, mortas:Set, neutros:Set, numeros:{p:n}}
    T.desenhar = function (d) {
      if (!base) return;
      const n = T.n, j = base.janela;
      base.camadaPedras.innerHTML = ''; base.camadaMarcas.innerHTML = ''; base.camadaTerr.innerHTML = ''; base.camadaTopo.innerHTML = '';
      const dentro = (x, y) => x >= j.x0 - 0.01 && x <= j.x1 + 0.01 && y >= j.y0 - 0.01 && y <= j.y1 + 0.01;
      // território / neutros
      if (d.terr) for (const k in d.terr) {
        const p = +k, x = p % n, y = (p / n) | 0; if (!dentro(x, y)) continue;
        el('rect', { x: x - 0.17, y: y - 0.17, width: 0.34, height: 0.34, class: 'gb-t ' + (d.terr[k] === 1 ? 'tp' : 'tb') }, base.camadaTerr);
      }
      if (d.neutros) d.neutros.forEach((p) => { const x = p % n, y = (p / n) | 0; if (dentro(x, y)) el('circle', { cx: x, cy: y, r: 0.14, class: 'gb-neutro' }, base.camadaTerr); });
      // pedras
      for (let p = 0; p < n * n; p++) {
        const c = d.b[p]; if (!c) continue;
        const x = p % n, y = (p / n) | 0; if (!dentro(x, y)) continue;
        const morta = d.mortas && d.mortas.has(p);
        const gp = pedra(base.camadaPedras, x, y, c, morta ? 'morta' : '');
        if (morta) { el('path', { d: 'M-0.22 -0.22L0.22 0.22M0.22 -0.22L-0.22 0.22', class: 'gb-xis ' + (c === 1 ? 'sobre-preta' : 'sobre-branca') }, gp); }
        if (d.numeros && d.numeros[p] != null) {
          const t = el('text', { x: 0, y: 0.14, class: 'gb-num ' + (c === 1 ? 'sobre-preta' : 'sobre-branca'), 'text-anchor': 'middle' }, gp); t.textContent = d.numeros[p];
        }
      }
      // marcas
      if (d.ult != null && d.ult >= 0 && d.b[d.ult]) {
        const x = d.ult % n, y = (d.ult / n) | 0;
        if (dentro(x, y)) el('circle', { cx: x, cy: y, r: 0.22, class: 'gb-ult ' + (d.b[d.ult] === 1 ? 'sobre-preta' : 'sobre-branca') }, base.camadaMarcas);
      }
      if (d.ko != null && d.ko >= 0) { const x = d.ko % n, y = (d.ko / n) | 0; if (dentro(x, y)) el('rect', { x: x - 0.2, y: y - 0.2, width: 0.4, height: 0.4, class: 'gb-ko' }, base.camadaMarcas); }
      if (d.marcas) for (const k in d.marcas) {
        const p = +k, x = p % n, y = (p / n) | 0; if (!dentro(x, y)) continue;
        const tipo = d.marcas[k];
        if (tipo === 'dica') el('circle', { cx: x, cy: y, r: 0.36, class: 'gb-dica' }, base.camadaMarcas);
        else if (tipo === 'lib') el('circle', { cx: x, cy: y, r: 0.13, class: 'gb-lib' }, base.camadaMarcas);
        else if (tipo === 'alvo') el('circle', { cx: x, cy: y, r: 0.3, class: 'gb-alvo' }, base.camadaMarcas);
        else if (tipo === 'certo') el('circle', { cx: x, cy: y, r: 0.33, class: 'gb-certo' }, base.camadaMarcas);
        else if (tipo === 'erro') el('path', { d: 'M' + (x - 0.25) + ' ' + (y - 0.25) + 'L' + (x + 0.25) + ' ' + (y + 0.25) + 'M' + (x + 0.25) + ' ' + (y - 0.25) + 'L' + (x - 0.25) + ' ' + (y + 0.25), class: 'gb-erro' }, base.camadaMarcas);
        else if (tipo === 'area') el('rect', { x: x - 0.5, y: y - 0.5, width: 1, height: 1, class: 'gb-area' }, base.camadaMarcas);
      }
      T.dados = d;
      if (estado.fantasmaP >= 0) T.fantasma(estado.fantasmaP, estado.fantasmaCor);
      if (estado.kbd >= 0) T.cursor(estado.kbd);
    };

    // pedra "transparente" que mostra onde o lance vai cair
    T.fantasma = function (p, cor) {
      if (fantasma) { fantasma.remove(); fantasma = null; }
      estado.fantasmaP = p; estado.fantasmaCor = cor || estado.fantasmaCor;
      if (p == null || p < 0 || !base) return;
      const n = T.n, x = p % n, y = (p / n) | 0, j = base.janela;
      if (x < j.x0 || x > j.x1 || y < j.y0 || y > j.y1) return;
      fantasma = pedra(base.camadaTopo, x, y, estado.fantasmaCor, 'fantasma');
    };
    T.cursor = function (p) {
      if (cursor) { cursor.remove(); cursor = null; }
      estado.kbd = p == null ? -1 : p;
      if (p == null || p < 0 || !base) return;
      const n = T.n, x = p % n, y = (p / n) | 0;
      cursor = el('rect', { x: x - 0.5, y: y - 0.5, width: 1, height: 1, class: 'gb-cursor', rx: 0.15 }, base.camadaTopo);
    };
    T.limparFantasma = function () { estado.fantasmaP = -1; if (fantasma) { fantasma.remove(); fantasma = null; } };

    // converte um evento em ponto do tabuleiro (ou -1)
    function ponto(ev) {
      if (!base) return -1;
      const r = svg.getBoundingClientRect();
      const vb = base.vb;
      const esc = Math.min(r.width / vb.w, r.height / vb.h);
      const offX = (r.width - vb.w * esc) / 2, offY = (r.height - vb.h * esc) / 2;
      const px = (ev.clientX - r.left - offX) / esc + vb.x, py = (ev.clientY - r.top - offY) / esc + vb.y;
      const x = Math.round(px), y = Math.round(py), j = base.janela;
      if (x < j.x0 || x > j.x1 || y < j.y0 || y > j.y1) return -1;
      // tolerância: o toque precisa cair a menos de 0,62 do ponto (evita toques na margem)
      if (Math.hypot(px - x, py - y) > 0.75) return -1;
      return y * T.n + x;
    }
    T.pontoDe = ponto;
    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button > 0) return;
      const p = ponto(ev);
      T._down = p;
      if (T.onMover && p >= 0) T.onMover(p, ev);
    });
    svg.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      if (T.onMover) T.onMover(ponto(ev), ev);
    });
    svg.addEventListener('pointerleave', function () { if (T.onMover) T.onMover(-1, null); });
    svg.addEventListener('click', function (ev) {
      const p = ponto(ev);
      if (T.onToque) T.onToque(p, ev);
    });
    T.destruir = function () { host.innerHTML = ''; };
    T.tamanhoPonto = function () {
      if (!base) return 0;
      const r = svg.getBoundingClientRect();
      return Math.min(r.width / base.vb.w, r.height / base.vb.h);
    };
    T.config(T.n, T.janela);
    return T;
  }

  /* ---------- diagramas pequenos (Como Jogar) ----------
     <div class="mini-go" data-g="..X../..O.." data-borda="tl" data-legenda="..."></div>
     Caracteres: . vazio  X preta  O branca  x/o pedra marcada como morta  + liberdade (ponto)  * destaque (círculo)
                 b/w território preto/branco (quadradinho)  1-9 lance numerado (ímpar preta, par branca; use data-primeira="w" para trocar)
                 a preta com anel (alvo)   e   branca com anel (alvo)    # fora do diagrama (não desenha linhas ali)
     data-borda: lados que são a borda do tabuleiro (t, l, b, r). Os outros ficam "abertos" (a linha continua).
  */
  function mini(host) {
    const linhas = (host.getAttribute('data-g') || '').split('/');
    const h = linhas.length, w = Math.max.apply(null, linhas.map((l) => l.length));
    const borda = host.getAttribute('data-borda') || '';
    const primeira = host.getAttribute('data-primeira') === 'w' ? 2 : 1;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gb-svg gb-mini');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', host.getAttribute('data-alt') || 'Diagrama de Go');
    const m = 0.62;
    const x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    svg.setAttribute('viewBox', (x0 - m) + ' ' + (y0 - m) + ' ' + (w - 1 + 2 * m) + ' ' + (h - 1 + 2 * m));
    el('rect', { x: x0 - m, y: y0 - m, width: w - 1 + 2 * m, height: h - 1 + 2 * m, class: 'gb-fundo', rx: 0.3 }, svg);
    const L = el('g', { class: 'gb-linhas' }, svg);
    const eT = borda.includes('t'), eL = borda.includes('l'), eB = borda.includes('b'), eR = borda.includes('r');
    for (let x = x0; x <= x1; x++) el('line', { x1: x, y1: y0 - (eT ? 0 : m), x2: x, y2: y1 + (eB ? 0 : m), class: ((x === x0 && eL) || (x === x1 && eR)) ? 'gb-l gb-borda' : 'gb-l' }, L);
    for (let y = y0; y <= y1; y++) el('line', { x1: x0 - (eL ? 0 : m), y1: y, x2: x1 + (eR ? 0 : m), y2: y, class: ((y === y0 && eT) || (y === y1 && eB)) ? 'gb-l gb-borda' : 'gb-l' }, L);
    // estrela no centro de 9x9 / 19x19 só quando o diagrama inteiro é o tabuleiro: omitido (diagramas são recortes)
    const topo = el('g', {}, svg);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = linhas[y][x] || '.';
      if (c === '.' || c === '#') continue;
      if (c === 'X' || c === 'O' || c === 'x' || c === 'o' || c === 'a' || c === 'e') {
        const cor = (c === 'X' || c === 'x' || c === 'a') ? 1 : 2;
        const g = pedra(topo, x, y, cor, (c === 'x' || c === 'o') ? 'morta' : '');
        if (c === 'x' || c === 'o') el('path', { d: 'M-0.22 -0.22L0.22 0.22M0.22 -0.22L-0.22 0.22', class: 'gb-xis ' + (cor === 1 ? 'sobre-preta' : 'sobre-branca') }, g);
        if (c === 'a' || c === 'e') el('circle', { cx: 0, cy: 0, r: 0.3, class: 'gb-alvo-pedra' }, g);
      } else if (c === '+') el('circle', { cx: x, cy: y, r: 0.14, class: 'gb-lib' }, topo);
      else if (c === '*') el('circle', { cx: x, cy: y, r: 0.34, class: 'gb-dica' }, topo);
      else if (c === 'b' || c === 'w') el('rect', { x: x - 0.17, y: y - 0.17, width: 0.34, height: 0.34, class: 'gb-t ' + (c === 'b' ? 'tp' : 'tb') }, topo);
      else if (c >= '1' && c <= '9') {
        const k = +c, cor = ((k % 2) === (primeira === 1 ? 1 : 0)) ? 1 : 2;
        const g = pedra(topo, x, y, cor);
        const t = el('text', { x: 0, y: 0.15, class: 'gb-num ' + (cor === 1 ? 'sobre-preta' : 'sobre-branca'), 'text-anchor': 'middle' }, g); t.textContent = k;
      }
    }
    host.innerHTML = '';
    host.appendChild(svg);
  }

  function iniciarMinis(raizDom) {
    (raizDom || document).querySelectorAll('.mini-go:not([data-pronto])').forEach((e) => { mini(e); e.setAttribute('data-pronto', '1'); });
  }

  raiz.Goban = { criar: criar, mini: mini, iniciarMinis: iniciarMinis, LETRAS: LETRAS, estrelas: estrelas };
})(typeof window !== 'undefined' ? window : globalThis);
