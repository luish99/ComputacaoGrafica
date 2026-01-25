import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { criarTunel } from './Tunel.js';
import { gerarArvores } from './Arvores.js';

const texturasAnimadas = [];
const aguas = []; // Lista de objetos Water
const sistemasParticulas = []; // Lista para gerenciar partículas

export function obterTexturasAnimadas() {
    return texturasAnimadas;
}


function adicionarDecoracoes(grupo, colisores, posBarris, posCones) {
    const loader = new GLTFLoader();

    // Carregar Barril
    // Tamanho Colisão Estimado: 5x5
    const sizeB = 5; 
    
    loader.load('assets%20baixados/rusty_barrel.glb', (gltf) => {
        const originalBarrel = gltf.scene;
        originalBarrel.scale.set(12, 12, 12); 
        originalBarrel.traverse((o) => { if(o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

        posBarris.forEach(pos => {
            const barrel = originalBarrel.clone();
            barrel.position.set(pos.x, 0, pos.z);
            grupo.add(barrel);
            
            // Adicionar Colisor Box
            colisores.push({
                min: new THREE.Vector3(pos.x - sizeB/2, 0, pos.z - sizeB/2),
                max: new THREE.Vector3(pos.x + sizeB/2, 15, pos.z + sizeB/2),
                // Sem 'normal' definida -> Física calcula dinamicamente
            });
        });
    });

    // Carregar Cone
    // Tamanho estimado: 3.5x3.5 (Ajustado com centralização)
    const sizeC = 3.5; 

    loader.load('assets%20baixados/old_emergency_cone.glb', (gltf) => {
        const originalCone = gltf.scene;
        originalCone.scale.set(3, 3, 3);
        
        // Calcular centro geométrico para corrigir offset visual
        const box = new THREE.Box3().setFromObject(originalCone);
        const center = box.getCenter(new THREE.Vector3());

        originalCone.traverse((o) => { if(o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

        posCones.forEach(pos => {
            const cone = originalCone.clone();
            // Subtrair o centro geométrico (apenas X e Z) para alinhar visualmente com a posição lógica
            cone.position.set(pos.x - center.x, -3.0, pos.z - center.z);
            grupo.add(cone);

            // Adicionar Colisor Box
            colisores.push({
                min: new THREE.Vector3(pos.x - sizeC/2, 0, pos.z - sizeC/2),
                max: new THREE.Vector3(pos.x + sizeC/2, 5, pos.z + sizeC/2),
                // Sem 'normal' definida
            });
        });
    });
}


// Sistema de Partículas de Água
let sistemaParticulas = null;

function inicializarParticulas(cena) {
    const qtde = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(qtde * 3);
    const lifetimes = new Float32Array(qtde);
    
    // Inicializar fora da vista
    for(let i=0; i<qtde; i++) {
        positions[i*3] = 0;
        positions[i*3+1] = -100;
        positions[i*3+2] = 0;
        lifetimes[i] = 0;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const loader = new THREE.TextureLoader();
    const sprite = loader.load('../assets/textures/particle.png');
    
    const material = new THREE.PointsMaterial({
        size: 1.5,
        map: sprite,
        transparent: true,
        opacity: 0.6,
        color: 0xaaaaaa,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    cena.add(points);
    
    return {
        mesh: points,
        positions: positions,
        lifetimes: lifetimes,
        next: 0,
        count: qtde
    };
}

export function atualizarEfeitosPista(delta, carros, cena) {
    // 1. Atualizar shader de água
    aguas.forEach(w => {
        if(w.material.uniforms['time']) {
            w.material.uniforms['time'].value += delta;
        }
    });
    
    // 2. Partículas
    if (!cena) return;
    if (!sistemaParticulas) sistemaParticulas = inicializarParticulas(cena);
    
    const sys = sistemaParticulas;
    const pos = sys.positions;
    const life = sys.lifetimes;
    
    // Emitir
    if (carros && carros.length) {
        carros.forEach(carro => {
             if(!carro) return;
             // Checar se está na água
             let noAgua = false;
             for(let w of aguas) {
                 // Apenas checar se o objeto (ou pai) estiver visível
                 if(!w.parent || !w.parent.visible) continue;
                 
                 const b = w.userData.bounds;
                 if(b && carro.position.x >= b.xMin && carro.position.x <= b.xMax &&
                    carro.position.z >= b.zMin && carro.position.z <= b.zMax) {
                     noAgua = true;
                     break;
                 }
             }
             
             if(noAgua) {
                 // Emitir algumas partículas
                 const emitCount = 5;
                 for(let k=0; k<emitCount; k++) {
                     const i = sys.next;
                     // Posição levemente aleatória em torno do carro
                     pos[i*3] = carro.position.x + (Math.random() - 0.5) * 4;
                     pos[i*3+1] = carro.position.y + 0.5;
                     pos[i*3+2] = carro.position.z + (Math.random() - 0.5) * 4;
                     
                     life[i] = 1.0; // 1 segundo de vida
                     
                     sys.next = (sys.next + 1) % sys.count;
                 }
             }
        });
    }
    
    // Atualizar posição das vivas
    for(let i=0; i<sys.count; i++) {
        if(life[i] > 0) {
            life[i] -= delta;
            pos[i*3+1] += delta * 15; // Subir rápido
            
            // Fazer um zig-zag simples? Ou apenas subir
            // pos[i*3] += (Math.random()-0.5) * 0.1;
            
            if(life[i] <= 0) pos[i*3+1] = -1000; // Esconder
        }
    }
    
    sys.mesh.geometry.attributes.position.needsUpdate = true;
}


export function criarPista1(cena) {
    const grupoPista1 = new THREE.Group();
    const alturaElevacao = 20;
    
    // Carregar textura de grama
    const textureLoader = new THREE.TextureLoader();
    const gramaTexture = textureLoader.load('../assets/textures/grass.jpg');
    gramaTexture.wrapS = THREE.RepeatWrapping;
    gramaTexture.wrapT = THREE.RepeatWrapping;
    gramaTexture.repeat.set(15, 15);
    gramaTexture.colorSpace = THREE.SRGBColorSpace;

    // 1. Criar grama (plano principal)
    const grama = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600),
        new THREE.MeshStandardMaterial({ map: gramaTexture })
    );
    grama.rotation.x = -Math.PI / 2;
    grama.position.y = -alturaElevacao; // Rebaixar chão
    grama.receiveShadow = true;
    grupoPista1.add(grama);
    
    cena.add(grupoPista1);
    
    const largura = 100;
    const comprimento = 300;
    const alturaAsfalto = 0.02;
    const geometry1 = new THREE.PlaneGeometry(largura, comprimento); // Para asfalto 1 (apontando para Z)
    const geometry2 = new THREE.PlaneGeometry(comprimento + 100, largura); // Para asfalto 2 (apontando para X)

    // Carregar textura de asfalto
    const asfaltoTexture = textureLoader.load('../assets/textures/asfalto.jpg');
    asfaltoTexture.wrapS = THREE.RepeatWrapping;
    asfaltoTexture.wrapT = THREE.RepeatWrapping;

    // Configurar textura para geometria 1 (100x300)
    const asfaltoTexture1 = asfaltoTexture.clone();
    asfaltoTexture1.repeat.set(2, 6);
    asfaltoTexture1.colorSpace = THREE.SRGBColorSpace;
    const material1 = new THREE.MeshStandardMaterial({ map: asfaltoTexture1 });

    // Configurar textura para geometria 2 (400x100)
    const asfaltoTexture2 = asfaltoTexture.clone();
    asfaltoTexture2.repeat.set(8, 2);
    asfaltoTexture2.colorSpace = THREE.SRGBColorSpace;
    const material2 = new THREE.MeshStandardMaterial({ map: asfaltoTexture2 });

    // Geometria para as laterais elevadas (Boxes abaixo da pista)
    const boxGeo1 = new THREE.BoxGeometry(largura, alturaElevacao, comprimento);
    const boxGeo2 = new THREE.BoxGeometry(comprimento + 100, alturaElevacao, largura);
    
    // Configurar texturas da base (Muretas Elevadas) - Pista 1 (Stonewall)
    const wallTexture = textureLoader.load('../assets/textures/stonewall.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.colorSpace = THREE.SRGBColorSpace;
    
    function criarMatsBase(w, d) {
        const h = alturaElevacao;
        const scale = 0.05; // 1 repetição a cada 20 unidades
        
        const matX = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matX.map.repeat.set(d * scale, h * scale); // Face lateral X (profundidade)
        
        const matY = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matY.map.repeat.set(w * scale, d * scale); // Face superior
        
        const matZ = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matZ.map.repeat.set(w * scale, h * scale); // Face frontal Z (largura)
        
        return [matX, matX, matY, matY, matZ, matZ];
    }
    
    // const materialBase = new THREE.MeshStandardMaterial({ color: 0x555555 }); // removido

    const texturaAsfalto1 = new THREE.Mesh(geometry1, material1); 
    texturaAsfalto1.rotation.x = -Math.PI / 2;
    texturaAsfalto1.position.x = 100 + (largura / 2);
    texturaAsfalto1.position.y = alturaAsfalto;
    texturaAsfalto1.receiveShadow = true;
    grupoPista1.add(texturaAsfalto1);

    // Base 1
    const base1 = new THREE.Mesh(boxGeo1, criarMatsBase(largura, comprimento));
    base1.position.set(100 + (largura / 2), -alturaElevacao/2, 0);
    grupoPista1.add(base1);
    
    const texturaAsfalto2 = new THREE.Mesh(geometry1, material1);
    texturaAsfalto2.rotation.x = -Math.PI / 2;
    texturaAsfalto2.position.x = -100 - (largura / 2);
    texturaAsfalto2.position.y = alturaAsfalto;
    texturaAsfalto2.receiveShadow = true;
    grupoPista1.add(texturaAsfalto2);

    // Base 2
    const base2 = new THREE.Mesh(boxGeo1, criarMatsBase(largura, comprimento));
    base2.position.set(-100 - (largura / 2), -alturaElevacao/2, 0);
    grupoPista1.add(base2);

    const texturaAsfalto3 = new THREE.Mesh(geometry2, material2);
    texturaAsfalto3.rotation.x = -Math.PI / 2;
    texturaAsfalto3.position.z = 200 ;
    texturaAsfalto3.position.y = alturaAsfalto;
    texturaAsfalto3.receiveShadow = true;
    grupoPista1.add(texturaAsfalto3);

    // Base 3
    const base3 = new THREE.Mesh(boxGeo2, criarMatsBase(comprimento + 100, largura));
    base3.position.set(0, -alturaElevacao/2, 200);
    grupoPista1.add(base3);

     const texturaAsfalto4 = new THREE.Mesh(geometry2, material2);
    texturaAsfalto4.rotation.x = -Math.PI / 2;
    texturaAsfalto4.position.z = -200 ;
    texturaAsfalto4.position.y = alturaAsfalto;
    texturaAsfalto4.receiveShadow = true;
    grupoPista1.add(texturaAsfalto4);

    // Base 4
    const base4 = new THREE.Mesh(boxGeo2, criarMatsBase(comprimento + 100, largura));
    base4.position.set(0, -alturaElevacao/2, -200);
    grupoPista1.add(base4);

    // Adicionar Túnel
    const tunel = criarTunel();
    // tunel.rotation.set(0, 0, 0); // Default is along Z
    tunel.position.set(150, 0, 0);
    grupoPista1.add(tunel);
    
    // Criar linha de chegada (xadrez branco e preto)
    criarLinhaChegada(grupoPista1, 100, 200, 0);
    
    // Criar muretas ao redor da pista e obter colisores
    const wallTextureMureta = textureLoader.load('assets%20baixados/mureta%20vermelha%20e%20branca.png');
    const colisores = criarMuretasPista1(grupoPista1, wallTextureMureta);
    
    // Checkpoints Pista 1
    const checkpoints = [
        { x: 0, z: 200, sizeX: 10, sizeZ: 100 },   // CP1: Bottom (Horizontal track)
        { x: -150, z: 0, sizeX: 100, sizeZ: 10 },  // CP2: Left (Vertical track)
        { x: 0, z: -200, sizeX: 10, sizeZ: 100 },  // CP3: Top (Horizontal track)
        { x: 150, z: -100, sizeX: 100, sizeZ: 10 } // CP4: Right (Vertical track)
    ];
    criarCheckpointsVisuais(grupoPista1, checkpoints);
    
    // Dados da linha de chegada para detecção
    const linhaChegada = {
        xMin: 100,
        xMax: 200,
        z: 0,
        largura: 10 // Largura da zona de detecção
    };
    
    // Waypoints para IA
    const waypoints = [
        { x: 150, z: 200 },
        { x: -150, z: 200 },
        { x: -150, z: -200 },
        { x: 150, z: -200 },
        { x: 150, z: 0 }
    ];

    // Zonas proibidas para árvores (Asfalto)
    const zonasProibidas = [
        { xMin: 100, xMax: 200, zMin: -150, zMax: 150 },   // Reta Direita
        { xMin: -200, xMax: -100, zMin: -150, zMax: 150 }, // Reta Esquerda
        { xMin: -200, xMax: 200, zMin: 150, zMax: 250 },   // Curva Topo
        { xMin: -200, xMax: 200, zMin: -250, zMax: -150 }  // Curva Baixo
    ];
    gerarArvores(grupoPista1, 40, 600, zonasProibidas);

    // Adicionar Decorações Pista 1 (Coordenadas corrigidas para estar no asfalto)
    // Pista 1 Layout:
    // Right Vertical Strip: X=[100, 200], Z=[-150, 150]
    // Left Vertical Strip: X=[-200, -100], Z=[-150, 150]
    // Top Horizontal Strip: X=[-200, 200], Z=[150, 250] (center Z=200)
    // Bottom Horizontal Strip: X=[-200, 200], Z=[-250, -150] (center Z=-200)
    
    const posBarris = [
        { x: 150, z: 0 },    // Right Strip Center
        { x: -150, z: 50 },  // Left Strip
        { x: 0, z: 200 }     // Top Strip Center
    ];
    const posCones = [
        { x: 120, z: 100 },  // Right Strip
        { x: -120, z: -100 },// Left Strip
        { x: 50, z: -200 }   // Bottom Strip
    ];
    adicionarDecoracoes(grupoPista1, colisores, posBarris, posCones);

    return { grupo: grupoPista1, colisores: colisores, linhaChegada: linhaChegada, checkpoints: checkpoints, waypoints: waypoints };

    
}
function criarMuretasPista1(grupo, texture) {
    const tamanhoBloco = 10; // Tamanho de cada bloco da mureta
    const alturaMureta = 4;
    const espessuraMureta = 4;
    const todosColisores = [];
    
    // Muretas externas
    // Lado direito externo (X = 200 + espessura)
    todosColisores.push(...criarFileiraMuretas(grupo, 200 + espessuraMureta/2, 0, -250, 500, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // Lado esquerdo externo (X = -200 - espessura)
    todosColisores.push(...criarFileiraMuretas(grupo, -200 - espessuraMureta/2, 0, -250, 500, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // Lado superior externo (Z = 250 + espessura)
    todosColisores.push(...criarFileiraMuretas(grupo, -200, 250 + espessuraMureta/2, -200, 400, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Lado inferior externo (Z = -250 - espessura)
    todosColisores.push(...criarFileiraMuretas(grupo, -200, -250 - espessuraMureta/2, -200, 400, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Muretas internas (verticais ao longo do eixo Z)
    // Lado direito interno (X = 100 + espessura/2)
    todosColisores.push(...criarFileiraMuretas(grupo, 100 + espessuraMureta/2, 0, -150, 300, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    // Lado esquerdo interno (X = -100 - espessura/2)
    todosColisores.push(...criarFileiraMuretas(grupo, -100 - espessuraMureta/2, 0, -150, 300, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    // Muretas internas (horizontais ao longo do eixo X)
    // Lado superior interno (Z = 150 + espessura/2)
    todosColisores.push(...criarFileiraMuretas(grupo, -100, 150 + espessuraMureta/2, -100, 200, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    
    // Lado inferior interno (Z = -150 - espessura/2)
    todosColisores.push(...criarFileiraMuretas(grupo, -100, -150 - espessuraMureta/2, -100, 200, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    
    return todosColisores;
}

function criarFileiraMuretas(grupo, posX, posZ, inicio, comprimentoTotal, tamanhoBloco, altura, espessura, ehHorizontal, ehInterna = false, texture = null) {
    const numBlocos = Math.floor(comprimentoTotal / tamanhoBloco);
    const colisores = [];
    
    // Configurar textura se fornecida
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace; 
    }

    const geometry = new THREE.BoxGeometry(
        ehHorizontal ? tamanhoBloco : espessura,
        altura,
        ehHorizontal ? espessura : tamanhoBloco
    );

    // Ajustar UVs da face superior se a mureta estiver na vertical (eixo Z) e tiver textura
    // Para corrigir a orientação da textura no topo
    if (!ehHorizontal && texture) {
        const uvAttribute = geometry.attributes.uv;
        // Face superior (Top) é a face index 2.
        // BoxGeometry (não indexada para atributos separados) ou indexada.
        // Ordem faces: px, nx, py(top), ny, pz, nz
        // 4 vertices por face. Face 2 está nos vertices 8, 9, 10, 11
        
        for (let i = 8; i < 12; i++) {
            const u = uvAttribute.getX(i);
            const v = uvAttribute.getY(i);
            // Rotacionar UV em 90 graus: (u, v) -> (v, 1-u) ou (v, u) dependendo da orientação desejada
            uvAttribute.setXY(i, v, u); 
        }
        uvAttribute.needsUpdate = true;
    }

    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        map: texture || null
    });
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, numBlocos);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    const dummy = new THREE.Object3D();
    const colorWhite = new THREE.Color(0xffffff);
    const colorRed = new THREE.Color(0xff0000);
    
    for (let i = 0; i < numBlocos; i++) {
        // Posição
        dummy.position.y = altura / 2;
        
        if (ehHorizontal) {
            dummy.position.x = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
            dummy.position.z = posZ;
        } else {
            dummy.position.x = posX;
            dummy.position.z = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
        }
        
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        // Se usar textura, não usar cores diferentes, apenas branco
        if (texture) {
             instancedMesh.setColorAt(i, colorWhite);
        } else {
             instancedMesh.setColorAt(i, i % 2 === 0 ? colorWhite : colorRed);
        }
        
        // Calcular normal base
        let normalX = 0;
        let normalZ = 0;
        
        if (ehHorizontal) {
            normalZ = posZ > 0 ? -1 : 1;
        } else {
            normalX = posX > 0 ? -1 : 1;
        }
        
        // Inverter se for interna
        if (ehInterna) {
            normalX *= -1;
            normalZ *= -1;
        }

        // Adicionar informação de colisão
        colisores.push({
            min: new THREE.Vector3(
                dummy.position.x - (ehHorizontal ? tamanhoBloco : espessura) / 2,
                0,
                dummy.position.z - (ehHorizontal ? espessura : tamanhoBloco) / 2
            ),
            max: new THREE.Vector3(
                dummy.position.x + (ehHorizontal ? tamanhoBloco : espessura) / 2,
                altura,
                dummy.position.z + (ehHorizontal ? espessura : tamanhoBloco) / 2
            ),
            normal: new THREE.Vector3(normalX, 0, normalZ),
            ehHorizontal: ehHorizontal
        });
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    
    grupo.add(instancedMesh);
    
    return colisores;
}

export function criarPista2(cena) {
    const grupoPista2 = new THREE.Group();
    const alturaElevacao = 20;
    
    // Carregar textura de areia
    const textureLoader = new THREE.TextureLoader();
    const pisoTexture = textureLoader.load('../assets/textures/sand.jpg');
    pisoTexture.wrapS = THREE.RepeatWrapping;
    pisoTexture.wrapT = THREE.RepeatWrapping;
    pisoTexture.repeat.set(20, 20);
    pisoTexture.colorSpace = THREE.SRGBColorSpace;

    // 1. Criar piso (plano principal)
    const piso = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 800),
        new THREE.MeshStandardMaterial({ map: pisoTexture })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = -alturaElevacao;
    piso.receiveShadow = true;
    grupoPista2.add(piso);
    
    cena.add(grupoPista2);
    
    const largura = 100;
    const alturaAsfalto = 0.02;
    // const materialBase = new THREE.MeshStandardMaterial({ color: 0x555555 });
    
    // Configurar texturas da base (Muretas Elevadas) - Pista 2 (Wood)
    const wallTexture = textureLoader.load('../assets/textures/wood.png');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.colorSpace = THREE.SRGBColorSpace;
    
    function criarMatsBase(w, d) {
        const h = alturaElevacao;
        const scale = 0.05; 
        
        const matX = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matX.map.repeat.set(d * scale, h * scale); // Face lateral X
        
        const matY = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matY.map.repeat.set(w * scale, d * scale); // Face superior
        
        const matZ = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matZ.map.repeat.set(w * scale, h * scale); // Face frontal Z
        
        return [matX, matX, matY, matY, matZ, matZ];
    }
    
    // Carregar textura de asfalto
    const asfaltoTexture = textureLoader.load('../assets/textures/asfalto.jpg');
    asfaltoTexture.wrapS = THREE.RepeatWrapping;
    asfaltoTexture.wrapT = THREE.RepeatWrapping;
    asfaltoTexture.colorSpace = THREE.SRGBColorSpace;

    // Helper para criar materiais com repeat customizado
    function criarMaterialAsfalto(repX, repY) {
        const tex = asfaltoTexture.clone();
        tex.repeat.set(repX, repY);
        return new THREE.MeshStandardMaterial({ map: tex });
    }

    // Pista em formato de L com 6 segmentos
    // Segmento 1 - Horizontal em Z = 200 (400 x 100)
    const seg1 = new THREE.Mesh(
        new THREE.PlaneGeometry(400, largura),
        criarMaterialAsfalto(8, 2)
    );
    seg1.rotation.x = -Math.PI / 2;
    seg1.position.x = 0;
    seg1.position.z = 200 + largura / 2;
    seg1.position.y = alturaAsfalto;
    seg1.receiveShadow = true;
    grupoPista2.add(seg1);

    // Base 1
    const base1 = new THREE.Mesh(
        new THREE.BoxGeometry(400, alturaElevacao, largura),
        criarMatsBase(400, largura)
    );
    base1.position.set(0, -alturaElevacao/2, 200 + largura / 2);
    grupoPista2.add(base1);
    
    // Segmento 2 - Vertical em X = 150 (100 x 400)
    const seg2 = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, 400),
        criarMaterialAsfalto(2, 8)
    );
    seg2.rotation.x = -Math.PI / 2;
    seg2.position.x = 150 ;
    seg2.position.z = 0;
    seg2.position.y = alturaAsfalto;
    seg2.receiveShadow = true;
    grupoPista2.add(seg2);

    // Base 2
    const base2 = new THREE.Mesh(
        new THREE.BoxGeometry(largura, alturaElevacao, 400),
        criarMatsBase(largura, 400)
    );
    base2.position.set(150, -alturaElevacao/2, 0);
    grupoPista2.add(base2);
    
    // Segmento 4 - Horizontal na parte de baixo do seg3, em direção ao X negativo (200 x 100)
    // Coordenadas: X=-100 a -300. Z Centro = 37.5. Largura=100. Bounds Z: -12.5 a 87.5.
    // O usuário relatou problema em Z=208.7 (?!), X=-100 a -200.
    // O Segmento 3 está em X=-150, Z=150. Tamanho Z=150 (75 a 225).
    // O problema em Z=208 coincide com a junção do Seg 3 com as Zonas Proibidas ou talvez Seg 1?
    
    // Vamos aplicar offset no SEG 3 também, pois ele cruza com Seg 1 e Seg 4.
    const seg3 = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, 150),
        criarMaterialAsfalto(2, 3)
    );
    seg3.rotation.x = -Math.PI / 2;
    seg3.position.x = -200 + largura / 2 ; 
    seg3.position.z = 150 ;
    seg3.position.y = alturaAsfalto + 0.009; // Offset alto para evitar conflito
    seg3.receiveShadow = true;
    grupoPista2.add(seg3);

    // Base 3
    const base3 = new THREE.Mesh(
        new THREE.BoxGeometry(largura, alturaElevacao, 150),
        criarMatsBase(largura, 150)
    );
    base3.position.set(-200 + largura / 2, -alturaElevacao/2, 150);
    grupoPista2.add(base3);
    
    // Segmento 4 - Horizontal na parte de baixo do seg3, em direção ao X negativo (200 x 100)
    const seg4 = new THREE.Mesh(
        new THREE.PlaneGeometry(200, largura),
        criarMaterialAsfalto(4, 2)
    );
    seg4.rotation.x = -Math.PI / 2;
    seg4.position.x = -200;
    seg4.position.z = 75  / 2;
    // Offset para evitar sobreposição com Seg 3 e Seg 5
    seg4.position.y = alturaAsfalto + 0.003; 
    seg4.receiveShadow = true;
    grupoPista2.add(seg4);

    // Base 4
    const base4 = new THREE.Mesh(
        new THREE.BoxGeometry(200, alturaElevacao, largura),
        criarMatsBase(200, largura)
    );
    base4.position.set(-200, -alturaElevacao/2, 75/2);
    grupoPista2.add(base4);
    
    // Segmento 5 - Vertical na extremidade do seg4, indo para Z negativo (100 x 150)
    const seg5 = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, 150),
        criarMaterialAsfalto(2, 3)
    );
    seg5.rotation.x = -Math.PI / 2;
    seg5.position.x = -250;
    seg5.position.z = -85;
    // Maior offset para vencer Seg 4
    seg5.position.y = alturaAsfalto + 0.006; 
    seg5.receiveShadow = true;
    grupoPista2.add(seg5);
    
    // Base 5
    const base5 = new THREE.Mesh(
        new THREE.BoxGeometry(largura, alturaElevacao, 150),
        criarMatsBase(largura, 150)
    );
    base5.position.set(-250, -alturaElevacao/2, -85);
    grupoPista2.add(base5);

    // Segmento 6 - Horizontal fechando o circuito, ligando seg5 ao seg2 (500 x 100)
    // Dividido em 3 partes: asfalto + água + asfalto (água ocupa > 2/3 da reta)
    const seg6ComprimentoTotal = 500;
    const seg6AguaComprimento = 340; // > 2/3 de 500
    const seg6AsfaltoComprimento = (seg6ComprimentoTotal - seg6AguaComprimento) / 2; // 80
    const seg6Z = -160 - largura / 2;
    const seg6XCentro = -50;
    const seg6XEsquerda = seg6XCentro - seg6ComprimentoTotal / 2;

    // Seg 6 - Reposicionado para evitar overlapping
    // Início em X = -250 (fim do seg 5) e Z = -85
    // Precisa chegar no início do Seg 2 (X = 150, Z = 0)
    // Isso é uma diagonal gigante ou vários segmentos.
    // O código anterior tentava fechar com um horizontal reto.
    // X vai de -250 a 150 = DeltaX 400
    // Z vai de -85 a 0 = DeltaZ 85.
    
    // Vamos simplificar: Seg 6 Horizontal de X=-250 até X=150 em Z=-85
    // E depois um Seg 7 Vertical de Z=-85 até Z=0 em X=150.
    
    // Mas o seg 6 atual está em Z = -160... O design original é complexo.
    // Vamos apenas mover o seg6 ligeiramente para evitar z-fighting se for coplanar com muretas ou outras pistas
    // E alterar o y levemente.
    
    const seg6Y = alturaAsfalto + 0.001; // Pequeno offset vertical para evitar z-fighting (piscando)

    // Asfalto - parte inicial
    const seg6A = new THREE.Mesh(
        new THREE.PlaneGeometry(seg6AsfaltoComprimento, largura),
        criarMaterialAsfalto(2, 2)
    );
    seg6A.rotation.x = -Math.PI / 2;
    seg6A.position.set(seg6XEsquerda + seg6AsfaltoComprimento / 2, seg6Y, seg6Z);
    seg6A.receiveShadow = true;
    grupoPista2.add(seg6A);

    const base6A = new THREE.Mesh(
        new THREE.BoxGeometry(seg6AsfaltoComprimento, alturaElevacao, largura),
        criarMatsBase(seg6AsfaltoComprimento, largura)
    );
    base6A.position.set(seg6A.position.x, -alturaElevacao / 2, seg6Z);
    grupoPista2.add(base6A);

    // Água (Shader) - parte central
    const waterGeometry = new THREE.PlaneGeometry(seg6AguaComprimento, largura);
    
    // Carregar normal map
    const waterNormals = textureLoader.load('../assets/textures/NormalMapping/waternormals.jpg');
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

    const water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: waterNormals,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: cena.fog !== undefined
        }
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(seg6XCentro, seg6Y + 0.1, seg6Z); // Água sempre um pouco acima do asfalto
    
    aguas.push(water); // Adicionar à lista para animação
    
    // Guardar dados para verificação de colisão/partículas
    water.userData.isWater = true;
    water.userData.bounds = {
        xMin: seg6XCentro - seg6AguaComprimento / 2,
        xMax: seg6XCentro + seg6AguaComprimento / 2,
        zMin: seg6Z - largura / 2,
        zMax: seg6Z + largura / 2
    };

    grupoPista2.add(water);

    const base6Agua = new THREE.Mesh(
        new THREE.BoxGeometry(seg6AguaComprimento, alturaElevacao, largura),
        criarMatsBase(seg6AguaComprimento, largura)
    );
    base6Agua.position.set(water.position.x, -alturaElevacao / 2, seg6Z);
    grupoPista2.add(base6Agua);

    // Asfalto - parte final
    const seg6B = new THREE.Mesh(
        new THREE.PlaneGeometry(seg6AsfaltoComprimento, largura),
        criarMaterialAsfalto(2, 2)
    );
    seg6B.rotation.x = -Math.PI / 2;
    seg6B.position.set(seg6XEsquerda + seg6AsfaltoComprimento + seg6AguaComprimento + seg6AsfaltoComprimento / 2, seg6Y, seg6Z);
    seg6B.receiveShadow = true;
    grupoPista2.add(seg6B);

    const base6B = new THREE.Mesh(
        new THREE.BoxGeometry(seg6AsfaltoComprimento, alturaElevacao, largura),
        criarMatsBase(seg6AsfaltoComprimento, largura)
    );
    base6B.position.set(seg6B.position.x, -alturaElevacao / 2, seg6Z);
    grupoPista2.add(base6B);

    // Adicionar Túnel
    const tunel2 = criarTunel();
    tunel2.rotation.y = Math.PI / 2;
    tunel2.position.set(0, 0, 250);
    grupoPista2.add(tunel2);
    
    // Criar linha de chegada (xadrez branco e preto)
    criarLinhaChegada(grupoPista2, 100, 200, 0);
    
    // Criar muretas ao redor da pista e obter colisores
    const wallTextureMureta = textureLoader.load('assets%20baixados/mureta%20azul%20e%20branca.jpg');
    const colisores = criarMuretasPista2(grupoPista2, wallTextureMureta);
    
    // Checkpoints Pista 2
    const checkpoints = [
        { x: 0, z: 250, sizeX: 10, sizeZ: 100 },    // CP1: Top Horizontal
        { x: -150, z: 150, sizeX: 100, sizeZ: 10 }, // CP2: Vertical
        { x: -250, z: -50, sizeX: 100, sizeZ: 10 }, // CP3: Vertical
        { x: -50, z: -210, sizeX: 10, sizeZ: 100 }  // CP4: Bottom Horizontal
    ];
    criarCheckpointsVisuais(grupoPista2, checkpoints);
    
    // Dados da linha de chegada para detecção
    const linhaChegada = {
        xMin: 100,
        xMax: 200,
        z: 0,
        largura: 10
    };
    
    // Waypoints para IA
    const waypoints = [
        { x: 150, z: 250 },
        { x: 0, z: 250 },
        { x: -150, z: 250 },
        { x: -150, z: 150 },
        { x: -150, z: 37.5 },
        { x: -250, z: 37.5 },
        { x: -250, z: -210 },
        { x: -50, z: -210 },
        { x: 150, z: -210 },
        { x: 150, z: 0 }
    ];

    // Zonas proibidas para árvores (Asfalto)
    const zonasProibidas = [
        { xMin: -200, xMax: 200, zMin: 200, zMax: 300 },    // Seg 1
        { xMin: 100, xMax: 200, zMin: -200, zMax: 200 },    // Seg 2
        { xMin: -200, xMax: -100, zMin: 75, zMax: 225 },    // Seg 3 (Corrigido)
        { xMin: -300, xMax: -100, zMin: -12.5, zMax: 87.5 },// Seg 4
        { xMin: -300, xMax: -200, zMin: -160, zMax: -10 },  // Seg 5
        { xMin: -300, xMax: 200, zMin: -260, zMax: -160 }   // Seg 6
    ];
    gerarArvores(grupoPista2, 50, 800, zonasProibidas);

    // Adicionar Decorações Pista 2
    const posBarris2 = [
        { x: -50, z: 270 },
        { x: -270, z: 50 },
        { x: 180, z: -230 }
    ];
    const posCones2 = [
        { x: -130, z: 200 },
        { x: -280, z: -100 },
        { x: 0, z: -200 }
    ];
    adicionarDecoracoes(grupoPista2, colisores, posBarris2, posCones2);

    return { grupo: grupoPista2, colisores: colisores, linhaChegada: linhaChegada, checkpoints: checkpoints, waypoints: waypoints };
}

export function criarPista3(cena) {
    const grupoPista3 = new THREE.Group();
    const alturaElevacao = 20;

    const textureLoader = new THREE.TextureLoader();
    const pisoTexture = textureLoader.load('../assets/textures/stone.jpg');
    pisoTexture.wrapS = THREE.RepeatWrapping;
    pisoTexture.wrapT = THREE.RepeatWrapping;
    pisoTexture.repeat.set(20, 20);
    pisoTexture.colorSpace = THREE.SRGBColorSpace;
    
    // Criar piso (plano principal)
    const piso = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 800),
        new THREE.MeshStandardMaterial({ map: pisoTexture })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = -alturaElevacao;
    piso.receiveShadow = true;
    grupoPista3.add(piso);
    
    cena.add(grupoPista3);
    
    const larguraPista = 40;
    const ladoQuadrado = 200;
    const alturaAsfalto = 0.02;
    
    // Configurar texturas da base (Muretas Elevadas) - Pista 3 (Porcelanato)
    const wallTexture = textureLoader.load('../assets/textures/porcelanatoC.png');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.colorSpace = THREE.SRGBColorSpace;
    
    function criarMatsBase(w, d) {
        const h = alturaElevacao;
        const scale = 0.05; 
        
        const matX = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matX.map.repeat.set(d * scale, h * scale); // Face lateral X
        
        const matY = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matY.map.repeat.set(w * scale, d * scale); // Face superior
        
        const matZ = new THREE.MeshStandardMaterial({ map: wallTexture.clone() });
        matZ.map.repeat.set(w * scale, h * scale); // Face frontal Z
        
        return [matX, matX, matY, matY, matZ, matZ];
    }
    
    // Carregar textura de asfalto
    const asfaltoTexture = textureLoader.load('../assets/textures/asfalto.jpg');
    asfaltoTexture.wrapS = THREE.RepeatWrapping;
    asfaltoTexture.wrapT = THREE.RepeatWrapping;
    asfaltoTexture.colorSpace = THREE.SRGBColorSpace;

    // Helper para criar materiais com repeat customizado
    function criarMaterialAsfalto(repX, repY) {
        const tex = asfaltoTexture.clone();
        tex.repeat.set(repX, repY);
        return new THREE.MeshStandardMaterial({ map: tex });
    }
    
    // Lado superior (Z = 200)
    const q1_topo = new THREE.Mesh(
        new THREE.PlaneGeometry(ladoQuadrado, larguraPista),
        criarMaterialAsfalto(4, 1)
    );
    q1_topo.rotation.x = -Math.PI / 2;
    q1_topo.position.set(100, alturaAsfalto, 200 - larguraPista/2);
    q1_topo.receiveShadow = true;
    grupoPista3.add(q1_topo);

    // Base Q1 Topo
    // Reduzido o comprimento para 120 (Original 200 - 40 - 40) para não sobrepor nas quinas com Laterais
    const b_q1_topo = new THREE.Mesh(
        new THREE.BoxGeometry(ladoQuadrado - 2*larguraPista, alturaElevacao, larguraPista),
        criarMatsBase(ladoQuadrado - 2*larguraPista, larguraPista)
    );
    // Posição X mantida no centro (100)
    b_q1_topo.position.set(100, -alturaElevacao/2, 200 - larguraPista/2);
    grupoPista3.add(b_q1_topo);
    
    // Lado direito (X = 200)
    const q1_direita = new THREE.Mesh(
        new THREE.PlaneGeometry(larguraPista, ladoQuadrado),
        criarMaterialAsfalto(1, 4)
    );
    q1_direita.rotation.x = -Math.PI / 2;
    // Offset Asfalto para não piscar com Topo/Base
    q1_direita.position.set(200 - larguraPista/2, alturaAsfalto + 0.002, 100); 
    q1_direita.receiveShadow = true;
    grupoPista3.add(q1_direita);

    // Base Q1 Direita
    const b_q1_direita = new THREE.Mesh(
        new THREE.BoxGeometry(larguraPista, alturaElevacao, ladoQuadrado),
        criarMatsBase(larguraPista, ladoQuadrado)
    );
    b_q1_direita.position.set(200 - larguraPista/2, -alturaElevacao/2, 100);
    grupoPista3.add(b_q1_direita);
    
    // ADJUST FOR Z-FIGHTING (TRACK 3)
    const asfaltoOffset = 0.005; // Leve offset para cada segmento sobreposto

    // Lado inferior (Z = 0) - completo até X = 0
    const q1_base = new THREE.Mesh(
        new THREE.PlaneGeometry(ladoQuadrado, larguraPista),
        criarMaterialAsfalto(4, 1)
    );
    q1_base.rotation.x = -Math.PI / 2;
    q1_base.position.set(100, alturaAsfalto + asfaltoOffset, larguraPista/2); // Levemente mais alto
    q1_base.receiveShadow = true;
    grupoPista3.add(q1_base);
    
    // Base Q1 Base
    // Reduzido o comprimento para evitar overlap nas quinas
    const b_q1_base = new THREE.Mesh(
        new THREE.BoxGeometry(ladoQuadrado - 2*larguraPista, alturaElevacao, larguraPista),
        criarMatsBase(ladoQuadrado - 2*larguraPista, larguraPista)
    );
    b_q1_base.position.set(100, -alturaElevacao/2, larguraPista/2);
    grupoPista3.add(b_q1_base);

    const asfaltoOffset2 = 0.01;
    // Lado esquerdo (X = 0) - completo até Z = 0
    const q1_esquerda = new THREE.Mesh(
        new THREE.PlaneGeometry(larguraPista, ladoQuadrado),
        criarMaterialAsfalto(1, 4)
    );
    q1_esquerda.rotation.x = -Math.PI / 2;
    q1_esquerda.position.set(larguraPista/2, alturaAsfalto + asfaltoOffset2, 100); // Ainda mais alto
    q1_esquerda.receiveShadow = true;
    grupoPista3.add(q1_esquerda);

    // Base Q1 Esquerda
    const b_q1_esquerda = new THREE.Mesh(
        new THREE.BoxGeometry(larguraPista, alturaElevacao, ladoQuadrado),
        criarMatsBase(larguraPista, ladoQuadrado)
    );
    b_q1_esquerda.position.set(larguraPista/2, -alturaElevacao/2, 100);
    grupoPista3.add(b_q1_esquerda);
    
    // === QUADRADO 2 (inferior esquerdo) ===
    // Lado inferior (Z = -200)
    const q2_base = new THREE.Mesh(
        new THREE.PlaneGeometry(ladoQuadrado, larguraPista),
        criarMaterialAsfalto(4, 1)
    );
    q2_base.rotation.x = -Math.PI / 2;
    q2_base.position.set(-60, alturaAsfalto, -200 + larguraPista/2 + 40);
    q2_base.receiveShadow = true;
    grupoPista3.add(q2_base);

    // Base Q2 Base
    // Reduzido para evitar luta de Z com Lateral Esquerda no canto X=-160
    // Comprimento 200 -> 199.8
    const b_q2_base = new THREE.Mesh(
        new THREE.BoxGeometry(ladoQuadrado - 0.2, alturaElevacao, larguraPista),
        criarMatsBase(ladoQuadrado - 0.2, larguraPista)
    );
    // Move slightly X positive to gap the left side overlap
    b_q2_base.position.set(-60 + 0.1, -alturaElevacao/2, -200 + larguraPista/2 + 40);
    grupoPista3.add(b_q2_base);
    
    // Lado esquerdo (X = -200)
    const q2_esquerda = new THREE.Mesh(
        new THREE.PlaneGeometry(larguraPista, ladoQuadrado),
        criarMaterialAsfalto(1, 4)
    );
    q2_esquerda.rotation.x = -Math.PI / 2;
    // Offset Asfalto
    q2_esquerda.position.set(-200 + larguraPista/2 + 40, alturaAsfalto + 0.002, -60);
    q2_esquerda.receiveShadow = true;
    grupoPista3.add(q2_esquerda);

    // Base Q2 Esquerda
    const b_q2_esquerda = new THREE.Mesh(
        new THREE.BoxGeometry(larguraPista, alturaElevacao, ladoQuadrado),
        criarMatsBase(larguraPista, ladoQuadrado)
    );
    b_q2_esquerda.position.set(-200 + larguraPista/2 + 40, -alturaElevacao/2, -60);
    grupoPista3.add(b_q2_esquerda);
    
    // Lado superior (Descontinuidade)
    const posZ = -larguraPista/2 + 40; // 20
    const startX = -60; // Centro original
    // Q2 Topo range original: -160 a 40. Length 200.
    // Quebrar em 2
    // Buraco alvo: antes de CP3 (X=-80). Digamos X=-40 a X=0.
    
    // Parte 1 (X > -20) - De X=40 a X=-20 (Comp 60) => Centro 10
    // Ajustado para aumentar o buraco na direção +X (borda agora em -20)
    // Pequeno offset para evitar z-fighting nas junções
    const q2_topo1 = new THREE.Mesh( new THREE.PlaneGeometry(60, larguraPista), criarMaterialAsfalto(1.2, 1) );
    q2_topo1.rotation.x = -Math.PI / 2;
    q2_topo1.position.set(10, alturaAsfalto + 0.002, posZ);
    grupoPista3.add(q2_topo1);
    
    const b2_topo1 = new THREE.Mesh( new THREE.BoxGeometry(60, alturaElevacao, larguraPista), criarMatsBase(60, larguraPista) );
    b2_topo1.position.set(10, -alturaElevacao/2, posZ);
    grupoPista3.add(b2_topo1);
    
    // Parte 2 (X < -100) - De X=-100 a X=-160 (Comp 60) => Centro -130
    // Reduzido para aumentar o buraco na direção -X (-20 a -100)
    const q2_topo2 = new THREE.Mesh( new THREE.PlaneGeometry(60, larguraPista), criarMaterialAsfalto(1.2, 1) );
    q2_topo2.rotation.x = -Math.PI / 2;
    // Offset aumentado para 0.008 para evitar z-fighting com q2_esquerda (0.002) na quina X=-134, Z=26
    q2_topo2.position.set(-130, alturaAsfalto + 0.008, posZ);
    grupoPista3.add(q2_topo2);
    
    const b2_topo2 = new THREE.Mesh( new THREE.BoxGeometry(60, alturaElevacao, larguraPista), criarMatsBase(60, larguraPista) );
    b2_topo2.position.set(-130, -alturaElevacao/2, posZ);
    grupoPista3.add(b2_topo2);
    
    // === JUMP PLATES (Plataformas de Salto Estilo F-Zero) ===
    // Substituindo rampas físicas
    // 50% da largura da pista (larguraPista * 0.5)
    const jpWidth = larguraPista * 0.5;
    const jumpPlateGeo = new THREE.PlaneGeometry(10, jpWidth); 
    const jumpPlateMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide }); // Amarelo brilhante
    
    // Jump Plate 1 (Antes do buraco, borda em -20)
    // Para pular buraco para esquerda (Buraco agora é -20 a -80)
    // Posição: centro em -15 (borda -20 + 5)
    // Centralizado no eixo Z da pista (que é posZ)
    const jp1 = new THREE.Mesh(jumpPlateGeo, jumpPlateMat);
    jp1.rotation.x = -Math.PI / 2;
    jp1.position.set(-15, alturaAsfalto + 0.05, posZ); 
    grupoPista3.add(jp1);

    // Jump Plate 2 (REMOVIDO conforme solicitado)
     
    // Lado direito (X = 0) - completo até Z = 0
    const q2_direita = new THREE.Mesh(
        new THREE.PlaneGeometry(larguraPista, ladoQuadrado),
        criarMaterialAsfalto(1, 4)
    );
    q2_direita.rotation.x = -Math.PI / 2;
    // Offset 0.005 para evitar z-fighting com q2_base (0.0) em X=14, Z=-142 e q2_topo1 (0.002)
    q2_direita.position.set(-larguraPista/2 + 40, alturaAsfalto + 0.005, -60);
    q2_direita.receiveShadow = true;
    grupoPista3.add(q2_direita);

    // Base Q2 Direita
    const b_q2_direita = new THREE.Mesh(
        new THREE.BoxGeometry(larguraPista, alturaElevacao, ladoQuadrado),
        criarMatsBase(larguraPista, ladoQuadrado)
    );
    b_q2_direita.position.set(-larguraPista/2 + 40, -alturaElevacao/2, -60);
    grupoPista3.add(b_q2_direita);
    
    // Adicionar Túnel
    const tunel3 = criarTunel(25, 100);
    tunel3.rotation.y = Math.PI / 2;
    tunel3.position.set(100, 0, 180);
    grupoPista3.add(tunel3);

    // Zona de interseção não é necessária - os lados já se encontram em (0,0)
    
    // Criar muretas
    const wallTextureMureta = textureLoader.load('assets%20baixados/mureta%20verde%20e%20branca.jpg');
    const colisores = criarMuretasPista3(grupoPista3, wallTextureMureta);
    
    // Criar linha de chegada visual (xadrez)
    // x = -80, z de -160 a -120
    criarLinhaChegadaZ(grupoPista3, -80, -160, -120);
    
    // Checkpoints Pista 3
    const checkpoints = [
        { x: 20, z: 78, sizeX: 40, sizeZ: 10 },       // CP1: Vertical Strip
        { x: 180, z: 100, sizeX: 40, sizeZ: 10 },     // CP2: Q1 Right (Vertical)
        { x: -120, z: 21.5, sizeX: 10, sizeZ: 37 },   // CP3: Movido para depois do buraco (estava em -80)
        { x: -120, z: -140, sizeX: 10, sizeZ: 40 }    // CP4: Q2 Base area (Before Finish Line)
    ];
    
    criarCheckpointsVisuais(grupoPista3, checkpoints);
    
    // Dados da linha de chegada
    const linhaChegada = {
        x: -80,
        zMin: -160,
        zMax: -120,
        largura: 10,
        eixo: 'X'
    };

    // Zonas proibidas para árvores (Asfalto) - Corrigido com base nas coordenadas reais dos meshes
    const zonasProibidas = [
        // Quadrado 1 (Top Right)
        { xMin: -5, xMax: 205, zMin: 155, zMax: 205 },   // Q1 Top
        { xMin: 155, xMax: 205, zMin: -5, zMax: 205 },   // Q1 Right
        { xMin: -5, xMax: 205, zMin: -5, zMax: 45 },     // Q1 Base
        { xMin: -5, xMax: 45, zMin: -5, zMax: 205 },     // Q1 Left

        // Quadrado 2 (Bottom Left)
        { xMin: -165, xMax: 45, zMin: -165, zMax: -115 }, // Q2 Base
        { xMin: -165, xMax: -115, zMin: -165, zMax: 45 }, // Q2 Left
        { xMin: -165, xMax: 45, zMin: -5, zMax: 45 },     // Q2 Top
        { xMin: -5, xMax: 45, zMin: -165, zMax: 45 }      // Q2 Right
    ];
    gerarArvores(grupoPista3, 50, 800, zonasProibidas);
    
    // Adicionar Decorações Pista 3
    // Coordenadas corrigidas para ficarem dentro do asfalto
    const posBarris3 = [
        { x: 20, z: -50 },  // Reta Vertical (X=20, Z vai de -140 a 180). Movido de -140 para -50.
        { x: 180, z: 100 }, // Reta Direita Q1 (155 a 205 em X, -5 a 205 em Z) -> 180, 100 está OK.
        { x: -140, z: 20 }  // Reta Esquerda Q2 (-165 a -115 em X, -165 a 45 em Z) -> -140, 20 está OK.
    ];
    const posCones3 = [
        { x: -50, z: 180 }, // Reta Topo Q2? Não.
                            // Q2 Topo: X -165 a 45, Z -5 a 45. (Center Z=20). 180 está FORA.
                            // Q1 Topo: X -5 a 205, Z 155 a 205. (Center Z=180). X=-50 está FORA.
                            // Reta Vert Esquerda Q1: X -5 a 45, Z -5 a 205. (Center X=20). 
                            // Vamos colocar em (20, 180).
        
        { x: -100, z: 20 }, // Q2 Topo? Z range -5 a 45. X=-100 ok. (20 é center Z). OK.
        { x: 20, z: 50 }    // Junction? 
                            // Q1 Vert Left: X 20. Z range -5 a 205. Z=50 ok.
    ];
    // Ajustando coordenadas exatas:
    const finalPosCones3 = [
        { x: 20, z: 170 },  // Q1 Esquerda (Reta Vertical partindo da origem para cima)
        { x: -130, z: 20 }, // Q2 Topo (Reta Horizontal Esquerda) - Movido de -100 (borda) para -130 (centro do asfalto)
        { x: 180, z: 50 }   // Q1 Direita (Reta Vertical na direita)
    ];
    
    adicionarDecoracoes(grupoPista3, colisores, posBarris3, finalPosCones3);
    
    // Waypoints para IA
    const waypoints = [
        { x: -80, z: -140 },
        { x: 20, z: -140 },
        { x: 20, z: 180 },
        { x: 180, z: 180 },
        { x: 180, z: 20 },
        { x: 20, z: 20 },
        { x: -140, z: 20 },
        { x: -140, z: -140 },
        { x: -80, z: -140 }
    ];

    
    const buraco = {
        xMin: -100, xMax: -20,
        zMin: 0, zMax: 40 // Broad Z range around 20
    };
    
    // Jump Plates para Física
    const rampas = [
        // Plate 1 em X=-15 (Saída para Esquerda)
        // Reduzido para largura 20 (approx 50% da pista)
        { x: -15, z: 20, largura: 10, profundidade: 20, direction: -1 } // direction -1 = Jump Left (-X)
    ];

    return { grupo: grupoPista3, colisores: colisores, linhaChegada: linhaChegada, checkpoints: checkpoints, waypoints: waypoints, buraco: buraco, rampas: rampas };
}

function criarCheckpointsVisuais(grupo, checkpoints) {
    const loader = new THREE.TextureLoader();
    const baseTex = loader.load('assets%20baixados/Checkpoint.png');
    baseTex.colorSpace = THREE.SRGBColorSpace;
    
    checkpoints.forEach(cp => {
        // Clonar textura para configurar repetição individualmente
        const tex = baseTex.clone();
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        
        // Calcular repetição para manter proporção (evitar esticar)
        // Assumindo que a textura deve preencher blocos de 10x10 unidades
        const scaleFactor = 10; 
        tex.repeat.set(cp.sizeX / scaleFactor, cp.sizeZ / scaleFactor);
        tex.needsUpdate = true;

        const material = new THREE.MeshBasicMaterial({ 
            map: tex,
            color: 0xffffff,
            transparent: true, 
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const marker = new THREE.Mesh(
            new THREE.PlaneGeometry(cp.sizeX, cp.sizeZ),
            material
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(cp.x, 0.05, cp.z);
        grupo.add(marker);
    });
}

function criarLinhaChegadaZ(grupo, x, zMin, zMax) {
    const comprimentoTotal = Math.abs(zMax - zMin);
    const largura = 10; 
    const alturaLinha = 0.06;
    
    const loader = new THREE.TextureLoader();
    const texture = loader.load('assets%20baixados/rough-checked-texture-collage.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, comprimentoTotal / largura / 2); // Manter proporção similar

    
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, comprimentoTotal),
        new THREE.MeshStandardMaterial({ map: texture })
    );
        
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.x = x;
    const zCentro = (zMin + zMax) / 2;
    mesh.position.z = zCentro;
    mesh.position.y = alturaLinha;
    
    grupo.add(mesh);
}

function criarMuretasPista3(grupo, texture) {
    const tamanhoBloco = 10;
    const alturaMureta = 4;
    const espessuraMureta = 4;
    const larguraPista = 40;
    const ladoQuadrado = 200;
    const todosColisores = [];
    
    // === QUADRADO 1 - Muretas Externas (Verde/Branco) ===
    // Topo externo (Z = 200 + espessura)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, 100, 200 + espessuraMureta/2, 0, ladoQuadrado, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Direita externa (X = 200 + espessura)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, 200 + espessuraMureta/2, 100, 0, ladoQuadrado, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // Base externa parcial Q1 (Z = 0 - espessura, de X = larguraPista até 200)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, 100 + larguraPista/2, -espessuraMureta/2, larguraPista, ladoQuadrado - larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Esquerda externa parcial Q1 (X = 0 - espessura, de Z = larguraPista até 200)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -espessuraMureta/2, 100 + larguraPista/2, larguraPista, ladoQuadrado - larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // === QUADRADO 2 - Muretas Externas ===
    // Base externa (Z = -200 - espessura + 40)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -60, -200 - espessuraMureta/2 + 40, -160, ladoQuadrado, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Esquerda externa (X = -200 - espessura + 40)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -200 - espessuraMureta/2 + 40, -60, -160, ladoQuadrado, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // Topo externo parcial Q2 (Z = 0 + espessura + 40, de X = -160 até -larguraPista + 40)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -60 - larguraPista/2, espessuraMureta/2 + 40, -160, ladoQuadrado - larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Direita externa parcial Q2 (X = 0 + espessura + 40, de Z = -160 até -larguraPista + 40)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, espessuraMureta/2 + 40, -60 - larguraPista/2, -160, ladoQuadrado - larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // === QUADRADO 1 - Muretas Internas ===
    // Topo interno (Z = 200 - larguraPista - espessura)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, 100, 200 - larguraPista - espessuraMureta/2, larguraPista, ladoQuadrado - 2*larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    
    // Direita interna (X = 200 - larguraPista - espessura)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, 200 - larguraPista - espessuraMureta/2, 100, larguraPista, ladoQuadrado - 2*larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    // Base interna parcial Q1 (Z = larguraPista + espessura, de X = larguraPista até larguraPista + 120)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, 80, larguraPista + espessuraMureta/2, larguraPista, 120, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    
    // Esquerda interna parcial Q1 (X = larguraPista + espessura, de Z = larguraPista até larguraPista + 120)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, larguraPista + espessuraMureta/2, 80, larguraPista, 120, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    // === QUADRADO 2 - Muretas Internas ===
    // Base interna (Z = -200 + larguraPista + espessura + 40)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -60, -200 + larguraPista + espessuraMureta/2 + 40, -160 + larguraPista, ladoQuadrado - 2*larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    
    // Esquerda interna (X = -200 + larguraPista + espessura + 40)
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -200 + larguraPista + espessuraMureta/2 + 40, -60, -160 + larguraPista, ladoQuadrado - 2*larguraPista, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    // Fix Z-fighting for Internal Top-Right Corner of Q2 (near intersection with Q1)
    const zOffsetInner = 0.01;
    
    
    
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -60 + espessuraMureta, -larguraPista - espessuraMureta/2 + 40, -160 + larguraPista, 120, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    
    // Direita interna parcial Q2
    // User requested explicitly to go to Z=0 (Length 120) to close gap
    todosColisores.push(...criarFileiraMuretasPista3(grupo, -larguraPista - espessuraMureta/2 + 40, -60 + espessuraMureta, -160 + larguraPista, 120, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    return todosColisores;
}

function criarFileiraMuretasPista3(grupo, posX, posZ, inicio, comprimentoTotal, tamanhoBloco, altura, espessura, ehHorizontal, ehInterna = false, texture = null) {
    const numBlocos = Math.floor(comprimentoTotal / tamanhoBloco);
    const colisores = [];
    
    // Configurar textura
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    const geometry = new THREE.BoxGeometry(
        ehHorizontal ? tamanhoBloco : espessura,
        altura,
        ehHorizontal ? espessura : tamanhoBloco
    );

    // Ajustar UVs da face superior se a mureta estiver na vertical (eixo Z) e tiver textura
    if (!ehHorizontal && texture) {
        const uvAttribute = geometry.attributes.uv;
        // Face superior (Top) indices 8, 9, 10, 11
        for (let i = 8; i < 12; i++) {
            const u = uvAttribute.getX(i);
            const v = uvAttribute.getY(i);
            uvAttribute.setXY(i, v, u); 
        }
        uvAttribute.needsUpdate = true;
    }

    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        map: texture || null
    });
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, numBlocos);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    const dummy = new THREE.Object3D();
    const colorWhite = new THREE.Color(0xffffff);
    const colorGreen = new THREE.Color(0x00ff00);
    
    for (let i = 0; i < numBlocos; i++) {
        // Posição
        dummy.position.y = altura / 2;
        
        if (ehHorizontal) {
            dummy.position.x = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
            dummy.position.z = posZ;
        } else {
            dummy.position.x = posX;
            dummy.position.z = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
        }
        
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        if (texture) {
            instancedMesh.setColorAt(i, colorWhite);
        } else {
            instancedMesh.setColorAt(i, i % 2 === 0 ? colorWhite : colorGreen);
        }
        
        // Calcular normal base
        let normalX = 0;
        let normalZ = 0;
        
        if (ehHorizontal) {
            normalZ = posZ > 0 ? -1 : 1;
        } else {
            normalX = posX > 0 ? -1 : 1;
        }
        
        // Inverter se for interna
        if (ehInterna) {
            normalX *= -1;
            normalZ *= -1;
        }

        // Adicionar informação de colisão
        colisores.push({
            min: new THREE.Vector3(
                dummy.position.x - (ehHorizontal ? tamanhoBloco : espessura) / 2,
                0,
                dummy.position.z - (ehHorizontal ? espessura : tamanhoBloco) / 2
            ),
            max: new THREE.Vector3(
                dummy.position.x + (ehHorizontal ? tamanhoBloco : espessura) / 2,
                altura,
                dummy.position.z + (ehHorizontal ? espessura : tamanhoBloco) / 2
            ),
            normal: new THREE.Vector3(normalX, 0, normalZ),
            ehHorizontal: ehHorizontal
        });
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    
    grupo.add(instancedMesh);
    
    return colisores;
}

function criarMuretasPista2(grupo, texture) {
    const tamanhoBloco = 10;
    const alturaMureta = 4;
    const espessuraMureta = 4;
    const todosColisores = [];
    
    // Muretas externas - seguindo o contorno externo da pista em L
    // Baseado nos limites reais de cada segmento considerando largura de 100
    
    // 1. Topo da pista (acima do seg1): Z = 302, X de -200 a 200
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -200, 302, -200, 400, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // 2. Lado direito (direita do seg2): X = 202, Z de -260 até 300
    todosColisores.push(...criarFileiraMuretasPista2(grupo, 202, 0, -260, 560, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // 3. Fundo (abaixo do seg6): Z = -262, X de 200 até -300
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -50, -262, -300, 500, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // 4. Esquerda inferior (esquerda do seg5): X = -300, Z de 90 até -260
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -300, 0, -260, 350, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // 5. Meio horizontal (acima do seg4): Z = 87.5, X de -300 até -200
    todosColisores.push(...criarFileiraMuretasPista2(grupo, 0, 87.5, -300, 100, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // 6. Esquerda superior (esquerda do seg3): X = -200, Z de 300 até 80
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -200, 0, 85, 220, tamanhoBloco, alturaMureta, espessuraMureta, false, false, texture));
    
    // 7. Ligação topo esquerdo (entre seg3 e seg1): Z = 227, X de -200 até -100
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -150, -14, -200, 100, tamanhoBloco, alturaMureta, espessuraMureta, true, false, texture));
    
    // Aqui sao as muretas internas
    todosColisores.push(...criarFileiraMuretasPista2(grupo, 100, 0, -160, 360, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -100, 0, -15, 215, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    todosColisores.push(...criarFileiraMuretasPista2(grupo, -200, 0, -160, 150, tamanhoBloco, alturaMureta, espessuraMureta, false, true, texture));
    
    todosColisores.push(...criarFileiraMuretasPista2(grupo, 0, 200, -100, 200, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));
    todosColisores.push(...criarFileiraMuretasPista2(grupo, 0, -160, -200, 300, tamanhoBloco, alturaMureta, espessuraMureta, true, true, texture));

    return todosColisores;
}

function criarFileiraMuretasPista2(grupo, posX, posZ, inicio, comprimentoTotal, tamanhoBloco, altura, espessura, ehHorizontal, ehInterna = false, texture = null) {
    const numBlocos = Math.floor(comprimentoTotal / tamanhoBloco);
    const colisores = [];
    
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    const geometry = new THREE.BoxGeometry(
        ehHorizontal ? tamanhoBloco : espessura,
        altura,
        ehHorizontal ? espessura : tamanhoBloco
    );

    // Ajustar UVs da face superior se a mureta estiver na vertical (eixo Z) e tiver textura
    if (!ehHorizontal && texture) {
        const uvAttribute = geometry.attributes.uv;
        // Face superior (Top) indices 8, 9, 10, 11
        for (let i = 8; i < 12; i++) {
            const u = uvAttribute.getX(i);
            const v = uvAttribute.getY(i);
            uvAttribute.setXY(i, v, u); 
        }
        uvAttribute.needsUpdate = true;
    }

    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        map: texture || null
    });
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, numBlocos);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    const dummy = new THREE.Object3D();
    const colorWhite = new THREE.Color(0xffffff);
    const colorBlue = new THREE.Color(0x0000ff);
    
    for (let i = 0; i < numBlocos; i++) {
        // Posição
        dummy.position.y = altura / 2;
        
        if (ehHorizontal) {
            dummy.position.x = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
            dummy.position.z = posZ;
        } else {
            dummy.position.x = posX;
            dummy.position.z = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
        }
        
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        if (texture) {
            instancedMesh.setColorAt(i, colorWhite);
        } else {
            instancedMesh.setColorAt(i, i % 2 === 0 ? colorWhite : colorBlue);
        }
        
        // Calcular normal base
        let normalX = 0;
        let normalZ = 0;
        
        if (ehHorizontal) {
            normalZ = posZ > 0 ? -1 : 1;
        } else {
            normalX = posX > 0 ? -1 : 1;
        }
        
        // Inverter se for interna
        if (ehInterna) {
            normalX *= -1;
            normalZ *= -1;
        }

        // Adicionar informação de colisão
        colisores.push({
            min: new THREE.Vector3(
                dummy.position.x - (ehHorizontal ? tamanhoBloco : espessura) / 2,
                0,
                dummy.position.z - (ehHorizontal ? espessura : tamanhoBloco) / 2
            ),
            max: new THREE.Vector3(
                dummy.position.x + (ehHorizontal ? tamanhoBloco : espessura) / 2,
                altura,
                dummy.position.z + (ehHorizontal ? espessura : tamanhoBloco) / 2
            ),
            normal: new THREE.Vector3(normalX, 0, normalZ),
            ehHorizontal: ehHorizontal
        });
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    
    grupo.add(instancedMesh);
    
    return colisores;
}

// Criar linha de chegada com padrão xadrez
function criarLinhaChegada(grupo, xMin, xMax, z) {
    const larguraTotal = xMax - xMin;
    const profundidade = 10;
    const alturaLinha = 0.06;
    
    const loader = new THREE.TextureLoader();
    const texture = loader.load('assets%20baixados/rough-checked-texture-collage.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(larguraTotal / profundidade / 2, 1); // Manter proporção

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(larguraTotal, profundidade),
        new THREE.MeshStandardMaterial({ map: texture })
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.x = xMin + larguraTotal / 2;
    mesh.position.z = z;
    mesh.position.y = alturaLinha;
    
    grupo.add(mesh);
}
