import * as THREE from 'three';

// Estado do teclado
const teclas = {
    frente: false,
    tras: false,
    esquerda: false,
    direita: false
};

// Constantes de física
const ACELERACAO = 0.015;      // Antes era 0.05 (reduzido 3x para dar sensação de motor crescendo)
const DESACELERACAO = 0.03;    // Mais suave
const VELOCIDADE_MAX = 2.2;    // Um pouco menor para controlar o mapa
const VELOCIDADE_RE_MAX = 0.5;
const TAXA_ESTERCO = 0.035;    // Antes era 0.1 (reduzido drasticamente!)
const ESTERCO_MAX = 0.6;
const FRICCAO = 0.96;

let carro = null;
let pista = null;
let colisores = [];
let linhaChegada = null;
let checkpoints = [];
let proximoCheckpoint = 0;
let voltasCompletadas = 0;
let passouLinha = false;
const TOTAL_VOLTAS = 4;

// Variáveis do Adversário e Combate
let adversarios = [];
let waypoints = [];
let tiros = [];
let cenaRef = null;
let jogoAcabou = false;
let vencedor = null;

// Configurar listeners de teclado e Joystick (Mobile)
export function inicializarControles() {
    // === JOYSTICK MOBILE ===
    // Verifica se a biblioteca nipplejs foi carregada (apenas no mobile/HTML que tem o script)
    if (typeof nipplejs !== 'undefined') {
        const zone = document.getElementById('joystickWrapper1');
        if (zone) {
            const joystick = nipplejs.create({
                zone: zone,
                mode: 'static',
                position: { left: '80px', bottom: '80px' },
                color: 'white',
                size: 150
            });
            
            joystick.on('move', (evt, data) => {
                 const dx = data.vector.x;
                 const dy = data.vector.y;
                 
                 // Limiares para ativar (Deadzone)
                 teclas.direita = dx > 0.3;
                 teclas.esquerda = dx < -0.3;
                 teclas.frente = dy > 0.3;
                 teclas.tras = dy < -0.3;
            });
            
            joystick.on('end', () => {
                teclas.frente = false;
                teclas.tras = false;
                teclas.esquerda = false;
                teclas.direita = false;
            });
        }
    }

    window.addEventListener('keydown', (e) => {
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                teclas.frente = true;
                break;
            case 's':
            case 'arrowdown':
                teclas.tras = true;
                break;
            case 'a':
            case 'arrowleft':
                teclas.esquerda = true;
                break;
            case 'd':
            case 'arrowright':
                teclas.direita = true;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                teclas.frente = false;
                break;
            case 's':
            case 'arrowdown':
                teclas.tras = false;
                break;
            case 'a':
            case 'arrowleft':
                teclas.esquerda = false;
                break;
            case 'd':
            case 'arrowright':
                teclas.direita = false;
                break;
        }
    });
}

export function definirCarro(carroObj) {
    carro = carroObj;
}

// Buraco e Rampas (Pista 3)
let buracoPista3 = null;
let rampasPista3 = null;

export function definirBuracoERampas(buraco, rampas) {
    buracoPista3 = buraco;
    rampasPista3 = rampas;
}

export function definirPista(pistaObj) {
    pista = pistaObj;
}

export function definirCena(cena) {
    cenaRef = cena;
}

export function definirColisores(colisoresArray) {
    colisores = colisoresArray;
    console.log(`Sistema de colisão inicializado com ${colisores.length} muretas`);
}

export function definirLinhaChegada(linha) {
    linhaChegada = linha;
}

export function definirCheckpoints(checkpointsArray) {
    checkpoints = checkpointsArray;
    proximoCheckpoint = 0;
    console.log(`Sistema de checkpoints inicializado com ${checkpoints.length} pontos`);
}

export function definirAdversarios(advArray) {
    adversarios = advArray;
    // Inicializar dados de cada adversário
    adversarios.forEach((adv, index) => {
        if (!adv.userData.waypointIndex) {
            adv.userData.id = index;
            adv.userData.waypointIndex = 0;
            adv.userData.velocidade = 0;
            adv.userData.angulo = Math.PI;
            adv.userData.municao = 4;
            adv.userData.voltas = 0;
            adv.userData.proximoCheckpoint = 0;
            adv.userData.isAdversario = true;
        }
    }); 
}
// Manter compatibilidade caso exista código antigo chamando definirAdversario
export function definirAdversario(advObj) {
    definirAdversarios([advObj]);
}

