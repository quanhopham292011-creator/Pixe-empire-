import React, { useRef, useEffect } from 'react';
import { Tile, Nation } from '../types';

interface MinimapProps {
  tiles: Tile[][];
  nations: Nation[];
  mapSize: number;
  camera: { x: number; y: number; zoom: number };
  onNavigate: (mapX: number, mapY: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  tiles,
  nations,
  mapSize,
  camera,
  onNavigate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tiles || tiles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const tileSize = size / mapSize;

    ctx.clearRect(0, 0, size, size);

    // 1. Vẽ địa hình & lãnh thổ
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        const t = tiles[y]?.[x];
        if (!t) continue;

        if (t.terrain === 'WATER') {
          ctx.fillStyle = '#1e3a8a';
        } else if (t.owner > 0) {
          const nat = nations.find(n => n.id === t.owner);
          ctx.fillStyle = nat?.color || '#cbd5e1';
        } else if (t.terrain === 'MOUNTAIN') {
          ctx.fillStyle = '#475569';
        } else if (t.terrain === 'FOREST') {
          ctx.fillStyle = '#14532d';
        } else {
          ctx.fillStyle = '#64748b';
        }

        ctx.fillRect(x * tileSize, y * tileSize, Math.ceil(tileSize), Math.ceil(tileSize));
      }
    }

    // 2. Điểm sáng Thủ đô của Người chơi & Boss
    nations.forEach(nation => {
      if (nation.id === 0 || nation.isEliminated) return;
      const isMajor = nation.isPlayer || nation.tier === 'BOSS';
      if (isMajor) {
        const cx = nation.capitalX * tileSize;
        const cy = nation.capitalY * tileSize;
        ctx.fillStyle = nation.isPlayer ? '#38bdf8' : '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, nation.isPlayer ? 2.5 : 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3. Khung nhìn Camera thực tế (Viewport Box)
    const TILE_PIXEL_SIZE = 24;
    const vpW = window.innerWidth || 360;
    const vpH = window.innerHeight || 560;

    const leftWorld = (-camera.x) / (TILE_PIXEL_SIZE * camera.zoom);
    const topWorld = (-camera.y) / (TILE_PIXEL_SIZE * camera.zoom);
    const widthWorld = vpW / (TILE_PIXEL_SIZE * camera.zoom);
    const heightWorld = vpH / (TILE_PIXEL_SIZE * camera.zoom);

    const boxX = Math.max(0, Math.min(size, leftWorld * tileSize));
    const boxY = Math.max(0, Math.min(size, topWorld * tileSize));
    const boxW = Math.max(4, Math.min(size - boxX, widthWorld * tileSize));
    const boxH = Math.max(4, Math.min(size - boxY, heightWorld * tileSize));

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

  }, [tiles, nations, mapSize, camera]);

  const handleInteract = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const mapX = Math.max(0, Math.min(mapSize - 1, Math.floor((clickX / rect.width) * mapSize)));
    const mapY = Math.max(0, Math.min(mapSize - 1, Math.floor((clickY / rect.height) * mapSize)));
    onNavigate(mapX, mapY);
  };

  return (
    <div className="relative border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/90 backdrop-blur-md">
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        onClick={(e) => handleInteract(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            handleInteract(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        className="w-20 h-20 sm:w-24 sm:h-24 cursor-pointer block image-rendering-pixelated touch-none"
      />
    </div>
  );
};
