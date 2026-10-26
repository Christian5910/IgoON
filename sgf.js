/* ==========================================================================
   IgoON! - sgf.js  (ler e escrever SGF, o formato de arquivo padrão do Go)
   SGF = Smart Game Format (FF[4]). Coordenadas: duas letras, coluna e linha, 'aa' = canto superior
   esquerdo; passe = '' (ou 'tt' em tabuleiros até 19x19).
   Lê o primeiro jogo do arquivo e segue a linha principal (a primeira variação de cada ramo);
   as variações extras são ignoradas e o leitor avisa quando isso acontece.
   ========================================================================== */
(function (raiz) {
  'use strict';

  const Go = raiz.Go || (typeof require !== 'undefined' ? require('./regras.js') : null);
  const A = 'abcdefghijklmnopqrstuvwxyz';

  function coordSGF(i, n) {
    if (i < 0) return '';
    return A[i % n] + A[Math.floor(i / n)];
  }
  function indiceSGF(s, n) {
    if (s === '' || (s === 'tt' && n <= 19)) return -1;
    if (s.length !== 2) return -2;
    const x = A.indexOf(s[0]), y = A.indexOf(s[1]);
    if (x < 0 || y < 0 || x >= n || y >= n) return -2;
    return y * n + x;
  }
  const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/\]/g, '\\]');

  /* ---------- escrever ---------- */
  // meta: { pretas, brancas, data, nome, comentario }
  function escrever(g, meta) {
    meta = meta || {};
    const n = g.n;
    let s = '(;FF[4]GM[1]CA[UTF-8]AP[IgoON!]ST[2]SZ[' + n + ']';
    s += 'RU[' + (g.regras === 'cn' ? 'Chinese' : 'Japanese') + ']';
    s += 'KM[' + g.komi + ']';
    if (g.handicap >= 2) s += 'HA[' + g.handicap + ']';
    if (meta.nome) s += 'GN[' + esc(meta.nome) + ']';
    if (meta.pretas) s += 'PB[' + esc(meta.pretas) + ']';
    if (meta.brancas) s += 'PW[' + esc(meta.brancas) + ']';
    if (meta.data) s += 'DT[' + esc(meta.data) + ']';
    const setB = g.setup[1], setW = g.setup[2];
    if (setB.length) s += 'AB' + setB.map((i) => '[' + coordSGF(i, n) + ']').join('');
    if (setW.length) s += 'AW' + setW.map((i) => '[' + coordSGF(i, n) + ']').join('');
    // quem joga primeiro, quando não é o padrão (preto, ou branco com handicap)
    const padrao = g.setup[1].length || g.setup[2].length ? (g.handicap >= 2 ? 2 : 1) : 1;
    if (g.vezInicial !== padrao) s += 'PL[' + (g.vezInicial === 1 ? 'B' : 'W') + ']';
    if (g.resultado) {
      const r = g.resultado;
      if (r.tipo === 'sem-resultado') s += 'RE[Void]';
      else if (r.vencedor === 0) s += 'RE[0]';
      else s += 'RE[' + r.texto + ']';
    }
    if (meta.comentario) s += 'C[' + esc(meta.comentario) + ']';
    g.lances.forEach((l) => {
      if (l.p === Go.RETOMAR) return;
      s += ';' + (l.c === 1 ? 'B' : 'W') + '[' + coordSGF(l.p, n) + ']';
    });
    return s + ')';
  }

  /* ---------- ler ---------- */
  // analisador do texto: devolve a árvore { props: {ID: [valores]}, filhos: [nós] } da primeira coleção
  function analisar(texto) {
    let i = 0;
    const T = String(texto).replace(/^﻿/, '');
    const avisos = [];
    const espaco = () => { while (i < T.length && /\s/.test(T[i])) i++; };
    function valor() {
      // espera '[' ... ']' com escapes
      i++;
      let v = '';
      while (i < T.length && T[i] !== ']') {
        if (T[i] === '\\') {
          i++;
          if (T[i] === '\n') { i++; continue; }
          if (T[i] === '\r') { i++; if (T[i] === '\n') i++; continue; }
        }
        v += T[i++];
      }
      if (T[i] !== ']') throw new Error('valor sem fechar ]');
      i++;
      return v;
    }
    function no() {
      // após ';'
      const props = {};
      for (;;) {
        espaco();
        let id = '';
        while (i < T.length && /[A-Za-z]/.test(T[i])) id += T[i++];
        if (!id) break;
        id = id.replace(/[a-z]/g, '');
        const vs = [];
        espaco();
        while (T[i] === '[') { vs.push(valor()); espaco(); }
        if (!vs.length) throw new Error('propriedade ' + id + ' sem valor');
        props[id] = (props[id] || []).concat(vs);
      }
      return props;
    }
    function arvoreGalho() {
      // após '('
      const nos = [];
      let ramos = [];
      for (;;) {
        espaco();
        if (T[i] === ';') { i++; nos.push({ props: no() }); }
        else if (T[i] === '(') { i++; ramos.push(arvoreGalho()); }
        else if (T[i] === ')') { i++; break; }
        else if (i >= T.length) throw new Error('arquivo cortado: falta )');
        else throw new Error('caractere inesperado "' + T[i] + '"');
      }
      return { nos: nos, ramos: ramos };
    }
    espaco();
    const ini = T.indexOf('(');
    if (ini < 0) throw new Error('não parece um arquivo SGF');
    i = ini + 1;
    const raizArv = arvoreGalho();
    return { arvore: raizArv, avisos: avisos };
  }

  function ler(texto) {
    let r;
    try { r = analisar(texto); } catch (e) { return { ok: false, erro: 'Não consegui ler o arquivo: ' + e.message + '.' }; }
    // linha principal: nós do galho + primeiro ramo, recursivamente
    const linha = [];
    let extras = 0;
    (function seguir(galho) {
      galho.nos.forEach((x) => linha.push(x));
      if (galho.ramos.length) { extras += galho.ramos.length - 1; seguir(galho.ramos[0]); }
    })(r.arvore);
    if (!linha.length) return { ok: false, erro: 'O arquivo não tem nenhum lance.' };
    const p0 = linha[0].props;
    const get = (id) => (p0[id] ? p0[id][0] : '');
    if (p0.GM && p0.GM[0].trim() !== '1') return { ok: false, erro: 'Este SGF não é de Go (GM[' + p0.GM[0] + ']).' };
    let n = 19;
    if (p0.SZ) {
      const m = /^(\d+)(?::(\d+))?$/.exec(p0.SZ[0].trim());
      if (!m) return { ok: false, erro: 'Tamanho de tabuleiro inválido: ' + p0.SZ[0] + '.' };
      n = +m[1];
      if (m[2] && +m[2] !== n) return { ok: false, erro: 'Tabuleiros retangulares (' + p0.SZ[0] + ') não são aceitos.' };
    }
    if (n < 2 || n > 25) return { ok: false, erro: 'Tabuleiro ' + n + 'x' + n + ' não é aceito (de 2 a 25).' };
    const avisos = [];
    if (extras) avisos.push('O arquivo tem variações; só a linha principal foi aberta.');
    let regras = 'jp';
    const ru = get('RU').toLowerCase();
    if (ru) {
      if (/chin|china|cn/.test(ru)) regras = 'cn';
      else if (/jap|jp/.test(ru)) regras = 'jp';
      else avisos.push('Regras "' + get('RU') + '" não existem aqui; usei a japonesa.');
    }
    let komi = parseFloat(get('KM'));
    if (!isFinite(komi)) { komi = Go.komiPadrao(regras, 0); if (p0.KM) avisos.push('Komi inválido; usei ' + komi + '.'); }
    const setup = { 1: [], 2: [] };
    const addSetup = (id, cor) => {
      (p0[id] || []).forEach((v) => {
        // aceita também retângulos "aa:cc"
        const partes = v.split(':');
        if (partes.length === 2) {
          const a = indiceSGF(partes[0], n), b = indiceSGF(partes[1], n);
          if (a < 0 || b < 0) { avisos.push('Pedra inicial inválida: ' + v); return; }
          for (let y = Math.floor(a / n); y <= Math.floor(b / n); y++) for (let x = a % n; x <= b % n; x++) setup[cor].push(y * n + x);
        } else {
          const k = indiceSGF(v, n);
          if (k < 0) avisos.push('Pedra inicial inválida: ' + v); else setup[cor].push(k);
        }
      });
    };
    addSetup('AB', 1); addSetup('AW', 2);
    if (setup[1].some((i) => setup[2].includes(i))) return { ok: false, erro: 'Há pedras pretas e brancas no mesmo ponto inicial.' };
    let handicap = parseInt(get('HA'), 10) || 0;
    if (handicap >= 2 && !setup[1].length) { const pts = Go.pontosHandicap(n, handicap); if (pts) setup[1] = pts.slice(); else handicap = 0; }
    if (handicap < 2 && setup[1].length >= 2 && !setup[2].length) handicap = setup[1].length;
    let vez = get('PL').toUpperCase() === 'W' ? 2 : (get('PL').toUpperCase() === 'B' ? 1 : 0);
    const lances = [];
    for (let k = 0; k < linha.length; k++) {
      const pr = linha[k].props;
      const cor = pr.B ? 1 : (pr.W ? 2 : 0);
      if (!cor) {
        if (k > 0 && (pr.AB || pr.AW)) { avisos.push('Pedras colocadas no meio da partida foram ignoradas.'); }
        continue;
      }
      const idx = indiceSGF((pr.B || pr.W)[0].trim(), n);
      if (idx === -2) return { ok: false, erro: 'Lance ' + (lances.length + 1) + ' tem uma coordenada inválida.' };
      lances.push({ c: cor, p: idx });
    }
    if (!vez) vez = lances.length ? lances[0].c : (handicap >= 2 ? 2 : 1);
    // confere se a partida é jogável com as regras daqui
    const t = Go.refazer(n, { regras: regras, komi: komi, handicap: handicap, setup: setup, vezInicial: vez }, lances.map((l) => ({ c: l.c, p: l.p, cap: [] })));
    if (t.erro) {
      return { ok: false, erro: 'O lance ' + (t.indice + 1) + ' (' + Go.nomePonto(lances[t.indice].p, n) + ') não é permitido pelas regras ' + (regras === 'cn' ? 'chinesas' : 'japonesas') + ': ' + (Go.ERROS[t.erro] || t.erro) };
    }
    const meta = { pretas: get('PB'), brancas: get('PW'), data: get('DT'), nome: get('GN'), resultado: get('RE'), comentario: get('C') };
    const resultado = meta.resultado.trim();
    const v = /^([BW])\+(\d+(?:\.\d+)?|R(?:esign)?|T(?:ime)?|F(?:orfeit)?)?$/i.exec(resultado);
    if (v || /^(0|Draw|Jigo|Void)$/i.test(resultado)) {
      const vencedor = v ? (v[1].toUpperCase() === 'B' ? 1 : 2) : 0;
      const tipo = /^Void$/i.test(resultado) ? 'sem-resultado' : (!v || /^\d/.test(v[2]) ? 'pontos' : (/^R/i.test(v[2]) ? 'desistencia' : 'importado'));
      t.g.fase = 'fim';
      t.g.resultado = { tipo: tipo, vencedor: vencedor, texto: resultado };
    } else if (resultado && resultado !== '?') avisos.push('Resultado não reconhecido: ' + resultado + '.');
    return { ok: true, n: n, regras: regras, komi: komi, handicap: handicap, setup: setup, vezInicial: vez, lances: lances, meta: meta, avisos: avisos, jogo: t.g };
  }

  raiz.SGF = { escrever: escrever, ler: ler, coordSGF: coordSGF, indiceSGF: indiceSGF };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.SGF;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