export function definirWaypoints(wpArray) {
    waypoints = wpArray;
}
//...
export function aplicarFisica() {
    if (!carro || jogoAcabou) return;
    
    // Atualizar Adversários
    atualizarAdversarios();
    
    // Atualizar Tiros
    atualizarTiros();

    // Verificar dano no jogador
    //...
    
    // (Existing Player Movement Code...)
    let velocidadeMaxAtual = VELOCIDADE_MAX;
    if (carro.userData.sobEfeitoDano) {
        if (Date.now() - carro.userData.tempoDano > 3000) {
            carro.userData.sobEfeitoDano = false;
        } else {
            // Durante o dano, velocidade limitada a 30%
            velocidadeMaxAtual = VELOCIDADE_MAX * 0.3;
            if (Math.abs(carro.userData.velocidade) > velocidadeMaxAtual) {
                carro.userData.velocidade = Math.sign(carro.userData.velocidade) * velocidadeMaxAtual;
            }
        }
    }

    // Aceleração e desaceleração
    if (teclas.frente) {
        carro.userData.velocidade += ACELERACAO;
        if (carro.userData.velocidade > velocidadeMaxAtual) {
            carro.userData.velocidade = velocidadeMaxAtual;
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
    // Ajustado para comportamento mais realista (menor sensibilidade em alta velocidade)
    if (Math.abs(carro.userData.velocidade) > 0.1) {
        // Multiplicador reduzido de 0.5 para 0.04 para evitar curvas instantâneas
        carro.userData.angulo += carro.userData.anguloRodas * carro.userData.velocidade * 0.04;
        
        // Reduzir ligeiramente a velocidade ao fazer curvas bruscas (arrasto)
        if (Math.abs(carro.userData.anguloRodas) > 0.2) {
            carro.userData.velocidade *= 0.99;
        }
    }
    
    // Calcular nova posição (no plano XZ com Y como altura)
    // Ajuste: usar -angulo para que frente seja Z negativo (padrão Three.js)
    const direcao = new THREE.Vector3(
        -Math.sin(carro.userData.angulo),
        0,
        -Math.cos(carro.userData.angulo)
    );
    
    const novaPosicao = carro.position.clone().add(
        direcao.multiplyScalar(carro.userData.velocidade)
    );
    
    // === Lógica de Descontinuidade (Pista 3) ===
    let caindoNoBuraco = false;
    if (buracoPista3 && !carro.userData.voando) {
        const x = novaPosicao.x;
        const z = novaPosicao.z;
        // Check buraco
        if (x >= buracoPista3.xMin && x <= buracoPista3.xMax &&
            z >= buracoPista3.zMin && z <= buracoPista3.zMax) {
            caindoNoBuraco = true;
        }
    }

    // Lógica de Queda e Respawn
    if (caindoNoBuraco || carro.userData.caindo || carro.position.y < -1.0) {
        carro.userData.caindo = true;
        
        // Simular gravidade caindo
        carro.position.y -= 0.8; 
        carro.rotation.x -= 0.05; // Girar de nariz
        
        // Continuar movendo horizontalmente (inércia)
        carro.position.add(direcao.multiplyScalar(carro.userData.velocidade));
        
        // Respawn se cair muito
        if (carro.position.y < -30) {
            console.log("Respawn!");
            // Resetar estado
            carro.userData.caindo = false;
            carro.userData.velocidade = 0;
            carro.rotation.x = 0;
            carro.rotation.z = 0;
            
            // Posição solicitada: x=150, z=26
            carro.position.set(150, 0.5, 26);
            
            // Orientação para reset (Olhando para X negativo, pois a pista roda horário nesse ponto?)
            // Verificar layout: Quadrado Inferior Esquerdo. A reta superior vai de E para D ou D para E?
            // Waypoints indicam: ... { x: 20, z: 20 }, { x: -140, z: 20 } ...
            // Indo de 20 para -140 (Direita pra Esquerda, X Negativo).
            carro.userData.angulo = Math.PI; // Face -Z? Não.
            // Vector(-sin(a), 0, -cos(a)). Para ir -X: sin(a)=1, cos(a)=0 => a=PI/2
            carro.userData.angulo = Math.PI / 2; 
        }
        return; 
    }
    
    // === Lógica de Rampas ===
    if (rampasPista3) {
        if (carro.userData.voando) {
            carro.userData.vooTempo += 1/60;
            const t = carro.userData.vooTempo;
            
            // Física do Lançamento Oblíquo (Cinemática)
            // Definindo a trajetória baseada na Altura Máxima desejada e Tempo de Voo
            const H_MAX = 30.0;    // Altura pico (unidades) - Reduzido para salto mais rasante
            const TEMPO_VOO = 1.0; // Tempo total no ar (segundos) - Reduzido de 1.2 para encurtar a distância X
            
            // Fórmulas derivadas de h(t) = v0y*t - 0.5*g*t^2:
            // v0y = 4 * H / T
            // g = 8 * H / T^2
            const vy0 = (4 * H_MAX) / TEMPO_VOO;
            const gravidade = (8 * H_MAX) / (TEMPO_VOO * TEMPO_VOO);
            
            const h = 0.5 + (vy0 * t) - (0.5 * gravidade * t * t);
            
            if (h <= 0.02) {
                // Aterrissagem
                carro.userData.voando = false;
                carro.position.y = 0.02;
                carro.rotation.x = 0;
            } else {
                // Atualizar posição vertical
                carro.position.y = h;
                novaPosicao.y = h;
                
                // Rotação visual simples (nariz levemente para baixo na queda)
                if (t < 0.2) carro.rotation.x = -0.1; // Subindo
                else carro.rotation.x = 0.1; // Caindo
            }
        } else {
            // Checar Jump Plates (F-Zero Style)
            for(const rampa of rampasPista3) {
                const dx = carro.position.x - rampa.x;
                const dz = carro.position.z - rampa.z;
                
                // Área de ativação da Jump Plate (10x40 aprox)
                if (Math.abs(dx) < 5 && Math.abs(dz) < 20) {
                    
                    // Deve ter velocidade mínima
                    if (Math.abs(carro.userData.velocidade) > 1.0) {
                        
                        let pular = false;
                         // Plate 1 (X=5): Pula se indo para Esquerda (-X)
                         if (rampa.direction === -1 && direcao.x < -0.5) pular = true;

                         // Plate 2 (X=-45): Pula se indo para Direita (+X)
                         if (rampa.direction === 1 && direcao.x > 0.5) pular = true;

                        if (pular) {
                            carro.userData.voando = true;
                            // Salto F-Zero: Arco rápido e controlado
                            const velBase = Math.abs(carro.userData.velocidade);
                            carro.userData.velocidadeSalto = Math.max(velBase, 1.5) * 0.5; // Ajuste de altura
                            carro.userData.vooTempo = 0;
                            // Não travamos direção, permitindo leve controle aéreo ou mantendo inércia total
                        }
                    }
                }
            }
        }
    }
    
    // Verificar colisão antes de mover
    const resultadoColisao = verificarColisao(novaPosicao, carro.userData.angulo, carro);
    
    if (resultadoColisao.colidiu) {
        // Aplicar deslizamento ao longo da mureta
        const posicaoCorrigida = aplicarDeslizamento(
            carro.position,
            novaPosicao,
            resultadoColisao,
            carro.userData.velocidade,
            carro.userData.angulo,
            carro
        );
        
        // Verificação dupla
        const verificacaoFinal = verificarColisao(posicaoCorrigida, carro.userData.angulo, carro);
        if (verificacaoFinal.colidiu) {
            // FALHA NA CORREÇÃO: O carro ainda colide após tentar deslizar.
            // Isso geralmente acontece porque a rotação ou o inset ainda mantem o carro preso.
            // EM VEZ DE RECUAR (usar carro.position), vamos tentar SALVAR o movimento (posicaoCorrigida)
            // empurrando ainda mais para longe da parede.
            
            const pushOutExtra = resultadoColisao.normal.clone().multiplyScalar(0.2);
            const posicaoTentativa2 = posicaoCorrigida.clone().add(pushOutExtra);
            
            const check2 = verificarColisao(posicaoTentativa2, carro.userData.angulo, carro);
            
            if (!check2.colidiu) {
                // Sucesso com empurrão extra
                carro.position.copy(posicaoTentativa2);
            } else {
                // Ainda colidindo. Tentar empurrão mais forte (0.5)
                posicaoTentativa2.add(resultadoColisao.normal.clone().multiplyScalar(0.3));
                const check3 = verificarColisao(posicaoTentativa2, carro.userData.angulo, carro);
                
                if(!check3.colidiu) {
                    carro.position.copy(posicaoTentativa2);
                } else {
                    // Último recurso: só empurrar para fora a partir da posição original (ficar parado mas sair da parede)
                    // Isso evita atravessar, mas causa o efeito de "travamento". É o mal menor.
                    const posicaoEmergencia = carro.position.clone().add(resultadoColisao.normal.clone().multiplyScalar(0.5));
                    carro.position.copy(posicaoEmergencia);
                    carro.userData.velocidade *= 0.1; // Matar velocidade se travou muito
                }
            }
        } else {
            carro.position.copy(posicaoCorrigida);
        }
    } else {
        carro.position.copy(novaPosicao);
    }
    
    carro.rotation.y = carro.userData.angulo;
    
    // Verificar colisão Carro vs Adversários
    for (const adv of adversarios) {
        if (verificarColisaoCarroCarro(carro, adv)) {
            // Empurrar para longe (Minimum Translation)
            const vecAfastamento = carro.position.clone().sub(adv.position);
            
            // Garantir que não seja zero
            if (vecAfastamento.lengthSq() < 0.001) {
                vecAfastamento.set(Math.random()-0.5, 0, Math.random()-0.5);
            }
            
            vecAfastamento.normalize();
            
            // Força de repulsão imediata (Teleportar levemente para fora)
            const forcaRepulsao = 1.0; 
            carro.position.add(vecAfastamento.clone().multiplyScalar(forcaRepulsao));
            adv.position.add(vecAfastamento.clone().multiplyScalar(-forcaRepulsao));
            
            // Troca elastica de momento (simples)
            const tempVel = carro.userData.velocidade;
            carro.userData.velocidade = adv.userData.velocidade * 0.8; // Perda de energia
            adv.userData.velocidade = tempVel * 0.8;
            
            // Se estiverem muito lentos, separar com força mínima
            if (Math.abs(carro.userData.velocidade) < 0.1) carro.userData.velocidade = 0.2;
            if (Math.abs(adv.userData.velocidade) < 0.1) adv.userData.velocidade = -0.2;
        }
    }

    // Verificar colisão Adversário vs Adversário
    for (let i = 0; i < adversarios.length; i++) {
        for (let j = i + 1; j < adversarios.length; j++) {
            const adv1 = adversarios[i];
            const adv2 = adversarios[j];
        
             if (verificarColisaoCarroCarro(adv1, adv2)) {
                const vecAfastamento = adv1.position.clone().sub(adv2.position);
                
                if (vecAfastamento.lengthSq() < 0.001) vecAfastamento.set(1, 0, 0);
                vecAfastamento.normalize();
                
                const forcaRepulsao = 1.0;
                adv1.position.add(vecAfastamento.clone().multiplyScalar(forcaRepulsao));
                adv2.position.add(vecAfastamento.clone().multiplyScalar(-forcaRepulsao));
                
                // Troca de velocidade
                const tempVel = adv1.userData.velocidade;
                adv1.userData.velocidade = adv2.userData.velocidade * 0.8;
                adv2.userData.velocidade = tempVel * 0.8;
             }
        }
    }

    // Verificar checkpoints
    verificarCheckpoints();
    
    // Verificar passagem pela linha de chegada
    verificarLinhaChegada();
    
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
        const cpInfo = checkpoints.length > 0 ? `CP: ${proximoCheckpoint}/${checkpoints.length}` : '';
        const municao = carro.userData.municao !== undefined ? carro.userData.municao : 4;
        const danoInfo = carro.userData.sobEfeitoDano ? '<br><span style="color:red">DANIFICADO!</span>' : '';
        
        infoDiv.innerHTML = `Velocidade: ${velocidadeKmh} km/h<br>Câmera: ${modoCamera}<br>Voltas: ${voltasCompletadas}/${TOTAL_VOLTAS}<br>Munição: ${municao}/4<br>${cpInfo}<br>Posição: X=${posX}, Y=${posY}, Z=${posZ}${danoInfo}`;
    }
}

// Verificar se o carro passou por algum checkpoint
function verificarCheckpoints() {
    if (!carro || checkpoints.length === 0 || proximoCheckpoint >= checkpoints.length) return;
    
    const cp = checkpoints[proximoCheckpoint];
    const posX = carro.position.x;
    const posZ = carro.position.z;
    
    // Verificar se está dentro da área do checkpoint (retângulo)
    const halfSizeX = cp.sizeX / 2;
    const halfSizeZ = cp.sizeZ / 2;
    
    const minX = cp.x - halfSizeX;
    const maxX = cp.x + halfSizeX;
    const minZ = cp.z - halfSizeZ;
    const maxZ = cp.z + halfSizeZ;
    
    if (posX >= minX && posX <= maxX && posZ >= minZ && posZ <= maxZ) {
        proximoCheckpoint++;
        console.log(`Checkpoint ${proximoCheckpoint} alcançado!`);
        
        // Feedback visual ou sonoro poderia ser adicionado aqui
    }
}

// Verificar se o carro passou pela linha de chegada
function verificarLinhaChegada() {
    if (!carro || !linhaChegada) return;
    
    const posX = carro.position.x;
    const posZ = carro.position.z;
    
    if (linhaChegada.eixo === 'X') {
        // Linha perpendicular ao eixo X (carro cruza movendo em X)
        // Definido por x (posição), largura (zona de detecção em X), zMin, zMax (extensão)
        
        const naFaixaZ = posZ >= linhaChegada.zMin && posZ <= linhaChegada.zMax;
        const naZonaX = Math.abs(posX - linhaChegada.x) < linhaChegada.largura;
        
        if (naFaixaZ && naZonaX) {
            // Está sobre a linha
            // Considerando movimento para X positivo
            if (!passouLinha && posX > linhaChegada.x) {
                // Só conta volta se pegou todos os checkpoints
                if (checkpoints.length === 0 || proximoCheckpoint === checkpoints.length) {
                    passouLinha = true;
                    voltasCompletadas++;
                    if (carro) carro.userData.voltas = voltasCompletadas;
                    proximoCheckpoint = 0; // Resetar checkpoints para nova volta
                    carro.userData.municao = 4; // Recarregar munição
                    
                    console.log(`Volta ${voltasCompletadas} completada!`);
                    
                    if (voltasCompletadas >= TOTAL_VOLTAS && !jogoAcabou) {
                        jogoAcabou = true;
                        console.log('🏁 Corrida finalizada! Parabéns!');
                        alert(`🏁 PARABÉNS! VOCÊ VENCEU A CORRIDA!\n\nVocê completou ${TOTAL_VOLTAS} voltas!`);
                        voltasCompletadas = 0;
                    }
                }
            }
        } else {
            // Saiu da linha, permitir nova detecção (resetar se estiver antes da linha)
            if (posX < linhaChegada.x - linhaChegada.largura) {
                passouLinha = false;
            }
        }
    } else {
        // Padrão: Linha perpendicular ao eixo Z (carro cruza movendo em Z)
        // Verificar se está na faixa X da linha
        const naFaixaX = posX >= linhaChegada.xMin && posX <= linhaChegada.xMax;
        
        // Verificar se está na zona Z da linha
        const naZonaZ = Math.abs(posZ - linhaChegada.z) < linhaChegada.largura;
        
        if (naFaixaX && naZonaZ) {
            // Está sobre a linha
            if (!passouLinha && posZ > linhaChegada.z) {
                // Passou pela linha vindo de Z negativo (completou volta)
                // Só conta volta se pegou todos os checkpoints
                if (checkpoints.length === 0 || proximoCheckpoint === checkpoints.length) {
                    passouLinha = true;
                    voltasCompletadas++;
                    if (carro) carro.userData.voltas = voltasCompletadas;
                    proximoCheckpoint = 0; // Resetar checkpoints para nova volta
                    carro.userData.municao = 4; // Recarregar munição
                    
                    console.log(`Volta ${voltasCompletadas} completada!`);
                    
                    if (voltasCompletadas >= TOTAL_VOLTAS) {
                        console.log('🏁 Corrida finalizada! Parabéns!');
                        alert(`🏁 Corrida finalizada!\n\nVocê completou ${TOTAL_VOLTAS} voltas!`);
                        // Zerar contador para permitir nova corrida
                        voltasCompletadas = 0;
                    }
                }
            }
        } else {
            // Saiu da linha, permitir nova detecção
            if (posZ < linhaChegada.z - linhaChegada.largura) {
                passouLinha = false;
            }
        }
    }
}

export function obterVelocidade() {
    return carro ? carro.userData.velocidade : 0;
}

// Sistema de colisão precisa: OBB do carro (6 x 11.5) vs AABB das muretas
function verificarColisao(posicao, angulo, objeto = carro) {
    if (!objeto || colisores.length === 0) {
        return { colidiu: false };
    }

    // Margem extra no HITBOX do carro (OBB) para colidir ANTES de tocar visualmente
    const margin = 0.2; 
    const halfW = 3.0 + margin;
    const halfL = 5.75 + margin;

    const cosA = Math.cos(angulo);
    const sinA = Math.sin(angulo);
    const fwd = new THREE.Vector3(-sinA, 0, -cosA); // Frente
    const right = new THREE.Vector3(cosA, 0, -sinA); // Direita

    const corners = [
        new THREE.Vector3().copy(posicao).addScaledVector(fwd, halfL).addScaledVector(right, halfW),
        new THREE.Vector3().copy(posicao).addScaledVector(fwd, halfL).addScaledVector(right, -halfW),
        new THREE.Vector3().copy(posicao).addScaledVector(fwd, -halfL).addScaledVector(right, -halfW),
        new THREE.Vector3().copy(posicao).addScaledVector(fwd, -halfL).addScaledVector(right, halfW)
    ];

    // INSET Negativo: Aumenta a barreira virtualmente.
    // Reduzido para -0.1 para evitar 'gap' visível demais, mas mantendo segurança
    const inset = -0.15;

    for (const colisor of colisores) {
        const minX = colisor.min.x + inset;
        const maxX = colisor.max.x - inset;
        const minZ = colisor.min.z + inset;
        const maxZ = colisor.max.z - inset;

        // Broadphase: AABB do Carro vs AABB Mureta Expandida
        let cMinX = corners[0].x, cMaxX = corners[0].x;
        let cMinZ = corners[0].z, cMaxZ = corners[0].z;
        for (let i = 1; i < 4; i++) {
            cMinX = Math.min(cMinX, corners[i].x);
            cMaxX = Math.max(cMaxX, corners[i].x);
            cMinZ = Math.min(cMinZ, corners[i].z);
            cMaxZ = Math.max(cMaxZ, corners[i].z);
        }

        if (cMaxX < minX || cMinX > maxX || cMaxZ < minZ || cMinZ > maxZ) continue;

        // Check 1: Vértices do Carro dentro da Mureta
        for (const p of corners) {
            if (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ) {
                // Se o colisor tem normal definida (Mureta), usa ela. 
                // Se não (Objeto/Prop), calcula baseada no centro do objeto.
                let normal;
                if (colisor.normal) {
                    normal = colisor.normal.clone();
                } else {
                    // Calcular centro do AABB do Colisor
                    const cx = (colisor.min.x + colisor.max.x) / 2;
                    const cz = (colisor.min.z + colisor.max.z) / 2;
                    
                    // Diferença até o carro (usamos posicao do carro ou o vértice p?)
                    // Usar o centro do carro (posicao) é mais estável para determinar o lado.
                    const dx = posicao.x - cx;
                    const dz = posicao.z - cz;
                    
                    const sizeX = (colisor.max.x - colisor.min.x) / 2;
                    const sizeZ = (colisor.max.z - colisor.min.z) / 2;
                    
                    // Descobrir qual eixo tem maior penetração relativa (closer to edge)
                    // Normal deve apontar para FORA do objeto, na direção do carro.
                    const penX = Math.abs(dx) / (sizeX || 1);
                    const penZ = Math.abs(dz) / (sizeZ || 1);
                    
                    if (penX > penZ) {
                        normal = new THREE.Vector3(Math.sign(dx) || 1, 0, 0);
                    } else {
                        normal = new THREE.Vector3(0, 0, Math.sign(dz) || 1);
                    }
                }
                
                return { colidiu: true, colisor, normal: normal };
            }
        }

        // Check 2: Vértices da Mureta dentro do Carro (OBB)
        // Isso evita que o carro "engula" uma quina de mureta lateralmente
        const wallCorners = [
            new THREE.Vector3(minX, 0, minZ),
            new THREE.Vector3(minX, 0, maxZ),
            new THREE.Vector3(maxX, 0, minZ),
            new THREE.Vector3(maxX, 0, maxZ)
        ];

        for (const wp of wallCorners) {
            const diff = new THREE.Vector3().subVectors(wp, posicao);
            const distFwd = diff.dot(fwd);
            const distRight = diff.dot(right);

            if (Math.abs(distFwd) <= halfL && Math.abs(distRight) <= halfW) {
                // Cálculo de Normal Robusto (Funciona para muretas fixas e props dinâmicos)
                let normal;
                if (colisor.normal) {
                    normal = colisor.normal.clone();
                } else {
                    // Props (Barris/Cones) - Normal baseada na direção do centro do objeto ao carro
                    const cx = (colisor.min.x + colisor.max.x) / 2;
                    const cz = (colisor.min.z + colisor.max.z) / 2;
                    
                    const dx = posicao.x - cx;
                    const dz = posicao.z - cz;
                    
                    const sizeX = (colisor.max.x - colisor.min.x) / 2;
                    const sizeZ = (colisor.max.z - colisor.min.z) / 2;
                    
                    // Compara penetração relativa para decidir face (X ou Z)
                    const penX = Math.abs(dx) / (sizeX || 1);
                    const penZ = Math.abs(dz) / (sizeZ || 1);
                    
                    if (penX > penZ) {
                        normal = new THREE.Vector3(Math.sign(dx) || 1, 0, 0);
                    } else {
                        normal = new THREE.Vector3(0, 0, Math.sign(dz) || 1);
                    }
                }
                
                return { colidiu: true, colisor, normal: normal };
            }
        }
    }

    return { colidiu: false };
}

// Sistema de deslizamento ao longo da mureta com física vetorial
function aplicarDeslizamento(posicaoAtual, posicaoDesejada, resultadoColisao, velocidade, angulo, objeto = carro) {
    const normal = resultadoColisao.normal; // Normal da mureta (Unitário)
    
    // Se o carro penetrou na parede, primeiro precisamos RECUAR a posiçãoAtual
    // para fora da parede ANTES de calcular o deslizamento.
    // O deslizamento deve ocorrer na SUPERFÍCIE, não dentro da parede.
    
    // Como verificarColisao retorna true, posicaoDesejada está inválida.
    // Mas posicaoAtual DEVERIA ser válida (frame anterior).
    // Porém, se posicaoAtual já estava levemente "dentro" devido a imprecisão numérica ou rotação
    // o carro começa a "afundar".
    
    // Vamos usar estritamente a posição atual, assumindo que sistema de colisão (insets) cuidou de não renderizar dentro.
    // Remover offsets artificiais que causam 'bounce'
    let pontoSeguro = posicaoAtual.clone();
    
    // Checagem opcional: Se posicaoAtual já está "dentro" do colisor real (não só do inset), aí sim empurramos.
    // Mas como usamos inset negativo, "dentro" da colisão ainda é "fora" do visual.
    // Então confiamos que estamos seguros.

    // Vetor Velocidade Instantânea usando velocidade atual
    const velVetor = new THREE.Vector3(
        -Math.sin(angulo),
        0,
        -Math.cos(angulo)
    ).multiplyScalar(velocidade);

    // Projetar a velocidade na parede para obter o componente paralelo (Slide)
    // V_paralelo = V - (V . N) * N
    // Onde N é a normal.
    // Se (V . N) < 0 significa que estamos indo CONTRA a parede (choque).
    // Se (V . N) > 0 estamos nos afastando.

    const dot = velVetor.dot(normal);

    // Se estamos nos afastando da parede, não faz nada (não deve ocorrer se colidiu agora)
    if (dot > 0 && false) { // Desabilitado para forçar correção de posição
       return posicaoDesejada;
    }

    // Componente perpendicular (Impacto)
    const impacto = normal.clone().multiplyScalar(dot);
    
    // Componente paralela (Deslizamento)
    const slide = velVetor.clone().sub(impacto);
    
    // A nova velocidade (magnitude) será reduzida pelo atrito da parede
    // Atrito depende do ângulo.
    // Se o ângulo de incidência for agudo (rasante), preservamos quase tudo.
    // Se for perpendicular, perdemos quase tudo.
    
    // Angulo de incidência: 0 = perpendicular, 90 = paralelo.
    // dot product (v . n) = |v|*|n|*cos(theta). Theta é angulo entre v e n.
    // Se theta ~ 180 (oposto), colisão frontal.
    // Se theta ~ 90 (perpendicular), colisão rasante.
    
    // Vamos usar a magnitude do 'slide' vs magnitude original 'velVetor'
    // Slide já contém a projeção geométrica correta (v * sen(theta)).
    
    // Ajuste de Atrito Dinâmico:
    // Paredes não são gelo. Adicionamos fricção base constante + fricção por pressão.
    
    // REDUZIR atrito significativamente para permitir deslizar
    // Antes era 0.98, vamos tentar 1.0 (sem perda extra além da geometria) para testar o "colar e andar"
    const baseFriction = 1.0; 
    slide.multiplyScalar(baseFriction);

    // CRÍTICO: Recalcular a velocidade escalar baseada na nova direção
    // Se o vetor slide é pequeno, a velocidade escalar deve cair.
    // Se é grande (paralelo), mantém.
    
    // A direção do carro (frente) não muda instantaneamente na física simples, 
    // mas a velocidade 'userData.velocidade' é escalar e move o carro na direção que ele APONTA.
    
    // Isso é um problema: O carro aponta para a parede, mas move p/ lado?
    // Se movemos p/ lado, estamos 'drifting' ou o carro deve girar?
    // Neste modelo simples, o carro continua apontando para a parede até o jogador virar.
    // Portanto, a 'velocidade' que o controla (frente) deve ser reduzida para impedir que ele
    // continue tentando entrar na parede com força total.
    
    // Modificando a lógica de redução de velocidade para ser GRADATIVA.
    // Usar a projeção geométrica direta (projFwd) causa perda exponencial de velocidade a cada frame
    // se o carro continuar apontando para a parede (o que ocorre se o jogador não virar).
    
    // Calcula o quão "de frente" foi a colisão.
    // dot é v . n. 
    // ratio = dot / velocidade. 
    // Se ratio ~ 0 (Paralelo/Rasante) -> Perda Mínima.
    // Se ratio ~ -1 (Perpendicular/Frontal) -> Perda Máxima.
    
    const ratio = (velocidade > 0.001) ? (dot / velocidade) : 0;
    
    // Fator de Colisão (0 a 1)
    // 0 = Rasante, 1 = Frontal
    const impactFactor = Math.min(1.0, Math.abs(ratio));
    
    // Definir perda de velocidade baseada no ângulo
    // Se frontal (1.0), queremos parar rápido (mas não travar instantly se for glacing).
    // O usuário pede: "Se 90 graus (frontal no código dele 180?), redução maior. Se 180 (frontal?), sem movimento."
    // Interpretando:
    // Paralelo (impactFactor 0) -> Velocidade mantém (ou quase).
    // 45 graus (impactFactor 0.707) -> Velocidade reduz "gradativamente", não instantaneamente para 4km/h.
    // Frontal (impactFactor 1) -> Stop.

    // Drag Coeff por frame.
    // Se impactFactor = 0, drag = 0.
    // Se impactFactor = 0.7, drag = baixo (ex: 0.05 ou 5% por frame).
    // Se impactFactor = 1.0, drag = alto (ex: 1.0 ou 100% instantaneo).
    
    let drag = 0;
    if (impactFactor < 0.2) {
        drag = 0; // "Não haverá retardo" para ângulos rasantes
    } else if (impactFactor > 0.95) {
        drag = 1.0; // "Trava" se for colisão frontal
    } else {
        // Redução suave mas perceptível para superar a aceleração do motor caso pressionado.
        // Motor acelera 0.015 por frame.
        // Precisamos que o drag seja maior que 0.015*VelRelativa se quisermos frear.
        
        // Em 45 graus (0.7), vamos definir um drag que vença o motor levemente.
        // 0.02 (2% por frame) em 45 graus.
        drag = impactFactor * 0.03; 
    }
    
    // Aplicar redução à velocidade escalar (Energia do sistema)
    let novaVelocidade = velocidade * (1.0 - drag);
    
    // Atualizar velocidade no objeto
    objeto.userData.velocidade = Math.max(0, novaVelocidade);
    
    // CORREÇÃO DE POSIÇÃO (Push out)
    // O usuário solicitou explicitamente ZERO EMPURRÃO.
    // O carro deve "colar". 
    // Como estamos usando pontoSeguro = posicaoAtual, e slide é tangente, o carro permanece na tangente.
    const pushOut = new THREE.Vector3(0,0,0); 
    
    // A nova posição é: Onde estava + Slide (Geometria correta de deslizamento)
    const novaPos = pontoSeguro.clone().add(pushOut).add(slide);

    return novaPos;
}

// === Lógica do Adversário e Combate ===

function atualizarAdversarios() {
    if (adversarios.length === 0 || waypoints.length === 0) return;

    adversarios.forEach(adversario => {
        // 1. Navegação (Waypoint Following)
        const target = waypoints[adversario.userData.waypointIndex];
        const pos = adversario.position;
        
        // Vetor para o alvo
        let dx = target.x - pos.x;
        let dz = target.z - pos.z;
        
        // Distância real ao alvo (para troca de waypoint)
        const realDist = Math.sqrt(dx*dx + dz*dz);

        // Verificar se chegou no waypoint (Raio reduzido para 10 para evitar cortar curvas)
        if (realDist < 10) { 
            adversario.userData.waypointIndex = (adversario.userData.waypointIndex + 1) % waypoints.length;
            // Recalcular alvo imediatamente
            const newTarget = waypoints[adversario.userData.waypointIndex];
            dx = newTarget.x - pos.x;
            dz = newTarget.z - pos.z;
        }

        // --- DESVIO DE OBSTÁCULOS ESTÁTICOS (Cones, Barris) ---
        // Adicionado: Visão antecipada para evitar colisão
        for (const col of colisores) {
            // Ignorar Muretas (que possuem normal definida) na detecção de "desvio"
            // Deixar a inteligência de parede (raycast) ou física cuidar das paredes
            // Aqui focamos apenas em objetos pontuais (Barris e Cones)
            if (col.normal) continue;

            // Centro e tamanho estimado
            const cx = (col.min.x + col.max.x) / 2;
            const cz = (col.min.z + col.max.z) / 2;
            const sizeX = (col.max.x - col.min.x);
            const sizeZ = (col.max.z - col.min.z);
            
            // Distância ao quadrado para checagem rápida
            // Distância de detecção aumentada para 35 (visão de longo alcance)
            const distSq = (pos.x - cx)**2 + (pos.z - cz)**2;
            
            if (distSq < 35 * 35) {
                const vecToObs = new THREE.Vector3(cx - pos.x, 0, cz - pos.z);
                const direcaoAtual = new THREE.Vector3(
                    -Math.sin(adversario.userData.angulo),
                    0,
                    -Math.cos(adversario.userData.angulo)
                );
                
                vecToObs.normalize();
                const dot = direcaoAtual.dot(vecToObs);
                
                // Se está na frente (Cone de visão de 120 graus -> dot > 0.5)
                if (dot > 0.5) {
                    const right = new THREE.Vector3(0, 1, 0).cross(direcaoAtual);
                    const vecToObsReal = new THREE.Vector3(cx - pos.x, 0, cz - pos.z).normalize();
                    const sideDot = right.dot(vecToObsReal);
                    
                    const dist = Math.sqrt(distSq);
                    // Força muito maior para objetos estáticos (paredes e props)
                    // Repulsão aumenta drasticamente quando chega perto
                    const repulsionForce = 200 * (1.0 - Math.min(dist / 35, 1));
                    
                    if (sideDot > 0) {
                        dx -= right.x * repulsionForce;
                        dz -= right.z * repulsionForce;
                    } else {
                        dx += right.x * repulsionForce;
                        dz += right.z * repulsionForce;
                    }
                }
            }
        }

        // --- DESVIO DO JOGADOR E OUTROS ADVERSÁRIOS ---
        const obstacleList = [];
        if (carro) obstacleList.push(carro);
        obstacleList.push(...adversarios.filter(a => a !== adversario));

        for (const obs of obstacleList) {
            const distToObs = pos.distanceTo(obs.position);
            if (distToObs < 15) { // Só desvia se estiver MUITO perto
                const vecToObs = new THREE.Vector3().subVectors(obs.position, pos);
                const direcaoAtual = new THREE.Vector3(
                    -Math.sin(adversario.userData.angulo),
                    0,
                    -Math.cos(adversario.userData.angulo)
                );
                
                vecToObs.normalize();
                const dot = direcaoAtual.dot(vecToObs);
                
                if (dot > 0.7) { // Obstáculo na frente
                    const right = new THREE.Vector3(0, 1, 0).cross(direcaoAtual);
                    const vecToObsNorm = new THREE.Vector3().subVectors(obs.position, pos).normalize();
                    const sideDot = right.dot(vecToObsNorm);
                    
                    const repulsionForce = 80;
                    
                    if (sideDot > 0) {
                        dx -= right.x * repulsionForce;
                        dz -= right.z * repulsionForce;
                    } else {
                        dx += right.x * repulsionForce;
                        dz += right.z * repulsionForce;
                    }
                }
            }
        }

        // Ângulo desejado
        const anguloDesejado = Math.atan2(dx, dz) + Math.PI;
        
        // Suavizar rotação (Steering)
        let diffAngulo = anguloDesejado - adversario.userData.angulo;
        
        // Normalizar diferença para -PI a PI
        while (diffAngulo > Math.PI) diffAngulo -= 2 * Math.PI;
        while (diffAngulo < -Math.PI) diffAngulo += 2 * Math.PI;
        
        // 2. Controle de Velocidade em Curvas (Cornering)
        let velMaxAdv = VELOCIDADE_MAX * 0.95;
        
        // Se a curva for fechada (> 20 graus), reduzir velocidade
        if (Math.abs(diffAngulo) > 0.35) {
            velMaxAdv *= 0.3; // Reduzir mais agressivamente para 30%
        } else if (Math.abs(diffAngulo) > 0.15) {
            velMaxAdv *= 0.6; // Reduzir para 60%
        }

        // 3. Recuperação de Travamento (Stuck Recovery)
        // Aumentado a sensibilidade: Se velocidade for muito baixa por pouco tempo
        const isStuck = Math.abs(adversario.userData.velocidade) < 0.3; // Aumentado limite de 0.1 para 0.3
        
        if (isStuck) {
            if (!adversario.userData.stuckTime) adversario.userData.stuckTime = Date.now();
            
            // Reduzido tempo de espera de 2000ms para 800ms para sair mais rápido
            if (Date.now() - adversario.userData.stuckTime > 800) { 
                // Travado -> Iniciar Ré
                adversario.userData.isReversing = true;
                adversario.userData.reverseTime = Date.now();
                adversario.userData.stuckTime = null;
                // Inverter direção de giro da ré aleatoriamente para evitar loop
                adversario.userData.reverseDir = Math.random() > 0.5 ? 1 : -1;
            }
        } else {
            adversario.userData.stuckTime = null;
        }

        // Lógica de Ré
        if (adversario.userData.isReversing) {
            // Tempo de ré aumentado levemente para garantir que desencoste
            if (Date.now() - adversario.userData.reverseTime > 1200) {
                adversario.userData.isReversing = false;
            }
            
            // Aplicar Ré
            adversario.userData.velocidade = -VELOCIDADE_RE_MAX;
            // Girar para tentar sair (usando direção aleatória definida acima)
            const dir = adversario.userData.reverseDir || 1;
            adversario.userData.angulo += 0.08 * dir;
            
            // Atualizar posição (Ré)
            const direcao = new THREE.Vector3(
                -Math.sin(adversario.userData.angulo),
                0,
                -Math.cos(adversario.userData.angulo)
            );
            const novaPosicao = adversario.position.clone().add(
                direcao.clone().multiplyScalar(adversario.userData.velocidade)
            );
            
            // Verificar colisão na ré (Importante: Se bater na ré, para a ré e tenta ir pra frente)
            const resultadoColisaoAdv = verificarColisao(novaPosicao, adversario.userData.angulo, adversario);
            if (!resultadoColisaoAdv.colidiu) {
                adversario.position.copy(novaPosicao);
            } else {
                 // Se bateu na ré, tenta ir pra frente logo
                 adversario.userData.isReversing = false;
            }
            adversario.rotation.y = adversario.userData.angulo;
            return; // Continue
        }

        // Aplicar rotação limitada
        const maxRot = 0.08;
        if (Math.abs(diffAngulo) > maxRot) {
            adversario.userData.angulo += Math.sign(diffAngulo) * maxRot;
        } else {
            adversario.userData.angulo = anguloDesejado;
        }
        
        // Acelerar
        // Verificar dano no adversário
        if (adversario.userData.sobEfeitoDano) {
            if (Date.now() - adversario.userData.tempoDano > 3000) {
                adversario.userData.sobEfeitoDano = false;
            } else {
                velMaxAdv *= 0.3;
            }
        }
        
        if (adversario.userData.velocidade < velMaxAdv) {
            adversario.userData.velocidade += ACELERACAO;
        } else if (adversario.userData.velocidade > velMaxAdv) {
            adversario.userData.velocidade -= ACELERACAO;
        }
        
        // Mover adversário
        const direcao = new THREE.Vector3(
            -Math.sin(adversario.userData.angulo),
            0,
            -Math.cos(adversario.userData.angulo)
        );
        
        const novaPosicao = adversario.position.clone().add(
            direcao.clone().multiplyScalar(adversario.userData.velocidade)
        );

        // === FÍSICA DE SALTO E BURACO (ADVERSÁRIOS) ===
        // 1. Verificar Queda
        let caindoNoBuraco = false;
        if (buracoPista3 && !adversario.userData.voando) {
            const x = novaPosicao.x;
            const z = novaPosicao.z;
            if (x >= buracoPista3.xMin && x <= buracoPista3.xMax &&
                z >= buracoPista3.zMin && z <= buracoPista3.zMax) {
                caindoNoBuraco = true;
            }
        }

        if (caindoNoBuraco || adversario.userData.caindo || adversario.position.y < -1.0) {
            adversario.userData.caindo = true;
            adversario.position.y -= 0.8;
            adversario.rotation.x -= 0.05;
            adversario.position.add(direcao.multiplyScalar(adversario.userData.velocidade));
            
            if (adversario.position.y < -30) {
                // Respawn Bot no waypoint atual
                adversario.userData.caindo = false;
                adversario.userData.velocidade = 0;
                adversario.rotation.set(0,0,0);
                const wp = waypoints[adversario.userData.waypointIndex];
                if(wp) {
                    adversario.position.set(wp.x, 0.5, wp.z);
                    // Orientar para o próximo
                    const nextWp = waypoints[(adversario.userData.waypointIndex + 1) % waypoints.length];
                    adversario.userData.angulo = Math.atan2(nextWp.x - wp.x, nextWp.z - wp.z) + Math.PI;
                }
            }
            return; // Pula resto do loop de movimento
        }

        // 2. Verificar Salto (Mesma física do Player)
        if (rampasPista3) {
            if (adversario.userData.voando) {
                if (!adversario.userData.vooTempo) adversario.userData.vooTempo = 0;
                adversario.userData.vooTempo += 1/60;
                const t = adversario.userData.vooTempo;
                
                const H_MAX = 50.0;
                const TEMPO_VOO = 1.2;
                const vy0 = (4 * H_MAX) / TEMPO_VOO;
                const gravidade = (8 * H_MAX) / (TEMPO_VOO * TEMPO_VOO);
                
                const h = 0.5 + (vy0 * t) - (0.5 * gravidade * t * t);
                
                if (h <= 0.02) {
                    adversario.userData.voando = false;
                    adversario.position.y = 0.02;
                    adversario.rotation.x = 0;
                } else {
                    adversario.position.y = h;
                    novaPosicao.y = h;
                    // Ignorar colisões enquanto voa
                }
            } else {
                for(const rampa of rampasPista3) {
                    const dx = adversario.position.x - rampa.x;
                    const dz = adversario.position.z - rampa.z;
                    // Área de ativação
                    if (Math.abs(dx) < 5 && Math.abs(dz) < 20) {
                        if (Math.abs(adversario.userData.velocidade) > 1.0) {
                            if ((rampa.direction === -1 && direcao.x < -0.5) ||
                                (rampa.direction === 1 && direcao.x > 0.5)) {
                                    adversario.userData.voando = true;
                                    adversario.userData.vooTempo = 0;
                                    adversario.userData.velocidadeSalto = adversario.userData.velocidade;
                            }
                        }
                    }
                }
            }
        }

        // Colisão Adversário vs Muretas (SE NÃO ESTIVER VOANDO)
        if (!adversario.userData.voando) {
            const resultadoColisaoAdv = verificarColisao(novaPosicao, adversario.userData.angulo, adversario);
            
            if (resultadoColisaoAdv.colidiu) {
                // Aplicar deslizamento
                const posicaoCorrigida = aplicarDeslizamento(
                    adversario.position,
                    novaPosicao,
                    resultadoColisaoAdv,
                    adversario.userData.velocidade,
                    adversario.userData.angulo,
                    adversario
                );
                
                // Verificação dupla
                const verificacaoFinal = verificarColisao(posicaoCorrigida, adversario.userData.angulo, adversario);
                if (verificacaoFinal.colidiu) {
                    adversario.userData.velocidade = 0;
                } else {
                    adversario.position.copy(posicaoCorrigida);
                }
            } else {
                adversario.position.copy(novaPosicao);
            }
        } else {
            // Se voando, apenas atualizar posição
            adversario.position.copy(novaPosicao);
        }

        adversario.rotation.y = adversario.userData.angulo;
        
        // Verificar se chegou no waypoint
        if (realDist < 20) { 
            adversario.userData.waypointIndex = (adversario.userData.waypointIndex + 1) % waypoints.length;
        }
        
        // 2. Combate (All against All)
        if (adversario.userData.municao > 0) {
            let potentialTargets = [];
            if (carro) potentialTargets.push(carro);
            // Adicionar outros adversários
            potentialTargets.push(...adversarios.filter(a => a !== adversario));

            // Find best target (closest and in front)
            let bestTarget = null;
            let minDist = 100; // Max shooting range

            for(const targetObj of potentialTargets) {
                const vecToTarget = new THREE.Vector3().subVectors(targetObj.position, adversario.position);
                const dist = vecToTarget.length();
                if(dist < minDist) {
                    vecToTarget.normalize();
                    const dot = direcao.dot(vecToTarget);
                    if(dot > 0.95) { // Cone de visão estreito
                         bestTarget = targetObj;
                         minDist = dist;
                    }
                }
            }

            if (bestTarget) {
                const agora = Date.now();
                if (!adversario.userData.ultimoDisparo || agora - adversario.userData.ultimoDisparo > 1000) {
                    atirar(adversario.position, direcao, 'adversario');
                    adversario.userData.municao--;
                    adversario.userData.ultimoDisparo = agora;
                }
            }
        }
        
        // 3. Verificar Progresso do Adversário
        verificarProgressoAdversario(adversario);
    });
}

function verificarProgressoAdversario(adversario) {
    if (!adversario || checkpoints.length === 0) return;
    
    // Checkpoints
    const cp = checkpoints[adversario.userData.proximoCheckpoint];
    if (cp) {
        const dx = Math.abs(adversario.position.x - cp.x);
        const dz = Math.abs(adversario.position.z - cp.z);
        if (dx < cp.sizeX/2 && dz < cp.sizeZ/2) {
            adversario.userData.proximoCheckpoint++;
        }
    }
    
    // Linha de Chegada
    if (linhaChegada && adversario.userData.proximoCheckpoint >= checkpoints.length) {
        let cruzou = false;
        if (linhaChegada.eixo === 'X') {
            if (Math.abs(adversario.position.x - linhaChegada.x) < linhaChegada.largura &&
                adversario.position.z >= linhaChegada.zMin && adversario.position.z <= linhaChegada.zMax) {
                cruzou = true;
            }
        } else {
            if (Math.abs(adversario.position.z - linhaChegada.z) < linhaChegada.largura &&
                adversario.position.x >= linhaChegada.xMin && adversario.position.x <= linhaChegada.xMax) {
                cruzou = true;
            }
        }
        
        if (cruzou) {
            adversario.userData.voltas++;
            adversario.userData.proximoCheckpoint = 0;
            adversario.userData.municao = 4; // Recarregar munição
            console.log(`Adversário completou volta ${adversario.userData.voltas}`);
            
            if (adversario.userData.voltas >= TOTAL_VOLTAS && !jogoAcabou) {
                jogoAcabou = true;
                const nomeVencedor = adversario.userData.nome || `Adversário ${adversario.userData.id + 1}`;
                vencedor = nomeVencedor;
                alert(`Fim de jogo! O vencedor foi: ${nomeVencedor}`);
            }
        }
    }
}

// Variáveis de áudio
let listener = null;
let somTiro = null;
let somImpacto = null;

export function configurarAudioTiro(camera) {
    listener = new THREE.AudioListener();
    camera.add(listener);

    const audioLoader = new THREE.AudioLoader();
    
    // Carregar som de tiro
    somTiro = new THREE.Audio(listener);
    audioLoader.load('assets%20baixados/sci-fi-laser-gun-shot-sound-effect.mp3', function(buffer) {
        somTiro.setBuffer(buffer);
        somTiro.setLoop(false);
        somTiro.setVolume(0.5);
    });
    
    // Carregar som de impacto
    somImpacto = new THREE.Audio(listener);
     audioLoader.load('assets%20baixados/laser impacto.mp3', function(buffer) {
        somImpacto.setBuffer(buffer);
        somImpacto.setLoop(false);
        somImpacto.setVolume(0.8);
    });
}

export function atirarDoJogador() {
    if (!carro || carro.userData.municao <= 0) return;
    
    const direcao = new THREE.Vector3(
        -Math.sin(carro.userData.angulo),
        0,
        -Math.cos(carro.userData.angulo)
    );
    
    atirar(carro.position, direcao, 'jogador');
    carro.userData.municao--;
}

function atirar(origem, direcao, dono) {
    if (!cenaRef) return;
    
    // Tocar som de tiro para qualquer um que atirar
    if (somTiro && somTiro.buffer) {
        if (somTiro.isPlaying) somTiro.stop();
        somTiro.play();
    }
    
    const geometria = new THREE.SphereGeometry(1, 8, 8);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xff0000, 
        emissive: 0xff0000,
        shininess: 100
    });
    
    const tiro = new THREE.Mesh(geometria, material);
    tiro.position.copy(origem);
    tiro.position.y = 1.5; // Altura do tiro
    
    // Avançar um pouco para não colidir com quem atirou
    tiro.position.add(direcao.clone().multiplyScalar(5));
    
    cenaRef.add(tiro);
    
    tiros.push({
        mesh: tiro,
        direcao: direcao.clone(),
        dono: dono,
        tempoCriacao: Date.now()
    });
}

