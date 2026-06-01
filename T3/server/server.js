const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.post('/reset', (req, res) => {
  sessionStarted = false;
  Object.keys(entities).forEach((id) => {
    delete entities[id];
  });

  for (const socket of io.sockets.sockets.values()) {
    socket.disconnect(true);
  }

  publishRoom();
  res.json({ ok: true, message: 'Sessao reiniciada.' });
});

const MAX_ENTITIES = 4;
const entities = {};
let sessionStarted = false;

// Opcional: Dados customizados podem ser generalizados, mas mantidos os slots para grid
const defaultColors = [0x00ffff, 0xff66ff, 0xffff66, 0xff9966];

function getOrderedEntities() {
  return Object.values(entities)
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((entity) => ({
      id: entity.id,
      slotIndex: entity.slotIndex,
      ready: entity.ready,
      color: entity.color,
      position: entity.position,
      rotation: entity.rotation
    }));
}

function publishRoom() {
  io.emit('salaAtualizada', {
    partidaIniciada: sessionStarted,
    totalJogadores: Object.keys(entities).length,
    jogadores: getOrderedEntities()
  });
}

function areAllReady() {
  const ids = Object.keys(entities);
  return ids.length >= 2 && ids.every((id) => entities[id].ready);
}

function tryStartSession() {
  if (!sessionStarted && areAllReady()) {
    sessionStarted = true;
    io.emit('partidaIniciada', {
      jogadores: getOrderedEntities()
    });
  }
}

function findFreeSlot() {
  const occupied = new Set(Object.values(entities).map((entity) => entity.slotIndex));
  for (let slotIndex = 0; slotIndex < MAX_ENTITIES; slotIndex += 1) {
    if (!occupied.has(slotIndex)) {
      return slotIndex;
    }
  }
  return -1;
}

io.on('connection', (socket) => {
  console.log('Uma entidade conectou:', socket.id);

  if (sessionStarted) {
    socket.emit('partidaEmAndamento', 'A sessão já está em andamento. Aguarde.');
    socket.disconnect(true);
    return;
  }

  if (Object.keys(entities).length >= MAX_ENTITIES) {
    socket.emit('servidorCheio', 'O limite de conexões foi atingido.');
    socket.disconnect(true);
    return;
  }

  const slotIndex = findFreeSlot();
  if (slotIndex === -1) {
    socket.emit('servidorCheio', 'Não há mais slots livres na rede.');
    socket.disconnect(true);
    return;
  }

  entities[socket.id] = {
    id: socket.id,
    slotIndex,
    ready: false,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    color: defaultColors[slotIndex % defaultColors.length]
  };

  socket.emit('suaSessao', {
    id: socket.id,
    slotIndex,
    partidaIniciada: sessionStarted,
    jogador: entities[socket.id]
  });

  publishRoom();

  socket.on('toggleReady', (estadoReady) => {
    if (!entities[socket.id] || sessionStarted) {
      return;
    }

    entities[socket.id].ready = Boolean(estadoReady);
    publishRoom();
    tryStartSession();
  });

  socket.on('movimentoJogador', (dadosDeMovimento) => {
    if (!entities[socket.id] || !sessionStarted) {
      return;
    }

    if (dadosDeMovimento.position) {
      entities[socket.id].position = dadosDeMovimento.position;
    }

    if (dadosDeMovimento.rotation) {
      entities[socket.id].rotation = dadosDeMovimento.rotation;
    }

    socket.broadcast.emit('jogadorMoveu', entities[socket.id]);
  });

  socket.on('disconnect', () => {
    console.log('Entidade desconectou:', socket.id);
    delete entities[socket.id];

    if (!sessionStarted) {
      publishRoom();
      tryStartSession();
    } else {
      io.emit('jogadorDesconectado', socket.id);
      if (Object.keys(entities).length === 0) {
        sessionStarted = false;
        publishRoom();
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando e escutando na porta ${PORT}`);
});
