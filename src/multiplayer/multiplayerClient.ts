import { ClientMessage, ServerMessage, RoomState, RoomSettings, BuildingType } from './types';

type Listener<T> = (data: T) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private messageQueue: ClientMessage[] = [];

  // Callbacks
  public onRoomCreated: Listener<{ room: RoomState; myPlayerId: string }> | null = null;
  public onRoomJoined: Listener<{ room: RoomState; myPlayerId: string }> | null = null;
  public onRoomUpdated: Listener<RoomState> | null = null;
  public onGameStarted: Listener<RoomState> | null = null;
  public onActionAttack: Listener<{
    fromNation: number;
    toNation: number;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    troops: number;
  }> | null = null;
  public onActionBuild: Listener<{
    nationId: number;
    targetX: number;
    targetY: number;
    buildingType: BuildingType;
    count: number;
  }> | null = null;
  public onPlayerDisconnected: Listener<{ playerId: string; nationId: number; message: string }> | null = null;
  public onError: Listener<string> | null = null;
  public onConnectionChange: Listener<boolean> | null = null;

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(): Promise<boolean> {
    if (this.isConnected()) return Promise.resolve(true);
    if (this.isConnecting) return Promise.resolve(false);

    this.isConnecting = true;

    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          if (this.onConnectionChange) this.onConnectionChange(true);

          // Gửi các tin nhắn đang chờ trong hàng đợi
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) this.send(msg);
          }
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch (e) {
            console.error('Lỗi nhận dữ liệu WebSocket:', e);
          }
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.ws = null;
          if (this.onConnectionChange) this.onConnectionChange(false);
          resolve(false);
        };

        this.ws.onerror = (err) => {
          console.error('Lỗi kết nối WebSocket:', err);
          this.isConnecting = false;
          resolve(false);
        };
      } catch (err) {
        console.error('Không thể mở kết nối WebSocket:', err);
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  public send(msg: ClientMessage) {
    if (this.isConnected() && this.ws) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
      this.connect();
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        if (this.onRoomCreated) this.onRoomCreated({ room: msg.room, myPlayerId: msg.myPlayerId });
        break;
      case 'ROOM_JOINED':
        if (this.onRoomJoined) this.onRoomJoined({ room: msg.room, myPlayerId: msg.myPlayerId });
        break;
      case 'ROOM_UPDATED':
        if (this.onRoomUpdated) this.onRoomUpdated(msg.room);
        break;
      case 'GAME_STARTED':
        if (this.onGameStarted) this.onGameStarted(msg.room);
        break;
      case 'ACTION_ATTACK':
        if (this.onActionAttack) this.onActionAttack(msg);
        break;
      case 'ACTION_BUILD':
        if (this.onActionBuild) this.onActionBuild(msg);
        break;
      case 'PLAYER_DISCONNECTED':
        if (this.onPlayerDisconnected) this.onPlayerDisconnected(msg);
        break;
      case 'ERROR':
        if (this.onError) this.onError(msg.message);
        break;
    }
  }

  public async createRoom(playerName: string) {
    await this.connect();
    this.send({ type: 'CREATE_ROOM', playerName });
  }

  public async joinRoom(roomCode: string, playerName: string) {
    await this.connect();
    this.send({ type: 'JOIN_ROOM', roomCode, playerName });
  }

  public updateSettings(settings: Partial<RoomSettings>) {
    this.send({ type: 'UPDATE_SETTINGS', settings });
  }

  public startGame() {
    this.send({ type: 'START_GAME' });
  }

  public leaveRoom() {
    this.send({ type: 'LEAVE_ROOM' });
  }

  public sendAttack(fromNation: number, toNation: number, sourceX: number, sourceY: number, targetX: number, targetY: number, troops: number) {
    this.send({
      type: 'PLAYER_ATTACK',
      fromNation,
      toNation,
      sourceX,
      sourceY,
      targetX,
      targetY,
      troops,
    });
  }

  public sendBuild(targetX: number, targetY: number, buildingType: BuildingType, count: number = 1) {
    this.send({
      type: 'PLAYER_BUILD',
      targetX,
      targetY,
      buildingType,
      count,
    });
  }
}

export const multiplayerClient = new MultiplayerClient();
