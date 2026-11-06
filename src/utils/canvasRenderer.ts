import { Tile, Nation } from '../types';
import { TILE_PIXEL_SIZE } from './constants';

// Buffer 1: Render Địa Hình Tĩnh Tối Ưu Đồ Họa Pixel (Biển, Bọt Sóng, Núi Tuyết, Tán Rừng)
export function drawTerrainBuffer(offCanvas: HTMLCanvasElement, tiles: Tile[][], size: number) {
  offCanvas.width = size * TILE_PIXEL_SIZE;
  offCanvas.height = size * TILE_PIXEL_SIZE;
  const ctx = offCanvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;

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
}

// Buffer 2: Render Đồ Họa Chuẩn OpenFront (Đường viền Neon chói & Nét căng)
export function drawTerritoryBuffer(offCanvas: HTMLCanvasElement, tiles: Tile[][], nations: Nation[], size: number) {
  offCanvas.width = size * TILE_PIXEL_SIZE;
  offCanvas.height = size * TILE_PIXEL_SIZE;
  const ctx = offCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);
  ctx.imageSmoothingEnabled = false;

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
}
