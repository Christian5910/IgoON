// estudo.js - IgoON!
// Modos "Lições" e "Problemas" (tsume-go). Usa o tabuleiro, o computador (Worker) e as mensagens de javinhas.js (window.IgoUI).
// Dados: licoes.js (window.LICOES) e problemas.js (window.PROBLEMAS).
(() => {
  'use strict';

  const UI = window.IgoUI, Go = window.Go, T = UI.T, LIC = window.LICOES, PR = window.PROBLEMAS;
  const LSK = 'igoon.estudo';
  const $ = (s) => document.querySelector(s);
  const msg = (t, tipo, html) => UI.msg(t, tipo, html);

  /* ---------- progresso ---------- */
  function lerProg() {
    const p = ON.store.get(LSK, null);
    const r = { licoes: {}, problemas: {} };
    if (p && typeof p === 'object') {
      if (p.licoes && typeof p.licoes === 'object') LIC.forEach((l) => { if (p.licoes[l.id] === true) r.licoes[l.id] = true; });
      if (p.problemas && typeof p.problemas === 'object') PR.lista.forEach((q) => { const v = p.problemas[q.id]; if (v === 'feito' || v === 'visto') r.problemas[q.id] = v; });
    }
    return r;
  }
  let prog = lerProg();
  const salvarProg = () => ON.store.set(LSK, prog);

  let tok = 0;                          // invalida respostas atrasadas do computador
  const aspecto = (r) => { UI.el.goban.style.aspectRatio = r ? String(r) : ''; };

  function ultimo(g) {
    for (let i = g.lances.length - 1; i >= 0; i--) { const l = g.lances[i]; if (l.p >= 0) return l.p; if (l.p === Go.PASSE) return -1; }
    return -1;
  }
  function desenhar(g, ex) {
    ex = ex || {};
    T.desenhar({ b: g.b, ult: ultimo(g), ko: -1, marcas: ex.marcas || {}, terr: ex.terr || null, mortas: ex.mortas || null, numeros: ex.numeros || null });
  }
  const idx = (a, n) => a[1] * n + a[0];

  /* ==========================================================================
     Resolvedor de problemas (usado nos Problemas e nas Lições do tipo "problema")
     ========================================================================== */
  function Resolvedor(prob, h) {
    this.prob = prob; this.h = h; this.falhas = 0;
  }
  Resolvedor.prototype.iniciar = function () {
    const prob = this.prob;
    tok++; this.meu = tok;
    const g = Go.deTabuleiro(prob.linhas, { vez: prob.usuario, regras: 'jp', komi: 0 });
    this.g = g;
    this.status = 'jogando'; this.ocupado = false; this.numeros = null; this.erroEm = -1;
    this.ataca = prob.usuario === prob.atacante;
    this.def = { n: g.n, linhas: prob.linhas, atacante: prob.atacante, vez: prob.usuario, alvo: prob.alvo, regiao: prob.regiao };
    this.regSet = new Set(prob.regiao);
    T.config(g.n, prob.janela, { coords: true });
    aspecto(T.base.vb.w / T.base.vb.h);
    this.pintar();
  };
  Resolvedor.prototype.pintar = function () {
    const marcas = {};
    if (this.erroEm >= 0) marcas[this.erroEm] = 'erro';
    desenhar(this.g, { marcas: marcas, numeros: this.numeros });
  };
  Resolvedor.prototype.fim = function () {
    const g = this.g, prob = this.prob, def = 3 - prob.atacante;
    if (prob.alvo.every((i) => g.b[i] !== def)) return 'capturado';
    const viv = new Set(Go.benson(g.b, g.n, def));
    if (prob.alvo.some((i) => viv.has(i))) return 'vivo';
    if (g.passes >= 2) return 'passes';
    return null;
  };
  Resolvedor.prototype.avaliar = function (cb) {
    const g = this.g, meu = this.meu;
    UI.pedir({ op: 'tsume', pid: this.prob.id, def: this.def, b: Array.from(g.b), vez: g.vez, ko: UI.koPonto(g), passes: g.passes })
      .then((r) => { if (meu !== tok) return; cb(r.lista || [], !!r.estouro); })
      .catch(() => {
        if (meu !== tok) return;
        this.ocupado = false;
        msg('Não consegui calcular a resposta agora. Toque em Reiniciar e tente de novo.', 'error');
      });
  };
  Resolvedor.prototype.toque = function (p) {
    if (this.status !== 'jogando' || this.ocupado || p < 0) return;
    const g = this.g;
    if (g.b[p]) { msg('Esse ponto já tem uma pedra.', 'error'); ON.som('erro'); return; }
    if (!this.regSet.has(p)) { msg('Jogue dentro do espaço do problema, perto do grupo.', 'hint'); return; }
    const t = Go.tentar(g, p);
    if (t.erro) { msg(Go.ERROS[t.erro] || 'Jogada inválida.', 'error'); ON.som('erro'); ON.vibrar('erro'); return; }
    this.ocupado = true; T.limparFantasma();
    const alvoV = this.ataca ? 1 : -1, primeiro = g.lances.length === 0;
    this.avaliar((lista, estouro) => {
      const m = lista.find((x) => x.p === p);
      let certo = !!m && m.v === alvoV;
      if (estouro && primeiro) certo = this.prob.certos.indexOf(p) >= 0;
      const r = Go.jogar(g, p);
      if (r.capturas && r.capturas.length) { ON.som('captura'); ON.vibrar('captura'); } else { ON.som('mover'); ON.vibrar('mover'); }
      if (!certo) this.erroEm = p;
      this.pintar();
      const f = this.fim();
      if (f) { this.terminar(f); return; }
      this.responder(() => {
        const f2 = this.fim();
        if (f2) { this.terminar(f2); return; }
        if (!certo) { this.errou(); return; }
        this.ocupado = false;
        msg('Bom lance. O adversário respondeu. Continue.', 'ok');
      });
    });
  };
  // o adversário joga a melhor defesa (ou o melhor ataque) depois de um lance
  Resolvedor.prototype.responder = function (cb) {
    const meu = this.meu;
    this.avaliar((lista) => {
      setTimeout(() => {
        if (meu !== tok) return;
        const m = lista[0], g = this.g;
        if (m) {
          const r = Go.jogar(g, m.p < 0 ? Go.PASSE : m.p);
          if (r.ok) {
            if (m.p < 0) { ON.som('toque'); } else if (r.capturas && r.capturas.length) { ON.som('captura'); ON.vibrar('captura'); } else { ON.som('mover'); ON.vibrar('mover'); }
          }
        }
        this.pintar();
        cb();
      }, 380);
    });
  };
  Resolvedor.prototype.terminar = function (f) {
    const venceUsuario = this.ataca ? f === 'capturado' : f !== 'capturado';
    if (!venceUsuario) { this.errou(); return; }
    this.status = 'certo'; this.ocupado = false;
    msg('Correto! ' + (this.ataca ? 'O grupo foi capturado.' : (f === 'passes' ? 'O grupo se salvou: nenhum dos dois consegue mais capturar.' : 'O grupo está vivo.')), 'victory');
    ON.som('vitoria'); ON.vibrar('vitoria');
    this.h.texto(this.prob.explicacao);
    this.h.aoCerto();
  };
  Resolvedor.prototype.errou = function () {
    this.status = 'errado'; this.ocupado = false; this.falhas++;
    msg('Esse lance não resolve. Veja como o adversário responde e depois toque em Reiniciar para tentar de novo.', 'error');
    ON.som('erro'); ON.vibrar('erro');
    this.h.aoErrado(this.falhas);
  };
  Resolvedor.prototype.dica = function () {
    msg(this.prob.dica, 'hint');
  };
  Resolvedor.prototype.solucao = function () {
    tok++; this.meu = tok;
    const prob = this.prob;
    const g = Go.deTabuleiro(prob.linhas, { vez: prob.usuario, regras: 'jp', komi: 0 });
    const nums = {};
    prob.sequencia.forEach((m, i) => {
      if (g.vez !== m.c) g.vez = m.c;
      const r = Go.jogar(g, m.p < 0 ? Go.PASSE : m.p);
      if (r.ok && m.p >= 0) nums[m.p] = i + 1;
    });
    this.g = g; this.numeros = nums; this.erroEm = -1; this.status = 'solucao'; this.ocupado = false;
    this.pintar();
    msg('Esta é a solução: os números mostram a ordem dos lances.', 'hint');
    this.h.texto(prob.explicacao);
    this.h.aoSolucao();
  };

  /* ==========================================================================
     Lições
     ========================================================================== */
  const Lic = { i: -1, k: 0, g: null, feito: false, res: null, sel: new Set(), esperadas: null };
  let licoesNoDom = false;

  function listarLicoes() {
    const box = $('#licoes-lista');
    box.innerHTML = '';
    box.className = 'lista-cartoes';
    LIC.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cartao' + (prog.licoes[l.id] ? ' feito' : '');
      const num = document.createElement('span'); num.className = 'num'; num.textContent = String(i + 1);
      const txt = document.createElement('span'); txt.className = 'txt';
      const t = document.createElement('b'); t.textContent = l.titulo;
      const s = document.createElement('small'); s.textContent = l.resumo + ' · ' + l.passos.length + (l.passos.length === 1 ? ' passo' : ' passos');
      txt.appendChild(t); txt.appendChild(s);
      const m = document.createElement('span'); m.className = 'marca'; m.textContent = prog.licoes[l.id] ? '✓' : '';
      m.setAttribute('aria-hidden', 'true');
      b.setAttribute('aria-label', 'Lição ' + (i + 1) + ': ' + l.titulo + (prog.licoes[l.id] ? ', concluída' : ''));
      b.appendChild(num); b.appendChild(txt); b.appendChild(m);
      b.addEventListener('click', () => { ON.som('toque'); abrirLicao(i); });
      box.appendChild(b);
    });
    licoesNoDom = true;
  }

  function mostrarListaLicoes() {
    tok++;
    Lic.i = -1; Lic.res = null;
    $('#licao-ativa').hidden = true; $('#licoes-lista').hidden = false;
    T.limparFantasma(); aspecto(null);
    listarLicoes();
    // o tabuleiro fica mostrando um 5x5 vazio
    T.config(5, null, { coords: true });
    desenhar(Go.novo(5, { regras: 'jp', komi: 0 }));
  }

  function abrirLicao(i) {
    Lic.i = i; Lic.k = 0;
    $('#licoes-lista').hidden = true; $('#licao-ativa').hidden = false;
    $('#lic-titulo').textContent = LIC[i].titulo;
    msg('', '');
    iniciarPasso();
  }

  function proximoOuFim() { return Lic.k >= LIC[Lic.i].passos.length - 1; }

  function iniciarPasso() {
    tok++;
    const L = LIC[Lic.i], p = L.passos[Lic.k];
    Lic.feito = false; Lic.sel = new Set(); Lic.res = null; Lic.esperadas = null;
    $('#lic-passo').textContent = 'Passo ' + (Lic.k + 1) + ' de ' + L.passos.length;
    $('#lic-texto').innerHTML = p.texto;
    const op = $('#lic-opcoes'); op.innerHTML = ''; op.hidden = true;
    const prox = $('#lic-proximo');
    prox.disabled = true; prox.textContent = proximoOuFim() ? 'Concluir' : 'Próximo';
    msg('', '');
    T.limparFantasma();
    if (p.tipo === 'problema') {
      const prob = PR.lista.find((q) => q.id === p.id);
      Lic.res = new Resolvedor(prob, {
        texto: (html) => { $('#lic-texto').innerHTML = p.texto + '<br><br>' + html; },
        aoCerto: () => { Lic.feito = true; prox.disabled = false; },
        aoErrado: (n) => {
          if (n === 2) msg(prob.dica, 'hint');
          if (n >= 3) { prox.disabled = false; msg('Você pode seguir para o próximo passo. Se quiser, toque em Refazer e tente outra vez.', 'hint'); }
        },
        aoSolucao: () => { prox.disabled = false; }
      });
      Lic.res.iniciar();
      return;
    }
    aspecto(null);
    const g = Lic.g = LIC.montar(p, Go);
    T.config(g.n, null, { coords: true });
    const marcas = {};
    (p.marcasInicio || []).forEach((a) => { marcas[idx(a, g.n)] = 'dica'; });
    desenhar(g, { marcas: marcas });
    if (p.tipo === 'marcar') {
      const ex = new Set();
      p.mortas.forEach((a) => Go.grupo(g.b, g.n, idx(a, g.n)).pedras.forEach((s) => ex.add(s)));
      Lic.esperadas = ex;
    }
    if (p.tipo === 'escolha') {
      op.hidden = false;
      p.opcoes.forEach((t, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.innerHTML = t;
        b.addEventListener('click', () => responderEscolha(k, b));
        op.appendChild(b);
      });
    }
  }

  function concluirPasso(p, extra) {
    Lic.feito = true;
    $('#lic-proximo').disabled = false;
    const g = Lic.g, ex = { marcas: {} };
    (p.mostrarDepois || []).forEach((a) => { ex.marcas[idx(a, g.n)] = 'lib'; });
    if (p.terrDepois) {
      const sc = Go.pontuar(g, [], []);
      ex.terr = {};
      sc.territorios.forEach((t) => t.pontos.forEach((q) => { ex.terr[q] = t.dono; }));
    }
    if (extra) Object.assign(ex, extra);
    if (extra && extra.marcas) Object.assign(ex.marcas, extra.marcas);
    desenhar(g, ex);
    msg(p.ok, 'ok', true);
    ON.som('acerto'); ON.vibrar('toque');
  }

  function responderEscolha(k, botao) {
    if (Lic.feito) return;
    const p = LIC[Lic.i].passos[Lic.k];
    if (k === p.certa) {
      botao.classList.add('certa');
      [...$('#lic-opcoes').children].forEach((b) => { b.disabled = true; });
      concluirPasso(p);
    } else {
      botao.classList.add('errada'); botao.disabled = true;
      msg(p.erro, 'error', true);
      ON.som('erro'); ON.vibrar('erro');
    }
  }

  function toqueLicao(p) {
    if (Lic.i < 0) return;
    if (Lic.res) { Lic.res.toque(p); return; }
    if (Lic.feito || p < 0) return;
    const passo = LIC[Lic.i].passos[Lic.k], g = Lic.g;
    if (passo.tipo === 'jogar') {
      const t = Go.tentar(g, p);
      if (t.erro) { msg(Go.ERROS[t.erro] || 'Jogada inválida.', 'error'); ON.som('erro'); ON.vibrar('erro'); return; }
      const ok = passo.criterio === 'qualquer' || (passo.aceita || []).some((a) => idx(a, g.n) === p);
      if (!ok) { msg(passo.erro || passo.errPadrao || 'Esse não é o lance pedido. Tente de novo.', 'error', true); ON.som('erro'); ON.vibrar('erro'); return; }
      const r = Go.jogar(g, p);
      if (r.capturas && r.capturas.length) { ON.som('captura'); ON.vibrar('captura'); } else { ON.som('mover'); ON.vibrar('mover'); }
      T.limparFantasma();
      concluirPasso(passo);
    } else if (passo.tipo === 'ilegal') {
      if (!passo.pontos.some((a) => idx(a, g.n) === p)) { msg('Toque no ponto marcado em dourado.', 'hint'); return; }
      const t = Go.tentar(g, p);
      if (t.erro !== passo.erro) { msg('Neste tabuleiro essa jogada seria aceita. Tente o ponto marcado.', 'hint'); return; }
      ON.som('erro'); ON.vibrar('erro');
      concluirPasso(passo, { marcas: { [p]: 'erro' } });
    } else if (passo.tipo === 'marcar') {
      if (!g.b[p]) return;
      const grupo = Go.grupo(g.b, g.n, p).pedras;
      if (!Lic.esperadas.has(grupo[0])) { msg(passo.erro, 'error', true); ON.som('erro'); ON.vibrar('erro'); return; }
      const todas = grupo.every((s) => Lic.sel.has(s));
      grupo.forEach((s) => { if (todas) Lic.sel.delete(s); else Lic.sel.add(s); });
      ON.som('toque'); ON.vibrar('leve');
      const completo = Lic.sel.size === Lic.esperadas.size;
      desenhar(g, { mortas: Lic.sel });
      if (completo) {
        Lic.feito = true; $('#lic-proximo').disabled = false;
        msg(passo.ok, 'ok', true); ON.som('acerto');
      }
    }
  }

  function moverLicao(p) {
    if (Lic.i < 0 || Lic.res || Lic.feito) { T.limparFantasma(); return; }
    const passo = LIC[Lic.i].passos[Lic.k], g = Lic.g;
    if (passo.tipo === 'jogar' && p >= 0 && g.b[p] === 0 && !Go.tentar(g, p).erro) T.fantasma(p, g.vez);
    else T.limparFantasma();
  }

  /* ==========================================================================
     Problemas
     ========================================================================== */
  const Pb = { i: -1, res: null };

  function listarProblemas() {
    const box = $('#prob-lista');
    box.innerHTML = '';
    PR.grupos.forEach((gr) => {
      const sec = document.createElement('div'); sec.className = 'grupo-prob';
      const h = document.createElement('h3'); h.textContent = 'Nível ' + gr.nivel + ' · ' + gr.nome;
      const pp = document.createElement('p'); pp.textContent = gr.texto;
      const grade = document.createElement('div'); grade.className = 'grade-prob';
      PR.lista.forEach((q, i) => {
        if (q.nivel !== gr.nivel) return;
        const b = document.createElement('button'); b.type = 'button';
        const st = prog.problemas[q.id];
        b.className = st === 'feito' ? 'feito' : (st === 'visto' ? 'visto' : '');
        b.textContent = String(i + 1);
        b.setAttribute('aria-label', 'Problema ' + (i + 1) + ': ' + q.titulo + (st === 'feito' ? ', resolvido' : (st === 'visto' ? ', solução vista' : '')));
        b.addEventListener('click', () => { ON.som('toque'); abrirProblema(i); });
        grade.appendChild(b);
      });
      sec.appendChild(h); sec.appendChild(pp); sec.appendChild(grade);
      box.appendChild(sec);
    });
  }

  function mostrarListaProblemas() {
    tok++;
    Pb.i = -1; Pb.res = null;
    $('#prob-ativo').hidden = true; $('#prob-lista').hidden = false;
    T.limparFantasma(); aspecto(null);
    listarProblemas();
    T.config(9, null, { coords: true });
    desenhar(Go.novo(9, { regras: 'jp', komi: 0 }));
  }

  function textoInicial(q) {
    const quem = q.usuario === 1 ? 'Preto' : 'Branco';
    return '<b>' + q.titulo + '.</b> ' + (q.objetivo === 'matar'
      ? 'Capture o grupo do adversário.' : 'Salve o seu grupo.') + ' Toque no ponto onde você jogaria. Forma: ' + q.formaNome + ', ' + (q.posicao === 'canto' ? 'no canto' : 'na borda') + '. Joga ' + quem + '.';
  }

  function abrirProblema(i) {
    if (i < 0 || i >= PR.lista.length) return;
    const q = PR.lista[i];
    Pb.i = i;
    $('#prob-lista').hidden = true; $('#prob-ativo').hidden = false;
    $('#prob-titulo').textContent = q.titulo;
    $('#prob-num').textContent = (i + 1) + ' de ' + PR.lista.length;
    $('#prob-texto').innerHTML = textoInicial(q);
    $('#prob-ant').disabled = i === 0; $('#prob-prox').disabled = i === PR.lista.length - 1;
    msg('', '');
    Pb.res = new Resolvedor(q, {
      texto: (html) => { $('#prob-texto').innerHTML = html; },
      aoCerto: () => { prog.problemas[q.id] = 'feito'; salvarProg(); },
      aoErrado: () => {},
      aoSolucao: () => { if (!prog.problemas[q.id]) { prog.problemas[q.id] = 'visto'; salvarProg(); } }
    });
    Pb.res.iniciar();
  }

  /* ==========================================================================
     Ligações
     ========================================================================== */
  function ligar() {
    $('#lic-voltar').addEventListener('click', () => { mostrarListaLicoes(); msg('', ''); });
    $('#lic-reiniciar').addEventListener('click', () => { ON.som('toque'); iniciarPasso(); });
    $('#lic-proximo').addEventListener('click', () => {
      if ($('#lic-proximo').disabled) return;
      ON.som('toque');
      if (!proximoOuFim()) { Lic.k++; iniciarPasso(); return; }
      const l = LIC[Lic.i];
      prog.licoes[l.id] = true; salvarProg();
      mostrarListaLicoes();
      msg('Lição "' + l.titulo + '" concluída!', 'victory');
      ON.som('vitoria');
    });
    $('#prob-voltar').addEventListener('click', () => { mostrarListaProblemas(); msg('', ''); });
    $('#prob-reiniciar').addEventListener('click', () => { if (Pb.i >= 0) { ON.som('toque'); abrirProblema(Pb.i); } });
    $('#prob-dica').addEventListener('click', () => { if (Pb.res) Pb.res.dica(); });
    $('#prob-solucao').addEventListener('click', () => { if (Pb.res) Pb.res.solucao(); });
    $('#prob-ant').addEventListener('click', () => abrirProblema(Pb.i - 1));
    $('#prob-prox').addEventListener('click', () => abrirProblema(Pb.i + 1));
  }

  const sair = () => { tok++; T.limparFantasma(); aspecto(null); };

  UI.modos.licoes = {
    entrar: () => { if (Lic.i >= 0) { iniciarPasso(); } else mostrarListaLicoes(); },
    sair: sair,
    toque: toqueLicao,
    mover: moverLicao
  };
  UI.modos.problemas = {
    entrar: () => { if (Pb.i >= 0) abrirProblema(Pb.i); else mostrarListaProblemas(); },
    sair: sair,
    toque: (p) => { if (Pb.res) Pb.res.toque(p); },
    mover: (p) => {
      const r = Pb.res;
      if (!r || r.status !== 'jogando' || r.ocupado) { T.limparFantasma(); return; }
      if (p >= 0 && r.g.b[p] === 0 && r.regSet.has(p) && !Go.tentar(r.g, p).erro) T.fantasma(p, r.g.vez); else T.limparFantasma();
    }
  };

  UI.estudo = {
    iniciar: () => { ligar(); listarProblemas(); listarLicoes(); },
    resumo: () => ({
      licoes: LIC.filter((l) => prog.licoes[l.id]).length, licoesTotal: LIC.length,
      problemas: PR.lista.filter((q) => prog.problemas[q.id] === 'feito').length, problemasTotal: PR.lista.length
    }),
    zerar: () => { prog = { licoes: {}, problemas: {} }; salvarProg(); Lic.i = -1; Pb.i = -1; listarLicoes(); listarProblemas(); }
  };
})();
