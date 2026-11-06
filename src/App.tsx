/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BuildingType, MapDimension, GameDifficulty, GameMode, Tile, Nation, 
  AttackWave, GameParticle, GameEvent, ResearchingTech, TechNode, QuestStep, General,
  WeatherType, WeatherParticle, WeatherCloudPuff, DarkTitan
} from './types';
import { generateWorldMap } from './utils/mapGenerator';
import { soundManager } from './utils/audio';
import { TILE_PIXEL_SIZE, BUILDING_INFO, TECH_TREE, formatPopulation, DARK_TITAN_CONFIG, formatGameTime } from './utils/constants';
import { generateWeatherParticles } from './utils/weatherUtils';
import { drawTerrainBuffer, drawTerritoryBuffer } from './utils/canvasRenderer';
import { BuildModal } from './components/BuildModal';
import { TechModal } from './components/TechModal';
import { DiplomacyModal } from './components/DiplomacyModal';
import { Minimap } from './components/Minimap';
import { EventTicker, EventLogModal } from './components/EventTicker';
import { SettingsModal } from './components/SettingsModal';
import { CreativeModal } from './components/CreativeModal';
import { VictoryConfettiCanvas } from './components/VictoryConfettiCanvas';
import { MatchLeaderboard } from './components/MatchLeaderboard';
import { MultiplayerModal } from './components/MultiplayerModal';
import { multiplayerClient } from './multiplayer/multiplayerClient';
import { RoomState } from './multiplayer/types';

