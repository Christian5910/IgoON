/* Rodar com servidor em http://127.0.0.1:8806 e Playwright no NODE_PATH. */
const assert = require('node:assert/strict');
const Go = require('../regras.js');
const SGF = require('../sgf.js');
const PR = require('../problemas.js');
const LIC = require('../licoes.js');
const Tsume = require('../tsume.js');
const { chromium } = require('playwright');
let falhas = 0, acertos = 0;
async function teste(nome, fn) {
  try { await fn(); acertos++; console.log('OK ' + nome); }
  catch (e) { falhas++; console.error('FALHOU ' + nome + ': ' + e.message); }
}
async function main() {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  async function pagina(dados = {}, mock = true) {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await page.addInitScript(({ dados, mock }) => {
      localStorage.setItem('igoon.visto', 'true');
      for (const [k,v] of Object.entries(dados)) localStorage.setItem(k, JSON.stringify(v));
      window.trabalhos = [];
      if (mock) window.Worker = class {
        postMessage(m) { window.trabalhos.push({ worker: this, m: structuredClone(m) }); }
        terminate() { this.terminado = true; }
      };
      window.responder = (i, resposta) => {
        const t = window.trabalhos[i];
        if (!t.worker.terminado) t.worker.onmessage({ data: { id: t.m.id, ...resposta } });
      };
    }, { dados, mock });
    await page.goto(process.env.IGOON_URL || 'http://127.0.0.1:8806');
    await page.waitForFunction(() => window.IgoUI?.jogoAtual(), null, { timeout: 5000 });
    return { page, erros, fechar: () => ctx.close() };
  }
  const jogada = p => { const g = Go.novo(9); Go.jogar(g, p); return Go.serializar(g); };
  const salvo = (jogo, extra = {}) => ({ v: 1, jogo, status: 'jogando', oponente: 'amigo', minhaCor: 1, nivel: 1, mortas: [], neutros: [], ...extra });
  await teste('dados salvos inválidos são rejeitados pelo motor', () => {
    for (const d of [null, {}, { n: -1 }, { n: 1e9, lances: [] }, { n: 9, lances: [null] }, { n: 9, lances: [{ c: 7, p: 0 }] }, { n: 9, lances: [], setup: { 1: [999], 2: [] } }]) {
      assert.equal(Go.restaurar(d), null);
    }
  });
  await teste('SGF com resultado preserva fim e resultado', () => {
    for (const re of ['B+R', 'W+2.5', '0', 'Void']) {
      const r = SGF.ler('(;SZ[9]RE[' + re + '];B[aa])');
      assert.equal(r.ok, true); assert.equal(r.jogo.fase, 'fim');
      assert.ok(SGF.escrever(r.jogo).includes('RE[' + re + ']'));
    }
  });
  await teste('preferências corrompidas não criam uma partida impossível', async () => {
    const p = await pagina({ 'igoon.prefs': { n: 9, op: 'outro', nivel: 999, handicap: '2', komi: 'oi', coords: 'oi', confirmar: 'oi' } });
    try {
      assert.deepEqual(p.erros, []);
      const g = await p.page.evaluate(() => { const j = IgoUI.jogoAtual(); return { op: j.oponente, nivel: j.nivel, komi: j.g.komi, h: j.g.handicap }; });
      assert.equal(g.op, 'cpu'); assert.equal(g.nivel, 1); assert.equal(typeof g.komi, 'number'); assert.equal(g.h, 0);
    } finally { await p.fechar(); }
  });
  await teste('partida salva estruturalmente corrompida não derruba início', async () => {
    const p = await pagina({ 'igoon.jogo': salvo({ n: 9 }) });
    try { assert.deepEqual(p.erros, []); assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'pronto'); }
    finally { await p.fechar(); }
  });
  await teste('Continuar daqui no último lance reinicia CPU cancelada', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { oponente: 'cpu' }) });
    try {
      await p.page.click('#rev-abrir'); await p.page.click('#rev-continuar');
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().pensando), true);
      assert.equal(await p.page.evaluate(() => trabalhos.length), 2);
    } finally { await p.fechar(); }
  });
  await teste('cancelar abertura de SGF mantém CPU funcionando', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { oponente: 'cpu' }) });
    try {
      await p.page.setInputFiles('#sgf-arquivo', { name: 'jogo.sgf', mimeType: 'application/x-go-sgf', buffer: Buffer.from('(;SZ[9];B[bb])') });
      await p.page.click('#confirm-no');
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().pensando), true);
      assert.equal(await p.page.evaluate(() => trabalhos[0].worker.terminado === true), false);
    } finally { await p.fechar(); }
  });
  await teste('dica atrasada não cancela lance CPU nem altera a posição seguinte', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { minhaCor: 2, oponente: 'cpu' }) });
    try {
      await p.page.click('#hint-btn');
      await p.page.evaluate(() => IgoUI.T.onToque(1));
      await p.page.evaluate(() => { responder(0, { p: 40 }); responder(1, { p: 2 }); });
      await p.page.waitForFunction(() => IgoUI.jogoAtual().g.lances.length === 3);
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().dica), -1);
    } finally { await p.fechar(); }
  });
  await teste('solver atrasado após Ver solução não altera problema', async () => {
    const p = await pagina();
    try {
      await p.page.evaluate(() => IgoUI.setModo('problemas'));
      await p.page.locator('#prob-lista button').first().click();
      await p.page.evaluate(() => IgoUI.T.onToque(PROBLEMAS.lista[0].certos[0]));
      await p.page.click('#prob-solucao');
      const antes = await p.page.locator('#goban').innerHTML();
      await p.page.evaluate(() => responder(0, { lista: [{ p: PROBLEMAS.lista[0].certos[0], v: 1 }] }));
      assert.equal(await p.page.locator('#goban').innerHTML(), antes);
    } finally { await p.fechar(); }
  });
  await teste('estimativa atrasada é descartada e assistência é salva imediatamente', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0)) });
    try {
      await p.page.click('#terr-btn');
      assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('igoon.jogo')).assistida), true);
      await p.page.evaluate(() => { IgoUI.T.onToque(1); responder(0, { dono: Array(81).fill(1), margem: 20 }); });
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().estimativa), null);
    } finally { await p.fechar(); }
  });
  await teste('sugestão cancelada libera botão e não sobrescreve marcação manual', async () => {
    const g = Go.novo(9); Go.jogar(g, 0); Go.jogar(g, Go.PASSE); Go.jogar(g, Go.PASSE);
    const p = await pagina({ 'igoon.jogo': salvo(Go.serializar(g), { status: 'marcando' }) });
    try {
      await p.page.click('#sugerir-btn');
      await p.page.evaluate(() => IgoUI.setModo('problemas'));
      await p.page.evaluate(() => IgoUI.setModo('jogar'));
      assert.equal(await p.page.locator('#sugerir-btn').isEnabled(), true);
      await p.page.click('#sugerir-btn');
      await p.page.evaluate(() => { IgoUI.T.onToque(0); responder(1, { mortas: [], neutros: [] }); });
      assert.deepEqual(await p.page.evaluate(() => [...IgoUI.jogoAtual().mortas]), [0]);
    } finally { await p.fechar(); }
  });
  await teste('restauração normaliza fase e aceita listas corrompidas sem travar', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { status: 'fim', mortas: {}, neutros: 3 }) });
    try {
      assert.deepEqual(p.erros, []);
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'jogando');
      assert.equal(await p.page.locator('#passar-btn').isEnabled(), true);
    } finally { await p.fechar(); }
  });
  await teste('placar restaurado em outro modo aparece ao voltar a Jogar', async () => {
    const g = Go.novo(9); Go.jogar(g, 0); Go.jogar(g, Go.PASSE); Go.jogar(g, Go.PASSE); Go.encerrar(g, [], []);
    const p = await pagina({ 'igoon.jogo': salvo(Go.serializar(g), { status: 'fim' }), 'igoon.modo': 'problemas' });
    try {
      await p.page.evaluate(() => IgoUI.setModo('jogar'));
      assert.match(await p.page.locator('#placar').innerText(), /Território/);
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('SGF terminado importa, mostra resultado e restaura sem placar detalhado', async () => {
    const p = await pagina();
    try {
      await p.page.setInputFiles('#sgf-arquivo', { name: 'fim.sgf', mimeType: 'application/x-go-sgf', buffer: Buffer.from('(;SZ[9]RE[W+2.5];B[aa])') });
      await p.page.waitForFunction(() => IgoUI.jogoAtual().rev);
      await p.page.click('#rev-sair');
      assert.match(await p.page.locator('#placar').innerText(), /2,5/);
      await p.page.reload();
      await p.page.waitForFunction(() => IgoUI?.jogoAtual());
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'fim');
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('revisão conserva RETOMAR e libera opções ao continuar do início', async () => {
    const g = Go.novo(9); Go.jogar(g, 0); Go.jogar(g, Go.PASSE); Go.jogar(g, Go.PASSE); Go.retomar(g); Go.jogar(g, 1);
    const p = await pagina({ 'igoon.jogo': salvo(Go.serializar(g)) });
    try {
      await p.page.click('#rev-abrir'); await p.page.click('#rev-ant'); await p.page.click('#rev-prox');
      assert.deepEqual(await p.page.evaluate(() => IgoUI.jogoAtual().rev.g.lances.map(l => l.p)), [0, -1, -1, -2, 1]);
      await p.page.click('#rev-ini'); await p.page.click('#rev-continuar'); await p.page.click('#confirm-yes');
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'pronto');
      assert.equal(await p.page.locator('#oponente button').first().isEnabled(), true);
    } finally { await p.fechar(); }
  });
  await teste('SGF terminado só com posição inicial mostra o placar importado', async () => {
    const p = await pagina();
    try {
      await p.page.setInputFiles('#sgf-arquivo', { name: 'posicao.sgf', mimeType: 'application/x-go-sgf', buffer: Buffer.from('(;SZ[9]AB[aa][bb]RE[W+2.5])') });
      await p.page.waitForFunction(() => IgoUI.jogoAtual().status === 'fim');
      assert.equal(await p.page.locator('#placar').isVisible(), true);
      assert.match(await p.page.locator('#placar').innerText(), /2,5/);
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('estatísticas não contam fim restaurado duas vezes', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { oponente: 'cpu', minhaCor: 2 }) });
    try {
      await p.page.click('#resign-btn'); await p.page.click('#confirm-yes');
      assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('igoon.stats')).cpu[1].d), 1);
      await p.page.reload(); await p.page.waitForFunction(() => IgoUI?.jogoAtual());
      assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('igoon.stats')).cpu[1].d), 1);
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('continuar do lance zero com usuário Branco espera Iniciar partida', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { oponente: 'cpu', minhaCor: 2 }) });
    try {
      await p.page.click('#rev-abrir'); await p.page.click('#rev-ini');
      await p.page.click('#rev-continuar'); await p.page.click('#confirm-yes');
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'pronto');
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().pensando), false);
      assert.equal(await p.page.locator('#iniciar-btn').isVisible(), true);
      await p.page.click('#iniciar-btn');
      await p.page.evaluate(() => responder(0, { p: 1 }));
      await p.page.waitForFunction(() => IgoUI.jogoAtual().g.lances.length === 1);
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'jogando');
      assert.equal(await p.page.locator('#passar-btn').isEnabled(), true);
    } finally { await p.fechar(); }
  });
  await teste('11 lições completas pela interface', async () => {
    const p = await pagina({}, false);
    try {
      await p.page.evaluate(() => IgoUI.setModo('licoes'));
      for (let i = 0; i < LIC.length; i++) {
        await p.page.locator('#licoes-lista button').nth(i).click();
        for (const passo of LIC[i].passos) {
          if (passo.tipo === 'escolha') await p.page.locator('#lic-opcoes button').nth(passo.certa).click();
          else if (passo.tipo === 'problema') {
            const q = PR.lista.find(q => q.id === passo.id);
            for (const m of q.sequencia.filter(m => m.c === q.usuario)) {
              await p.page.evaluate(p => IgoUI.T.onToque(p), m.p);
              await p.page.waitForFunction(() => !document.querySelector('#lic-proximo').disabled || document.querySelector('#message-area').textContent.startsWith('Bom lance.'));
            }
          } else {
            const g = LIC.montar(passo, Go);
            const pontos = passo.tipo === 'marcar' ? passo.mortas : passo.tipo === 'ilegal' ? passo.pontos : (passo.aceita || [[0, 0]]);
            for (const a of pontos) await p.page.evaluate(p => IgoUI.T.onToque(p), a[1] * g.n + a[0]);
          }
          assert.equal(await p.page.locator('#lic-proximo').isEnabled(), true, LIC[i].id);
          await p.page.click('#lic-proximo');
        }
      }
      assert.equal(await p.page.evaluate(() => IgoUI.estudo.resumo().licoes), 11);
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('24 problemas resolvidos novamente com todas as respostas iniciais', () => {
    for (const q of PR.lista) {
      const P = Tsume.montar({ ...q, n: 9, vez: q.usuario });
      assert.equal(Tsume.selada(P), true, q.id);
      const solver = new Tsume.Solver(P, { limiteNos: 4e6 });
      const lista = solver.avaliar(P.b, P.vez, -1, 0);
      assert.equal(solver.estouro, false, q.id + ': busca incompleta');
      const v = q.usuario === q.atacante ? 1 : -1;
      assert.deepEqual(lista.filter(m => m.v === v && m.p >= 0).map(m => m.p).sort((a,b) => a-b), q.certos.slice().sort((a,b) => a-b), q.id);
    }
  });
  await teste('Worker real joga legalmente nos cinco níveis', async () => {
    const p = await pagina({}, false);
    try {
      for (let nivel = 1; nivel <= 5; nivel++) {
        const r = await p.page.evaluate(nivel => IgoUI.pedir({ op: 'jogar', jogo: Go.serializar(Go.novo(9)), nivel, ms: 100, semente: 42 }), nivel);
        assert.ok(r.p === Go.PASSE || Go.legal(Go.novo(9), r.p));
      }
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('cliques rápidos e troca de problema ignoram solver antigo', async () => {
    const p = await pagina();
    try {
      await p.page.evaluate(() => IgoUI.setModo('problemas'));
      await p.page.locator('#prob-lista button').first().click();
      await p.page.evaluate(() => { const ponto = PROBLEMAS.lista[0].certos[0]; IgoUI.T.onToque(ponto); IgoUI.T.onToque(ponto); });
      assert.equal(await p.page.evaluate(() => trabalhos.length), 1);
      await p.page.click('#prob-prox');
      const antes = await p.page.locator('#goban').innerHTML();
      await p.page.evaluate(() => responder(0, { lista: [{ p: PROBLEMAS.lista[0].certos[0], v: 1 }] }));
      assert.equal(await p.page.locator('#goban').innerHTML(), antes);
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('desfazer com abertura CPU, passe e handicap conserva a vez humana', async () => {
    for (const handicap of [0, 2]) {
      const g = Go.novo(9, { handicap });
      const corCpu = g.vez, minhaCor = 3 - corCpu;
      Go.jogar(g, 0); Go.jogar(g, Go.PASSE); Go.jogar(g, 1);
      const p = await pagina({ 'igoon.jogo': salvo(Go.serializar(g), { oponente: 'cpu', minhaCor }) });
      try {
        await p.page.click('#undo-btn');
        const estado = await p.page.evaluate(() => { const j = IgoUI.jogoAtual(); return { vez: j.g.vez, lances: j.g.lances.length, h: j.g.handicap }; });
        assert.deepEqual(estado, { vez: minhaCor, lances: 1, h: handicap });
        assert.equal(await p.page.locator('#undo-btn').isEnabled(), false);
      } finally { await p.fechar(); }
    }
  });
  await teste('modo e Novo jogo descartam resposta atrasada da CPU', async () => {
    const p = await pagina({ 'igoon.jogo': salvo(jogada(0), { oponente: 'cpu' }) });
    try {
      await p.page.evaluate(() => IgoUI.setModo('licoes'));
      await p.page.evaluate(() => responder(0, { p: 1 }));
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().g.lances.length), 1);
      await p.page.evaluate(() => IgoUI.setModo('jogar'));
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().pensando), true);
      await p.page.click('#restart-btn'); await p.page.click('#confirm-yes');
      await p.page.evaluate(() => responder(1, { p: 1 }));
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().g.lances.length), 0);
      assert.equal(await p.page.evaluate(() => IgoUI.jogoAtual().status), 'pronto');
    } finally { await p.fechar(); }
  });
  await teste('contagem e limites de handicap e komi', () => {
    for (const [n, max] of [[9,5], [13,9], [19,9]]) {
      for (let h = 2; h <= max; h++) {
        const g = Go.novo(n, { handicap: h });
        assert.equal(g.setup[1].length, h); assert.equal(g.vez, 2); assert.equal(g.komi, 0.5);
      }
      assert.equal(Go.komiPadrao('jp', 0), 6.5); assert.equal(Go.komiPadrao('cn', 0), 7.5);
    }
    const g = Go.deTabuleiro(['.XO..', '.XO..', '.XO..', '.XO..', '.XO..'], { komi: 0 });
    g.cap[1] = 2;
    assert.equal(Go.pontuar(g, [], []).preto.total, 7);
    assert.equal(Go.pontuar(g, [], [0]).preto.total, 2);
    g.regras = 'cn';
    assert.equal(Go.pontuar(g, [], [0]).preto.total, 10);
  });
  await teste('260, 390 e 1100 pixels sem rolagem horizontal nos três modos', async () => {
    const p = await pagina();
    try {
      for (const width of [260,390,1100]) {
        await p.page.setViewportSize({ width, height: 900 });
        for (const modo of ['jogar','licoes','problemas']) {
          await p.page.evaluate(modo => IgoUI.setModo(modo), modo);
          assert.equal(await p.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px ${modo}`);
        }
      }
      assert.deepEqual(p.erros, []);
    } finally { await p.fechar(); }
  });
  await teste('24 sequências legais e coordenadas das explicações', () => {
    for (const q of PR.lista) {
      const g = Go.deTabuleiro(q.linhas, { vez: q.usuario, regras: 'jp', komi: 0 });
      assert.ok(q.explicacao.includes(Go.nomePonto(q.certos[0], g.n)));
      for (const m of q.sequencia) { assert.equal(g.vez, m.c, q.id); assert.equal(Go.jogar(g, m.p).ok, true, q.id); }
      const def = 3 - q.atacante;
      if (q.fim === 'capturado') assert.ok(q.alvo.every(i => g.b[i] !== def), q.id);
      else if (q.fim === 'vivo') assert.ok(q.alvo.some(i => Go.benson(g.b, g.n, def).includes(i)), q.id);
    }
  });
  await teste('cache igoon-v2 instala e recarrega o jogo offline', async () => {
    const ctx = await browser.newContext({ serviceWorkers: 'allow' });
    try {
      const page = await ctx.newPage();
      await page.addInitScript(() => localStorage.setItem('igoon.visto', 'true'));
      await page.goto(process.env.IGOON_URL || 'http://127.0.0.1:8806');
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      assert.ok(await page.evaluate(async () => (await caches.keys()).includes('igoon-v2')));
      await ctx.setOffline(true);
      await page.reload();
      await page.waitForFunction(() => IgoUI?.jogoAtual());
      assert.equal(await page.title(), 'IgoON!');
    } finally { await ctx.close(); }
  });
  await browser.close();
  console.log(`${acertos} testes passaram; ${falhas} falharam.`);
  process.exitCode = falhas ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
