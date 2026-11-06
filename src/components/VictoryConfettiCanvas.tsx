import React, { useEffect, useRef } from 'react';

// Hiệu ứng pháo hoa mừng chiến thắng (Victory Confetti Overlay Particle System)
export const VictoryConfettiCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const colors = ['#fbbf24', '#38bdf8', '#f43f5e', '#10b981', '#a855f7', '#f97316', '#ffffff', '#e0e7ff'];

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const count = 130;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      w: Math.random() * 8 + 6,
      h: Math.random() * 12 + 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3.5 + 2,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.1,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.05 + 0.02,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.sway += p.swaySpeed;
        p.x += p.vx + Math.sin(p.sway) * 1.5;
        p.y += p.vy;
        p.angle += p.vAngle;

        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />;
};
