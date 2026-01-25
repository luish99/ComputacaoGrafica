import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// --- Texturas ---
const textureLoader = new THREE.TextureLoader();

// Textura do Player (Camuflagem Azul)
// Atualizando para garantir recarregamento dos novos assets
const texPlayer = textureLoader.load('assets%20baixados/camuflagem%20azul.png');
texPlayer.wrapS = THREE.RepeatWrapping;
texPlayer.wrapT = THREE.RepeatWrapping;
// Padrão ainda maior (menos repetição) e mantendo proporção 1:2
texPlayer.repeat.set(0.5, 1.0); 
texPlayer.anisotropy = 16; 

// Texturas dos Adversários (Camuflagens Vermelha, Verde, Roxa)
// Arquivos atualizados pelo usuário
const texAdversarios = [
    textureLoader.load('assets%20baixados/camuflagem%20vermelha.png'), // Vermelho (Index 0)
    textureLoader.load('assets%20baixados/camuflagem%20verde.png'), // Verde (Index 1)
    textureLoader.load('assets%20baixados/camuflagem%20roxa.png') // Roxo (Index 2)
];

// Configurar repetição para adversários - Padrão maior
texAdversarios.forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.5, 1.0); // Padrão 2x maior que o anterior
    tex.anisotropy = 16;
});

// Textura de borracha/escuro
const rubberTexture = textureLoader.load('../assets/textures/darkcement.jpg');
rubberTexture.wrapS = THREE.RepeatWrapping;
rubberTexture.wrapT = THREE.RepeatWrapping;
rubberTexture.repeat.set(2, 2);

// Textura da Cabine Metálica
const texCabine = textureLoader.load('assets%20baixados/metal.png');
texCabine.wrapS = THREE.RepeatWrapping;
texCabine.wrapT = THREE.RepeatWrapping;
texCabine.repeat.set(1, 1);

// --- Função para criar a forma do chassi (Meio círculo na frente) ---
function createHullShape(width, length, rearRadius) {
    const shape = new THREE.Shape();
    const r = width / 2; // Raio da frente (meio círculo)
    // Comprimento da parte reta
    const straightLen = length - r; 

    // Vamos desenhar centralizado no eixo Y do Shape (que será -Z no mundo)
    // Frente = +Y no Shape -> -Z no Mundo
    // Trás = -Y no Shape -> +Z no Mundo
    
    // Começa na direita, logo antes do arco frontal
    shape.moveTo(r, straightLen / 2);

    // Arco Frontal (Semicírculo perfeito)
    // Centro (0, straightLen/2), Raio r, de 0 a PI (sentido anti-horário)
    shape.absarc(0, straightLen / 2, r, 0, Math.PI, false);

    // Linha descendo esquerda
    shape.lineTo(-r, -straightLen / 2 + rearRadius);

    // Canto Traseiro Esquerdo (Arredondado pequeno)
    shape.absarc(-r + rearRadius, -straightLen / 2 + rearRadius, rearRadius, Math.PI, 1.5 * Math.PI, false);

    // Linha do fundo
    shape.lineTo(r - rearRadius, -straightLen / 2);

    // Canto Traseiro Direito
    shape.absarc(r - rearRadius, -straightLen / 2 + rearRadius, rearRadius, 1.5 * Math.PI, 0, false);

    // Fecha forma
    shape.lineTo(r, straightLen / 2);

    return shape;
}

