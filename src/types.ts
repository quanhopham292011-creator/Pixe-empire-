/**
 * Định nghĩa kiểu dữ liệu cho game Pixel Empire
 */

export type TerrainType = 'LAND' | 'WATER' | 'MOUNTAIN' | 'FOREST';
export type BuildingType = 'NONE' | 'CITY' | 'BARRACKS' | 'FORTRESS' | 'PORT';

export type NationPersonality = 'AGGRESSIVE' | 'DEFENSIVE' | 'MERCHANT' | 'OPPORTUNIST';
export type DiplomacyStatus = 'WAR' | 'TRUCE' | 'ALLIANCE';

export type TechBranch = 'ECONOMY' | 'MILITARY' | 'DEFENSE';

export interface TechNode {
  id: string;
  branch: TechBranch;
  level: number;
  name: string;
  description: string;
  cost: number;
  researchTime: number;
}

export interface ResearchingTech {
  techId: string;
  remainingTime: number;
  totalTime: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  owner: number; // 0: Trung lập, 1: Người chơi, 2-6: Bot
  building: BuildingType;
  defenseBonus: number;
  isBorder: boolean;
  hasHarborAccess: boolean;
}

export type SettlementTier = 'TIER_1_FOREST' | 'TIER_2_TRIBE' | 'TIER_3_ETHNIC' | 'PLAYER' | 'BOSS';
export type ColonyCategory = 'FOREST' | 'TRIBE' | 'ETHNIC';
export type GeneralStatus = 'IDLE' | 'MARCHING' | 'INJURED' | 'RECOVERING' | 'FALLEN';

export interface General {
  id: string;
  nationId: number;
  name: string;
  status: GeneralStatus;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  combatPowerBonus: number; // 0.30 -> chiếm 30% sức mạnh quân đội / +30% hiệu suất
  reviveTimer: number;
  isDeployedToFront: boolean;
}

export interface Nation {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  tier?: SettlementTier;
  colonyCategory?: ColonyCategory;
  colonyEvolveTimer?: number; // Dành cho Dân tộc tiến hóa thành Quốc gia
  personality: NationPersonality;
  gold: number;
  goldIncome: number;
  troops: number;
  maxTroops: number;
  population: number; // Dân số quốc gia (mô phỏng dữ liệu nền)
  territoryCount: number;
  isEliminated: boolean;
  capitalX: number;
  capitalY: number;
  hasPort: boolean;
  general?: General; // Mỗi quốc gia có 1 tướng đại diện
  techLevels: {
    economy: number;
    military: number;
    defense: number;
  };
  diplomacy: {
    [targetId: number]: {
      status: DiplomacyStatus;
      relation: number;
      truceTimer: number;
    };
  };
}

export interface AttackWave {
  id: string;
  fromNation: number;
  toNation: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  troops: number;
  progress: number;
  speed: number;
  hasGeneral?: boolean; // Tướng dẫn dắt đợt tiến công (+30% sức mạnh)
  targetsQueue?: { x: number; y: number }[]; // Danh sách ô sẽ tràn qua
}

export interface GameParticle {
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  type: 'SPARK' | 'DUST' | 'AURA' | 'FLOAT_TEXT';
  text?: string;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'HARVEST' | 'CROP_FAILURE' | 'PLAGUE' | 'REBELLION' | 'DIPLOMACY';
  targetNationId: number;
  timestamp: string;
}

export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';
export type MapDimension = 64 | 96 | 128;

export type QuestStep = 1 | 2 | 3 | 4 | 5 | 6;

export type WeatherType = 'CLEAR' | 'CLOUDY' | 'RAIN';

export interface WeatherCloudPuff {
  dx: number;
  dy: number;
  w: number;
  h: number;
  alpha: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  opacity: number;
  type: 'CLOUD' | 'RAIN_DROP';
  puffs?: WeatherCloudPuff[];
}
