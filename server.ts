import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  nationId: number;
  color: string;
  isReady: boolean;
  connected: boolean;
}

interface RoomSettings {
  mapSize: number;
  difficulty: string;
  gameSpeed: number;
  botCount: number;
  maxPlayers: number;
}

interface RoomState {
  code: string;
  status: 'LOBBY' | 'PLAYING' | 'ENDED';
  settings: RoomSettings;
  players: RoomPlayer[];
  seed: number;
  hostId: string;
  createdAt: number;
}

type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<RoomSettings> }
  | { type: 'START_GAME' }
  | {
      type: 'PLAYER_ATTACK';
      fromNation: number;
      toNation: number;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      troops: number;
    }
  | {
      type: 'PLAYER_BUILD';
      targetX: number;
      targetY: number;
      buildingType: string;
      count: number;
    }
  | { type: 'CHAT'; text: string };

type ServerMessage =
  | { type: 'ROOM_CREATED'; room: RoomState; myPlayerId: string }
  | { type: 'ROOM_JOINED'; room: RoomState; myPlayerId: string }
  | { type: 'ROOM_UPDATED'; room: RoomState }
  | { type: 'GAME_STARTED'; room: RoomState }
  | {
      type: 'ACTION_ATTACK';
      fromNation: number;
      toNation: number;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      troops: number;
    }
  | {
      type: 'ACTION_BUILD';
      nationId: number;
      targetX: number;
      targetY: number;
      buildingType: string;
      count: number;
    }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; nationId: number; message: string }
  | { type: 'ERROR'; message: string };

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

const PLAYER_COLORS = [
  '#3b82f6', // Xanh dương (Host - Nation 1)
  '#ef4444', // Đỏ tươi (Player 2 - Nation 2)
  '#10b981', // Xanh lục (Player 3 - Nation 3)
  '#8b5cf6', // Tím (Player 4 - Nation 4)
  '#f97316', // Cam (Player 5 - Nation 5)
  '#ec4899', // Hồng (Player 6 - Nation 6)
];

