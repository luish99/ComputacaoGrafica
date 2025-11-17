import * as THREE from 'three';

// Estado do teclado
const teclas = {
    frente: false,
    tras: false,
    esquerda: false,
    direita: false
};

// Constantes de física
const ACELERACAO = 0.15;
const DESACELERACAO = 0.05;
const VELOCIDADE_MAX = 2.0;
const VELOCIDADE_RE_MAX = 1.0;
const TAXA_ESTERCO = 0.03;
const ESTERCO_MAX = 0.5;
const FRICCAO = 0.98;

let carro = null;
let pista = null;

// Configurar listeners de teclado
export function inicializarControles() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'w') teclas.frente = true;
        if (key === 'arrowdown' || key === 's') teclas.tras = true;
        if (key === 'arrowleft' || key === 'a') teclas.esquerda = true;
        if (key === 'arrowright' || key === 'd') teclas.direita = true;
    });
    
    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'w') teclas.frente = false;
        if (key === 'arrowdown' || key === 's') teclas.tras = false;
        if (key === 'arrowleft' || key === 'a') teclas.esquerda = false;
        if (key === 'arrowright' || key === 'd') teclas.direita = false;
    });
}

export function definirCarro(carroObj) {
    carro = carroObj;
}

export function definirPista(pistaObj) {
    pista = pistaObj;
}

export function aplicarFisica() {
    if (!carro) return;
    
    // Aceleração e desaceleração
    if (teclas.frente) {
        carro.userData.velocidade += ACELERACAO;
        if (carro.userData.velocidade > VELOCIDADE_MAX) {
            carro.userData.velocidade = VELOCIDADE_MAX;
        }
    } else if (teclas.tras) {
        carro.userData.velocidade -= ACELERACAO;
        if (carro.userData.velocidade < -VELOCIDADE_RE_MAX) {
            carro.userData.velocidade = -VELOCIDADE_RE_MAX;
        }
    } else {
        // Aplicar fricção quando não está acelerando
        carro.userData.velocidade *= FRICCAO;
        if (Math.abs(carro.userData.velocidade) < 0.01) {
            carro.userData.velocidade = 0;
        }
    }
    
    // Esterçamento (direção)
    if (teclas.esquerda) {
        carro.userData.anguloRodas += TAXA_ESTERCO;
        if (carro.userData.anguloRodas > ESTERCO_MAX) {
            carro.userData.anguloRodas = ESTERCO_MAX;
        }
    } else if (teclas.direita) {
        carro.userData.anguloRodas -= TAXA_ESTERCO;
        if (carro.userData.anguloRodas < -ESTERCO_MAX) {
            carro.userData.anguloRodas = -ESTERCO_MAX;
        }
    } else {
        // Voltar rodas para posição central
        carro.userData.anguloRodas *= 0.9;
        if (Math.abs(carro.userData.anguloRodas) < 0.01) {
            carro.userData.anguloRodas = 0;
        }
    }
    
    // Rotacionar rodas frontais visualmente
    if (carro.userData.rodas) {
        carro.userData.rodas.forEach(roda => {
            if (roda.nome.includes('frontal')) {
                roda.mesh.rotation.y = carro.userData.anguloRodas;
            }
            // Animar rotação das rodas baseado na velocidade
            roda.mesh.children[0].rotation.x += carro.userData.velocidade * 0.5;
        });
    }
    
    // Aplicar rotação do carro baseado no esterçamento e velocidade
    if (Math.abs(carro.userData.velocidade) > 0.1) {
        carro.userData.angulo += carro.userData.anguloRodas * carro.userData.velocidade * 0.1;
    }
    
    // Calcular nova posição (no plano XZ com Y como altura)
    const direcao = new THREE.Vector3(
        Math.sin(carro.userData.angulo),
        0,
        Math.cos(carro.userData.angulo)
    );
    
    const novaPosicao = carro.position.clone().add(
        direcao.multiplyScalar(carro.userData.velocidade)
    );
    
    // Mover o carro
    carro.position.copy(novaPosicao);
    carro.rotation.y = carro.userData.angulo;
    
    // Atualizar interface
    atualizarInterface();
}

// Atualizar informações na tela
function atualizarInterface() {
    const infoDiv = document.getElementById('info');
    if (infoDiv && carro) {
        const velocidadeKmh = Math.abs(carro.userData.velocidade * 50).toFixed(0);
        const modoCamera = window.modoCameraAtual || 'Aérea';
        const posX = carro.position.x.toFixed(1);
        const posY = carro.position.y.toFixed(1);
        const posZ = carro.position.z.toFixed(1);
        infoDiv.innerHTML = `Velocidade: ${velocidadeKmh} km/h<br>Câmera: ${modoCamera}<br>Posição: X=${posX}, Y=${posY}, Z=${posZ}`;
    }
}

export function obterVelocidade() {
    return carro ? carro.userData.velocidade : 0;
}