export function criarCarro(cena) {
    let carro = new THREE.Group();
    
    // Inicializar dados de física do carro
    carro.userData = {
        velocidade: 0,
        anguloRodas: 0,
        angulo: Math.PI, // Começar apontando para Z positivo
        rodas: [],
        colidindoAntes: false,
        municao: 4,
        sobEfeitoDano: false,
        tempoDano: 0
    };

    // --- Materiais ---
    const mainMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, roughness: 0.5, metalness: 0.2, map: texPlayer 
    });
    // Material exclusivo para cabine
    const cabinMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, roughness: 0.3, metalness: 0.8, map: texCabine 
    });

    const darkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, roughness: 0.7, metalness: 0.1, map: rubberTexture 
    });
    const skirtMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, roughness: 0.9, metalness: 0.0, map: rubberTexture
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111, roughness: 0.1, metalness: 0.9,
        transparent: true, opacity: 0.7
    });

    // 1. A Saia (Skirt) - Base inflável
    const skirtWidth = 6.0;
    const skirtLength = 11.5;
    const skirtHeight = 1.2;
    
    const skirtShape = createHullShape(skirtWidth, skirtLength, 0.5);
    const skirtExtrudeSettings = {
        steps: 1,
        depth: skirtHeight,
        bevelEnabled: true,
        bevelThickness: 0.3,
        bevelSize: 0.3,
        bevelSegments: 5
    };
    const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, skirtExtrudeSettings);
    // Centralizar a geometria extrudada é um pouco manual, vamos ajustar o mesh
    const skirt = new THREE.Mesh(skirtGeo, skirtMaterial);
    
    // Rotacionar para ficar deitado (-90 no X) e inverter Y/Z
    // Extrude cria no eixo Z. Ao rodar -90 X, o Z vira Y (altura).
    // O Y do shape (Frente) vira -Z.
    skirt.rotation.x = -Math.PI / 2;
    // Ajuste fino de posição vertical
    skirt.position.y = 0; 
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    carro.add(skirt);

    // 2. O Chassi (Deck) - Mesma forma, menor
    const deckWidth = 5.0;
    const deckLength = 10.5;
    const deckHeight = 0.6;
    
    const deckShape = createHullShape(deckWidth, deckLength, 0.2);
    const deckExtrudeSettings = {
        steps: 1,
        depth: deckHeight,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 3
    };
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, deckExtrudeSettings);
    const deck = new THREE.Mesh(deckGeo, mainMaterial);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = skirtHeight - 0.2; // Em cima da saia
    deck.castShadow = true;
    deck.receiveShadow = true;
    carro.add(deck);

    // 3. Sponsons Laterais (Paredes do deck)
    const straightPartLen = deckLength - (deckWidth/2);
    const sideWidth = 0.6;
    const sideHeight = 0.8;
    const sideGeo = new RoundedBoxGeometry(sideWidth, sideHeight, straightPartLen, 4, 0.1);
    
    // Material azul escuro para detalhes laterais
    const sideMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x000088, roughness: 0.7, metalness: 0.3 
    });

    const leftSide = new THREE.Mesh(sideGeo, sideMaterial);
    leftSide.position.set(-(deckWidth/2 - sideWidth/2), deck.position.y + deckHeight + sideHeight/2 - 0.2, 0); 
    
    leftSide.castShadow = true;
    carro.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo, sideMaterial);
    rightSide.position.set((deckWidth/2 - sideWidth/2), deck.position.y + deckHeight + sideHeight/2 - 0.2, 0);
    rightSide.castShadow = true;
    carro.add(rightSide);

    // 4. Cabine
    const cabinGroup = new THREE.Group();
    const cabinWidth = 3.2;
    // Cabine deve ficar na frente, perto do arco
    const cabinGeo = new RoundedBoxGeometry(cabinWidth, 1.6, 2.5, 4, 0.2);
    // Usando material específico da cabine
    const cabin = new THREE.Mesh(cabinGeo, cabinMaterial);
    
    // Posicionar mais à frente.
    // Frente do shape começa em -Z = straightLen/2. O arco vai além.
    // straightLen ~ 8.0 (10.5 - 2.5). Metade = 4.0.
    // Então o arco começa em Z = -4.0.
    cabin.position.set(0, deck.position.y + deckHeight + 0.8, -3.5); 
    cabin.castShadow = true;
    cabinGroup.add(cabin);

    // Janela (REMOVIDO)
    // Vidros Laterais (REMOVIDO)
    
    carro.add(cabinGroup);

    // 5. Propulsão (Traseira)
    const fanGroup = new THREE.Group();
    // Traseira é Z positivo. Fim da parte reta é Z = +4.0 (aprox).
    fanGroup.position.set(0, deck.position.y + deckHeight + 1.8, 3.5);

    // Duto
    const ductRadius = 2.4;
    const ductLen = 1.0;
    const ductGeo = new THREE.CylinderGeometry(ductRadius, ductRadius, ductLen, 48, 1, true);
    const ductMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, side: THREE.DoubleSide });
    const duct = new THREE.Mesh(ductGeo, ductMat);
    duct.rotation.x = Math.PI / 2;
    duct.castShadow = true;
    duct.receiveShadow = true;
    fanGroup.add(duct);

    // Borda do Duto
    const rimGeo = new THREE.TorusGeometry(ductRadius, 0.15, 16, 64);
    // Usar material azul escuro (sideMaterial)
    const rim = new THREE.Mesh(rimGeo, sideMaterial);
    rim.position.z = ductLen/2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    fanGroup.add(rim);
    const rim2 = rim.clone();
    rim2.position.z = -ductLen/2;
    fanGroup.add(rim2);

    // Hélice
    const propGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.3, 4.4, 0.05);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for(let i=0; i<4; i++){
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.z = i * Math.PI/2;
        blade.castShadow = true;
        blade.receiveShadow = true;
        propGroup.add(blade);
    }
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 16), darkMaterial);
    spinner.rotation.x = Math.PI/2;
    spinner.position.z = 0.1;
    spinner.castShadow = true;
    spinner.receiveShadow = true;
    propGroup.add(spinner);
    fanGroup.add(propGroup);

    // Suportes / Lemes
    const rudderGeo = new THREE.BoxGeometry(0.1, 4.0, 1.0);
    const r1 = new THREE.Mesh(rudderGeo, mainMaterial); r1.position.x = -1.2; r1.position.z = 1.0; r1.castShadow = true; r1.receiveShadow = true;
    const r2 = new THREE.Mesh(rudderGeo, mainMaterial); r2.position.x = 0; r2.position.z = 1.0; r2.castShadow = true; r2.receiveShadow = true;
    const r3 = new THREE.Mesh(rudderGeo, mainMaterial); r3.position.x = 1.2; r3.position.z = 1.0; r3.castShadow = true; r3.receiveShadow = true;
    fanGroup.add(r1); fanGroup.add(r2); fanGroup.add(r3);

    // Base do motor
    const engineBase = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), mainMaterial);
    engineBase.position.y = -2.0;
    engineBase.castShadow = true;
    engineBase.receiveShadow = true;
    fanGroup.add(engineBase);

    carro.add(fanGroup);
    
    // Add reference for animation if needed
    carro.userData.propGroup = propGroup;

    // Adicionar carro à cena
    cena.add(carro);
    
    // Posição inicial do carro: x=150, y=0.5, z=0
    // Frente apontando para Z positivo (ângulo = π)
    carro.position.set(150, 0.5, 0);
    carro.rotation.y = Math.PI; // 180 graus para apontar para Z positivo
    carro.userData.angulo = Math.PI; // Sincronizar com física

    return carro;
}

