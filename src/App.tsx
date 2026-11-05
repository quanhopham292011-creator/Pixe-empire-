/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BuildingType, MapDimension, GameDifficulty, Tile, Nation, 
  AttackWave, GameParticle, GameEvent, ResearchingTech, TechNode, QuestStep, General,
  WeatherType, WeatherParticle, WeatherCloudPuff
} from './types';
import { generateWorldMap } from './utils/mapGenerator';
import { soundManager } from './utils/audio';
import { BUILDING_INFO, TECH_TREE, formatPopulation } from './utils/constants';
import { BuildModal } from './components/BuildModal';
import { TechModal } from './components/TechModal';
import { DiplomacyModal } from './components/DiplomacyModal';
import { Minimap } from './components/Minimap';
import { EventTicker, EventLogModal } from './components/EventTicker';
import { SettingsModal } from './components/SettingsModal';

import { 
  Shield, Castle, Coins, Users, Play, Pause, FastForward, 
  RotateCcw, ZoomIn, ZoomOut, Swords, Building2, Award, 
  TrendingUp, AlertTriangle, Volume2, VolumeX, HelpCircle, 
  Sparkles, Flag, Crown, Check, Lock, ChevronRight, X, Anchor, Edit3, Settings,
  Cloud, CloudRain, Sun
} from 'lucide-react';

const TILE_PIXEL_SIZE = 24; // Kích thước ô chuẩn 24px

