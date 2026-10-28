import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { MatchStats, Room, Stadium, Team } from '../types/game';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudMatchRecord {
  id: string;
  roomName: string;
  stadiumName: string;
  stadiumId: string;
  redScore: number;
  blueScore: number;
  winnerTeam: 'red' | 'blue' | 'draw';
  durationSeconds: number;
  redPossessionPercent: number;
  bluePossessionPercent: number;
  totalShots: number;
  createdAt: string;
  playedBy: string;
}

export interface CloudPlayerStats {
  id: string;
  playerName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  updatedAt: string;
}

/**
 * Saves a completed match to Firestore database
 */
export async function saveMatchToDatabase(
  roomName: string,
  stadium: Stadium,
  redScore: number,
  blueScore: number,
  durationSeconds: number,
  stats: MatchStats,
  playerName: string
): Promise<string | null> {
  const matchId = `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const totalTicks = stats.redPossessionTicks + stats.bluePossessionTicks;
  const redPoss = totalTicks > 0 ? Math.round((stats.redPossessionTicks / totalTicks) * 100) : 50;
  const bluePoss = 100 - redPoss;
  const winner: 'red' | 'blue' | 'draw' =
    redScore > blueScore ? 'red' : blueScore > redScore ? 'blue' : 'draw';

  const record: CloudMatchRecord = {
    id: matchId,
    roomName: roomName.slice(0, 80),
    stadiumName: stadium.name.slice(0, 80),
    stadiumId: stadium.id.slice(0, 50),
    redScore,
    blueScore,
    winnerTeam: winner,
    durationSeconds,
    redPossessionPercent: redPoss,
    bluePossessionPercent: bluePoss,
    totalShots: stats.redShots + stats.blueShots,
    createdAt: new Date().toISOString(),
    playedBy: playerName.slice(0, 50),
  };

  const path = `matches/${matchId}`;
  try {
    await setDoc(doc(db, 'matches', matchId), record);
    return matchId;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch {
      return null;
    }
    return null;
  }
}

/**
 * Fetches recent matches from Firestore
 */
export async function getRecentMatchesFromDatabase(maxCount: number = 10): Promise<CloudMatchRecord[]> {
  const path = 'matches';
  try {
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(maxCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as CloudMatchRecord);
  } catch (error) {
    console.warn('Could not load matches from database:', error);
    return [];
  }
}

/**
 * Saves a custom stadium layout to Firestore
 */
export async function saveCustomStadiumToDatabase(
  stadium: Stadium,
  authorName: string
): Promise<boolean> {
  const stadiumId = stadium.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const path = `stadiums/${stadiumId}`;

  const payload = {
    id: stadiumId,
    name: stadium.name.slice(0, 60),
    description: (stadium.description || '').slice(0, 200),
    width: stadium.width,
    height: stadium.height,
    goalWidth: stadium.goalWidth,
    goalDepth: stadium.goalDepth,
    goalOffsetY: stadium.goalOffsetY || 0,
    pitchColor: stadium.pitchColor.slice(0, 30),
    authorName: authorName.slice(0, 50),
    createdAt: new Date().toISOString(),
    obstacles: stadium.obstacles || [],
    pillars: stadium.pillars || [],
  };

  try {
    await setDoc(doc(db, 'stadiums', stadiumId), payload);
    return true;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      return false;
    }
    return false;
  }
}

/**
 * Loads custom stadiums saved in Firestore
 */
export async function getCustomStadiumsFromDatabase(): Promise<Stadium[]> {
  try {
    const snapshot = await getDocs(collection(db, 'stadiums'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id || docSnap.id,
        name: data.name,
        description: data.description || 'Estádio personalizado na base de dados.',
        width: data.width,
        height: data.height,
        goalWidth: data.goalWidth,
        goalDepth: data.goalDepth,
        goalOffsetY: data.goalOffsetY || 0,
        pitchColor: data.pitchColor,
        pitchBorderColor: '#0f172a',
        linesColor: 'rgba(255, 255, 255, 0.75)',
        ballFriction: 0.99,
        playerFriction: 0.96,
        centerRadius: Math.min(data.width * 0.1, 85),
        spawnPoints: {
          red: [
            { x: data.width * 0.3, y: data.height * 0.5 },
            { x: data.width * 0.4, y: data.height * 0.32 },
            { x: data.width * 0.4, y: data.height * 0.68 },
          ],
          blue: [
            { x: data.width * 0.7, y: data.height * 0.5 },
            { x: data.width * 0.6, y: data.height * 0.32 },
            { x: data.width * 0.6, y: data.height * 0.68 },
          ],
        },
        obstacles: data.obstacles || [],
        pillars: data.pillars || [],
        isCustom: true,
      };
    });
  } catch (error) {
    console.warn('Could not load custom stadiums from Firestore:', error);
    return [];
  }
}

/**
 * Updates player aggregate statistics in Firestore
 */
export async function updatePlayerStatsInDatabase(
  playerName: string,
  result: 'win' | 'loss' | 'draw',
  goals: number
) {
  const sanitizedName = playerName.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  const playerId = `player_${sanitizedName}`;
  const path = `leaderboard/${playerId}`;

  try {
    const docRef = doc(db, 'leaderboard', playerId);
    const existingSnap = await getDoc(docRef);

    if (existingSnap.exists()) {
      const current = existingSnap.data() as CloudPlayerStats;
      await setDoc(docRef, {
        id: playerId,
        playerName: playerName.slice(0, 40),
        matchesPlayed: (current.matchesPlayed || 0) + 1,
        wins: (current.wins || 0) + (result === 'win' ? 1 : 0),
        losses: (current.losses || 0) + (result === 'loss' ? 1 : 0),
        draws: (current.draws || 0) + (result === 'draw' ? 1 : 0),
        goalsScored: (current.goalsScored || 0) + goals,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await setDoc(docRef, {
        id: playerId,
        playerName: playerName.slice(0, 40),
        matchesPlayed: 1,
        wins: result === 'win' ? 1 : 0,
        losses: result === 'loss' ? 1 : 0,
        draws: result === 'draw' ? 1 : 0,
        goalsScored: goals,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Gets leaderboard ranking from Firestore
 */
export async function getLeaderboardFromDatabase(maxCount: number = 10): Promise<CloudPlayerStats[]> {
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('wins', 'desc'), limit(maxCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as CloudPlayerStats);
  } catch (error) {
    console.warn('Could not fetch leaderboard:', error);
    return [];
  }
}

/**
 * Creates or updates an active room in Firestore
 */
export async function createRoomInDatabase(room: Room): Promise<boolean> {
  const path = `rooms/${room.id}`;
  try {
    const dataToSave = {
      id: room.id,
      name: room.name.slice(0, 80),
      hostName: room.hostName.slice(0, 50),
      stadiumId: room.stadiumId.slice(0, 50),
      scoreLimit: room.scoreLimit,
      timeLimitMinutes: room.timeLimitMinutes,
      maxPlayers: room.maxPlayers,
      playerCount: room.playerCount,
      isPrivate: Boolean(room.isPrivate),
      password: room.password ? room.password.slice(0, 50) : '',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'rooms', room.id), dataToSave);
    return true;
  } catch (error) {
    console.warn('Erro ao criar sala na base de dados:', error);
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch {
      // Non-fatal
    }
    return false;
  }
}

/**
 * Deletes a room from Firestore (e.g., when match ends or host leaves)
 */
export async function deleteRoomFromDatabase(roomId: string): Promise<boolean> {
  const path = `rooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
    return true;
  } catch (error) {
    console.warn('Erro ao remover sala da base de dados:', error);
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {
      // Non-fatal
    }
    return false;
  }
}

