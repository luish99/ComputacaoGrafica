import * as THREE from 'three';
import { criarPista1, criarPista2, criarPista3, obterTexturasAnimadas, atualizarEfeitosPista } from './Pista.js';
import { criarCarro, criarCarroAdversario } from './Carro.js';
import { criarCamera, atualizarCamera, definirCarro as definirCarroCamera, inicializarOrbitControls } from './CameraController.js';
import { aplicarFisica, inicializarControles, definirCarro, definirPista, definirColisores, definirLinhaChegada, definirCheckpoints, definirAdversarios, definirJogadoresRemotos, definirWaypoints, definirCena, atirarDoJogador, definirBuracoERampas, configurarAudioTiro } from './Fisica.js';

function principal() {
    // --- GERENCIADOR DE CARREGAMENTO (LOADING SCREEN) ---
    const loadingScreen = document.getElementById('loading-screen');
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    const menuPanel = document.getElementById('menu-panel');
    const lobbyPanel = document.getElementById('lobby-panel');
    const singlePlayerButton = document.getElementById('single-player-button');
    const multiplayerButton = document.getElementById('multiplayer-button');
    const readyButton = document.getElementById('ready-button');
    const lobbyStatus = document.getElementById('lobby-status');
    const lobbyPlayers = document.getElementById('lobby-players');
    const lobbyMessage = document.getElementById('lobby-message');

    let gameStarted = false;
    let gameMode = null;
    let multiplayerReady = false;
    let multiplayerStarted = false;
    let multiplayerConectado = false;
    let meuId = null;
    let meuSlotIndex = 0;
    const rede = new MultiplayerEngine();
    const jogadoresRemotos = {};
    const coresRemotas = [0x00ffff, 0xff66ff, 0xffff66, 0xff9966];

    function exibirMenuPrincipal() {
        menuPanel.classList.add('visible');
        lobbyPanel.style.display = 'none';
        lobbyMessage.innerText = '';
        lobbyStatus.innerText = 'Escolha um modo de jogo.';
    }

    function ocultarMenuPrincipal() {
        menuPanel.classList.remove('visible');
    }

    function exibirLobbyMultiplayer() {
        menuPanel.classList.remove('visible');
        lobbyPanel.style.display = 'block';
        lobbyMessage.innerText = 'Conectando ao servidor...';
        lobbyStatus.innerText = 'Aguardando conexão...';
        readyButton.disabled = true;
        readyButton.innerText = 'Ready';
    }

    function encerrarOverlayEIniciarJogo() {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.8s';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            gameStarted = true;
            shouldPlayMusic = true;
            playStartSound();
            updateMusic();
        }, 800);
    }

    function atualizarListaLobby(sala) {
        if (!sala || !Array.isArray(sala.jogadores)) {
            lobbyPlayers.innerHTML = '';
            return;
        }

        lobbyPlayers.innerHTML = '';
        sala.jogadores.forEach((jogador, index) => {
            const linha = document.createElement('div');
            linha.className = 'lobby-player';
            const nome = jogador.id === meuId ? 'Você' : `Jogador ${index + 1}`;
            const status = jogador.ready ? '<span class="lobby-ready">Ready</span>' : '<span class="lobby-not-ready">Aguardando</span>';
            linha.innerHTML = `<span>${nome} #${jogador.slotIndex + 1}</span>${status}`;
            lobbyPlayers.appendChild(linha);
        });

        const prontos = sala.jogadores.filter((jogador) => jogador.ready).length;
        lobbyStatus.innerText = sala.partidaIniciada
            ? 'A partida está começando...'
            : `Prontos: ${prontos}/${sala.jogadores.length}`;
    }

    function atualizarBotsVisiveis(ativos) {
        if (typeof adversarios === 'undefined') {
            return;
        }

        adversarios.forEach((bot) => {
            bot.visible = ativos;
        });

        atualizarFisicaAdversarios();
    }

    function atualizarFisicaAdversarios() {
        if (gameMode === 'multiplayer') {
            definirAdversarios([]); // Sem Inteligencia artificial
            const remotosAtivos = Object.values(jogadoresRemotos);
            definirJogadoresRemotos(remotosAtivos);
        } else {
            definirAdversarios(adversarios); // Em single player manda os bots
            definirJogadoresRemotos([]); 
        }
    }

    function obterSpawnMultiplayer(slotIndex) {
        const spawns = [
            { x: 158, y: 0.5, z: -40, angulo: Math.PI },
            { x: 142, y: 0.5, z: -20, angulo: Math.PI },
            { x: 158, y: 0.5, z: -20, angulo: Math.PI },
            { x: 142, y: 0.5, z: -40, angulo: Math.PI }
        ];

        return spawns[slotIndex % spawns.length];
    }

    function posicionarCarroMultiplayer(alvo, slotIndex) {
        if (!alvo) {
            return;
        }

        const spawn = obterSpawnMultiplayer(slotIndex);
        alvo.position.set(spawn.x, spawn.y, spawn.z);
        alvo.rotation.y = spawn.angulo;
        alvo.userData.angulo = spawn.angulo;
        alvo.userData.velocidade = 0;
        alvo.userData.anguloRodas = 0;
    }

    function criarJogadorRemoto(jogadorInfo) {
        if (!jogadorInfo || jogadorInfo.id === meuId) {
            return;
        }

        let carroRemoto = jogadoresRemotos[jogadorInfo.id];
        if (!carroRemoto) {
            const corPrincipal = jogadorInfo.color ?? coresRemotas[jogadorInfo.slotIndex % coresRemotas.length];
            carroRemoto = criarCarroAdversario(cena, corPrincipal, 0xffffff, jogadorInfo.slotIndex ?? 0);
            carroRemoto.userData.isRemoto = true;
            jogadoresRemotos[jogadorInfo.id] = carroRemoto;
            cena.add(carroRemoto);
            atualizarFisicaAdversarios();
        }

        if (typeof jogadorInfo.slotIndex === 'number') {
            posicionarCarroMultiplayer(carroRemoto, jogadorInfo.slotIndex);
        }

        if (jogadorInfo.position) {
            carroRemoto.position.set(jogadorInfo.position.x, jogadorInfo.position.y, jogadorInfo.position.z);
        }

        if (jogadorInfo.rotation) {
            carroRemoto.quaternion.set(jogadorInfo.rotation.x, jogadorInfo.rotation.y, jogadorInfo.rotation.z, jogadorInfo.rotation.w);
        }
    }

    function removerJogadorRemoto(id) {
        if (jogadoresRemotos[id]) {
            cena.remove(jogadoresRemotos[id]);
            delete jogadoresRemotos[id];
            atualizarFisicaAdversarios();
        }
    }

    function conectarMultiplayer() {
        if (rede.connected) {
            return;
        }

        // Determina a URL do servidor automaticamente (Local ou Produção)
        const serverUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000'
            : 'https://computacaografica-3uzi.onrender.com';

        const sucesso = rede.connect(serverUrl);
        if (!sucesso) {
            lobbyMessage.innerText = 'Socket.io não carregou. Verifique o servidor.';
            return;
        }

        rede.on('connected', () => {
            multiplayerConectado = true;
            lobbyMessage.innerText = 'Conectado. Marque ready para aguardar a sala.';
            readyButton.disabled = false;
        });

        rede.on('sessionAssigned', (sessao) => {
            meuId = sessao.id;
            meuSlotIndex = sessao.slotIndex;
            multiplayerStarted = Boolean(sessao.partidaIniciada);
        });

        rede.on('lobbyUpdated', (sala) => {
            atualizarListaLobby(sala);
            multiplayerStarted = Boolean(sala.partidaIniciada);

            if (sala.partidaIniciada) {
                iniciarPartidaMultiplayer(sala);
            }
        });

        rede.on('gameStarted', (dados) => {
            multiplayerStarted = true;
            iniciarPartidaMultiplayer(dados);
        });

        rede.on('entityDisconnected', (id) => {
            removerJogadorRemoto(id);
        });

        rede.on('entityMoved', (jogadorInfo) => {
            if (jogadoresRemotos[jogadorInfo.id] && jogadorInfo.position) {
                const nav = jogadoresRemotos[jogadorInfo.id];
                nav.position.set(jogadorInfo.position.x, jogadorInfo.position.y, jogadorInfo.position.z);
                if (jogadorInfo.rotation) {
                    nav.quaternion.set(jogadorInfo.rotation.x, jogadorInfo.rotation.y, jogadorInfo.rotation.z, jogadorInfo.rotation.w);
                }
            }
        });

        rede.on('error', (msg) => {
            lobbyMessage.innerText = msg;
            readyButton.disabled = true;
        });
    }

    function iniciarPartidaMultiplayer(dadosSala) {
        if (gameStarted) {
            return;
        }

        multiplayerStarted = true;
        ocultarMenuPrincipal();

        const jogadoresSala = Array.isArray(dadosSala?.jogadores) ? dadosSala.jogadores : [];
        jogadoresSala.forEach((jogador) => {
            if (jogador.id === meuId) {
                posicionarCarroMultiplayer(carro, jogador.slotIndex);
            } else {
                criarJogadorRemoto(jogador);
            }
        });

        atualizarBotsVisiveis(false);
        encerrarOverlayEIniciarJogo();
    }

    function iniciarSinglePlayer() {
        gameMode = 'single';
        multiplayerReady = false;
        multiplayerStarted = false;
        multiplayerConectado = false;
        ocultarMenuPrincipal();
        atualizarBotsVisiveis(true);
        definirAdversarios(adversarios);
        posicionarEntidades(pistaAtual);
        encerrarOverlayEIniciarJogo();
    }

    function iniciarMultiplayer() {
        gameMode = 'multiplayer';
        multiplayerReady = false;
        multiplayerStarted = false;
        multiplayerConectado = false;
        atualizarBotsVisiveis(false);
        exibirLobbyMultiplayer();
        conectarMultiplayer();
    }
    
    // Configurar o DefaultLoadingManager global
    THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
        const percent = (itemsLoaded / itemsTotal) * 100;
        progressBar.style.width = percent + '%';
        
        // Extrair nome do arquivo para mostrar
        const fileName = url.split('/').pop().split('?')[0]; 
        loadingText.innerText = `Carregando: ${fileName} (${itemsLoaded}/${itemsTotal})`;
    };

    THREE.DefaultLoadingManager.onLoad = function () {
        progressBar.style.width = '100%';
        loadingText.innerText = 'Carregamento Completo! Escolha um modo.';
        exibirMenuPrincipal();
    };

    THREE.DefaultLoadingManager.onError = function (url) {
        console.error('Houve um erro ao carregar ' + url);
        loadingText.innerText = 'Erro ao carregar recurso. Veja o console.';
        loadingText.style.color = 'red';
    };

    singlePlayerButton.addEventListener('click', iniciarSinglePlayer);
    multiplayerButton.addEventListener('click', iniciarMultiplayer);
    readyButton.addEventListener('click', () => {
        if (!rede.connected || !multiplayerConectado) {
            lobbyMessage.innerText = 'Ainda não conectado ao servidor.';
            return;
        }

        multiplayerReady = !multiplayerReady;
        readyButton.innerText = multiplayerReady ? 'Unready' : 'Ready';
        rede.setReadyState(multiplayerReady);
        lobbyMessage.innerText = multiplayerReady ? 'Pronto. Aguardando os outros jogadores.' : 'Você está aguardando novamente.';
    });

    // Configuração da cena
    const cena = new THREE.Scene();

    // Skybox (Céu) - Panorama
    const loader = new THREE.TextureLoader();
    const texture = loader.load('../assets/textures/skybox/panorama1.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    cena.background = texture;
    
    // Passar cena para física (para tiros)
    definirCena(cena);
    
    // Renderizador
    const renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras mais suaves 
    document.body.appendChild(renderizador.domElement);
    
    // FPS Counter Simples
    const fpsDiv = document.createElement('div');
    fpsDiv.style.position = 'absolute';
    fpsDiv.style.top = '10px';
    fpsDiv.style.left = '10px';
    fpsDiv.style.color = 'white';
    fpsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    fpsDiv.style.padding = '5px 10px';
    fpsDiv.style.fontFamily = 'Arial, sans-serif';
    fpsDiv.style.fontSize = '14px';
    fpsDiv.style.fontWeight = 'bold';
    fpsDiv.style.borderRadius = '4px';
    fpsDiv.innerHTML = 'FPS: 0';
    document.body.appendChild(fpsDiv);
    
    // Create Pause Button
    const pauseButton = document.createElement('button');
    pauseButton.style.position = 'absolute';
    pauseButton.style.top = '10px';
    pauseButton.style.left = '100px';
    pauseButton.innerText = 'Pause Physics';
    document.body.appendChild(pauseButton);
    
    let isPaused = false;
    pauseButton.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseButton.innerText = isPaused ? 'Resume Physics' : 'Pause Physics';
    });

    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;
    
    // Câmera
    const camera = criarCamera();
    
    // Configurar áudio do tiro (Listener já está na câmera, mas a função precisa ser chamada com a câmera configurada)
    // Opcionalmente podemos reutilizar o listener já criado abaixo, mas a função configurarAudioTiro cria um novo se precisar.
    // Vamos chamar depois de criar o listener principal para garantir a hierarquia correta se necessário, ou adaptar.
    // Neste caso, a função configurarAudioTiro adiciona seu próprio listener, o que pode dar warning. 
    // Melhor passar o listener existente para ela ou deixar ela criar. A função espera 'camera'.
    configurarAudioTiro(camera);
    
    // --- AUDIO SYSTEM ---
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const audioLoader = new THREE.AudioLoader();
    const soundStart1 = new THREE.Audio(listener);
    const soundStart2 = new THREE.Audio(listener);
    const soundLastLap = new THREE.Audio(listener);
    const musicTracks = [
        new THREE.Audio(listener), // Track 1
        new THREE.Audio(listener), // Track 2
        new THREE.Audio(listener)  // Track 3
    ];

    // Load Sounds (Path relative to index.html which is in examples/ presumably? Or root?)
    // If running from root, path is '0_assets_T3/...'. 
    // The workspace structure shows `0_assets_T3` at root.
    // Assuming the server root is the workspace root.
    const assetPath = '../0_assets_T3/'; // Given html/ is likely serving point or examples/
    // Wait, main.js imports are relative. 
    // The previous loader: `loader.setPath('../assets/textures/cube/Park/');` implies `main.js` is running from a folder one level deep, like `T3/` or `examples/`.
    // Workspace has `c:\Users\luish\CG\T3\main.js`.
    // The HTML file probably links main.js type module.
    // If the HTML is in `T3/` or `examples/`, `../0_assets_T3` should work if `0_assets_T3` is a sibling of `T3`.
    // Yes, `0_assets_T3` is at root. `T3` is at root. 
    // Wait. `c:\Users\luish\CG\T3` and `c:\Users\luish\CG\0_assets_T3`.
    let isMusicEnabled = true;
    let shouldPlayMusic = false;
    let lastStartSound = 2; // Start with 1 next
    let lastLapTriggered = false;

    audioLoader.load('../0_assets_T3/start01.mp3', (buffer) => {
        soundStart1.setBuffer(buffer);
        soundStart1.setVolume(0.5);
    });
    audioLoader.load('../0_assets_T3/start02.mp3', (buffer) => { soundStart2.setBuffer(buffer); soundStart2.setVolume(0.5); });
    audioLoader.load('../0_assets_T3/lastLap.mp3', (buffer) => { soundLastLap.setBuffer(buffer); soundLastLap.setVolume(0.7); });
    
    const musicFiles = ['01 Bad to the Bone.mp3', '02 Paranoid.mp3', '04 Peter Gunn.mp3'];
    musicFiles.forEach((file, index) => {
        audioLoader.load('../0_assets_T3/' + file, (buffer) => {
            musicTracks[index].setBuffer(buffer);
            musicTracks[index].setLoop(true);
            
            // Ajustar volume: Aumentado geral (0.5), Pista 3 ainda mais alto (0.8)
            const volume = (index === 2) ? 0.8 : 0.5;
            musicTracks[index].setVolume(volume);

            // Auto-play apenas quando o jogo inicia
            if (shouldPlayMusic && index === (pistaAtual - 1) && isMusicEnabled) {
                musicTracks[index].play();
            }
        });
    });

    function playStartSound() {
        if (soundStart1.isPlaying) soundStart1.stop();
        if (soundStart2.isPlaying) soundStart2.stop();

        if (lastStartSound === 2) {
            if (soundStart1.buffer) soundStart1.play();
            lastStartSound = 1;
        } else {
            if (soundStart2.buffer) soundStart2.play();
            lastStartSound = 2;
        }
    }

    function updateMusic() {
        // Stop all
        musicTracks.forEach(m => { if(m.isPlaying) m.stop(); });
        
        if (isMusicEnabled) {
            const trackIdx = pistaAtual - 1;
            if (musicTracks[trackIdx] && musicTracks[trackIdx].buffer) {
                musicTracks[trackIdx].play();
            }
        }
    }

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.5);
    cena.add(luzAmbiente);
    
    // Luz direcional (sol)
    const luzDirecional = new THREE.DirectionalLight(0xffffff, 1.5); // Aumentar intensidade (Sol forte)
    // Mudança de ângulo: Luz vindo mais lateralmente e de trás para projetar a sombra para frente/lado, visível na câmera (que olha de trás)
    // Se a câmera está em (0, 120, -100) olhando (0,0,0) (Isso é frente? Não, Pista 1 vai para -Z?) -> precisa verificar orientação.
    // Vamos colocar a luz vindo de "cima-esquerda" bem angulada.
    const offsetLuz = new THREE.Vector3(-100, 150, 50); 
    luzDirecional.position.copy(offsetLuz);
    luzDirecional.castShadow = true;
    
    // Configuração da sombra
    // Foco total na área próxima do carro para máxima resolução
    const shadowSize = 100; // Cobre 200x200 unidades (muito próximo)
    luzDirecional.shadow.camera.left = -shadowSize;
    luzDirecional.shadow.camera.right = shadowSize;
    luzDirecional.shadow.camera.top = shadowSize;
    luzDirecional.shadow.camera.bottom = -shadowSize;
    
    // Near/Far ajustados para a nova distância da luz (sqrt(100^2+150^2+50^2) ~ 190)
    luzDirecional.shadow.camera.near = 10;
    luzDirecional.shadow.camera.far = 400; 
    
    // Resolução Máxima
    luzDirecional.shadow.mapSize.width = 4096;
    luzDirecional.shadow.mapSize.height = 4096;
    
    // BIAS CRÍTICO: 
    // -0.0001 é seguro para evitar peter-panning em objetos no chão. 
    // normalBias baixo para não encolher a sombra.
    luzDirecional.shadow.bias = -0.0001; 
    luzDirecional.shadow.normalBias = 0.005; // Quase zero para manter a forma exata
    
    // Raio para PCFSoftShadowMap (borra levemente as bordas)
    luzDirecional.shadow.radius = 2; // Suave, mas visível
    
    cena.add(luzDirecional);
    
    luzDirecional.target.position.set(0, 0, 0);
    cena.add(luzDirecional.target);
    
    const luzHemisferica = new THREE.HemisphereLight(0x87ceeb, 0x2d5016, 0.3);
    cena.add(luzHemisferica);
    
    const axesHelper = new THREE.AxesHelper(150);
    cena.add(axesHelper);
    
    const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
    cena.add(gridHelper);
    
    // Criar pistas
    let pistaAtual = 1;
    const pista1Data = criarPista1(cena);
    const pista2Data = criarPista2(cena);
    const pista3Data = criarPista3(cena);
    pista2Data.grupo.visible = false;
    pista3Data.grupo.visible = false;
    
    // Criar carro do JOGADOR
    const carro = criarCarro(cena);
    
    // Multiplayer é gerenciado pelo menu inicial e lobby.
    
    // Cores e Nomes dos Adversários (Cores mais vivas para destacar a textura)
    const configsAdversarios = [
        { nome: 'Vermelho Veloz', principal: 0xff4444, detalhe: 0xff0000 }, // Vermelho Vivo + Detalhe Vermelho (antes branco)
        { nome: 'Verde Veneno', principal: 0x44ff44, detalhe: 0xccff00 }, // Verde Vivo
        { nome: 'Roxo Real', principal: 0xaa44ff, detalhe: 0xffd700 }  // Roxo Vivo
    ];

    // Criar 3 ADVERSÁRIOS
    const adversarios = [];
    for(let i=0; i<3; i++) {
        const config = configsAdversarios[i];
        const adv = criarCarroAdversario(cena, config.principal, config.detalhe, i);
        
        // Adicionar nome aos dados do usuário
        adv.userData.nome = config.nome;
        adversarios.push(adv);
    }
    
    // Inicializar controles de órbita
    inicializarOrbitControls(camera, renderizador);
    
    // Conectar sistemas
    inicializarControles();
    definirCarro(carro);
    definirCarroCamera(carro);
    definirAdversarios(adversarios);
    
    // Configurar pista inicial (Pista 1)
    definirPista(pista1Data.grupo);
    definirColisores(pista1Data.colisores);
    definirLinhaChegada(pista1Data.linhaChegada);
    definirCheckpoints(pista1Data.checkpoints);
    definirWaypoints(pista1Data.waypoints);
    
    // Inicializar modo de câmera
    window.modoCameraAtual = 'Aérea';

    // Função auxiliar para posicionar
    // Geração de offset aleatório por jogador para evitar sobreposição total
    const randomSpawnOffset = (Math.random() - 0.5) * 12; // Valor entre -6 e 6

    function posicionarEntidades(pistaNum) {
        if (!carro) return;
        
        // Posições baseadas na pista
        if (pistaNum === 1 || pistaNum === 2) {
            // Player - Linha de Trás (Grid 2x2)
            carro.position.set(158 + randomSpawnOffset, 0.5, -40 + randomSpawnOffset);
            carro.userData.angulo = Math.PI; 
            
            // GRID DA FRENTE (-20)
            // Adv 0: Frente Esquerda
            adversarios[0].position.set(142, 0.5, -20); 
            adversarios[0].userData.angulo = Math.PI;
            
            // Adv 1: Frente Direita
            adversarios[1].position.set(158, 0.5, -20); 
            adversarios[1].userData.angulo = Math.PI;
            
            // GRID DE TRÁS (-40)
            // Adv 2: Trás Esquerda
            adversarios[2].position.set(142, 0.5, -40); 
            adversarios[2].userData.angulo = Math.PI;
            
        } else if (pistaNum === 3) {
             // Player: Trás Direita
             carro.position.set(-100 + randomSpawnOffset, 0.5, -153 + randomSpawnOffset);
             carro.userData.angulo = -Math.PI / 2; // Facing -X

             // GRID DA FRENTE (-80)
             // Adv 0: Frente Esquerda
             adversarios[0].position.set(-80, 0.5, -137);
             adversarios[0].userData.angulo = -Math.PI / 2;
             adversarios[0].userData.waypointIndex = 1;

             // Adv 1: Frente Direita
             adversarios[1].position.set(-80, 0.5, -153);
             adversarios[1].userData.angulo = -Math.PI / 2;
             adversarios[1].userData.waypointIndex = 1;

             // GRID DE TRÁS (-100)
             // Adv 2: Trás Esquerda
             adversarios[2].position.set(-100, 0.5, -137);
             adversarios[2].userData.angulo = -Math.PI / 2;
             adversarios[2].userData.waypointIndex = 1;
        }

        // Resetar estados
        carro.userData.velocidade = 0;
        carro.userData.anguloRodas = 0;
        carro.userData.municao = 4;
        carro.userData.voltas = 0;

        adversarios.forEach((adv) => {
            adv.userData.velocidade = 0;
            // Para pista 3, já setamos o waypointIndex para 1 acima.
            // Aqui resetamos para 0 SOMENTE SE ainda não foi setado (undefined) ou se for pista 1/2
            if (pistaNum !== 3) {
                 adv.userData.waypointIndex = 0;
            }
            adv.userData.municao = 4;
            adv.userData.voltas = 0;
            adv.userData.proximoCheckpoint = 0;
            adv.visible = true; // Garantir visibilidade
        });
    }

    // Posicionar inicialmente
    posicionarEntidades(1);

    // Função para trocar de pista
    function trocarPista(numeroPista) {
        if (numeroPista === 1 && pistaAtual !== 1) {
            pista1Data.grupo.visible = true;
            pista2Data.grupo.visible = false;
            pista3Data.grupo.visible = false;
            definirPista(pista1Data.grupo);
            definirColisores(pista1Data.colisores);
            definirLinhaChegada(pista1Data.linhaChegada);
            definirCheckpoints(pista1Data.checkpoints);
            definirWaypoints(pista1Data.waypoints);
            pistaAtual = 1;
            console.log('Pista 1 ativada');
            posicionarEntidades(1);
            playStartSound();
            updateMusic();
            
        } else if (numeroPista === 2 && pistaAtual !== 2) {
            pista1Data.grupo.visible = false;
            pista2Data.grupo.visible = true;
            pista3Data.grupo.visible = false;
            definirPista(pista2Data.grupo);
            definirColisores(pista2Data.colisores);
            definirLinhaChegada(pista2Data.linhaChegada);
            definirCheckpoints(pista2Data.checkpoints);
            definirWaypoints(pista2Data.waypoints);
            pistaAtual = 2;
            console.log('Pista 2 ativada');
            posicionarEntidades(2);
            playStartSound();
            updateMusic();
            
        } else if (numeroPista === 3 && pistaAtual !== 3) {
            pista1Data.grupo.visible = false;
            pista2Data.grupo.visible = false;
            pista3Data.grupo.visible = true;
            definirPista(pista3Data.grupo);
            definirColisores(pista3Data.colisores);
            definirLinhaChegada(pista3Data.linhaChegada);
            definirCheckpoints(pista3Data.checkpoints);
            definirWaypoints(pista3Data.waypoints);
            definirBuracoERampas(pista3Data.buraco, pista3Data.rampas); // Nova função
            pistaAtual = 3;
            console.log('Pista 3 ativada');
            posicionarEntidades(3);
            playStartSound();
            updateMusic();
        }
        
        // Resetar flag da última volta
        lastLapTriggered = false;
    }
    
    // Atualização imediata de rede ao concluir conectividade, para garantir q o outro cliente
    // saiba do nosso ponto de respawn antes mesmo de darmos start (evita nascer no meio do mapa(0,0,0)).
    rede.on('connected', () => {
         rede.sendTransform(carro.position, carro.quaternion);
    });

    // Adicionar listener para teclas 1, 2 e 3 e Espaço (Tiro)
    window.addEventListener('keydown', (evento) => {
        if (evento.key === '1') {
            trocarPista(1);
        } else if (evento.key === '2') {
            trocarPista(2);
        } else if (evento.key === '3') {
            trocarPista(3);
        } else if (evento.code === 'Space' || evento.key.toLowerCase() === 'z') {
            atirarDoJogador();
        } else if (evento.key.toLowerCase() === 'q') {
            isMusicEnabled = !isMusicEnabled;
            updateMusic();
        }
    });
    
    // Ajustar renderizador quando a janela é redimensionada
    window.addEventListener('resize', () => {
        renderizador.setSize(window.innerWidth, window.innerHeight);
    });
    
    const texturasAnimadas = obterTexturasAnimadas();

    // Loop de renderização
    function animar() {
        requestAnimationFrame(animar);

        // Bloquear lógica se ainda não deu Start
        if (!gameStarted) {
            renderizador.render(cena, camera);
            return;
        }
        
        // Atualizar FPS
        const currentTime = performance.now();
        frameCount++;
        
        if (currentTime - lastTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastTime = currentTime;
            fpsDiv.innerHTML = `FPS: ${fps}`;
        }
        
        if (!isPaused) {
            // Atualizar física
            aplicarFisica();

            // Check Last Lap (Total 4 laps. Last lap is when 3 are completed)
            if (carro && carro.userData.voltas === 3 && !lastLapTriggered) {
                 if (soundLastLap.buffer) soundLastLap.play();
                 lastLapTriggered = true;
            }
        }
        
        // Atualizar luz para seguir o carro (translação apenas)
        if (carro) {
            luzDirecional.position.copy(carro.position).add(offsetLuz);
            luzDirecional.target.position.copy(carro.position);
            luzDirecional.target.updateMatrixWorld();
        }
        
        // Atualizar câmera
        atualizarCamera(camera);

        const delta = 1/60; // Aproximação ou usar clock real
        
        if (!isPaused) {
            // Atualizar efeitos da pista (água e partículas)
            // Coletar todos os carros para checagem
            const todosCarros = [carro, ...adversarios];
            atualizarEfeitosPista(delta, todosCarros, cena);

            // Animar texturas (água) - Mantido para compatibilidade, mas a nova água usa shader
            if (texturasAnimadas.length > 0) {
                texturasAnimadas.forEach((tex) => {
                    tex.offset.x = (tex.offset.x + 0.002) % 1;
                    tex.offset.y = (tex.offset.y + 0.001) % 1;
                });
            }

            // Enviar posição do jogador para o Servidor Multiplayer usando a Engine desacoplada
            if (rede.connected && gameStarted) {
                rede.sendTransform(carro.position, carro.quaternion);
            }
        }
        
        // Renderizar cena
        renderizador.render(cena, camera);
    }
    
    animar();
}

principal();
