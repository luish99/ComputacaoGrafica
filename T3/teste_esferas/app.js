import * as THREE from 'three';

const statusEl = document.getElementById('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 30, 40);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 0.9);
light.position.set(20, 40, 20);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const grid = new THREE.GridHelper(80, 16, 0x335577, 0x223344);
scene.add(grid);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0f1524, side: THREE.DoubleSide })
);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

const rede = new MultiplayerEngine();
const serverUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://computacaografica-3uzi.onrender.com';

const jogadorEsferas = new Map();
let meuId = null;
let partidaIniciada = false;

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false
};

function criarEsfera(id, corHex) {
  const material = new THREE.MeshStandardMaterial({ color: corHex || 0x00ffff });
  const geometry = new THREE.SphereGeometry(2.2, 28, 28);
  const esfera = new THREE.Mesh(geometry, material);
  esfera.position.set(0, 2.2, 0);
  scene.add(esfera);
  jogadorEsferas.set(id, esfera);
  return esfera;
}

function atualizarStatus(msg) {
  statusEl.textContent = msg;
}

function conectar() {
  const ok = rede.connect(serverUrl);
  if (!ok) {
    atualizarStatus('Socket.IO nao carregou.');
    return;
  }

  rede.on('connected', () => {
    atualizarStatus('Conectado. Aguardando outro jogador...');
    rede.setReadyState(true);
  });

  rede.on('sessionAssigned', (data) => {
    meuId = data.id;
    if (!jogadorEsferas.has(meuId)) {
      criarEsfera(meuId, data.jogador?.color);
    }
  });

  rede.on('lobbyUpdated', (data) => {
    if (!partidaIniciada) {
      atualizarStatus(`Jogadores na sala: ${data.totalJogadores}/2. Aguardando prontidao...`);
    }
  });

  rede.on('gameStarted', (data) => {
    partidaIniciada = true;
    atualizarStatus('Partida iniciada. Use as setas para mover.');

    if (data?.jogadores) {
      data.jogadores.forEach((jogador) => {
        if (!jogadorEsferas.has(jogador.id)) {
          criarEsfera(jogador.id, jogador.color);
        }
      });
    }
  });

  rede.on('entityMoved', (entity) => {
    if (!entity || !entity.id || entity.id === meuId) return;

    let esfera = jogadorEsferas.get(entity.id);
    if (!esfera) {
      esfera = criarEsfera(entity.id, entity.color);
    }

    if (entity.position) {
      esfera.position.set(entity.position.x, 2.2, entity.position.z);
    }
  });

  rede.on('entityDisconnected', (id) => {
    const esfera = jogadorEsferas.get(id);
    if (esfera) {
      scene.remove(esfera);
      jogadorEsferas.delete(id);
    }
  });

  rede.on('error', (msg) => {
    atualizarStatus(msg || 'Erro na conexao.');
  });
}

function atualizarMovimento() {
  const esfera = jogadorEsferas.get(meuId);
  if (!esfera || !partidaIniciada) return;

  const speed = 0.35;
  const limite = 30;

  const movimento = new THREE.Vector3(
    (keys.ArrowRight ? speed : 0) + (keys.ArrowLeft ? -speed : 0),
    0,
    (keys.ArrowDown ? speed : 0) + (keys.ArrowUp ? -speed : 0)
  );

  if (movimento.lengthSq() > 0) {
    esfera.position.add(movimento);
    esfera.position.x = Math.max(-limite, Math.min(limite, esfera.position.x));
    esfera.position.z = Math.max(-limite, Math.min(limite, esfera.position.z));

    rede.sendTransform(esfera.position, null);
  }
}

function animate() {
  atualizarMovimento();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('keydown', (event) => {
  if (event.key in keys) keys[event.key] = true;
});

window.addEventListener('keyup', (event) => {
  if (event.key in keys) keys[event.key] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

conectar();
animate();
