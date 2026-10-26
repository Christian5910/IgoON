# IgoON!

Go (囲碁, igo) com o visual da família ON!, para celular e computador. Dá para jogar contra o computador em cinco níveis ou com um amigo no mesmo aparelho, em tabuleiros 9×9, 13×13 e 19×19, com regras japonesas ou chinesas. Tem lições no tabuleiro, 24 problemas de vida e morte (tsume-go), handicap, komi ajustável, partidas salvas e abertas em SGF e revisão lance a lance. O botão Como Jogar tem um guia completo, com glossário em japonês (kanji, hiragana e romaji). Tudo funciona offline.

**Jogue:** https://igoon.netlify.app/ · **Mais jogos:** https://speccygames.netlify.app/

## Modos

| Modo | O que faz |
|---|---|
| Jogar | partida contra o computador (níveis 1 a 5) ou com um amigo, com Passar, Desfazer, Dica, Território (estimativa), Desistir, marcação de pedras mortas, contagem e placar detalhado |
| Lições | 11 lições curtas e interativas: colocar pedras, liberdades, capturar, fugir do atari, jogadas proibidas, ko, dois olhos, contar pontos, pedras mortas, komi e handicap, seki |
| Problemas | 24 problemas de vida e morte, do espaço de 3 pontos ao de 6, com dica, solução e explicação |

## Regras implementadas

- Suicídio proibido nas duas regras.
- Ko simples (não recriar a posição de antes do último lance) nas duas regras.
- Japonesa: território mais prisioneiros (incluindo as pedras mortas retiradas), komi padrão 6,5. Como simplificação do IgoON!, a terceira ocorrência da mesma posição com o mesmo jogador a jogar encerra automaticamente a partida sem resultado (無勝負, mushōbu). O regulamento japonês oficial exige acordo dos dois jogadores diante de repetição e não fixa três ocorrências.
- Chinesa: área (pedras vivas mais território), komi padrão 7,5; superko posicional (nenhuma posição de tabuleiro pode se repetir).
- Fim da partida por dois passes seguidos, depois marcação das pedras mortas. Na regra japonesa, marque à mão como neutras também as regiões de olhos dos grupos em seki, mesmo cercadas por uma só cor. Se os jogadores discordam, dá para continuar jogando. O IgoON! mantém a ordem normal dos turnos na retomada; no regulamento japonês oficial, o adversário de quem pede a retomada tem direito ao primeiro lance.
- Handicap de 2 a 5 pedras no 9×9 e de 2 a 9 nos tabuleiros 13×13 e 19×19, nos pontos de estrela, com komi padrão 0,5 (pode ser mudado).
- Desistência.

## Salvar, abrir e revisar (SGF)

Salvar SGF baixa a partida no formato padrão do Go, que abre em praticamente qualquer programa ou site. Abrir SGF confere cada lance com as regras e avisa se algum for ilegal. Com uma partida aberta ou terminada, Revisar anda lance a lance, e Continuar daqui retoma o jogo a partir do lance que está na tela. Se o arquivo tiver variações, só a linha principal é aberta.

## Como o computador funciona

A cada lance, o computador joga milhares de partidas rápidas de "mentirinha" a partir da posição atual (busca de Monte Carlo em árvore, com UCT e RAVE) e escolhe o lance que mais venceu. Os níveis mudam o número de simulações e o tempo por lance (o nível 5 pensa por até 15 segundos). Tudo roda no aparelho, em um Web Worker, então a tela não trava e não há servidor.

Limites, ditos com honestidade:

- A força dos níveis não está calibrada em graus oficiais (kyu e dan). A força relativa foi conferida com partidas entre os níveis.
- Em 19×19 o computador fica bem mais fraco, porque o tabuleiro é grande demais para tantas simulações.
- O computador nunca desiste.
- A sugestão de pedras mortas e a estimativa de território são feitas por simulação e podem errar; sempre confira.

## Problemas de vida e morte

Cada problema foi resolvido por uma busca completa (todas as respostas dos dois lados dentro da área do problema, com vida incondicional de Benson), e só entraram os que têm resultado decisivo, sem depender de ko. A área é selada: as pedras de fora são consideradas seguras.

## Como foi feito

Site estático em HTML, CSS e JavaScript puros, sem dependências e sem build. A base visual e o comportamento comum (menu, modais, configurações, sons) vêm de `on.css` e `on.js`, copiados da pasta compartilhada pelo `sync.ps1`.

| Arquivo | Função |
|---|---|
| `regras.js` | motor de regras do Go (grupos, capturas, ko, superko, contagem, Benson, handicap) |
| `sgf.js` | leitura e escrita de SGF (FF[4]) |
| `ia.js`, `motor.js` | computador (MCTS) e Web Worker |
| `tsume.js`, `problemas.js` | solucionador de vida e morte e os 24 problemas verificados |
| `licoes.js` | as 11 lições |
| `goban.js` | tabuleiro em SVG e diagramas do Como Jogar |
| `javinhas.js`, `estudo.js` | interface: partida, marcação, revisão, SGF, lições e problemas |
| `colorido.css` | estilos próprios do jogo |
| `service-worker.js` | funciona offline (`CACHE_NAME` = `igoon-v2`; aumente a cada publicação) |

### Testes

Os testes originais não vieram neste pacote (pasta `testes-igoon/` do autor): regras comparadas posição a posição com o sgfmill, leitura e escrita de SGF, táticas do computador, solucionador, dados das lições e dos problemas, e testes no navegador (Playwright) em 260, 390 e 1100 pixels de largura.

A revisão independente de 25/10/2026 está registrada em `REVISAO-PENDENTE.txt`, agora concluída. A suíte incluída em `testes-igoon/revisao.cjs` verifica as correções, as 11 lições pela interface, os 24 problemas e o Worker real nos cinco níveis. Ela usa Node e uma instalação existente do Playwright, sem dependências novas no jogo.

Para repetir: inicie `python -m http.server 8806 --bind 127.0.0.1` nesta pasta e, em outro terminal, rode `node testes-igoon/revisao.cjs`. Se necessário, aponte `NODE_PATH` para a pasta `node_modules` que contém Playwright e `CHROME_PATH` para o executável do Chrome. `IGOON_URL` permite usar outro endereço local. Os testes usam contextos isolados e não alteram suas partidas no navegador habitual.

### Chaves do localStorage

`igoon.jogo` (partida em andamento), `igoon.prefs` (opções da partida), `igoon.stats` (vitórias e derrotas por nível), `igoon.estudo` (lições e problemas concluídos), `igoon.visto`, `igoon.modo`, `igoon.cfg` (som, vibração, tema).

## Publicar

Suba a pasta inteira no Netlify (site `igoon`). Depois de mudar qualquer arquivo, aumente a versão em `CACHE_NAME` do `service-worker.js` (ou rode `python3 gerar-sw.py` de novo com a versão nova).

## Família ON!

IgoON! segue a base visual do DiciON!, do 2048ON!, do MinesON!, do ChezzON! e do PaciON!. `on.css` e `on.js` são idênticos em todos os projetos, e as regras estão em `PADRAO.md`.

---

Feito por Christian ([@Christian5910](https://github.com/Christian5910)).