export function criarCarroAdversario(cena, corPrincipal = 0x000088, corDetalhe = 0xffaa00, textureIndex = 0) {
    let carro = new THREE.Group();
    
    // Inicializar dados de física do carro
    carro.userData = {
        velocidade: 0,
        anguloRodas: 0,
        angulo: Math.PI, // Começar apontando para Z positivo
        rodas: [],
        colidindoAntes: false,
        municao: 4,
        voltas: 0,
        proximoCheckpoint: 0,
        ultimoDisparo: 0,
        sobEfeitoDano: false,
        tempoDano: 0,
        isAdversario: true
    };

    // --- Materiais do Adversário ---
    // Selecionar textura baseada no índice (ciclando se necessário)
    const texSelecionada = texAdversarios[textureIndex % texAdversarios.length];
    
    // Body: Standard Material para melhor visualização da textura + cor (Branco para não tingir)
    const mainMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, map: texSelecionada, roughness: 0.5, metalness: 0
    });
    // Material exclusivo para cabine (adversário)
    const cabinMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, roughness: 0.3, metalness: 0.8, map: texCabine 
    });

    // Details: Laranja/Dourado (Phong)
    const detailMaterial = new THREE.MeshPhongMaterial({ 
        color: corDetalhe, shininess: 100, specular: 0xffffff, map: rubberTexture
    });
    const skirtMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111111, roughness: 0.9, metalness: 0.0, map: rubberTexture 
    });
    const glassMaterial = new THREE.MeshPhongMaterial({
        color: 0x44aa88, // Vidro esverdeado
        transparent: true, opacity: 0.7, shininess: 100
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, roughness: 0.7, metalness: 0.1, map: rubberTexture 
    });

    // 1. A Saia (Skirt) - Base inflável
    const skirtWidth = 6.0;
    const skirtLength = 11.5;
    const skirtHeight = 1.2;
    
    // Hull shape function is available in module scope (defined in criarCarro update)
    const skirtShape = createHullShape(skirtWidth, skirtLength, 0.5);
    const skirtExtrudeSettings = {
        steps: 1,
        depth: skirtHeight,
        bevelEnabled: true,
        bevelThickness: 0.3,
        bevelSize: 0.3,
        bevelSegments: 5
    };
    const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, skirtExtrudeSettings);
    const skirt = new THREE.Mesh(skirtGeo, skirtMaterial);
    
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = 0; 
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    carro.add(skirt);

    // 2. O Chassi (Deck)
    const deckWidth = 5.0;
    const deckLength = 10.5;
    const deckHeight = 0.6;
    
    const deckShape = createHullShape(deckWidth, deckLength, 0.2);
    const deckExtrudeSettings = {
        steps: 1,
        depth: deckHeight,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 3
    };
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, deckExtrudeSettings);
    const deck = new THREE.Mesh(deckGeo, mainMaterial);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = skirtHeight - 0.2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    carro.add(deck);

    // 3. Sponsons Laterais (Detalhes laterais)
    const straightPartLen = deckLength - (deckWidth/2);
    const sideWidth = 0.6;
    const sideHeight = 0.8;
    const sideGeo = new RoundedBoxGeometry(sideWidth, sideHeight, straightPartLen, 4, 0.1);
    
    const leftSide = new THREE.Mesh(sideGeo, detailMaterial); // Detalhe em laranja
    leftSide.position.set(-(deckWidth/2 - sideWidth/2), deck.position.y + deckHeight + sideHeight/2 - 0.2, 0); 
    leftSide.castShadow = true;
    carro.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo, detailMaterial); // Detalhe em laranja
    rightSide.position.set((deckWidth/2 - sideWidth/2), deck.position.y + deckHeight + sideHeight/2 - 0.2, 0);
    rightSide.castShadow = true;
    carro.add(rightSide);

    // 4. Cabine
    const cabinGroup = new THREE.Group();
    const cabinWidth = 3.2;
    const cabinGeo = new RoundedBoxGeometry(cabinWidth, 1.6, 2.5, 4, 0.2);
    // Usando material específico da cabine
    const cabin = new THREE.Mesh(cabinGeo, cabinMaterial);
    
    cabin.position.set(0, deck.position.y + deckHeight + 0.8, -3.5); 
    cabin.castShadow = true;
    cabinGroup.add(cabin);

    // Janela (REMOVIDO)
    // Vidros Laterais (REMOVIDO)

    carro.add(cabinGroup);

    // 5. Propulsão (Traseira)
    const fanGroup = new THREE.Group();
    fanGroup.position.set(0, deck.position.y + deckHeight + 1.8, 3.5);

    // Duto
    const ductRadius = 2.4;
    const ductLen = 1.0;
    const ductGeo = new THREE.CylinderGeometry(ductRadius, ductRadius, ductLen, 48, 1, true);
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
    const duct = new THREE.Mesh(ductGeo, ductMat);
    duct.rotation.x = Math.PI / 2;
    duct.castShadow = true;
    fanGroup.add(duct);

    // Borda do Duto
    const rimGeo = new THREE.TorusGeometry(ductRadius, 0.15, 16, 64);
    const rim = new THREE.Mesh(rimGeo, detailMaterial); // Laranja
    rim.position.z = ductLen/2;
    fanGroup.add(rim);
    const rim2 = rim.clone();
    rim2.position.z = -ductLen/2;
    fanGroup.add(rim2);

    // Hélice
    const propGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.3, 4.4, 0.05);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for(let i=0; i<4; i++){
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.z = i * Math.PI/2;
        propGroup.add(blade);
    }
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 16), detailMaterial);
    spinner.rotation.x = Math.PI/2;
    spinner.position.z = 0.1;
    propGroup.add(spinner);
    fanGroup.add(propGroup);

    // Base do motor
    const engineBase = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), mainMaterial);
    engineBase.position.y = -2.0;
    fanGroup.add(engineBase);

    carro.add(fanGroup);
    
    carro.userData.propGroup = propGroup;

    // Adicionar carro à cena
    cena.add(carro);
    
    // Posição inicial: será sobrescrita na main
    carro.userData.angulo = Math.PI;

    return carro;
}
