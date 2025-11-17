import * as THREE from 'three';
import { criarPista1, criarPista2 } from './Pista.js';
import { criarCarro } from './Carro.js';
import { criarCamera, atualizarCamera, definirCarro as definirCarroCamera, inicializarOrbitControls } from './CameraController.js';
import { aplicarFisica, inicializarControles, definirCarro, definirPista } from './Fisica.js';

function principal() {
    // Configuração da cena
    const cena = new THREE.Scene();
    cena.background = new THREE.Color(0x87ceeb); // Céu azul
    
    
    // Renderizador
    const renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderizador.domElement);
    
    // Câmera
    const camera = criarCamera();
    
    // Iluminação
    // Luz ambiente
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.5);
    cena.add(luzAmbiente);
    
    // Luz direcional (sol)
    const luzDirecional = new THREE.DirectionalLight(0xffffff, 0.8);
    luzDirecional.position.set(50, 100, -50);
    luzDirecional.castShadow = true;
    luzDirecional.shadow.camera.left = -150;
    luzDirecional.shadow.camera.right = 150;
    luzDirecional.shadow.camera.top = 150;
    luzDirecional.shadow.camera.bottom = -150;
    luzDirecional.shadow.camera.near = 0.5;
    luzDirecional.shadow.camera.far = 500;
    luzDirecional.shadow.mapSize.width = 2048;
    luzDirecional.shadow.mapSize.height = 2048;
    cena.add(luzDirecional);
    
    // Luz hemisférica para iluminação mais natural
    const luzHemisferica = new THREE.HemisphereLight(0x87ceeb, 0x2d5016, 0.3);
    cena.add(luzHemisferica);
    
    // Adicionar helper de eixos (X=vermelho, Y=verde, Z=azul)
    const axesHelper = new THREE.AxesHelper(150);
    cena.add(axesHelper);
    
    // Adicionar grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
    cena.add(gridHelper);
    
    // Criar pistas (inicialmente invisível a pista 2)
    let pistaAtual = 1;
    const pista1Data = criarPista1(cena);
    const pista2Data = criarPista2(cena);
    pista2Data.grupo.visible = false;
    
    // Criar carro
    const carro = criarCarro(cena);
    
    // Inicializar controles de órbita (mouse) para a câmera
    inicializarOrbitControls(camera, renderizador);
    
    // Conectar sistemas
    definirCarro(carro);
    definirCarroCamera(carro);
    definirPista(pista1Data.grupo);
    inicializarControles();
    
    // Inicializar modo de câmera
    window.modoCameraAtual = 'Aérea';
    
    // Função para trocar de pista
    function trocarPista(numeroPista) {
        if (numeroPista === 1 && pistaAtual !== 1) {
            pista1Data.grupo.visible = true;
            pista2Data.grupo.visible = false;
            definirPista(pista1Data.grupo);
            pistaAtual = 1;
            console.log('Pista 1 ativada');
        } else if (numeroPista === 2 && pistaAtual !== 2) {
            pista1Data.grupo.visible = false;
            pista2Data.grupo.visible = true;
            definirPista(pista2Data.grupo);
            pistaAtual = 2;
            console.log('Pista 2 ativada');
        }
    }
    
    // Adicionar listener para teclas 1 e 2
    window.addEventListener('keydown', (evento) => {
        if (evento.key === '1') {
            trocarPista(1);
        } else if (evento.key === '2') {
            trocarPista(2);
        }
    });
    
    // Ajustar renderizador quando a janela é redimensionada
    window.addEventListener('resize', () => {
        renderizador.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Loop de renderização
    function animar() {
        requestAnimationFrame(animar);
        
        // Atualizar física
        aplicarFisica();
        
        // Atualizar câmera
        atualizarCamera(camera);
        
        // Renderizar cena
        renderizador.render(cena, camera);
    }
    
    animar();
}

principal();
