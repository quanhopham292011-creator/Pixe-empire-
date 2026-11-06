import { MapDimension, WeatherType, WeatherParticle, WeatherCloudPuff } from '../types';
import { TILE_PIXEL_SIZE } from './constants';

// Khởi tạo các hạt thời tiết (Mây trôi bồng bềnh, Mưa lất phất)
export function generateWeatherParticles(dimension: MapDimension, type: WeatherType): WeatherParticle[] {
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

  return particles;
}