/**
 * Fetches all active rooms from Firestore
 */
export async function getRoomsFromDatabase(): Promise<Room[]> {
  const path = 'rooms';
  try {
    const snapshot = await getDocs(collection(db, 'rooms'));
    return snapshot.docs.map((d) => d.data() as Room);
  } catch (error) {
    console.warn('Could not fetch rooms:', error);
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Return empty
    }
    return [];
  }
}

/**
 * Fetches a single room by ID from Firestore
 */
export async function getRoomByIdFromDatabase(roomId: string): Promise<Room | null> {
  const path = `rooms/${roomId}`;
  try {
    const docSnap = await getDoc(doc(db, 'rooms', roomId));
    if (docSnap.exists()) {
      return docSnap.data() as Room;
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch room by id:', error);
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Return null
    }
    return null;
  }
}

/**
 * Subscribes to real-time room changes from Firestore
 */
export function subscribeToRoomsInDatabase(
  onUpdate: (rooms: Room[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'rooms';
  try {
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const rooms = snapshot.docs.map((d) => d.data() as Room);
        onUpdate(rooms);
      },
      (error) => {
        console.warn('Real-time rooms listener error:', error);
        if (onError) onError(error);
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          // Handled
        }
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Failed to start rooms snapshot listener:', error);
    return () => {};
  }
}

