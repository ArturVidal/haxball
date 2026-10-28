export type Team = 'red' | 'blue' | 'spectator';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Disc {
  id: string;
  name: string;
  avatar: string; // 1-2 characters or emoji
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  invMass: number; // 1 / mass
  damping: number;
  color: string;
  avatarColor: string;
  isKicking: boolean;
  kickCooldown: number;
  isBot?: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  invMass: number;
  damping: number;
  bounciness: number;
  color: string;
  lastTouchTeam: Team | null;
  lastTouchPlayerId: string | null;
}

export interface GoalPost {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface Segment {
  p0: Vector2D;
  p1: Vector2D;
  bounciness: number;
  isGoalNet?: boolean;
  color?: string;
}

export interface ObstaclePillar {
  id: string;
  x: number;
  y: number;
  radius: number;
  bounciness: number;
  color?: string;
}

export interface Stadium {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  pitchColor: string;
  pitchBorderColor: string;
  linesColor: string;
  ballFriction: number;
  playerFriction: number;
  goalDepth: number;
  goalWidth: number; // vertical height of goal opening
  goalOffsetY?: number; // vertical offset from center
  centerRadius: number;
  spawnPoints: {
    red: Vector2D[];
    blue: Vector2D[];
  };
  obstacles?: Segment[];
  pillars?: ObstaclePillar[];
  isCustom?: boolean;
}

export type MatchStatus = 'waiting' | 'countdown' | 'playing' | 'goal_scored' | 'replay' | 'ended';

export interface MatchStats {
  redPossessionTicks: number;
  bluePossessionTicks: number;
  redShots: number;
  blueShots: number;
  redSaves: number;
  blueSaves: number;
  goals: {
    scorerName: string;
    team: Team;
    timeSeconds: number;
    speedKmh: number;
  }[];
}

export interface ReplayFrame {
  ball: { x: number; y: number; vx: number; vy: number };
  players: { id: string; x: number; y: number; isKicking: boolean; team: Team }[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  team: Team | 'system';
  text: string;
  timestamp: string;
}

export interface Room {
  id: string;
  name: string;
  hostName: string;
  stadiumId: string;
  maxPlayers: number;
  scoreLimit: number;
  timeLimitMinutes: number;
  isPrivate?: boolean;
  password?: string;
  playerCount: number;
}
