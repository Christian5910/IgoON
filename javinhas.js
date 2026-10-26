// javinhas.js - IgoON!
// Go (囲碁) com a estética ON!. Menu, modais, configurações, sons e confirmação vêm de on.js (window.ON);
// as regras vêm de regras.js (window.Go), o computador de ia.js (via Web Worker, motor.js), o desenho de goban.js.
// Lições e problemas ficam em estudo.js, que se pendura em window.IgoUI.
// Seções: 1 Configuração · 2 Estado · 3 Desenho · 4 Entrada · 5 Lances e fim · 6 Computador (worker) · 7 Marcação
//         8 Revisão e SGF · 9 Botões e opções · 10 Estatísticas · 11 Como Jogar · 12 Início

(() => {
  'use strict';

  const Go = window.Go, SGF = window.SGF, Goban = window.Goban;

  /* ==========================================================================
     1. Configuração
     ========================================================================== */
  const NIVEIS = [
    { id: 1, nome: 'Iniciante',     desc: 'Joga quase ao acaso. Ótimo para o primeiro contato.', forca: 1 },
    { id: 2, nome: 'Aprendiz',      desc: 'Planeja um pouco e cai em armadilhas.',               forca: 2 },
    { id: 3, nome: 'Intermediário', desc: 'Entende capturas e fugas.',                           forca: 3 },
    { id: 4, nome: 'Forte',         desc: 'Simula muito mais partidas e erra menos.',            forca: 4 },
    { id: 5, nome: 'Mestre',        desc: 'O mais forte que o IgoON! consegue ser.',             forca: 5 }
  ];
  const LS = { jogo: 'igoon.jogo', prefs: 'igoon.prefs', stats: 'igoon.stats', visto: 'igoon.visto', modo: 'igoon.modo' };
  const ATRASO_MIN_CPU = 450;
  const MAX_HANDICAP = { 9: 5, 13: 9, 19: 9 };

  const $ = (s) => document.querySelector(s);
  const el = {
    goban: $('#goban'), wrap: $('#board-wrap'), topo: $('#jog-topo'), base: $('#jog-base'),
    msg: $('#message-area'), config: $('#config'),
    op: $('#oponente'), cor: $('#cor'), blocoCpu: $('#bloco-cpu'),
    nivelBtn: $('#nivel-btn'), nivelAtual: $('#nivel-atual'), nivelLista: $('#nivel-lista'), nivelPainel: $('#nivel-painel'),
    tamanho: $('#tamanho'), regras: $('#regras'), hand: $('#handicap'), handVal: $('#handicap-val'), komi: $('#komi'), komiVal: $('#komi-val'),
    confirmar: $('#confirmar'), coords: $('#coords'), trava: $('#trava-aviso'),
    passar: $('#passar-btn'), undo: $('#undo-btn'), dica: $('#hint-btn'), terr: $('#terr-btn'), desistir: $('#resign-btn'),
    novo: $('#restart-btn'), iniciar: $('#iniciar-btn'), lances: $('#lances'), lancesInfo: $('#lances-info'),
    marc: $('#marcacao'), marcTxt: $('#marcacao-txt'), sugerir: $('#sugerir-btn'), contar: $('#contar-btn'), retomar: $('#retomar-btn'),
    placar: $('#placar'),
    rev: $('#revisao'), revIni: $('#rev-ini'), revAnt: $('#rev-ant'), revPos: $('#rev-pos'), revProx: $('#rev-prox'), revFim: $('#rev-fim'),
    revContinuar: $('#rev-continuar'), revSair: $('#rev-sair'),
    sgfSalvar: $('#sgf-salvar'), sgfAbrir: $('#sgf-abrir'), revAbrir: $('#rev-abrir'), sgfArquivo: $('#sgf-arquivo'),
    modos: $('#modos'), modoJogar: $('#modo-jogar'), toolbar: $('#toolbar'), arquivoBarra: $('#arquivo-barra'), lancesCaixa: $('#lances-caixa')
  };

  const nomeNivel = (n) => (NIVEIS.find((x) => x.id === n) || NIVEIS[0]).nome;
  const corNome = (c) => (c === 1 ? 'Preto' : 'Branco');
  const outra = (c) => (c === 1 ? 2 : 1);
  const fmt = (x) => String(x).replace('.', ',');
  const nomePt = (g, p) => (p === Go.PASSE ? 'Passe' : Go.nomePonto(p, g.n));
  const reais = (g) => g.lances.filter((l) => l.p !== Go.RETOMAR);

  /* ==========================================================================
     2. Estado
     ========================================================================== */
  // J.status: 'pronto' (nenhum lance) · 'jogando' · 'marcando' · 'fim'
  let J = null;
  let prefs = Object.assign({ op: 'cpu', nivel: 1, cor: 1, n: 9, regras: 'jp', handicap: 0, komi: null, confirmar: null, coords: true },
    ON.store.get(LS.prefs, {}));
  if (prefs.cor !== 0 && prefs.cor !== 1 && prefs.cor !== 2) prefs.cor = 1;
  if (![9, 13, 19].includes(prefs.n)) prefs.n = 9;
  if (prefs.regras !== 'cn') prefs.regras = 'jp';
  if (prefs.op !== 'amigo') prefs.op = 'cpu';
  if (!NIVEIS.some((n) => n.id === prefs.nivel)) prefs.nivel = 1;
  if (!Number.isInteger(prefs.handicap) || prefs.handicap < 2 || prefs.handicap > MAX_HANDICAP[prefs.n]) prefs.handicap = 0;
  if (!Number.isFinite(prefs.komi) || prefs.komi < 0 || prefs.komi > 30) prefs.komi = null;
  if (typeof prefs.confirmar !== 'boolean') prefs.confirmar = null;
  if (typeof prefs.coords !== 'boolean') prefs.coords = true;
  const salvarPrefs = () => ON.store.set(LS.prefs, prefs);

  function komiPadraoAtual() { return Go.komiPadrao(prefs.regras, prefs.handicap); }
  function komiAtual() { return prefs.komi == null ? komiPadraoAtual() : prefs.komi; }

  function novoEstado() {
    const handicap = Math.min(prefs.handicap, MAX_HANDICAP[prefs.n]);
    const g = Go.novo(prefs.n, { regras: prefs.regras, handicap: handicap, komi: komiAtual() });
    return {
      g: g, oponente: prefs.op, nivel: prefs.nivel,
      minhaCor: prefs.cor === 0 ? (Math.random() < 0.5 ? 1 : 2) : prefs.cor,
      status: 'pronto', pensando: false, assistida: false,
      mortas: new Set(), neutros: new Set(), rev: null, dica: -1, estimativa: null, pendente: -1, estatContada: false
    };
  }

  /* ==========================================================================
     3. Desenho
     ========================================================================== */
  const T = Goban.criar(el.goban, {});
  let modoAtual = 'jogar';
  let coordsAtivas = null;

  function precisaConfirmar() {
    if (prefs.confirmar != null) return !!prefs.confirmar;
    return T.tamanhoPonto() > 0 && T.tamanhoPonto() < 24;
  }

  function koPonto(g) {
    if (g.fase !== 'jogando') return -1;
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

  function posicaoMostrada() {
    // em revisão, mostra a posição do lance escolhido; senão, a partida atual
    if (J.rev) return J.rev.g;
    return J.g;
  }

  function ultimoPonto(g) {
    const L = g.lances;
    for (let i = L.length - 1; i >= 0; i--) { if (L[i].p === Go.RETOMAR) continue; return L[i].p >= 0 ? L[i].p : -1; }
    return -1;
  }

  function configurarTabuleiro() {
    const g = J.g;
    if (T.n !== g.n || coordsAtivas !== prefs.coords || !T.base) {
      T.config(g.n, null, { coords: prefs.coords });
      coordsAtivas = prefs.coords;
    }
  }

  function desenharJogo() {
    if (modoAtual !== 'jogar') return;
    configurarTabuleiro();
    const g = posicaoMostrada();
    const d = { b: g.b, ult: ultimoPonto(g), ko: J.rev ? -1 : koPonto(g), marcas: {}, terr: null, mortas: null, neutros: null };
    if (J.dica >= 0) d.marcas[J.dica] = 'dica';
    if (J.status === 'marcando' && !J.rev) {
      const sc = Go.pontuar(g, [...J.mortas], [...J.neutros]);
      d.terr = {};
      sc.territorios.forEach((t) => t.pontos.forEach((p) => { d.terr[p] = t.dono; }));
      d.mortas = J.mortas; d.neutros = J.neutros;
    } else if (J.status === 'fim' && J.g.resultado && J.g.resultado.placar && !J.rev) {
      const pl = J.g.resultado.placar;
      d.terr = {};
      (pl.territorios || []).forEach((t) => t.pontos.forEach((p) => { d.terr[p] = t.dono; }));
      d.mortas = new Set(pl.mortas || []);
    } else if (J.estimativa && !J.rev) {
      d.terr = {};
      J.estimativa.forEach((v, p) => { if (!g.b[p] && Math.abs(v) > 0.5) d.terr[p] = v > 0 ? 1 : 2; });
    }
    T.desenhar(d);
  }

  function nomeJogador(cor) {
    if (J.oponente === 'amigo') return '';
    return cor === J.minhaCor ? 'Você' : 'Computador (' + nomeNivel(J.nivel) + ')';
  }

  function desenharJogadores() {
    const g = posicaoMostrada();
    // quem fica em cima: o oponente (contra o computador) ou o Branco (com amigo)
    const corTopo = J.oponente === 'cpu' ? outra(J.minhaCor) : 2;
    const corBase = outra(corTopo);
    [[el.topo, corTopo], [el.base, corBase]].forEach(([no, cor]) => {
      no.querySelector('.jog-nome').innerHTML = '<span class="ficha ' + (cor === 1 ? 'b' : 'w') + '"></span><span></span>';
      const nomeEl = no.querySelector('.jog-nome span:last-child'); nomeEl.textContent = corNome(cor) + (nomeJogador(cor) ? ' · ' + nomeJogador(cor) : ''); nomeEl.title = nomeEl.textContent;
      // prisioneiros: g.cap[cor] = pedras do adversário que esta cor capturou
      const cap = g.cap[cor];
      const capEl = no.querySelector('.jog-capt'); capEl.textContent = cap + ' pris.'; capEl.title = cap + (cap === 1 ? ' prisioneiro' : ' prisioneiros'); capEl.setAttribute('aria-label', capEl.title);
      no.querySelector('.jog-vant').textContent = cor === 2 && g.komi > 0 ? '+' + fmt(g.komi) : '';
      no.classList.toggle('vez', J.status === 'jogando' && !J.rev && g.vez === cor && g.fase === 'jogando');
    });
  }

  function desenharLances() {
    const g = J.g, L = reais(g);
    const rows = [];
    L.forEach((m, i) => {
      const cel = { m: m, k: i + 1 };
      if (m.c === 1) rows.push({ b: cel });
      else if (rows.length && rows[rows.length - 1].b && !rows[rows.length - 1].w) rows[rows.length - 1].w = cel;
      else rows.push({ w: cel });
    });
    el.lances.innerHTML = '';
    const cursor = J.rev ? J.rev.k : L.length;
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'num'; n.textContent = (i + 1) + '.';
      li.appendChild(n);
      [r.b, r.w].forEach((c) => {
        if (!c) { const s = document.createElement('span'); li.appendChild(s); return; }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'lance' + (c.k === cursor ? ' ultimo' : '');
        b.textContent = nomePt(g, c.m.p);
        b.setAttribute('aria-label', 'Lance ' + c.k + ': ' + corNome(c.m.c) + ' ' + nomePt(g, c.m.p));
        b.addEventListener('click', () => abrirRevisao(c.k));
        li.appendChild(b);
      });
      el.lances.appendChild(li);
    });
    el.lancesInfo.textContent = L.length ? L.length + (L.length === 1 ? ' lance' : ' lances') : '';
    const ult = el.lances.querySelector('.ultimo');
    if (ult && ult.scrollIntoView) { const box = el.lances; box.scrollTop = Math.max(0, ult.offsetTop - box.clientHeight + 40); }
  }

  function atualizarBotoes() {
    const g = J.g, humano = minhaVez(), jogando = J.status === 'jogando' && !J.rev;
    const nreal = reais(g).length;
    el.passar.disabled = !(jogando && humano && g.fase === 'jogando');
    const temLanceMeu = J.oponente === 'amigo' ? nreal > 0 : g.lances.some((l) => l.c === J.minhaCor && l.p !== Go.RETOMAR);
    el.undo.disabled = !(jogando && g.fase === 'jogando' && temLanceMeu && !J.pensando);
    el.dica.disabled = !(jogando && humano && g.fase === 'jogando');
    el.terr.disabled = !(jogando && g.fase === 'jogando' && !J.pensando);
    el.desistir.disabled = !(jogando && g.fase === 'jogando' && (J.oponente === 'amigo' || humano || J.pensando));
    el.revAbrir.disabled = nreal === 0 || !!J.rev;
    el.sgfSalvar.disabled = nreal === 0 && !g.setup[1].length;
    el.iniciar.hidden = !(J.status === 'pronto' && J.oponente === 'cpu' && g.vez !== J.minhaCor);
    el.toolbar.hidden = J.status === 'marcando' || J.status === 'fim' || !!J.rev;
    el.marc.hidden = !(J.status === 'marcando' && !J.rev);
    el.placar.hidden = !(J.status === 'fim' && !J.rev && g.resultado && g.resultado.tipo === 'pontos');
    el.rev.hidden = !J.rev;
    el.novo.hidden = !!J.rev;
    el.config.hidden = !!J.rev;
  }

  function render() {
    if (modoAtual !== 'jogar') return;
    desenharJogo(); desenharJogadores(); desenharLances(); atualizarBotoes(); atualizarOpcoes();
    if (J.rev) {
      const tot = reais(J.g).length;
      el.revPos.textContent = 'Lance ' + J.rev.k + ' de ' + tot;
      el.revIni.disabled = el.revAnt.disabled = J.rev.k === 0;
      el.revProx.disabled = el.revFim.disabled = J.rev.k === tot;
    }
  }

  function msg(texto, tipo, html) {
    el.msg.className = tipo || '';
    if (html) el.msg.innerHTML = texto; else el.msg.textContent = texto || '';
  }
  const msgLimpar = () => msg('', '');

  /* ==========================================================================
     4. Entrada (toque, mouse, teclado)
     ========================================================================== */
  function minhaVez() {
    if (J.status !== 'jogando' || J.g.fase !== 'jogando') return false;
    if (J.oponente === 'amigo') return true;
    return J.g.vez === J.minhaCor && !J.pensando;
  }

  function aoToque(p) {
    if (modoAtual !== 'jogar') { const m = window.IgoUI.modos[modoAtual]; if (m && m.toque) m.toque(p); return; }
    if (p < 0) return;
    if (J.rev) return;
    if (J.status === 'marcando') { alternarMarca(p); return; }
    if (J.status === 'fim') return;
    if (!minhaVez() && !(J.status === 'pronto' && J.oponente === 'cpu' && J.g.vez === J.minhaCor) && !(J.status === 'pronto' && J.oponente === 'amigo')) return;
    if (J.status === 'pronto' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor) return;
    const t = Go.tentar(J.g, p);
    if (t.erro) {
      msg(Go.ERROS[t.erro] || 'Jogada inválida.', 'error');
      ON.som('erro'); ON.vibrar('erro');
      J.pendente = -1; T.limparFantasma();
      return;
    }
    if (precisaConfirmar() && J.pendente !== p) {
      J.pendente = p; T.fantasma(p, J.g.vez);
      msg('Toque de novo no mesmo ponto para confirmar.', 'hint');
      ON.som('toque'); ON.vibrar('leve');
      return;
    }
    J.pendente = -1; T.limparFantasma();
    jogar(p);
  }

  function aoMover(p, ev) {
    if (modoAtual !== 'jogar') { const m = window.IgoUI.modos[modoAtual]; if (m && m.mover) m.mover(p, ev); return; }
    if (J.rev || J.status === 'marcando' || J.status === 'fim') { T.limparFantasma(); return; }
    if (precisaConfirmar() && J.pendente >= 0) return;          // o fantasma fica no ponto escolhido
    if (p >= 0 && minhaVez() && J.g.b[p] === 0 && !Go.tentar(J.g, p).erro) T.fantasma(p, J.g.vez);
    else if (J.pendente < 0) T.limparFantasma();
  }
  T.onToque = aoToque; T.onMover = aoMover;

  let cursorKbd = -1;
  el.goban.addEventListener('keydown', (e) => {
    if (modoAtual !== 'jogar') return;
    const n = J.g.n;
    const mover = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mover) {
      if (cursorKbd < 0) cursorKbd = ((n / 2) | 0) * n + ((n / 2) | 0);
      else { const x = Math.min(n - 1, Math.max(0, cursorKbd % n + mover[0])), y = Math.min(n - 1, Math.max(0, ((cursorKbd / n) | 0) + mover[1])); cursorKbd = y * n + x; }
      T.cursor(cursorKbd); e.preventDefault(); return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && cursorKbd >= 0) { J.pendente = cursorKbd; aoToque(cursorKbd); e.preventDefault(); return; }
    if (e.key === 'Escape') { cursorKbd = -1; T.cursor(null); J.pendente = -1; T.limparFantasma(); return; }
    if ((e.key === 'p' || e.key === 'P') && !el.passar.disabled) { passar(); e.preventDefault(); return; }
    if ((e.key === 'u' || e.key === 'U') && !el.undo.disabled) { desfazer(); e.preventDefault(); }
  });
  el.goban.addEventListener('blur', () => { cursorKbd = -1; T.cursor(null); });

  /* ==========================================================================
     5. Lances e fim
     ========================================================================== */
  function iniciarSeNecessario() {
    if (J.status === 'pronto') { J.status = 'jogando'; travarOpcoes(); }
  }

  function jogar(p) {
    iniciarSeNecessario();
    J.dica = -1; J.estimativa = null;
    const r = Go.jogar(J.g, p);
    if (!r.ok) { msg(Go.ERROS[r.erro] || 'Jogada inválida.', 'error'); return; }
    aposLance(r, p === Go.PASSE ? 'passe' : 'pedra', true);
  }

  function passar() {
    if (el.passar.disabled) return;
    iniciarSeNecessario();
    J.dica = -1; J.estimativa = null;
    const r = Go.jogar(J.g, Go.PASSE);
    if (!r.ok) return;
    aposLance(r, 'passe', true);
  }

  function aposLance(r, tipo, eHumano) {
    const g = J.g;
    if (tipo === 'passe') { ON.som('toque'); ON.vibrar('leve'); msg(corNome(outra(g.vez)) + ' passou.', ''); }
    else if (r.capturas && r.capturas.length) { ON.som('captura'); ON.vibrar('captura'); msg('', ''); }
    else { ON.som('mover'); ON.vibrar('mover'); msg('', ''); }
    if (g.fase === 'marcando') { entrarMarcacao(); return; }
    if (g.fase === 'fim') { terminar(); return; }
    salvarJogo();
    render();
    if (J.oponente === 'cpu' && g.vez !== J.minhaCor) pensar();
  }

  function entrarMarcacao() {
    J.status = 'marcando';
    J.mortas = new Set(); J.neutros = new Set();
    msg('Os dois passaram. Marque as pedras mortas e depois toque em Contar.', 'hint');
    salvarJogo(); render(); atualizarMarcacaoTxt();
    if (J.oponente === 'cpu') sugerirMortas(true);
  }

  function atualizarMarcacaoTxt() {
    const sc = Go.pontuar(J.g, [...J.mortas], [...J.neutros]);
    const regraTxt = J.g.regras === 'jp'
      ? 'Toque num grupo para marcar ou desmarcar como morto. No seki, marque como neutras também as regiões de olhos dos grupos: toque num ponto vazio da região. '
      : 'Toque num grupo para marcar ou desmarcar como morto. Nas regras chinesas pontos neutros não contam, então não há o que marcar neles. ';
    el.marcTxt.textContent = regraTxt + 'Placar agora: Preto ' + fmt(sc.preto.total) + ' · Branco ' + fmt(sc.branco.total) + ' (com komi ' + fmt(sc.komi) + ').';
  }

  function alternarMarca(p) {
    cancelarPensamento();
    const g = J.g;
    if (g.b[p]) {
      const gr = Go.grupo(g.b, g.n, p).pedras;
      const todas = gr.every((s) => J.mortas.has(s));
      gr.forEach((s) => { if (todas) J.mortas.delete(s); else J.mortas.add(s); });
      // neutros que viraram território ou vice-versa são recalculados pelo desenho; regiões neutras antigas saem
      J.neutros = new Set([...J.neutros].filter((q) => g.b[q] === 0));
    } else {
      if (g.regras !== 'jp') { msg('Nas regras chinesas os pontos neutros não contam: não é preciso marcá-los.', 'hint'); return; }
      const b2 = g.b.slice(); J.mortas.forEach((s) => { b2[s] = 0; });
      const reg = Go.regioes(b2, g.n).find((r) => r.pontos.includes(p));
      if (!reg) return;
      const todas = reg.pontos.every((q) => J.neutros.has(q));
      reg.pontos.forEach((q) => { if (todas) J.neutros.delete(q); else J.neutros.add(q); });
    }
    ON.som('toque'); ON.vibrar('leve');
    salvarJogo(); render(); atualizarMarcacaoTxt();
  }

  function textoResultado(res) {
    if (!res) return '';
    if (res.tipo === 'sem-resultado') return 'Partida sem resultado (mushōbu).';
    if (res.tipo === 'importado') return 'Resultado do SGF: ' + res.texto + '.';
    if (res.vencedor === 0) return 'Empate (jigo).';
    const nome = corNome(res.vencedor);
    if (res.tipo === 'desistencia') return nome + ' vence por desistência.';
    const m = /([BW])\+([\d.]+)/.exec(res.texto || '');
    return nome + ' vence por ' + (m ? fmt(m[2]) : '?') + ' pontos.';
  }

  function contar() {
    cancelarPensamento();
    const g = J.g;
    const r = Go.encerrar(g, [...J.mortas], [...J.neutros]);
    J.mortas = new Set(); J.neutros = new Set();
    terminar();
    return r;
  }

  function desenharPlacar() {
    const g = J.g, res = g.resultado;
    if (!res || res.tipo !== 'pontos') { el.placar.hidden = true; return; }
    const pl = res.placar, jp = g.regras === 'jp';
    if (!pl) { el.placar.innerHTML = '<h3>' + textoResultado(res) + '</h3><p>Resultado registrado no SGF. O arquivo não contém o placar detalhado.</p>'; return; }
    const linha = (a, b, c, cls) => '<span class="' + (cls || '') + '">' + a + '</span><span class="num ' + (cls || '') + '">' + b + '</span><span class="num ' + (cls || '') + '">' + c + '</span>';
    let h = '<h3>' + textoResultado(res) + '</h3><div class="placar-tab">';
    h += linha('', 'Preto', 'Branco', 'cab');
    h += linha('Território', pl.preto.territorio, pl.branco.territorio);
    if (jp) h += linha('Prisioneiros', pl.preto.prisioneiros, pl.branco.prisioneiros);
    else h += linha('Pedras no tabuleiro', pl.preto.pedras, pl.branco.pedras);
    h += linha('Komi', '', fmt(pl.komi));
    h += linha('Total', fmt(pl.preto.total), fmt(pl.branco.total), 'tot');
    h += '</div><p class="placar-nota">' + (jp
      ? 'Regras japonesas: território mais prisioneiros (pedras capturadas e pedras mortas retiradas). As pedras vivas não valem pontos.'
      : 'Regras chinesas: pedras vivas mais território (área). Os prisioneiros não entram na conta.') + '</p>';
    el.placar.innerHTML = h;
  }

  function terminar() {
    const g = J.g;
    J.status = 'fim'; J.dica = -1; J.estimativa = null; J.pensando = false;
    destravarParcial();
    const res = g.resultado;
    let tipoMsg = 'draw', txt = textoResultado(res);
    if (res && res.vencedor > 0) {
      if (J.oponente === 'cpu') { tipoMsg = res.vencedor === J.minhaCor ? 'victory' : 'defeat'; txt = (res.vencedor === J.minhaCor ? 'Você venceu! ' : 'O computador venceu. ') + txt; }
      else tipoMsg = 'victory';
    }
    msg(txt, tipoMsg);
    if (res && res.vencedor > 0) {
      const eu = J.oponente === 'amigo' || res.vencedor === J.minhaCor;
      if (eu) { ON.som('vitoria'); ON.impacto(el.wrap, 'vitoria'); } else { ON.som('derrota'); ON.impacto(el.wrap, 'derrota'); }
    }
    registrarFim(res);
    ON.store.set(LS.jogo, empacotar());
    desenharPlacar();
    render();
  }

  function desistir() {
    if (el.desistir.disabled) return;
    const quem = J.oponente === 'amigo' ? J.g.vez : J.minhaCor;
    ON.confirmar({
      titulo: 'Desistir?',
      texto: J.oponente === 'amigo' ? corNome(quem) + ' desiste e ' + corNome(outra(quem)) + ' vence a partida.' : 'O computador vence a partida.',
      sim: 'Sim, desistir', nao: 'Continuar jogando'
    }).then((ok) => {
      if (!ok) return;
      cancelarPensamento();
      Go.desistir(J.g, quem);
      terminar();
    });
  }

  function desfazer() {
    if (el.undo.disabled) return;
    cancelarPensamento();
    const g = J.g, L = reais(g);
    let quantos = 1;
    if (J.oponente === 'cpu') {
      // volta até a vez ser sua
      const ultimo = L[L.length - 1];
      if (ultimo && ultimo.c !== J.minhaCor && L.length >= 2) quantos = 2;
      else if (ultimo && ultimo.c !== J.minhaCor) quantos = 1;
    }
    const novo = Go.desfazer(g, quantos);
    J.g = novo; J.status = reais(novo).length ? 'jogando' : 'pronto';
    if (J.status === 'pronto') destravarOpcoes();
    J.mortas = new Set(); J.neutros = new Set(); J.dica = -1; J.estimativa = null; J.assistida = true;
    msg('Lance desfeito. Partidas com Desfazer não entram nas estatísticas.', 'hint');
    ON.som('toque');
    salvarJogo(); render();
    if (J.status === 'jogando' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor) pensar();
  }

  /* ==========================================================================
     6. Computador (Web Worker)
     ========================================================================== */
  let worker = null, reqId = 0, geracao = 0;
  const pendentes = new Map();

  // Cada resposta pertence à partida, posição e modo em que foi pedida.
  function contextoPedido() {
    const j = J, g = J.g, lances = g.lances.length, fase = g.fase, modo = modoAtual, gen = geracao;
    return () => J === j && J.g === g && g.lances.length === lances && g.fase === fase && modoAtual === modo && geracao === gen;
  }

  function obterWorker() {
    if (worker) return worker;
    if (!window.Worker) return null;
    try {
      worker = new Worker('motor.js');
      worker.onmessage = (ev) => {
        const p = pendentes.get(ev.data.id);
        if (!p) return;
        pendentes.delete(ev.data.id);
        if (ev.data.erro) p.fail(new Error(ev.data.erro)); else p.ok(ev.data);
      };
      worker.onerror = () => {
        pendentes.forEach((p) => p.fail(new Error('worker')));
        pendentes.clear();
        if (worker) worker.terminate();
        worker = null;
      };
    } catch (err) { worker = null; }
    return worker;
  }

  // sem Worker (raro): carrega o motor na própria página
  function semWorker(msg) {
    return new Promise((ok, fail) => {
      const rodar = () => {
        try {
          const IA = window.IA, Ts = window.Tsume;
          if (msg.op === 'tsume') {
            window.__tsumeS = window.__tsumeS || {};
            let S = window.__tsumeS[msg.pid];
            if (!S) { S = window.__tsumeS[msg.pid] = new Ts.Solver(Ts.montar(msg.def), { limiteNos: 2e6 }); }
            S.nos = 0; S.estouro = false;
            ok({ id: msg.id, lista: S.avaliar(Uint8Array.from(msg.b), msg.vez, msg.ko, msg.passes || 0), estouro: S.estouro });
            return;
          }
          const g = Go.restaurar(msg.jogo);
          if (msg.op === 'jogar' || msg.op === 'dica') {
            const r = IA.escolher(g, { nivel: msg.op === 'dica' ? Math.max(4, msg.nivel || 4) : msg.nivel, ms: 3000 });
            ok({ id: msg.id, p: r.p, vr: r.vr, sims: r.sims });
          } else if (msg.op === 'estimar') {
            const r = IA.estimar(g, { sims: 150, ms: 2000 }); ok({ id: msg.id, dono: r.dono, margem: r.margem });
          } else if (msg.op === 'mortas') {
            const r = IA.sugerirMortas(g, { sims: 200, ms: 2500 }); ok({ id: msg.id, mortas: r.mortas, neutros: r.neutros, margem: r.margem });
          } else fail(new Error('operação'));
        } catch (err) { fail(err); }
      };
      const carregar = (srcs, fim) => {
        const falta = srcs.filter((s) => !document.querySelector('script[data-motor="' + s + '"]'));
        if (!falta.length) { fim(); return; }
        let k = 0;
        falta.forEach((s) => {
          const sc = document.createElement('script'); sc.src = s; sc.dataset.motor = s;
          sc.onload = () => { if (++k === falta.length) fim(); };
          sc.onerror = () => fail(new Error('motor'));
          document.head.appendChild(sc);
        });
      };
      const precisa = window.IA && window.Tsume ? [] : ['ia.js', 'tsume.js'];
      if (!precisa.length) setTimeout(rodar, 30);
      else carregar(['ia.js'], () => carregar(['tsume.js'], () => setTimeout(rodar, 30)));
    });
  }

  function pedir(m) {
    return new Promise((ok, fail) => {
      const w = obterWorker();
      m.id = ++reqId;
      if (!w) { semWorker(m).then(ok, fail); return; }
      pendentes.set(m.id, { ok: ok, fail: () => semWorker(m).then(ok, fail), cancelar: () => fail(new Error('cancelado')) });
      w.postMessage(m);
    });
  }

  function cancelarPensamento() {
    reqId++; geracao++;
    if (J) J.pensando = false;
    el.sugerir.disabled = false;
    if (worker && pendentes.size) { worker.terminate(); worker = null; pendentes.forEach((p) => p.cancelar()); pendentes.clear(); }
  }

  function pensar() {
    const atual = contextoPedido();
    J.pensando = true;
    const t0 = performance.now();
    msg('O computador está pensando', 'pensando');
    render();
    pedir({ op: 'jogar', jogo: Go.serializar(J.g), nivel: J.nivel, semente: (Date.now() ^ (J.g.lances.length * 7919)) >>> 0 }).then((r) => {
      if (r.id !== reqId) return;
      setTimeout(() => {
        if (!J.pensando || r.id !== reqId) return;
        J.pensando = false;
        const g = J.g;
        let p = r.p;
        if (p !== Go.PASSE && (typeof p !== 'number' || Go.tentar(g, p).erro)) p = Go.PASSE;
        const res = Go.jogar(g, p);
        if (!res.ok) { msg('O computador não conseguiu jogar.', 'error'); render(); return; }
        if (p === Go.PASSE) { aposLance(res, 'passe', false); if (g.fase === 'jogando') msg('O computador passou.', ''); }
        else aposLance(res, 'pedra', false);
      }, Math.max(0, ATRASO_MIN_CPU - (performance.now() - t0)));
    }).catch(() => {
      if (!atual()) return;
      J.pensando = false;
      msg('Não consegui carregar o computador. Você pode jogar com um amigo ou recarregar a página.', 'error');
      render();
    });
  }

  function dica() {
    if (el.dica.disabled) return;
    const atual = contextoPedido();
    J.assistida = true;
    salvarJogo();
    msg('Procurando um bom lance', 'pensando');
    el.dica.disabled = true;
    pedir({ op: 'dica', jogo: Go.serializar(J.g), nivel: 4 }).then((r) => {
      if (!atual() || J.status !== 'jogando' || J.rev) return;
      if (r.p === Go.PASSE) { msg('Sugestão: passar. Não há mais nada de bom para jogar.', 'hint'); J.dica = -1; }
      else { J.dica = r.p; msg('Sugestão: ' + Go.nomePonto(r.p, J.g.n) + ' (círculo dourado).', 'hint'); }
      render();
    }).catch(() => { if (atual()) { msg('Não consegui calcular a dica agora.', 'error'); render(); } });
  }

  function estimarTerritorio() {
    if (el.terr.disabled) return;
    const atual = contextoPedido();
    J.assistida = true;
    salvarJogo();
    msg('Estimando o território', 'pensando');
    el.terr.disabled = true;
    pedir({ op: 'estimar', jogo: Go.serializar(J.g), sims: 300, ms: 3000 }).then((r) => {
      if (!atual() || J.rev) return;
      J.estimativa = r.dono;
      const m = r.margem, lado = m > 0 ? 'Preto' : 'Branco', pts = Math.abs(m);
      msg(pts < 1 ? 'Estimativa: a partida está equilibrada.' : 'Estimativa: ' + lado + ' está na frente por cerca de ' + fmt(Math.round(pts)) + ' pontos. É só uma estimativa.', 'hint');
      render();
    }).catch(() => { if (atual()) { msg('Não consegui estimar agora.', 'error'); render(); } });
  }

  /* ==========================================================================
     7. Marcação (sugestão do computador)
     ========================================================================== */
  function sugerirMortas(auto) {
    const atual = contextoPedido();
    msg('O computador está avaliando as pedras', 'pensando');
    el.sugerir.disabled = true;
    pedir({ op: 'mortas', jogo: Go.serializar(J.g), sims: 400, ms: 4000 }).then((r) => {
      if (!atual()) return;
      el.sugerir.disabled = false;
      if (J.status !== 'marcando') return;
      J.mortas = new Set(r.mortas);
      J.neutros = J.g.regras === 'jp' ? new Set(r.neutros) : new Set();
      salvarJogo();
      msg(r.mortas.length || r.neutros.length ? 'Sugestão do computador aplicada. Confira os grupos marcados e ajuste se discordar.' : 'O computador não vê pedras mortas. Se você vê, toque nelas.', 'hint');
      render(); atualizarMarcacaoTxt();
    }).catch(() => { if (!atual()) return; el.sugerir.disabled = false; if (!auto) msg('Não consegui calcular a sugestão agora.', 'error'); else msg('Marque as pedras mortas e toque em Contar.', 'hint'); });
  }

  /* ==========================================================================
     8. Revisão e SGF
     ========================================================================== */
  function posicaoAte(g, k) {
    const idxs = []; g.lances.forEach((l, i) => { if (l.p !== Go.RETOMAR) idxs.push(i); });
    const upto = k === 0 ? 0 : idxs[k - 1] + 1;
    const cfg = { regras: g.regras, komi: g.komi, handicap: g.handicap, setup: g.setup, vezInicial: g.vezInicial };
    const r = Go.refazer(g.n, cfg, g.lances, upto);
    return { g: r.g, upto: upto };
  }

  function abrirRevisao(k) {
    if (modoAtual !== 'jogar') return;
    cancelarPensamento();
    const tot = reais(J.g).length;
    if (tot === 0) return;
    k = Math.max(0, Math.min(tot, k == null ? tot : k));
    const pa = posicaoAte(J.g, k);
    J.rev = { k: k, g: pa.g, upto: pa.upto };
    J.pendente = -1; T.limparFantasma();
    render();
  }
  function moverRevisao(k) { abrirRevisao(k); }
  function sairRevisao() {
    J.rev = null; if (J.status === 'fim') desenharPlacar(); render();
    if (J.status === 'marcando') atualizarMarcacaoTxt();
    if (J.status === 'jogando' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor && J.g.fase === 'jogando') pensar();
  }
  function continuarDaqui() {
    if (!J.rev) return;
    const k = J.rev.k, tot = reais(J.g).length;
    const fazer = () => {
      const pa = posicaoAte(J.g, k);
      J.g = pa.g; J.rev = null; J.mortas = new Set(); J.neutros = new Set(); J.dica = -1; J.estimativa = null;
      J.status = reais(J.g).length ? 'jogando' : 'pronto';
      if (J.status === 'jogando') travarOpcoes();
      else destravarOpcoes();
      J.assistida = true;
      if (J.g.fase === 'marcando') { entrarMarcacao(); return; }
      if (J.g.fase === 'fim') { terminar(); return; }
      msg('Partida retomada a partir do lance ' + k + '.', 'hint');
      salvarJogo(); render();
      if (J.status === 'jogando' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor) pensar();
    };
    if (k === tot && J.status !== 'fim') { sairRevisao(); return; }
    ON.confirmar({ titulo: 'Continuar daqui?', texto: 'Os lances depois do lance ' + k + ' serão descartados.', sim: 'Sim, continuar', nao: 'Cancelar' }).then((ok) => { if (ok) fazer(); });
  }

  function salvarSGF() {
    const g = J.g;
    const meta = { data: new Date().toISOString().slice(0, 10), nome: 'IgoON!' };
    if (J.oponente === 'cpu') {
      meta.pretas = J.minhaCor === 1 ? 'Você' : 'IgoON! (' + nomeNivel(J.nivel) + ')';
      meta.brancas = J.minhaCor === 2 ? 'Você' : 'IgoON! (' + nomeNivel(J.nivel) + ')';
    } else { meta.pretas = 'Preto'; meta.brancas = 'Branco'; }
    const txt = SGF.escrever(g, meta);
    const blob = new Blob([txt], { type: 'application/x-go-sgf;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'igoon-' + meta.data + '.sgf';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    msg('Partida salva em ' + a.download + '.', 'ok');
  }

  function abrirSGF(arquivo) {
    if (!arquivo) return;
    if (arquivo.size > 2 * 1024 * 1024) { msg('Esse arquivo é grande demais para ser uma partida de Go.', 'error'); return; }
    const leitor = new FileReader();
    leitor.onload = () => {
      const r = SGF.ler(String(leitor.result));
      if (!r.ok) { msg(r.erro, 'error'); ON.som('erro'); return; }
      const fazer = () => {
        cancelarPensamento();
        const est = novoEstado();
        est.g = r.jogo; est.oponente = 'amigo'; est.status = r.jogo.fase === 'marcando' ? 'marcando' : (r.jogo.fase === 'fim' ? 'fim' : 'jogando');
        est.assistida = true;
        J = est;
        coordsAtivas = null;
        travarOpcoes();
        if (est.status === 'fim') desenharPlacar();
        if (est.status === 'marcando') { entrarMarcacao(); }
        const tot = reais(J.g).length;
        let t = 'Partida aberta: ' + tot + (tot === 1 ? ' lance' : ' lances') + ', ' + r.n + '×' + r.n + ', regras ' + (r.regras === 'cn' ? 'chinesas' : 'japonesas') + ', komi ' + fmt(r.komi) + '.';
        if (r.meta.resultado) t += ' Resultado no arquivo: ' + r.meta.resultado + '.';
        if (r.avisos.length) t += ' ' + r.avisos.join(' ');
        salvarJogo();
        if (tot) abrirRevisao(tot); else render();
        msg(t, 'ok');
      };
      if (emAndamento()) ON.confirmar({ titulo: 'Abrir partida?', texto: 'A partida em andamento será substituída.', sim: 'Sim, abrir', nao: 'Cancelar' }).then((ok) => { if (ok) fazer(); });
      else fazer();
    };
    leitor.onerror = () => msg('Não consegui ler o arquivo.', 'error');
    leitor.readAsText(arquivo, 'utf-8');
  }

  /* ==========================================================================
     9. Botões e opções
     ========================================================================== */
  const ICONE_TRAVA = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a3 3 0 0 0-3 3v2H4a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 12 6h-1V4a3 3 0 0 0-3-3m-2 3a2 2 0 1 1 4 0v2H6z"/></svg>';
  const travaveis = () => [...el.op.children, ...el.cor.children, ...el.tamanho.children, ...el.regras.children, ...el.hand.querySelectorAll('button'), ...el.komi.querySelectorAll('button'), el.nivelBtn, ...el.nivelLista.querySelectorAll('button')];

  function travarOpcoes() {
    el.config.classList.add('travado');
    travaveis().forEach((b) => { b.disabled = true; });
    recolherNivel();
    el.trava.innerHTML = ICONE_TRAVA + '<span>Oponente, nível, cor, tabuleiro, regras, handicap e komi ficam travados durante a partida. Use Novo jogo para trocar.</span>';
  }
  function destravarOpcoes() {
    el.config.classList.remove('travado');
    travaveis().forEach((b) => { b.disabled = false; });
    el.trava.textContent = '';
    atualizarOpcoes();
  }
  function destravarParcial() { /* no fim da partida as opções continuam travadas até o Novo jogo */ }
  function recolherNivel() { el.nivelBtn.setAttribute('aria-expanded', 'false'); el.nivelPainel.classList.remove('aberto'); }

  function emAndamento() { return !!J && (J.status === 'jogando' || J.status === 'marcando') && reais(J.g).length > 0; }

  function atualizarOpcoes() {
    const p = prefs, hmax = MAX_HANDICAP[p.n];
    if (J && J.status === 'pronto') {
      [...el.op.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.op === p.op)));
      [...el.cor.children].forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.cor === p.cor)));
      [...el.tamanho.children].forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === p.n)));
      [...el.regras.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === p.regras)));
      el.nivelAtual.textContent = nomeNivel(p.nivel);
      [...el.nivelLista.children].forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.nivel === p.nivel)));
      el.handVal.textContent = p.handicap ? String(Math.min(p.handicap, hmax)) : 'Nenhum';
      el.komiVal.textContent = fmt(komiAtual());
      const bh = el.hand.querySelectorAll('button');
      bh[0].disabled = p.handicap === 0; bh[1].disabled = p.handicap >= hmax;
      const bk = el.komi.querySelectorAll('button');
      bk[0].disabled = komiAtual() <= 0; bk[1].disabled = komiAtual() >= 30;
    } else if (J) {
      // travado: mostra os valores da partida em andamento
      const g = J.g;
      [...el.op.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.op === J.oponente)));
      [...el.cor.children].forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.cor === J.minhaCor)));
      [...el.tamanho.children].forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === g.n)));
      [...el.regras.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === g.regras)));
      el.nivelAtual.textContent = nomeNivel(J.nivel);
      [...el.nivelLista.children].forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.nivel === J.nivel)));
      el.handVal.textContent = g.handicap ? String(g.handicap) : 'Nenhum';
      el.komiVal.textContent = fmt(g.komi);
    }
    el.blocoCpu.hidden = (J && J.status !== 'pronto' ? J.oponente : p.op) !== 'cpu';
    el.confirmar.checked = precisaConfirmar();
    el.coords.checked = !!p.coords;
  }

  function construirNiveis() {
    el.nivelLista.innerHTML = '';
    NIVEIS.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nivel-op'; b.setAttribute('role', 'radio'); b.dataset.nivel = n.id;
      let barras = '';
      for (let i = 1; i <= 5; i++) barras += '<i' + (i <= n.forca ? ' class="on"' : '') + '></i>';
      b.innerHTML = '<span class="txt"><b></b><small></small></span><span class="barras-forca" aria-hidden="true">' + barras + '</span>';
      b.querySelector('b').textContent = n.id + '. ' + n.nome;
      b.querySelector('small').textContent = n.desc;
      b.addEventListener('click', () => {
        if (J.status !== 'pronto') return;
        prefs.nivel = n.id; salvarPrefs(); J.nivel = n.id;
        recolherNivel(); ON.som('toque'); ON.vibrar('leve'); render();
      });
      el.nivelLista.appendChild(b);
    });
    document.getElementById('nivel-chevron').innerHTML = ON.icone('chevron', 18);
  }

  // muda uma preferência da partida e reconstrói a partida "pronta"
  function mudarPref(fn) {
    if (J.status !== 'pronto') return;
    fn();
    if (prefs.handicap > MAX_HANDICAP[prefs.n]) prefs.handicap = MAX_HANDICAP[prefs.n];
    salvarPrefs();
    J = novoEstado();
    coordsAtivas = null;
    ON.som('toque'); ON.vibrar('leve');
    msgLimpar();
    render();
  }

  function ligarOpcoes() {
    el.op.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mudarPref(() => { prefs.op = b.dataset.op; }); });
    el.cor.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mudarPref(() => { prefs.cor = +b.dataset.cor; }); });
    el.tamanho.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mudarPref(() => { prefs.n = +b.dataset.n; }); });
    el.regras.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mudarPref(() => { prefs.regras = b.dataset.r; prefs.komi = null; }); });
    el.hand.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const d = +b.dataset.d;
      mudarPref(() => {
        let h = prefs.handicap + d;
        if (d > 0 && prefs.handicap === 0) h = 2;
        if (d < 0 && prefs.handicap <= 2) h = 0;
        prefs.handicap = Math.max(0, Math.min(MAX_HANDICAP[prefs.n], h));
        prefs.komi = null;
      });
    });
    el.komi.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const d = +b.dataset.d;
      mudarPref(() => {
        const novo = Math.max(0, Math.min(30, komiAtual() + 0.5 * d));
        prefs.komi = novo === komiPadraoAtual() ? null : novo;
      });
    });
    el.confirmar.addEventListener('change', () => { prefs.confirmar = el.confirmar.checked; salvarPrefs(); J.pendente = -1; T.limparFantasma(); });
    el.coords.addEventListener('change', () => { prefs.coords = el.coords.checked; salvarPrefs(); coordsAtivas = null; render(); });
  }

  function reiniciar(forcar) {
    if (J.oponente === 'cpu' && emAndamento() && !J.assistida && !J.estatContada) {
      contarDerrotaAbandono();
    }
    cancelarPensamento();
    J = novoEstado();
    coordsAtivas = null;
    destravarOpcoes();
    msgLimpar();
    el.placar.hidden = true;
    ON.store.del(LS.jogo);
    render();
    if (J.status === 'pronto' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor) msg('Toque em Iniciar partida quando estiver pronto.', 'hint');
  }

  function ligarBotoes() {
    el.passar.addEventListener('click', passar);
    el.undo.addEventListener('click', desfazer);
    el.dica.addEventListener('click', dica);
    el.terr.addEventListener('click', estimarTerritorio);
    el.desistir.addEventListener('click', desistir);
    el.iniciar.addEventListener('click', () => {
      if (J.status !== 'pronto') return;
      J.status = 'jogando'; travarOpcoes(); ON.som('toque'); msgLimpar(); salvarJogo(); render(); pensar();
    });
    el.novo.addEventListener('click', () => {
      ON.novoJogo(emAndamento(), () => reiniciar(true), { texto: J.oponente === 'cpu' && !J.assistida ? 'A partida em andamento será perdida e contará como derrota.' : 'A partida em andamento será perdida.' });
    });
    el.sugerir.addEventListener('click', () => sugerirMortas(false));
    el.contar.addEventListener('click', contar);
    el.retomar.addEventListener('click', () => {
      cancelarPensamento();
      Go.retomar(J.g); J.status = 'jogando'; J.mortas = new Set(); J.neutros = new Set();
      msg('A partida continua. Joga ' + corNome(J.g.vez) + '.', 'hint');
      salvarJogo(); render();
      if (J.oponente === 'cpu' && J.g.vez !== J.minhaCor) pensar();
    });
    el.revIni.addEventListener('click', () => moverRevisao(0));
    el.revAnt.addEventListener('click', () => moverRevisao(J.rev.k - 1));
    el.revProx.addEventListener('click', () => moverRevisao(J.rev.k + 1));
    el.revFim.addEventListener('click', () => moverRevisao(reais(J.g).length));
    el.revSair.addEventListener('click', sairRevisao);
    el.revContinuar.addEventListener('click', continuarDaqui);
    el.revAbrir.addEventListener('click', () => abrirRevisao(reais(J.g).length));
    el.sgfSalvar.addEventListener('click', salvarSGF);
    el.sgfAbrir.addEventListener('click', () => { el.sgfArquivo.value = ''; el.sgfArquivo.click(); });
    el.sgfArquivo.addEventListener('change', () => abrirSGF(el.sgfArquivo.files[0]));
    document.addEventListener('keydown', (e) => {
      if (modoAtual !== 'jogar' || !J.rev || ON.modal.aberto()) return;
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { if (J.rev.k > 0) moverRevisao(J.rev.k - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { if (J.rev.k < reais(J.g).length) moverRevisao(J.rev.k + 1); e.preventDefault(); }
    });
  }

  /* ---------- salvar e restaurar a partida ---------- */
  function empacotar() {
    return { v: 1, jogo: Go.serializar(J.g), oponente: J.oponente, nivel: J.nivel, minhaCor: J.minhaCor, status: J.status, assistida: J.assistida,
      estatContada: J.estatContada, mortas: [...J.mortas], neutros: [...J.neutros] };
  }
  function salvarJogo() {
    if (J.status === 'pronto' && !reais(J.g).length) { ON.store.del(LS.jogo); return; }
    ON.store.set(LS.jogo, empacotar());
  }
  function restaurar() {
    const d = ON.store.get(LS.jogo, null);
    if (!d || d.v !== 1 || !d.jogo) return false;
    const g = Go.restaurar(d.jogo);
    if (!g || g.n < 2 || g.n > 25) return false;
    const est = novoEstado();
    est.g = g; est.oponente = d.oponente === 'amigo' ? 'amigo' : 'cpu'; est.nivel = NIVEIS.some((n) => n.id === d.nivel) ? d.nivel : 1;
    est.minhaCor = d.minhaCor === 2 ? 2 : 1; est.assistida = !!d.assistida; est.estatContada = !!d.estatContada;
    est.status = g.fase;
    const pontos = (a) => (Array.isArray(a) ? a : []).filter((i) => Number.isInteger(i) && i >= 0 && i < g.n * g.n);
    est.mortas = new Set(pontos(d.mortas).filter((i) => g.b[i])); est.neutros = new Set(pontos(d.neutros));
    J = est;
    return true;
  }

  /* ==========================================================================
     10. Estatísticas
     ========================================================================== */
  function lerStats() {
    const s = ON.store.get(LS.stats, null);
    const base = { cpu: {}, amigo: 0 };
    NIVEIS.forEach((n) => { base.cpu[n.id] = { v: 0, d: 0 }; });
    if (!s || typeof s !== 'object') return base;
    NIVEIS.forEach((n) => { const x = s.cpu && s.cpu[n.id]; if (x && Number.isSafeInteger(x.v) && x.v >= 0 && Number.isSafeInteger(x.d) && x.d >= 0) base.cpu[n.id] = { v: x.v, d: x.d }; });
    base.amigo = Number.isSafeInteger(s.amigo) && s.amigo >= 0 ? s.amigo : 0;
    return base;
  }
  function registrarFim(res) {
    if (J.estatContada || !res) return;
    if (res.tipo === 'sem-resultado') return;
    if (J.oponente === 'amigo') { const s = lerStats(); s.amigo++; ON.store.set(LS.stats, s); J.estatContada = true; return; }
    if (J.assistida) return;
    const s = lerStats(), r = s.cpu[J.nivel];
    if (res.vencedor === J.minhaCor) r.v++; else if (res.vencedor > 0) r.d++;
    else return;
    ON.store.set(LS.stats, s); J.estatContada = true;
  }
  function contarDerrotaAbandono() {
    const s = lerStats(); s.cpu[J.nivel].d++; ON.store.set(LS.stats, s);
  }
  function estatisticas() {
    const s = lerStats();
    const linhas = NIVEIS.map((n) => ({ rotulo: n.id + '. ' + n.nome, valor: s.cpu[n.id].v + 'V · ' + s.cpu[n.id].d + 'D', larga: true }));
    linhas.push({ rotulo: 'Partidas com amigo', valor: String(s.amigo), larga: true });
    const E = window.IgoUI.estudo;
    if (E) { const r = E.resumo(); linhas.push({ rotulo: 'Lições concluídas', valor: r.licoes + ' de ' + r.licoesTotal, larga: true }); linhas.push({ rotulo: 'Problemas resolvidos', valor: r.problemas + ' de ' + r.problemasTotal, larga: true }); }
    return linhas;
  }

  /* ==========================================================================
     11. Como Jogar (abas, diagramas e termos)
     ========================================================================== */
  function ligarAbas() {
    const abas = [...document.querySelectorAll('.aba')];
    const mostrar = (aba) => {
      abas.forEach((a) => {
        const sel = a === aba;
        a.setAttribute('aria-selected', String(sel));
        a.tabIndex = sel ? 0 : -1;
        document.getElementById(a.getAttribute('aria-controls')).hidden = !sel;
      });
      document.getElementById(aba.getAttribute('aria-controls')).scrollTop = 0;
      Goban.iniciarMinis(document.getElementById(aba.getAttribute('aria-controls')));
    };
    abas.forEach((a) => {
      a.addEventListener('click', () => mostrar(a));
      a.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const novo = abas[(abas.indexOf(a) + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
        mostrar(novo); novo.focus(); e.preventDefault();
      });
    });
  }

  const R = (k, f) => '<ruby>' + k + '<rt>' + f + '</rt></ruby>';
  // [japonês (html), romaji, significado]; entradas com só texto são títulos de grupo
  const TERMOS = [
    'O jogo',
    [R('囲碁', 'いご'), 'igo', 'O jogo de Go, no Japão.'],
    [R('碁', 'ご'), 'go', 'Go (a palavra para o jogo e, em compostos, o jogo de tabuleiro).'],
    [R('碁盤', 'ごばん'), 'goban', 'O tabuleiro.'],
    [R('碁石', 'ごいし'), 'goishi', 'As pedras.'],
    [R('黒', 'くろ'), 'kuro', 'Preto (o lado das pedras pretas).'],
    [R('白', 'しろ'), 'shiro', 'Branco (o lado das pedras brancas).'],
    [R('星', 'ほし'), 'hoshi', 'Ponto de estrela: os pontinhos do tabuleiro.'],
    [R('天元', 'てんげん'), 'tengen', 'O ponto central do tabuleiro.'],
    [R('九路盤', 'きゅうろばん'), 'kyūroban', 'Tabuleiro 9×9.'],
    [R('十三路盤', 'じゅうさんろばん'), 'jūsanroban', 'Tabuleiro 13×13.'],
    [R('十九路盤', 'じゅうきゅうろばん'), 'jūkyūroban', 'Tabuleiro 19×19.'],
    [R('打', 'う') + 'つ', 'utsu', 'Jogar (colocar) uma pedra.'],
    'Capturas e liberdades',
    [R('呼吸点', 'こきゅうてん'), 'kokyūten', 'Liberdade: ponto vazio colado na pedra.'],
    [R('当', 'あ') + 'たり', 'atari', 'Pedra ou grupo com uma só liberdade, prestes a ser capturado.'],
    [R('取', 'と') + 'る', 'toru', 'Capturar.'],
    [R('上', 'あ') + 'げ' + R('浜', 'はま'), 'agehama', 'Prisioneiros: as pedras capturadas.'],
    [R('禁', 'きん') + 'じ' + R('手', 'て'), 'kinjite', 'Jogada proibida (como o suicídio e o ko).'],
    [R('劫', 'こう'), 'kō', 'Ko: situação em que duas pedras poderiam se capturar sem fim.'],
    [R('劫材', 'こうざい'), 'kōzai', 'Ameaça de ko: lance que força uma resposta e libera a recaptura.'],
    [R('三劫', 'さんこう'), 'sankō', 'Ko triplo: três kos ao mesmo tempo, que podem levar a partida a ficar sem resultado.'],
    'Vida e morte',
    [R('眼', 'め'), 'me', 'Olho: espaço vazio dentro de um grupo.'],
    [R('二眼', 'にがん'), 'nigan', 'Dois olhos, que garantem que o grupo vive.'],
    [R('欠', 'か') + 'け' + R('眼', 'め'), 'kakeme', 'Olho falso: parece um olho, mas pode ser desfeito.'],
    [R('生', 'い') + 'き', 'iki', 'Vivo.'],
    [R('死', 'し') + 'に', 'shini', 'Morto.'],
    [R('死活', 'しかつ'), 'shikatsu', 'Vida e morte dos grupos.'],
    [R('詰碁', 'つめご'), 'tsumego', 'Problemas de vida e morte.'],
    [R('急所', 'きゅうしょ'), 'kyūsho', 'Ponto vital: o lugar que decide a vida ou a morte.'],
    [R('中手', 'なかで'), 'nakade', 'Jogar dentro do espaço de olhos do adversário para impedir dois olhos.'],
    ['セキ', 'seki', 'Grupos adversários vivos por dependência mútua. Na regra japonesa, não fazem território.'],
    'Fim da partida e contagem',
    ['パス', 'pasu', 'Passar a vez.'],
    [R('終局', 'しゅうきょく'), 'shūkyoku', 'Fim da partida.'],
    [R('地', 'じ'), 'ji', 'Território: pontos vazios cercados.'],
    [R('目', 'もく'), 'moku', 'Ponto (unidade da contagem).'],
    ['ダメ', 'dame', 'Ponto neutro, que não vale nada para ninguém.'],
    ['コミ', 'komi', 'Pontos de compensação que o Branco recebe por jogar depois.'],
    [R('投了', 'とうりょう'), 'tōryō', 'Desistir da partida.'],
    [R('持碁', 'じご'), 'jigo', 'Empate por pontos iguais.'],
    [R('無勝負', 'むしょうぶ'), 'mushōbu', 'Sem resultado.'],
    [R('日本', 'にほん') + 'ルール', 'nihon rūru', 'Regras japonesas.'],
    [R('中国', 'ちゅうごく') + 'ルール', 'chūgoku rūru', 'Regras chinesas.'],
    'Handicap e estratégia',
    [R('置碁', 'おきご'), 'okigo', 'Partida com handicap.'],
    [R('互先', 'たがいせん'), 'tagaisen', 'Partida sem handicap, entre jogadores parecidos.'],
    [R('布石', 'ふせき'), 'fuseki', 'Abertura: as primeiras jogadas do tabuleiro.'],
    [R('序盤', 'じょばん'), 'joban', 'Início da partida.'],
    [R('中盤', 'ちゅうばん'), 'chūban', 'Meio da partida.'],
    [R('終盤', 'しゅうばん'), 'shūban', 'Fase final.'],
    [R('寄', 'よ') + 'せ', 'yose', 'Fechamento das fronteiras no final.'],
    [R('定石', 'じょうせき'), 'jōseki', 'Sequências conhecidas e equilibradas.'],
    [R('手筋', 'てすじ'), 'tesuji', 'Jogada engenhosa e precisa numa situação tática.'],
    [R('先手', 'せんて'), 'sente', 'Lance que obriga o adversário a responder.'],
    [R('後手', 'ごて'), 'gote', 'Lance que deixa a iniciativa com o adversário.'],
    [R('隅', 'すみ'), 'sumi', 'Canto do tabuleiro.'],
    [R('辺', 'へん'), 'hen', 'Borda (lado) do tabuleiro.'],
    [R('中央', 'ちゅうおう'), 'chūō', 'Centro do tabuleiro.'],
    [R('段', 'だん'), 'dan', 'Grau de mestre (jogadores fortes).'],
    [R('級', 'きゅう'), 'kyū', 'Grau de aprendiz (quanto menor o número, mais forte).']
  ];

  function construirTermos() {
    const box = document.querySelector('#painel-termos .tabela-termos');
    if (!box || box.querySelector('.tt-lin')) return;
    TERMOS.forEach((t) => {
      if (typeof t === 'string') { const d = document.createElement('div'); d.className = 'tt-grupo'; d.textContent = t; box.appendChild(d); return; }
      const d = document.createElement('div'); d.className = 'tt-lin'; d.setAttribute('role', 'row');
      d.innerHTML = '<span class="jp" role="cell" lang="ja">' + t[0] + '</span><span class="ro" role="cell">' + t[1] + '</span><span role="cell">' + t[2] + '</span>';
      box.appendChild(d);
    });
  }

  /* ==========================================================================
     12. Modos e início
     ========================================================================== */
  const IgoUI = window.IgoUI = {
    T: T, el: el, msg: msg, msgLimpar: msgLimpar, pedir: pedir, cancelar: cancelarPensamento, modos: {}, estudo: null,
    reais: reais, fmt: fmt, corNome: corNome, outra: outra,
    jogoAtual: () => J, koPonto: koPonto
  };

  function setModo(m) {
    if (m === modoAtual && T.base) return;
    const anterior = IgoUI.modos[modoAtual];
    if (anterior && anterior.sair) anterior.sair();
    if (modoAtual === 'jogar' && J) { J.pendente = -1; T.limparFantasma(); }
    modoAtual = m;
    ON.store.set(LS.modo, m);
    [...el.modos.children].forEach((b) => { const s = b.dataset.modo === m; b.setAttribute('aria-pressed', String(s)); b.setAttribute('aria-selected', String(s)); });
    ['jogar', 'licoes', 'problemas'].forEach((k) => { const p = document.getElementById('modo-' + k); if (p) p.hidden = k !== m; });
    const jogar = m === 'jogar';
    el.topo.hidden = !jogar; el.base.hidden = !jogar;
    document.getElementById('game-area').dataset.modo = m;
    msgLimpar();
    cancelarPensamentoSeSaiu(jogar);
    if (jogar) { coordsAtivas = null; if (J.status === 'fim') desenharPlacar(); render(); if (J.status === 'marcando') atualizarMarcacaoTxt(); if (J.status === 'jogando' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor && J.g.fase === 'jogando' && !J.pensando && !J.rev) pensar(); }
    else { const novo = IgoUI.modos[m]; if (novo && novo.entrar) novo.entrar(); }
  }
  function cancelarPensamentoSeSaiu(jogar) { if (!jogar) cancelarPensamento(); }
  IgoUI.setModo = setModo;

  // espera todos os scripts (inclusive estudo.js, que é deferido depois deste) antes de iniciar
  const arrancar = () => ON.init({
    id: 'igoon',
    nome: 'IgoON!',
    configuracoes: ['som', 'vibracao', 'tremor', 'escuro', 'reduzir'],
    estatisticas,
    zerarEstatisticas: () => { ON.store.del(LS.stats); if (IgoUI.estudo) IgoUI.estudo.zerar(); },
    pronto: () => {
      construirNiveis();
      construirTermos();
      ligarAbas();
      ligarOpcoes();
      ligarBotoes();
      Goban.iniciarMinis(document.getElementById('painel-usar'));
      if (!restaurar()) J = novoEstado();
      if (IgoUI.estudo) IgoUI.estudo.iniciar();
      [...el.modos.children].forEach((b) => b.addEventListener('click', () => { ON.som('toque'); setModo(b.dataset.modo); }));
      if (J.status !== 'pronto') travarOpcoes();
      const modoSalvo = ON.store.get(LS.modo, 'jogar');
      modoAtual = 'jogar';
      render();
      if (modoSalvo !== 'jogar' && IgoUI.modos[modoSalvo]) setModo(modoSalvo);
      else if (J.status === 'marcando') { render(); atualizarMarcacaoTxt(); }
      else if (J.status === 'fim') { desenharPlacar(); render(); }
      if (modoAtual === 'jogar' && J.status === 'jogando' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor && J.g.fase === 'jogando') pensar();
      if (J.status === 'pronto' && J.oponente === 'cpu' && J.g.vez !== J.minhaCor) msg('Toque em Iniciar partida quando estiver pronto.', 'hint');
      window.addEventListener('pagehide', () => { if (J && J.status !== 'pronto') salvarJogo(); });
      window.addEventListener('resize', () => { if (modoAtual === 'jogar') render(); });
      if (!ON.store.get(LS.visto, false)) {
        ON.store.set(LS.visto, true);
        setTimeout(() => ON.modal.abrir('howto-modal'), 400);
      }
    }
  });
  if (document.readyState === 'complete') arrancar(); else document.addEventListener('DOMContentLoaded', arrancar);
})();
