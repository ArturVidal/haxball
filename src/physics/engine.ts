import { Ball, Disc, GoalPost, MatchStats, Segment, Stadium, Team, Vector2D } from '../types/game';
import { sounds } from '../audio/soundEngine';

export interface StadiumGeometry {
  pitchLeft: number;
  pitchRight: number;
  pitchTop: number;
  pitchBottom: number;
  goalTop: number;
  goalBottom: number;
  segments: Segment[];
  goalPosts: GoalPost[];
}

export function buildStadiumGeometry(stadium: Stadium): StadiumGeometry {
  const pitchLeft = 60;
  const pitchRight = stadium.width - 60;
  const pitchTop = 40;
  const pitchBottom = stadium.height - 40;

  const goalCenterY = stadium.height / 2 + (stadium.goalOffsetY || 0);
  const goalTop = Math.max(pitchTop + 10, goalCenterY - stadium.goalWidth / 2);
  const goalBottom = Math.min(pitchBottom - 10, goalCenterY + stadium.goalWidth / 2);
  const goalDepth = stadium.goalDepth;

  const postRadius = 8;
  const goalPosts: GoalPost[] = [
    { x: pitchLeft, y: goalTop, radius: postRadius, color: '#f8fafc' },
    { x: pitchLeft, y: goalBottom, radius: postRadius, color: '#f8fafc' },
    { x: pitchRight, y: goalTop, radius: postRadius, color: '#f8fafc' },
    { x: pitchRight, y: goalBottom, radius: postRadius, color: '#f8fafc' },
  ];

  // Add custom obstacle pillars if present
  if (stadium.pillars && stadium.pillars.length > 0) {
    for (const p of stadium.pillars) {
      goalPosts.push({
        x: p.x,
        y: p.y,
        radius: p.radius,
        color: p.color || '#f59e0b',
      });
    }
  }

  const segments: Segment[] = [
    // Outer pitch top and bottom borders
    { p0: { x: pitchLeft, y: pitchTop }, p1: { x: pitchRight, y: pitchTop }, bounciness: 0.6 },
    { p0: { x: pitchLeft, y: pitchBottom }, p1: { x: pitchRight, y: pitchBottom }, bounciness: 0.6 },

    // Left outer segments
    { p0: { x: pitchLeft, y: pitchTop }, p1: { x: pitchLeft, y: goalTop }, bounciness: 0.6 },
    { p0: { x: pitchLeft, y: goalBottom }, p1: { x: pitchLeft, y: pitchBottom }, bounciness: 0.6 },

    // Right outer segments
    { p0: { x: pitchRight, y: pitchTop }, p1: { x: pitchRight, y: goalTop }, bounciness: 0.6 },
    { p0: { x: pitchRight, y: goalBottom }, p1: { x: pitchRight, y: pitchBottom }, bounciness: 0.6 },

    // Left Goal Net
    { p0: { x: pitchLeft, y: goalTop }, p1: { x: pitchLeft - goalDepth, y: goalTop }, bounciness: 0.35, isGoalNet: true, color: 'rgba(255,255,255,0.4)' },
    { p0: { x: pitchLeft - goalDepth, y: goalTop }, p1: { x: pitchLeft - goalDepth, y: goalBottom }, bounciness: 0.35, isGoalNet: true, color: 'rgba(255,255,255,0.4)' },
    { p0: { x: pitchLeft - goalDepth, y: goalBottom }, p1: { x: pitchLeft, y: goalBottom }, bounciness: 0.35, isGoalNet: true, color: 'rgba(255,255,255,0.4)' },

    // Right Goal Net
    { p0: { x: pitchRight, y: goalTop }, p1: { x: pitchRight + goalDepth, y: goalTop }, bounciness: 0.35, isGoalNet: true, color: 'rgba(255,255,255,0.4)' },
    { p0: { x: pitchRight + goalDepth, y: goalTop }, p1: { x: pitchRight + goalDepth, y: goalBottom }, bounciness: 0.35, isGoalNet: true, color: 'rgba(255,255,255,0.4)' },
    { p0: { x: pitchRight + goalDepth, y: goalBottom }, p1: { x: pitchRight, y: goalBottom }, bounciness: 0.35, isGoalNet: true, color: 'rgba(255,255,255,0.4)' },
  ];

  // Add custom internal obstacle walls if present
  if (stadium.obstacles && stadium.obstacles.length > 0) {
    segments.push(...stadium.obstacles);
  }

  return { pitchLeft, pitchRight, pitchTop, pitchBottom, goalTop, goalBottom, segments, goalPosts };
}