function atualizarTiros() {
    const velocidadeTiro = 4.0;
    
    for (let i = tiros.length - 1; i >= 0; i--) {
        const tiro = tiros[i];
        
        // Mover
        tiro.mesh.position.add(tiro.direcao.clone().multiplyScalar(velocidadeTiro));
        
        // Remover se muito longe ou velho
        if (Date.now() - tiro.tempoCriacao > 5000) {
            cenaRef.remove(tiro.mesh);
            tiros.splice(i, 1);
            continue;
        }
        
        // Colisão com Muretas
        let colidiuMureta = false;
        for (let colisor of colisores) {
            if (tiro.mesh.position.x > colisor.min.x && tiro.mesh.position.x < colisor.max.x &&
                tiro.mesh.position.z > colisor.min.z && tiro.mesh.position.z < colisor.max.z) {
                colidiuMureta = true;
                break;
            }
        }
        
        if (colidiuMureta) {
            cenaRef.remove(tiro.mesh);
            tiros.splice(i, 1);
            continue;
        }
        
        // Colisão com Carros
        let atingiu = false;
        
        // 1. Tiro acerta o Jogador?
        if (tiro.dono !== 'jogador' && carro) {
            const dist = tiro.mesh.position.distanceTo(carro.position);
            if (dist < 4) { // Hitbox um pouco maior
                atingiu = true;
                carro.userData.velocidade *= 0.3;
                carro.userData.sobEfeitoDano = true;
                carro.userData.tempoDano = Date.now();
                console.log('Jogador atingido!');
                
                // Tocar som de impacto
                if (somImpacto && somImpacto.buffer) {
                    if (somImpacto.isPlaying) somImpacto.stop();
                    somImpacto.play();
                }
            }
        }

        // 2. Tiro acerta algum adversário?
        if (!atingiu && adversarios.length > 0) {
            for (const adv of adversarios) {
                // Verificar distância
                const dist = tiro.mesh.position.distanceTo(adv.position);
                if (dist < 4) {
                    atingiu = true;
                    adv.userData.velocidade *= 0.3;
                    adv.userData.sobEfeitoDano = true;
                    adv.userData.tempoDano = Date.now();
                    console.log('Adversário atingido!');
                    
                    // Opcional: Tocar som de impacto também (mais baixo se longe?)
                    if (somImpacto && somImpacto.buffer) {
                        if (somImpacto.isPlaying) somImpacto.stop();
                         somImpacto.play();
                    }
                    break;
                }
            }
        }
        
        if (atingiu) {
            cenaRef.remove(tiro.mesh);
            tiros.splice(i, 1);
        }
    }
}

