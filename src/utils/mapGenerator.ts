/**
 * Bộ sinh bản đồ Trái Đất (Earth Map) & khởi tạo Quốc gia / Thuộc địa cho Pixel Empire
 */

import { Tile, TerrainType, MapDimension, Nation, NationPersonality, GameDifficulty, SettlementTier } from '../types';
import { REAL_NATION_NAMES } from './constants';

function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const v00 = pseudoNoise(x0, y0, seed);
  const v10 = pseudoNoise(x0 + 1, y0, seed);
  const v01 = pseudoNoise(x0, y0 + 1, seed);
  const v11 = pseudoNoise(x0 + 1, y0 + 1, seed);

  const i1 = v00 * (1 - fx) + v10 * fx;
  const i2 = v01 * (1 - fx) + v11 * fx;
  return i1 * (1 - fy) + i2 * fy;
}

/**
 * Kiểm tra điểm (normX, normY) trong khoảng [0,1] thuộc lục địa Trái Đất nào:
 * 1. Châu Mỹ (Americas): normX [0.10 - 0.32], normY [0.12 - 0.82]
 * 2. Châu Âu (Europe): normX [0.42 - 0.58], normY [0.12 - 0.35]
 * 3. Châu Phi (Africa): normX [0.42 - 0.58], normY [0.36 - 0.75]
 * 4. Châu Á (Asia): normX [0.58 - 0.86], normY [0.12 - 0.62]
 * 5. Châu Đại Dương / Úc (Oceania): normX [0.72 - 0.90], normY [0.62 - 0.85]
 */
function getEarthContinentDensity(normX: number, normY: number): number {
  // 1. Châu Mỹ (Bắc & Nam Mỹ)
  if (normX >= 0.10 && normX <= 0.32 && normY >= 0.12 && normY <= 0.82) {
    const isNorth = normY <= 0.45;
    const isSouth = normY >= 0.48;
    const isCentral = normY > 0.42 && normY < 0.50 && normX >= 0.20 && normX <= 0.28;
    if (isNorth || isSouth || isCentral) return 0.65;
  }

  // 2. Châu Âu
  if (normX >= 0.42 && normX <= 0.58 && normY >= 0.12 && normY <= 0.35) {
    return 0.70;
  }

  // 3. Châu Phi
  if (normX >= 0.42 && normX <= 0.58 && normY >= 0.36 && normY <= 0.75) {
    return 0.72;
  }

  // 4. Châu Á (bao gồm Đông Nam Á)
  if (normX >= 0.58 && normX <= 0.88 && normY >= 0.12 && normY <= 0.62) {
    return 0.75;
  }

  // 5. Châu Đại Dương / Úc
  if (normX >= 0.72 && normX <= 0.90 && normY >= 0.62 && normY <= 0.85) {
    return 0.68;
  }

  return 0.05; // Đại dương mở
}

/**
 * Sinh bản đồ Trái Đất mặc định
 */