export function createInitialBall(stadium: Stadium): Ball {
  return {
    x: stadium.width / 2,
    y: stadium.height / 2,
    vx: 0,
    vy: 0,
    radius: 10,
    invMass: 1.0,
    damping: stadium.ballFriction,
    bounciness: 0.68,
    color: '#ffffff',
    lastTouchTeam: null,
    lastTouchPlayerId: null,
  };
}

export function resetDiscsPositions(discs: Disc[], stadium: Stadium) {
  const redDiscs = discs.filter((d) => d.team === 'red');
  const blueDiscs = discs.filter((d) => d.team === 'blue');

  const defaultRedSpawns = [
    { x: stadium.width * 0.3, y: stadium.height * 0.5 },
    { x: stadium.width * 0.4, y: stadium.height * 0.32 },
    { x: stadium.width * 0.4, y: stadium.height * 0.68 },
  ];
  const defaultBlueSpawns = [
    { x: stadium.width * 0.7, y: stadium.height * 0.5 },
    { x: stadium.width * 0.6, y: stadium.height * 0.32 },
    { x: stadium.width * 0.6, y: stadium.height * 0.68 },
  ];

  const redSpawns = stadium.spawnPoints?.red?.length ? stadium.spawnPoints.red : defaultRedSpawns;
  const blueSpawns = stadium.spawnPoints?.blue?.length ? stadium.spawnPoints.blue : defaultBlueSpawns;

  redDiscs.forEach((disc, idx) => {
    const pt = redSpawns[idx] || redSpawns[0];
    disc.x = pt.x;
    disc.y = pt.y;
    disc.vx = 0;
    disc.vy = 0;
    disc.isKicking = false;
  });

  blueDiscs.forEach((disc, idx) => {
    const pt = blueSpawns[idx] || blueSpawns[0];
    disc.x = pt.x;
    disc.y = pt.y;
    disc.vx = 0;
    disc.vy = 0;
    disc.isKicking = false;
  });
}

/**
 * Executes a single physics tick (typically 60fps)
 */
