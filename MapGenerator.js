// MapGenerator.js - Prosedürel harita oluşturma
class MapGenerator {
    constructor() {
        this.rooms = [];
        this.corridors = [];
        this.walls = [];
        this.spawnPoint = { x: 0, y: 0, z: 0 };
        this.exitPoint = { x: 0, y: 0, z: 0 };
        this.itemSpawnPoints = [];
        this.monsterSpawnPoints = [];
    }

    generate(difficulty = 1) {
        this.rooms = [];
        this.corridors = [];
        this.walls = [];
        this.itemSpawnPoints = [];
        this.monsterSpawnPoints = [];

        const roomCount = 8 + Math.floor(difficulty * 3);
        const gridSize = 6;
        const roomSize = { minW: 8, maxW: 16, minH: 8, maxH: 16 };
        const occupied = new Set();

        // Başlangıç odası (spawn)
        const startRoom = {
            id: 0,
            type: 'spawn',
            x: 0, z: 0,
            width: 12, depth: 12,
            height: 4,
            connections: []
        };
        this.rooms.push(startRoom);
        this.spawnPoint = { x: 0, y: 1, z: 0 };
        occupied.add('0,0');

        // Odaları grid üzerinde oluştur
        for (let i = 1; i < roomCount; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 50) {
                // Mevcut bir odanın yanına yerleştir
                const parentIdx = Math.floor(Math.random() * this.rooms.length);
                const parent = this.rooms[parentIdx];
                const dirs = [
                    { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
                    { dx: 0, dz: 1 }, { dx: 0, dz: -1 }
                ];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                const gx = Math.round(parent.x / 20) + dir.dx;
                const gz = Math.round(parent.z / 20) + dir.dz;
                const key = `${gx},${gz}`;

                if (!occupied.has(key)) {
                    const w = roomSize.minW + Math.floor(Math.random() * (roomSize.maxW - roomSize.minW));
                    const d = roomSize.minH + Math.floor(Math.random() * (roomSize.maxH - roomSize.minH));
                    const types = ['storage', 'office', 'hall', 'lab', 'corridor', 'server'];
                    const type = i === roomCount - 1 ? 'exit' : types[Math.floor(Math.random() * types.length)];

                    const room = {
                        id: i,
                        type: type,
                        x: gx * 20,
                        z: gz * 20,
                        width: w,
                        depth: d,
                        height: 4 + Math.random() * 3,
                        connections: [parentIdx]
                    };

                    this.rooms[parentIdx].connections.push(i);
                    this.rooms.push(room);
                    occupied.add(key);

                    // Koridor oluştur (odaları bağlar)
                    this.corridors.push({
                        from: parentIdx,
                        to: i,
                        fromX: parent.x, fromZ: parent.z,
                        toX: room.x, toZ: room.z,
                        width: 3
                    });

                    // Eşya spawn noktaları
                    const itemCount = type === 'storage' ? 5 : type === 'lab' ? 4 : type === 'office' ? 3 : 2;
                    for (let j = 0; j < itemCount; j++) {
                        this.itemSpawnPoints.push({
                            x: room.x + (Math.random() - 0.5) * (w - 2),
                            y: 0.5,
                            z: room.z + (Math.random() - 0.5) * (d - 2),
                            roomId: i
                        });
                    }

                    // Canavar spawn noktaları (spawn odasına yakın olmasın)
                    if (i > 2 && Math.random() < 0.4) {
                        this.monsterSpawnPoints.push({
                            x: room.x,
                            y: 1,
                            z: room.z,
                            roomId: i
                        });
                    }

                    placed = true;
                }
                attempts++;
            }
        }

        // Çıkış noktası
        const exitRoom = this.rooms.find(r => r.type === 'exit') || this.rooms[this.rooms.length - 1];
        exitRoom.type = 'exit';
        this.exitPoint = { x: exitRoom.x, y: 0, z: exitRoom.z };

        // Duvarları oluştur
        this._generateWalls();

        return this.getMapData();
    }

    _generateWalls() {
        this.walls = [];

        // Her oda için duvarlar
        for (const room of this.rooms) {
            const hw = room.width / 2;
            const hd = room.depth / 2;
            const h = room.height;

            // Zemin
            this.walls.push({
                type: 'floor',
                x: room.x, y: 0, z: room.z,
                width: room.width, height: 0.2, depth: room.depth,
                roomType: room.type
            });

            // Tavan
            this.walls.push({
                type: 'ceiling',
                x: room.x, y: h, z: room.z,
                width: room.width, height: 0.2, depth: room.depth,
                roomType: room.type
            });

            // 4 duvar (kapı boşlukları ile)
            const wallSegments = [
                { x: room.x, z: room.z - hd, w: room.width, d: 0.3, rot: 0 },   // Kuzey
                { x: room.x, z: room.z + hd, w: room.width, d: 0.3, rot: 0 },   // Güney
                { x: room.x - hw, z: room.z, w: 0.3, d: room.depth, rot: 0 },   // Batı
                { x: room.x + hw, z: room.z, w: 0.3, d: room.depth, rot: 0 },   // Doğu
            ];

            for (const seg of wallSegments) {
                this.walls.push({
                    type: 'wall',
                    x: seg.x, y: h / 2, z: seg.z,
                    width: seg.w, height: h, depth: seg.d,
                    roomType: room.type
                });
            }
        }

        // Koridorlar için zemin ve duvarlar
        for (const cor of this.corridors) {
            const dx = cor.toX - cor.fromX;
            const dz = cor.toZ - cor.fromZ;
            const len = Math.sqrt(dx * dx + dz * dz);
            const midX = (cor.fromX + cor.toX) / 2;
            const midZ = (cor.fromZ + cor.toZ) / 2;

            if (Math.abs(dx) > Math.abs(dz)) {
                // Yatay koridor
                this.walls.push({
                    type: 'floor',
                    x: midX, y: 0, z: midZ,
                    width: Math.abs(dx), height: 0.2, depth: cor.width,
                    roomType: 'corridor'
                });
            } else {
                // Dikey koridor
                this.walls.push({
                    type: 'floor',
                    x: midX, y: 0, z: midZ,
                    width: cor.width, height: 0.2, depth: Math.abs(dz),
                    roomType: 'corridor'
                });
            }
        }
    }

    getMapData() {
        return {
            rooms: this.rooms,
            corridors: this.corridors,
            walls: this.walls,
            spawnPoint: this.spawnPoint,
            exitPoint: this.exitPoint,
            itemSpawnPoints: this.itemSpawnPoints,
            monsterSpawnPoints: this.monsterSpawnPoints
        };
    }
}

module.exports = MapGenerator;
