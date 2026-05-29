/**
 * Multiplayer Engine
 * 
 * Uma classe genérica para gerenciar conexões WebSocket (via Socket.IO).
 * O objetivo desta classe é desacoplar totalmente a lógica de rede do jogo.
 * Ela usa o padrão Publish-Subscribe (Observer) para emitir eventos que
 * qualquer jogo ou motor gráfico (Three.js, Babylon, 2D) pode escutar
 * sem precisar saber detalhes do Socket.IO ou da topologia do servidor.
 */
class MultiplayerEngine {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.listeners = {};
        
        // Estado local espelhado da sessão
        this.sessionData = null;
    }

    /**
     * Tenta estabelecer a conexão com o servidor na URL fornecida.
     * @param {string} url - Exemplo: 'http://localhost:3000'
     */
    connect(url) {
        if (typeof io === 'undefined') {
            this.emit('error', 'Biblioteca Socket.IO não encontrada no HTML.');
            return false;
        }

        this.socket = io(url);

        this._setupBaseEvents();
        return true;
    }

    /**
     * Método interno para mapear os eventos brutos do servidor
     * para os eventos limpos e abstratos da nossa Engine.
     */
    _setupBaseEvents() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.emit('connected');
        });

        // Eventos específicos do Lobby/Sessão
        this.socket.on('suaSessao', (data) => {
            this.sessionData = data;
            this.emit('sessionAssigned', data);
        });

        this.socket.on('salaAtualizada', (data) => {
            this.emit('lobbyUpdated', data);
        });

        // Eventos de estado de Jogo
        this.socket.on('partidaIniciada', (data) => {
            this.emit('gameStarted', data);
        });

        this.socket.on('partidaEmAndamento', (msg) => {
            this.emit('error', msg || 'Partida já em andamento.');
        });

        this.socket.on('servidorCheio', (msg) => {
            this.emit('error', msg || 'Servidor cheio.');
        });

        // Eventos das Entidades (Outros Jogadores)
        this.socket.on('jogadorMoveu', (entityData) => {
            this.emit('entityMoved', entityData);
        });

        this.socket.on('jogadorDesconectado', (entityId) => {
            this.emit('entityDisconnected', entityId);
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.emit('disconnected');
        });
    }

    /**
     * Envia o estado de pronto/não-pronto no Lobby.
     * @param {boolean} isReady 
     */
    setReadyState(isReady) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('toggleReady', isReady);
    }

    /**
     * Envia os dados de transformação espacial (Posição e Rotação)
     * para o servidor repassar a todos os outros clientes.
     * O formato deve ser dicionários simples {x,y,z} para evitar NaN errors via rede.
     */
    sendTransform(positionParam, rotationParam) {
        if (!this.connected || !this.socket) return;
        
        const transformData = {};
        
        if (positionParam) {
            transformData.position = { x: positionParam.x, y: positionParam.y, z: positionParam.z };
        }
        
        if (rotationParam) {
            transformData.rotation = { 
                x: rotationParam.x, 
                y: rotationParam.y, 
                z: rotationParam.z, 
                // Se for usar Quaternions, envie W também, senão use Euler
                w: rotationParam.w !== undefined ? rotationParam.w : null 
            };
            if (transformData.rotation.w === null) delete transformData.rotation.w;
        }

        this.socket.emit('movimentoJogador', transformData);
    }

    // =======================================================
    // SUBSISTEMA DE EVENTOS (Observer Pattern)
    // Permite que o jogo escute as ações de rede de forma limpa.
    // =======================================================

    /**
     * Registra um callback para um evento específico.
     * @param {string} eventName 
     * @param {function} callback 
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    /**
     * Desregistra um callback.
     * @param {string} eventName 
     * @param {function} callback 
     */
    off(eventName, callback) {
        if (!this.listeners[eventName]) return;
        this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }

    /**
     * Emite um evento internamente para acionar callbacks registrados.
     * @param {string} eventName 
     * @param  {...any} args 
     */
    emit(eventName, ...args) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(...args));
        }
    }
}

// Exporta globalmente para uso no browser (quando importado via script tag)
window.MultiplayerEngine = MultiplayerEngine;