export function stepPhysics(
  discs: Disc[],
  ball: Ball,
  stadium: Stadium,
  geo: StadiumGeometry,
  isCountdown: boolean,
  stats: MatchStats,
  isGoalScored: boolean = false
): { goalScored: Team | null; goalSpeedKmh: number } {
  // Authentic HaxBall player speed (controlled and tactile)
  const maxPlayerSpeed = 4.4;

  // 1. Update player positions with damping & max speed limit
  for (const player of discs) {
    if (player.team === 'spectator') continue;

    player.vx *= stadium.playerFriction;
    player.vy *= stadium.playerFriction;

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxPlayerSpeed) {
      player.vx = (player.vx / speed) * maxPlayerSpeed;
      player.vy = (player.vy / speed) * maxPlayerSpeed;
    }

    player.x += player.vx;
    player.y += player.vy;

    if (player.kickCooldown > 0) {
      player.kickCooldown--;
    }

    // Countdown enforcement: players cannot cross the midfield line
    if (isCountdown) {
      const midX = stadium.width / 2;
      if (player.team === 'red' && player.x > midX - player.radius - 4) {
        player.x = midX - player.radius - 4;
        player.vx = 0;
      } else if (player.team === 'blue' && player.x < midX + player.radius + 4) {
        player.x = midX + player.radius + 4;
        player.vx = 0;
      }
    }
  }

  // 2. Update ball physics with damping and clamp maximum speed to authentic HaxBall pace
  if (isCountdown) {
    // Ball is strictly locked at the exact center of the stadium with zero velocity until match starts
    ball.x = stadium.width / 2;
    ball.y = stadium.height / 2;
    ball.vx = 0;
    ball.vy = 0;
  } else {
    ball.vx *= stadium.ballFriction;
    ball.vy *= stadium.ballFriction;

    // Authentic HaxBall ball max speed limit (prevents unrealistic bullet shots)
    const currentBallSpeed = Math.hypot(ball.vx, ball.vy);
    const maxBallSpeed = 7.2;
    if (currentBallSpeed > maxBallSpeed) {
      ball.vx = (ball.vx / currentBallSpeed) * maxBallSpeed;
      ball.vy = (ball.vy / currentBallSpeed) * maxBallSpeed;
    }

    // Net deceleration: if ball entered goal area, brake softly so it rests in the net
    if (ball.x < geo.pitchLeft || ball.x > geo.pitchRight) {
      ball.vx *= 0.88;
      ball.vy *= 0.88;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Track possession stats
    if (ball.lastTouchTeam === 'red') {
      stats.redPossessionTicks++;
    } else if (ball.lastTouchTeam === 'blue') {
      stats.bluePossessionTicks++;
    }
  }

  // 3. Player-to-Ball Kick & Collision (active only during live play, disabled during countdown)
  if (!isCountdown) {
    for (const player of discs) {
    if (player.team === 'spectator') continue;

    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    const contactDist = player.radius + ball.radius;

    // Check Kick Action
    if (player.isKicking) {
      const kickRange = contactDist + 4; // Kick reach
      if (dist <= kickRange && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Authentic Haxball kick impulse (balanced, smooth feel)
        const kickStrength = 4.8;
        ball.vx = nx * kickStrength + player.vx * 0.25;
        ball.vy = ny * kickStrength + player.vy * 0.25;

        ball.lastTouchTeam = player.team;
        ball.lastTouchPlayerId = player.id;

        // Count shot if moving towards opponent goal
        if (player.team === 'red' && ball.vx > 2.5) stats.redShots++;
        if (player.team === 'blue' && ball.vx < -2.5) stats.blueShots++;

        sounds.playKick(1.0);
      }
    }

    // Standard Disc-to-Ball elastic body collision (Dribbling)
    if (dist < contactDist && dist > 0.0001) {
      const overlap = contactDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      // Positional resolution based on inverse masses
      const totalInvMass = player.invMass + ball.invMass;
      player.x -= nx * overlap * (player.invMass / totalInvMass);
      player.y -= ny * overlap * (player.invMass / totalInvMass);
      ball.x += nx * overlap * (ball.invMass / totalInvMass);
      ball.y += ny * overlap * (ball.invMass / totalInvMass);

      // Velocity impulse
      const rvx = ball.vx - player.vx;
      const rvy = ball.vy - player.vy;
      const velAlongNormal = rvx * nx + rvy * ny;

      if (velAlongNormal < 0) {
        // Softer restitution (0.45) allows close ball control and authentic Haxball dribbling
        const restitution = 0.45;
        const impulse = -(1 + restitution) * velAlongNormal / totalInvMass;
        player.vx -= impulse * player.invMass * nx;
        player.vy -= impulse * player.invMass * ny;
        ball.vx += impulse * ball.invMass * nx;
        ball.vy += impulse * ball.invMass * ny;

        ball.lastTouchTeam = player.team;
        ball.lastTouchPlayerId = player.id;
        sounds.playBounce(Math.min(Math.abs(velAlongNormal) / 4, 1));
      }
    }
  }
}

  // 4. Player-to-Player Collisions
  for (let i = 0; i < discs.length; i++) {
    for (let j = i + 1; j < discs.length; j++) {
      const p1 = discs[i];
      const p2 = discs[j];
      if (p1.team === 'spectator' || p2.team === 'spectator') continue;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = p1.radius + p2.radius;

      if (dist < minDist && dist > 0.0001) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        const totalInvMass = p1.invMass + p2.invMass;
        p1.x -= nx * overlap * (p1.invMass / totalInvMass);
        p1.y -= ny * overlap * (p1.invMass / totalInvMass);
        p2.x += nx * overlap * (p2.invMass / totalInvMass);
        p2.y += ny * overlap * (p2.invMass / totalInvMass);

        const rvx = p2.vx - p1.vx;
        const rvy = p2.vy - p1.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
          const restitution = 0.45;
          const impulse = -(1 + restitution) * velAlongNormal / totalInvMass;
          p1.vx -= impulse * p1.invMass * nx;
          p1.vy -= impulse * p1.invMass * ny;
          p2.vx += impulse * p2.invMass * nx;
          p2.vy += impulse * p2.invMass * ny;
        }
      }
    }
  }

  // 5. Goal Post Collisions (Immovable circular obstacles)
  for (const post of geo.goalPosts) {
    // Ball vs Post
    const bdx = ball.x - post.x;
    const bdy = ball.y - post.y;
    const bdist = Math.hypot(bdx, bdy);
    const bminDist = ball.radius + post.radius;

    if (bdist < bminDist && bdist > 0.0001) {
      const boverlap = bminDist - bdist;
      const bnx = bdx / bdist;
      const bny = bdy / bdist;
      ball.x += bnx * boverlap;
      ball.y += bny * boverlap;

      const bvn = ball.vx * bnx + ball.vy * bny;
      if (bvn < 0) {
        ball.vx -= (1 + 0.8) * bvn * bnx;
        ball.vy -= (1 + 0.8) * bvn * bny;
        sounds.playPostHit();
      }
    }

    // Players vs Post
    for (const player of discs) {
      if (player.team === 'spectator') continue;
      const pdx = player.x - post.x;
      const pdy = player.y - post.y;
      const pdist = Math.hypot(pdx, pdy);
      const pminDist = player.radius + post.radius;

      if (pdist < pminDist && pdist > 0.0001) {
        const poverlap = pminDist - pdist;
        const pnx = pdx / pdist;
        const pny = pdy / pdist;
        player.x += pnx * poverlap;
        player.y += pny * poverlap;

        const pvn = player.vx * pnx + player.vy * pny;
        if (pvn < 0) {
          player.vx -= (1 + 0.5) * pvn * pnx;
          player.vy -= (1 + 0.5) * pvn * pny;
        }
      }
    }
  }

  // 6. Segment / Wall Collisions
  for (const seg of geo.segments) {
    // Ball vs Segment
    collideCircleWithSegment(ball, seg);

    // Players vs Segment
    for (const player of discs) {
      if (player.team === 'spectator') continue;
      collideCircleWithSegment(player, seg);
    }
  }

  // 7. Goal Detection (Only check if not already in goal or countdown state!)
  if (!isGoalScored && !isCountdown) {
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    // Left Goal: Ball crosses left goal line (x < pitchLeft) inside goal opening
    if (ball.x + ball.radius < geo.pitchLeft && ball.y > geo.goalTop && ball.y < geo.goalBottom) {
      const speedKmh = Math.round(currentSpeed * 15);
      return { goalScored: 'blue', goalSpeedKmh: Math.max(speedKmh, 20) };
    }

    // Right Goal: Ball crosses right goal line (x > pitchRight) inside goal opening
    if (ball.x - ball.radius > geo.pitchRight && ball.y > geo.goalTop && ball.y < geo.goalBottom) {
      const speedKmh = Math.round(currentSpeed * 15);
      return { goalScored: 'red', goalSpeedKmh: Math.max(speedKmh, 20) };
    }
  }

  return { goalScored: null, goalSpeedKmh: 0 };
}

function collideCircleWithSegment(
  circle: { x: number; y: number; vx: number; vy: number; radius: number },
  seg: Segment
) {
  const p0 = seg.p0;
  const p1 = seg.p1;

  const vx = p1.x - p0.x;
  const vy = p1.y - p0.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return;

  const wx = circle.x - p0.x;
  const wy = circle.y - p0.y;

  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const qx = p0.x + t * vx;
  const qy = p0.y + t * vy;

  const dx = circle.x - qx;
  const dy = circle.y - qy;
  const dist = Math.hypot(dx, dy);

  if (dist < circle.radius && dist > 0.0001) {
    const overlap = circle.radius - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    circle.x += nx * overlap;
    circle.y += ny * overlap;

    const vn = circle.vx * nx + circle.vy * ny;
    if (vn < 0) {
      circle.vx -= (1 + seg.bounciness) * vn * nx;
      circle.vy -= (1 + seg.bounciness) * vn * ny;
    }
  }
}
