import { Ball, Disc, Stadium, Team } from '../types/game';
import { StadiumGeometry } from './engine';

interface BotInput {
  dx: number;
  dy: number;
  kick: boolean;
}

// Track per-bot stuck state across frames to reliably break deadlocks
const botStuckFrames = new Map<string, number>();

// Track per-bot liberation state for corner unstick maneuvers
interface BotLiberationState {
  stalledFrames: number;      // Frames at zero velocity while confined in corner
  liberatingFrames: number;   // Active countdown of frames executing liberation maneuver
  escapeDx: number;           // Normalized escape vector X
  escapeDy: number;           // Normalized escape vector Y
}
const botLiberationMap = new Map<string, BotLiberationState>();

export function updateBotAI(
  bot: Disc,
  allDiscs: Disc[],
  ball: Ball,
  stadium: Stadium,
  geo: StadiumGeometry,
  isCountdown: boolean
): BotInput {
  if (isCountdown) {
    botStuckFrames.set(bot.id, 0);
    botLiberationMap.delete(bot.id);
    return { dx: 0, dy: 0, kick: false };
  }

  const team = bot.team;
  if (team === 'spectator') return { dx: 0, dy: 0, kick: false };

  const isRed = team === 'red';
  const ownGoalX = isRed ? geo.pitchLeft : geo.pitchRight;
  const oppGoalX = isRed ? geo.pitchRight : geo.pitchLeft;
  const midX = stadium.width / 2;
  const midY = stadium.height / 2;
  const goalCenterY = stadium.height / 2;

  // Identify bot role among teammates (1st bot is GK/Defender, 2nd is Striker)
  const teammates = allDiscs.filter((d) => d.team === team);
  const myIndex = teammates.findIndex((d) => d.id === bot.id);
  const isSolo = teammates.length === 1;
  const isGoalkeeper = !isSolo && myIndex === 0;

  // Bot difficulty adjustments
  const difficulty = bot.botDifficulty || 'medium';
  let predictionFrames = 10;
  let kickPrecisionAngle = 0.70; // radians tolerance

  if (difficulty === 'easy') {
    predictionFrames = 5;
    kickPrecisionAngle = 1.0;
  } else if (difficulty === 'hard') {
    predictionFrames = 16;
    kickPrecisionAngle = 0.50;
  }

  // Predict future ball position considering damping
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  let predBallX = ball.x + ball.vx * predictionFrames;
  let predBallY = ball.y + ball.vy * predictionFrames;

  // Keep predicted ball safely within pitch boundaries
  predBallX = Math.max(geo.pitchLeft + 16, Math.min(geo.pitchRight - 16, predBallX));
  predBallY = Math.max(geo.pitchTop + 16, Math.min(geo.pitchBottom - 16, predBallY));

  const distToBall = Math.hypot(ball.x - bot.x, ball.y - bot.y);
  const contactDist = bot.radius + ball.radius;
  const botSpeed = Math.hypot(bot.vx, bot.vy);

  // 1. CORNER & CONFINEMENT BOUNDARY DEFINITION
  const CORNER_THRESHOLD = 85;
  const isBotInCorner =
    (bot.x <= geo.pitchLeft + CORNER_THRESHOLD || bot.x >= geo.pitchRight - CORNER_THRESHOLD) &&
    (bot.y <= geo.pitchTop + CORNER_THRESHOLD || bot.y >= geo.pitchBottom - CORNER_THRESHOLD);

  const isBallInCorner =
    (ball.x <= geo.pitchLeft + CORNER_THRESHOLD || ball.x >= geo.pitchRight - CORNER_THRESHOLD) &&
    (ball.y <= geo.pitchTop + CORNER_THRESHOLD || ball.y >= geo.pitchBottom - CORNER_THRESHOLD);

  const isConfinedInCorner = isBotInCorner || (isBallInCorner && distToBall <= contactDist + 28);
  const isSpeedNearZero = botSpeed < 0.12;

  // Retrieve or initialize liberation state
  let libState = botLiberationMap.get(bot.id);
  if (!libState) {
    libState = { stalledFrames: 0, liberatingFrames: 0, escapeDx: 0, escapeDy: 0 };
    botLiberationMap.set(bot.id, libState);
  }

  // 2. DETECT VELOCITY ZERO & CONFINEMENT -> TRIGGER LIBERATION
  // Increment counter if bot is confined in corner with speed near zero
  if (isConfinedInCorner && isSpeedNearZero) {
    libState.stalledFrames++;
  } else {
    libState.stalledFrames = Math.max(0, libState.stalledFrames - 1);
  }

  // If stalled at near-zero velocity in a corner for 4+ frames, initiate liberation
  if (libState.stalledFrames >= 4 && libState.liberatingFrames <= 0) {
    libState.liberatingFrames = 24; // Force liberation escape maneuver for ~24 frames (~0.4s)

    // Vector pointing away from corner walls into open pitch
    const awayFromWallX = bot.x < midX ? 1 : -1;
    const awayFromWallY = bot.y < midY ? 1 : -1;

    // Vector pointing away from the ball if adjacent
    let awayFromBallX = 0;
    let awayFromBallY = 0;
    if (distToBall < contactDist + 35) {
      const dxB = bot.x - ball.x;
      const dyB = bot.y - ball.y;
      const dB = Math.hypot(dxB, dyB);
      if (dB > 0.01) {
        awayFromBallX = (dxB / dB) * 1.6;
        awayFromBallY = (dyB / dB) * 1.6;
      }
    }

    const totalEscX = awayFromWallX + awayFromBallX;
    const totalEscY = awayFromWallY + awayFromBallY;
    const escLen = Math.hypot(totalEscX, totalEscY);
    if (escLen > 0.05) {
      libState.escapeDx = totalEscX / escLen;
      libState.escapeDy = totalEscY / escLen;
    } else {
      libState.escapeDx = awayFromWallX;
      libState.escapeDy = awayFromWallY;
    }
  }

  // 3. PRIORITY A: ACTIVE LIBERATION MANEUVER
  // Force bot to pull away from walls and ball with maximum drive
  if (libState.liberatingFrames > 0) {
    libState.liberatingFrames--;
    libState.stalledFrames = 0;

    let shouldKick = false;
    // Kick on close contact to dislodge ball and remove physical pinning
    if (distToBall <= contactDist + 12) {
      shouldKick = true;
    }

    const dirX = libState.escapeDx;
    const dirY = libState.escapeDy;
    const accel = 0.18; // Strong burst acceleration to escape corner friction
    bot.vx += dirX * accel;
    bot.vy += dirY * accel;
    bot.isKicking = shouldKick;

    return { dx: dirX, dy: dirY, kick: shouldKick };
  }

  // 4. GOALMOUTH FINISHER / TAP-IN POACHER DETECTION
  const distToOppGoalLine = Math.abs(ball.x - oppGoalX);
  const isNearOppGoalmouthY = ball.y >= geo.goalTop - 25 && ball.y <= geo.goalBottom + 25;
  const isTapInOpportunity =
    distToOppGoalLine < 110 &&
    isNearOppGoalmouthY &&
    (isRed ? ball.x > stadium.width * 0.55 : ball.x < stadium.width * 0.45);

  // 5. WALL & CORNER DETECTION (The goalmouth opening is NEVER treated as a wall!)
  const isInsideGoalmouthY = ball.y >= geo.goalTop && ball.y <= geo.goalBottom;
  const isBallNearLeftWall = ball.x < geo.pitchLeft + 45 && !isInsideGoalmouthY;
  const isBallNearRightWall = ball.x > geo.pitchRight - 45 && !isInsideGoalmouthY;
  const isBallNearTopWall = ball.y < geo.pitchTop + 45;
  const isBallNearBottomWall = ball.y > geo.pitchBottom - 45;

  const isBallNearWall =
    isBallNearLeftWall || isBallNearRightWall || isBallNearTopWall || isBallNearBottomWall;

  // 6. GENERAL ANTI-STUCK SYSTEM (For midfield/wall pin locks)
  let stuckCount = botStuckFrames.get(bot.id) || 0;
  const isPhysicallyPinned = distToBall <= contactDist + 8 && botSpeed < 0.45 && ballSpeed < 0.6;

  if (isPhysicallyPinned) {
    stuckCount++;
  } else {
    stuckCount = Math.max(0, stuckCount - 2);
  }
  botStuckFrames.set(bot.id, stuckCount);

  let targetX = predBallX;
  let targetY = predBallY;
  let shouldKick = false;

  // PRIORITY B: GENERAL UN-STUCK MANEUVER
  if (stuckCount > 8) {
    shouldKick = true;
    const inAttackingHalf = isRed ? bot.x > midX : bot.x < midX;
    if (inAttackingHalf) {
      targetX = oppGoalX;
      targetY = goalCenterY;
    } else {
      targetX = midX;
      targetY = midY;
    }
    if (stuckCount > 28) {
      botStuckFrames.set(bot.id, 0);
    }
  }

  // PRIORITY C: GOALMOUTH TAP-IN / POACHER (BALL ON OR NEAR GOAL LINE)
  else if (isTapInOpportunity) {
    const isBotBehindBall = isRed ? bot.x <= ball.x + 8 : bot.x >= ball.x - 8;

    if (isBotBehindBall) {
      targetX = isRed ? geo.pitchRight + 55 : geo.pitchLeft - 55;
      targetY = Math.max(geo.goalTop + 12, Math.min(geo.goalBottom - 12, ball.y));

      if (distToBall <= contactDist + 22) {
        shouldKick = true;
      }
    } else {
      targetX = isRed ? ball.x - 26 : ball.x + 26;
      targetY = ball.y < goalCenterY ? ball.y + 24 : ball.y - 24;

      if (distToBall <= contactDist + 14) {
        shouldKick = true;
      }
    }
  }

  // PRIORITY D: IMPROVED CORNER POSITIONING ALGORITHM
  // Prevents the bot from wedging itself into the corner apex with the ball
  else if (isBallInCorner) {
    const isBallInLeft = ball.x < midX;
    const isBallInTop = ball.y < midY;

    // Check if bot is trapped in the wedge between ball and the corner vertex
    const isTrappedInCornerApex =
      (isBallInLeft ? bot.x <= ball.x : bot.x >= ball.x) &&
      (isBallInTop ? bot.y <= ball.y : bot.y >= ball.y);

    if (isTrappedInCornerApex) {
      // Bot is behind the ball in the corner hole: maneuver out towards open field
      targetX = ball.x + (isBallInLeft ? 38 : -38);
      targetY = ball.y + (isBallInTop ? 38 : -38);

      if (distToBall <= contactDist + 12) {
        shouldKick = true;
      }
    } else {
      // Tactical hypotenuse approach: approach the ball from the open field side
      if (isRed) {
        if (isBallInLeft) {
          // Defensive corner: position to clear upfield toward midfield
          targetX = ball.x - 24;
          targetY = isBallInTop ? ball.y + 20 : ball.y - 20;
        } else {
          // Attacking corner: position to cross / center the ball towards the goal mouth
          targetX = ball.x - 26;
          targetY = isBallInTop ? ball.y + 18 : ball.y - 18;
        }
      } else {
        // Blue team
        if (!isBallInLeft) {
          // Defensive corner: position to clear towards midfield
          targetX = ball.x + 24;
          targetY = isBallInTop ? ball.y + 20 : ball.y - 20;
        } else {
          // Attacking corner: position to cross toward opponent goal
          targetX = ball.x + 26;
          targetY = isBallInTop ? ball.y + 18 : ball.y - 18;
        }
      }

      // Quick release kick: in corners, kick when in range to clear or cross
      if (distToBall <= contactDist + 14) {
        shouldKick = true;
      }
    }

    // Keep target safe from corner walls (minimum buffer of bot radius + 18)
    const wallBuffer = bot.radius + 18;
    targetX = Math.max(geo.pitchLeft + wallBuffer, Math.min(geo.pitchRight - wallBuffer, targetX));
    targetY = Math.max(geo.pitchTop + wallBuffer, Math.min(geo.pitchBottom - wallBuffer, targetY));
  }

  // PRIORITY E: SIDE WALL APPROACH (Outside corner & goal areas)
  else if (isBallNearWall) {
    let approachX = ball.x;
    let approachY = ball.y;

    if (isBallNearTopWall) {
      approachY = ball.y + 24;
    } else if (isBallNearBottomWall) {
      approachY = ball.y - 24;
    }

    if (isBallNearLeftWall) {
      approachX = ball.x + 24;
    } else if (isBallNearRightWall) {
      approachX = ball.x - 24;
    }

    const forwardBias = isRed ? 20 : -20;
    targetX = approachX - forwardBias;
    targetY = approachY;

    if (distToBall <= contactDist + 12) {
      shouldKick = true;
    }
  }

  // PRIORITY F: GOALKEEPER LOGIC
  else if (isGoalkeeper) {
    const keeperDefendX = isRed ? geo.pitchLeft + 40 : geo.pitchRight - 40;
    const targetKeeperY = Math.max(
      geo.goalTop + 14,
      Math.min(geo.goalBottom - 14, predBallY)
    );

    const isBallThreatening = isRed
      ? ball.x < stadium.width * 0.42 && ball.vx <= 0.8
      : ball.x > stadium.width * 0.58 && ball.vx >= -0.8;

    if (isBallThreatening && distToBall < 110) {
      targetX = predBallX;
      targetY = predBallY;
    } else {
      targetX = keeperDefendX;
      targetY = targetKeeperY;
    }
  }

  // PRIORITY G: OUTFIELD / STRIKER / 1v1
  else {
    const isBallBehindUs = isRed ? bot.x > ball.x + 10 : bot.x < ball.x - 10;
    const ballInOurThird = isRed
      ? ball.x < stadium.width * 0.32
      : ball.x > stadium.width * 0.68;

    if (isSolo && ballInOurThird && isBallBehindUs) {
      const recoveryX = isRed ? ball.x - 35 : ball.x + 35;
      const recoveryY = (ball.y + goalCenterY) / 2;
      targetX = recoveryX;
      targetY = recoveryY;
    } else {
      const angleToGoal = Math.atan2(goalCenterY - predBallY, oppGoalX - predBallX);
      const pushDistance = 22;

      targetX = predBallX - Math.cos(angleToGoal) * pushDistance;
      targetY = predBallY - Math.sin(angleToGoal) * pushDistance;

      targetX = Math.max(geo.pitchLeft + 12, Math.min(geo.pitchRight - 12, targetX));

      if (distToBall > 90) {
        const lateralWobble = Math.sin(Date.now() / 350) * 10;
        targetY += lateralWobble;
      }
    }
  }

  // Calculate direction vector to target
  let dirX = targetX - bot.x;
  let dirY = targetY - bot.y;
  const len = Math.hypot(dirX, dirY);

  let dx = 0;
  let dy = 0;
  if (len > 3) {
    dx = dirX / len;
    dy = dirY / len;
  }

  // 7. KICK DECISION LOGIC
  if (!shouldKick) {
    // If ball is right on or near opponent goal line between posts, tap it in
    if (distToOppGoalLine < 40 && isNearOppGoalmouthY && distToBall <= contactDist + 24) {
      shouldKick = true;
    }
    // If in attacking penalty box facing the goal, smash it in
    else if (distToOppGoalLine < 150 && isNearOppGoalmouthY && distToBall <= contactDist + 14) {
      const isFacingGoal = isRed ? bot.x <= ball.x + 10 : bot.x >= ball.x - 10;
      if (isFacingGoal) {
        shouldKick = true;
      }
    }
    // General shooting evaluation with angle diff check
    else if (distToBall <= contactDist + 10) {
      const angleToBall = Math.atan2(ball.y - bot.y, ball.x - bot.x);

      const goalUpperTarget = geo.goalTop + 15;
      const goalLowerTarget = geo.goalBottom - 15;
      const targetGoalY = ball.y < goalCenterY ? goalLowerTarget : goalUpperTarget;
      const angleToOppGoal = Math.atan2(targetGoalY - ball.y, oppGoalX - ball.x);

      let angleDiff = Math.abs(angleToBall - angleToOppGoal);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);

      const angleToOwnGoal = Math.atan2(goalCenterY - ball.y, ownGoalX - ball.x);
      let ownGoalAngleDiff = Math.abs(angleToBall - angleToOwnGoal);
      while (ownGoalAngleDiff > Math.PI) ownGoalAngleDiff = Math.abs(ownGoalAngleDiff - 2 * Math.PI);

      const isOwnGoalRisk = ownGoalAngleDiff < 0.60 && distToBall < contactDist + 5;

      if (!isOwnGoalRisk && angleDiff <= kickPrecisionAngle) {
        shouldKick = true;
      }

      const inDefensiveZone = isRed ? bot.x < geo.pitchLeft + 120 : bot.x > geo.pitchRight - 120;
      if (inDefensiveZone && distToBall <= contactDist + 6 && !isOwnGoalRisk) {
        shouldKick = true;
      }
    }
  }

  // Acceleration applied based on bot difficulty
  const accel = difficulty === 'hard' ? 0.15 : difficulty === 'medium' ? 0.13 : 0.11;
  bot.vx += dx * accel;
  bot.vy += dy * accel;
  bot.isKicking = shouldKick;

  return { dx, dy, kick: shouldKick };
}

