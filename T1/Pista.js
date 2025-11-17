import * as THREE from 'three';

export function criarPista1(cena) {
    const grupoPista1 = new THREE.Group();
    
    // 1. Criar grama (plano principal)
    const grama = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600),
        new THREE.MeshBasicMaterial({ color: 0x228B22 }) // verde grama
    );
    grama.rotation.x = -Math.PI / 2;
    grupoPista1.add(grama);
    
    cena.add(grupoPista1);
    
    const largura = 100;
    const comprimento = 300;
    const alturaAsfalto = 0.02;
    const geometry1 = new THREE.PlaneGeometry(largura, comprimento); // Para asfalto 1 (apontando para Z)
    const geometry2 = new THREE.PlaneGeometry(comprimento + 100, largura); // Para asfalto 2 (apontando para X)
    const material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // cinza mais claro

    const texturaAsfalto1 = new THREE.Mesh(geometry1, material); // Usando geometry2 para ficar no eixo X
    texturaAsfalto1.rotation.x = -Math.PI / 2;
    texturaAsfalto1.position.x = 100 + (largura / 2);
    texturaAsfalto1.position.y = alturaAsfalto;
    grupoPista1.add(texturaAsfalto1);
    
    const texturaAsfalto2 = new THREE.Mesh(geometry1, material); // Usando geometry2 para ficar no eixo X
    texturaAsfalto2.rotation.x = -Math.PI / 2;
    texturaAsfalto2.position.x = -100 - (largura / 2);
    texturaAsfalto2.position.y = alturaAsfalto;
    grupoPista1.add(texturaAsfalto2);

    const texturaAsfalto3 = new THREE.Mesh(geometry2, material); // Usando geometry2 para ficar no eixo X
    texturaAsfalto3.rotation.x = -Math.PI / 2;
    texturaAsfalto3.position.z = 200 ;
    texturaAsfalto3.position.y = alturaAsfalto;
    grupoPista1.add(texturaAsfalto3);

     const texturaAsfalto4 = new THREE.Mesh(geometry2, material); // Usando geometry2 para ficar no eixo X
    texturaAsfalto4.rotation.x = -Math.PI / 2;
    texturaAsfalto4.position.z = -200 ;
    texturaAsfalto4.position.y = alturaAsfalto;
    grupoPista1.add(texturaAsfalto4);
    
    // Criar muretas ao redor da pista
    criarMuretasPista1(grupoPista1);
    
    return { grupo: grupoPista1 };

    
}
function criarMuretasPista1(grupo) {
    const tamanhoBloco = 10; // Tamanho de cada bloco da mureta
    const alturaMureta = 4;
    const espessuraMureta = 4;
    
    // Muretas externas
    // Lado direito externo (X = 200 + espessura)
    criarFileiraMuretas(grupo, 200 + espessuraMureta/2, 0, -250, 500, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // Lado esquerdo externo (X = -200 - espessura)
    criarFileiraMuretas(grupo, -200 - espessuraMureta/2, 0, -250, 500, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // Lado superior externo (Z = 250 + espessura)
    criarFileiraMuretas(grupo, -200, 250 + espessuraMureta/2, -200, 400, tamanhoBloco, alturaMureta, espessuraMureta, true);
    
    // Lado inferior externo (Z = -250 - espessura)
    criarFileiraMuretas(grupo, -200, -250 - espessuraMureta/2, -200, 400, tamanhoBloco, alturaMureta, espessuraMureta, true);
    
    // Muretas internas (verticais ao longo do eixo Z)
    // Lado direito interno (X = 100 + espessura/2)
    criarFileiraMuretas(grupo, 100 + espessuraMureta/2, 0, -150, 300, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // Lado esquerdo interno (X = -100 - espessura/2)
    criarFileiraMuretas(grupo, -100 - espessuraMureta/2, 0, -150, 300, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // Muretas internas (horizontais ao longo do eixo X)
    // Lado superior interno (Z = 150 + espessura/2)
    criarFileiraMuretas(grupo, -100, 150 + espessuraMureta/2, -100, 200, tamanhoBloco, alturaMureta, espessuraMureta, true);
    
    // Lado inferior interno (Z = -150 - espessura/2)
    criarFileiraMuretas(grupo, -100, -150 - espessuraMureta/2, -100, 200, tamanhoBloco, alturaMureta, espessuraMureta, true);
}

function criarFileiraMuretas(grupo, posX, posZ, inicio, comprimentoTotal, tamanhoBloco, altura, espessura, ehHorizontal) {
    const numBlocos = Math.floor(comprimentoTotal / tamanhoBloco);
    
    for (let i = 0; i < numBlocos; i++) {
        // Alternar entre branco e vermelho
        const cor = i % 2 === 0 ? 0xffffff : 0xff0000;
        
        const bloco = new THREE.Mesh(
            new THREE.BoxGeometry(
                ehHorizontal ? tamanhoBloco : espessura,
                altura,
                ehHorizontal ? espessura : tamanhoBloco
            ),
            new THREE.MeshStandardMaterial({ color: cor })
        );
        
        bloco.position.y = altura / 2;
        
        if (ehHorizontal) {
            // Muretas horizontais (ao longo do eixo X)
            bloco.position.x = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
            bloco.position.z = posZ;
        } else {
            // Muretas verticais (ao longo do eixo Z)
            bloco.position.x = posX;
            bloco.position.z = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
        }
        
        bloco.castShadow = true;
        grupo.add(bloco);
    }
}

export function criarPista2(cena) {
    const grupoPista2 = new THREE.Group();
    
    // 1. Criar grama (plano principal)
    const grama = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 800),
        new THREE.MeshBasicMaterial({ color: 0x228B22 }) // verde grama
    );
    grama.rotation.x = -Math.PI / 2;
    grupoPista2.add(grama);
    
    cena.add(grupoPista2);
    
    const largura = 100;
    const alturaAsfalto = 0.02;
    const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
    
    // Pista em formato de L com 6 segmentos
    // Segmento 1 - Horizontal em Z = 200 (400 x 100)
    const seg1 = new THREE.Mesh(
        new THREE.PlaneGeometry(400, largura),
        material
    );
    seg1.rotation.x = -Math.PI / 2;
    seg1.position.x = 0;
    seg1.position.z = 200 + largura / 2;
    seg1.position.y = alturaAsfalto;
    grupoPista2.add(seg1);
    
    // Segmento 2 - Vertical em X = 150 (100 x 300)
    const seg2 = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, 400),
        material
    );
    seg2.rotation.x = -Math.PI / 2;
    seg2.position.x = 150 ;
    seg2.position.z = 0;
    seg2.position.y = alturaAsfalto;
    grupoPista2.add(seg2);
    
    // Segmento 3 - Vertical em X = 200, Z = 250 (100 x 150)
    const seg3 = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, 150),
        material
    );
    seg3.rotation.x = -Math.PI / 2;
    seg3.position.x = -200 + largura / 2 ; 
    seg3.position.z = 150 ;
    seg3.position.y = alturaAsfalto;
    grupoPista2.add(seg3);
    
    // Segmento 4 - Horizontal na parte de baixo do seg3, em direção ao X negativo (200 x 100)
    const seg4 = new THREE.Mesh(
        new THREE.PlaneGeometry(200, largura),
        material
    );
    seg4.rotation.x = -Math.PI / 2;
    seg4.position.x = -200;
    seg4.position.z = 75  / 2;
    seg4.position.y = alturaAsfalto;
    grupoPista2.add(seg4);
    
    // Segmento 5 - Vertical na extremidade do seg4, indo para Z negativo (100 x 150)
    const seg5 = new THREE.Mesh(
        new THREE.PlaneGeometry(largura, 150),
        material
    );
    seg5.rotation.x = -Math.PI / 2;
    seg5.position.x = -250;
    seg5.position.z = -85;
    seg5.position.y = alturaAsfalto;
    grupoPista2.add(seg5);
    
    // Segmento 6 - Horizontal fechando o circuito, ligando seg5 ao seg2 (400 x 100)
    const seg6 = new THREE.Mesh(
        new THREE.PlaneGeometry(500, largura),
        material
    );
    seg6.rotation.x = -Math.PI / 2;
    seg6.position.x = -50;
    seg6.position.z = -160 - largura/2;
    seg6.position.y = alturaAsfalto;
    grupoPista2.add(seg6);
    
    // Criar muretas ao redor da pista
    criarMuretasPista2(grupoPista2);
    
    return { grupo: grupoPista2 };
}