export function generateWorldMap(
  size: MapDimension = 96, 
  difficulty: GameDifficulty = 'EASY',
  customPlayerName: string = 'Việt Nam',
  seed: number = Math.random() * 1000
): {
  tiles: Tile[][];
  nations: Nation[];
} {
  const tiles: Tile[][] = [];

  for (let y = 0; y < size; y++) {
    tiles[y] = [];
    const normY = y / size;
    for (let x = 0; x < size; x++) {
      const normX = x / size;

      // Mật độ lục địa Trái Đất tại vị trí
      const continentMask = getEarthContinentDensity(normX, normY);

      // Noise địa hình
      const n1 = smoothNoise(x, y, seed, size * 0.30);
      const n2 = smoothNoise(x, y, seed + 20, size * 0.12) * 0.4;
      const n3 = smoothNoise(x, y, seed + 40, size * 0.05) * 0.2;
      const height = (n1 + n2 + n3) / 1.6 + continentMask - 0.42;

      let terrain: TerrainType = 'WATER';
      if (height > 0.50) {
        terrain = 'MOUNTAIN';
      } else if (height > 0.38) {
        terrain = 'FOREST';
      } else if (height > 0.12) {
        terrain = 'LAND';
      } else {
        terrain = 'WATER';
      }

      tiles[y][x] = {
        x,
        y,
        terrain,
        owner: 0,
        building: 'NONE',
        defenseBonus: terrain === 'MOUNTAIN' ? 2.0 : terrain === 'FOREST' ? 1.3 : 1.0,
        isBorder: false,
        hasHarborAccess: false,
      };
    }
  }

  // Mật độ quốc gia và thuộc địa theo kích thước bản đồ
  const minorCount = size === 64 ? 14 : size === 96 ? 24 : 36;
  const totalNations = 2 + minorCount; // 1 Player, 1 Boss AI, minorCount Thuộc địa

  // Bảng màu rực rỡ cho Quốc gia / Tông màu xám trầm cho Thuộc địa
  const nationColors = [
    "#64748b", // 0: Neutral
    "#2563eb", // 1: Player (Xanh dương rực rỡ)
    "#dc2626", // 2: Boss AI (Đỏ chói rực rỡ)
    "#71717a", "#a1a1aa", "#78716c", "#a8a29e", "#64748b", // Muted tones cho Thuộc địa
    "#059669", "#7c3aed", "#d97706", "#0284c7", "#ca8a04", "#0d9488", "#e11d48", "#84cc16"
  ];

  const shuffledNames = [...REAL_NATION_NAMES];
  for (let i = shuffledNames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
  }

  const spawnLocations: { x: number; y: number }[] = [];

  // 1. VỊ TRÍ XUẤT PHÁT MẶC ĐỊNH CỦA NGƯỜI CHƠI: Đông Nam Á / Việt Nam (normX ~0.72, normY ~0.54)
  const vnTargetX = Math.floor(size * 0.72);
  const vnTargetY = Math.floor(size * 0.54);
  let playerSpawn = { x: vnTargetX, y: vnTargetY };

  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const px = playerSpawn.x + dx;
      const py = playerSpawn.y + dy;
      if (px >= 0 && px < size && py >= 0 && py < size) {
        if (tiles[py][px].terrain === 'WATER') tiles[py][px].terrain = 'LAND';
      }
    }
  }
  spawnLocations.push(playerSpawn); // Index 0 -> Player (ID 1)

  // 2. VỊ TRÍ BOSS AI: Châu Âu / Bắc Mỹ (normX ~0.48, normY ~0.25)
  const bossTargetX = Math.floor(size * 0.48);
  const bossTargetY = Math.floor(size * 0.25);
  let bossSpawn = { x: bossTargetX, y: bossTargetY };

  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const px = bossSpawn.x + dx;
      const py = bossSpawn.y + dy;
      if (px >= 0 && px < size && py >= 0 && py < size) {
        if (tiles[py][px].terrain === 'WATER') tiles[py][px].terrain = 'LAND';
      }
    }
  }
  spawnLocations.push(bossSpawn); // Index 1 -> Boss AI (ID 2)

  // 3. VỊ TRÍ PHÂN BỐ TỰ NHIÊN CỦA 3 LOẠI THUỘC ĐỊA (Rừng, Bộ lạc, Dân tộc)
  const colonyRegionCoords = [
    { x: 0.50, y: 0.55 }, // Châu Phi Trung
    { x: 0.20, y: 0.30 }, // Bắc Mỹ
    { x: 0.24, y: 0.65 }, // Nam Mỹ
    { x: 0.82, y: 0.72 }, // Úc / Châu Đại Dương
    { x: 0.75, y: 0.25 }, // Bắc Á / Siberia
    { x: 0.62, y: 0.38 }, // Trung Á
    { x: 0.48, y: 0.68 }, // Nam Phi
    { x: 0.16, y: 0.45 }, // Trung Mỹ
    { x: 0.85, y: 0.42 }, // Đông Á
    { x: 0.30, y: 0.75 }, // Nam Mỹ Nam
    { x: 0.45, y: 0.20 }, // Bắc Âu
    { x: 0.65, y: 0.50 }, // Ấn Độ / Nam Á
    { x: 0.55, y: 0.40 }, // Trung Đông
    { x: 0.78, y: 0.60 }, // Indonesia / Quần đảo
    { x: 0.15, y: 0.22 }, // Canada Tây
    { x: 0.28, y: 0.35 }, // Mỹ Đông
    { x: 0.52, y: 0.45 }, // Bắc Phi
    { x: 0.70, y: 0.30 }, // Mông Cổ
  ];

  for (let i = 0; i < minorCount; i++) {
    const reg = colonyRegionCoords[i % colonyRegionCoords.length];
    let cx = Math.floor(size * reg.x + (Math.random() * 10 - 5));
    let cy = Math.floor(size * reg.y + (Math.random() * 10 - 5));
    cx = Math.max(4, Math.min(size - 5, cx));
    cy = Math.max(4, Math.min(size - 5, cy));

    // Đảm bảo khoảng cách tối thiểu giữa các điểm xuất phát
    const tooClose = spawnLocations.some(loc => Math.hypot(loc.x - cx, loc.y - cy) < 3.5);
    if (tooClose) {
      cx = Math.max(4, Math.min(size - 5, cx + Math.floor(Math.random() * 6 - 3)));
      cy = Math.max(4, Math.min(size - 5, cy + Math.floor(Math.random() * 6 - 3)));
    }

    if (tiles[cy][cx].terrain === 'WATER') {
      tiles[cy][cx].terrain = 'LAND';
    }
    spawnLocations.push({ x: cx, y: cy });
  }

  // Cập nhật giáp biển
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (tiles[y][x].terrain !== 'WATER') {
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        tiles[y][x].hasHarborAccess = neighbors.some(([nx, ny]) => 
          nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain === 'WATER'
        );
      }
    }
  }

  // Khởi tạo danh sách Quốc gia & Thuộc địa
  const nations: Nation[] = [];

  // Nation 0: Trung lập
  nations.push({
    id: 0,
    name: "Vùng Tự Do",
    color: "#64748b",
    isPlayer: false,
    personality: 'DEFENSIVE',
    gold: 0,
    goldIncome: 0,
    troops: 0,
    maxTroops: 0,
    population: 0,
    territoryCount: 0,
    isEliminated: false,
    capitalX: 0,
    capitalY: 0,
    hasPort: false,
    techLevels: { economy: 0, military: 0, defense: 0 },
    diplomacy: {}
  });

  const personalities: NationPersonality[] = ['DEFENSIVE', 'AGGRESSIVE', 'MERCHANT', 'OPPORTUNIST'];

  for (let i = 1; i <= totalNations; i++) {
    const isPlayer = i === 1;
    const isBoss = i === 2;
    const spawn = spawnLocations[i - 1] || { x: Math.floor(size / 2), y: Math.floor(size / 2) };

    const defaultDiplomacy: Nation['diplomacy'] = {};
    for (let j = 1; j <= totalNations; j++) {
      if (j !== i) {
        defaultDiplomacy[j] = { status: 'WAR', relation: 0, truceTimer: 0 };
      }
    }

    let tier: SettlementTier = 'TIER_1_FOREST';
    let colonyCategory: 'FOREST' | 'TRIBE' | 'ETHNIC' | undefined = undefined;
    let initPop = 3;
    let initTroops = 6;
    let initGold = 50;
    let initLandRadius = 1.4;

    if (isPlayer) {
      tier = 'PLAYER';
      initPop = 10;
      initTroops = 20;
      initGold = 120;
      initLandRadius = 2.2;
    } else if (isBoss) {
      tier = 'BOSS';
      initPop = 30;
      initTroops = 50;
      initGold = 300;
      initLandRadius = 3.2;
    } else {
      const randTier = Math.random();
      if (randTier < 0.40) {
        tier = 'TIER_1_FOREST';
        colonyCategory = 'FOREST';
        initPop = 3;
        initTroops = 6;
        initGold = 40;
        initLandRadius = 1.2;
      } else if (randTier < 0.75) {
        tier = 'TIER_2_TRIBE';
        colonyCategory = 'TRIBE';
        initPop = 6;
        initTroops = 14;
        initGold = 70;
        initLandRadius = 1.8;
      } else {
        tier = 'TIER_3_ETHNIC';
        colonyCategory = 'ETHNIC';
        initPop = 12;
        initTroops = 24;
        initGold = 120;
        initLandRadius = 2.4;
      }
    }

    let nationName = "";
    let generalName = "";

    if (isPlayer) {
      const cleanName = (customPlayerName && customPlayerName.trim()) ? customPlayerName.trim() : 'Việt Nam';
      nationName = `${cleanName} (Bạn)`;
      generalName = `Tướng Trần Hưng Đạo`;
    } else if (isBoss) {
      nationName = `Đế Quốc ${shuffledNames[0]} (Boss)`;
      generalName = `Thống Chế Alexander`;
    } else {
      if (colonyCategory === 'FOREST') {
        nationName = `${shuffledNames[i]} [Rừng]`;
        generalName = `Vệ Binh Rừng ${shuffledNames[i]}`;
      } else if (colonyCategory === 'TRIBE') {
        nationName = `${shuffledNames[i]} [Bộ Lạc]`;
        generalName = `Tù Trưởng ${shuffledNames[i]}`;
      } else {
        nationName = `${shuffledNames[i]} [Dân Tộc]`;
        generalName = `Chủ Tướng ${shuffledNames[i]}`;
      }
    }

    const nColor = nationColors[i] || nationColors[i % nationColors.length];

    // Tạo Tướng đại diện duy nhất cho quốc gia (chiếm 30% sức mạnh)
    const generalObj = {
      id: `gen_${i}`,
      nationId: i,
      name: generalName,
      status: 'IDLE' as const, // Ban đầu nhàn rỗi ở thủ đô
      x: spawn.x,
      y: spawn.y,
      combatPowerBonus: 0.30, // 30% bonus
      reviveTimer: 0,
      isDeployedToFront: false,
    };

    nations.push({
      id: i,
      name: nationName,
      color: nColor,
      isPlayer,
      tier,
      colonyCategory,
      colonyEvolveTimer: colonyCategory === 'ETHNIC' ? 60 : undefined, // 60s để Dân tộc tiến hóa thành Quốc gia
      personality: isPlayer ? 'DEFENSIVE' : isBoss ? 'AGGRESSIVE' : colonyCategory === 'FOREST' ? 'DEFENSIVE' : colonyCategory === 'TRIBE' ? 'DEFENSIVE' : personalities[(i - 1) % personalities.length],
      gold: initGold,
      goldIncome: Math.max(2, Math.floor(initPop * 0.4)),
      troops: initTroops,
      maxTroops: Math.max(15, initPop * 3),
      population: initPop,
      territoryCount: 0,
      isEliminated: false,
      capitalX: spawn.x,
      capitalY: spawn.y,
      hasPort: false,
      general: generalObj,
      techLevels: { economy: 0, military: 0, defense: 0 },
      diplomacy: defaultDiplomacy
    });

    // Tạo lãnh thổ ban đầu
    const cx = spawn.x;
    const cy = spawn.y;
    tiles[cy][cx].owner = i;
    tiles[cy][cx].building = 'CITY';

    for (let dy = -Math.ceil(initLandRadius); dy <= Math.ceil(initLandRadius); dy++) {
      for (let dx = -Math.ceil(initLandRadius); dx <= Math.ceil(initLandRadius); dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          const t = tiles[ny][nx];
          if (t.terrain !== 'WATER' && Math.hypot(dx, dy) <= initLandRadius) {
            t.owner = i;
          }
        }
      }
    }
  }

  return { tiles, nations };
}
