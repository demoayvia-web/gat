import React, { useEffect, useRef } from 'react';
import { HudSnapshot } from '../game/types';
import { ROAD_CENTERS } from '../game/city';

interface MinimapProps {
  hud: HudSnapshot;
}

export const Minimap: React.FC<MinimapProps> = ({ hud }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 164;
    const scale = 0.56; // world meters -> pixels

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0d131d';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);

    // Draw Port water zone
    const waterY = (210 - hud.playerZ) * scale;
    ctx.fillStyle = '#0c273b';
    ctx.fillRect(-size, waterY, size * 2, size * 2);

    // Draw city blocks
    const blocks = [-180, -120, -60, 0, 60, 120, 180];
    ctx.fillStyle = '#1b2434';
    for (const bx of blocks) {
      for (const bz of blocks) {
        if (bz > 180) continue;
        const rx = (bx - 21 - hud.playerX) * scale;
        const rz = (bz - 21 - hud.playerZ) * scale;
        const rw = 42 * scale;
        ctx.fillRect(rx, rz, rw, rw);
      }
    }

    // Draw roads
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 16 * scale;
    for (const rc of ROAD_CENTERS) {
      if (rc <= 180) {
        const y = (rc - hud.playerZ) * scale;
        ctx.beginPath();
        ctx.moveTo(-size, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      const x = (rc - hud.playerX) * scale;
      ctx.beginPath();
      ctx.moveTo(x, -size);
      ctx.lineTo(x, (205 - hud.playerZ) * scale);
      ctx.stroke();
    }

    // Blips
    for (const b of hud.minimapBlips) {
      const bx = (b.x - hud.playerX) * scale;
      const by = (b.z - hud.playerZ) * scale;
      const dist = Math.hypot(bx, by);
      const clampedX = dist > 72 ? (bx / dist) * 72 : bx;
      const clampedY = dist > 72 ? (by / dist) * 72 : by;

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, b.kind === 'mission' ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (b.kind === 'mission') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Player direction arrow
    ctx.rotate(-hud.playerYaw + Math.PI);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [hud]);

  return (
    <div className="relative w-[164px] h-[164px] rounded-md overflow-hidden border border-white/20 bg-[#0d131d] shadow-lg">
      <canvas ref={canvasRef} width={164} height={164} className="block w-full h-full" />
      <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-medium text-slate-300 pointer-events-none">
        <span className="truncate">{hud.districtName}</span>
      </div>
    </div>
  );
};
