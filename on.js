/* ==========================================================================
   on.js: base compartilhada dos jogos ON!   (versão em ON.version)
   Idêntico em todos os projetos (edite em Base-Compartilhada/_shared e rode sync.ps1).

   Cuida de: menu lateral (atalho Outros Jogos, estatísticas, configurações,
   instalar app, redes em acordeão, pix), modais no padrão DiciON!,
   confirmação de "novo jogo", botão Voltar do celular, sons sintetizados e vibração.

   Uso no jogo:
     ON.init({
       id: 'dicion', nome: 'DiciON!',
       configuracoes: ['som', 'vibracao', 'tremor', 'escuro', 'reduzir'],
       estatisticas: () => [{ rotulo: 'Partidas', valor: 12 }, ...],
       zerarEstatisticas: () => { ... },
       qrpix: 'assets/qrpix.png',   // opcional (esse já é o padrão)
       pix: true,                   // opcional: false esconde o bloco do Pix
     });
   ========================================================================== */
(function () {
  'use strict';

  var VERSAO = '2.0.0';
  var ESQUEMA = 2; // versão do formato salvo em <id>.cfg
  var HUB = 'https://speccygames.netlify.app/';

  /* Só os rótulos; o ícone de cada opção vem de iconeOpcao() */
  var ROTULOS = {
    som: 'Som',
    vibracao: 'Vibração',
    escuro: 'Modo escuro',
    reduzir: 'Reduzir animações',
    tremor: 'Tremor da tela'
  };
  /* O tema (escuro) não tem padrão fixo: sem escolha salva, segue o aparelho (ver lerConfig) */
  var CFG_PADRAO = { som: true, vibracao: true, tremor: true };

  /* Padrões de vibração (ms: vibra, pausa, vibra...). O celular só vibra se o navegador
     permitir (Android/Chrome sim; Safari do iPhone não tem essa API). */
  var PADROES = {
    leve: 12,
    toque: 18,
    erro: 60,
    vitoria: [70, 50, 70, 50, 70, 50, 280],
    derrota: [150, 60, 150, 60, 150, 60, 380],
    explosao: [60, 30, 60, 30, 60, 30, 60, 30, 60, 30, 440],
    mover: 10,
    captura: 28,
    xeque: [40, 30, 70],
    roque: [14, 26, 14],
    promocao: [20, 30, 20, 30, 50]
  };

  /* Ícones SVG no padrão Bootstrap Icons (16x16, fill currentColor).
     Use ON.icone('nome', tamanhoEmPx). Os de redes sociais seguem em 24x24. */
  function bi(corpo) {
    return '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">' + corpo + '</svg>';
  }

  var ICONES = {
    casa: bi('<path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z"/><path d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z"/>'),
    baixar: bi('<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>'),
    sol: bi('<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>'),
    lua: bi('<path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/><path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>'),
    somLigado: bi('<path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/><path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/><path d="M8.707 11.182A4.5 4.5 0 0 0 10.025 8a4.5 4.5 0 0 0-1.318-3.182L8 5.525A3.5 3.5 0 0 1 9.025 8 3.5 3.5 0 0 1 8 10.475zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06"/>'),
    somMudo: bi('<path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06m7.137 2.096a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0"/>'),
    engrenagem: bi('<path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.08.284a.96.96 0 0 0 1.187 1.187l.283-.081c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.284-.08a.96.96 0 0 0-1.187 1.187l.081.283c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.08-.284a.96.96 0 0 0-1.186-1.187l-.284.081c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.284.08a.96.96 0 0 0 1.187-1.186l-.081-.284c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5m0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78zM5.048 3.967l-.087.065zm-.431.355A4.98 4.98 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8zm.344 7.646.087.065z"/>'),
    controle: bi('<path d="M11.5 6.027a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m2.5-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m-6.5-3h1v1h1v1h-1v1h-1v-1h-1v-1h1z"/><path d="M3.051 3.26a.5.5 0 0 1 .354-.613l1.932-.518a.5.5 0 0 1 .62.39c.655-.079 1.35-.117 2.043-.117.72 0 1.443.041 2.12.126a.5.5 0 0 1 .622-.399l1.932.518a.5.5 0 0 1 .306.729q.211.136.373.297c.408.408.78 1.05 1.095 1.772.32.733.599 1.591.805 2.466s.34 1.78.364 2.606c.024.816-.059 1.602-.328 2.21a1.42 1.42 0 0 1-1.445.83c-.636-.067-1.115-.394-1.513-.773-.245-.232-.496-.526-.739-.808-.126-.148-.25-.292-.368-.423-.728-.804-1.597-1.527-3.224-1.527s-2.496.723-3.224 1.527c-.119.131-.242.275-.368.423-.243.282-.494.575-.739.808-.398.38-.877.706-1.513.773a1.42 1.42 0 0 1-1.445-.83c-.27-.608-.352-1.395-.329-2.21.024-.826.16-1.73.365-2.606.206-.875.486-1.733.805-2.466.315-.722.687-1.364 1.094-1.772a2.3 2.3 0 0 1 .433-.335l-.028-.079zm2.036.412c-.877.185-1.469.443-1.733.708-.276.276-.587.783-.885 1.465a14 14 0 0 0-.748 2.295 12.4 12.4 0 0 0-.339 2.406c-.022.755.062 1.368.243 1.776a.42.42 0 0 0 .426.24c.327-.034.61-.199.929-.502.212-.202.4-.423.615-.674.133-.156.276-.323.44-.504C4.861 9.969 5.978 9.027 8 9.027s3.139.942 3.965 1.855c.164.181.307.348.44.504.214.251.403.472.615.674.318.303.601.468.929.503a.42.42 0 0 0 .426-.241c.18-.408.265-1.02.243-1.776a12.4 12.4 0 0 0-.339-2.406 14 14 0 0 0-.748-2.295c-.298-.682-.61-1.19-.885-1.465-.264-.265-.856-.523-1.733-.708-.85-.179-1.877-.27-2.913-.27s-2.063.091-2.913.27"/>'),
    notebook: bi('<path d="M13.5 3a.5.5 0 0 1 .5.5V11H2V3.5a.5.5 0 0 1 .5-.5zm-11-1A1.5 1.5 0 0 0 1 3.5V12h14V3.5A1.5 1.5 0 0 0 13.5 2zM0 12.5h16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5"/>'),
    estrela: bi('<path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>'),
    /* celular parado (vibração desligada) */
    celular: bi('<path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/><path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>'),
    /* celular vibrando (vibração ligada) */
    vibracao: bi('<path d="M10 3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M8 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2M1.599 4.058a.5.5 0 0 1 .208.676A7 7 0 0 0 1 8c0 1.18.292 2.292.807 3.266a.5.5 0 0 1-.884.468A8 8 0 0 1 0 8c0-1.347.334-2.619.923-3.734a.5.5 0 0 1 .676-.208m12.802 0a.5.5 0 0 1 .676.208A8 8 0 0 1 16 8a8 8 0 0 1-.923 3.734.5.5 0 0 1-.884-.468A7 7 0 0 0 15 8c0-1.18-.292-2.292-.807-3.266a.5.5 0 0 1 .208-.676M3.057 5.534a.5.5 0 0 1 .284.648A5 5 0 0 0 3 8c0 .642.12 1.255.34 1.818a.5.5 0 1 1-.93.364A6 6 0 0 1 2 8c0-.769.145-1.505.41-2.182a.5.5 0 0 1 .647-.284m9.886 0a.5.5 0 0 1 .648.284C13.855 6.495 14 7.231 14 8s-.145 1.505-.41 2.182a.5.5 0 0 1-.93-.364C12.88 9.255 13 8.642 13 8s-.12-1.255-.34-1.818a.5.5 0 0 1 .283-.648"/>'),
    tremor: bi('<path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z"/>'),
    grafico: bi('<path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"/>'),
    compartilhar: bi('<path d="M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5"/>'),
    
    tartaruga: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M28.765225 12.4792s1.039675 -0.58315 1.3009 -0.730925c0.26125 -0.147775 1.213825 -0.744125 1.5595 -0.22165 0.2032 0.306075 -0.1847 1.1716 -0.8048 2.07405 -0.5647 0.825925 -1.8788 2.52265 -1.9527 2.857775 -0.073875 0.335125 0.292925 1.67825 0.40375 2.198075 0.110825 0.51985 0.459125 1.7706 0.308725 2.2535s-0.9051 1.80755 -2.83665 1.7838c-1.535775 -0.018475 -1.981725 -0.4697 -2.03185 -0.744125 -0.03695 -0.1979 -0.147775 -0.85495 -0.147775 -0.85495s-1.263975 0.78105 -1.857675 1.0766 -2.192825 1.11355 -2.192825 1.11355 0.30875 1.41175 0.358875 1.9817c0.05015 0.569975 0.22695 1.38535 -0.073875 1.931575 -0.2718 0.4961 -1.121475 1.32465 -3.12165 1.311475 -1.56215 -0.01055 -1.955325 -0.4961 -2.20335 -0.791625 -0.24805 -0.2982 -0.2982 -1.709925 -0.2982 -2.005475s-0.050125 -1.33785 -0.050125 -1.33785 -2.116275 -0.10555 -3.39345 -0.1979c-1.155775 -0.084425 -2.680975 -0.261225 -2.680975 -0.261225s0.055425 0.614825 0.110825 1.058125c0.05015 0.395825 0.0607 1.2244 -0.353575 1.628125 -0.556775 0.543575 -1.9949 0.58315 -2.786525 0.506625 -0.791625 -0.073875 -1.894625 -0.482875 -2.216575 -1.200625 -0.321925 -0.71775 0.100275 -1.659775 0.2718 -2.20335 0.15305 -0.477625 0.4222 -1.1637 0.321925 -1.3616 -0.100275 -0.197925 -1.06605 -0.44595 -2.4514 -1.83395 -1.387975 -1.387975 -3.2008 -6.20635 0.865525 -9.5602 4.087425 -3.36705 11.560375 0.29025 11.9562 0.5383 0.40635 0.253325 13.99595 0.992175 13.99595 0.992175Z" fill="#BDCF47"/><path d="M16.5082 3.5259c-3.675775 0.1636 -6.433275 1.98435 -7.8028 3.973975 -0.818 1.187425 -1.227025 2.0424 -1.227025 2.0424s1.26925 0.036925 2.414475 0.649125c1.319375 0.70455 2.84985 1.46715 3.855225 4.784075 0.757325 2.5068 1.050225 4.8896 3.018725 5.414725 2.22975 0.5937 7.43075 0.298175 9.919075 -2.1163s2.97125 -4.2352 2.340575 -6.6127 -3.475225 -6.6101 -7.430725 -7.726275c-1.707275 -0.4829 -3.417175 -0.4829 -5.087525 -0.409025Z" fill="#6E823A"/><path d="M28.56205 10.397225c-0.11085 -0.261225 -0.34305 -0.6597 -0.34305 -0.6597s-0.018475 0.54095 -0.065975 0.82595c-0.073875 0.4644 -0.32985 1.4302 -0.4776 1.2877 -0.263875 -0.25595 -1.512025 -1.826025 -2.105725 -2.69945 -0.45125 -0.66495 -2.005475 -2.4039 -2.0424 -2.971225 -0.018475 -0.279725 0.335125 -1.227025 0.335125 -1.227025s-0.32195 -0.184725 -0.620125 -0.3536c-0.2322 -0.1293 -0.569975 -0.271775 -0.569975 -0.271775s-0.203175 1.292975 -0.427475 1.53575c-0.1979 0.213725 -1.4038 0.686075 -2.340575 1.039675 -1.132025 0.427475 -2.22975 0.98425 -2.63875 1.058125 -0.358875 0.065975 -2.398625 -0.37205 -3.1665 -0.519825 -0.9658 -0.184725 -2.422375 -0.596375 -2.7575 -0.8365 -0.39055 -0.2797 -0.8101 -0.99745 -0.8101 -0.99745s-0.23485 0.160975 -0.4697 0.345675c-0.2322 0.182075 -0.533025 0.5436 -0.533025 0.5436s0.60955 0.612175 0.64385 0.839125c0.0475 0.31665 -0.335125 0.74675 -0.649125 1.155775 -0.19 0.2454 -0.72565 1.2798 -0.72565 1.2798s0.25595 0.02375 0.567325 0.166225c0.324575 0.150425 0.628025 0.3061 0.628025 0.3061s0.7837 -1.820725 1.292975 -1.986975c0.4354 -0.1425 1.662425 0.261225 2.554325 0.44595 1.263975 0.261225 2.54375 0.49345 2.812925 0.836475 0.2797 0.3536 0.543575 1.7627 0.799525 2.952775 0.279725 1.30355 1.005375 4.686425 0.8365 4.945025 -0.16625 0.26125 -1.5041 0.16625 -2.2667 0.073875 -0.6465 -0.07915 -1.69145 -0.4644 -1.69145 -0.4644s0.15305 0.556775 0.2032 0.70455c0.073875 0.213725 0.3061 0.80745 0.3061 0.80745s1.496175 0.6597 5.916075 0.250675 6.6048 -3.419825 7.224925 -4.755025c0.82855 -1.789075 0.9341 -2.741675 0.9341 -2.741675s-0.24275 -0.6544 -0.353575 -0.91565ZM24.530025 16.17345c-1.118825 0.70455 -4.0109 1.4487 -4.533375 1.168975 -0.416925 -0.2243 -1.039675 -3.678425 -1.33785 -5.21945 -0.19 -0.9869 -0.6465 -2.4857 -0.372075 -2.952775 0.1847 -0.31665 1.263975 -0.788975 2.060875 -1.16105 0.757325 -0.35095 1.8392 -0.825925 2.15585 -0.788975 0.4486 0.052775 1.41175 1.6149 2.377525 2.95275 0.965775 1.33785 2.023925 2.731125 2.0424 3.214 0.02375 0.48555 -1.240225 2.063525 -2.39335 2.786525Z" fill="#484E23"/><path d="M9.89285 14.233975c0.131925 0.746775 -0.250675 1.517275 -1.073975 1.588525 -0.675525 0.05805 -1.2112 -0.414275 -1.343125 -1.16105s0.300825 -1.448675 0.97105 -1.567425c0.664975 -0.118725 1.3141 0.39055 1.44605 1.13995Z" fill="#2A2B28"/><path d="M5.0481 14.29995c0.018475 0.7494 -0.6386 1.50145 -1.451325 1.3484 -0.6676 -0.12665 -1.05285 -0.720375 -0.978975 -1.4645 0.076525 -0.74415 0.683425 -1.293 1.35895 -1.227025s1.052875 0.56205 1.07135 1.343125Z" fill="#2A2B28"/><path d="M7.1459 17.06535c0.3061 -0.20845 0.818025 -0.704525 1.1505 -0.2797 0.335125 0.427475 -0.242775 0.818025 -0.57525 1.05815 -0.335125 0.24275 -1.0766 0.836475 -1.614925 0.836475 -0.50135 0 -1.26395 -0.612175 -1.74685 -1.0212 -0.393175 -0.332475 -0.57525 -0.7626 -0.3536 -1.0212s0.5647 -0.1636 0.854975 0.092375c0.335125 0.298175 0.9816 0.8919 1.245475 0.8919 0.2586 0.002625 0.630675 -0.277075 1.039675 -0.556775Z" fill="#2A2B28"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.604-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 8 10-8"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>'
  };

  /* devolve o SVG pronto para inserir no HTML, no tamanho pedido (px) */
  var icone = function (nome, px) {
    var s = ICONES[nome];
    if (!s) return '';
    px = px || 16;
    return s.replace('<svg ', '<svg width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false" ');
  };

  /* Dois ícones empilhados que se alternam com transição (som ligado/mudo, sol/lua).
     Uso: ON.iconeTroca('sol', 'lua', escuro, 20). Para trocar depois: ON.trocar(no, ativo). */
  var iconeTroca = function (a, b, ativoB, px) {
    return '<span class="troca" data-b="' + (ativoB ? '1' : '0') + '">' + icone(a, px) + icone(b, px) + '</span>';
  };
  var trocar = function (raiz, ativoB) {
    var t = raiz && (raiz.classList && (raiz.classList.contains('troca') || raiz.classList.contains('som-ico') || raiz.classList.contains('vib-ico')) ? raiz : raiz.querySelector('.troca, .som-ico, .vib-ico'));
    if (!t) return;
    t.setAttribute('data-b', ativoB ? '1' : '0');
    if (t.classList.contains('vib-ico')) balancar(t);
  };

  /* Celular: parado (desligado) ou vibrando (ligado). Ao trocar, balança da esquerda
     para a direita, como se vibrasse de verdade. Com "Reduzir animações" não balança. */
  var iconeVibracao = function (ligado, px) {
    return '<span class="vib-ico" data-b="' + (ligado ? '1' : '0') + '">' + icone('celular', px) + icone('vibracao', px) + '</span>';
  };
  function balancar(no) {
    no.classList.remove('vibrando');
    void no.offsetWidth; // reinicia a animação se ainda estava balançando
    no.classList.add('vibrando');
    clearTimeout(no._balanco);
    no._balanco = setTimeout(function () { no.classList.remove('vibrando'); }, 700);
  }

  /* Tremor da tela: X no canto inferior direito quando desligado.
     Ao ligar, o X se desfaz e o raio pisca enquanto oscila na diagonal
     nos dois sentidos (↗ ↙), com amplitudes iguais e retorno à origem.
     Sem brilho e independente de ON.tremer(). */
  function iconeTremor(ligado, px) {
    px = px || 20;
    return '<span class="tremor-ico" data-b="' + (ligado ? '1' : '0') + '">' +
      '<span class="tremor-raio">' + icone('tremor', px) + '</span>' +
      '<svg class="tremor-x" xmlns="http://www.w3.org/2000/svg" ' +
      'width="11" height="11" viewBox="0 0 12 12" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'aria-hidden="true" focusable="false">' +
      '<path d="M2 2 10 10"/><path d="M10 2 2 10"/>' +
      '</svg></span>';
  }

  function atualizarTremorIcone(marca, ligado) {
    var no = marca && marca.querySelector('.tremor-ico');
    if (!no) return;
    no.classList.remove('ativando');
    no.setAttribute('data-b', ligado ? '1' : '0');
    if (ligado && !ON.cfg.reduzir) {
      void no.offsetWidth; // permite reiniciar após alternâncias rápidas
      no.classList.add('ativando');
    }
  }

  /* Alto-falante animado: o corpo fica parado e só as "vibrações" (as 3 ondas e o X de mudo)
     trocam, uma de cada vez, com degradê. data-b="1" = som ligado. */
  var CORPO_SOM = 'M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06';
  var ONDAS_SOM = [
    'M8.707 11.182A4.5 4.5 0 0 0 10.025 8a4.5 4.5 0 0 0-1.318-3.182L8 5.525A3.5 3.5 0 0 1 9.025 8 3.5 3.5 0 0 1 8 10.475z',
    'M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z',
    'M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z'
  ];
  var X_SOM = 'M13.854 5.646a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0';
  var iconeSom = function (ligado, px) {
    px = px || 16;
    return '<span class="som-ico" data-b="' + (ligado ? '1' : '0') + '">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="' + CORPO_SOM + '"/>' +
      ONDAS_SOM.map(function (d, i) { return '<path class="onda o' + (i + 1) + '" d="' + d + '"/>'; }).join('') +
      '<path class="x-mudo" d="' + X_SOM + '"/></svg></span>';
  };

  var REDES = [
    ['notebook', 'Portfólio', 'https://chris-speccy.netlify.app/', true],
    ['github', 'GitHub', 'https://github.com/Christian5910', true],
    ['linkedin', 'LinkedIn', 'https://www.linkedin.com/in/christian-oliveira-rodrigues-speccy', true],
    ['email', 'Email', 'mailto:christianoliveira5910@gmail.com', false],
    ['instagram', 'Instagram', 'https://www.instagram.com/chris_speccy/', true]
  ];

  /* ---------- armazenamento (sempre protegido: pode estar bloqueado) ---------- */
  var store = {
    get: function (chave, padrao) {
      try {
        var v = localStorage.getItem(chave);
        return v == null ? padrao : JSON.parse(v);
      } catch (e) { return padrao; }
    },
    set: function (chave, valor) {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem espaço/bloqueado */ }
    },
    del: function (chave) {
      try { localStorage.removeItem(chave); } catch (e) { /* ignora */ }
    }
  };

  var ON = {
    version: VERSAO, store: store, cfg: {}, config: null,
    icone: icone, iconeTroca: iconeTroca, iconeSom: iconeSom, iconeVibracao: iconeVibracao, trocar: trocar,
    redes: REDES, hub: HUB
  };
  window.ON = ON;

  var html = document.documentElement;
  var overlay, drawer, camadaAtual = null, focoAnterior = null, instalar = null;
  var aoFechar = null;
  var iniciado = false;
  var ouvintes = [];       // todos os ouvintes registrados, para ON.destruir() limpar
  var confirmacao = null;  // resolve da confirmação aberta (só uma por vez)

  /* registra um ouvinte e guarda para poder remover depois */
  function ouvir(alvo, tipo, fn, opcoes) {
    alvo.addEventListener(tipo, fn, opcoes);
    ouvintes.push([alvo, tipo, fn, opcoes]);
  }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k]; // só com SVG/ícones feitos aqui dentro
      else n.setAttribute(k, attrs[k]);
    }
    (filhos || []).forEach(function (f) { n.appendChild(f); });
    return n;
  }

  /* ---------- configurações ---------- */
  var mqEscuro = null;
  try { mqEscuro = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null; } catch (e) { /* ignora */ }
  function sistemaEscuro() { return !!(mqEscuro && mqEscuro.matches); }

  function bool(v, padrao) { return v === undefined || v === null ? padrao : !!v; }

  /* Lê <id>.cfg com segurança: aceita vazio, lixo ou formato antigo, usa os padrões e
     preserva chaves que o jogo tenha guardado ali. Tema: 'claro'/'escuro' só se a pessoa
     escolheu; sem escolha (tema = null) o jogo segue o aparelho. Formato antigo: escuro:true
     vira escolha "escuro"; escuro:false não dizia nada (era só o valor inicial), então segue o aparelho. */
  function lerConfig(id) {
    var c = store.get(id + '.cfg', null);
    if (!c || typeof c !== 'object' || Array.isArray(c)) c = {};
    var r = c.reduzir;
    if (r === undefined || r === null) {
      r = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    var tema = c.tema === 'escuro' || c.tema === 'claro' ? c.tema : (c.escuro === true ? 'escuro' : null);
    var cfg = {};
    for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) cfg[k] = c[k];
    cfg.v = ESQUEMA;
    cfg.som = bool(c.som, CFG_PADRAO.som);
    cfg.vibracao = bool(c.vibracao, CFG_PADRAO.vibracao);
    cfg.tremor = bool(c.tremor, CFG_PADRAO.tremor);
    cfg.reduzir = !!r;
    cfg.tema = tema;
    cfg.escuro = tema ? tema === 'escuro' : sistemaEscuro();
    return cfg;
  }

  function aplicarConfig() {
    var c = ON.cfg;
    if (c.escuro) html.setAttribute('data-tema', 'escuro'); else html.removeAttribute('data-tema');
    if (c.reduzir) html.setAttribute('data-reduzir', '1'); else html.removeAttribute('data-reduzir');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.escuro ? '#071a33' : '#007ACC');
  }

  function salvarConfig() {
    var o = {};
    for (var k in ON.cfg) if (Object.prototype.hasOwnProperty.call(ON.cfg, k)) o[k] = ON.cfg[k];
    o.escuro = o.tema === 'escuro'; // só guarda "escuro" quando foi escolha; o resto segue o aparelho
    store.set(ON.config.id + '.cfg', o);
    aplicarConfig();
    if (typeof ON.config.aoMudarConfig === 'function') ON.config.aoMudarConfig(ON.cfg);
  }

  /* o aparelho trocou claro/escuro: acompanha, se a pessoa não escolheu um tema */
  function aoMudarSistema() {
    if (!ON.config || ON.cfg.tema) return;
    ON.cfg.escuro = sistemaEscuro();
    aplicarConfig();
    sincronizarTema();
    if (typeof ON.config.aoMudarConfig === 'function') ON.config.aoMudarConfig(ON.cfg);
  }

  function sincronizarTema() {
    var inp = document.querySelector('input[data-cfg="escuro"]');
    if (inp) inp.checked = !!ON.cfg.escuro;
    trocar(document.querySelector('.ic[data-ic="escuro"]'), !!ON.cfg.escuro);
  }

  /* ---------- camadas: menu e modais (uma por vez) ---------- */
  function focaveis(raiz) {
    return Array.prototype.filter.call(
      raiz.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null || n === document.activeElement; }
    );
  }

  /* Botão Voltar (Android, gesto, navegador): enquanto há menu ou modal aberto, ele existe como
     uma entrada extra no histórico. Voltar fecha a camada e a página continua onde estava.
       temEntrada      = a entrada extra existe agora
       voltasPendentes = voltas que o próprio código pediu (history.back) e ainda não chegaram
       querEntrada     = abriu uma camada enquanto ainda havia volta pendente: a entrada é criada
                         assim que a volta terminar (evita a corrida entre back() e pushState()) */
  var temEntrada = false, voltasPendentes = 0, querEntrada = false;

  function garantirEntrada() {
    if (temEntrada || querEntrada) return;
    if (voltasPendentes > 0) { querEntrada = true; return; }
    try { history.pushState({ on: 1 }, ''); temEntrada = true; } catch (e) { /* sem histórico: só não fecha pelo Voltar */ }
  }

  function soltarEntrada() {
    if (querEntrada) { querEntrada = false; return; }
    if (!temEntrada) return;
    temEntrada = false;
    voltasPendentes++;
    try { history.back(); } catch (e) { voltasPendentes--; }
  }

  function aoVoltar(e) {
    if (voltasPendentes > 0) {          // volta que o código pediu: só contabiliza
      voltasPendentes--;
      if (voltasPendentes === 0 && querEntrada) {
        querEntrada = false;
        if (camadaAtual) garantirEntrada();
      }
      return;
    }
    if (temEntrada) {                   // o usuário apertou Voltar com algo aberto: fecha e fica na página
      temEntrada = false;
      fecharCamada();
      return;
    }
    if (!camadaAtual && e.state && e.state.on) { // "Avançar" caiu numa entrada vazia: pula
      voltasPendentes++;
      try { history.back(); } catch (x) { voltasPendentes--; }
    }
  }

  function abrirCamada(node, tipo) {
    if (!overlay || !node) return;
    if (camadaAtual && camadaAtual.node === node) return;
    var trocando = !!camadaAtual;
    if (trocando) fecharCamada(true, true); // troca de camada: a entrada do histórico continua a mesma
    if (!trocando) focoAnterior = document.activeElement; // ao fechar, o foco volta para quem abriu
    camadaAtual = { node: node, tipo: tipo };
    if (tipo === 'drawer') {
      node.classList.add('open');
      node.setAttribute('aria-hidden', 'false');
      preencherEstatisticas();
    } else {
      node.setAttribute('aria-hidden', 'false');
    }
    overlay.hidden = false;
    html.classList.add('trava');
    garantirEntrada();
    var alvo = node.querySelector('[data-foco]') || focaveis(node)[0];
    if (alvo) setTimeout(function () { if (camadaAtual && camadaAtual.node === node) alvo.focus({ preventScroll: true }); }, 30);
  }

  /* manterHistorico: a camada está sendo trocada por outra, então a entrada extra não sai */
  function fecharCamada(semFoco, manterHistorico) {
    if (!camadaAtual) return;
    var c = camadaAtual;
    camadaAtual = null;
    if (c.tipo === 'drawer') c.node.classList.remove('open');
    c.node.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    html.classList.remove('trava');
    if (!semFoco && focoAnterior && focoAnterior.focus) focoAnterior.focus({ preventScroll: true });
    if (!manterHistorico) soltarEntrada();
    var cb = aoFechar;
    aoFechar = null;
    if (cb) { try { cb(); } catch (e) { /* um erro do jogo não trava o menu */ } }
  }

  ON.modal = {
    abrir: function (id) {
      var m = document.getElementById(id);
      if (m) abrirCamada(m, 'modal');
    },
    fechar: function () { fecharCamada(); },
    aberto: function () { return !!camadaAtual; }
  };

  /* Confirmação padronizada. Resolve true/false. Só existe uma por vez: se pedirem outra enquanto
     uma está aberta, a anterior termina com false (nenhuma promessa fica pendurada). */
  ON.confirmar = function (opcoes) {
    var o = opcoes || {};
    if (!document.getElementById('confirm-modal')) montarModalConfirmacao();
    var m = document.getElementById('confirm-modal');
    if (!m || !overlay) return Promise.resolve(false);
    if (confirmacao) { var anterior = confirmacao; confirmacao = null; anterior(false); }
    m.querySelector('#confirm-title').textContent = o.titulo || 'Tem certeza?';
    m.querySelector('#confirm-text').textContent = o.texto || '';
    m.querySelector('#confirm-yes').textContent = o.sim || 'Sim';
    m.querySelector('#confirm-no').textContent = o.nao || 'Cancelar';
    return new Promise(function (resolve) {
      var feito = false;
      var aoFecharEsta = function () { fim(false); };
      function fim(v) {
        if (feito) return;
        feito = true;
        if (confirmacao === fim) confirmacao = null;
        if (aoFechar === aoFecharEsta) aoFechar = null;
        resolve(v);
      }
      confirmacao = fim;
      abrirCamada(m, 'modal');
      aoFechar = aoFecharEsta;
    });
  };

  /* Botão "Novo jogo" padronizado: só pergunta se há partida em andamento. */
  ON.novoJogo = function (emAndamento, fazer, textos) {
    if (!emAndamento) { fazer(); return Promise.resolve(true); }
    var t = textos || {};
    return ON.confirmar({
      titulo: t.titulo || 'Novo jogo?',
      texto: t.texto || 'A partida em andamento será perdida.',
      sim: t.sim || 'Sim, começar',
      nao: t.nao || 'Continuar jogando'
    }).then(function (ok) { if (ok) fazer(); return ok; });
  };

  /* ---------- vibração e sons (sintetizados, sem arquivos) ---------- */
  /* ON.vibrar('vitoria' | 'derrota' | 'explosao' | 'toque' | 'erro' | 'leve') ou um número/lista em ms */
  ON.vibrar = function (padrao) {
    if (!ON.cfg.vibracao || !navigator.vibrate) return;
    if (typeof padrao === 'string') padrao = PADROES[padrao];
    if (!padrao) return;
    try { navigator.vibrate(padrao); } catch (e) { /* ignora */ }
  };

  /* Tremor visual de um elemento (opção "Tremor da tela"; respeita "Reduzir animações") */
  ON.tremer = function (no) {
    if (!no || !ON.cfg.tremor || ON.cfg.reduzir) return;
    no.classList.remove('on-tremor');
    void no.offsetWidth; // reinicia a animação se já estava tremendo
    no.classList.add('on-tremor');
    clearTimeout(no._tremor);
    no._tremor = setTimeout(function () { no.classList.remove('on-tremor'); }, 700);
  };

  /* Impacto = vibração do aparelho + tremor da tela, cada um com a sua opção */
  ON.impacto = function (no, padrao) {
    ON.vibrar(padrao);
    ON.tremer(no);
  };

  var audioCtx = null;
  ON.audio = function () {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  function tom(freq, dur, tipo, vol, atraso) {
    var ctx = ON.audio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (atraso || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = tipo || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  var SONS = {
    toque: function () { tom(620, 0.05, 'triangle', 0.08); },
    erro: function () { tom(190, 0.16, 'square', 0.07); },
    acerto: function () { tom(660, 0.08, 'triangle', 0.1); },
    junta: function () { tom(440, 0.07, 'triangle', 0.09); tom(660, 0.09, 'triangle', 0.09, 0.05); },
    vitoria: function () { [523, 659, 784, 1047].forEach(function (f, i) { tom(f, 0.2, 'triangle', 0.12, i * 0.1); }); },
    derrota: function () { [392, 330, 262, 196].forEach(function (f, i) { tom(f, 0.25, 'sawtooth', 0.06, i * 0.13); }); },
    mover: function () { tom(300, 0.06, 'triangle', 0.12); tom(190, 0.07, 'sine', 0.1, 0.01); },
    captura: function () { tom(220, 0.09, 'square', 0.07); tom(140, 0.12, 'triangle', 0.12, 0.02); },
    xeque: function () { tom(880, 0.09, 'triangle', 0.1); tom(1175, 0.14, 'triangle', 0.1, 0.09); },
    roque: function () { tom(300, 0.06, 'triangle', 0.12); tom(300, 0.07, 'triangle', 0.12, 0.09); tom(190, 0.08, 'sine', 0.1, 0.09); },
    promocao: function () { [523, 659, 784].forEach(function (f, i) { tom(f, 0.1, 'triangle', 0.1, i * 0.07); }); }
  };

  ON.som = function (nome) {
    if (!ON.cfg.som || !SONS[nome]) return;
    try { SONS[nome](); } catch (e) { /* ignora */ }
  };

  /* ---------- estatísticas ---------- */
  /* O HTML personalizado (l.html) passa por uma lista de permissões: só tags de texto/bloco simples,
     só os atributos class e style (com valores seguros) e nada de script, link ou evento. */
  var TAGS_OK = { DIV: 1, SPAN: 1, I: 1, B: 1, STRONG: 1, EM: 1, SMALL: 1, BR: 1 };
  var STYLE_OK = /^\s*(width|height|min-width|opacity)\s*:\s*[\d.]+(%|px|em|rem)?\s*;?\s*$/i;

  function limparNo(origem, destino) {
    Array.prototype.forEach.call(origem.childNodes, function (n) {
      if (n.nodeType === 3) { destino.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1 || !TAGS_OK[n.tagName]) return;
      var c = document.createElement(n.tagName.toLowerCase());
      var cls = n.getAttribute('class');
      if (cls && /^[\w\- ]+$/.test(cls)) c.setAttribute('class', cls);
      var st = n.getAttribute('style');
      if (st && STYLE_OK.test(st)) c.setAttribute('style', st);
      limparNo(n, c);
      destino.appendChild(c);
    });
  }

  function htmlSeguro(texto, destino) {
    var doc = new DOMParser().parseFromString('<body>' + String(texto) + '</body>', 'text/html');
    limparNo(doc.body, destino);
  }

  function preencherEstatisticas() {
    var box = document.getElementById('stats');
    var cfg = ON.config;
    if (!box || !cfg || typeof cfg.estatisticas !== 'function') return;
    var linhas;
    try { linhas = cfg.estatisticas() || []; } catch (e) { linhas = []; }
    box.textContent = '';
    linhas.forEach(function (l) {
      if (!l) return;
      if (l.html != null) {
        var d = el('div', { class: 'barras' });
        htmlSeguro(l.html, d);
        box.appendChild(d);
        return;
      }
      var s = el('div', { class: 'stat' + (l.larga ? ' larga' : '') });
      if (l.larga) {
        s.appendChild(el('span', { text: String(l.rotulo) }));
        s.appendChild(el('b', { text: String(l.valor) }));
      } else {
        s.appendChild(el('b', { text: String(l.valor) }));
        s.appendChild(el('span', { text: String(l.rotulo) }));
      }
      box.appendChild(s);
    });
  }

  /* ---------- montagem do menu ---------- */
  /* ícone de cada opção; som, vibração e modo escuro mudam conforme o estado */
  function iconeOpcao(k) {
    if (k === 'som') return iconeSom(ON.cfg.som, 20);
    if (k === 'escuro') return iconeTroca('sol', 'lua', ON.cfg.escuro, 20);
    if (k === 'vibracao') return iconeVibracao(ON.cfg.vibracao, 20);
    if (k === 'tremor') return iconeTremor(ON.cfg.tremor, 20);
    return icone({ reduzir: 'tartaruga' }[k], 20);
  }

  function tituloSecao(id, nomeIcone, texto) {
    return el('h3', { id: id }, [
      el('span', { class: 'ic', html: icone(nomeIcone, 14) }),
      el('span', { text: texto })
    ]);
  }

  function montarMenu() {
    var cfg = ON.config;
    drawer = document.getElementById('drawer');
    if (!drawer) {
      drawer = el('aside', { id: 'drawer', 'aria-hidden': 'true', 'aria-label': 'Menu lateral' });
      document.body.appendChild(drawer);
    }
    drawer.textContent = '';

    /* Cabeçalho FORA da área que rola: fica sempre no topo e, como é o mesmo fundo do menu,
       tem exatamente a mesma cor. O X tem ouvinte próprio (não depende do ouvinte geral). */
    var x = el('button', { id: 'close-drawer', type: 'button', 'aria-label': 'Fechar menu', 'data-foco': '', text: '✕' });
    ouvir(x, 'click', function (e) { e.preventDefault(); fecharCamada(); });
    drawer.appendChild(el('div', { class: 'drawer-header' }, [
      el('span', { class: 'ic', html: icone('estrela', 20) }),
      el('h2', { text: 'Menu' }),
      x
    ]));
    var corpo = el('div', { class: 'drawer-rolagem' });
    drawer.appendChild(corpo);

    // 1. outros jogos: um único atalho para a hub (a lista de jogos mora lá)
    corpo.appendChild(el('section', { class: 'd-sec', 'aria-label': 'Outros jogos' }, [
      el('a', { class: 'linha', href: HUB, target: '_blank', rel: 'noopener' }, [
        el('span', { class: 'ic', html: icone('casa', 20) }),
        el('span', { text: 'Outros Jogos' })
      ])
    ]));

    // 2. estatísticas
    if (typeof cfg.estatisticas === 'function') {
      var sec = el('section', { class: 'd-sec', 'aria-labelledby': 'h-stats' }, [
        tituloSecao('h-stats', 'grafico', 'Estatísticas'),
        el('div', { class: 'stats', id: 'stats' })
      ]);
      if (typeof cfg.zerarEstatisticas === 'function') {
        var z = el('button', { class: 'd-link', type: 'button', id: 'zerar-stats', text: 'Zerar estatísticas' });
        sec.appendChild(z);
      }
      corpo.appendChild(sec);
    }

    // 3. configurações
    var opcoes = (cfg.configuracoes || ['som', 'vibracao', 'escuro', 'reduzir']);
    var secCfg = el('section', { class: 'd-sec', 'aria-labelledby': 'h-cfg' }, [tituloSecao('h-cfg', 'engrenagem', 'Configurações')]);
    opcoes.forEach(function (k) {
      if (!ROTULOS[k]) return;
      var inp = el('input', { type: 'checkbox', role: 'switch', 'data-cfg': k });
      inp.checked = !!ON.cfg[k];
      secCfg.appendChild(el('label', { class: 'opcao' }, [
        el('span', { class: 'opc-txt' }, [
          el('span', { class: 'ic', 'data-ic': k, html: iconeOpcao(k) }),
          el('span', { text: ROTULOS[k] })
        ]),
        inp, el('i', { class: 'sw', 'aria-hidden': 'true' })
      ]));
    });
    corpo.appendChild(secCfg);

    // 4. instalar app (só aparece quando o navegador permite)
    var btnInstalar = el('button', { id: 'install-btn', class: 'btn btn-primary', type: 'button', hidden: '' }, [
      el('span', { class: 'ic', html: icone('baixar', 18) }),
      el('span', { text: 'Instalar app' })
    ]);
    corpo.appendChild(btnInstalar);
    if (instalar) btnInstalar.hidden = false; // o navegador avisou antes do menu existir

    // 5. redes em acordeão (só as redes recolhem)
    var lis = REDES.map(function (r) {
      var a = el('a', { href: r[2] }, [el('span', { class: 'ic', html: icone(r[0], 20) }), el('span', { text: r[1] })]);
      if (r[3]) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      return el('li', null, [a]);
    });
    var painel = el('div', { class: 'acc-panel', id: 'acc-redes', role: 'region', 'aria-labelledby': 'acc-btn' }, [
      el('div', null, [el('ul', { class: 'redes' }, lis)])
    ]);
    corpo.appendChild(el('div', { class: 'acc' }, [
      el('button', { class: 'acc-btn', id: 'acc-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'acc-redes' }, [
        el('span', { class: 'opc-txt' }, [el('span', { class: 'ic', html: icone('compartilhar', 18) }), el('span', { text: 'Minhas redes' })]),
        el('span', { class: 'ic', html: icone('chevron', 18) })
      ]),
      painel
    ]));

    // 6. parte fixa no fim: traço, pix, traço, assinatura
    var rodape = el('div', { class: 'drawer-footer' });
    if (cfg.pix !== false) {
      var frame = el('div', { class: 'pix-frame', 'aria-hidden': 'true' });
      frame.appendChild(el('pre', { text: '╔═══════════════•⊱✦⊰•═══════════════╗\nMe manda um pix?     ฅ^>⩊<^ ฅ\n╚═══════════════•⊱✦⊰•═══════════════╝' }));
      rodape.appendChild(frame);
      rodape.appendChild(el('img', { id: 'qrpix', src: cfg.qrpix || 'assets/qrpix.png', alt: 'QR Pix - Apoie o criador', loading: 'lazy', decoding: 'async', width: '200', height: '200' }));
      ajustarPix(frame.firstChild);
    }
    rodape.appendChild(el('div', { class: 'assinatura', text: '✩₊˚.⋆ Somos o Universo! ⋆⁺₊✧' }));
    corpo.appendChild(rodape);
  }

  // Garante que o quadro do Pix caiba numa linha só, qualquer que seja a fonte do aparelho
  function ajustarPix(pre) {
    function caber() {
      pre.style.fontSize = '';
      var tam = parseFloat(getComputedStyle(pre).fontSize);
      var n = 0;
      while (pre.scrollWidth > pre.clientWidth + 0.5 && tam > 4 && n++ < 40) {
        tam -= 0.25;
        pre.style.fontSize = tam + 'px';
      }
    }
    caber();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(caber);
      ro.observe(pre.parentNode);
      ouvintes.push([{ removeEventListener: function () { ro.disconnect(); } }, '', null]);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(caber);
  }

  function montarModalConfirmacao() {
    if (document.getElementById('confirm-modal')) return;
    var m = el('div', { id: 'confirm-modal', class: 'modal', 'aria-hidden': 'true', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-text' }, [
      el('div', { class: 'modal-content' }, [
        el('div', { class: 'modal-head' }, [el('h2', { id: 'confirm-title' })]),
        el('div', { class: 'modal-body' }, [el('p', { id: 'confirm-text' })]),
        el('div', { class: 'modal-actions' }, [
          el('button', { id: 'confirm-yes', class: 'btn btn-primary', type: 'button' }),
          el('button', { id: 'confirm-no', class: 'btn btn-secondary', type: 'button', 'data-foco': '' })
        ])
      ])
    ]);
    document.body.appendChild(m);
  }

  /* ---------- eventos (delegação: um ouvinte para os cliques do documento) ---------- */
  function ligarEventos() {
    ouvir(document, 'click', function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;

      var abrir = t.closest('[data-abrir]');
      if (abrir) {
        var alvo = document.getElementById(abrir.getAttribute('data-abrir'));
        if (alvo) abrirCamada(alvo, alvo.id === 'drawer' ? 'drawer' : 'modal');
        return;
      }
      if (t.closest('[data-fechar]')) { fecharCamada(); return; }
      if (t === overlay) { fecharCamada(); return; }

      if (t.closest('#confirm-yes')) {
        var r = confirmacao;
        confirmacao = null;
        aoFechar = null;
        fecharCamada(true);
        if (r) r(true);
        return;
      }
      if (t.closest('#confirm-no')) { fecharCamada(); return; }

      // acordeão genérico: qualquer .acc-btn abre e fecha o painel indicado em aria-controls
      // (os jogos usam o mesmo componente nos próprios modais). Para um botão tratar o clique
      // por conta própria, basta marcar data-proprio.
      var acc = t.closest('.acc-btn');
      if (acc && !acc.hasAttribute('data-proprio')) {
        var aberto = acc.getAttribute('aria-expanded') === 'true';
        acc.setAttribute('aria-expanded', String(!aberto));
        var painelAcc = document.getElementById(acc.getAttribute('aria-controls'));
        if (painelAcc) painelAcc.classList.toggle('aberto', !aberto);
        return;
      }

      if (t.closest('#zerar-stats')) {
        // troca o menu pela confirmação (a entrada do Voltar passa de uma para a outra)
        ON.confirmar({ titulo: 'Zerar estatísticas?', texto: 'Seus recordes e contagens deste jogo serão apagados neste aparelho.', sim: 'Sim, zerar', nao: 'Cancelar' })
          .then(function (ok) { if (ok && ON.config && ON.config.zerarEstatisticas) ON.config.zerarEstatisticas(); });
        return;
      }

      if (t.closest('#install-btn') && instalar) {
        var ev = instalar;
        instalar = null;
        ev.prompt();
        ev.userChoice.then(function () { var b = document.getElementById('install-btn'); if (b) b.hidden = true; });
      }
    });

    ouvir(document, 'change', function (e) {
      var i = e.target;
      if (!(i instanceof HTMLInputElement) || !i.hasAttribute('data-cfg')) return;
      var chave = i.getAttribute('data-cfg');
      ON.cfg[chave] = i.checked;
      if (chave === 'escuro') ON.cfg.tema = i.checked ? 'escuro' : 'claro'; // virou escolha da pessoa
      salvarConfig();
      var marca = document.querySelector('.ic[data-ic="' + chave + '"]');
      if (chave === 'som' || chave === 'escuro' || chave === 'vibracao') trocar(marca, i.checked); // troca com transição
      if (chave === 'som' && i.checked) ON.som('acerto');
      if (chave === 'vibracao' && i.checked) ON.vibrar(30);
      if (chave === 'tremor') atualizarTremorIcone(marca, i.checked);
    });

    ouvir(document, 'keydown', function (e) {
      if (!camadaAtual) return;
      if (e.key === 'Escape') { e.preventDefault(); fecharCamada(); return; }
      if (e.key === 'Tab') {
        var f = focaveis(camadaAtual.node);
        if (!f.length) return;
        var a = document.activeElement, i = f.indexOf(a);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
      }
    });

    ouvir(window, 'popstate', aoVoltar);

    ouvir(window, 'beforeinstallprompt', function (e) {
      e.preventDefault();
      instalar = e;
      var b = document.getElementById('install-btn');
      if (b) b.hidden = false;
    });
    ouvir(window, 'appinstalled', function () {
      instalar = null;
      var b = document.getElementById('install-btn');
      if (b) b.hidden = true;
    });

    if (mqEscuro) {
      if (mqEscuro.addEventListener) ouvir(mqEscuro, 'change', aoMudarSistema);
      else if (mqEscuro.addListener) { // Safari antigo
        mqEscuro.addListener(aoMudarSistema);
        ouvintes.push([{ removeEventListener: function () { mqEscuro.removeListener(aoMudarSistema); } }, '', null]);
      }
    }
  }

  /* ---------- inicialização ---------- */
  ON.init = function (config) {
    if (iniciado) {
      if (window.console) console.warn('ON.init: já foi iniciado, a segunda chamada foi ignorada.');
      return;
    }
    if (!config || !config.id) {
      if (window.console) console.error('ON.init: falta o id do jogo.');
      return;
    }
    iniciado = true;
    ON.config = config;
    ON.cfg = lerConfig(config.id);
    aplicarConfig();

    function iniciar() {
      overlay = document.getElementById('overlay');
      if (!overlay) {
        overlay = el('div', { id: 'overlay', hidden: '' });
        document.body.appendChild(overlay);
      }
      // sobrou uma entrada do menu de uma visita anterior (recarregou com o menu aberto): limpa
      try { if (history.state && history.state.on) history.replaceState(null, ''); } catch (e) { /* ignora */ }
      montarMenu();
      montarModalConfirmacao();
      ligarEventos();
      if (typeof config.pronto === 'function') config.pronto();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./service-worker.js').catch(function () { /* sem offline, segue */ });
      }, { once: true });
    }
  };

  /* Desfaz o que o ON.init montou nos ouvintes (útil em testes ou se o jogo recomeçar do zero) */
  ON.destruir = function () {
    if (camadaAtual) fecharCamada(true);
    ouvintes.forEach(function (o) { try { o[0].removeEventListener(o[1], o[2], o[3]); } catch (e) { /* ignora */ } });
    ouvintes = [];
    temEntrada = false; querEntrada = false; voltasPendentes = 0;
    confirmacao = null;
    aoFechar = null;
    iniciado = false;
  };
})();
