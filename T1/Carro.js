import * as THREE from 'three';

export function criarCarro(cena) {
    const grupoCarro = new THREE.Group();
    
    // Corpo do carro
    const geometriaCorpo = new THREE.BoxGeometry(4, 2, 6);
    const materialCorpo = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        metalness: 0.6,
        roughness: 0.4
    });
    const corpo = new THREE.Mesh(geometriaCorpo, materialCorpo);
    corpo.position.y = 2;
    corpo.castShadow = true;
    grupoCarro.add(corpo);
    
    // Cabine (topo do carro)
    const geometriaCabine = new THREE.BoxGeometry(3, 1.5, 3.5);
    const materialCabine = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.7,
        roughness: 0.3
    });
    const cabine = new THREE.Mesh(geometriaCabine, materialCabine);
    cabine.position.set(0, 3.2, -0.5);
    cabine.castShadow = true;
    grupoCarro.add(cabine);
    
    // Janelas (vidros)
    const materialVidro = new THREE.MeshStandardMaterial({ 
        color: 0x88ccff,
        transparent: true,
        opacity: 0.5,
        metalness: 0.9,
        roughness: 0.1
    });
    
    // Janela frontal
    const geometriaJanela = new THREE.PlaneGeometry(2.5, 1.2);
    const janelaFrontal = new THREE.Mesh(geometriaJanela, materialVidro);
    janelaFrontal.position.set(0, 3.2, 1.3);
    janelaFrontal.rotation.x = Math.PI / 6;
    grupoCarro.add(janelaFrontal);
    
    // Criar rodas
    const posticoesRodas = [
        { x: 2.2, z: 2.5, nome: 'frontalEsquerda' },
        { x: -2.2, z: 2.5, nome: 'frontalDireita' },
        { x: 2.2, z: -2.5, nome: 'traseiraEsquerda' },
        { x: -2.2, z: -2.5, nome: 'traseiraDireita' }
    ];
    
    const rodas = [];
    posticoesRodas.forEach(pos => {
        const roda = criarRoda();
        roda.position.set(pos.x, 1, pos.z);
        grupoCarro.add(roda);
        rodas.push({ mesh: roda, nome: pos.nome });
    });
    
    // Faróis
    const geometriaFarol = new THREE.SphereGeometry(0.3, 8, 8);
    const materialFarol = new THREE.MeshStandardMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });
    
    const farolEsquerdo = new THREE.Mesh(geometriaFarol, materialFarol);
    farolEsquerdo.position.set(1.5, 1.8, 3.2);
    grupoCarro.add(farolEsquerdo);
    
    const farolDireito = new THREE.Mesh(geometriaFarol, materialFarol);
    farolDireito.position.set(-1.5, 1.8, 3.2);
    grupoCarro.add(farolDireito);
    
    // Luzes traseiras
    const materialLuzTraseira = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    
    const luzTraseira1 = new THREE.Mesh(geometriaFarol, materialLuzTraseira);
    luzTraseira1.position.set(1.5, 1.8, -3.2);
    grupoCarro.add(luzTraseira1);
    
    const luzTraseira2 = new THREE.Mesh(geometriaFarol, materialLuzTraseira);
    luzTraseira2.position.set(-1.5, 1.8, -3.2);
    grupoCarro.add(luzTraseira2);
    
    // Posição inicial do carro
    grupoCarro.position.set(0, 0, 0);
    
    // Adicionar helper de eixos no carro
    const axesHelperCarro = new THREE.AxesHelper(10);
    grupoCarro.add(axesHelperCarro);
    
    // Armazenar referências úteis
    grupoCarro.userData.rodas = rodas;
    grupoCarro.userData.velocidade = 0;
    grupoCarro.userData.angulo = 0;
    grupoCarro.userData.anguloRodas = 0;
    
    cena.add(grupoCarro);
    
    return grupoCarro;
}

// Função para criar uma roda
function criarRoda() {
    const grupoRoda = new THREE.Group();
    
    // Pneu
    const geometriaPneu = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
    const materialPneu = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        roughness: 0.9
    });
    const pneu = new THREE.Mesh(geometriaPneu, materialPneu);
    pneu.rotation.z = Math.PI / 2;
    pneu.castShadow = true;
    grupoRoda.add(pneu);
    
    // Aro
    const geometriaAro = new THREE.CylinderGeometry(0.5, 0.5, 0.65, 16);
    const materialAro = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc,
        metalness: 0.8,
        roughness: 0.2
    });
    const aro = new THREE.Mesh(geometriaAro, materialAro);
    aro.rotation.z = Math.PI / 2;
    grupoRoda.add(aro);
    
    return grupoRoda;
}
