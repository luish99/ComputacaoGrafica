import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let modoCamera = 0; // 0 = aérea, 1 = terceira pessoa, 2 = primeira pessoa
let carro = null;
let orbitControls = null;

const MODOS = ['Aérea', 'Terceira Pessoa', 'Primeira Pessoa'];

export function criarCamera() {
    const camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        1000
    );
    
    // Posição inicial (câmera aérea)
    camera.position.set(0, 120, -100);
    camera.lookAt(0, 0, 0);
    
    // Listener para trocar modo de câmera
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c') {
            modoCamera = (modoCamera + 1) % 3;
            window.modoCameraAtual = MODOS[modoCamera];
            
            // Ativar/desativar OrbitControls conforme o modo
            if (orbitControls) {
                orbitControls.enabled = (modoCamera === 0); // Apenas no modo aéreo
            }
            
            console.log('Modo câmera:', MODOS[modoCamera]);
        }
    });
    
    // Ajustar câmera quando a janela é redimensionada
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
    
    return camera;
}

export function inicializarOrbitControls(camera, renderer) {
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true; // Suavização do movimento
    orbitControls.dampingFactor = 0.05;
    orbitControls.minDistance = 50; // Distância mínima de zoom
    orbitControls.maxDistance = 500; // Distância máxima de zoom
    orbitControls.maxPolarAngle = Math.PI / 2; // Não deixa ir abaixo do chão
    orbitControls.enabled = true; // Começa ativado (modo aéreo)
    
    return orbitControls;
}

export function definirCarro(carroObj) {
    carro = carroObj;
}

export function atualizarCamera(camera) {
    if (!carro) return;
    
    // Atualizar OrbitControls se estiver no modo aéreo
    if (modoCamera === 0 && orbitControls) {
        orbitControls.update();
        return; // OrbitControls já controla a câmera
    }
    
    switch (modoCamera) {
        case 0: // Câmera aérea fixa (se OrbitControls não estiver ativo)
            camera.position.set(0, 120, -100);
            camera.lookAt(0, 0, 0);
            break;
            
        case 1: // Terceira pessoa (atrás do carro)
            const distancia = 15;
            const altura = 8;
            
            // Calcular posição atrás do carro
            const angulo = carro.userData.angulo;
            const offsetX = -Math.sin(angulo) * distancia;
            const offsetZ = -Math.cos(angulo) * distancia;
            
            // Suavizar movimento da câmera
            const targetPos = new THREE.Vector3(
                carro.position.x + offsetX,
                carro.position.y + altura,
                carro.position.z + offsetZ
            );
            
            camera.position.lerp(targetPos, 0.1);
            
            // Olhar para um ponto à frente do carro
            const lookAheadDist = 10;
            const lookAtPos = new THREE.Vector3(
                carro.position.x + Math.sin(angulo) * lookAheadDist,
                carro.position.y + 2,
                carro.position.z + Math.cos(angulo) * lookAheadDist
            );
            
            camera.lookAt(lookAtPos);
            break;
            
        case 2: // Primeira pessoa (dentro do carro)
            const alturaCabeca = 4;
            const distanciaFrente = 2;
            
            const anguloPrimeiraP = carro.userData.angulo;
            
            // Posição dentro do carro
            camera.position.set(
                carro.position.x + Math.sin(anguloPrimeiraP) * distanciaFrente,
                carro.position.y + alturaCabeca,
                carro.position.z + Math.cos(anguloPrimeiraP) * distanciaFrente
            );
            
            // Olhar para frente do carro
            const lookAheadDistFP = 50;
            const lookAtPosFP = new THREE.Vector3(
                carro.position.x + Math.sin(anguloPrimeiraP) * lookAheadDistFP,
                carro.position.y + alturaCabeca,
                carro.position.z + Math.cos(anguloPrimeiraP) * lookAheadDistFP
            );
            
            camera.lookAt(lookAtPosFP);
            break;
    }
}