function criarMuretasPista2(grupo) {
    const tamanhoBloco = 10;
    const alturaMureta = 4;
    const espessuraMureta = 4;
    
    // Muretas externas - seguindo o contorno externo da pista em L
    // Baseado nos limites reais de cada segmento considerando largura de 100
    
    // 1. Topo da pista (acima do seg1): Z = 302, X de -200 a 200
    criarFileiraMuretasPista2(grupo, -200, 302, -200, 400, tamanhoBloco, alturaMureta, espessuraMureta, true);
    
    // 2. Lado direito (direita do seg2): X = 202, Z de 200 até -210
    criarFileiraMuretasPista2(grupo, 202, 0, -210, 410, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // 3. Fundo (abaixo do seg6): Z = -262, X de 200 até -300
    criarFileiraMuretasPista2(grupo, -50, -262, -300, 500, tamanhoBloco, alturaMureta, espessuraMureta, true);
    
    // 4. Esquerda inferior (esquerda do seg5): X = -302, Z de -160 até -10
    criarFileiraMuretasPista2(grupo, -302, -85, -160, 150, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // 5. Meio horizontal (acima do seg4): Z = 87.5, X de -300 até -100
    criarFileiraMuretasPista2(grupo, -200, 87.5, -300, 200, tamanhoBloco, alturaMureta, espessuraMureta, true);
    
    // 6. Esquerda superior (esquerda do seg3): X = -202, Z de 75 até 225
    criarFileiraMuretasPista2(grupo, -202, 150, 75, 150, tamanhoBloco, alturaMureta, espessuraMureta, false);
    
    // 7. Ligação topo esquerdo (entre seg3 e seg1): Z = 227, X de -200 até -100
    criarFileiraMuretasPista2(grupo, -150, 227, -200, 100, tamanhoBloco, alturaMureta, espessuraMureta, true);
}

function criarFileiraMuretasPista2(grupo, posX, posZ, inicio, comprimentoTotal, tamanhoBloco, altura, espessura, ehHorizontal) {
    const numBlocos = Math.floor(comprimentoTotal / tamanhoBloco);
    
    for (let i = 0; i < numBlocos; i++) {
        // Alternar entre branco e azul para pista 2
        const cor = i % 2 === 0 ? 0xffffff : 0x0000ff;
        
        const bloco = new THREE.Mesh(
            new THREE.BoxGeometry(
                ehHorizontal ? tamanhoBloco : espessura,
                altura,
                ehHorizontal ? espessura : tamanhoBloco
            ),
            new THREE.MeshStandardMaterial({ color: cor })
        );
        
        bloco.position.y = altura / 2;
        
        if (ehHorizontal) {
            // Muretas horizontais (ao longo do eixo X)
            bloco.position.x = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
            bloco.position.z = posZ;
        } else {
            // Muretas verticais (ao longo do eixo Z)
            bloco.position.x = posX;
            bloco.position.z = inicio + (i * tamanhoBloco) + tamanhoBloco / 2;
        }
        
        bloco.castShadow = true;
        grupo.add(bloco);
    }
}
