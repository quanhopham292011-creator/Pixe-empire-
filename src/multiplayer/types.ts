import { GameDifficulty, MapDimension, BuildingType } from '../types';
export type { BuildingType };

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  nationId: number; // 1, 2, 3...
  color: string;
  isReady: boolean;
  connected: boolean;
}

export interface RoomSettings {
  mapSize: MapDimension; // 64, 96, 128
  difficulty: GameDifficulty; // 'EASY' | 'NORMAL' | 'HARD'
  gameSpeed: number; // 1, 2
  botCount: number; // 2, 4, 6...
  maxPlayers: number; // 2 -> 6
}

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'ENDED';

export interface RoomState {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: RoomPlayer[];
  seed: number; // Seed ngẫu nhiên để mọi người chơi tạo ra bản đồ giống hệt nhau 100%
  hostId: string;
  createdAt: number;
}

// Các kiểu thông điệp WebSocket Client <-> Server
export type ClientMessage =
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
      buildingType: BuildingType;
      count: number;
    }
  | { type: 'CHAT'; text: string };

export type ServerMessage =
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
      buildingType: BuildingType;
      count: number;
    }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; nationId: number; message: string }
  | { type: 'ERROR'; message: string };