class RoomManager {
  private rooms = new Map<string, RoomState>();
  private clients = new Map<WebSocket, ConnectedClient>();

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public handleConnection(ws: WebSocket) {
    const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.clients.set(ws, { ws, playerId, roomCode: null });

    ws.on('message', (data: string | Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.processMessage(ws, message);
      } catch (err) {
        console.error('Lỗi phân tích WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('Lỗi kết nối socket client:', err);
    });
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastToRoom(roomCode: string, msg: ServerMessage, excludeWs?: WebSocket) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.roomCode === roomCode && ws !== excludeWs) {
        this.send(ws, msg);
      }
    }
  }

  private processMessage(ws: WebSocket, msg: ClientMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case 'CREATE_ROOM': {
        let code = this.generateRoomCode();
        while (this.rooms.has(code)) {
          code = this.generateRoomCode();
        }

        const hostPlayer: RoomPlayer = {
          id: client.playerId,
          name: msg.playerName?.trim() || 'Chủ Phòng',
          isHost: true,
          nationId: 1,
          color: PLAYER_COLORS[0],
          isReady: true,
          connected: true,
        };

        const defaultSettings: RoomSettings = {
          mapSize: 96,
          difficulty: 'NORMAL',
          gameSpeed: 1,
          botCount: 4,
          maxPlayers: 6,
        };

        const newRoom: RoomState = {
          code,
          status: 'LOBBY',
          settings: defaultSettings,
          players: [hostPlayer],
          seed: Math.floor(Math.random() * 1000000),
          hostId: client.playerId,
          createdAt: Date.now(),
        };

        this.rooms.set(code, newRoom);
        client.roomCode = code;

        this.send(ws, {
          type: 'ROOM_CREATED',
          room: newRoom,
          myPlayerId: client.playerId,
        });
        break;
      }

      case 'JOIN_ROOM': {
        const code = msg.roomCode?.toUpperCase().trim();
        const room = this.rooms.get(code);

        if (!room) {
          this.send(ws, { type: 'ERROR', message: `Không tìm thấy phòng [${code}]. Vui lòng kiểm tra lại mã!` });
          return;
        }

        if (room.status !== 'LOBBY') {
          this.send(ws, { type: 'ERROR', message: 'Trận đấu trong phòng này đã bắt đầu rồi!' });
          return;
        }

        if (room.players.length >= room.settings.maxPlayers) {
          this.send(ws, { type: 'ERROR', message: 'Phòng đã đủ số người chơi tối đa!' });
          return;
        }

        const usedNationIds = new Set(room.players.map(p => p.nationId));
        let assignedNationId = 2;
        for (let i = 2; i <= 6; i++) {
          if (!usedNationIds.has(i)) {
            assignedNationId = i;
            break;
          }
        }

        const newPlayer: RoomPlayer = {
          id: client.playerId,
          name: msg.playerName?.trim() || `Người chơi ${room.players.length + 1}`,
          isHost: false,
          nationId: assignedNationId,
          color: PLAYER_COLORS[(assignedNationId - 1) % PLAYER_COLORS.length],
          isReady: true,
          connected: true,
        };

        room.players.push(newPlayer);
        client.roomCode = code;

        this.send(ws, {
          type: 'ROOM_JOINED',
          room,
          myPlayerId: client.playerId,
        });

        this.broadcastToRoom(code, {
          type: 'ROOM_UPDATED',
          room,
        });
        break;
      }

      case 'UPDATE_SETTINGS': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostId !== client.playerId) return;

        room.settings = { ...room.settings, ...msg.settings };
        this.broadcastToRoom(client.roomCode, {
          type: 'ROOM_UPDATED',
          room,
        });
        break;
      }

      case 'START_GAME': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostId !== client.playerId) return;

        room.status = 'PLAYING';
        this.broadcastToRoom(client.roomCode, {
          type: 'GAME_STARTED',
          room,
        });
        break;
      }

      case 'PLAYER_ATTACK': {
        if (!client.roomCode) return;
        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_ATTACK',
          fromNation: msg.fromNation,
          toNation: msg.toNation,
          sourceX: msg.sourceX,
          sourceY: msg.sourceY,
          targetX: msg.targetX,
          targetY: msg.targetY,
          troops: msg.troops,
        }, ws);
        break;
      }

      case 'PLAYER_BUILD': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        const player = room?.players.find(p => p.id === client.playerId);
        if (!player) return;

        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_BUILD',
          nationId: player.nationId,
          targetX: msg.targetX,
          targetY: msg.targetY,
          buildingType: msg.buildingType,
          count: msg.count,
        }, ws);
        break;
      }

      case 'LEAVE_ROOM': {
        this.leaveCurrentRoom(ws);
        break;
      }
    }
  }

  private leaveCurrentRoom(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client || !client.roomCode) return;

    const code = client.roomCode;
    const room = this.rooms.get(code);
    client.roomCode = null;

    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === client.playerId);
    if (playerIndex === -1) return;

    const [leftPlayer] = room.players.splice(playerIndex, 1);

    if (room.players.length === 0) {
      this.rooms.delete(code);
    } else {
      if (leftPlayer.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].id;
      }

      if (room.status === 'PLAYING') {
        this.broadcastToRoom(code, {
          type: 'PLAYER_DISCONNECTED',
          playerId: leftPlayer.id,
          nationId: leftPlayer.nationId,
          message: `${leftPlayer.name} đã rời phòng. Bot AI đã tiếp quản quốc gia này!`,
        });
      }

      this.broadcastToRoom(code, {
        type: 'ROOM_UPDATED',
        room,
      });
    }
  }

  private handleDisconnect(ws: WebSocket) {
    this.leaveCurrentRoom(ws);
    this.clients.delete(ws);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Khởi tạo WebSocket Server cho hệ thống phòng chơi thời gian thực
  const wss = new WebSocketServer({ server, path: '/ws' });
  const roomManager = new RoomManager();

  wss.on('connection', (ws) => {
    roomManager.handleConnection(ws);
  });

  // API kiểm tra tình trạng server
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Trong môi trường dev: Tích hợp Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Trong môi trường production: Phục vụ file tĩnh từ thư mục dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Pixel Empire Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 WebSocket ready on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Lỗi khởi động server:', err);
});
