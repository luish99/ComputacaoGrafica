import * as THREE from 'three';
import { CSG } from '../libs/other/CSGMesh.js';

export function criarTunel(raio = 45, comprimento = 150) {
    const espessura = 2;
    
    // 1. Cilindro Externo - Alinhado ao longo de Z
    const geoExterna = new THREE.CylinderGeometry(raio, raio, comprimento, 24);
    const malhaExterna = new THREE.Mesh(geoExterna);
    malhaExterna.rotation.x = -Math.PI / 2; // Rotacionar para o eixo Z
    malhaExterna.updateMatrix();
    
    // 2. Cilindro Interno - Alinhado ao longo de Z
    const geoInterna = new THREE.CylinderGeometry(raio - espessura, raio - espessura, comprimento + 2, 24);
    const malhaInterna = new THREE.Mesh(geoInterna);
    malhaInterna.rotation.x = -Math.PI / 2; // Rotacionar para o eixo Z
    malhaInterna.updateMatrix();
    
    let csgTunel = CSG.fromMesh(malhaExterna);
    const csgInterno = CSG.fromMesh(malhaInterna);
    
    csgTunel = csgTunel.subtract(csgInterno);

    // 3. Cortar metade inferior para fazer um arco
    const geoCaixa = new THREE.BoxGeometry(raio * 3, raio, comprimento + 10);
    const malhaCaixa = new THREE.Mesh(geoCaixa);
    
    malhaCaixa.position.set(0, -raio / 2, 0);
    malhaCaixa.updateMatrix();
    
    const csgCaixa = CSG.fromMesh(malhaCaixa);
    csgTunel = csgTunel.subtract(csgCaixa);
    
    // 4. Furos
    // Furos ao longo de Y (Vertical), no topo do túnel
    const raioFuro = 10;
    const geoFuro = new THREE.CylinderGeometry(raioFuro, raioFuro, espessura * 10, 12);
    
    const inicioZ = -comprimento / 2 + comprimento / 5;
    const passoZ = comprimento / 5;
    
    for (let i = 0; i < 4; i++) {
        const malhaFuro = new THREE.Mesh(geoFuro);
        
        malhaFuro.position.set(0, raio, inicioZ + i * passoZ); 
        malhaFuro.updateMatrix();
        
        const csgFuro = CSG.fromMesh(malhaFuro);
        csgTunel = csgTunel.subtract(csgFuro);
    }
    
    const malhaFinal = CSG.toMesh(csgTunel, new THREE.Matrix4());
    
    // Configurar Textura
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('../assets/textures/crate2.jpg'); // Textura de caixote
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Ajustar repeat para mapear corretamente no formato curvo/cilíndrico do CSG
    texture.repeat.set(comprimento / 30, raio / 10); 
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // Material
    const material = new THREE.MeshStandardMaterial({ 
        map: texture,
        roughness: 0.7,
        side: THREE.DoubleSide
    });
    malhaFinal.material = material;
    
    // Habilitar sombras
    malhaFinal.castShadow = true;
    malhaFinal.receiveShadow = true;
    
    return malhaFinal;
}
