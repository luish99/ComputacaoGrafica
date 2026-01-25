import * as THREE from 'three';

export function criarArvoreTipo1() {
    // Pinheiro (Cilindro + Cone)
    const grupoArvore = new THREE.Group();

    const geometriaTronco = new THREE.CylinderGeometry(2, 2, 10, 8);
    const materialTronco = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const tronco = new THREE.Mesh(geometriaTronco, materialTronco);
    tronco.position.y = 5;
    tronco.castShadow = true;
    tronco.receiveShadow = true;
    grupoArvore.add(tronco);

    // Folhas em camadas
    const materialFolhas = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(10, 15, 8), materialFolhas);
    cone1.position.y = 15;
    cone1.castShadow = true;
    cone1.receiveShadow = true;
    grupoArvore.add(cone1);

    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 8), materialFolhas);
    cone2.position.y = 22;
    cone2.castShadow = true;
    cone2.receiveShadow = true;
    grupoArvore.add(cone2);

    return grupoArvore;
}

export function criarArvoreTipo2() {
    // Árvore Redonda (Cilindro + Dodecaedro)
    const grupoArvore = new THREE.Group();

    const geometriaTronco = new THREE.CylinderGeometry(2, 3, 12, 8);
    const materialTronco = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const tronco = new THREE.Mesh(geometriaTronco, materialTronco);
    tronco.position.y = 6;
    tronco.castShadow = true;
    tronco.receiveShadow = true;
    grupoArvore.add(tronco);

    const geometriaFolhas = new THREE.DodecahedronGeometry(10);
    const materialFolhas = new THREE.MeshStandardMaterial({ color: 0x006400 });
    const folhas = new THREE.Mesh(geometriaFolhas, materialFolhas);
    folhas.position.y = 18;
    folhas.castShadow = true;
    folhas.receiveShadow = true;
    grupoArvore.add(folhas);

    return grupoArvore;
}

export function gerarArvores(grupo, quantidade, tamanhoPlano, zonasProibidas) {
    let contador = 0;
    let tentativas = 0;
    const maxTentativas = quantidade * 50;

    while (contador < quantidade && tentativas < maxTentativas) {
        tentativas++;
        
        const x = (Math.random() - 0.5) * tamanhoPlano;
        const z = (Math.random() - 0.5) * tamanhoPlano;
        
        let valido = true;
        for (let zona of zonasProibidas) {
            // Margem de segurança aumentada para evitar que folhas atravessem muretas
            // Raio máximo da árvore ~13 (10 * 1.3 de escala) + Espessura mureta (4)
            const margem = 15; 
            if (x >= zona.xMin - margem && x <= zona.xMax + margem && 
                z >= zona.zMin - margem && z <= zona.zMax + margem) {
                valido = false;
                break;
            }
        }

        if (valido) {
            const tipo = Math.random() > 0.5 ? 1 : 2;
            const arvore = tipo === 1 ? criarArvoreTipo1() : criarArvoreTipo2();
            // Ajustar altura para o chão rebaixado (-20)
            arvore.position.set(x, -20, z);
            
            // Variação de escala e rotação
            const escala = 0.8 + Math.random() * 0.5;
            arvore.scale.set(escala, escala, escala);
            arvore.rotation.y = Math.random() * Math.PI * 2;
            
            grupo.add(arvore);
            contador++;
        }
    }
    console.log(`Geradas ${contador} árvores de ${quantidade} solicitadas.`);
}