import { 
  Shield, Castle, Coins, Users, Play, Pause, FastForward, 
  RotateCcw, ZoomIn, ZoomOut, Swords, Building2, Award, 
  TrendingUp, AlertTriangle, Volume2, VolumeX, HelpCircle, 
  Sparkles, Flag, Crown, Check, Lock, ChevronRight, X, Anchor, Edit3, Settings,
  Cloud, CloudRain, Sun, Wand2, Handshake, Crosshair, Rocket, ShieldAlert
} from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>('TITLE');
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('EASY');
  const [mapSize, setMapSize] = useState<MapDimension>(96); // Mặc định 96x96
  const [gameMode, setGameMode] = useState<GameMode>('STANDARD');
  const gameModeRef = useRef<GameMode>('STANDARD');
  const [isCreativeOpen, setIsCreativeOpen] = useState<boolean>(false);
  const [godModeLocked, setGodModeLocked] = useState<boolean>(false);
  const godModeLockedRef = useRef<boolean>(false);

  // Hệ Thống Thời Tiết (Mây trôi bồng bềnh, Mưa lất phất)
  const [weather, setWeather] = useState<WeatherType>('CLOUDY');
  const weatherRef = useRef<WeatherType>('CLOUDY');
  const [weatherEnabled, setWeatherEnabled] = useState<boolean>(true);
  const weatherEnabledRef = useRef<boolean>(true);
  const weatherParticlesRef = useRef<WeatherParticle[]>([]);
  // Hiệu ứng chớp nháy toàn màn hình giả lập tia chớp (Lightning Flash) khi trời Mưa (RAIN)
  const lightningFlashRef = useRef<{ startTime: number; duration: number } | null>(null);
  const nextLightningTimeRef = useRef<number>(0);

  // Trạng thái Minimap & Settings Modal
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pixel_empire_show_minimap') !== 'false';
    } catch {
      return true;
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Đổi tên Người chơi
  const [playerName, setPlayerName] = useState<string>('Việt Nam');

  // Tấn công & Tự động mở rộng & Điều Tướng
  const [attackPercent, setAttackPercent] = useState<number>(50);
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [playerGeneralDeployMode, setPlayerGeneralDeployMode] = useState<boolean>(true); // Tướng tham chiến theo đợt quân

  // Ô đất đang được chọn để xem thông tin / chuẩn bị xây dựng (Tách biệt hoàn toàn việc chọn ô và xây dựng)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const selectedTileRef = useRef<Tile | null>(null);
  const totalLandCountRef = useRef<number>(0);

  // Modals
  const [isBuildOpen, setIsBuildOpen] = useState<boolean>(false);
  const [isTechOpen, setIsTechOpen] = useState<boolean>(false);
  const [isDiplomacyOpen, setIsDiplomacyOpen] = useState<boolean>(false);
  const [isEventLogOpen, setIsEventLogOpen] = useState<boolean>(false);

  // Nhiệm vụ trong game
  const [currentQuest, setCurrentQuest] = useState<QuestStep>(1);
  const [questDismissed, setQuestDismissed] = useState<boolean>(false);

  // Trạng thái mở khóa ngoại giao
  const [hasMetBot, setHasMetBot] = useState<boolean>(false);

  // Trạng thái lưu ván chơi (Save Game System)
  const [savedGameInfo, setSavedGameInfo] = useState<{
    timestamp: string;
    gameTimeStr: string;
    playerName: string;
    mode: string;
  } | null>(null);
  const saveGameRef = useRef<() => void>(() => {});
  const [showConfirmNewGame, setShowConfirmNewGame] = useState<boolean>(false);
  const [loadErrorToast, setLoadErrorToast] = useState<string | null>(null);

  // Trạng thái Phòng chơi Nhiều người (Multiplayer Private Room)
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState<RoomState | null>(null);
  const [myPlayerNationId, setMyPlayerNationId] = useState<number>(1);
  const myNationIdRef = useRef<number>(1);
  const isMultiplayerRef = useRef<boolean>(false);
  const [isMultiplayerModalOpen, setIsMultiplayerModalOpen] = useState<boolean>(false);
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(null);
  const [multiplayerBanner, setMultiplayerBanner] = useState<string | null>(null);

  // HUD stats
  const [hudStats, setHudStats] = useState({
    gold: 50,
    goldIncome: 1,
    troops: 20,
    maxTroops: 30,
    landPercent: 5,
    territoryCount: 12,
    titanBuffTimer: 0,
  });

  // Camera & Interaction Refs
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1.25 });
  const needsCenterCameraRef = useRef<boolean>(false);
  // Ref điều khiển chuyển động camera mượt mà (Smooth Camera Animation)
  const cameraAnimRef = useRef<{
    startX: number;
    startY: number;
    startZoom: number;
    targetX: number;
    targetY: number;
    targetZoom: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // Pointers & Viewport
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Offscreen Canvas Cache Layers cho Tối ưu FPS & Đồ họa Neon OpenFront
  const offscreenTerrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenTerritoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenTerrainDirtyRef = useRef<boolean>(true);
  const offscreenTerritoryDirtyRef = useRef<boolean>(true);

  // Cache vị trí trung tâm các quốc gia
  const nationCentersRef = useRef<Record<number, { px: number; py: number }>>({});

  const viewportSizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const pointersMapRef = useRef<Map<number, { id: number; x: number; y: number }>>(new Map());
  const pointerStartRef = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  const startCamRef = useRef({ x: 0, y: 0, zoom: 1.25 });
  
  // Pinch-to-zoom mượt mà với damping factor chống nhảy/giật
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchMidRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const gameDataRef = useRef<{
    tiles: Tile[][];
    nations: Nation[];
    attackWaves: AttackWave[];
    particles: GameParticle[];
    events: GameEvent[];
    researching: ResearchingTech | null;
    gameTimeSeconds: number;
    hasMetBot: boolean;
    darkTitan: DarkTitan | null;
    darkTitans: DarkTitan[];
    stats: {
      battlesCount: number;
      buildingsCount: number;
    };
  }>({
    tiles: [],
    nations: [],
    attackWaves: [],
    particles: [],
    events: [],
    researching: null,
    gameTimeSeconds: 0,
    hasMetBot: false,
    darkTitan: null,
    darkTitans: [],
    stats: { battlesCount: 0, buildingsCount: 0 },
  });

  useEffect(() => {
    soundManager.enabled = soundEnabled;
  }, [soundEnabled]);

  // Giới hạn thu phóng mở rộng: Cho phép thu nhỏ bao quát toàn bộ thế giới và phóng to chi tiết
  const clampZoom = useCallback((targetZoom: number) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const mapPx = mapSize * TILE_PIXEL_SIZE;
    // Fit zoom: mức zoom vừa vặn để thấy trọn vẹn toàn bộ bản đồ thế giới trong khung nhìn
    const fitZoom = Math.min(vpW / mapPx, vpH / mapPx);
    // Tăng giới hạn thu nhỏ (Zoom Out) để người chơi có thể bao quát toàn bộ thế giới kèm lề
    const minZ = Math.max(0.10, fitZoom * 0.88);
    // Cho phép phóng to đủ gần (Zoom In) để quan sát chi tiết lãnh thổ, công trình, quân lính
    const maxZ = 3.6;
    return Math.min(maxZ, Math.max(minZ, targetZoom));
  }, [mapSize]);

  // Giới hạn camera cho phép khám phá toàn bản đồ, không bị kẹt ở phạm vi quá nhỏ
  const clampCamera = useCallback((camX: number, camY: number, zoom: number) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const mapPxX = mapSize * TILE_PIXEL_SIZE * zoom;
    const mapPxY = mapSize * TILE_PIXEL_SIZE * zoom;

    let clampedX: number;
    if (mapPxX <= vpW) {
      clampedX = (vpW - mapPxX) / 2;
    } else {
      const margin = 200;
      clampedX = Math.min(margin, Math.max(vpW - mapPxX - margin, camX));
    }

    let clampedY: number;
    if (mapPxY <= vpH) {
      clampedY = (vpH - mapPxY) / 2;
    } else {
      const margin = 200;
      clampedY = Math.min(margin, Math.max(vpH - mapPxY - margin, camY));
    }

    return { x: clampedX, y: clampedY };
  }, [mapSize]);

  // Hàm thu phóng quanh tâm chỉ định
  const zoomAroundPoint = useCallback((screenX: number, screenY: number, targetZoom: number) => {
    const curCam = cameraRef.current;
    const finalZoom = clampZoom(targetZoom);
    if (finalZoom === curCam.zoom) return;

    const worldX = (screenX - curCam.x) / curCam.zoom;
    const worldY = (screenY - curCam.y) / curCam.zoom;

    const newCamX = screenX - worldX * finalZoom;
    const newCamY = screenY - worldY * finalZoom;

    const clamped = clampCamera(newCamX, newCamY, finalZoom);
    cameraRef.current = { x: clamped.x, y: clamped.y, zoom: finalZoom };
  }, [clampZoom, clampCamera]);

  // Hàm di chuyển camera mượt mà đến tọa độ thế giới (Smooth Camera Pan Animation)
  const focusOnCoordinates = useCallback((worldX: number, worldY: number, targetZoom?: number, duration: number = 650) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const finalZoom = targetZoom ? clampZoom(targetZoom) : Math.max(1.2, cameraRef.current.zoom);

    const rawX = vpW / 2 - worldX * finalZoom;
    const rawY = vpH / 2 - worldY * finalZoom;
    const clamped = clampCamera(rawX, rawY, finalZoom);

    cameraAnimRef.current = {
      startX: cameraRef.current.x,
      startY: cameraRef.current.y,
      startZoom: cameraRef.current.zoom,
      targetX: clamped.x,
      targetY: clamped.y,
      targetZoom: finalZoom,
      startTime: performance.now(),
      duration,
    };
  }, [clampCamera, clampZoom]);

  // Chức năng: Về Vương Quốc Của Tôi (Di chuyển camera mượt mà đến trung tâm lãnh thổ người chơi)
  const focusOnPlayerKingdom = useCallback(() => {
    const player = gameDataRef.current.nations[1];
    if (!player) return;

    // Ưu tiên tâm trung bình của toàn bộ lãnh thổ người chơi, nếu chưa có thì dùng Thủ đô
    const center = nationCentersRef.current[1];
    const targetWorldX = center ? center.px : player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
    const targetWorldY = center ? center.py : player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

    focusOnCoordinates(targetWorldX, targetWorldY, Math.max(1.25, cameraRef.current.zoom));
    soundManager.playClick();
  }, [focusOnCoordinates]);

  // Chức năng: Di chuyển camera đến quốc gia chỉ định (dùng khi bấm vào bảng xếp hạng / ngoại giao)
  const focusOnNation = useCallback((nationId: number) => {
    const nation = gameDataRef.current.nations[nationId];
    if (!nation) return;

    const center = nationCentersRef.current[nationId];
    const targetWorldX = center ? center.px : nation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
    const targetWorldY = center ? center.py : nation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

    focusOnCoordinates(targetWorldX, targetWorldY, Math.max(1.2, cameraRef.current.zoom));
    soundManager.playClick();
  }, [focusOnCoordinates]);

  // Khởi tạo các hạt thời tiết (Mây trôi bồng bềnh, Mưa lất phất)
  const initWeatherParticles = useCallback((dimension: MapDimension, type: WeatherType) => {
    weatherParticlesRef.current = generateWeatherParticles(dimension, type);
  }, []);

  // Chuyển đổi kiểu thời tiết nhanh
  const cycleWeather = useCallback(() => {
    setWeather(prev => {
      const next: WeatherType = prev === 'CLEAR' ? 'CLOUDY' : prev === 'CLOUDY' ? 'RAIN' : 'CLEAR';
      weatherRef.current = next;
      initWeatherParticles(mapSize, next);
      if (next === 'RAIN') {
        nextLightningTimeRef.current = performance.now() + 1500 + Math.random() * 2000;
      }
      soundManager.playClick();
      return next;
    });
  }, [mapSize, initWeatherParticles]);

  // Bật/tắt hiệu ứng thời tiết
  const toggleWeather = useCallback(() => {
    setWeatherEnabled(prev => {
      const next = !prev;
      weatherEnabledRef.current = next;
      soundManager.playClick();
      return next;
    });
  }, []);

  // Bắt đầu game
  const startNewGame = (
    chosenDiff: GameDifficulty = difficulty, 
    chosenSize: MapDimension = mapSize,
    customName: string = playerName,
    chosenMode: GameMode = gameMode
  ) => {
    setGameMode(chosenMode);
    gameModeRef.current = chosenMode;
    const { tiles, nations } = generateWorldMap(chosenSize, chosenDiff, customName);
    setAutoExpand(chosenDiff === 'EASY');
    totalLandCountRef.current = tiles.flat().filter(t => t.terrain !== 'WATER').length;

    // Trong Chế Độ Sáng Tạo: Cung cấp sẵn tài nguyên cực khủng để trải nghiệm ngay
    if (chosenMode === 'CREATIVE' && nations[1]) {
      nations[1].gold = 999999;
      nations[1].troops = 50000;
      nations[1].maxTroops = 100000;
    }

    gameDataRef.current = {
      tiles,
      nations,
      attackWaves: [],
      particles: [],
      events: [
        {
          id: '1',
          title: chosenMode === 'CREATIVE' ? '🎨 KHỞI ĐẦU CHẾ ĐỘ SÁNG TẠO' : 'Khởi Đầu Trái Đất',
          description: chosenMode === 'CREATIVE'
            ? `Chào mừng Đấng Sáng Tạo ${nations[1]?.name}! Tự do tùy biến Vàng, Quân, Thời Tiết & Triệu hồi Tà Thần!`
            : `Chào mừng Đại Đế ${nations[1]?.name}! Xuất phát tại khu vực Việt Nam / Đông Nam Á. Hãy chinh phục các thuộc địa & làm chủ thế giới.`,
          type: 'HARVEST',
          targetNationId: 1,
          timestamp: '00:00',
        }
      ],
      researching: null,
      gameTimeSeconds: 0,
      hasMetBot: false,
      darkTitan: null,
      darkTitans: [],
      stats: { battlesCount: 0, buildingsCount: 0 },
    };

    offscreenTerrainDirtyRef.current = true;
    offscreenTerritoryDirtyRef.current = true;
    setSelectedTile(null);
    selectedTileRef.current = null;
    setCurrentQuest(1);
    setQuestDismissed(false);
    setHasMetBot(false);
    needsCenterCameraRef.current = true;
    initWeatherParticles(chosenSize, weatherRef.current);
    if (weatherRef.current === 'RAIN') {
      nextLightningTimeRef.current = performance.now() + 2000 + Math.random() * 3000;
    }
    setGameState('PLAYING');
    soundManager.playClick();
  };

  // --- HỆ THỐNG LƯU VÀ TIẾP TỤC VÁN CHƠI (SAVE / CONTINUE GAME) ---
  const saveGame = useCallback(() => {
    try {
      const data = gameDataRef.current;
      if (!data || !data.tiles || data.tiles.length === 0) return;

      const nowStr = new Date().toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });

      const payload = {
        version: 1,
        savedAt: nowStr,
        difficulty,
        mapSize,
        gameMode: gameModeRef.current,
        playerName,
        weather: weatherRef.current,
        godModeLocked: godModeLockedRef.current,
        currentQuest,
        questDismissed,
        hasMetBot,
        attackPercent,
        autoExpand,
        playerGeneralDeployMode,
        hudStats,
        gameData: {
          tiles: data.tiles,
          nations: data.nations,
          attackWaves: data.attackWaves || [],
          events: data.events || [],
          researching: data.researching || null,
          gameTimeSeconds: data.gameTimeSeconds || 0,
          hasMetBot: data.hasMetBot || false,
          darkTitan: data.darkTitan || null,
          darkTitans: data.darkTitans || [],
          stats: data.stats || { battlesCount: 0, buildingsCount: 0 }
        }
      };

      localStorage.setItem('pixel_empire_save_v1', JSON.stringify(payload));
      setSavedGameInfo({
        timestamp: nowStr,
        gameTimeStr: formatGameTime(data.gameTimeSeconds || 0),
        playerName,
        mode: gameModeRef.current === 'CREATIVE' ? 'Sáng Tạo' : 'Chiến Thuật'
      });
    } catch (err) {
      console.error('Lỗi khi lưu game:', err);
    }
  }, [difficulty, mapSize, playerName, currentQuest, questDismissed, hasMetBot, attackPercent, autoExpand, playerGeneralDeployMode, hudStats]);

  const loadGame = useCallback(() => {
    try {
      const raw = localStorage.getItem('pixel_empire_save_v1');
      if (!raw) {
        setLoadErrorToast('Không đọc được ván cũ');
        setTimeout(() => setLoadErrorToast(null), 3500);
        return;
      }
      const payload = JSON.parse(raw);
      if (!payload || !payload.gameData || !payload.gameData.tiles || !Array.isArray(payload.gameData.tiles)) {
        setLoadErrorToast('Không đọc được ván cũ');
        setTimeout(() => setLoadErrorToast(null), 3500);
        return;
      }

      const { gameData } = payload;

      setDifficulty(payload.difficulty || 'EASY');
      setMapSize(payload.mapSize || 96);
      setGameMode(payload.gameMode || 'STANDARD');
      gameModeRef.current = payload.gameMode || 'STANDARD';
      if (payload.playerName) setPlayerName(payload.playerName);
      if (payload.weather) {
        setWeather(payload.weather);
        weatherRef.current = payload.weather;
      }
      if (payload.godModeLocked !== undefined) {
        setGodModeLocked(payload.godModeLocked);
        godModeLockedRef.current = payload.godModeLocked;
      }
      if (payload.currentQuest !== undefined) setCurrentQuest(payload.currentQuest);
      if (payload.questDismissed !== undefined) setQuestDismissed(payload.questDismissed);
      if (payload.hasMetBot !== undefined) setHasMetBot(payload.hasMetBot);
      if (payload.attackPercent !== undefined) setAttackPercent(payload.attackPercent);
      if (payload.autoExpand !== undefined) setAutoExpand(payload.autoExpand);
      if (payload.playerGeneralDeployMode !== undefined) setPlayerGeneralDeployMode(payload.playerGeneralDeployMode);
      if (payload.hudStats) setHudStats(payload.hudStats);

      gameDataRef.current = {
        tiles: gameData.tiles,
        nations: gameData.nations,
        attackWaves: gameData.attackWaves || [],
        particles: [],
        events: gameData.events || [],
        researching: gameData.researching || null,
        gameTimeSeconds: gameData.gameTimeSeconds || 0,
        hasMetBot: gameData.hasMetBot || false,
        darkTitan: gameData.darkTitan || null,
        darkTitans: gameData.darkTitans || [],
        stats: gameData.stats || { battlesCount: 0, buildingsCount: 0 }
      };

      totalLandCountRef.current = gameData.tiles.flat().filter((t: Tile) => t.terrain !== 'WATER').length;
      offscreenTerrainDirtyRef.current = true;
      offscreenTerritoryDirtyRef.current = true;
      setSelectedTile(null);
      selectedTileRef.current = null;
      needsCenterCameraRef.current = true;
      initWeatherParticles(payload.mapSize || 96, weatherRef.current);

      setGameState('PLAYING');
      setIsPaused(false);
      soundManager.playClick();
    } catch (err) {
      console.error('Lỗi khi nạp ván cũ:', err);
      setLoadErrorToast('Không đọc được ván cũ');
      setTimeout(() => setLoadErrorToast(null), 3500);
    }
  }, [initWeatherParticles]);

  const deleteSavedGame = useCallback(() => {
    try {
      localStorage.removeItem('pixel_empire_save_v1');
      setSavedGameInfo(null);
    } catch (err) {
      console.error('Lỗi khi xóa ván cũ:', err);
    }
  }, []);

  const checkSavedGame = useCallback(() => {
    try {
      const raw = localStorage.getItem('pixel_empire_save_v1');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload && payload.gameData && payload.gameData.tiles) {
          setSavedGameInfo({
            timestamp: payload.savedAt || 'Đã lưu',
            gameTimeStr: formatGameTime(payload.gameData.gameTimeSeconds || 0),
            playerName: payload.playerName || 'Việt Nam',
            mode: payload.gameMode === 'CREATIVE' ? 'Sáng Tạo' : 'Chiến Thuật'
          });
          return;
        }
      }
    } catch (err) {
      console.error('Lỗi kiểm tra ván lưu:', err);
    }
    setSavedGameInfo(null);
  }, []);

  useEffect(() => {
    saveGameRef.current = saveGame;
  }, [saveGame]);

  useEffect(() => {
    if (gameState === 'TITLE') {
      checkSavedGame();
    }
  }, [gameState, checkSavedGame]);

  // Kiểm tra liên kết phòng từ URL (?room=XXXXXX) khi bạn bè mở link mời
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setUrlRoomCode(roomParam.toUpperCase().trim());
        setIsMultiplayerModalOpen(true);
      }
    } catch (e) {
      console.error('Lỗi đọc tham số URL phòng:', e);
    }
  }, []);

  useEffect(() => {
    isMultiplayerRef.current = isMultiplayer;
  }, [isMultiplayer]);

  useEffect(() => {
    myNationIdRef.current = myPlayerNationId;
  }, [myPlayerNationId]);

  const handleStartMultiplayerGame = useCallback((room: RoomState, myPlayerId: string) => {
    const me = room.players.find(p => p.id === myPlayerId);
    const myNation = me ? me.nationId : 1;
    setIsMultiplayer(true);
    setMultiplayerRoom(room);
    setMyPlayerNationId(myNation);
    myNationIdRef.current = myNation;
    isMultiplayerRef.current = true;
    setIsMultiplayerModalOpen(false);

    // Khởi tạo trận đấu
    startNewGame(room.settings.difficulty, room.settings.mapSize, me ? me.name : playerName, 'STANDARD');

    // Đồng bộ thông tin người chơi vào các quốc gia trên bản đồ
    const data = gameDataRef.current;
    room.players.forEach(p => {
      if (data.nations[p.nationId]) {
        data.nations[p.nationId].name = p.name;
        data.nations[p.nationId].color = p.color;
        data.nations[p.nationId].isPlayer = (p.nationId === myNation);
      }
    });

    data.events.unshift({
      id: Math.random().toString(),
      title: '🌐 PHÒNG CHƠI TRỰC TUYẾN',
      description: `Trận đấu phòng [${room.code}] đã bắt đầu! Có ${room.players.length} người chơi tham chiến.`,
      type: 'DIPLOMACY',
      targetNationId: myNation,
      timestamp: '00:00',
    });

    offscreenTerritoryDirtyRef.current = true;
  }, [playerName]);

  // Buffer 1: Render Địa Hình Tĩnh Tối Ưu Đồ Họa Pixel (Biển, Bọt Sóng, Núi Tuyết, Tán Rừng)
  const renderTerrainBuffer = useCallback((size: number) => {
    if (!offscreenTerrainCanvasRef.current) {
      offscreenTerrainCanvasRef.current = document.createElement('canvas');
    }
    drawTerrainBuffer(offscreenTerrainCanvasRef.current, gameDataRef.current.tiles, size);
  }, []);

  // Buffer 2: Render Đồ Họa Chuẩn OpenFront (Đường viền Neon chói & Nét căng)
  const renderTerritoryBuffer = useCallback((size: number) => {
    if (!offscreenTerritoryCanvasRef.current) {
      offscreenTerritoryCanvasRef.current = document.createElement('canvas');
    }
    const { tiles, nations } = gameDataRef.current;
    drawTerritoryBuffer(offscreenTerritoryCanvasRef.current, tiles, nations, size);
  }, []);

  // Vòng lặp Render 60 FPS Render Chuẩn OpenFront
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const render = (timestamp: number) => {
      const deltaSec = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      const clientW = canvas.clientWidth;
      const clientH = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      if (clientW > 0 && clientH > 0) {
        const targetW = Math.floor(clientW * dpr);
        const targetH = Math.floor(clientH * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
          viewportSizeRef.current = { width: clientW, height: clientH, dpr };
          offscreenTerrainDirtyRef.current = true;
          offscreenTerritoryDirtyRef.current = true;
        }
      }

      // Tự động căn giữa thủ đô
      if (needsCenterCameraRef.current && viewportSizeRef.current.width > 0 && viewportSizeRef.current.height > 0) {
        const vpW = viewportSizeRef.current.width;
        const vpH = viewportSizeRef.current.height;
        const player = gameDataRef.current.nations[1];
        if (player) {
          const initialZoom = 1.25;
          const capPxX = (player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * initialZoom;
          const capPxY = (player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * initialZoom;
          const rawX = vpW / 2 - capPxX;
          const rawY = vpH / 2 - capPxY;
          const clamped = clampCamera(rawX, rawY, initialZoom);
          cameraRef.current = { x: clamped.x, y: clamped.y, zoom: initialZoom };
        }
        needsCenterCameraRef.current = false;
      }

      // Cập nhật chuyển động lướt Camera mượt mà (Smooth Camera Animation)
      if (cameraAnimRef.current) {
        const anim = cameraAnimRef.current;
        const elapsed = timestamp - anim.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / anim.duration));
        // Ease-out cubic: chuyển động êm dịu, nhẹ nhàng dừng lại ở đích
        const ease = 1 - Math.pow(1 - progress, 3);

        const curX = anim.startX + (anim.targetX - anim.startX) * ease;
        const curY = anim.startY + (anim.targetY - anim.startY) * ease;
        const curZoom = anim.startZoom + (anim.targetZoom - anim.startZoom) * ease;

        cameraRef.current = { x: curX, y: curY, zoom: curZoom };
        if (progress >= 1) {
          cameraAnimRef.current = null;
        }
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const vpW = viewportSizeRef.current.width;
      const vpH = viewportSizeRef.current.height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, vpW, vpH);

      const currentCamera = cameraRef.current;
      const { tiles, nations, attackWaves, particles } = gameDataRef.current;

      if (tiles.length === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const size = tiles.length;

      if (offscreenTerrainDirtyRef.current || !offscreenTerrainCanvasRef.current) {
        renderTerrainBuffer(size);
        offscreenTerrainDirtyRef.current = false;
      }
      if (offscreenTerritoryDirtyRef.current || !offscreenTerritoryCanvasRef.current) {
        renderTerritoryBuffer(size);
        offscreenTerritoryDirtyRef.current = false;
      }

      ctx.save();
      ctx.translate(currentCamera.x, currentCamera.y);
      ctx.scale(currentCamera.zoom, currentCamera.zoom);

      const zoom = currentCamera.zoom;

      // 1. Draw Offscreen Layer Địa hình & Lãnh thổ
      if (offscreenTerrainCanvasRef.current) {
        ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0);
      }
      if (offscreenTerritoryCanvasRef.current) {
        ctx.drawImage(offscreenTerritoryCanvasRef.current, 0, 0);
      }

      // 1.5. Cập nhật vị trí & Vẽ bóng đổ mây trôi trên mặt đất (Cloud Shadows on Terrain)
      if (weatherEnabledRef.current) {
        const mapPx = size * TILE_PIXEL_SIZE;
        const pList = weatherParticlesRef.current;
        const pLen = pList.length;

        // Cập nhật vị trí các hạt thời tiết theo deltaSec
        for (let i = 0; i < pLen; i++) {
          const p = pList[i];
          p.x += p.vx * deltaSec;
          p.y += p.vy * deltaSec;

          if (p.type === 'CLOUD') {
            if (p.x > mapPx + 160) {
              p.x = -160;
              p.y = Math.random() * mapPx;
            }
            if (p.y > mapPx + 120) {
              p.y = -120;
            }
          } else if (p.type === 'RAIN_DROP') {
            if (p.y > mapPx + 20 || p.x > mapPx + 20) {
              p.y = -20;
              p.x = Math.random() * (mapPx + 100) - 50;
            }
          }
        }

        // Vẽ bóng đổ mây trên nền đất (nhẹ nhàng, trong suốt)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.085)';
        for (let i = 0; i < pLen; i++) {
          const p = pList[i];
          if (p.type === 'CLOUD' && p.puffs) {
            const sx = (p.x + 14) * zoom + currentCamera.x;
            const sy = (p.y + 18) * zoom + currentCamera.y;
            if (sx < -140 || sx > vpW + 140 || sy < -100 || sy > vpH + 100) continue;

            const shadowOffsetX = 14;
            const shadowOffsetY = 18;
            const puffs = p.puffs;
            for (let j = 0; j < puffs.length; j++) {
              const puff = puffs[j];
              ctx.beginPath();
              ctx.ellipse(
                p.x + puff.dx + shadowOffsetX, 
                p.y + puff.dy + shadowOffsetY, 
                puff.w, 
                puff.h, 
                0, 0, Math.PI * 2
              );
              ctx.fill();
            }
          }
        }
        ctx.restore();
      }

      // 2. Frustum Culling
      const tileSizePx = TILE_PIXEL_SIZE * zoom;
      const minTileX = Math.max(0, Math.floor(-currentCamera.x / tileSizePx));
      const maxTileX = Math.min(size - 1, Math.ceil((vpW - currentCamera.x) / tileSizePx));
      const minTileY = Math.max(0, Math.floor(-currentCamera.y / tileSizePx));
      const maxTileY = Math.min(size - 1, Math.ceil((vpH - currentCamera.y) / tileSizePx));

      // 3. Hiệu ứng Hào quang Thủ Đô (Capital Aura Rings)
      const pulseTime = timestamp / 800;
      nations.forEach(nation => {
        if (nation.id === 0 || nation.isEliminated) return;
        const cx = nation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const cy = nation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

        if (cx * zoom + currentCamera.x >= -60 && cx * zoom + currentCamera.x <= vpW + 60 &&
            cy * zoom + currentCamera.y >= -60 && cy * zoom + currentCamera.y <= vpH + 60) {
          const isMajor = nation.isPlayer || nation.tier === 'BOSS';
          if (isMajor) {
            const auraRadius = (16 + Math.sin(pulseTime) * 4);
            ctx.strokeStyle = nation.isPlayer ? 'rgba(56, 189, 248, 0.45)' : 'rgba(244, 63, 94, 0.45)';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });

      // 3.8. Vẽ Phòng Tuyến Chiến Hào (Tính năng 1 - Trenches & Supply Lines)
      ctx.save();
      ctx.lineWidth = 1.5;
      for (let y = minTileY; y <= maxTileY; y++) {
        for (let x = minTileX; x <= maxTileX; x++) {
          const t = tiles[y]?.[x];
          if (!t || t.owner === 0 || t.terrain === 'WATER') continue;
          const cx = x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const cy = y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

          // Kết nối chiến hào sang ô bên phải nếu cùng chủ sở hữu
          if (x + 1 < size && tiles[y][x + 1]?.owner === t.owner) {
            ctx.strokeStyle = t.owner === 1 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(239, 68, 68, 0.22)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + TILE_PIXEL_SIZE, cy);
            ctx.stroke();
          }
          // Kết nối chiến hào xuống ô bên dưới nếu cùng chủ sở hữu
          if (y + 1 < size && tiles[y + 1]?.[x]?.owner === t.owner) {
            ctx.strokeStyle = t.owner === 1 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(239, 68, 68, 0.22)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy + TILE_PIXEL_SIZE);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 4. Vẽ Vùng Đất Cháy & Công Trình trong màn hình
      for (let y = minTileY; y <= maxTileY; y++) {
        for (let x = minTileX; x <= maxTileX; x++) {
          const t = tiles[y]?.[x];
          if (!t) continue;
          const px = x * TILE_PIXEL_SIZE;
          const py = y * TILE_PIXEL_SIZE;

          // 4.1. Hiệu ứng Vùng Đất Cháy / Chiến Địa (Tính năng 4 - Scorched Earth)
          if (t.scorchedTimer && t.scorchedTimer > 0) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
            // Đốm than đỏ & tro xám
            ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
            ctx.fillRect(px + 4, py + 4, 3, 3);
            ctx.fillStyle = 'rgba(249, 115, 22, 0.5)';
            ctx.fillRect(px + 14, py + 12, 2, 2);
          }

          // 4.2. Vẽ Công Trình
          if (t.building !== 'NONE') {
            ctx.fillStyle = '#fbbf24';
            if (t.building === 'CITY') {
              ctx.fillRect(px + 6, py + 8, 12, 10);
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(px + 4, py + 4, 16, 5);
            } else if (t.building === 'BARRACKS') {
              ctx.fillStyle = '#dc2626';
              ctx.fillRect(px + 4, py + 8, 16, 12);
            } else if (t.building === 'FORTRESS') {
              ctx.fillStyle = '#475569';
              ctx.fillRect(px + 4, py + 4, 16, 16);
            } else if (t.building === 'PORT') {
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(px + 4, py + 10, 16, 10);
            } else if (t.building === 'ARTILLERY') {
              // Đại Pháo Tầm Xa (Tính năng 5): Bệ thép xám + Khối năng lượng cam + Nòng đôi
              ctx.fillStyle = '#334155';
              ctx.fillRect(px + 3, py + 12, 18, 8);
              ctx.fillStyle = '#ea580c';
              ctx.fillRect(px + 7, py + 8, 10, 5);
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(px + 9, py + 2, 2, 8);
              ctx.fillRect(px + 13, py + 2, 2, 8);
            } else if (t.building === 'MISSILE_SILO') {
              // Bệ Tên Lửa
              ctx.fillStyle = '#881337';
              ctx.fillRect(px + 4, py + 4, 16, 16);
              ctx.fillStyle = '#f43f5e';
              ctx.fillRect(px + 10, py + 6, 4, 12);
              ctx.fillStyle = '#ffb703';
              ctx.fillRect(px + 11, py + 2, 2, 5);
            } else if (t.building === 'AIR_DEFENSE') {
              // Trạm Phòng Không
              ctx.fillStyle = '#065f46';
              ctx.fillRect(px + 4, py + 4, 16, 16);
              ctx.fillStyle = '#10b981';
              ctx.fillRect(px + 8, py + 8, 8, 8);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(px + 11, py + 5, 2, 6);
            }

            // Hiển thị nhãn cấp độ xây chồng công trình (L2, L3...)
            const lvl = t.buildingLevel || 1;
            if (lvl > 1) {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(px + TILE_PIXEL_SIZE - 11, py + 1, 10, 9);
              ctx.fillStyle = '#fbbf24';
              ctx.font = 'bold 8px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(`L${lvl}`, px + TILE_PIXEL_SIZE - 6, py + 8);
            }
          }
        }
      }

      // 4.5. Vẽ Vùng Chọn Ô Đất (Selection Highlight) sắc nét, định vị 4 góc
      if (selectedTileRef.current) {
        const st = selectedTileRef.current;
        const spx = st.x * TILE_PIXEL_SIZE;
        const spy = st.y * TILE_PIXEL_SIZE;
        const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.007);

        ctx.save();
        ctx.strokeStyle = st.owner === 1 ? `rgba(251, 191, 36, ${0.75 + pulse * 0.25})` : `rgba(56, 189, 248, ${0.75 + pulse * 0.25})`;
        ctx.lineWidth = 2.0;
        ctx.strokeRect(spx + 1, spy + 1, TILE_PIXEL_SIZE - 2, TILE_PIXEL_SIZE - 2);

        // 4 góc định vị sắc nét
        ctx.fillStyle = st.owner === 1 ? '#fbbf24' : '#38bdf8';
        const cLen = 5;
        ctx.fillRect(spx, spy, cLen, 2); ctx.fillRect(spx, spy, 2, cLen);
        ctx.fillRect(spx + TILE_PIXEL_SIZE - cLen, spy, cLen, 2); ctx.fillRect(spx + TILE_PIXEL_SIZE - 2, spy, 2, cLen);
        ctx.fillRect(spx, spy + TILE_PIXEL_SIZE - 2, cLen, 2); ctx.fillRect(spx, spy + TILE_PIXEL_SIZE - cLen, 2, cLen);
        ctx.fillRect(spx + TILE_PIXEL_SIZE - cLen, spy + TILE_PIXEL_SIZE - 2, cLen, 2); ctx.fillRect(spx + TILE_PIXEL_SIZE - 2, spy + TILE_PIXEL_SIZE - cLen, 2, cLen);
        ctx.restore();
      }

      // 4.8. Hiệu ứng Thời tiết (Mây trắng bồng bềnh & Hạt mưa lướt trên không gian)
      if (weatherEnabledRef.current) {
        const pList = weatherParticlesRef.current;
        const pLen = pList.length;

        // Phủ lớp sương lam nhẹ khi trời mưa
        if (weatherRef.current === 'RAIN') {
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
          ctx.fillRect(0, 0, size * TILE_PIXEL_SIZE, size * TILE_PIXEL_SIZE);
          ctx.restore();
        }

        ctx.save();
        for (let i = 0; i < pLen; i++) {
          const p = pList[i];

          if (p.type === 'CLOUD' && p.puffs) {
            const sx = p.x * zoom + currentCamera.x;
            const sy = p.y * zoom + currentCamera.y;
            if (sx < -140 || sx > vpW + 140 || sy < -100 || sy > vpH + 100) continue;

            const puffs = p.puffs;
            for (let j = 0; j < puffs.length; j++) {
              const puff = puffs[j];
              ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * puff.alpha})`;
              ctx.beginPath();
              ctx.ellipse(p.x + puff.dx, p.y + puff.dy, puff.w, puff.h, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (p.type === 'RAIN_DROP' && weatherRef.current === 'RAIN') {
            const sx = p.x * zoom + currentCamera.x;
            const sy = p.y * zoom + currentCamera.y;
            if (sx < -40 || sx > vpW + 40 || sy < -40 || sy > vpH + 40) continue;

            ctx.strokeStyle = `rgba(186, 230, 253, ${p.opacity})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 3.2, p.y - p.height);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 5. Phân biệt rõ Nhãn Quốc Gia (👑 Crown) vs 3 Loại Thuộc Địa (🌲 Rừng, ⛺ Bộ Lạc, 🛡️ Dân Tộc)
      if (currentCamera.zoom >= 0.30) {
        const centers = nationCentersRef.current;
        nations.forEach(nation => {
          if (nation.id === 0 || nation.isEliminated) return;
          const pos = centers[nation.id];
          if (!pos) return;

          const screenPxX = pos.px * zoom + currentCamera.x;
          const screenPxY = pos.py * zoom + currentCamera.y;
          if (screenPxX < -120 || screenPxX > vpW + 120 || screenPxY < -60 || screenPxY > vpH + 60) {
            return;
          }

          const isMajorNation = nation.isPlayer || nation.tier === 'BOSS';
          let iconPrefix = '⛺ ';
          if (isMajorNation) {
            iconPrefix = '👑 ';
          } else if (nation.colonyCategory === 'FOREST') {
            iconPrefix = '🌲 ';
          } else if (nation.colonyCategory === 'TRIBE') {
            iconPrefix = '⛺ ';
          } else if (nation.colonyCategory === 'ETHNIC') {
            iconPrefix = '🛡️ ';
          }

          const nameStr = `${iconPrefix}${nation.name}`;
          const popStr = `👥 ${formatPopulation(nation.population || 0)}`;

          ctx.font = isMajorNation ? 'bold 11px sans-serif' : '10px sans-serif';
          const nameWidth = ctx.measureText(nameStr).width;
          ctx.font = '9px sans-serif';
          const popWidth = ctx.measureText(popStr).width;
          const boxWidth = Math.max(nameWidth, popWidth) + (isMajorNation ? 16 : 12);
          const boxHeight = isMajorNation ? 28 : 24;

          ctx.fillStyle = isMajorNation ? 'rgba(15, 23, 42, 0.92)' : 'rgba(30, 41, 59, 0.85)';
          ctx.strokeStyle = nation.color;
          ctx.lineWidth = isMajorNation ? 2.0 : 1.2;

          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(pos.px - boxWidth / 2, pos.py - boxHeight / 2, boxWidth, boxHeight, 6);
          } else {
            ctx.rect(pos.px - boxWidth / 2, pos.py - boxHeight / 2, boxWidth, boxHeight);
          }
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.fillStyle = isMajorNation ? '#ffffff' : '#cbd5e1';
          ctx.font = isMajorNation ? 'bold 10px sans-serif' : '9px sans-serif';
          ctx.fillText(nameStr, pos.px, pos.py - (isMajorNation ? 6 : 5));

          ctx.fillStyle = isMajorNation ? '#cbd5e1' : '#94a3b8';
          ctx.font = '9px sans-serif';
          ctx.fillText(popStr, pos.px, pos.py + (isMajorNation ? 6 : 5));
        });
      }

      // 6. Render Mô hình Tướng (CHỈ hiện khi Ra Trận / Gần chiến trường, KHÔNG hiện khi nhàn rỗi) & Đợt tiến công
      nations.forEach(nation => {
        if (nation.id === 0 || nation.isEliminated || !nation.general) return;
        const gen = nation.general;

        // TƯỚNG CHỈ HIỂN THỊ KHI RA TRẬN (MARCHING), KHÔNG HIỂN THỊ KHI NHÀN RỖI (IDLE/RECOVERING)
        if (gen.status === 'MARCHING') {
          const gx = gen.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const gy = gen.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

          // Hào quang Tướng Đại Diện
          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.beginPath();
          ctx.arc(gx, gy, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Sprite Tướng (Biểu tượng Kiếm Vàng)
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(gx, gy, 7.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚔️', gx, gy + 3);

          // Tag Tướng (+30% Sức Mạnh)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.0;
          const tagText = `⚔️ ${gen.name} (+30%)`;
          ctx.font = 'bold 9px sans-serif';
          const tw = ctx.measureText(tagText).width + 8;
          ctx.fillRect(gx - tw / 2, gy - 20, tw, 14);
          ctx.strokeRect(gx - tw / 2, gy - 20, tw, 14);

          ctx.fillStyle = '#fbbf24';
          ctx.fillText(tagText, gx, gy - 13);
        }
      });

      // Hoạt ảnh (Animation) Đợt quân di chuyển Mượt mà (OpenFront Laser / Chevron Trail)
      attackWaves.forEach(wave => {
        const curX = (wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const curY = (wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const nation = nations[wave.fromNation];

        // Nếu đợt quân được Tướng trực tiếp chỉ huy, cập nhật vị trí Tướng theo đợt quân!
        if (wave.hasGeneral && nation?.general && nation.general.status === 'MARCHING') {
          nation.general.x = wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress;
          nation.general.y = wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress;
        }

        // Vệt di chuyển Neon
        ctx.strokeStyle = wave.hasGeneral ? '#f59e0b' : (nation?.color || '#ffffff');
        ctx.lineWidth = wave.hasGeneral ? 4.2 : 3.2;
        ctx.beginPath();
        ctx.moveTo(wave.sourceX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2, wave.sourceY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Đầu Mũi Tên Quân Đội
        ctx.fillStyle = wave.hasGeneral ? '#f59e0b' : (nation?.color || '#ffffff');
        ctx.beginPath();
        ctx.arc(curX, curY, wave.hasGeneral ? 8 : 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Nhãn quân số (Kèm icon ⚔️ +30% nếu có Tướng)
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = wave.hasGeneral ? '#f59e0b' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${wave.hasGeneral ? '⚔️ ' : ''}${wave.troops}`, curX, curY - 9);
      });

      // 6.5. Render Tà Thần Cổ Đại (Hỗ trợ nhiều Tà Thần khi Spam trong Creative Mode)
      const titansToRender = (gameDataRef.current.darkTitans && gameDataRef.current.darkTitans.length > 0)
        ? gameDataRef.current.darkTitans.filter(t => t.isActive)
        : (gameDataRef.current.darkTitan && gameDataRef.current.darkTitan.isActive ? [gameDataRef.current.darkTitan] : []);

      titansToRender.forEach(titan => {
        const tx = titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const ty = titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const pulse = Math.sin(timestamp * 0.006);

        ctx.save();
        // Hào quang ma thuật hắc ám (Dark Purple & Crimson Aura)
        const auraGrad = ctx.createRadialGradient(tx, ty, 4, tx, ty, 24 + pulse * 4);
        auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
        auraGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, 28 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();

        // Thân Tà Thần hắc diện
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(tx, ty, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Sừng ác quỷ sắc bén
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.moveTo(tx - 8, ty - 6);
        ctx.lineTo(tx - 14, ty - 18);
        ctx.lineTo(tx - 4, ty - 10);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tx + 8, ty - 6);
        ctx.lineTo(tx + 14, ty - 18);
        ctx.lineTo(tx + 4, ty - 10);
        ctx.fill();

        // Mắt quỷ đỏ rực
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(tx - 5, ty - 3, 3, 3);
        ctx.fillRect(tx + 2, ty - 3, 3, 3);

        // Biển tên & Đồng hồ đếm ngược tồn tại
        const remMin = Math.floor(titan.remainingTime / 60);
        const remSec = titan.remainingTime % 60;
        const titanLabel = `👿 TÀ THẦN [${remMin}:${remSec.toString().padStart(2, '0')}]`;

        ctx.font = 'bold 9px sans-serif';
        const tlw = ctx.measureText(titanLabel).width + 10;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.2;
        ctx.fillRect(tx - tlw / 2, ty - 28, tlw, 14);
        ctx.strokeRect(tx - tlw / 2, ty - 28, tlw, 14);

        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText(titanLabel, tx, ty - 21);

        // Thanh Máu HP Tà Thần
        const currentHp = titan.hp ?? DARK_TITAN_CONFIG.MAX_HP;
        const maxHp = titan.maxHp ?? DARK_TITAN_CONFIG.MAX_HP;
        const hpRatio = Math.max(0, Math.min(1, currentHp / maxHp));

        const barW = 38;
        const barH = 5;
        const barX = tx - barW / 2;
        const barY = ty + 14;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentHp}/${maxHp} HP`, tx, barY + 11);

        ctx.restore();
      });

      // 7. Particles & Floating Texts
      particles.forEach(p => {
        if (p.type === 'FLOAT_TEXT' && p.text) {
          ctx.save();
          ctx.font = 'bold 13px sans-serif';
          ctx.fillStyle = p.color;
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.textAlign = 'center';
          ctx.globalAlpha = Math.max(0.1, p.life / p.maxLife);
          ctx.fillText(p.text, p.x, p.y);
          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      });
      ctx.globalAlpha = 1.0;

      ctx.restore();

      // 8. Hiệu ứng chớp nháy toàn màn hình giả lập Tia Chớp (Lightning Flash) khi trời MƯA (RAIN)
      if (weatherEnabledRef.current && weatherRef.current === 'RAIN') {
        // Kiểm tra kích hoạt tia chớp tiếp theo
        if (timestamp >= nextLightningTimeRef.current) {
          lightningFlashRef.current = { startTime: timestamp, duration: 280 };
          // Chu kỳ chớp tiếp theo ngẫu nhiên sau 5 - 11 giây
          nextLightningTimeRef.current = timestamp + 5000 + Math.random() * 6000;
          soundManager.playThunder();
        }

        if (lightningFlashRef.current) {
          const elapsed = timestamp - lightningFlashRef.current.startTime;
          const dur = lightningFlashRef.current.duration;
          if (elapsed < dur) {
            // Hiệu ứng chớp giật 2 nhịp kịch tính (Double-pulse lightning)
            let flashAlpha = 0;
            if (elapsed < 45) {
              flashAlpha = 0.42 * (elapsed / 45); // Nhịp 1: Bừng sáng rực rỡ
            } else if (elapsed < 85) {
              flashAlpha = 0.42 - 0.28 * ((elapsed - 45) / 40); // Nháy thụt nhẹ tự nhiên
            } else if (elapsed < 140) {
              flashAlpha = 0.38 * (1 - (elapsed - 85) / 55); // Nhịp 2: Bật sáng trở lại
            } else {
              flashAlpha = 0.16 * (1 - (elapsed - 140) / (dur - 140)); // Tan dần êm dịu
            }

            if (flashAlpha > 0.01) {
              ctx.save();
              ctx.fillStyle = `rgba(224, 242, 254, ${flashAlpha})`;
              ctx.fillRect(0, 0, vpW, vpH);
              ctx.restore();
            }
          } else {
            lightningFlashRef.current = null;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [renderTerrainBuffer, renderTerritoryBuffer, clampCamera]);

  // Vòng lặp Logic Game
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;

    const intervalTime = 1000 / gameSpeed;
    const interval = setInterval(() => {
      const data = gameDataRef.current;
      const { tiles, nations } = data;
      if (!tiles || tiles.length === 0) return;

      data.gameTimeSeconds += 1;
      const size = tiles.length;

      // Tự động lưu game mỗi 30 giây khi đang chơi
      if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 30 === 0) {
        saveGameRef.current();
      }

      // Chu kỳ chuyển dịch thời tiết tự nhiên mỗi 80s (Nắng nhẹ -> Mây trôi -> Mưa lất phất)
      if (weatherEnabledRef.current && data.gameTimeSeconds > 0 && data.gameTimeSeconds % 80 === 0) {
        setWeather(prev => {
          const next: WeatherType = prev === 'CLEAR' ? 'CLOUDY' : prev === 'CLOUDY' ? 'RAIN' : 'CLEAR';
          weatherRef.current = next;
          initWeatherParticles(size as MapDimension, next);
          if (next === 'RAIN') {
            nextLightningTimeRef.current = performance.now() + 2000 + Math.random() * 3000;
          }
          return next;
        });
      }

      // Quyền năng God Mode (Khóa Bất Tử): Tự động hồi phục 999.999 vàng và 99.999 quân
      if (godModeLockedRef.current && nations[1]) {
        nations[1].gold = 999999;
        nations[1].troops = 99999;
        nations[1].maxTroops = Math.max(nations[1].maxTroops, 100000);
      }

      // --- Quản lý TẤT CẢ Tà Thần Cổ Đại (Hỗ trợ Spam nhiều Tà Thần) ---
      data.darkTitans = data.darkTitans || [];
      if (!data.darkTitan && data.darkTitans.length === 0 && data.gameTimeSeconds >= DARK_TITAN_CONFIG.SPAWN_TIME_SECONDS) {
        const landTiles: { x: number; y: number }[] = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (tiles[y][x].terrain !== 'WATER') {
              landTiles.push({ x, y });
            }
          }
        }
        if (landTiles.length > 0) {
          const spawnTile = landTiles[Math.floor(Math.random() * landTiles.length)];
          const newTitan: DarkTitan = {
            id: Math.random().toString(),
            isActive: true,
            spawnTimestamp: data.gameTimeSeconds,
            remainingTime: DARK_TITAN_CONFIG.DURATION_SECONDS,
            x: spawnTile.x,
            y: spawnTile.y,
            hp: DARK_TITAN_CONFIG.MAX_HP,
            maxHp: DARK_TITAN_CONFIG.MAX_HP,
            moveTimer: 0,
            hasWarnedDespawn: false,
          };
          data.darkTitans.push(newTitan);
          data.darkTitan = newTitan;

          soundManager.playThunder();
          data.events.unshift({
            id: Math.random().toString(),
            title: '⚠️ TÀ THẦN GIÁNG LÂM',
            description: `Tà Thần cổ đại đã thức tỉnh tại (${spawnTile.x}, ${spawnTile.y})! Bất kỳ quốc gia hay công trình nào trên đường đi sẽ bị hủy diệt!`,
            type: 'PLAGUE',
            targetNationId: 0,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });

          data.particles.push({
            x: spawnTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: spawnTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#dc2626',
            size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.8,
            type: 'FLOAT_TEXT',
            text: '⚠️ TÀ THẦN GIÁNG LÂM ⚠️',
          });
        }
      }

      // Cập nhật tất cả các Tà Thần đang sống
      data.darkTitans.forEach(titan => {
        if (!titan.isActive) return;
        titan.remainingTime -= 1;

        // Cảnh báo trước khi biến mất
        if (titan.remainingTime === DARK_TITAN_CONFIG.WARNING_BEFORE_DESPAWN && !titan.hasWarnedDespawn) {
          titan.hasWarnedDespawn = true;
          data.events.unshift({
            id: Math.random().toString(),
            title: '⏳ TÀ THẦN SUY YẾU',
            description: `Năng lượng hắc ám tiêu tán, Tà Thần sẽ biến mất sau ${DARK_TITAN_CONFIG.WARNING_BEFORE_DESPAWN} giây nữa!`,
            type: 'PLAGUE',
            targetNationId: 0,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }

        // Hết thời gian -> Biến mất
        if (titan.remainingTime <= 0) {
          soundManager.playCapture();
          data.events.unshift({
            id: Math.random().toString(),
            title: '✨ TÀ THẦN BIẾN MẤT',
            description: 'Tà Thần đã cạn kiệt nguyên khí và tan biến vào hư không. Các quốc gia tạm thời bình yên!',
            type: 'HARVEST',
            targetNationId: 0,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });

          data.particles.push({
            x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#a855f7',
            size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.7,
            type: 'FLOAT_TEXT',
            text: '✨ Tà Thần Tan Biến',
          });

          titan.isActive = false;
        } else {
          // Di chuyển theo chu kỳ cấu hình (mặc định 8 giây / ô)
          titan.moveTimer += 1;
          if (titan.moveTimer >= DARK_TITAN_CONFIG.MOVE_INTERVAL_SECONDS) {
            titan.moveTimer = 0;

            const neighbors = [
              [titan.x + 1, titan.y], [titan.x - 1, titan.y],
              [titan.x, titan.y + 1], [titan.x, titan.y - 1],
              [titan.x + 1, titan.y + 1], [titan.x - 1, titan.y - 1],
              [titan.x + 1, titan.y - 1], [titan.x - 1, titan.y + 1],
            ].filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain !== 'WATER');

            if (neighbors.length > 0) {
              const targetOption = neighbors.find(([nx, ny]) => tiles[ny][nx].building !== 'NONE' || tiles[ny][nx].owner > 0) ||
                neighbors[Math.floor(Math.random() * neighbors.length)];

              titan.x = targetOption[0];
              titan.y = targetOption[1];

              const currentTile = tiles[titan.y][titan.x];

              // Phá hoặc hạ cấp công trình
              if (currentTile.building !== 'NONE') {
                const oldBuilding = currentTile.building;
                if (oldBuilding === 'FORTRESS') {
                  currentTile.building = 'CITY'; // Hạ cấp
                } else {
                  currentTile.building = 'NONE'; // Phá hủy hoàn toàn
                }
                offscreenTerritoryDirtyRef.current = true;
                data.particles.push({
                  x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#ef4444',
                  size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
                  type: 'FLOAT_TEXT',
                  text: `💥 Tà Thần phá hoại ${BUILDING_INFO[oldBuilding].name}!`,
                });
              }

              // Giảm quân đội của quốc gia ở ô đó (không phân biệt người chơi hay bot)
              if (currentTile.owner > 0) {
                const victim = nations[currentTile.owner];
                if (victim) {
                  victim.troops = Math.max(0, victim.troops - DARK_TITAN_CONFIG.DAMAGE_TROOPS);
                  data.particles.push({
                    x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                    y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                    color: '#dc2626',
                    size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.5,
                    type: 'FLOAT_TEXT',
                    text: `☠️ -${DARK_TITAN_CONFIG.DAMAGE_TROOPS} Quân (${victim.name})`,
                  });
                }
              }
            }
          }
        }
      });

      // Lọc bỏ Tà Thần đã hết giờ
      data.darkTitans = data.darkTitans.filter(t => t.isActive);
      data.darkTitan = data.darkTitans[0] || null;

      // 1. Thống kê & Tính vị trí Tâm Quốc Gia
      const territoryCounts: Record<number, number> = {};
      const buildingCounts: Record<number, Record<BuildingType, number>> = {};
      const centersSum: Record<number, { sumX: number; sumY: number; count: number }> = {};

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const t = tiles[y][x];
          if (t.owner > 0) {
            territoryCounts[t.owner] = (territoryCounts[t.owner] || 0) + 1;
            if (!centersSum[t.owner]) centersSum[t.owner] = { sumX: 0, sumY: 0, count: 0 };
            centersSum[t.owner].sumX += x;
            centersSum[t.owner].sumY += y;
            centersSum[t.owner].count += 1;

            if (t.building !== 'NONE') {
              if (!buildingCounts[t.owner]) buildingCounts[t.owner] = { NONE: 0, CITY: 0, BARRACKS: 0, FORTRESS: 0, PORT: 0, ARTILLERY: 0, MISSILE_SILO: 0, AIR_DEFENSE: 0 };
              const levelWeight = t.buildingLevel || 1;
              buildingCounts[t.owner][t.building] = (buildingCounts[t.owner][t.building] || 0) + levelWeight;
            }
          }
        }
      }

      const newCenters: Record<number, { px: number; py: number }> = {};
      Object.keys(centersSum).forEach(idStr => {
        const id = Number(idStr);
        const c = centersSum[id];
        if (c && c.count > 0) {
          newCenters[id] = {
            px: (c.sumX / c.count) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            py: (c.sumY / c.count) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          };
        }
      });
      nationCentersRef.current = newCenters;

      // 2. Cập nhật Dân số, Quân đội & Vàng
      let botMet = false;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (tiles[y][x].owner === 1) {
            const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
            if (neighbors.some(([nx, ny]) => tiles[ny]?.[nx]?.owner > 1)) {
              botMet = true;
              break;
            }
          }
        }
        if (botMet) break;
      }
      data.hasMetBot = botMet;
      setHasMetBot(botMet);

      nations.forEach(n => {
        if (n.id === 0 || n.isEliminated) return;
        if (n.titanBuffTimer && n.titanBuffTimer > 0) {
          n.titanBuffTimer -= 1;
        }
        const titanBuff = (n.titanBuffTimer && n.titanBuffTimer > 0) ? 1.30 : 1.0;

        n.territoryCount = territoryCounts[n.id] || 0;
        const b = buildingCounts[n.id];
        n.hasPort = (b?.PORT || 0) > 0;

        n.population += Math.floor((n.territoryCount * 0.05 + (b?.CITY || 0) * 1) * titanBuff);

        const diffMult = difficulty === 'HARD' ? 1.3 : difficulty === 'NORMAL' ? 1.15 : 1.0;
        const milTechTroopBonus = n.techLevels?.military >= 2 ? 30 : 0;
        n.maxTroops = Math.max(15, Math.floor((n.population * 3 + n.territoryCount * 4 + (b?.BARRACKS || 0) * 40 + milTechTroopBonus) * (n.id > 1 ? diffMult : 1.0) * titanBuff));
        
        const growth = Math.max(1, Math.floor((n.population * 0.1 + (b?.BARRACKS || 0) * 3) * (n.id > 1 ? diffMult : 1.0) * titanBuff));
        if (n.troops < n.maxTroops) {
          n.troops = Math.min(n.maxTroops, Math.round(n.troops + growth));
        }

        // Giảm sức mạnh công nghệ kinh tế: Level 1 (+8%), Level 2 (+15%), Level 3 (+25%)
        const ecoMult = n.techLevels?.economy === 1 ? 1.08 : n.techLevels?.economy === 2 ? 1.15 : n.techLevels?.economy === 3 ? 1.25 : 1.0;
        n.goldIncome = Math.max(1, Math.floor((n.population * 0.12 + n.territoryCount * 0.08 + (b?.CITY || 0) * 3) * (n.id > 1 ? diffMult : 1.0) * ecoMult * titanBuff));
        n.gold += n.goldIncome;

        // Quản lý Tướng đại diện quốc gia
        if (n.general) {
          if (n.general.status === 'RECOVERING') {
            n.general.reviveTimer -= 1;
            if (n.general.reviveTimer <= 0) {
              n.general.status = 'IDLE';
              n.general.x = n.capitalX;
              n.general.y = n.capitalY;
              if (n.isPlayer) {
                data.particles.push({
                  x: n.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: n.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#fbbf24', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.6,
                  type: 'FLOAT_TEXT', text: `⚔️ ${n.general.name} đã bình phục!`
                });
              }
            }
          } else if (n.general.status === 'MARCHING') {
            const activeWave = data.attackWaves.find(w => w.fromNation === n.id);
            if (!activeWave) {
              n.general.status = 'IDLE';
              n.general.x = n.capitalX;
              n.general.y = n.capitalY;
            }
          }
        }

        // Quản lý Tiến Hóa Thuộc Địa: Dân Tộc -> Đế Quốc Độc Lập
        if (n.colonyCategory === 'ETHNIC' && n.colonyEvolveTimer !== undefined && n.colonyEvolveTimer > 0) {
          n.colonyEvolveTimer -= 1;
          if (n.colonyEvolveTimer <= 0 && n.population >= 12) {
            n.tier = 'BOSS';
            n.colonyCategory = undefined;
            const cleanName = n.name.replace(/\[Dân Tộc\]|\[Thuộc Địa\]/g, '').trim();
            n.name = `${cleanName} (Đế Quốc)`;
            if (n.general) {
              n.general.name = `Đại Tướng ${cleanName}`;
            }
            n.gold += 150;
            n.troops += 25;
            data.events.unshift({
              id: Math.random().toString(),
              title: 'Trỗi Dậy Độc Lập',
              description: `👑 Cộng đồng Sắc Tộc ${cleanName} đã lớn mạnh và chính thức tuyên bố thành lập Đế Quốc độc lập!`,
              type: 'DIPLOMACY',
              targetNationId: n.id,
              timestamp: formatGameTime(data.gameTimeSeconds),
            });
            offscreenTerritoryDirtyRef.current = true;
          }
        }

        if (n.territoryCount === 0 && n.id > 1) {
          n.isEliminated = true;
        }
      });

      // 3. Nghiên cứu công nghệ
      if (data.researching) {
        data.researching.remainingTime -= 1;
        if (data.researching.remainingTime <= 0) {
          const tech = TECH_TREE.find(t => t.id === data.researching?.techId);
          if (tech) {
            const player = nations[1];
            if (tech.branch === 'ECONOMY') player.techLevels.economy = tech.level;
            if (tech.branch === 'MILITARY') player.techLevels.military = tech.level;
            if (tech.branch === 'DEFENSE') player.techLevels.defense = tech.level;
            soundManager.playBuild();
            if (currentQuest === 4) setCurrentQuest(5);
          }
          data.researching = null;
        }
      }

      // 3.5. Xử lý Vùng Đất Cháy & Pháo Kích Tầm Xa & Giao Thương Đồng Minh
      const playerNation = nations[1];

      // Tính năng 3: Giao thương kinh tế Đồng Minh (+10% vàng từ đồng minh mỗi chu kỳ)
      if (playerNation && !playerNation.isEliminated) {
        let tradeIncome = 0;
        nations.forEach(bot => {
          if (bot.id > 1 && !bot.isEliminated && playerNation.diplomacy[bot.id]?.status === 'ALLIANCE') {
            tradeIncome += Math.max(1, Math.floor(bot.goldIncome * 0.10));
          }
        });
        if (tradeIncome > 0) {
          playerNation.gold += tradeIncome;
          if (data.gameTimeSeconds % 10 === 0) {
            data.particles.push({
              x: playerNation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: playerNation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#10b981',
              size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
              type: 'FLOAT_TEXT', text: `🤝 +${tradeIncome} Vàng Đồng Minh`
            });
          }
        }
      }

      // Tính năng 4: Đếm lùi thời gian Đất Cháy (Scorched Earth)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const t = tiles[y]?.[x];
          if (t && t.scorchedTimer && t.scorchedTimer > 0) {
            t.scorchedTimer -= 1;
            if (Math.random() < 0.2) {
              data.particles.push({
                x: x * TILE_PIXEL_SIZE + Math.random() * TILE_PIXEL_SIZE,
                y: y * TILE_PIXEL_SIZE + Math.random() * TILE_PIXEL_SIZE,
                color: '#475569',
                size: 2, life: 15, maxLife: 15,
                vx: (Math.random() - 0.5) * 0.4, vy: -0.5,
                type: 'SPARK'
              });
            }
          }
        }
      }

      // Tính năng 5: Đại Pháo Tầm Xa (Siege Artillery) tự động nã pháo plasma mỗi 15s
      if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 15 === 0) {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const t = tiles[y]?.[x];
            if (t && t.building === 'ARTILLERY' && t.owner > 0) {
              const gunnerNation = nations[t.owner];
              if (!gunnerNation || gunnerNation.isEliminated) continue;

              const gunnerLvl = t.buildingLevel || 1;
              const artilleryDamage = 15 * gunnerLvl;
              const maxRange = 5.5 + Math.min(3, gunnerLvl - 1);

              // Quét ô địch trong phạm vi thích ứng theo cấp độ pháo
              let bestTarget: Tile | null = null;
              let bestDist = 999;
              for (let dy = -6; dy <= 6; dy++) {
                for (let dx = -6; dx <= 6; dx++) {
                  const tx = x + dx;
                  const ty = y + dy;
                  if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                    const dist = Math.hypot(dx, dy);
                    if (dist > 0 && dist <= maxRange) {
                      const candidate = tiles[ty][tx];
                      if (candidate.owner > 0 && candidate.owner !== t.owner) {
                        const dip = gunnerNation.diplomacy[candidate.owner]?.status;
                        if (dip !== 'ALLIANCE' && dip !== 'TRUCE' && dist < bestDist) {
                          bestDist = dist;
                          bestTarget = candidate;
                        }
                      }
                    }
                  }
                }
              }

              if (bestTarget) {
                const enemyNat = nations[bestTarget.owner];
                if (enemyNat) {
                  enemyNat.troops = Math.max(0, enemyNat.troops - artilleryDamage);
                }
                // Hiệu ứng đạn pháo nổ plasma
                data.particles.push({
                  x: bestTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: bestTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#ef4444',
                  size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
                  type: 'FLOAT_TEXT', text: `💥 -${artilleryDamage} Pháo Kích (${gunnerLvl > 1 ? `Cấp ${gunnerLvl}` : 'Lv.1'})!`
                });
                for (let p = 0; p < 5; p++) {
                  data.particles.push({
                    x: bestTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                    y: bestTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                    color: '#f97316',
                    size: 3, life: 18, maxLife: 18,
                    vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
                    type: 'SPARK'
                  });
                }
                if (t.owner === 1 || bestTarget.owner === 1) {
                  soundManager.playAttack();
                }
              }
            }
          }
        }
      }

      // Tính năng Bệ Tên Lửa (MISSILE_SILO): Phóng tên lửa chiến thuật mỗi 20s tàn phá quân địch trong phạm vi lớn
      if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 20 === 0) {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const t = tiles[y]?.[x];
            if (t && t.building === 'MISSILE_SILO' && t.owner > 0) {
              const siloNation = nations[t.owner];
              if (!siloNation || siloNation.isEliminated) continue;

              const siloLvl = t.buildingLevel || 1;
              const missileDamage = 45 * siloLvl;
              const missileRange = 8.5 + Math.min(4, siloLvl - 1);

              let bestTarget: Tile | null = null;
              let maxEnemyTroops = 0;

              for (let dy = -10; dy <= 10; dy++) {
                for (let dx = -10; dx <= 10; dx++) {
                  const tx = x + dx;
                  const ty = y + dy;
                  if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                    const dist = Math.hypot(dx, dy);
                    if (dist > 0 && dist <= missileRange) {
                      const candidate = tiles[ty][tx];
                      if (candidate.owner > 0 && candidate.owner !== t.owner) {
                        const dip = siloNation.diplomacy[candidate.owner]?.status;
                        if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
                          const enemyNat = nations[candidate.owner];
                          if (enemyNat && enemyNat.troops > maxEnemyTroops) {
                            maxEnemyTroops = enemyNat.troops;
                            bestTarget = candidate;
                          }
                        }
                      }
                    }
                  }
                }
              }

              if (bestTarget) {
                const enemyNat = nations[bestTarget.owner];
                // Kiểm tra xem có Trạm Phòng Không (AIR_DEFENSE) bảo vệ không
                let hasAirDefense = false;
                for (let ady = -4; ady <= 4; ady++) {
                  for (let adx = -4; adx <= 4; adx++) {
                    const adtx = bestTarget.x + adx;
                    const adty = bestTarget.y + ady;
                    if (adtx >= 0 && adtx < size && adty >= 0 && adty < size) {
                      const adTile = tiles[adty][adtx];
                      if (adTile.owner === bestTarget.owner && adTile.building === 'AIR_DEFENSE') {
                        hasAirDefense = true;
                        break;
                      }
                    }
                  }
                  if (hasAirDefense) break;
                }

                const finalDamage = hasAirDefense ? Math.round(missileDamage * 0.35) : missileDamage;

                if (enemyNat) {
                  enemyNat.troops = Math.max(0, enemyNat.troops - finalDamage);
                }
                bestTarget.scorchedTimer = 45;

                data.particles.push({
                  x: bestTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: bestTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#f43f5e',
                  size: 0, life: 45, maxLife: 45, vx: 0, vy: -0.8,
                  type: 'FLOAT_TEXT',
                  text: hasAirDefense ? `🛡️ Phòng Không Đánh Chặn! -${finalDamage}` : `🚀 -${finalDamage} Tên Lửa Chiến Thuật!`
                });

                if (t.owner === 1 || bestTarget.owner === 1) {
                  soundManager.playThunder();
                }
              }
            }
          }
        }
      }

      // 4. AI Bot & Thuộc Địa nhỏ phát triển
      const canBotsAct = data.gameTimeSeconds >= 4;
      if (canBotsAct) {
        const totalLand = totalLandCountRef.current || 1;
        const playerLandPct = totalLand > 0 ? (nations[1]?.territoryCount / totalLand) : 0;

        nations.forEach(bot => {
          if (bot.id <= 1 || bot.isEliminated) return;

          // Rừng hoang dã ([Rừng]) hoàn toàn tĩnh lặng, không tham chiến hay đi xâm chiếm
          if (bot.colonyCategory === 'FOREST') return;

          // --- 1. ĐÁNH GIÁ MỨC ĐỘ ĐE DỌA & GIÁ TRỊ CHIẾN LƯỢC CỦA TỪNG Ô ĐẤT ---
          const borderThreats: { 
            tile: Tile; 
            threatScore: number; 
            strategicScore: number; 
            enemySource: Tile | null; 
            isCapital: boolean;
            hasKeyBuilding: boolean;
          }[] = [];

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const t = tiles[y][x];
              if (t.owner === bot.id) {
                const isCapital = (t.x === bot.capitalX && t.y === bot.capitalY);
                const hasKeyBuilding = t.building !== 'NONE';
                const buildingLvl = t.buildingLevel || 1;

                const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                let threat = 0;
                let enemySrc: Tile | null = null;

                neighbors.forEach(([nx, ny]) => {
                  if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                    const neighborTile = tiles[ny][nx];
                    if (neighborTile.terrain !== 'WATER' && neighborTile.owner !== bot.id) {
                      const dip = bot.diplomacy[neighborTile.owner]?.status;
                      if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
                        if (neighborTile.owner === 1) {
                          threat += (difficulty === 'HARD' ? 45 : 25);
                          enemySrc = neighborTile;
                        } else if (neighborTile.owner > 1 && dip === 'WAR') {
                          threat += 20;
                          if (!enemySrc) enemySrc = neighborTile;
                        }
                      }
                    }
                  }
                });

                const incomingWaves = data.attackWaves.filter(w => w.targetX === t.x && w.targetY === t.y);
                if (incomingWaves.length > 0) {
                  const totalIncomingTroops = incomingWaves.reduce((sum, w) => sum + w.troops, 0);
                  threat += 65 + totalIncomingTroops;
                }

                // Tính điểm giá trị chiến lược của ô đất
                let strategicValue = 0;
                if (isCapital) strategicValue += 130; // Thủ đô có độ ưu tiên bảo vệ số 1
                if (t.building === 'FORTRESS') strategicValue += 50 * buildingLvl;
                if (t.building === 'CITY') strategicValue += 35 * buildingLvl;
                if (t.building === 'PORT' || t.building === 'BARRACKS') strategicValue += 30 * buildingLvl;
                if (t.building === 'ARTILLERY' || t.building === 'MISSILE_SILO' || t.building === 'AIR_DEFENSE') strategicValue += 45 * buildingLvl;

                if (bot.personality === 'DEFENSIVE') strategicValue *= 1.4;

                const totalStrategicThreat = threat * 1.5 + strategicValue;

                if (threat > 0 || isCapital || (bot.personality === 'DEFENSIVE' && hasKeyBuilding)) {
                  borderThreats.push({ 
                    tile: t, 
                    threatScore: threat, 
                    strategicScore: totalStrategicThreat,
                    enemySource: enemySrc,
                    isCapital,
                    hasKeyBuilding
                  });
                }
              }
            }
          }

          borderThreats.sort((a, b) => b.strategicScore - a.strategicScore);

          // --- 2. ĐIỀU TƯỚNG TRỰC TIẾP BẢO VỆ CÁC Ô CHIẾN LƯỢC TRỌNG ĐIỂM ---
          const topStrategicThreat = borderThreats[0];
          if (topStrategicThreat && topStrategicThreat.strategicScore >= 30 && bot.general && bot.general.status === 'IDLE') {
            bot.general.status = 'MARCHING';
            bot.general.x = topStrategicThreat.tile.x;
            bot.general.y = topStrategicThreat.tile.y;
          }

          // --- 3. AI TẬP TRUNG XÂY DỰNG & NÂNG CẤP PHÒNG THỦ TẠI CÁC Ô CHIẾN LƯỢC ---
          if (bot.gold >= 80 && Math.random() < (difficulty === 'HARD' ? 0.75 : 0.45)) {
            const targetForDefense = borderThreats.find(b => b.isCapital || b.strategicScore >= 45 || b.tile.building === 'NONE');
            if (targetForDefense) {
              const tileToBuild = targetForDefense.tile;
              if (tileToBuild.building === 'NONE') {
                const buildType: BuildingType = (tileToBuild.x === bot.capitalX && tileToBuild.y === bot.capitalY) || targetForDefense.strategicScore >= 60
                  ? 'FORTRESS'
                  : (Math.random() < 0.65 ? 'FORTRESS' : 'BARRACKS');

                const bCost = BUILDING_INFO[buildType as Exclude<BuildingType, 'NONE'>].baseCost;
                if (bot.gold >= bCost) {
                  bot.gold -= bCost;
                  tileToBuild.building = buildType;
                  tileToBuild.buildingLevel = 1;
                  offscreenTerritoryDirtyRef.current = true;
                }
              } else if (tileToBuild.building === 'FORTRESS' || tileToBuild.building === 'BARRACKS') {
                // Nâng cấp cấp độ pháo đài/trại quân để tăng hiệu quả phòng thủ
                const upgradeCost = Math.floor(BUILDING_INFO[tileToBuild.building].baseCost * 0.8);
                if (bot.gold >= upgradeCost && (tileToBuild.buildingLevel || 1) < 5) {
                  bot.gold -= upgradeCost;
                  tileToBuild.buildingLevel = (tileToBuild.buildingLevel || 1) + 1;
                  offscreenTerritoryDirtyRef.current = true;
                }
              }
            }
          }

          // --- 4. PHẢN CÔNG VÀ ĐIỀU QUÂN BẢO VỆ CHIẾN LƯỢC ---
          const minTroopsReq = difficulty === 'HARD' ? 8 : (bot.colonyCategory === 'TRIBE' ? 15 : 10);
          const attackProb = difficulty === 'HARD' ? 0.88 : (bot.personality === 'DEFENSIVE' ? 0.45 : 0.65);

          if (bot.troops >= minTroopsReq && Math.random() < attackProb) {
            const validTargets: { source: Tile; target: Tile; isPlayer: boolean; priority: number }[] = [];

            // Ưu tiên 1: Đánh trả kẻ địch đang đe dọa các ô chiến lược quan trọng
            borderThreats.forEach(bt => {
              if (bt.enemySource) {
                let priority = bt.strategicScore;
                if (bt.isCapital) priority += 100; // Bảo vệ Thủ đô là ưu tiên tuyệt đối
                if (bt.enemySource.owner === 1) priority += (difficulty === 'HARD' ? 50 : 25);

                validTargets.push({
                  source: bt.tile,
                  target: bt.enemySource,
                  isPlayer: bt.enemySource.owner === 1,
                  priority: priority,
                });
              }
            });

            // Ưu tiên 2: Mở rộng sang ô trung lập ven biên nếu không bị đe dọa trực tiếp
            if (validTargets.length === 0 || (bot.personality !== 'DEFENSIVE' && Math.random() < 0.35)) {
              for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                  const src = tiles[y][x];
                  if (src.owner === bot.id) {
                    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                    neighbors.forEach(([nx, ny]) => {
                      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                        const tgt = tiles[ny][nx];
                        if (tgt.terrain !== 'WATER' && tgt.owner === 0) {
                          validTargets.push({ source: src, target: tgt, isPlayer: false, priority: 10 });
                        }
                      }
                    });
                  }
                }
              }
            }

            if (validTargets.length > 0) {
              validTargets.sort((a, b) => b.priority - a.priority);
              const selected = validTargets[0];

              if (selected) {
                // Giữ lại một lượng quân dự phòng tại căn cứ nếu đang bị đe dọa ô trọng điểm
                const defenseReserve = selected.priority >= 100 ? 0.40 : 0.20;
                const availableTroops = Math.max(5, Math.floor(bot.troops * (1 - defenseReserve)));
                const pct = difficulty === 'HARD' ? (playerLandPct >= 0.15 ? 0.70 : 0.55) : 0.40;
                const troopsToSend = Math.max(5, Math.floor(availableTroops * pct));

                if (troopsToSend >= 5) {
                  launchAttackWave(bot.id, selected.target.owner, selected.source, selected.target, troopsToSend);
                }
              }
            }
          }
        });
      }

      // 5. Tự động mở rộng cho Người chơi (Lỗi 3: Đảm bảo đợt quân tối thiểu 5 quân và người chơi có đủ lính)
      const player = nations[1];
      if (autoExpand && player.troops >= 12 && Math.random() < 0.6) {
        const neutralTargets: { source: Tile; target: Tile }[] = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const src = tiles[y][x];
            if (src.owner === 1) {
              const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
              neighbors.forEach(([nx, ny]) => {
                if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                  const tgt = tiles[ny][nx];
                  if (tgt.terrain !== 'WATER' && tgt.owner === 0) {
                    neutralTargets.push({ source: src, target: tgt });
                  }
                }
              });
            }
          }
        }
        if (neutralTargets.length > 0) {
          const chosen = neutralTargets[Math.floor(Math.random() * neutralTargets.length)];
          const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
          if (player.troops >= troopsToSend && troopsToSend >= 5) {
            launchAttackWave(1, 0, chosen.source, chosen.target, troopsToSend);
          }
        }
      }

      // 6. Cập nhật Attack Waves & Va chạm Đại chiến Tà Thần
      const finishedWaves: number[] = [];
      data.attackWaves.forEach((wave, idx) => {
        wave.progress += wave.speed * (gameSpeed * 0.14);

        // Kiểm tra va chạm chiến đấu với Tà Thần
        const wavePxX = wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress;
        const wavePxY = wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress;

        data.darkTitans.forEach(titan => {
          if (!titan.isActive) return;
          const distToTitan = Math.hypot(wavePxX - titan.x, wavePxY - titan.y);

          if (distToTitan <= 1.2) {
            const attackerNation = data.nations[wave.fromNation];
            const titanBuff = (attackerNation?.titanBuffTimer && attackerNation.titanBuffTimer > 0) ? 1.30 : 1.0;
            const damageToTitan = Math.floor(wave.troops * 2.2 * titanBuff);

            titan.hp = Math.max(0, (titan.hp ?? DARK_TITAN_CONFIG.MAX_HP) - damageToTitan);

            data.particles.push({
              x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#f43f5e',
              size: 0, life: 25, maxLife: 25, vx: (Math.random() - 0.5) * 0.5, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: `💥 -${damageToTitan} HP`
            });

            wave.troops = Math.max(0, wave.troops - 10);

            // Kiểm tra ĐÁNH GỤC TÀ THẦN
            if (titan.hp <= 0) {
              titan.isActive = false;
              soundManager.playGeneralHorn();

              if (attackerNation) {
                attackerNation.gold += DARK_TITAN_CONFIG.BOUNTY_GOLD;
                attackerNation.titanBuffTimer = DARK_TITAN_CONFIG.BUFF_DURATION_SECONDS;

                data.events.unshift({
                  id: Math.random().toString(),
                  title: '⚔️ TRẢM TÀ THẦN THÀNH CÔNG',
                  description: `👑 Quân đội ${attackerNation.name} đã ĐÁNH GỤC TÀ THẦN CỔ ĐẠI! Nhận +${DARK_TITAN_CONFIG.BOUNTY_GOLD.toLocaleString()} Vàng & Buff Sức Mạnh +30% toàn diện trong 3 phút!`,
                  type: 'HARVEST',
                  targetNationId: attackerNation.id,
                  timestamp: formatGameTime(data.gameTimeSeconds),
                });

                data.particles.push({
                  x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#fbbf24',
                  size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
                  type: 'FLOAT_TEXT',
                  text: `👑 TRẢM TÀ THẦN! +2,000 Vàng & Buff 3 Phút!`,
                });
              }
            }
          }
        });

        if (wave.progress >= 1.0) {
          finishedWaves.push(idx);
          resolveAttackCapture(wave);
        }
      });
      data.attackWaves = data.attackWaves.filter((_, idx) => !finishedWaves.includes(idx));

      // 7. Cập nhật particles
      data.particles.forEach(p => {
        p.life -= 1;
        p.x += p.vx;
        p.y += p.vy;
      });
      data.particles = data.particles.filter(p => p.life > 0);

      // 8. Cập nhật HUD (Lỗi 1: Dùng totalLandCountRef thay flat() filter)
      const totalLand = totalLandCountRef.current || 1;
      const landPercent = totalLand > 0 ? Math.round((player.territoryCount / totalLand) * 100) : 0;

      setHudStats({
        gold: player.gold,
        goldIncome: player.goldIncome,
        troops: player.troops,
        maxTroops: player.maxTroops,
        landPercent,
        territoryCount: player.territoryCount,
        titanBuffTimer: player.titanBuffTimer || 0,
      });

      if (currentQuest === 1 && player.territoryCount > 15) setCurrentQuest(2);
      if (currentQuest === 2 && player.territoryCount >= 25) setCurrentQuest(3);

      if (landPercent >= 70) {
        setGameState('VICTORY');
        soundManager.playVictory();
      } else if (player.territoryCount === 0 && player.troops <= 2) {
        setGameState('DEFEAT');
        soundManager.playDefeat();
      }

    }, intervalTime);

    return () => clearInterval(interval);
  }, [gameState, isPaused, gameSpeed, autoExpand, currentQuest, attackPercent, difficulty]);

  // --- CÁC HÀM ĐIỀU KHIỂN CHẾ ĐỘ SÁNG TẠO (CREATIVE SANDBOX) ---
  const handleSetGold = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.gold = Math.max(0, amount);
      setHudStats(prev => ({ ...prev, gold: player.gold }));
      gameDataRef.current.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: `✨ Vàng: ${player.gold.toLocaleString()}`
      });
      soundManager.playBuild();
    }
  };

  const handleAddGold = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      handleSetGold(player.gold + amount);
    }
  };

  const handleSetTroops = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.troops = Math.max(0, amount);
      player.maxTroops = Math.max(player.maxTroops, player.troops + 1000);
      setHudStats(prev => ({ ...prev, troops: player.troops, maxTroops: player.maxTroops }));
      gameDataRef.current.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#38bdf8', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: `⚔️ Quân: ${player.troops.toLocaleString()}`
      });
      soundManager.playClick();
    }
  };

  const handleAddTroops = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      handleSetTroops(player.troops + amount);
    }
  };

  const handleChangeWeather = (newWeather: WeatherType) => {
    setWeather(newWeather);
    weatherRef.current = newWeather;
    initWeatherParticles(mapSize, newWeather);
    if (newWeather === 'RAIN') {
      nextLightningTimeRef.current = performance.now() + 500;
    }
    soundManager.playClick();
  };

  const handleTriggerLightningSpam = () => {
    setWeather('RAIN');
    weatherRef.current = 'RAIN';
    initWeatherParticles(mapSize, 'RAIN');
    lightningFlashRef.current = { startTime: performance.now(), duration: 800 };
    soundManager.playThunder();
    gameDataRef.current.events.unshift({
      id: Math.random().toString(),
      title: '⚡ BÃO SÉT TOÀN CẦU',
      description: 'Đấng Sáng Tạo đã giáng sấm sét giông bão khắp toàn bộ thế giới!',
      type: 'DIPLOMACY',
      targetNationId: 0,
      timestamp: formatGameTime(gameDataRef.current.gameTimeSeconds),
    });
  };

  const handleSpawnDarkTitan = (count = 1) => {
    const data = gameDataRef.current;
    const size = mapSize;
    const landTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x].terrain !== 'WATER') {
          landTiles.push({ x, y });
        }
      }
    }
    if (landTiles.length === 0) return;

    data.darkTitans = data.darkTitans || [];

    for (let i = 0; i < count; i++) {
      const spawnTile = (i === 0 && selectedTileRef.current && selectedTileRef.current.terrain !== 'WATER')
        ? selectedTileRef.current
        : landTiles[Math.floor(Math.random() * landTiles.length)];

      const newTitan: DarkTitan = {
        id: Math.random().toString(),
        isActive: true,
        spawnTimestamp: data.gameTimeSeconds,
        remainingTime: DARK_TITAN_CONFIG.DURATION_SECONDS,
        x: spawnTile.x,
        y: spawnTile.y,
        hp: DARK_TITAN_CONFIG.MAX_HP,
        maxHp: DARK_TITAN_CONFIG.MAX_HP,
        moveTimer: 0,
        hasWarnedDespawn: false,
      };

      data.darkTitans.push(newTitan);
      data.darkTitan = data.darkTitans[0];

      data.particles.push({
        x: spawnTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: spawnTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#dc2626',
        size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
        type: 'FLOAT_TEXT',
        text: '⚠️ TÀ THẦN TRIỆU HỒI!',
      });
    }

    soundManager.playThunder();
    data.events.unshift({
      id: Math.random().toString(),
      title: '⚠️ TÀ THẦN GIÁNG LÂM',
      description: `Đã triệu hồi ${count} Tà Thần Cổ Đại xuất hiện trên thế giới!`,
      type: 'PLAGUE',
      targetNationId: 0,
      timestamp: formatGameTime(data.gameTimeSeconds),
    });
  };

  const handleClearDarkTitans = () => {
    const data = gameDataRef.current;
    data.darkTitans = [];
    data.darkTitan = null;
    soundManager.playCapture();
    data.particles.push({
      x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
      y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
      color: '#a855f7', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
      type: 'FLOAT_TEXT', text: '✨ Đã xua tan toàn bộ Tà Thần!'
    });
  };

  const handleUnlockAllTech = () => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.techLevels = { economy: 3, military: 3, defense: 3 };
      soundManager.playBuild();
      gameDataRef.current.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#6366f1', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: '🧪 Mở Khóa Toàn Bộ Công Nghệ!'
      });
    }
  };

  const handleClearAllScorched = () => {
    const data = gameDataRef.current;
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (data.tiles[y][x].scorchedTimer) {
          data.tiles[y][x].scorchedTimer = 0;
        }
      }
    }
    soundManager.playTruce();
    data.particles.push({
      x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
      y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
      color: '#10b981', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
      type: 'FLOAT_TEXT', text: '🌿 Thanh Lọc Toàn Bộ Đất Cháy!'
    });
  };

  const handleClaimSelectedTile = () => {
    if (!selectedTileRef.current) return;
    const st = selectedTileRef.current;
    const data = gameDataRef.current;
    const t = data.tiles[st.y]?.[st.x];
    if (t && t.terrain !== 'WATER') {
      t.owner = 1;
      setSelectedTile({ ...t });
      selectedTileRef.current = { ...t };
      offscreenTerritoryDirtyRef.current = true;
      soundManager.playCapture();
    }
  };

  const handleToggleGodModeLocked = () => {
    setGodModeLocked(prev => {
      const next = !prev;
      godModeLockedRef.current = next;
      soundManager.playClick();
      return next;
    });
  };

  // Xử lý chạm trên bản đồ:
  // Luôn lập tức hiển thị bảng thông tin ô đất bên dưới.
  // Xóa hoàn toàn việc đi chiếm đất khi click lần 2 trên bản đồ!
  const handleMapTap = (mapX: number, mapY: number, screenX: number, screenY: number) => {
    const data = gameDataRef.current;
    const { tiles } = data;
    const targetTile = tiles[mapY]?.[mapX];
    if (!targetTile || targetTile.terrain === 'WATER') {
      setSelectedTile(null);
      selectedTileRef.current = null;
      return;
    }

    setSelectedTile(targetTile);
    selectedTileRef.current = targetTile;
    soundManager.playClick();
  };

  // Xuất đợt tấn công OpenFront
  const launchAttackWave = (
    from: number, 
    to: number, 
    source: Tile, 
    target: Tile, 
    troops: number,
    customQueue?: { x: number; y: number }[]
  ) => {
    const data = gameDataRef.current;
    const attacker = data.nations[from];
    if (attacker.troops < troops) return;

    attacker.troops -= troops;
    data.stats.battlesCount += 1;

    // Nếu đang trong phòng nhiều người và đợt quân do chính người chơi này phát động -> gửi qua WebSocket
    if (isMultiplayerRef.current && from === myNationIdRef.current) {
      multiplayerClient.sendAttack(from, to, source.x, source.y, target.x, target.y, troops);
    }

    // Tướng xuất chiến dẫn dắt đợt quân (Tướng chiếm 30% sức mạnh)
    let hasGeneral = false;
    if (attacker.general && (attacker.general.status === 'IDLE' || attacker.general.status === 'MARCHING')) {
      if ((from === 1 && playerGeneralDeployMode) || (from > 1 && (attacker.tier === 'BOSS' || troops >= 10))) {
        hasGeneral = true;
        attacker.general.status = 'MARCHING';
        attacker.general.x = source.x;
        attacker.general.y = source.y;
        if (from === 1) {
          soundManager.playGeneralHorn();
        }
      }
    }

    const queue: { x: number; y: number }[] = customQueue && customQueue.length > 0 
      ? customQueue 
      : [{ x: target.x, y: target.y }];

    if (!customQueue) {
      const neighbors = [
        { x: target.x + 1, y: target.y },
        { x: target.x - 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 },
      ];
      neighbors.forEach(n => {
        if (n.x >= 0 && n.x < data.tiles.length && n.y >= 0 && n.y < data.tiles.length) {
          if (data.tiles[n.y][n.x].terrain !== 'WATER' && data.tiles[n.y][n.x].owner !== from) {
            queue.push(n);
          }
        }
      });
    }

    // Tính năng 1: Phòng Tuyến Chiến Hào & Tiếp Tế (+20% tốc độ hành quân nội địa/chiến hào)
    const isSupplyRoute = source.owner === from && (target.owner === from || source.building !== 'NONE' || target.building !== 'NONE');
    const waveSpeed = isSupplyRoute ? 0.46 : 0.38;

    data.attackWaves.push({
      id: Math.random().toString(),
      fromNation: from,
      toNation: to,
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      troops,
      progress: 0,
      speed: waveSpeed,
      hasGeneral,
      targetsQueue: queue,
    });

    if ((from === 1 || from === myNationIdRef.current) && !hasGeneral) soundManager.playAttack();
  };

  // Lắng nghe các sự kiện hành động nhiều người chơi theo thời gian thực
  useEffect(() => {
    if (!isMultiplayer) return;

    multiplayerClient.onActionAttack = (action) => {
      const data = gameDataRef.current;
      const src = data.tiles[action.sourceY]?.[action.sourceX];
      const tgt = data.tiles[action.targetY]?.[action.targetX];
      if (src && tgt) {
        launchAttackWave(action.fromNation, action.toNation, src, tgt, action.troops);
      }
    };

    multiplayerClient.onActionBuild = (action) => {
      const data = gameDataRef.current;
      const tgt = data.tiles[action.targetY]?.[action.targetX];
      if (tgt) {
        tgt.building = action.buildingType;
        tgt.buildingLevel = (tgt.buildingLevel || 1) + (action.count || 1);
        offscreenTerritoryDirtyRef.current = true;
      }
    };

    multiplayerClient.onPlayerDisconnected = (info) => {
      setMultiplayerBanner(info.message);
      setTimeout(() => setMultiplayerBanner(null), 6000);
    };

    return () => {
      multiplayerClient.onActionAttack = null;
      multiplayerClient.onActionBuild = null;
      multiplayerClient.onPlayerDisconnected = null;
    };
  }, [isMultiplayer]);

  // Giải quyết đợt tấn công
  const resolveAttackCapture = (wave: AttackWave) => {
    const data = gameDataRef.current;
    const tgt = data.tiles[wave.targetY]?.[wave.targetX];
    if (!tgt) return;

    const attacker = data.nations[wave.fromNation];
    const defender = data.nations[tgt.owner];

    let cost = tgt.terrain === 'MOUNTAIN' ? 12 : 5;
    if (tgt.building === 'FORTRESS') {
      cost = 18 + ((tgt.buildingLevel || 1) - 1) * 8;
    }

    if (tgt.scorchedTimer && tgt.scorchedTimer > 0) {
      cost += 5;
    }

    // Công nghệ quân sự cấp 3: Giảm 20% thủ Núi khi tiến công
    if (attacker?.techLevels?.military >= 3 && tgt.terrain === 'MOUNTAIN') {
      cost = Math.max(3, Math.round(cost * 0.80));
    }

    // Đặc tính phòng thủ của Thuộc địa Bộ Lạc (+50% tổn thất cho kẻ tấn công)
    if (defender?.colonyCategory === 'TRIBE') {
      cost = Math.round(cost * 1.5);
    }

    // Tướng phòng thủ có mặt giúp tăng 30% thủ
    if (defender?.general && defender.general.status === 'MARCHING') {
      cost = Math.round(cost * 1.3);
    }

    // Giảm sức mạnh công nghệ phòng thủ: Level 1 (+10%), Level 2 (+18%), Level 3 (+25%)
    if (defender && defender.techLevels?.defense >= 1) {
      const defMult = defender.techLevels.defense === 1 ? 1.10 : defender.techLevels.defense === 2 ? 1.18 : 1.25;
      cost = Math.round(cost * defMult);
    }

    // Tướng tiến công (hasGeneral) chiếm 30% sức mạnh -> giảm 30% chi phí chiếm ô!
    if (wave.hasGeneral) {
      cost = Math.max(2, Math.floor(cost * 0.70));
    }

    if (wave.troops >= cost) {
      wave.troops -= cost;
      const prevOwner = tgt.owner;
      tgt.owner = wave.fromNation;
      tgt.building = 'NONE';
      tgt.buildingLevel = 1;

      // Công nghệ kinh tế cấp 3: Thưởng +20 vàng khi chiếm ô đất
      if (attacker && attacker.techLevels?.economy >= 3) {
        attacker.gold += 20;
      }

      if (cost >= 15 || wave.troops >= 25) {
        tgt.scorchedTimer = 30;
      }

      // Thu hoạch tài nguyên & dân số đặc thù từng loại Thuộc địa khi chiếm đóng
      if (defender && prevOwner > 0) {
        if (defender.colonyCategory === 'FOREST') {
          attacker.gold += 100;
          attacker.population += 15;
        } else if (defender.colonyCategory === 'TRIBE') {
          attacker.gold += 50;
          attacker.population += 10;
        } else if (defender.colonyCategory === 'ETHNIC') {
          attacker.gold += 80;
          attacker.population += 20;
        }
      }

      // Xử lý thương vong của Tướng
      if (wave.hasGeneral && attacker.general && Math.random() < 0.12) {
        attacker.general.status = 'RECOVERING';
        attacker.general.reviveTimer = 15;
      }

      if (wave.fromNation === 1) {
        soundManager.playCapture();
      }

      if (wave.targetsQueue && wave.targetsQueue.length > 1 && wave.troops >= 5) {
        wave.targetsQueue.shift();
        const next = wave.targetsQueue[0];
        if (next) {
          const nextTile = data.tiles[next.y]?.[next.x];
          if (nextTile && nextTile.owner !== wave.fromNation && nextTile.terrain !== 'WATER') {
            const nextOwner = nextTile.owner;
            const isAlly = nextOwner > 0 && (attacker.diplomacy[nextOwner]?.status === 'ALLIANCE' || attacker.diplomacy[nextOwner]?.status === 'TRUCE');
            if (!isAlly) {
              wave.sourceX = tgt.x;
              wave.sourceY = tgt.y;
              wave.targetX = next.x;
              wave.targetY = next.y;
              wave.progress = 0;
              data.attackWaves.push(wave);
            }
          }
        }
      }
    }
    offscreenTerritoryDirtyRef.current = true;
  };

  // Pointer Handlers: Thu phóng và di chuyển mượt mà trên điện thoại
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Nếu người dùng chạm vào các nút UI, bảng thông tin, minimap, ticker, banner (không phải canvas)
    // thì bỏ qua không xử lý map touch/drag để các nút bấm trên màn hình nhận click 100%.
    if (e.target !== canvasRef.current) {
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    // Dừng chuyển động camera tự động nếu người chơi chủ động chạm vào màn hình
    cameraAnimRef.current = null;
    const map = pointersMapRef.current;
    map.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (map.size === 1) {
      pointerStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, time: Date.now() };
      startCamRef.current = { ...cameraRef.current };
      isDraggingRef.current = false;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    } else if (map.size >= 2) {
      const pts = Array.from(map.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPinchMidRef.current = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
      isDraggingRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const map = pointersMapRef.current;
    if (!map.has(e.pointerId)) return;
    map.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (map.size >= 2 && lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
      isDraggingRef.current = true;
      const pts = Array.from(map.values());
      const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const currentMid = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };

      const prevDist = lastPinchDistRef.current;
      const prevMid = lastPinchMidRef.current || currentMid;

      if (prevDist > 0 && currentDist > 0) {
        // Damping factor: giảm tốc độ zoom để điều khiển mượt mà, không giật tỷ lệ đột ngột
        const deltaDist = currentDist - prevDist;
        const zoomDamping = 0.50;
        const zoomMultiplier = 1 + (deltaDist / prevDist) * zoomDamping;

        const curCam = cameraRef.current;
        const targetZoom = clampZoom(curCam.zoom * zoomMultiplier);

        // Công thức chuẩn chống nhảy camera: giữ tọa độ thế giới tại prevMid khớp với currentMid dưới zoom mới
        const worldX = (prevMid.x - curCam.x) / curCam.zoom;
        const worldY = (prevMid.y - curCam.y) / curCam.zoom;

        const newCamX = currentMid.x - worldX * targetZoom;
        const newCamY = currentMid.y - worldY * targetZoom;

        const clamped = clampCamera(newCamX, newCamY, targetZoom);
        cameraRef.current = { x: clamped.x, y: clamped.y, zoom: targetZoom };
      }

      lastPinchDistRef.current = currentDist;
      lastPinchMidRef.current = currentMid;
    } else if (map.size === 1 && pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;

      if (Math.hypot(dx, dy) > 8) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        const newX = startCamRef.current.x + dx;
        const newY = startCamRef.current.y + dy;
        const clamped = clampCamera(newX, newY, cameraRef.current.zoom);
        cameraRef.current = { ...cameraRef.current, x: clamped.x, y: clamped.y };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const map = pointersMapRef.current;

    if (map.size === 1 && pointerStartRef.current && pointerStartRef.current.id === e.pointerId && !isDraggingRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      const duration = Date.now() - pointerStartRef.current.time;

      if (dist < 12 && duration < 320) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;

          const curCam = cameraRef.current;
          const worldX = (screenX - curCam.x) / curCam.zoom;
          const worldY = (screenY - curCam.y) / curCam.zoom;

          const mapX = Math.floor(worldX / TILE_PIXEL_SIZE);
          const mapY = Math.floor(worldY / TILE_PIXEL_SIZE);

          const size = gameDataRef.current.tiles.length;
          if (mapX >= 0 && mapX < size && mapY >= 0 && mapY < size) {
            handleMapTap(mapX, mapY, e.clientX, e.clientY);
          }
        }
      }
    }

    map.delete(e.pointerId);

    // Chống văng camera khi thả 1 trong 2 ngón: Neo lại vị trí ngón còn lại với vị trí camera hiện tại
    if (map.size === 1) {
      const remaining = Array.from(map.values())[0];
      if (remaining) {
        pointerStartRef.current = {
          id: remaining.id,
          x: remaining.x,
          y: remaining.y,
          time: Date.now()
        };
        startCamRef.current = { ...cameraRef.current };
      }
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    } else if (map.size === 0) {
      pointerStartRef.current = null;
      isDraggingRef.current = false;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomAroundPoint(screenX, screenY, cameraRef.current.zoom * factor);
  };

  // Xây dựng công trình gộp & xây chồng tăng cấp (Building Stacking & Level Up)
  const executeBuild = (targetTile: Tile | null, buildingType: BuildingType, count: number = 1) => {
    if (buildingType === 'NONE') return;
    const data = gameDataRef.current;
    const myNation = myNationIdRef.current || 1;
    const player = data.nations[myNation];
    if (!player) return;

    const baseCost = BUILDING_INFO[buildingType as Exclude<BuildingType, 'NONE'>].baseCost;
    // Giảm sức mạnh công nghệ kinh tế cấp 2: discount giảm từ 15% (0.85) xuống 8% (0.92)
    const discount = player.techLevels?.economy >= 2 ? 0.92 : 1.0;
    const isPort = buildingType === 'PORT';

    const size = data.tiles.length;
    const eligibleTiles: Tile[] = [];

    // 1. Ưu tiên ô đang chọn nếu thuộc sở hữu người chơi
    if (targetTile && targetTile.owner === myNation) {
      if (!isPort || targetTile.hasHarborAccess) {
        eligibleTiles.push(targetTile);
      }
    }

    // 2. Quét các ô đất thuộc sở hữu người chơi
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = data.tiles[y][x];
        if (t.owner === myNation && t !== targetTile) {
          if (!isPort || t.hasHarborAccess) {
            eligibleTiles.push(t);
          }
        }
      }
    }

    if (eligibleTiles.length === 0) {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: isPort ? 'Không có ô giáp biển thuộc sở hữu!' : 'Không có ô đất thuộc sở hữu!'
      });
      return;
    }

    // Sắp xếp ưu tiên: ô đang chọn -> ô đã có cùng loại công trình (để xây chồng) -> ô trống
    eligibleTiles.sort((a, b) => {
      if (a === targetTile) return -1;
      if (b === targetTile) return 1;
      if (a.building === buildingType && b.building !== buildingType) return -1;
      if (a.building !== buildingType && b.building === buildingType) return 1;
      if (a.building === 'NONE' && b.building !== 'NONE') return -1;
      if (a.building !== 'NONE' && b.building === 'NONE') return 1;
      return 0;
    });

    // Tính tổng cấp độ công trình loại này hiện có
    let currentExistingCount = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x].owner === 1 && data.tiles[y][x].building === buildingType) {
          currentExistingCount += (data.tiles[y][x].buildingLevel || 1);
        }
      }
    }

    let totalCost = 0;
    let actualBuiltCount = 0;

    for (let i = 0; i < count; i++) {
      const singleCost = Math.floor(baseCost * Math.pow(1.15, currentExistingCount + i) * discount);
      if (player.gold >= totalCost + singleCost) {
        totalCost += singleCost;
        actualBuiltCount++;
      } else {
        break;
      }
    }

    if (actualBuiltCount === 0) {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: 'Không đủ Vàng để xây / nâng cấp!'
      });
      return;
    }

    // Trừ vàng
    player.gold -= totalCost;

    // Phân bổ xây mới hoặc xây chồng tăng cấp
    let remainingToPlace = actualBuiltCount;
    for (let i = 0; i < eligibleTiles.length && remainingToPlace > 0; i++) {
      const t = eligibleTiles[i];
      if (t.building === buildingType) {
        // Tăng cấp xây chồng công trình
        const stacksToAdd = remainingToPlace;
        t.buildingLevel = (t.buildingLevel || 1) + stacksToAdd;
        remainingToPlace = 0;
      } else {
        // Đặt công trình mới
        t.building = buildingType;
        t.buildingLevel = 1;
        remainingToPlace--;

        if (remainingToPlace > 0 && t === targetTile) {
          t.buildingLevel += remainingToPlace;
          remainingToPlace = 0;
        }
      }
      if (isPort) player.hasPort = true;
    }

    data.stats.buildingsCount += actualBuiltCount;
    soundManager.playBuild();
    setIsBuildOpen(false);
    offscreenTerritoryDirtyRef.current = true;

    // Gửi thông báo xây dựng qua WebSocket cho các người chơi khác
    if (isMultiplayerRef.current && (targetTile || eligibleTiles[0])) {
      const builtOn = targetTile || eligibleTiles[0];
      multiplayerClient.sendBuild(builtOn.x, builtOn.y, buildingType, actualBuiltCount);
    }

    if (targetTile) {
      const targetLvl = targetTile.buildingLevel || 1;
      setSelectedTile({ ...targetTile, buildingLevel: targetLvl });
      selectedTileRef.current = { ...targetTile, buildingLevel: targetLvl };

      data.particles.push({
        x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT',
        text: `🏢 +x${actualBuiltCount} ${BUILDING_INFO[buildingType as Exclude<BuildingType, 'NONE'>].name} (Cấp ${targetLvl})!`
      });
    }

    if (currentQuest === 3 && buildingType === 'CITY') {
      setCurrentQuest(4);
    }
  };

  const canBuild = hudStats.gold >= 90;
  const canTech = hudStats.territoryCount >= 15;

  // Tính số quân thực tế sẽ xuất trận theo Thanh trượt Slider
  const actualAttackTroops = Math.max(1, Math.floor((hudStats.troops * attackPercent) / 100));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none font-sans">
      
      {/* 1. MÀN HÌNH BẮT ĐẦU VỚI ĐỔI TÊN NGƯỜI CHƠI */}
      {gameState === 'TITLE' && (
        <div className="flex flex-col items-center justify-center flex-1 p-4 text-center bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md my-auto">
            <div className="flex justify-center mb-3 text-amber-400">
              <Crown className="w-16 h-16 animate-pulse" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">PIXEL EMPIRE</h1>
            <p className="text-xs sm:text-sm text-slate-400 mb-5 leading-relaxed">
              Bản đồ Trái Đất chuẩn OpenFront. Xuất phát tại Việt Nam, thu phục thuộc địa & chinh phục thế giới!
            </p>

            <div className="space-y-4 mb-6 text-left">
              {/* ĐỔI TÊN NGƯỜI CHƠI */}
              <div>
                <label className="text-xs font-bold text-amber-400 block mb-1.5 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Tên Đế Quốc / Quốc Gia của bạn:
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên quốc gia (vd: Việt Nam)..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-sm focus:border-amber-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Kích thước thế giới:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[64, 96, 128].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setMapSize(sz as MapDimension)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        mapSize === sz
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      {sz}x{sz} {sz === 96 ? '(Chuẩn)' : sz === 64 ? '(Nhỏ)' : '(Lớn)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* TÁCH BIỆT CHẾ ĐỘ CHƠI: CHIẾN DỊCH & SÁNG TẠO */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Chọn chế độ chơi:</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGameMode('STANDARD')}
                    className={`py-2.5 px-1 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                      gameMode === 'STANDARD'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Chiến Thuật Chuẩn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('CREATIVE')}
                    className={`py-2.5 px-1 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                      gameMode === 'CREATIVE'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
                    <span>🎨 Sáng Tạo (Sandbox)</span>
                  </button>
                </div>
              </div>

              {gameMode === 'CREATIVE' ? (
                <div className="bg-gradient-to-r from-purple-950/60 to-pink-950/60 border border-purple-500/60 p-3 rounded-2xl space-y-1 shadow-inner">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Đặc Quyền Chế Độ Sáng Tạo:</span>
                  </div>
                  <ul className="text-[11px] text-purple-200/90 list-disc list-inside space-y-0.5">
                    <li>Khởi đầu với 999,999 Vàng & 50,000 Quân đội.</li>
                    <li>Tự do tăng giảm Vàng & Quân tùy thích.</li>
                    <li>Spam và đổi thời tiết: Nắng, Mây, Giông Sét tức thì.</li>
                    <li>Spam và triệu hồi nhiều Tà Thần Cổ Đại càn quét bản đồ.</li>
                    <li>Có nút mở Bảng Điều Khiển Sáng Tạo (God Panel) ngay trên màn hình.</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Độ khó thử thách:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['EASY', 'NORMAL', 'HARD'] as GameDifficulty[]).map(diff => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          difficulty === diff
                            ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400'
                        }`}
                      >
                        {diff === 'EASY' ? 'Dễ (Khuyên dùng)' : diff === 'NORMAL' ? 'Vừa' : 'Khó'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {savedGameInfo ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={loadGame}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-between min-h-[50px] active:scale-95 border border-emerald-400/40"
                >
                  <div className="flex items-center gap-3 text-left">
                    <RotateCcw className="w-5 h-5 text-emerald-200 shrink-0 animate-spin-slow" />
                    <div>
                      <div className="text-sm font-black leading-tight flex items-center gap-2">
                        Tiếp Tục Ván Cũ
                        <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {savedGameInfo.mode}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-100/90 font-normal mt-0.5">
                        {savedGameInfo.playerName} • Lưu: {savedGameInfo.timestamp} ({savedGameInfo.gameTimeStr})
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-200 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmNewGame(true)}
                  className="w-full py-3 px-4 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm active:scale-95 shadow"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  Chơi Mới (Xóa ván cũ)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startNewGame(difficulty, mapSize, playerName, gameMode)}
                className={`w-full py-4 text-white font-extrabold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-base min-h-[48px] active:scale-95 ${
                  gameMode === 'CREATIVE'
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/40'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30'
                }`}
              >
                {gameMode === 'CREATIVE' ? (
                  <Wand2 className="w-5 h-5 text-amber-300 animate-pulse" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
                {gameMode === 'CREATIVE' ? 'Bắt Đầu Chế Độ Sáng Tạo' : 'Khởi Đầu Chinh Phục'}
              </button>
            )}

            {/* NÚT TẠO / VÀO PHÒNG CHƠI VỚI BẠN BÈ (MULTIPLAYER LOBBY) */}
            <div className="pt-3 border-t border-slate-800/80 mt-3">
              <button
                type="button"
                onClick={() => setIsMultiplayerModalOpen(true)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 text-sm border border-indigo-400/40 transition-all min-h-[48px]"
              >
                <Users className="w-5 h-5 text-amber-300 animate-pulse" />
                <span>🎮 Tạo & Vào Phòng Chơi Với Bạn Bè</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MÀN HÌNH CHƠI CHÍNH */}
      {(gameState === 'PLAYING' || gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <>
          {/* THANH ĐIỀU HÀNH & NÚT CỐ ĐỊNH GÓC TRÊN */}
          <header className="flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-900/95 border-b border-slate-800 z-40 shrink-0">
            {/* THỐNG KÊ TÀI NGUYÊN (TỰ CO CO GIÃN HỢP LÝ TRÊN MÀN HÌNH NHỎ) */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-slate-800 shrink-0">
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300">{hudStats.gold}</span>
                <span className="text-[10px] text-emerald-400 font-mono hidden xs:inline">+{hudStats.goldIncome}/s</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-slate-800 shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-blue-300">{hudStats.troops}</span>
                <span className="text-[10px] text-slate-400 font-mono hidden xs:inline">/{hudStats.maxTroops}</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-slate-800 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">{hudStats.landPercent}%</span>
              </div>

              {hudStats.titanBuffTimer > 0 && (
                <div className="flex items-center gap-1 bg-amber-950/90 px-2 py-1 rounded-lg sm:rounded-xl border border-amber-500/60 shadow-lg shadow-amber-500/20 shrink-0 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-xs font-black text-amber-300">
                    🔥 Buff Tà Thần (+30%): {Math.floor(hudStats.titanBuffTimer / 60)}:{(hudStats.titanBuffTimer % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              {isMultiplayer && multiplayerRoom && (
                <div className="flex items-center gap-1 bg-indigo-950/90 px-2 py-1 rounded-lg sm:rounded-xl border border-indigo-500/50 shrink-0">
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs font-mono font-bold text-indigo-200">Phòng: {multiplayerRoom.code}</span>
                </div>
              )}
            </div>

            {/* BANNER THÔNG BÁO NHIỀU NGƯỜI CHƠI (NGƯỜI CHƠI RỜI PHÒNG / BOT TIẾP QUẢN) */}
            {multiplayerBanner && (
              <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-in slide-in-from-top border border-amber-300">
                <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
                <span>{multiplayerBanner}</span>
              </div>
            )}

            {/* CỤM ĐIỀU KHIỂN CỐ ĐỊNH GÓC PHẢI - LUÔN HIỂN THỊ, KHÔNG BỊ TRÀN HAY CHE KHUẤT */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1.5">
              {/* NÚT MỞ BẢNG ĐIỀU KHIỂN SÁNG TẠO (CHỈ XUẤT HIỆN TRONG CHẾ ĐỘ CREATIVE) */}
              {gameMode === 'CREATIVE' && (
                <button
                  onClick={() => {
                    setIsCreativeOpen(true);
                    soundManager.playClick();
                  }}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 text-white font-extrabold rounded-lg text-xs flex items-center gap-1 shadow-lg shadow-purple-500/40 border border-purple-400/60 min-h-[36px]"
                  title="Mở Bảng Điều Khiển Sáng Tạo (Sandbox)"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
                  <span className="font-mono text-[11px]">Sáng Tạo</span>
                </button>
              )}

              <button
                onClick={() => setGameSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1 min-h-[36px]"
                title="Tốc độ trận đấu"
              >
                <FastForward className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono">{gameSpeed}x</span>
              </button>

              {/* NÚT THỜI TIẾT (MÂY TRÔI / MƯA RÀO / NẮNG NHẸ) */}
              <button
                onClick={cycleWeather}
                title={`Thời tiết: ${weather === 'RAIN' ? 'Mưa lất phất' : weather === 'CLOUDY' ? 'Mây bồng bềnh' : 'Nắng nhẹ'} (Bấm để đổi)`}
                className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-700 min-h-[36px] min-w-[36px] flex items-center justify-center transition-all shadow"
              >
                {weather === 'RAIN' ? (
                  <CloudRain className="w-4 h-4 text-sky-400 animate-pulse" />
                ) : weather === 'CLOUDY' ? (
                  <Cloud className="w-4 h-4 text-indigo-300" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>

              <button
                onClick={() => {
                  setIsPaused(prev => {
                    const next = !prev;
                    if (next) saveGameRef.current();
                    return next;
                  });
                  soundManager.playClick();
                }}
                title={isPaused ? "Tiếp tục" : "Tạm dừng"}
                className={`p-2 active:scale-95 rounded-lg border min-h-[36px] min-w-[36px] flex items-center justify-center transition-all shadow ${
                  isPaused 
                    ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4 fill-current text-white" /> : <Pause className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  soundManager.playClick();
                }}
                title="Cài đặt trận đấu"
                className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg text-amber-400 border border-slate-700 min-h-[36px] min-w-[36px] flex items-center justify-center shadow"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* BANNER THÔNG BÁO TẠM DỪNG */}
          {isPaused && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] z-35 flex flex-col items-center justify-center pointer-events-auto p-4 animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl">
                <Pause className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-pulse" />
                <h3 className="text-lg font-black text-white mb-1">TRẬN ĐẤU TẠM DỪNG</h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">Thời gian và các đợt hành quân đang được giữ nguyên.</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setIsPaused(false);
                      soundManager.playClick();
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" /> Tiếp Tục Trận Đấu
                  </button>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      soundManager.playClick();
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Settings className="w-4 h-4 text-amber-400" /> Cài Đặt Trận Đấu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* THANH NHIỆM VỤ THU GỌN - CHỐNG TRÀN MÀN HÌNH DI ĐỘNG */}
          {!questDismissed && currentQuest <= 5 && (
            <div className="absolute top-12 left-2 right-2 sm:left-3 sm:right-3 z-30 flex items-center justify-between px-3 py-1.5 bg-blue-950/90 border border-blue-500/40 rounded-xl shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-xs text-blue-100 min-w-0 flex-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span className="font-bold text-amber-300 text-[11px] shrink-0">Nhiệm vụ {currentQuest}/5:</span>
                <span className="text-[11px] text-slate-200 truncate">
                  {currentQuest === 1 && 'Khởi đầu: Chiếm 15 ô đất xung quanh Việt Nam'}
                  {currentQuest === 2 && 'Mở rộng: Chinh phục 25 ô đất thế giới'}
                  {currentQuest === 3 && 'Kinh tế: Mở bảng Xây Dựng & lập 1 Thành Phố'}
                  {currentQuest === 4 && 'Công nghệ: Mở bảng Công Nghệ & nâng cấp'}
                  {currentQuest === 5 && 'Bá chủ: Tiếp tục mở rộng đế quốc!'}
                </span>
              </div>
              <button
                onClick={() => setQuestDismissed(true)}
                className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SỰ KIỆN & MINIMAP */}
          <div className="absolute top-24 left-2.5 z-20 pointer-events-auto max-w-[200px] sm:max-w-xs">
            <EventTicker
              events={gameDataRef.current.events}
              onOpenLog={() => setIsEventLogOpen(true)}
            />
          </div>

          {showMinimap && (
            <div className="absolute top-24 right-2.5 z-20 pointer-events-auto animate-in fade-in duration-150">
              <Minimap
                tiles={gameDataRef.current.tiles}
                nations={gameDataRef.current.nations}
                mapSize={mapSize}
                camera={cameraRef.current}
                darkTitan={gameDataRef.current.darkTitan}
                darkTitans={gameDataRef.current.darkTitans}
                onNavigate={(mapX, mapY) => {
                  const vpW = viewportSizeRef.current.width || 360;
                  const vpH = viewportSizeRef.current.height || 560;
                  const curZoom = cameraRef.current.zoom;
                  const rawX = vpW / 2 - (mapX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * curZoom;
                  const rawY = vpH / 2 - (mapY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * curZoom;
                  const clamped = clampCamera(rawX, rawY, curZoom);
                  cameraRef.current = { x: clamped.x, y: clamped.y, zoom: curZoom };
                }}
              />
            </div>
          )}

          {/* KHUNG CANVAS BẢN ĐỒ */}
          <div 
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="relative flex-1 overflow-hidden bg-slate-950 touch-none select-none cursor-grab active:cursor-grabbing w-full h-full"
          >
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
            />

            {/* THẺ THÔNG TIN LÃNH THỔ CỐ ĐỊNH PHÍA DƯỚI (DẠNG LƯỚI TỐI ƯU CỰC KỲ GỌN GÀNG) */}
            {selectedTile && (
              <div 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-[92px] left-2 right-2 sm:left-auto sm:right-3 sm:w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-30 animate-in fade-in slide-in-from-bottom duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1 truncate">
                      {selectedTile.owner === 1 ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {selectedTile.owner === 1 
                          ? `${playerName} (Chủ quyền)` 
                          : selectedTile.owner > 1 
                          ? gameDataRef.current.nations[selectedTile.owner]?.name || 'Vùng đất'
                          : 'Đất hoang trung lập'}
                      </span>
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedTile(null);
                      selectedTileRef.current = null;
                    }} 
                    className="p-1 text-slate-400 hover:text-white rounded-lg active:bg-slate-800 shrink-0 ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* THÔNG SỐ BẢNG LƯỚI CỰC KỲ GỌN GÀNG CHỐNG TRÀN */}
                <div className="grid grid-cols-2 gap-1 my-1.5 p-1.5 bg-slate-950/70 rounded-xl border border-slate-800 text-[10px] sm:text-[11px]">
                  <div>
                    <span className="text-slate-400">Tọa độ: </span>
                    <strong className="text-white font-mono">({selectedTile.x}, {selectedTile.y})</strong>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400">Địa hình: </span>
                    <strong className="text-white">
                      {selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'}
                    </strong>
                    {selectedTile.hasHarborAccess && <span className="text-cyan-400 font-semibold ml-0.5">(Biển)</span>}
                  </div>
                  <div>
                    <span className="text-slate-400">Công trình: </span>
                    <strong className="text-amber-400">
                      {selectedTile.building !== 'NONE' 
                        ? `${BUILDING_INFO[selectedTile.building].name} (${(selectedTile.buildingLevel || 1) > 1 ? `Cấp ${selectedTile.buildingLevel}` : 'Lv.1'})` 
                        : 'Trống'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Dân số: </span>
                    <strong className="text-slate-200">
                      {formatPopulation(gameDataRef.current.nations[selectedTile.owner]?.population || 0)}
                    </strong>
                  </div>
                </div>

                {/* THAO TÁC THEO CHỦ QUYỀN */}
                <>
                {selectedTile.owner === 1 && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Chủ sở hữu: <strong className="text-amber-300">Bạn</strong></span>

                      <button
                        onClick={() => setIsBuildOpen(true)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{selectedTile.building !== 'NONE' ? `🏢 Xây Chồng Cấp ${(selectedTile.buildingLevel || 1) + 1}` : 'Xây Gộp Công Trình'}</span>
                      </button>
                    </div>

                    {selectedTile.building === 'ARTILLERY' && (
                      <button
                        onClick={() => {
                          const player = gameDataRef.current.nations[1];
                          const cost = 25;
                          if (player.gold >= cost) {
                            player.gold -= cost;
                            const gunnerLvl = selectedTile.buildingLevel || 1;
                            const artilleryDamage = 25 * gunnerLvl;
                            const maxRange = 6.5 + Math.min(3, gunnerLvl - 1);

                            // Tìm kẻ địch gần nhất trong tầm ngắm để pháo kích mục tiêu
                            let targetTile: Tile | null = null;
                            let minDist = Infinity;
                            const tiles = gameDataRef.current.tiles;
                            const size = tiles.length;

                            for (let y = 0; y < size; y++) {
                              for (let x = 0; x < size; x++) {
                                const candidate = tiles[y][x];
                                if (candidate.owner > 0 && candidate.owner !== 1) {
                                  const dist = Math.hypot(candidate.x - selectedTile.x, candidate.y - selectedTile.y);
                                  if (dist <= maxRange && dist < minDist) {
                                    minDist = dist;
                                    targetTile = candidate;
                                  }
                                }
                              }
                            }

                            if (targetTile) {
                              const enemyNat = gameDataRef.current.nations[targetTile.owner];
                              if (enemyNat) {
                                enemyNat.troops = Math.max(0, enemyNat.troops - artilleryDamage);
                              }
                              targetTile.scorchedTimer = 35;

                              // Hiệu ứng hạt đường đạn neon (Neon Projectile Tracer Particle) bắn từ Artillery đến mục tiêu
                              const startPxX = selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                              const startPxY = selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                              const endPxX = targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                              const endPxY = targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

                              for (let step = 0; step < 12; step++) {
                                const ratio = step / 12;
                                gameDataRef.current.particles.push({
                                  x: startPxX + (endPxX - startPxX) * ratio,
                                  y: startPxY + (endPxY - startPxY) * ratio,
                                  color: '#38bdf8',
                                  size: 3.5,
                                  life: 25 + step * 2,
                                  maxLife: 45,
                                  vx: 0,
                                  vy: 0,
                                  type: 'SPARK',
                                });
                              }

                              // HIỆU ỨNG VỤ NỔ HÌNH BÁN CẦU TỎA RA (Hemispherical Explosion Particle Burst) tại vị trí trúng đạn
                              for (let p = 0; p < 24; p++) {
                                const angle = Math.PI + Math.random() * Math.PI; // Nửa bán cầu trên tỏa ra kịch tính
                                const speed = 1.5 + Math.random() * 3.5;
                                gameDataRef.current.particles.push({
                                  x: endPxX,
                                  y: endPxY,
                                  color: p % 2 === 0 ? '#f97316' : '#ef4444',
                                  size: 3 + Math.random() * 3,
                                  life: 30 + Math.floor(Math.random() * 15),
                                  maxLife: 45,
                                  vx: Math.cos(angle) * speed,
                                  vy: Math.sin(angle) * speed - 0.8, // Tạo vòm bán cầu bay lên
                                  type: 'SPARK',
                                });
                              }

                              gameDataRef.current.particles.push({
                                x: endPxX,
                                y: endPxY,
                                color: '#fbbf24',
                                size: 0,
                                life: 40,
                                maxLife: 40,
                                vx: 0,
                                vy: -0.8,
                                type: 'FLOAT_TEXT',
                                text: `💥 -${artilleryDamage} Pháo Kích Trúng Đích!`
                              });

                              soundManager.playAttack();
                            } else {
                              gameDataRef.current.particles.push({
                                x: selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                y: selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                color: '#ef4444',
                                size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
                                type: 'FLOAT_TEXT',
                                text: '⚠️ Không có mục tiêu địch trong tầm ngắm!'
                              });
                            }
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-red-600 via-amber-600 to-yellow-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-500/40 border-2 border-amber-300 animate-pulse"
                      >
                        <Crosshair className="w-5 h-5 text-amber-200 animate-spin-slow shrink-0" />
                        <span>🎯 KHAI HỎA PHÁO KÍCH (25 Vàng)</span>
                      </button>
                    )}
                  </div>
                  )}
                  {(() => {
                    const ownerNation = gameDataRef.current.nations[selectedTile.owner];
                    const isTribe = ownerNation && ownerNation.colonyCategory === 'TRIBE';
                    const neighborTiles = [
                      [selectedTile.x + 1, selectedTile.y], [selectedTile.x - 1, selectedTile.y], 
                      [selectedTile.x, selectedTile.y + 1], [selectedTile.x, selectedTile.y - 1]
                    ];
                    const isAdjacent = neighborTiles.some(([nx, ny]) => gameDataRef.current.tiles[ny]?.[nx]?.owner === 1);

                    if (isTribe && isAdjacent) {
                      return (
                        <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-amber-300 truncate">Bộ lạc lân cận</span>
                          <button
                            onClick={() => {
                              const player = gameDataRef.current.nations[1];
                              if (player.gold >= 80) {
                                player.gold -= 80;
                                selectedTile.owner = 1;
                                player.population += 10;
                                soundManager.playCapture();
                                setSelectedTile({ ...selectedTile, owner: 1 });
                                selectedTileRef.current = { ...selectedTile, owner: 1 };
                                offscreenTerritoryDirtyRef.current = true;
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow shrink-0"
                          >
                            <span>⛺ Thu Phục (80 Vàng)</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800/80 flex items-center justify-between gap-1">
                        <span className="truncate">Chủ quản: <strong className="text-slate-200">{ownerNation?.name || 'Đất hoang'}</strong></span>
                        <div className="flex items-center gap-1 shrink-0">
                          {ownerNation && !ownerNation.colonyCategory && (
                            <button
                              onClick={() => {
                                setIsDiplomacyOpen(true);
                                soundManager.playClick();
                              }}
                              className="px-2 py-1 bg-blue-600/90 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow"
                            >
                              <Handshake className="w-3 h-3" />
                              <span>Ngoại Giao</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const player = gameDataRef.current.nations[1];
                              if (player.troops >= 5) {
                                const neighborTiles = [
                                  [selectedTile.x + 1, selectedTile.y], [selectedTile.x - 1, selectedTile.y],
                                  [selectedTile.x, selectedTile.y + 1], [selectedTile.x, selectedTile.y - 1]
                                ];
                                const isAdjacent = neighborTiles.some(([nx, ny]) => gameDataRef.current.tiles[ny]?.[nx]?.owner === 1);
                                if (!isAdjacent && (!player.hasPort || !selectedTile.hasHarborAccess)) {
                                  soundManager.playClick();
                                  return;
                                }

                                const isNeutral = selectedTile.owner === 0;
                                let customQueue: { x: number; y: number }[] | undefined = undefined;

                                if (isNeutral) {
                                  const tiles = gameDataRef.current.tiles;
                                  const size = tiles.length;
                                  const q: { x: number; y: number }[] = [];
                                  const visited = new Set<string>();

                                  visited.add(`${selectedTile.x},${selectedTile.y}`);
                                  q.push({ x: selectedTile.x, y: selectedTile.y });

                                  let head = 0;
                                  while (head < q.length && q.length < 25) {
                                    const cur = q[head++];
                                    const nb = [
                                      { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
                                      { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 },
                                    ];
                                    for (const n of nb) {
                                      if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size) {
                                        const k = `${n.x},${n.y}`;
                                        const t = tiles[n.y][n.x];
                                        if (!visited.has(k) && t.owner === 0 && t.terrain !== 'WATER') {
                                          visited.add(k);
                                          q.push(n);
                                          if (q.length >= 25) break;
                                        }
                                      }
                                    }
                                  }
                                  customQueue = q;
                                }

                                let bestSource: Tile | null = null;
                                let minDistance = Infinity;
                                const tiles = gameDataRef.current.tiles;
                                for (let y = 0; y < tiles.length; y++) {
                                  for (let x = 0; x < tiles.length; x++) {
                                    const t = tiles[y][x];
                                    if (t.owner === 1) {
                                      const dist = Math.hypot(t.x - selectedTile.x, t.y - selectedTile.y);
                                      if (dist < minDistance) {
                                        minDistance = dist;
                                        bestSource = t;
                                      }
                                    }
                                  }
                                }
                                if (bestSource) {
                                  const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
                                  launchAttackWave(1, selectedTile.owner, bestSource, selectedTile, troopsToSend, customQueue);
                                }
                              }
                            }}
                            className={`px-2 py-1 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow active:scale-95 text-white ${
                              selectedTile.owner === 0 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                            }`}
                          >
                            <Swords className="w-3 h-3" />
                            <span>
                              {selectedTile.owner === 0 
                                ? `Mở Rộng Đất Hoang (${actualAttackTroops} Quân)` 
                                : `Tấn Công (${actualAttackTroops} Quân)`}
                            </span>
                          </button>
                        </div>

                      {/* NÚT BẮN PHÁO KÍCH TRỰC TIẾP TẠI BẢNG MỤC TIÊU ĐỊCH / TRUNG LẬP */}
                        {(() => {
                          const player = gameDataRef.current.nations[1];
                          const tiles = gameDataRef.current.tiles;
                          let nearestArtillery: Tile | null = null;
                          let minArtDist = Infinity;

                          for (let y = 0; y < tiles.length; y++) {
                            for (let x = 0; x < tiles.length; x++) {
                              const t = tiles[y][x];
                              if (t.owner === 1 && t.building === 'ARTILLERY') {
                                const dist = Math.hypot(t.x - selectedTile.x, t.y - selectedTile.y);
                                const maxRange = 6.5 + Math.min(3, (t.buildingLevel || 1) - 1);
                                if (dist <= maxRange && dist < minArtDist) {
                                  minArtDist = dist;
                                  nearestArtillery = t;
                                }
                              }
                            }
                          }

                          if (!nearestArtillery) return null;

                          return (
                            <button
                              onClick={() => {
                                const cost = 25;
                                if (player.gold >= cost && nearestArtillery) {
                                  player.gold -= cost;
                                  const gunnerLvl = nearestArtillery.buildingLevel || 1;
                                  const artilleryDamage = 25 * gunnerLvl;

                                  const enemyNat = selectedTile.owner > 0 ? gameDataRef.current.nations[selectedTile.owner] : null;
                                  if (enemyNat) {
                                    enemyNat.troops = Math.max(0, enemyNat.troops - artilleryDamage);
                                  }
                                  selectedTile.scorchedTimer = 35;

                                  const startPxX = nearestArtillery.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                                  const startPxY = nearestArtillery.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                                  const endPxX = selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                                  const endPxY = selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

                                  // Đường đạn neon tracer
                                  for (let step = 0; step < 12; step++) {
                                    const ratio = step / 12;
                                    gameDataRef.current.particles.push({
                                      x: startPxX + (endPxX - startPxX) * ratio,
                                      y: startPxY + (endPxY - startPxY) * ratio,
                                      color: '#38bdf8',
                                      size: 3.5,
                                      life: 25 + step * 2,
                                      maxLife: 45,
                                      vx: 0,
                                      vy: 0,
                                      type: 'SPARK',
                                    });
                                  }

                                  // Vụ nổ bán cầu
                                  for (let p = 0; p < 24; p++) {
                                    const angle = Math.PI + Math.random() * Math.PI;
                                    const speed = 1.5 + Math.random() * 3.5;
                                    gameDataRef.current.particles.push({
                                      x: endPxX,
                                      y: endPxY,
                                      color: p % 2 === 0 ? '#f97316' : '#ef4444',
                                      size: 3 + Math.random() * 3,
                                      life: 30 + Math.floor(Math.random() * 15),
                                      maxLife: 45,
                                      vx: Math.cos(angle) * speed,
                                      vy: Math.sin(angle) * speed - 0.8,
                                      type: 'SPARK',
                                    });
                                  }

                                  gameDataRef.current.particles.push({
                                    x: endPxX,
                                    y: endPxY,
                                    color: '#fbbf24',
                                    size: 0,
                                    life: 40,
                                    maxLife: 40,
                                    vx: 0,
                                    vy: -0.8,
                                    type: 'FLOAT_TEXT',
                                    text: `💥 -${artilleryDamage} Pháo Kích Trúng Đích!`
                                  });

                                  soundManager.playAttack();
                                } else {
                                  gameDataRef.current.particles.push({
                                    x: selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                    y: selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                    color: '#ef4444',
                                    size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
                                    type: 'FLOAT_TEXT',
                                    text: nearestArtillery ? '⚠️ Không đủ 25 Vàng!' : '⚠️ Không có Đại Pháo trong tầm ngắm (6.5 ô)!'
                                  });
                                }
                              }}
                              className="w-full mt-1.5 py-2 px-3 bg-gradient-to-r from-red-600 via-amber-600 to-yellow-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg border-2 border-amber-300 animate-pulse"
                            >
                              <Crosshair className="w-4 h-4 text-amber-200 animate-spin-slow shrink-0" />
                              <span>🎯 Bắn Pháo Kích Vào Ô Này (25 Vàng)</span>
                            </button>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </>

                {/* NÚT TIẾN CÔNG TÀ THẦN NẾU ĐANG CÓ TÀ THẦN Ở Ô NÀY */}
                {(() => {
                  const titanOnTile = (gameDataRef.current.darkTitans || []).find(
                    t => t.isActive && t.x === selectedTile.x && t.y === selectedTile.y
                  ) || (
                    gameDataRef.current.darkTitan?.isActive &&
                    gameDataRef.current.darkTitan.x === selectedTile.x &&
                    gameDataRef.current.darkTitan.y === selectedTile.y
                      ? gameDataRef.current.darkTitan
                      : null
                  );

                  if (!titanOnTile) return null;

                  return (
                    <div className="mt-1.5 pt-1.5 border-t border-purple-800/80">
                      <button
                        onClick={() => {
                          const player = gameDataRef.current.nations[1];
                          if (player.troops >= 5) {
                            let bestSource: Tile | null = null;
                            let minDistance = Infinity;
                            const tiles = gameDataRef.current.tiles;
                            for (let y = 0; y < tiles.length; y++) {
                              for (let x = 0; x < tiles.length; x++) {
                                const t = tiles[y][x];
                                if (t.owner === 1) {
                                  const dist = Math.hypot(t.x - selectedTile.x, t.y - selectedTile.y);
                                  if (dist < minDistance) {
                                    minDistance = dist;
                                    bestSource = t;
                                  }
                                }
                              }
                            }
                            if (bestSource) {
                              const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
                              launchAttackWave(1, 0, bestSource, selectedTile, troopsToSend);
                              soundManager.playGeneralHorn();
                            }
                          }
                        }}
                        className="w-full py-1.5 px-2 bg-gradient-to-r from-red-600 via-purple-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/30 border border-purple-400/50"
                      >
                        <Swords className="w-4 h-4 text-amber-300" />
                        <span>⚔️ Diệt Tà Thần ({actualAttackTroops} Quân) — HP: {titanOnTile.hp ?? 1200}/{titanOnTile.maxHp ?? 1200}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>


          {/* THANH DƯỚI CÙNG: THANH TRƯỢT ĐIỀU QUÂN & CÔNG CỤ TINH GỌN */}
          <footer className="bg-slate-900/95 border-t border-slate-800 p-2 sm:p-2.5 z-20 shrink-0 space-y-1.5">
            {/* HÀNG SLIDER CHỈNH QUÂN ĐỘI & TRẠNG THÁI TƯỚNG GỌN GÀNG */}
            <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-300 flex items-center gap-1">
                  <Swords className="w-3.5 h-3.5 text-amber-400" /> Tỉ lệ xuất quân:
                </span>
                <span className="text-amber-400 font-mono text-[11px]">
                  {attackPercent}% → <strong className="text-white font-extrabold">{actualAttackTroops} Quân</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={attackPercent}
                  onChange={(e) => setAttackPercent(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                {/* Các nút bấm nhanh 25%, 50%, 75%, 100% */}
                <div className="flex items-center gap-1 shrink-0">
                  {[25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAttackPercent(pct)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                        attackPercent === pct
                          ? 'bg-amber-500 border-amber-300 text-slate-950 font-extrabold'
                          : 'bg-slate-800 border-slate-700/80 text-slate-400'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* TRẠNG THÁI TƯỚNG (GỌN GÀNG 1 DÒNG) */}
              {(() => {
                const pGen = gameDataRef.current.nations[1]?.general;
                if (!pGen) return null;
                const isMarching = pGen.status === 'MARCHING';
                const isInjured = pGen.status === 'RECOVERING';

                return (
                  <div className="flex items-center justify-between text-[10px] bg-slate-900/70 px-2 py-1 rounded-lg border border-slate-800/80 text-slate-300">
                    <div className="flex items-center gap-1 font-bold text-amber-400">
                      <Crown className="w-3 h-3" /> {pGen.name}
                      <span className="text-[9px] text-slate-400 font-normal hidden xs:inline">(+30% Sức mạnh)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                        isMarching 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse' 
                          : isInjured 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {isMarching ? '⚔️ Ra Trận' : isInjured ? `🤕 Hồi (${pGen.reviveTimer}s)` : '🛡️ Thủ Đô'}
                      </span>

                      {!isInjured && (
                        <button
                          onClick={() => {
                            setPlayerGeneralDeployMode(prev => !prev);
                            soundManager.playClick();
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                            playerGeneralDeployMode 
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' 
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {playerGeneralDeployMode ? '⚔️ Xuất Kèm' : '🛡️ Giữ Thủ'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 4 NÚT HÀNH ĐỘNG GỌN GÀNG, TIẾT KIỆM KHÔNG GIAN BẢN ĐỒ */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setAutoExpand(!autoExpand)}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 min-h-[38px] ${
                  autoExpand
                    ? 'bg-emerald-700 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span>🤖 {autoExpand ? 'Tự Động' : 'Tắt'}</span>
              </button>

              <button
                onClick={() => {
                  if (!selectedTile) {
                    const player = gameDataRef.current.nations[1];
                    if (player) {
                      const cap = gameDataRef.current.tiles[player.capitalY]?.[player.capitalX];
                      if (cap) {
                        setSelectedTile(cap);
                        selectedTileRef.current = cap;
                      }
                    }
                  }
                  setIsBuildOpen(true);
                }}
                className="py-2 px-1 bg-amber-600 hover:bg-amber-500 border border-amber-400 text-slate-950 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 shadow active:scale-95 min-h-[38px]"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Xây Dựng</span>
              </button>

              <button
                disabled={!canTech}
                onClick={() => setIsTechOpen(true)}
                className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 border transition-all active:scale-95 min-h-[38px] ${
                  canTech
                    ? 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white shadow'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Công Nghệ</span>
              </button>

              <button
                disabled={!hasMetBot}
                onClick={() => setIsDiplomacyOpen(true)}
                className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 border transition-all active:scale-95 min-h-[38px] ${
                  hasMetBot
                    ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white shadow'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Flag className="w-3.5 h-3.5 shrink-0" />
                <span>Ngoại Giao</span>
              </button>
            </div>
          </footer>
        </>
      )}

      {/* MODALS */}
      {(() => {
        const player = gameDataRef.current.nations[1];
        const activeBuildTarget = selectedTile ||
          (player ? gameDataRef.current.tiles[player.capitalY]?.[player.capitalX] : null);

        const buildingCounts: Record<BuildingType, number> = { NONE: 0, CITY: 0, BARRACKS: 0, FORTRESS: 0, PORT: 0, ARTILLERY: 0, MISSILE_SILO: 0, AIR_DEFENSE: 0 };
        if (isBuildOpen) {
          const tiles = gameDataRef.current.tiles;
          for (let r = 0; r < tiles.length; r++) {
            const row = tiles[r];
            for (let c = 0; c < row.length; c++) {
              const t = row[c];
              if (t.owner === 1 && t.building !== 'NONE') {
                buildingCounts[t.building] = (buildingCounts[t.building] || 0) + 1;
              }
            }
          }
        }

        return (
          <BuildModal
            isOpen={isBuildOpen}
            onClose={() => setIsBuildOpen(false)}
            selectedTile={activeBuildTarget}
            playerNation={player || {}}
            existingBuildingCounts={buildingCounts}
            onBuild={(type, count) => executeBuild(activeBuildTarget, type, count)}
          />
        );
      })()}

      <TechModal
        isOpen={isTechOpen}
        onClose={() => setIsTechOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        researching={gameDataRef.current.researching}
        onStartResearch={(tech) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          if (player.gold >= tech.cost) {
            player.gold -= tech.cost;
            data.researching = { techId: tech.id, remainingTime: tech.researchTime, totalTime: tech.researchTime };
            soundManager.playClick();
          }
        }}
      />

      <DiplomacyModal
        isOpen={isDiplomacyOpen}
        onClose={() => setIsDiplomacyOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        nations={gameDataRef.current.nations}
        totalLandCount={totalLandCountRef.current || 1}
        onFocusNation={focusOnNation}
        onProposeTruce={(id) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const targetNat = data.nations[id];
          player.diplomacy[id] = { status: 'TRUCE', relation: 20, truceTimer: 45 };
          soundManager.playTruce();
          data.events.unshift({
            id: Math.random().toString(),
            title: 'Hiệp Ước Đình Chiến',
            description: `🕊️ Đã ký hiệp ước đình chiến với ${targetNat?.name || 'quốc gia láng giềng'}!`,
            type: 'DIPLOMACY',
            targetNationId: id,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }}
        onProposeAlliance={(id) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const targetNat = data.nations[id];
          player.diplomacy[id] = { status: 'ALLIANCE', relation: 60, truceTimer: 60 };
          soundManager.playCapture();
          data.events.unshift({
            id: Math.random().toString(),
            title: 'Liên Minh Quân Sự',
            description: `🤝 Đã kết đồng minh với ${targetNat?.name || 'quốc gia'}! Nhận thêm 10% vàng giao thương mỗi chu kỳ!`,
            type: 'DIPLOMACY',
            targetNationId: id,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }}
        onDeclareWar={(id) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const targetNat = data.nations[id];
          player.diplomacy[id] = { status: 'WAR', relation: -50, truceTimer: 0 };
          soundManager.playAttack();
          data.events.unshift({
            id: Math.random().toString(),
            title: 'Tuyên Chiến',
            description: `⚔️ Đã tuyên chiến với ${targetNat?.name || 'quốc gia'}!`,
            type: 'DIPLOMACY',
            targetNationId: id,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }}
      />

      <EventLogModal
        isOpen={isEventLogOpen}
        onClose={() => setIsEventLogOpen(false)}
        events={gameDataRef.current.events}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(prev => !prev)}
        isPaused={isPaused}
        onTogglePause={() => {
          setIsPaused(prev => {
            const next = !prev;
            if (next) saveGameRef.current();
            return next;
          });
        }}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(prev => {
          const next = !prev;
          try {
            localStorage.setItem('pixel_empire_show_minimap', String(next));
          } catch {}
          return next;
        })}
        weatherEnabled={weatherEnabled}
        onToggleWeather={toggleWeather}
        weather={weather}
        onCycleWeather={cycleWeather}
        onQuitToTitle={() => {
          saveGameRef.current();
          setGameState('TITLE');
          soundManager.playClick();
        }}
      />

      <CreativeModal
        isOpen={isCreativeOpen}
        onClose={() => setIsCreativeOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        currentWeather={weather}
        darkTitans={gameDataRef.current.darkTitans || []}
        onSetGold={handleSetGold}
        onAddGold={handleAddGold}
        onSetTroops={handleSetTroops}
        onAddTroops={handleAddTroops}
        onChangeWeather={handleChangeWeather}
        onTriggerLightningSpam={handleTriggerLightningSpam}
        onSpawnDarkTitan={handleSpawnDarkTitan}
        onClearDarkTitans={handleClearDarkTitans}
        onUnlockAllTech={handleUnlockAllTech}
        onClearAllScorched={handleClearAllScorched}
        onClaimSelectedTile={handleClaimSelectedTile}
        selectedTileCoords={selectedTile ? { x: selectedTile.x, y: selectedTile.y } : null}
        godModeLocked={godModeLocked}
        onToggleGodModeLocked={handleToggleGodModeLocked}
      />

      {/* MÀN HÌNH KẾT THÚC */}
      {gameState === 'VICTORY' && (
        <>
          <VictoryConfettiCanvas />
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
            <div className="bg-slate-900/95 border border-amber-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl shadow-amber-500/20 max-h-[92vh] overflow-y-auto">
              <Award className="w-14 h-14 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 mb-1 tracking-tight">🎉 ĐẠI THỐNG NHẤT!</h2>
              <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                Chúc mừng! Bạn đã chinh phục thành công <strong className="text-amber-400 font-mono text-sm">{hudStats.landPercent}%</strong> bản đồ và xưng bá thiên hạ!
              </p>

              {/* BẢNG XẾP HẠNG LÃNH THỔ CÁC QUỐC GIA */}
              <MatchLeaderboard
                nations={gameDataRef.current.nations}
                myNationId={myNationIdRef.current || 1}
                totalLand={totalLandCountRef.current || 1}
                isVictory={true}
              />

              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => {
                    if (isMultiplayer) {
                      setGameState('TITLE');
                      setIsMultiplayerModalOpen(true);
                    } else {
                      startNewGame(difficulty, mapSize, playerName, gameMode);
                    }
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black rounded-2xl shadow-xl text-sm min-h-[48px] active:scale-95 transition-all"
                >
                  {isMultiplayer ? 'Quay Lại Phòng Chờ' : 'Chơi Ván Mới Chinh Phục'}
                </button>
                {isMultiplayer && (
                  <button
                    onClick={() => {
                      setIsMultiplayer(false);
                      multiplayerClient.leaveRoom();
                      setGameState('TITLE');
                    }}
                    className="w-full py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 min-h-[44px]"
                  >
                    Thoát Về Màn Hình Chính
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {gameState === 'DEFEAT' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl max-h-[92vh] overflow-y-auto">
            <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-2 animate-pulse" />
            <h2 className="text-2xl font-black text-white mb-1">ĐẾ CHẾ SỤP ĐỔ!</h2>
            <p className="text-xs text-slate-300 mb-2">Lãnh thổ của bạn đã hoàn toàn thất thủ.</p>

            {/* BẢNG XẾP HẠNG LÃNH THỔ CÁC QUỐC GIA */}
            <MatchLeaderboard
              nations={gameDataRef.current.nations}
              myNationId={myNationIdRef.current || 1}
              totalLand={totalLandCountRef.current || 1}
              isVictory={false}
            />

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  if (isMultiplayer) {
                    setGameState('TITLE');
                    setIsMultiplayerModalOpen(true);
                  } else {
                    startNewGame(difficulty, mapSize, playerName, gameMode);
                  }
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg text-sm min-h-[48px] active:scale-95"
              >
                {isMultiplayer ? 'Quay Lại Phòng Chờ' : 'Thử Lại Ngay'}
              </button>
              {isMultiplayer && (
                <button
                  onClick={() => {
                    setIsMultiplayer(false);
                    multiplayerClient.leaveRoom();
                    setGameState('TITLE');
                  }}
                  className="w-full py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 min-h-[44px]"
                >
                  Thoát Về Màn Hình Chính
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PHÒNG CHƠI NHIỀU NGƯỜI (MULTIPLAYER LOBBY) */}
      <MultiplayerModal
        isOpen={isMultiplayerModalOpen}
        onClose={() => setIsMultiplayerModalOpen(false)}
        defaultPlayerName={playerName}
        initialRoomCode={urlRoomCode}
        onStartMultiplayerGame={handleStartMultiplayerGame}
      />

      {/* POPUP XÁC NHẬN CHƠI MỚI / XÓA VÁN CŨ (HOẠT ĐỘNG 100% TRÊN ĐIỆN THOẠI & IFRAME) */}
      {showConfirmNewGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Bắt Đầu Ván Mới?</h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Ván chơi đã lưu trước đây của bạn sẽ bị xóa vĩnh viễn để bắt đầu trận đấu mới từ đầu.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  deleteSavedGame();
                  setShowConfirmNewGame(false);
                  startNewGame(difficulty, mapSize, playerName, gameMode);
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg min-h-[46px]"
              >
                <RotateCcw className="w-4 h-4" />
                Xóa Ván Cũ & Bắt Đầu Chơi Mới
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmNewGame(false)}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-2xl text-xs border border-slate-700 min-h-[44px]"
              >
                Hủy Bỏ (Giữ Lại Ván Cũ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST THÔNG BÁO LỖI NẠP VÁN */}
      {loadErrorToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-2xl text-xs flex items-center gap-2 border border-rose-400 animate-in slide-in-from-top">
          <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
          <span>{loadErrorToast}</span>
        </div>
      )}

    </div>
  );
}
