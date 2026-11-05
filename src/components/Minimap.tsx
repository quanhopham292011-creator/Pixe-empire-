import React, { useRef, useEffect } from 'react';
import { Tile, Nation, DarkTitan } from '../types';

interface MinimapProps {
  tiles: Tile[][];
  nations: Nation[];
  mapSize: number;
  camera: { x: number; y: number; zoom: number };
  onNavigate: (mapX: number, mapY: number) => void;
  darkTitan?: DarkTitan | null;
  darkTitans?: DarkTitan[];
}

export const Minimap: React.FC<MinimapProps> = ({
  tiles,
  nations,
  mapSize,
  camera,
  onNavigate,
  darkTitan,
  darkTitans,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Offscreen Cache: Chỉ vẽ lại toàn bộ lưới ô vuông khi tiles hoặc nations thay đổi
  useEffect(() => {
    if (!tiles || tiles.length === 0) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = 100;
      offscreenCanvasRef.current.height = 100;
    }

    const offCanvas = offscreenCanvasRef.current;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const size = offCanvas.width;
    const tileSize = size / mapSize;

    offCtx.clearRect(0, 0, size, size);

    // Vẽ địa hình & lãnh thổ vào offscreen cache
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        const t = tiles[y]?.[x];
        if (!t) continue;

        if (t.terrain === 'WATER') {
          offCtx.fillStyle = '#1e3a8a';
        } else if (t.owner > 0) {
          const nat = nations.find(n => n.id === t.owner);
          offCtx.fillStyle = nat?.color || '#cbd5e1';
        } else if (t.terrain === 'MOUNTAIN') {
          offCtx.fillStyle = '#475569';
        } else if (t.terrain === 'FOREST') {
          offCtx.fillStyle = '#14532d';
        } else {
          offCtx.fillStyle = '#64748b';
        }

        offCtx.fillRect(x * tileSize, y * tileSize, Math.ceil(tileSize), Math.ceil(tileSize));
      }
    }
  }, [tiles, nations, mapSize]);

  // 2. Main Render: Vẽ cache lên canvas chính và render Viewport Box, Boss & Đồng minh nhanh gọn (60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const tileSize = size / mapSize;

    ctx.clearRect(0, 0, size, size);

    // Vẽ nền địa hình từ offscreen cache
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }

    // Điểm sáng Thủ đô của Người chơi, Đồng minh & Boss
    const playerNation = nations.find(n => n.isPlayer);
    nations.forEach(nation => {
      if (nation.id === 0 || nation.isEliminated) return;
      const isPlayer = nation.isPlayer;
      const isBoss = nation.tier === 'BOSS';
      const isAlly = playerNation?.diplomacy[nation.id]?.status === 'ALLIANCE';

      if (isPlayer || isBoss || isAlly) {
        const cx = nation.capitalX * tileSize;
        const cy = nation.capitalY * tileSize;
        
        ctx.fillStyle = isPlayer ? '#38bdf8' : isAlly ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, isPlayer ? 2.5 : isAlly ? 2.2 : 2.0, 0, Math.PI * 2);
        ctx.fill();

        // Vòng phát sáng cho đồng minh và người chơi
        if (isAlly || isPlayer) {
          ctx.strokeStyle = isPlayer ? 'rgba(56, 189, 248, 0.6)' : 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

    // Điểm đánh dấu Tà Thần Cổ Đại (Pulsing Dark Crimson Beacon cho tất cả Tà Thần)
    const activeTitans = darkTitans && darkTitans.length > 0
      ? darkTitans.filter(t => t.isActive)
      : (darkTitan && darkTitan.isActive ? [darkTitan] : []);

    activeTitans.forEach(titan => {
      const dtx = titan.x * tileSize + tileSize / 2;
      const dty = titan.y * tileSize + tileSize / 2;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(dtx, dty, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Khung nhìn Camera thực tế (Viewport Box)
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

  }, [camera, darkTitan, darkTitans, nations, mapSize]);

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
