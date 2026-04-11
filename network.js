import { initGame, updateRemotePlayer, updateRemoteBall, getGameState } from './game.js';

let peer = null;
let conn = null;
let myId = null;
let isHost = false;

const statusMsg = document.getElementById('status-msg');
const lobby = document.getElementById('lobby');
const gameHud = document.getElementById('game-hud');
const displayId = document.getElementById('display-id');

export function initNetwork(hostMode, targetId = null) {
    isHost = hostMode;
    statusMsg.innerText = 'Bağlanıyor...';

    peer = new Peer();

    peer.on('open', (id) => {
        myId = id;
        console.log('My peer ID is: ' + id);
        
        if (isHost) {
            statusMsg.innerText = 'Lobby ID: ' + id + ' (Paylaşın)';
            displayId.innerText = id;
            startGame();
        } else {
            connectToHost(targetId);
        }
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupDataConnection();
        statusMsg.innerText = 'Bağlantı kuruldu!';
        hideLobby();
    });

    peer.on('error', (err) => {
        console.error(err);
        statusMsg.innerText = 'Hata: ' + err.type;
        statusMsg.style.color = 'red';
    });
}

function connectToHost(targetId) {
    statusMsg.innerText = 'Host\'a bağlanılıyor: ' + targetId;
    conn = peer.connect(targetId);
    setupDataConnection();
    
    conn.on('open', () => {
        statusMsg.innerText = 'Bağlandı!';
        hideLobby();
        startGame();
    });
}

function setupDataConnection() {
    conn.on('data', (data) => {
        if (data.type === 'update') {
            updateRemotePlayer(data.srcId, data.playerPos);
            if (!isHost) {
                updateRemoteBall(data.ballPos);
            }
        }
    });
}

function startGame() {
    initGame(myId, isHost);
    
    // Sync Loop
    setInterval(() => {
        if (conn && conn.open) {
            const state = getGameState();
            conn.send({
                type: 'update',
                srcId: myId,
                playerPos: state.playerPos,
                ballPos: state.ballPos
            });
        }
    }, 50); // 20 FPS sync
}

function hideLobby() {
    lobby.classList.add('hidden');
    gameHud.classList.remove('hidden');
}
