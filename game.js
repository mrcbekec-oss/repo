import * as THREE from 'three';

let scene, camera, renderer, ball, players = {};
let myId = null;
let isHost = false;

const BALL_RADIUS = 0.5;
const PITCH_WIDTH = 40;
const PITCH_HEIGHT = 60;
const PLAYER_SPEED = 0.2;
const BALL_FRICTION = 0.98;

const keys = { w: false, a: false, s: false, d: false, ' ': false };

export function initGame(playerId, isHostMode) {
    myId = playerId;
    isHost = isHostMode;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.Fog(0x050510, 10, 100);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Pitch
    const pitchGeo = new THREE.PlaneGeometry(PITCH_WIDTH, PITCH_HEIGHT);
    const pitchMat = new THREE.MeshPhongMaterial({ color: 0x1a4a1a });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Lines
    const grid = new THREE.GridHelper(PITCH_WIDTH, 10, 0xffffff, 0x444444);
    grid.position.y = 0.01;
    scene.add(grid);

    // Ball
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const ballMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    ball = new THREE.Mesh(ballGeo, ballMat);
    ball.castShadow = true;
    ball.position.y = BALL_RADIUS;
    ball.velocity = new THREE.Vector3();
    scene.add(ball);

    // Local Player
    addPlayer(myId, isHost ? 0x00f2fe : 0xff4b2b, new THREE.Vector3(0, 1, isHost ? 10 : -10));

    window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function addPlayer(id, color, pos) {
    const playerGeo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const playerMat = new THREE.MeshPhongMaterial({ color: color });
    const player = new THREE.Mesh(playerGeo, playerMat);
    player.position.copy(pos);
    player.castShadow = true;
    scene.add(player);
    players[id] = player;
}

export function updateRemotePlayer(id, pos) {
    if (players[id]) {
        players[id].position.lerp(pos, 0.2);
    } else {
        addPlayer(id, 0xff4b2b, pos);
    }
}

export function updateRemoteBall(pos) {
    if (!isHost) {
        ball.position.lerp(pos, 0.2);
    }
}

function handleInput() {
    const move = new THREE.Vector3();
    if (keys.w) move.z -= 1;
    if (keys.s) move.z += 1;
    if (keys.a) move.x -= 1;
    if (keys.d) move.x += 1;

    if (move.length() > 0) {
        move.normalize().multiplyScalar(PLAYER_SPEED);
        players[myId].position.add(move);
        
        // Bounds
        players[myId].position.x = Math.max(-PITCH_WIDTH/2, Math.min(PITCH_WIDTH/2, players[myId].position.x));
        players[myId].position.z = Math.max(-PITCH_HEIGHT/2, Math.min(PITCH_HEIGHT/2, players[myId].position.z));
    }
}

function updatePhysics() {
    if (!isHost) return;

    // Ball movement
    ball.position.add(ball.velocity);
    ball.velocity.multiplyScalar(BALL_FRICTION);

    // Player-Ball collisions
    Object.values(players).forEach(p => {
        const dist = p.position.distanceTo(ball.position);
        if (dist < BALL_RADIUS + 0.8) {
            const dir = new THREE.Vector3().subVectors(ball.position, p.position).normalize();
            dir.y = 0;
            const strength = keys[' '] && p === players[myId] ? 0.8 : 0.1;
            ball.velocity.add(dir.multiplyScalar(strength));
        }
    });

    // Pitch bounds for ball
    if (Math.abs(ball.position.x) > PITCH_WIDTH/2) {
        ball.velocity.x *= -0.5;
        ball.position.x = Math.sign(ball.position.x) * PITCH_WIDTH/2;
    }
    if (Math.abs(ball.position.z) > PITCH_HEIGHT/2) {
        // Goal check
        if (Math.abs(ball.position.x) < 4) {
             resetBall();
        } else {
            ball.velocity.z *= -0.5;
            ball.position.z = Math.sign(ball.position.z) * PITCH_HEIGHT/2;
        }
    }
}

function resetBall() {
    ball.position.set(0, BALL_RADIUS, 0);
    ball.velocity.set(0, 0, 0);
}

function animate() {
    requestAnimationFrame(animate);
    
    handleInput();
    updatePhysics();

    // Camera follow
    const targetPos = players[myId].position.clone();
    camera.position.lerp(new THREE.Vector3(targetPos.x, 15, targetPos.z + 15), 0.1);
    camera.lookAt(targetPos);

    renderer.render(scene, camera);
}

export function getGameState() {
    return {
        playerPos: players[myId].position,
        ballPos: ball.position
    };
}