export default function App() {
  const [gameState, setGameState] = useState<'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>('TITLE');
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('EASY');
  const [mapSize, setMapSize] = useState<MapDimension>(96); // Mặc định 96x96

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

  // HUD stats
  const [hudStats, setHudStats] = useState({
    gold: 120,
    goldIncome: 4,
    troops: 20,
    maxTroops: 30,
    landPercent: 5,
    territoryCount: 12,
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
    const mapPx = dimension * TILE_PIXEL_SIZE;
    const particles: WeatherParticle[] = [];

    // 1. Luôn tạo 20-30 cụm mây trôi bềnh bồng pixel-art
    const cloudCount = dimension === 64 ? 18 : dimension === 96 ? 26 : 34;
    for (let i = 0; i < cloudCount; i++) {
      const x = Math.random() * (mapPx + 200) - 100;
      const y = Math.random() * (mapPx + 100) - 50;
      const vx = 14 + Math.random() * 12; // Gió thổi nhẹ 14 - 26 px/s
      const vy = 1.5 + Math.random() * 3.0;
      const baseW = 54 + Math.random() * 46;
      const baseH = 22 + Math.random() * 18;
      const opacity = type === 'CLEAR' ? (0.22 + Math.random() * 0.15) : (0.32 + Math.random() * 0.22);

      // Cụm múi mây (puffs) mềm mại chuẩn đồ họa Canvas
      const puffs: WeatherCloudPuff[] = [
        { dx: 0, dy: 0, w: baseW * 0.55, h: baseH * 0.45, alpha: 0.95 },
        { dx: baseW * 0.35, dy: baseH * 0.10, w: baseW * 0.42, h: baseH * 0.38, alpha: 0.85 },
        { dx: -baseW * 0.32, dy: baseH * 0.12, w: baseW * 0.38, h: baseH * 0.35, alpha: 0.80 },
        { dx: baseW * 0.15, dy: -baseH * 0.20, w: baseW * 0.45, h: baseH * 0.40, alpha: 0.90 },
        { dx: -baseW * 0.12, dy: -baseH * 0.18, w: baseW * 0.40, h: baseH * 0.36, alpha: 0.88 },
      ];

      particles.push({
        x,
        y,
        vx,
        vy,
        width: baseW,
        height: baseH,
        opacity,
        type: 'CLOUD',
        puffs,
      });
    }

    // 2. Nếu trời MƯA (RAIN), thêm 80-120 hạt mưa lướt nghiêng
    if (type === 'RAIN') {
      const rainCount = dimension === 64 ? 65 : dimension === 96 ? 95 : 130;
      for (let i = 0; i < rainCount; i++) {
        particles.push({
          x: Math.random() * (mapPx + 100) - 50,
          y: Math.random() * (mapPx + 100) - 50,
          vx: 40 + Math.random() * 25,
          vy: 300 + Math.random() * 120,
          width: 1.5,
          height: 12 + Math.random() * 6,
          opacity: 0.35 + Math.random() * 0.25,
          type: 'RAIN_DROP',
        });
      }
    }

    weatherParticlesRef.current = particles;
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
    customName: string = playerName
  ) => {
    const { tiles, nations } = generateWorldMap(chosenSize, chosenDiff, customName);
    setAutoExpand(chosenDiff === 'EASY');

    gameDataRef.current = {
      tiles,
      nations,
      attackWaves: [],
      particles: [],
      events: [
        {
          id: '1',
          title: 'Khởi Đầu Trái Đất',
          description: `Chào mừng Đại Đế ${nations[1]?.name}! Xuất phát tại khu vực Việt Nam / Đông Nam Á. Hãy chinh phục các thuộc địa & làm chủ thế giới.`,
          type: 'HARVEST',
          targetNationId: 1,
          timestamp: '00:00',
        }
      ],
      researching: null,
      gameTimeSeconds: 0,
      hasMetBot: false,
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

  // Buffer 1: Render Địa Hình Tĩnh Tối Ưu Đồ Họa Pixel (Biển, Bọt Sóng, Núi Tuyết, Tán Rừng)
  const renderTerrainBuffer = useCallback((size: number) => {
    if (!offscreenTerrainCanvasRef.current) {
      offscreenTerrainCanvasRef.current = document.createElement('canvas');
    }
    const offCanvas = offscreenTerrainCanvasRef.current;
    offCanvas.width = size * TILE_PIXEL_SIZE;
    offCanvas.height = size * TILE_PIXEL_SIZE;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    const tiles = gameDataRef.current.tiles;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = tiles[y]?.[x];
        if (!t) continue;

        const px = x * TILE_PIXEL_SIZE;
        const py = y * TILE_PIXEL_SIZE;

        if (t.terrain === 'WATER') {
          // Nền biển đại dương sâu
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);

          // Họa tiết sóng biển nhẹ nhàng
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(px + 3, py + 4, 10, 2);
          ctx.fillRect(px + 12, py + 14, 8, 2);

          // Đường bọt sóng biển ven bờ (khi tiếp giáp Đất liền)
          const hasLandNeighbor = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(
            ([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain !== 'WATER'
          );
          if (hasLandNeighbor) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.fillRect(px + 1, py + 1, TILE_PIXEL_SIZE - 2, TILE_PIXEL_SIZE - 2);
          }
        } else if (t.terrain === 'MOUNTAIN') {
          // Núi cao có vách đá và tuyết đỉnh núi
          ctx.fillStyle = '#334155';
          ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);

          // Vách bóng râm núi
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(px + 12, py + 4, 10, 18);

          // Đỉnh núi tuyết trắng chói
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(px + 12, py + 2);
          ctx.lineTo(px + 5, py + 10);
          ctx.lineTo(px + 19, py + 10);
          ctx.closePath();
          ctx.fill();
        } else if (t.terrain === 'FOREST') {
          // Nền đất rừng
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);

          // Tán cây xanh nhiều lớp
          ctx.fillStyle = '#15803d';
          ctx.fillRect(px + 2, py + 2, 20, 20);

          ctx.fillStyle = '#16a34a';
          ctx.fillRect(px + 5, py + 5, 14, 14);

          ctx.fillStyle = '#4ade80';
          ctx.fillRect(px + 7, py + 7, 5, 5);
        } else {
          // Đất liền thường
          ctx.fillStyle = '#334155';
          ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);

          ctx.fillStyle = '#475569';
          ctx.fillRect(px + 4, py + 4, 3, 3);
          ctx.fillRect(px + 16, py + 14, 3, 3);
        }
      }
    }
  }, []);

  // Buffer 2: Render Đồ Họa Chuẩn OpenFront (Đường viền Neon chói & Nét căng)
  const renderTerritoryBuffer = useCallback((size: number) => {
    if (!offscreenTerritoryCanvasRef.current) {
      offscreenTerritoryCanvasRef.current = document.createElement('canvas');
    }
    const offCanvas = offscreenTerritoryCanvasRef.current;
    offCanvas.width = size * TILE_PIXEL_SIZE;
    offCanvas.height = size * TILE_PIXEL_SIZE;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    ctx.imageSmoothingEnabled = false;
    const { tiles, nations } = gameDataRef.current;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = tiles[y]?.[x];
        if (!t || t.terrain === 'WATER') continue;

        const px = x * TILE_PIXEL_SIZE;
        const py = y * TILE_PIXEL_SIZE;

        if (t.owner > 0) {
          const nation = nations[t.owner];
          if (nation) {
            ctx.fillStyle = nation.color;
            ctx.globalAlpha = nation.isPlayer ? 0.88 : (nation.tier === 'BOSS' ? 0.82 : 0.65);
            ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
            ctx.globalAlpha = 1.0;

            // Đường viền Neon chói OpenFront
            const isNeonGlowing = nation.isPlayer || nation.tier === 'BOSS';
            ctx.strokeStyle = nation.isPlayer ? '#38bdf8' : (nation.tier === 'BOSS' ? '#f43f5e' : nation.color);
            ctx.lineWidth = isNeonGlowing ? 3.0 : 1.8;
            ctx.shadowColor = nation.isPlayer ? '#00f2fe' : (nation.tier === 'BOSS' ? '#ff0055' : nation.color);
            ctx.shadowBlur = isNeonGlowing ? 6 : 0;

            if (y === 0 || tiles[y - 1][x].owner !== t.owner) {
              ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + TILE_PIXEL_SIZE, py); ctx.stroke();
            }
            if (y === size - 1 || tiles[y + 1][x].owner !== t.owner) {
              ctx.beginPath(); ctx.moveTo(px, py + TILE_PIXEL_SIZE); ctx.lineTo(px + TILE_PIXEL_SIZE, py + TILE_PIXEL_SIZE); ctx.stroke();
            }
            if (x === 0 || tiles[y][x - 1].owner !== t.owner) {
              ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + TILE_PIXEL_SIZE); ctx.stroke();
            }
            if (x === size - 1 || tiles[y][x + 1].owner !== t.owner) {
              ctx.beginPath(); ctx.moveTo(px + TILE_PIXEL_SIZE, py); ctx.lineTo(px + TILE_PIXEL_SIZE, py + TILE_PIXEL_SIZE); ctx.stroke();
            }
            ctx.shadowBlur = 0;
          }
        } else {
          // Đất trung lập xám sáng
          ctx.fillStyle = '#64748b';
          ctx.globalAlpha = 0.35;
          ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
          ctx.globalAlpha = 1.0;
        }
      }
    }
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

      // 4. Vẽ Công Trình trong màn hình
      for (let y = minTileY; y <= maxTileY; y++) {
        for (let x = minTileX; x <= maxTileX; x++) {
          const t = tiles[y][x];
          if (t.building !== 'NONE') {
            const px = x * TILE_PIXEL_SIZE;
            const py = y * TILE_PIXEL_SIZE;
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
              if (!buildingCounts[t.owner]) buildingCounts[t.owner] = { NONE: 0, CITY: 0, BARRACKS: 0, FORTRESS: 0, PORT: 0 };
              buildingCounts[t.owner][t.building] = (buildingCounts[t.owner][t.building] || 0) + 1;
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
        n.territoryCount = territoryCounts[n.id] || 0;
        const b = buildingCounts[n.id];
        n.hasPort = (b?.PORT || 0) > 0;

        n.population += Math.floor(n.territoryCount * 0.05 + (b?.CITY || 0) * 1);

        const diffMult = difficulty === 'HARD' ? 1.3 : difficulty === 'NORMAL' ? 1.15 : 1.0;
        n.maxTroops = Math.max(15, Math.floor((n.population * 3 + n.territoryCount * 4 + (b?.BARRACKS || 0) * 40) * (n.id > 1 ? diffMult : 1.0)));
        
        const growth = Math.max(1, Math.floor((n.population * 0.1 + (b?.BARRACKS || 0) * 3) * (n.id > 1 ? diffMult : 1.0)));
        if (n.troops < n.maxTroops) {
          n.troops = Math.min(n.maxTroops, Math.round(n.troops + growth));
        }

        n.goldIncome = Math.max(1, Math.floor((n.population * 0.35 + n.territoryCount * 0.2 + (b?.CITY || 0) * 6) * (n.id > 1 ? diffMult : 1.0)));
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
              timestamp: 'Vừa xong',
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

      // 4. AI Bot & Thuộc Địa nhỏ phát triển
      const canBotsAct = data.gameTimeSeconds >= 4;
      if (canBotsAct) {
        const totalLand = tiles.flat().filter(t => t.terrain !== 'WATER').length;
        const playerLandPct = totalLand > 0 ? (nations[1]?.territoryCount / totalLand) : 0;

        nations.forEach(bot => {
          if (bot.id <= 1 || bot.isEliminated) return;

          // Rừng hoang dã ([Rừng]) hoàn toàn tĩnh lặng, không tham chiến hay đi xâm chiếm
          if (bot.colonyCategory === 'FOREST') return;

          // --- 1. ĐÁNH GIÁ MỨC ĐỘ ĐE DỌA BIÊN GIỚI ---
          const borderThreats: { tile: Tile; threatScore: number; enemySource: Tile | null }[] = [];

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const t = tiles[y][x];
              if (t.owner === bot.id) {
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
                          threat += (difficulty === 'HARD' ? 40 : 20);
                          enemySrc = neighborTile;
                        } else if (neighborTile.owner > 1 && dip === 'WAR') {
                          threat += 15;
                          if (!enemySrc) enemySrc = neighborTile;
                        }
                      }
                    }
                  }
                });

                const incomingWaves = data.attackWaves.filter(w => w.targetX === t.x && w.targetY === t.y);
                if (incomingWaves.length > 0) {
                  threat += 60;
                }

                if (threat > 0) {
                  borderThreats.push({ tile: t, threatScore: threat, enemySource: enemySrc });
                }
              }
            }
          }

          borderThreats.sort((a, b) => b.threatScore - a.threatScore);

          // --- 2. ĐIỀU TƯỚNG TRỰC TIẾP BẢO VỆ BẢO VỆ BIÊN GIỚI BỊ ĐE DỌA ---
          const topThreat = borderThreats[0];
          if (topThreat && topThreat.threatScore >= 25 && bot.general && bot.general.status === 'IDLE') {
            bot.general.status = 'MARCHING';
            bot.general.x = topThreat.tile.x;
            bot.general.y = topThreat.tile.y;
          }

          // --- 3. AI XÂY DỰNG TẬP TRUNG TẠI CÁC Ô BIÊN GIỚI BỊ ĐE DỌA ---
          if (bot.gold >= 90 && Math.random() < (difficulty === 'HARD' ? 0.65 : 0.35)) {
            const threatenedTileForBuild = borderThreats.find(b => b.tile.building === 'NONE');
            if (threatenedTileForBuild) {
              const buildType: BuildingType = (difficulty === 'HARD' || threatenedTileForBuild.threatScore >= 30)
                ? (Math.random() < 0.70 ? 'FORTRESS' : 'BARRACKS')
                : (Math.random() < 0.5 ? 'CITY' : 'BARRACKS');

              const bCost = BUILDING_INFO[buildType as Exclude<BuildingType, 'NONE'>].baseCost;
              if (bot.gold >= bCost) {
                bot.gold -= bCost;
                threatenedTileForBuild.tile.building = buildType;
                offscreenTerritoryDirtyRef.current = true;
              }
            }
          }

          // --- 4. TẬP TRUNG QUÂN ĐỘI TIẾN CÔNG / PHẢN CÔNG CHUYÊN SÂU ---
          const minTroopsReq = difficulty === 'HARD' ? 10 : (bot.colonyCategory === 'TRIBE' ? 18 : 12);
          const attackProb = difficulty === 'HARD' ? 0.85 : 0.50;

          if (bot.troops >= minTroopsReq && Math.random() < attackProb) {
            const validTargets: { source: Tile; target: Tile; isPlayer: boolean; threat: number }[] = [];

            borderThreats.forEach(bt => {
              if (bt.enemySource) {
                validTargets.push({
                  source: bt.tile,
                  target: bt.enemySource,
                  isPlayer: bt.enemySource.owner === 1,
                  threat: bt.threatScore,
                });
              }
            });

            if (validTargets.length === 0 && bot.colonyCategory !== 'TRIBE') {
              for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                  const src = tiles[y][x];
                  if (src.owner === bot.id) {
                    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                    neighbors.forEach(([nx, ny]) => {
                      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                        const tgt = tiles[ny][nx];
                        if (tgt.terrain !== 'WATER' && tgt.owner === 0) {
                          validTargets.push({ source: src, target: tgt, isPlayer: false, threat: 5 });
                        }
                      }
                    });
                  }
                }
              }
            }

            if (validTargets.length > 0) {
              let selected = validTargets.find(vt => difficulty === 'HARD' && vt.isPlayer);
              if (!selected) {
                validTargets.sort((a, b) => b.threat - a.threat);
                selected = validTargets[0];
              }

              if (selected) {
                const pct = difficulty === 'HARD' ? (playerLandPct >= 0.15 ? 0.65 : 0.50) : 0.35;
                const troopsToSend = Math.max(5, Math.floor(bot.troops * pct));

                if (troopsToSend >= 5) {
                  launchAttackWave(bot.id, selected.target.owner, selected.source, selected.target, troopsToSend);
                }
              }
            }
          }
        });
      }

      // 5. Tự động mở rộng cho Người chơi
      const player = nations[1];
      if (autoExpand && player.troops > 10 && Math.random() < 0.6) {
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
          launchAttackWave(1, 0, chosen.source, chosen.target, Math.floor(player.troops * (attackPercent / 100)));
        }
      }

      // 6. Cập nhật Attack Waves
      const finishedWaves: number[] = [];
      data.attackWaves.forEach((wave, idx) => {
        wave.progress += wave.speed * (gameSpeed * 0.14);
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

      // 8. Cập nhật HUD
      const totalLand = tiles.flat().filter(t => t.terrain !== 'WATER').length;
      const landPercent = totalLand > 0 ? Math.round((player.territoryCount / totalLand) * 100) : 0;

      setHudStats({
        gold: player.gold,
        goldIncome: player.goldIncome,
        troops: player.troops,
        maxTroops: player.maxTroops,
        landPercent,
        territoryCount: player.territoryCount,
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

  // Xử lý chạm trên bản đồ: Tách biệt hoàn toàn việc chọn/xem lãnh thổ với việc xây dựng
  const handleMapTap = (mapX: number, mapY: number, screenX: number, screenY: number) => {
    const data = gameDataRef.current;
    const { tiles, nations } = data;
    const targetTile = tiles[mapY]?.[mapX];
    if (!targetTile || targetTile.terrain === 'WATER') {
      setSelectedTile(null);
      selectedTileRef.current = null;
      return;
    }

    const player = nations[1];

    // Luôn cập nhật ô đất được chọn để xem thông tin (không kích hoạt xây dựng)
    setSelectedTile(targetTile);
    selectedTileRef.current = targetTile;

    data.particles.push({
      x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      color: targetTile.owner === 1 ? '#fbbf24' : '#38bdf8',
      size: 10,
      life: 15,
      maxLife: 15,
      vx: 0,
      vy: 0,
      type: 'AURA',
    });

    // 1. NẾU LÀ Ô ĐẤT CỦA MÌNH: CHỈ CHỌN / XEM THÔNG TIN, TUYỆT ĐỐI KHÔNG TỰ ĐỘNG XÂY DỰNG!
    if (targetTile.owner === 1) {
      soundManager.playClick();
      return;
    }

    // Kiểm tra hòa bình / đồng minh
    if (targetTile.owner > 1) {
      const dipStatus = player.diplomacy[targetTile.owner]?.status;
      if (dipStatus === 'ALLIANCE' || dipStatus === 'TRUCE') {
        soundManager.playClick();
        data.particles.push({
          x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#38bdf8',
          size: 0,
          life: 30,
          maxLife: 30,
          vx: 0,
          vy: -0.5,
          type: 'FLOAT_TEXT',
          text: dipStatus === 'ALLIANCE' ? 'Đồng minh' : 'Đình chiến'
        });
        return;
      }
    }

    // Kiểm tra ô giáp biên giới OpenFront
    const neighborTiles = [
      [mapX + 1, mapY], [mapX - 1, mapY], [mapX, mapY + 1], [mapX, mapY - 1]
    ];
    const isAdjacentToPlayer = neighborTiles.some(([nx, ny]) => tiles[ny]?.[nx]?.owner === 1);

    if (!isAdjacentToPlayer) {
      // Nếu không giáp đất liền, cần có Hải Cảng (PORT) và ô mục tiêu phải giáp biển
      if (!player.hasPort || !targetTile.hasHarborAccess) {
        soundManager.playClick();
        data.particles.push({
          x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#f59e0b',
          size: 0,
          life: 30,
          maxLife: 30,
          vx: 0,
          vy: -0.5,
          type: 'FLOAT_TEXT',
          text: !player.hasPort ? 'Cần xây Hải Cảng để vượt biển!' : 'Cần đánh ô giáp biên giới!'
        });
        return;
      }
    }

    // Kiểm tra kho quân
    if (player.troops < 5) {
      soundManager.playClick();
      data.particles.push({
        x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#ef4444',
        size: 0,
        life: 30,
        maxLife: 30,
        vx: 0,
        vy: -0.5,
        type: 'FLOAT_TEXT',
        text: 'Chưa đủ quân'
      });
      return;
    }

    // Tìm ô xuất phát gần nhất sát biên giới
    let bestSource: Tile | null = null;
    let minDistance = Infinity;

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles.length; x++) {
        const t = tiles[y][x];
        if (t.owner === 1) {
          const dist = Math.hypot(t.x - mapX, t.y - mapY);
          if (dist < minDistance) {
            minDistance = dist;
            bestSource = t;
          }
        }
      }
    }

    if (bestSource) {
      const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
      launchAttackWave(1, targetTile.owner, bestSource, targetTile, troopsToSend);
      if (currentQuest === 1) setCurrentQuest(2);
    }
  };

  // Xuất đợt tấn công OpenFront
  const launchAttackWave = (from: number, to: number, source: Tile, target: Tile, troops: number) => {
    const data = gameDataRef.current;
    const attacker = data.nations[from];
    if (attacker.troops < troops) return;

    attacker.troops -= troops;
    data.stats.battlesCount += 1;

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

    const queue: { x: number; y: number }[] = [{ x: target.x, y: target.y }];
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
      speed: 0.38,
      hasGeneral,
      targetsQueue: queue,
    });

    if (from === 1 && !hasGeneral) soundManager.playAttack();
  };

  // Giải quyết đợt tấn công
  const resolveAttackCapture = (wave: AttackWave) => {
    const data = gameDataRef.current;
    const tgt = data.tiles[wave.targetY]?.[wave.targetX];
    if (!tgt) return;

    const attacker = data.nations[wave.fromNation];
    const defender = data.nations[tgt.owner];

    let cost = tgt.terrain === 'MOUNTAIN' ? 12 : 5;
    if (tgt.building === 'FORTRESS') cost = 18;

    // Đặc tính phòng thủ của Thuộc địa Bộ Lạc (+50% tổn thất cho kẻ tấn công)
    if (defender?.colonyCategory === 'TRIBE') {
      cost = Math.round(cost * 1.5);
    }

    // Tướng phòng thủ có mặt giúp tăng 30% thủ
    if (defender?.general && defender.general.status === 'MARCHING') {
      cost = Math.round(cost * 1.3);
    }

    if (defender && defender.techLevels?.defense >= 1) {
      cost = Math.round(cost * 1.3);
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

      // Thu hoạch tài nguyên & dân số đặc thù từng loại Thuộc địa khi chiếm đóng
      if (defender && prevOwner > 0) {
        if (defender.colonyCategory === 'FOREST') {
          attacker.gold += 100;
          attacker.population += 15;
          if (wave.fromNation === 1) {
            data.particles.push({
              x: tgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: tgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#22c55e',
              size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
              type: 'FLOAT_TEXT', text: '+100 Vàng, +15 Dân (Khai thác Rừng)'
            });
          }
        } else if (defender.colonyCategory === 'TRIBE') {
          attacker.gold += 50;
          attacker.population += 10;
          if (wave.fromNation === 1) {
            data.particles.push({
              x: tgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: tgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#f59e0b',
              size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
              type: 'FLOAT_TEXT', text: '+50 Vàng, +10 Dân (Hợp nhất Bộ Lạc)'
            });
          }
        } else if (defender.colonyCategory === 'ETHNIC') {
          attacker.gold += 80;
          attacker.population += 20;
          if (wave.fromNation === 1) {
            data.particles.push({
              x: tgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: tgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#a855f7',
              size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
              type: 'FLOAT_TEXT', text: '+80 Vàng, +20 Dân (Chinh phục Sắc Tộc)'
            });
          }
        }
      }

      // Xử lý thương vong của Tướng
      if (wave.hasGeneral && attacker.general && Math.random() < 0.12) {
        attacker.general.status = 'RECOVERING';
        attacker.general.reviveTimer = 15;
        if (wave.fromNation === 1) {
          data.particles.push({
            x: tgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: tgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#ef4444',
            size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.8,
            type: 'FLOAT_TEXT', text: `⚔️ ${attacker.general.name} bị thương! (Hồi 15s)`
          });
        }
      }

      if (wave.fromNation === 1) {
        soundManager.playCapture();
        data.particles.push({
          x: tgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: tgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#38bdf8',
          size: 0,
          life: 25,
          maxLife: 25,
          vx: 0,
          vy: -0.6,
          type: 'FLOAT_TEXT',
          text: '+1 Lãnh Thổ'
        });
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
    } else if (map.size === 2) {
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

    if (map.size === 2 && lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
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
        const zoomDamping = 0.40; // Giảm 60% độ nhạy giật
        const zoomMultiplier = 1 + (deltaDist / prevDist) * zoomDamping;

        const curCam = cameraRef.current;
        const targetZoom = clampZoom(curCam.zoom * zoomMultiplier);

        // Pan theo chuyển động của trọng tâm 2 ngón tay
        const panX = currentMid.x - prevMid.x;
        const panY = currentMid.y - prevMid.y;

        // Giữ điểm giữa cố định trên bản đồ khi zoom
        const worldMidX = (currentMid.x - curCam.x) / curCam.zoom;
        const worldMidY = (currentMid.y - curCam.y) / curCam.zoom;

        const newCamX = currentMid.x - worldMidX * targetZoom + panX;
        const newCamY = currentMid.y - worldMidY * targetZoom + panY;

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

    if (map.size === 1 && pointerStartRef.current && pointerStartRef.current.id === e.pointerId) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      const duration = Date.now() - pointerStartRef.current.time;

      if (!isDraggingRef.current && dist < 12 && duration < 320) {
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

    if (map.size < 2) {
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
    if (map.size === 0) {
      pointerStartRef.current = null;
      isDraggingRef.current = false;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomAroundPoint(screenX, screenY, cameraRef.current.zoom * factor);
  };

  // Xây dựng công trình (Chỉ thực thi khi người chơi chủ động chọn và xác nhận)
  const executeBuild = (targetTile: Tile | null, buildingType: BuildingType) => {
    if (!targetTile) {
      alert("Chưa chọn ô đất để xây dựng! Hãy chạm vào một ô đất của bạn trên bản đồ.");
      return;
    }
    const data = gameDataRef.current;
    const player = data.nations[1];

    if (targetTile.owner !== 1) {
      alert("Chỉ có thể xây dựng trên ô đất thuộc chủ quyền của bạn!");
      return;
    }
    if (buildingType === 'NONE') return;

    if (targetTile.building === buildingType) {
      alert(`Ô đất này đã có công trình ${BUILDING_INFO[buildingType].name}!`);
      return;
    }
    if (buildingType === 'PORT' && !targetTile.hasHarborAccess) {
      alert("Hải Cảng chỉ có thể xây dựng ở ô đất tiếp giáp mặt biển!");
      return;
    }

    const existingCount = data.tiles.flat().filter(t => t.owner === 1 && t.building === buildingType).length;
    const baseCost = BUILDING_INFO[buildingType as Exclude<BuildingType, 'NONE'>].baseCost;
    const discount = player.techLevels.economy >= 2 ? 0.85 : 1.0;
    const cost = Math.floor(baseCost * Math.pow(1.15, existingCount) * discount);

    if (player.gold < cost) {
      alert(`Không đủ vàng để xây dựng! Cần ${cost} vàng (hiện có ${player.gold} vàng).`);
      return;
    }

    player.gold -= cost;
    targetTile.building = buildingType;
    if (buildingType === 'PORT') {
      player.hasPort = true;
    }
    data.stats.buildingsCount += 1;
    soundManager.playBuild();
    setIsBuildOpen(false);
    offscreenTerritoryDirtyRef.current = true;
    setSelectedTile({ ...targetTile });
    selectedTileRef.current = { ...targetTile };
    offscreenTerritoryDirtyRef.current = true;

    data.particles.push({
      x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      color: '#fbbf24',
      size: 0,
      life: 30,
      maxLife: 30,
      vx: 0,
      vy: -0.6,
      type: 'FLOAT_TEXT',
      text: `+${BUILDING_INFO[buildingType as Exclude<BuildingType, 'NONE'>].name}`
    });

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

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Độ khó thử thách:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'NORMAL', 'HARD'] as GameDifficulty[]).map(diff => (
                    <button
                      key={diff}
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
            </div>

            <button
              onClick={() => startNewGame(difficulty, mapSize, playerName)}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-base min-h-[48px]"
            >
              <Play className="w-5 h-5 fill-current" />
              Khởi Đầu Chinh Phục
            </button>
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
            </div>

            {/* CỤM ĐIỀU KHIỂN CỐ ĐỊNH GÓC PHẢI - LUÔN HIỂN THỊ, KHÔNG BỊ TRÀN HAY CHE KHUẤT */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1.5">
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
                  setIsPaused(prev => !prev);
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

          {/* THANH NHIỆM VỤ */}
          {!questDismissed && currentQuest <= 5 && (
            <div className="absolute top-12 left-2 right-2 sm:left-3 sm:right-3 z-30 flex items-center justify-between px-3.5 py-2 bg-blue-950/90 border border-blue-500/40 rounded-2xl shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-blue-100 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                <span className="truncate">
                  <strong>Nhiệm vụ {currentQuest}/5:</strong>{' '}
                  {currentQuest === 1 && 'Mở rộng quy mô lên 15 ô đất.'}
                  {currentQuest === 2 && 'Mở rộng lãnh thổ đạt 25 ô đất.'}
                  {currentQuest === 3 && 'Xây dựng một Thành Thị để phát triển kinh tế.'}
                  {currentQuest === 4 && 'Vào Viện Hàn Lâm nghiên cứu công nghệ đầu tiên.'}
                  {currentQuest === 5 && 'Thu phục thuộc địa và mở rộng tầm ảnh hưởng trên Trái Đất.'}
                </span>
              </div>
              <button
                onClick={() => setQuestDismissed(true)}
                className="text-[11px] text-blue-300 hover:text-white underline shrink-0 ml-2"
              >
                Bỏ qua
              </button>
            </div>
          )}

          {/* SỰ KIỆN & MINIMAP */}
          <div className="absolute top-24 left-2.5 z-20 pointer-events-auto">
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

            {/* THẺ THÔNG TIN LÃNH THỔ CỐ ĐỊNH PHÍA DƯỚI (TÁCH BIỆT HOÀN TOÀN XEM VÀ XÂY DỰNG) */}
            {selectedTile && (
              <div 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md z-30 animate-in fade-in slide-in-from-bottom duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-white flex items-center gap-1 truncate">
                      {selectedTile.owner === 1 ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {selectedTile.owner === 1 
                          ? `${playerName} (Lãnh thổ của bạn)` 
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
                    className="p-1 text-slate-400 hover:text-white rounded-lg active:bg-slate-800 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="py-2 text-[11px] text-slate-300 flex items-center justify-between">
                  <span>
                    Tọa độ: <strong className="text-white font-mono">({selectedTile.x}, {selectedTile.y})</strong>
                  </span>
                  <span>
                    Địa hình: <strong className="text-white">{selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng rậm' : 'Núi đá'}</strong>
                    {selectedTile.hasHarborAccess && <span className="text-cyan-400 ml-1 font-semibold">(Giáp biển)</span>}
                  </span>
                </div>

                {/* THAO TÁC THEO CHỦ QUYỀN */}
                {selectedTile.owner === 1 ? (
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
                    <div className="text-[11px]">
                      <span className="text-slate-400">Công trình: </span>
                      <strong className="text-amber-400">
                        {selectedTile.building !== 'NONE' ? BUILDING_INFO[selectedTile.building].name : 'Chưa có'}
                      </strong>
                    </div>

                    {/* NÚT CHỦ ĐỘNG MỞ MODAL XÂY DỰNG */}
                    <button
                      onClick={() => setIsBuildOpen(true)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{selectedTile.building !== 'NONE' ? 'Đổi Công Trình' : 'Chọn Công Trình Xây'}</span>
                    </button>
                  </div>
                ) : (
                  (() => {
                    const ownerNation = gameDataRef.current.nations[selectedTile.owner];
                    const isTribe = ownerNation && ownerNation.colonyCategory === 'TRIBE';
                    const neighborTiles = [
                      [selectedTile.x + 1, selectedTile.y], [selectedTile.x - 1, selectedTile.y], 
                      [selectedTile.x, selectedTile.y + 1], [selectedTile.x, selectedTile.y - 1]
                    ];
                    const isAdjacent = neighborTiles.some(([nx, ny]) => gameDataRef.current.tiles[ny]?.[nx]?.owner === 1);

                    if (isTribe && isAdjacent) {
                      return (
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-amber-300">Bộ lạc lân cận</span>
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
                                gameDataRef.current.particles.push({
                                  x: selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                  y: selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                  color: '#f59e0b', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.6,
                                  type: 'FLOAT_TEXT', text: '⛺ Thu Phục Bộ Lạc (+10 Dân)'
                                });
                              } else {
                                alert("Cần 80 vàng để thu phục bộ lạc này!");
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                          >
                            <span>⛺ Thu Phục (80 Vàng)</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80 flex items-center justify-between">
                        <span>Dân số: <strong className="text-slate-200">{formatPopulation(ownerNation?.population || 0)}</strong></span>
                        <span className="text-[10px] text-amber-400/90 font-medium">Chạm lại ô để xuất quân đánh</span>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* CỤM NÚT ĐIỀU KHIỂN NỔI GÓC PHẢI: VỀ VƯƠNG QUỐC & THU PHÓNG */}
            <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-1.5 z-20">
              <button
                onClick={focusOnPlayerKingdom}
                title="Về vương quốc của tôi"
                className="px-2 py-1.5 bg-slate-900/95 hover:bg-slate-800 text-amber-400 active:scale-95 rounded-xl border border-amber-500/40 shadow-xl flex flex-col items-center gap-0.5 min-w-[42px] transition-all"
              >
                <Castle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[9px] font-bold text-amber-300">Vương Quốc</span>
              </button>

              <button
                onClick={() => {
                  const vpW = viewportSizeRef.current.width || 360;
                  const vpH = viewportSizeRef.current.height || 560;
                  zoomAroundPoint(vpW / 2, vpH / 2, cameraRef.current.zoom * 1.20);
                }}
                title="Phóng to"
                className="p-2 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-lg hover:bg-slate-800 text-slate-200 active:scale-95 min-w-[38px] min-h-[38px] flex items-center justify-center"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const vpW = viewportSizeRef.current.width || 360;
                  const vpH = viewportSizeRef.current.height || 560;
                  zoomAroundPoint(vpW / 2, vpH / 2, cameraRef.current.zoom / 1.20);
                }}
                title="Thu nhỏ"
                className="p-2 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-lg hover:bg-slate-800 text-slate-200 active:scale-95 min-w-[38px] min-h-[38px] flex items-center justify-center"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>
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

        return (
          <BuildModal
            isOpen={isBuildOpen}
            onClose={() => setIsBuildOpen(false)}
            selectedTile={activeBuildTarget}
            playerNation={player || {}}
            existingBuildingCounts={{
              NONE: 0,
              CITY: gameDataRef.current.tiles.flat().filter(t => t.owner === 1 && t.building === 'CITY').length,
              BARRACKS: gameDataRef.current.tiles.flat().filter(t => t.owner === 1 && t.building === 'BARRACKS').length,
              FORTRESS: gameDataRef.current.tiles.flat().filter(t => t.owner === 1 && t.building === 'FORTRESS').length,
              PORT: gameDataRef.current.tiles.flat().filter(t => t.owner === 1 && t.building === 'PORT').length,
            }}
            onBuild={(type) => executeBuild(activeBuildTarget, type)}
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
        totalLandCount={gameDataRef.current.tiles.flat().filter(t => t.terrain !== 'WATER').length}
        onFocusNation={focusOnNation}
        onProposeTruce={(id) => {
          const player = gameDataRef.current.nations[1];
          player.diplomacy[id] = { status: 'TRUCE', relation: 20, truceTimer: 45 };
          soundManager.playTruce();
          alert("Đã ký hiệp ước đình chiến thành công!");
        }}
        onProposeAlliance={(id) => {
          const player = gameDataRef.current.nations[1];
          player.diplomacy[id] = { status: 'ALLIANCE', relation: 60, truceTimer: 60 };
          soundManager.playCapture();
          alert("Đã thiết lập liên minh hỗ trợ!");
        }}
        onDeclareWar={(id) => {
          const player = gameDataRef.current.nations[1];
          player.diplomacy[id] = { status: 'WAR', relation: -50, truceTimer: 0 };
          soundManager.playAttack();
          alert("Đã tuyên chiến!");
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
        onTogglePause={() => setIsPaused(prev => !prev)}
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
          setGameState('TITLE');
          soundManager.playClick();
        }}
      />

      {/* MÀN HÌNH KẾT THÚC */}
      {gameState === 'VICTORY' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
            <Award className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
            <h2 className="text-2xl font-black text-white mb-2">ĐẠI THỐNG NHẤT!</h2>
            <p className="text-xs text-slate-300 mb-6">Bạn đã chinh phục thành công {hudStats.landPercent}% bản đồ thế giới.</p>
            <button
              onClick={() => startNewGame(difficulty, mapSize, playerName)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg text-sm min-h-[48px]"
            >
              Chơi Ván Mới
            </button>
          </div>
        </div>
      )}

      {gameState === 'DEFEAT' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-3 animate-pulse" />
            <h2 className="text-2xl font-black text-white mb-2">ĐẾ CHẾ SỤP ĐỔ!</h2>
            <p className="text-xs text-slate-300 mb-6">Lãnh thổ của bạn đã hoàn toàn thất thủ.</p>
            <button
              onClick={() => startNewGame(difficulty, mapSize, playerName)}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg text-sm min-h-[48px]"
            >
              Thử Lại Ngay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
