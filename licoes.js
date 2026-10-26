/* ==========================================================================
   IgoON! - licoes.js  (lições interativas no tabuleiro)
   Cada lição tem passos. Tipos de passo:
     jogar    toque num ponto (aceita: lista de [x,y]; ou criterio 'qualquer')
     ilegal   toque num ponto que o jogo vai recusar (pontos + erro esperado: 'suicidio' | 'ko')
     marcar   toque nos grupos mortos (mortas: lista de [x,y], uma por grupo)
     escolha  pergunta com opções
     problema referência a um problema de vida e morte (id em problemas.js)
   Coordenadas [x, y] contam da esquerda para a direita e de cima para baixo, a partir de 0.
   Os textos usam <ruby> para o furigana. Tudo aqui é conferido por testes-igoon/t11_licoes.js
   ========================================================================== */
(function (raiz) {
  'use strict';
  const R = (k, f) => '<ruby>' + k + '<rt>' + f + '</rt></ruby>';

  const L = [];

  /* 1 ---------------------------------------------------------------- */
  L.push({
    id: 'pedras', titulo: 'Colocando pedras',
    resumo: 'Onde as pedras ficam e quem começa.',
    passos: [
      { tipo: 'jogar', n: 5, vez: 1, criterio: 'qualquer',
        texto: 'Este é um tabuleiro pequeno, de 5 por 5 linhas. O Preto sempre joga primeiro. Toque numa interseção, o cruzamento de duas linhas, para colocar uma pedra preta.',
        ok: 'Muito bem! As pedras ficam nos cruzamentos das linhas, e não dentro dos quadrados. Depois de colocada, a pedra não anda mais: ela só sai do tabuleiro se for capturada.' },
      { tipo: 'escolha', n: 5, vez: 1,
        texto: 'Em Go, onde as pedras são colocadas?',
        opcoes: ['Dentro dos quadrados, como no xadrez', 'Nas interseções, os cruzamentos das linhas', 'Só nas bordas do tabuleiro'], certa: 1,
        ok: 'Isso mesmo. Um tabuleiro de 19 linhas por 19 tem 19 × 19 = 361 interseções, e cada uma é um lugar para jogar.',
        erro: 'Não. Olhe o desenho: as pedras ficam sobre os cruzamentos das linhas.' },
      { tipo: 'escolha', n: 5, vez: 1,
        texto: 'Numa partida sem handicap, quem joga primeiro?',
        opcoes: ['O Branco', 'O Preto', 'Quem ganhar no sorteio'], certa: 1,
        ok: 'O Preto abre a partida, e depois os dois se alternam, um lance por vez. Com handicap (' + R('置碁', 'おきご') + ', okigo), o Preto coloca as pedras de vantagem e o Branco joga primeiro.',
        erro: 'Não. No Go o Preto (' + R('黒', 'くろ') + ', kuro) sempre começa quando não há handicap.' }
    ]
  });

  /* 2 ---------------------------------------------------------------- */
  L.push({
    id: 'liberdades', titulo: 'Liberdades',
    resumo: 'O que mantém uma pedra viva no tabuleiro.',
    passos: [
      { tipo: 'escolha', n: 5, vez: 1, setup: { 1: [[2, 2]] }, mostrarDepois: [[2, 1], [1, 2], [3, 2], [2, 3]],
        texto: 'Liberdade é uma interseção vazia colada na pedra, em cima, embaixo, à esquerda ou à direita (a diagonal não conta). Quantas liberdades tem esta pedra preta no meio do tabuleiro?',
        opcoes: ['2', '3', '4'], certa: 2,
        ok: 'Quatro, uma em cada direção. As liberdades aparecem marcadas com um pontinho.',
        erro: 'Conte só os pontos vazios de cima, de baixo, da esquerda e da direita.' },
      { tipo: 'escolha', n: 5, vez: 1, setup: { 1: [[2, 0]] }, mostrarDepois: [[1, 0], [3, 0], [2, 1]],
        texto: 'E esta pedra, que está na borda do tabuleiro? A borda não é uma interseção, então não conta.',
        opcoes: ['2', '3', '4'], certa: 1,
        ok: 'Três. Na borda a pedra perde uma liberdade, porque do outro lado não há mais tabuleiro.',
        erro: 'Fora do tabuleiro não há interseção. Conte só os pontos vazios que existem.' },
      { tipo: 'escolha', n: 5, vez: 1, setup: { 1: [[0, 0]] }, mostrarDepois: [[1, 0], [0, 1]],
        texto: 'E esta pedra, no canto?',
        opcoes: ['2', '3', '4'], certa: 0,
        ok: 'Duas. No canto a pedra tem menos liberdades, por isso é mais fácil de capturar.',
        erro: 'No canto, dois lados são borda. Sobram só dois pontos vizinhos.' },
      { tipo: 'escolha', n: 5, vez: 1, setup: { 1: [[1, 1], [2, 1], [2, 2]] }, mostrarDepois: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [3, 2], [2, 3]],
        texto: 'Pedras da mesma cor coladas, na horizontal ou na vertical, formam um grupo (também chamado de cadeia) e dividem as liberdades. Quantas liberdades tem este grupo de três pedras?',
        opcoes: ['5', '6', '7'], certa: 2,
        ok: 'Sete. Conte cada ponto vazio vizinho de qualquer pedra do grupo, sem repetir nenhum. Um grupo só é capturado quando perde todas as liberdades, e não pedra por pedra.',
        erro: 'Conte cada ponto vazio colado em alguma das três pedras, uma única vez.' }
    ]
  });

  /* 3 ---------------------------------------------------------------- */
  L.push({
    id: 'captura', titulo: 'Capturar',
    resumo: 'Tirar as liberdades do adversário.',
    passos: [
      { tipo: 'jogar', n: 5, vez: 1, setup: { 1: [[1, 2], [2, 1], [3, 2]], 2: [[2, 2]] }, aceita: [[2, 3]],
        texto: 'A pedra branca tem só uma liberdade. Esta situação se chama atari (' + R('当', 'あ') + 'たり, atari): a pedra pode ser capturada no próximo lance se não escapar. Capture-a jogando na última liberdade.',
        ok: 'Capturada! A pedra branca sai do tabuleiro e vira um prisioneiro (' + R('上', 'あ') + 'げ' + R('浜', 'はま') + ', agehama) do Preto.',
        errPadrao: 'Essa jogada não captura. Procure a única interseção vazia colada na pedra branca.' },
      { tipo: 'jogar', n: 5, vez: 1, setup: { 1: [[2, 0], [1, 1], [3, 1], [1, 2], [3, 2]], 2: [[2, 1], [2, 2]] }, aceita: [[2, 3]],
        texto: 'Um grupo também pode ser capturado. Estas duas pedras brancas estão ligadas e têm uma liberdade só. Capture o grupo.',
        ok: 'As duas pedras saíram de uma vez. Quando o grupo perde a última liberdade, todas as pedras dele são removidas juntas.',
        errPadrao: 'Ainda não. Procure o único ponto vazio colado no grupo branco.' },
      { tipo: 'jogar', n: 5, vez: 1, setup: { 1: [[0, 1], [0, 3]], 2: [[0, 2]] }, aceita: [[1, 2]],
        texto: 'Na borda é mais fácil. A pedra branca já está com duas pedras pretas nos lados e a borda atrás. Capture-a.',
        ok: 'A borda ajudou: ela fez o papel de uma pedra preta. Por isso, na borda e nos cantos, os grupos têm menos liberdades.',
        errPadrao: 'Essa não captura. Veja qual interseção vazia está colada na pedra branca.' }
    ]
  });

  /* 4 ---------------------------------------------------------------- */
  L.push({
    id: 'fuga', titulo: 'Fugir do atari',
    resumo: 'Como salvar uma pedra que está para ser capturada.',
    passos: [
      { tipo: 'jogar', n: 5, vez: 1, setup: { 1: [[2, 2]], 2: [[1, 2], [3, 2], [2, 1]] }, aceita: [[2, 3]],
        texto: 'Agora é a sua pedra preta que está em atari: só resta uma liberdade, embaixo dela. Se o Branco jogar ali, ela é capturada. Salve-a estendendo para essa liberdade.',
        ok: 'Salvou! A pedra e a nova formam um grupo com três liberdades. Estender é a forma mais comum de fugir de um atari.',
        errPadrao: 'Essa jogada não salva a pedra: o Branco ainda captura na liberdade de baixo. Estenda a pedra para lá.' },
      { tipo: 'escolha', n: 5, vez: 1, setup: { 1: [[2, 2]], 2: [[1, 2], [3, 2], [2, 1], [1, 3], [3, 3]] }, marcasInicio: [[2, 3]],
        texto: 'Agora o Branco também tem pedras dos dois lados de baixo. A sua pedra continua em atari. Se você estender para o ponto marcado, ela se salva?',
        opcoes: ['Sim, estender sempre salva', 'Não, o grupo ficaria de novo com uma liberdade só'], certa: 1,
        ok: 'Isso. Estendendo para o ponto marcado, o grupo teria só a liberdade de baixo, e o Branco o capturaria. Antes de fugir, conte as liberdades que sobram depois da jogada.',
        erro: 'Conte: depois de estender, o grupo teria só a liberdade de baixo. O Branco joga ali e captura.' }
    ]
  });

  /* 5 ---------------------------------------------------------------- */
  L.push({
    id: 'proibido', titulo: 'Jogadas proibidas',
    resumo: 'O suicídio e a exceção da captura.',
    passos: [
      { tipo: 'ilegal', n: 5, vez: 1, setup: { 2: [[1, 0], [0, 1], [1, 1]] }, pontos: [[0, 0]], erro: 'suicidio',
        texto: 'Não se pode jogar numa interseção onde a própria pedra ficaria sem liberdades e sem capturar nada: isso se chama suicídio. Toque no canto, no ponto marcado, e veja o que o jogo responde.',
        ok: 'O jogo recusou. Uma pedra preta ali ficaria sem nenhuma liberdade, e as pedras brancas ao lado ainda têm outras liberdades, então nada seria capturado.',
        marcasInicio: [[0, 0]] },
      { tipo: 'jogar', n: 5, vez: 1, setup: { 1: [[2, 0], [1, 1], [0, 2]], 2: [[1, 0], [0, 1]] }, aceita: [[0, 0]], marcasInicio: [[0, 0]],
        texto: 'Mas há uma exceção. Aqui jogar no canto também deixaria a pedra sem liberdades, só que agora as duas pedras brancas têm esse canto como única liberdade. Jogue lá.',
        ok: 'Permitido! A jogada captura as duas pedras brancas, e então a pedra preta ganha liberdades. Regra geral: primeiro se removem as pedras capturadas, depois se verifica se a pedra que jogou tem liberdade.',
        errPadrao: 'Jogue no ponto marcado: ele captura as duas pedras brancas.' }
    ]
  });

  /* 6 ---------------------------------------------------------------- */
  L.push({
    id: 'ko', titulo: 'Ko',
    resumo: 'A regra que impede a repetição eterna.',
    passos: [
      { tipo: 'jogar', n: 5, vez: 1, setup: { 1: [[1, 0], [0, 1], [1, 2]], 2: [[2, 0], [1, 1], [3, 1], [2, 2]] }, aceita: [[2, 1]],
        texto: 'Esta é uma situação de ko (' + R('劫', 'こう') + ', kō). A pedra branca do meio está em atari. Capture-a jogando no ponto vazio entre as pedras brancas.',
        ok: 'Capturou. Agora olhe: a sua pedra recém-jogada também ficou com uma única liberdade, justamente o ponto da captura.',
        errPadrao: 'Essa não captura. A pedra branca do meio tem só uma liberdade: o ponto vazio à direita dela.' },
      { tipo: 'ilegal', n: 5, setup: { 1: [[1, 0], [0, 1], [1, 2]], 2: [[2, 0], [1, 1], [3, 1], [2, 2]] }, antes: [[2, 1, 1]],
        pontos: [[1, 1]], erro: 'ko', marcasInicio: [[1, 1]],
        texto: 'Agora é a vez do Branco. Se ele recapturar a pedra preta jogando no ponto marcado, o tabuleiro voltaria exatamente ao que era antes, e o jogo recomeçaria sem fim. Toque no ponto marcado e veja.',
        ok: 'O jogo recusou: é a regra do ko. Quem perdeu a pedra não pode recapturar logo em seguida. Primeiro precisa jogar em outro lugar, de preferência uma ameaça que o adversário tenha de responder, e só depois, se o ko continuar aberto, recapturar.' },
      { tipo: 'escolha', n: 5, setup: { 1: [[1, 0], [0, 1], [1, 2]], 2: [[2, 0], [1, 1], [3, 1], [2, 2]] }, antes: [[2, 1, 1]],
        texto: 'Uma jogada que ameaça algo grande, para o adversário ter de responder e então liberar a recaptura, chama-se ameaça de ko (' + R('劫材', 'こうざい') + ', kōzai). O que o Branco pode fazer agora?',
        opcoes: ['Recapturar no mesmo ponto, de imediato', 'Jogar uma ameaça em outro lugar e, depois da resposta, recapturar', 'Passar e esperar o Preto errar'], certa: 1,
        ok: 'Isso. Se o Preto responder à ameaça, o Branco pode recapturar, porque o tabuleiro já mudou. Se o Preto ignorar a ameaça e fechar o ko, o Branco cumpre a ameaça e ganha em outro lugar.',
        erro: 'Recapturar de imediato é proibido pelo ko. Passar não cria ameaça nenhuma. A saída é jogar em outro lugar uma ameaça que o adversário precise responder.' }
    ]
  });

  /* 7 ---------------------------------------------------------------- */
  L.push({
    id: 'olhos', titulo: 'Dois olhos',
    resumo: 'Por que um grupo com dois olhos nunca é capturado.',
    passos: [
      { tipo: 'problema', id: 'v03',
        texto: 'Um olho (' + R('眼', 'め') + ', me) é um espaço vazio dentro de um grupo. O grupo branco abaixo tem espaço para olhos, mas ainda não tem dois. Faça o Branco viver com uma jogada só: onde dividir o espaço em dois olhos?' },
      { tipo: 'escolha', n: 5, vez: 1,
        texto: 'Por que um grupo com dois olhos separados não pode ser capturado?',
        opcoes: ['Porque o adversário nunca consegue jogar dentro de um olho', 'Porque, para capturar, o adversário teria de jogar nos dois olhos, e a primeira jogada em um deles seria suicídio, a menos que capture', 'Porque os olhos dão pontos extras'], certa: 1,
        ok: 'Isso. Num olho real de um ponto, o adversário só pode jogar se capturar o grupo. Com dois desses olhos, o outro olho impede a captura e já a primeira jogada adversária em qualquer um deles seria suicídio. Dois olhos reais garantem a vida do grupo (' + R('二眼', 'にがん') + ', nigan).',
        erro: 'Num olho real de um ponto, a pedra adversária ficaria sem liberdade, o que é suicídio, a menos que capture o grupo. Com dois olhos, a captura nunca chega a acontecer.' },
      { tipo: 'problema', id: 'v01',
        texto: 'Agora o contrário: o Preto joga primeiro e quer matar o grupo branco. Onde está o ponto vital (' + R('急所', 'きゅうしょ') + ', kyūsho)?' }
    ]
  });

  /* 8 ---------------------------------------------------------------- */
  const FIM5 = ['.XO..', '.XO..', '.XO..', '.XO..', '.XO..'];
  L.push({
    id: 'contagem', titulo: 'Contar pontos',
    resumo: 'Território japonês e área chinesa, no mesmo tabuleiro.',
    passos: [
      { tipo: 'escolha', n: 5, vez: 1, linhas: ['.XO..', '.XO..', '.XO..', '.XO..', '.XO..'], terrDepois: true,
        texto: 'A partida acabou, sem pedras mortas. As pedras pretas fecharam a coluna da esquerda, e as brancas fecharam o resto. Quantos pontos de território (' + R('地', 'じ') + ', ji) tem o Preto, ou seja, quantos pontos vazios só ele cerca?',
        opcoes: ['4', '5', '10'], certa: 1,
        ok: 'Cinco, a coluna da esquerda. Território é o conjunto de pontos vazios cercados por pedras de um só lado. O Branco tem 10 pontos de território, as duas colunas da direita.',
        erro: 'Conte só os pontos vazios da coluna da esquerda, que ficam colados nas pedras pretas.' },
      { tipo: 'escolha', n: 5, vez: 1, linhas: ['.XO..', '.XO..', '.XO..', '.XO..', '.XO..'], terrDepois: true, prisioneiros: { 1: 2, 2: 0 }, komi: 0,
        texto: 'Pela regra japonesa, o placar é o território mais os prisioneiros capturados. Suponha que o Preto capturou 2 pedras brancas durante a partida e o Branco nenhuma. Quanto o Preto faz, sem komi?',
        opcoes: ['5', '7', '12'], certa: 1,
        ok: 'Sete: 5 de território + 2 prisioneiros. As pedras que estão no tabuleiro não valem pontos na contagem japonesa. Já o Branco faz 10, então ganha por 3.',
        erro: 'Na contagem japonesa, soma-se território e prisioneiros. As pedras no tabuleiro não entram.' },
      { tipo: 'escolha', n: 5, vez: 1, linhas: ['.XO..', '.XO..', '.XO..', '.XO..', '.XO..'], terrDepois: true, komi: 0,
        texto: 'Pela regra chinesa conta-se a área: as pedras vivas no tabuleiro mais o território. Quanto vale o Preto aqui? (Os prisioneiros não entram.)',
        opcoes: ['5', '10', '15'], certa: 1,
        ok: 'Dez: 5 pedras + 5 pontos de território. O Branco faz 5 pedras + 10 de território = 15. A diferença entre os dois lados é 5 pontos, igual à da contagem japonesa (5 a 10, sem prisioneiros). Em outras posições, os dois sistemas podem produzir diferenças no placar e até no vencedor.',
        erro: 'Na contagem chinesa soma-se o que cada lado tem no tabuleiro: pedras vivas e território.' }
    ]
  });

  /* 9 ---------------------------------------------------------------- */
  L.push({
    id: 'mortas', titulo: 'Pedras mortas',
    resumo: 'Como se encerra a partida quando ainda há pedras sem salvação.',
    passos: [
      { tipo: 'marcar', n: 5, vez: 1, linhas: ['.XO..', '.XO..', 'OXO..', '.XO..', '.XOX.'], mortas: [[0, 2], [3, 4]],
        texto: 'Os dois jogadores passaram. Na tela de fim de jogo você marca as pedras mortas, as que não teriam como se salvar se a partida continuasse, e elas são retiradas na contagem. Toque nos dois grupos mortos deste diagrama: a pedra branca que ficou na área preta e a preta que ficou na área branca.',
        ok: 'Isso. As duas pedras estão sem saída, então saem na contagem e contam como prisioneiros do adversário. Se os jogadores discordam sobre uma pedra, a partida volta a ser jogada, e o desfecho é decidido no tabuleiro.',
        erro: 'Marque só os grupos sem chance de viver. As pedras de uma das cores que estão sozinhas dentro do território do outro lado são as mortas.' }
    ]
  });

  /* 10 --------------------------------------------------------------- */
  L.push({
    id: 'komi', titulo: 'Komi e handicap',
    resumo: 'Como equilibrar uma partida entre jogadores de forças diferentes.',
    passos: [
      { tipo: 'escolha', n: 9, vez: 1,
        texto: 'O Preto joga primeiro e isso dá uma vantagem. Para compensar, o Branco recebe pontos no final: o komi (コミ, komi). Neste site o komi padrão é 6,5 na regra japonesa e 7,5 na chinesa. Por que o komi termina em ,5?',
        opcoes: ['Para evitar empate', 'Para dar sorte ao Branco', 'Porque as pedras valem meio ponto'], certa: 0,
        ok: 'Isso. Como os pontos do tabuleiro são inteiros, o meio ponto garante que um dos dois sempre vence.',
        erro: 'Pense no resultado final: sem o ,5 os dois poderiam terminar com o mesmo número de pontos.' },
      { tipo: 'escolha', n: 9, vez: 1,
        texto: 'Quando um jogador é bem mais fraco, usa-se o handicap (' + R('置碁', 'おきご') + ', okigo). O que acontece?',
        opcoes: ['O Preto, o mais fraco, coloca pedras extras antes do primeiro lance e o Branco joga primeiro', 'O Branco passa os primeiros lances', 'O tabuleiro fica menor'], certa: 0,
        ok: 'Isso. Cada pedra de handicap equivale, grosso modo, a um grau de diferença de força entre os jogadores. As pedras vão nos pontos de estrela (' + R('星', 'ほし') + ', hoshi). Neste site, com handicap o komi padrão é 0,5, só para não haver empate, e você pode mudá-lo.',
        erro: 'No handicap o jogador mais fraco joga com Preto e já começa com pedras no tabuleiro.' }
    ]
  });

  /* 11 --------------------------------------------------------------- */
  L.push({
    id: 'seki', titulo: 'Seki',
    resumo: 'Quando nenhum dos dois pode capturar o outro.',
    passos: [
      { tipo: 'escolha', n: 5, vez: 1, linhas: ['OO.XX', 'OO.XX', 'OOOXX', 'OOOXX', 'OOOXX'],
        texto: 'Nesta posição, os dois grupos têm exatamente as mesmas duas liberdades, os dois pontos vazios do meio. Quem jogar primeiro num deles fica em atari e é capturado pelo adversário. Isso se chama seki (セキ). O que acontece com os grupos?',
        opcoes: ['O Preto captura o Branco', 'Ninguém captura ninguém: os dois ficam vivos e os pontos compartilhados ficam sem dono', 'O Branco captura o Preto'], certa: 1,
        ok: 'Isso. No seki as pedras permanecem no tabuleiro e os pontos vazios entre os dois grupos não contam para ninguém. Em regras japonesas, os olhos dos grupos em seki também não valem território: marque essas regiões como neutras na hora de contar, mesmo cercadas por uma só cor.',
        erro: 'Se alguém jogar primeiro nos pontos vazios, ele mesmo entra em atari. Por isso nenhum dos dois quer jogar ali, e ninguém é capturado.' }
    ]
  });

  // Monta a posição de um passo (jogo de regras.js). `Go` é o motor de regras.
  L.montar = function (passo, Go) {
    const n = passo.n || 5;
    let g;
    if (passo.linhas) {
      g = Go.deTabuleiro(passo.linhas, { vez: passo.vez || 1, regras: 'jp', komi: passo.komi != null ? passo.komi : 0 });
    } else {
      const s = { 1: [], 2: [] };
      const st = passo.setup || {};
      [1, 2].forEach((c) => (st[c] || []).forEach((p) => s[c].push(p[1] * n + p[0])));
      g = Go.novo(n, { regras: 'jp', komi: 0, setup: s, primeiro: passo.vez || 1 });
    }
    (passo.antes || []).forEach((m) => {
      if (g.vez !== m[2]) throw new Error('lição: lance anterior de cor errada');
      const r = Go.jogar(g, m[1] * n + m[0]);
      if (!r.ok) throw new Error('lição: lance anterior ilegal ' + m);
    });
    return g;
  };

  raiz.LICOES = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