// Colisão mais precisa usando 2 esferas por carro (Multi-sphere)
// Aproxima o formato retangular (2:1) muito melhor que uma única esfera
function verificarColisaoCarroCarro(c1, c2) {
    if (!c1 || !c2) return false;
    
    // Configuração das esferas (baseado no Carro.js: width=6, length=11.5)
    // Usaremos 2 esferas de raio 3.0, separadas por 5.5 unidades
    const raio = 2.8; // Ligeiramente menor que 3.0 para permitir contatos próximos
    const offset = 2.5; // Do centro para frente/trás
    
    // Direção dos carros
    const getPosEsferas = (obj) => {
        const ang = obj.userData.angulo || 0;
        const pos = obj.position;
        // Vetor frente: -sin(a), 0, -cos(a)
        const dx = -Math.sin(ang) * offset;
        const dz = -Math.cos(ang) * offset;
        
        return [
            { x: pos.x + dx, z: pos.z + dz }, // Frente
            { x: pos.x - dx, z: pos.z - dz }  // Trás
        ];
    };
    
    const esferas1 = getPosEsferas(c1);
    const esferas2 = getPosEsferas(c2);
    
    const distMinSq = (raio * 2) ** 2; // (R1 + R2)^2
    
    // Verificar 2x2 = 4 pares
    for (let p1 of esferas1) {
        for (let p2 of esferas2) {
            const dx = p1.x - p2.x;
            const dz = p1.z - p2.z;
            if (dx*dx + dz*dz < distMinSq) {
                return true;
            }
        }
    }
    return false;
}
