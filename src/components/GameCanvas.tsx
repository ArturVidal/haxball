import React, { useEffect, useRef } from 'react';
import { Ball, Disc, MatchStatus, Stadium, Team } from '../types/game';
import { buildStadiumGeometry, StadiumGeometry } from '../physics/engine';

interface GameCanvasProps {
  stadium: Stadium;
  discs: Disc[];
  ball: Ball;
  matchStatus: MatchStatus;
  countdownNumber: number | null;
  lastGoalScorer: { name: string; team: Team; speedKmh: number } | null;
  isReplay?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  stadium,
  discs,
  ball,
  matchStatus,
  countdownNumber,
  lastGoalScorer,
  isReplay = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display scaling
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== stadium.width * dpr || canvas.height !== stadium.height * dpr) {
      canvas.width = stadium.width * dpr;
      canvas.height = stadium.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const geo: StadiumGeometry = buildStadiumGeometry(stadium);

    // 1. Draw Arena Outer Background
    ctx.fillStyle = stadium.pitchBorderColor;
    ctx.fillRect(0, 0, stadium.width, stadium.height);

    // 2. Draw Pitch Surface (Green Grass or Rink)
    ctx.fillStyle = stadium.pitchColor;
    ctx.fillRect(
      geo.pitchLeft,
      geo.pitchTop,
      geo.pitchRight - geo.pitchLeft,
      geo.pitchBottom - geo.pitchTop
    );

    // Subtle pitch grass stripes
    const stripeWidth = 40;
    const stripeCount = Math.floor((geo.pitchRight - geo.pitchLeft) / stripeWidth);
    for (let i = 0; i < stripeCount; i += 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(
        geo.pitchLeft + i * stripeWidth,
        geo.pitchTop,
        stripeWidth,
        geo.pitchBottom - geo.pitchTop
      );
    }

    // 3. Draw Pitch Markings (Lines)
    ctx.strokeStyle = stadium.linesColor;
    ctx.lineWidth = 3;

    // Outer Pitch Boundary
    ctx.strokeRect(
      geo.pitchLeft,
      geo.pitchTop,
      geo.pitchRight - geo.pitchLeft,
      geo.pitchBottom - geo.pitchTop
    );

    // Midfield Line
    const midX = stadium.width / 2;
    ctx.beginPath();
    ctx.moveTo(midX, geo.pitchTop);
    ctx.lineTo(midX, geo.pitchBottom);
    ctx.stroke();

    // Center Circle
    const midY = stadium.height / 2;
    ctx.beginPath();
    ctx.arc(midX, midY, stadium.centerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center Spot
    ctx.fillStyle = stadium.linesColor;
    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Goal Areas / Penalty Boxes
    const boxHeight = stadium.goalWidth + 40;
    const boxDepth = 70;
    const boxTop = (stadium.height - boxHeight) / 2;

    // Left Goal Area
    ctx.strokeRect(geo.pitchLeft, boxTop, boxDepth, boxHeight);
    // Right Goal Area
    ctx.strokeRect(geo.pitchRight - boxDepth, boxTop, boxDepth, boxHeight);

    // 4. Draw Goal Nets
    // Left Net
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(
      geo.pitchLeft - stadium.goalDepth,
      geo.goalTop,
      stadium.goalDepth,
      stadium.goalWidth
    );
    // Left net mesh lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let x = geo.pitchLeft - stadium.goalDepth; x <= geo.pitchLeft; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, geo.goalTop);
      ctx.lineTo(x, geo.goalBottom);
      ctx.stroke();
    }
    for (let y = geo.goalTop; y <= geo.goalBottom; y += 12) {
      ctx.beginPath();
      ctx.moveTo(geo.pitchLeft - stadium.goalDepth, y);
      ctx.lineTo(geo.pitchLeft, y);
      ctx.stroke();
    }

    // Right Net
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(geo.pitchRight, geo.goalTop, stadium.goalDepth, stadium.goalWidth);
    // Right net mesh lines
    for (let x = geo.pitchRight; x <= geo.pitchRight + stadium.goalDepth; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, geo.goalTop);
      ctx.lineTo(x, geo.goalBottom);
      ctx.stroke();
    }
    for (let y = geo.goalTop; y <= geo.goalBottom; y += 12) {
      ctx.beginPath();
      ctx.moveTo(geo.pitchRight, y);
      ctx.lineTo(geo.pitchRight + stadium.goalDepth, y);
      ctx.stroke();
    }

    // Clear goal line opening visually
    ctx.clearRect(geo.pitchLeft - 1.5, geo.goalTop + 1, 3, stadium.goalWidth - 2);
    ctx.fillStyle = stadium.pitchColor;
    ctx.fillRect(geo.pitchLeft - 1.5, geo.goalTop + 1, 3, stadium.goalWidth - 2);

    ctx.clearRect(geo.pitchRight - 1.5, geo.goalTop + 1, 3, stadium.goalWidth - 2);
    ctx.fillRect(geo.pitchRight - 1.5, geo.goalTop + 1, 3, stadium.goalWidth - 2);

    // Custom Obstacle Segments / Internal Walls
    if (stadium.obstacles && stadium.obstacles.length > 0) {
      for (const obs of stadium.obstacles) {
        // Wall Shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obs.p0.x + 2, obs.p0.y + 3);
        ctx.lineTo(obs.p1.x + 2, obs.p1.y + 3);
        ctx.stroke();

        // Wall Body
        ctx.strokeStyle = obs.color || '#e2e8f0';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obs.p0.x, obs.p0.y);
        ctx.lineTo(obs.p1.x, obs.p1.y);
        ctx.stroke();

        // Inner core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.p0.x, obs.p0.y);
        ctx.lineTo(obs.p1.x, obs.p1.y);
        ctx.stroke();
      }
    }

    // 5. Draw Goal Posts and Custom Obstacle Pillars
    for (const post of geo.goalPosts) {
      // Post Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(post.x + 2, post.y + 3, post.radius, 0, Math.PI * 2);
      ctx.fill();

      // Post Body
      ctx.fillStyle = post.color;
      ctx.beginPath();
      ctx.arc(post.x, post.y, post.radius, 0, Math.PI * 2);
      ctx.fill();

      // Post Rim
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 6. Draw Ball Shadow and Ball
    const ballSpeed = Math.hypot(ball.vx, ball.vy);

    // High-speed motion trail
    if (ballSpeed > 5.5) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = ball.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(ball.x - ball.vx * 2.5, ball.y - ball.vy * 2.5);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
    }

    // Ball Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + 3, ball.radius, ball.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Ball Rim
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Classic Soccer Ball Pattern
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // 7. Draw Player Discs
    for (const player of discs) {
      if (player.team === 'spectator') continue;

      // Disc Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(
        player.x + 2,
        player.y + 4,
        player.radius,
        player.radius * 0.9,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Kick Effect (Expanding bright halo ring when spacebar/kick is active)
      if (player.isKicking) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Disc Body
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fill();

      // Disc Border / Inner Rim
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Subtle inner rim highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius - 2.5, 0, Math.PI * 2);
      ctx.stroke();

      // Player Avatar / Number
      ctx.fillStyle = player.avatarColor || '#ffffff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.avatar || '7', player.x, player.y);

      // Player Name label above disc
      const nameText = player.name + (player.isBot ? ' [BOT]' : '');
      ctx.font = '600 11px Plus Jakarta Sans, sans-serif';
      const textWidth = ctx.measureText(nameText).width;

      // Dark tag background for readability
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(
        player.x - textWidth / 2 - 5,
        player.y - player.radius - 20,
        textWidth + 10,
        15,
        4
      );
      ctx.fill();

      // Name Text
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(nameText, player.x, player.y - player.radius - 12);
    }

    // 8. Overlays: Countdown
    if (matchStatus === 'countdown' && countdownNumber !== null) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fillRect(0, 0, stadium.width, stadium.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 68px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = countdownNumber > 0 ? `${countdownNumber}` : 'JOGO!';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.fillText(label, stadium.width / 2, stadium.height / 2);
      ctx.shadowBlur = 0;
    }

    // 9. Overlay: Goal Scored Banner
    if (matchStatus === 'goal_scored' && lastGoalScorer) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 0, stadium.width, stadium.height);

      const isRed = lastGoalScorer.team === 'red';
      const teamName = isRed ? 'EQUIPA VERMELHA' : 'EQUIPA AZUL';
      const teamColor = isRed ? '#ef4444' : '#3b82f6';

      // Goal Announcement
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 52px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 16;
      ctx.fillText('G O L O !', stadium.width / 2, stadium.height / 2 - 32);

      ctx.fillStyle = teamColor;
      ctx.font = '800 24px Outfit, sans-serif';
      ctx.fillText(teamName, stadium.width / 2, stadium.height / 2 + 16);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 14px Plus Jakarta Sans, sans-serif';
      ctx.fillText(
        `Marcador: ${lastGoalScorer.name} · Velocidade: ${lastGoalScorer.speedKmh} km/h`,
        stadium.width / 2,
        stadium.height / 2 + 48
      );
      ctx.shadowBlur = 0;
    }

    // 10. Replay indicator
    if (isReplay) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(geo.pitchLeft + 15, geo.pitchTop + 15, 110, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('● REPLAY', geo.pitchLeft + 70, geo.pitchTop + 28);
    }

    ctx.restore();
  }, [stadium, discs, ball, matchStatus, countdownNumber, lastGoalScorer, isReplay]);

  return (
    <div className="relative w-full flex justify-center items-center select-none overflow-hidden rounded-xl shadow-2xl border border-slate-800 bg-slate-950">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          maxWidth: `${stadium.width}px`,
          aspectRatio: `${stadium.width} / ${stadium.height}`,
          display: 'block',
        }}
      />
    </div>
  );
};
