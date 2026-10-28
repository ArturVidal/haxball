import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Settings as SettingsIcon, Volume2, VolumeX, HelpCircle, Shield, Gamepad2, Database } from 'lucide-react';
import { Ball, ChatMessage, Disc, MatchStats, MatchStatus, ReplayFrame, Room, RoomPlayer, Stadium, Team } from './types/game';
import { STADIUMS } from './physics/stadiums';
import { buildStadiumGeometry, createInitialBall, resetDiscsPositions, stepPhysics } from './physics/engine';
import { updateBotAI } from './physics/ai';
import { sounds } from './audio/soundEngine';
import { testFirestoreConnection } from './lib/firebase';
import {
  saveMatchToDatabase,
  saveCustomStadiumToDatabase,
  updatePlayerStatsInDatabase,
  getCustomStadiumsFromDatabase,
  createRoomInDatabase,
  deleteRoomFromDatabase,
  subscribeToRoomsInDatabase,
  getRoomsFromDatabase,
  getRoomByIdFromDatabase,
  updateRoomHeartbeat,
  updateRoomPlayersInDatabase,
  updateRoomStatusInDatabase,
  subscribeToRoomById,
} from './lib/firestoreService';
import { initHostP2P, initGuestP2P } from './lib/p2pNetwork';


import { GameCanvas } from './components/GameCanvas';
import { Scoreboard } from './components/Scoreboard';
import { RoomLobby } from './components/RoomLobby';
import { RoomBrowser } from './components/RoomBrowser';
import { ChatBox } from './components/ChatBox';
import { TouchControls } from './components/TouchControls';
import { MatchEndModal } from './components/MatchEndModal';
import { SettingsModal } from './components/SettingsModal';
import { ReplayPlayer } from './components/ReplayPlayer';
import { StadiumEditor } from './components/StadiumEditor';
import { DatabaseModal } from './components/DatabaseModal';

const DEFAULT_INITIAL_ROOM: Room = {
  id: 'room-main',
  name: '⚽ Arena Principal',
  hostId: '',
  hostName: '',
  stadiumId: 'classic',
  maxPlayers: 6,
  scoreLimit: 3,
  timeLimitMinutes: 3,
  playerCount: 1,
  status: 'waiting',
};

export default function App() {
  // Navigation View: BROWSER, LOBBY, PLAYING, or EDITOR
  const [currentView, setCurrentView] = useState<'BROWSER' | 'LOBBY' | 'PLAYING' | 'EDITOR'>('BROWSER');

  // Unique Player Profile & User ID
  const [currentUserId] = useState<string>(() => {
    let id = localStorage.getItem('haxball_user_id');
    if (!id) {
      id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem('haxball_user_id', id);
    }
    return id;
  });

  const [playerName, setPlayerName] = useState<string>(() => {
    const saved = localStorage.getItem('haxball_player_name');
    if (saved) return saved;
    const initialName = `Jogador #${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem('haxball_player_name', initialName);
    return initialName;
  });

  const [playerAvatar, setPlayerAvatar] = useState<string>(() => {
    return localStorage.getItem('haxball_player_avatar') || '7';
  });

  // Custom Stadiums
  const [customStadiums, setCustomStadiums] = useState<Stadium[]>(() => {
    try {
      const saved = localStorage.getItem('haxball_custom_stadiums');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const allStadiumsList = [...Object.values(STADIUMS), ...customStadiums];
  const stadiumsMap = allStadiumsList.reduce<Record<string, Stadium>>((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  // Room & Settings (Directly synced with Firestore database - no mock rooms)
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(true);
  const [currentRoom, setCurrentRoom] = useState<Room>(DEFAULT_INITIAL_ROOM);
  const [selectedStadiumId, setSelectedStadiumId] = useState<string>('classic');
  const [timeLimit, setTimeLimit] = useState<number>(3);
  const [scoreLimit, setScoreLimit] = useState<number>(3);
  const [isLocalTwoPlayer, setIsLocalTwoPlayer] = useState<boolean>(false);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Audio & Modals
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Computed: Only the creator of the room has Admin privileges
  const isAdmin = Boolean(
    currentRoom &&
      ((currentRoom.hostId && currentRoom.hostId === currentUserId) ||
        (!currentRoom.hostId && currentRoom.hostName === playerName))
  );

  // Initialize Firebase connection and load cloud custom stadiums
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsFirebaseConnected(connected);
      if (connected) {
        getCustomStadiumsFromDatabase().then((cloudStadiums) => {
          if (cloudStadiums.length > 0) {
            setCustomStadiums((prev) => {
              const ids = new Set(prev.map((s) => s.id));
              const newUnique = cloudStadiums.filter((s) => !ids.has(s.id));
              return [...prev, ...newUnique];
            });
          }
        });
      }
    });
  }, []);

  // Real-time synchronization of active game rooms from Firestore database
  useEffect(() => {
    setIsLoadingRooms(true);
    const unsubscribe = subscribeToRoomsInDatabase(
      (cloudRooms) => {
        setRooms(cloudRooms);
        setIsLoadingRooms(false);
      },
      () => {
        setIsLoadingRooms(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Check URL query parameters for direct room joining (?room=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      getRoomByIdFromDatabase(roomParam).then(async (foundRoom) => {
        if (foundRoom) {
          setCurrentRoom(foundRoom);
          setSelectedStadiumId(foundRoom.stadiumId);
          setScoreLimit(foundRoom.scoreLimit);
          setTimeLimit(foundRoom.timeLimitMinutes);

          // Register user into room's players list if not already there
          const existingPlayers = foundRoom.players || [];
          const isHost = foundRoom.hostId === currentUserId;
          const alreadyJoined = existingPlayers.some((p) => p.id === currentUserId);

          if (!alreadyJoined) {
            const redCount = existingPlayers.filter((p) => p.team === 'red').length;
            const blueCount = existingPlayers.filter((p) => p.team === 'blue').length;
            const assignTeam: Team =
              blueCount < redCount ? 'blue' : redCount < blueCount ? 'red' : 'spectator';

            const guestPlayer: RoomPlayer = {
              id: currentUserId,
              name: playerName,
              avatar: playerAvatar,
              team: assignTeam,
              isHost,
            };
            const updated = [...existingPlayers, guestPlayer];
            foundRoom.players = updated;
            await updateRoomPlayersInDatabase(foundRoom.id, foundRoom.name, updated);
          }

          setCurrentView('LOBBY');
          setChatMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              sender: 'Sistema',
              team: 'system',
              text: `Entraste na sala "${foundRoom.name}" de ${foundRoom.hostName} com o jogador "${playerName}".`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } else {
          // Room does not exist or was closed
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch {}
          setChatMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              sender: 'Sistema',
              team: 'system',
              text: 'A sala indicada no link já não existe ou foi encerrada pelo anfitrião.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      });
    }
  }, [currentUserId, playerName, playerAvatar]);

  // Match State
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('waiting');
  const [redScore, setRedScore] = useState<number>(0);
  const [blueScore, setBlueScore] = useState<number>(0);
  const [timeSeconds, setTimeSeconds] = useState<number>(0);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [lastGoalScorer, setLastGoalScorer] = useState<{
    name: string;
    team: Team;
    speedKmh: number;
  } | null>(null);

  // Match Stats
  const [matchStats, setMatchStats] = useState<MatchStats>({
    redPossessionTicks: 0,
    bluePossessionTicks: 0,
    redShots: 0,
    blueShots: 0,
    redSaves: 0,
    blueSaves: 0,
    goals: [],
  });

  // Discs & Ball
  const [discs, setDiscs] = useState<Disc[]>([
    {
      id: currentUserId,
      name: playerName,
      avatar: playerAvatar,
      team: 'red',
      x: 260,
      y: 200,
      vx: 0,
      vy: 0,
      radius: 15,
      invMass: 0.5,
      damping: 0.96,
      color: '#ef4444',
      avatarColor: '#ffffff',
      isKicking: false,
      kickCooldown: 0,
    },
    {
      id: 'bot-blue-1',
      name: 'Bot Alex',
      avatar: '1',
      team: 'blue',
      x: 580,
      y: 200,
      vx: 0,
      vy: 0,
      radius: 15,
      invMass: 0.5,
      damping: 0.96,
      color: '#3b82f6',
      avatarColor: '#ffffff',
      isKicking: false,
      kickCooldown: 0,
      isBot: true,
      botDifficulty: 'medium',
    },
  ]);

  const [ball, setBall] = useState<Ball>(() => createInitialBall(STADIUMS.classic));

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'Sistema',
      team: 'system',
      text: 'Bem-vindo ao HaxBall Web Arena! Usa WASD ou Setas para mover e Espaço para chutar.',
      timestamp: '12:00',
    },
  ]);

  // Replay
  const replayBufferRef = useRef<ReplayFrame[]>([]);
  const [savedReplay, setSavedReplay] = useState<ReplayFrame[] | null>(null);
  const [isWatchingReplay, setIsWatchingReplay] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [replayPlaying, setReplayPlaying] = useState<boolean>(true);
  const [replaySpeed, setReplaySpeed] = useState<number>(0.5);

  // Keyboard & Touch Inputs
  const keysDownRef = useRef<Set<string>>(new Set());
  const touchDirectionRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const touchKickRef = useRef<boolean>(false);

  // References for Game Loop
  const stadium = stadiumsMap[selectedStadiumId] || STADIUMS.classic;
  const matchStatusRef = useRef(matchStatus);
  matchStatusRef.current = matchStatus;
  const discsRef = useRef(discs);
  discsRef.current = discs;
  const ballRef = useRef(ball);
  ballRef.current = ball;
  const statsRef = useRef(matchStats);
  statsRef.current = matchStats;
  const redScoreRef = useRef(redScore);
  redScoreRef.current = redScore;
  const blueScoreRef = useRef(blueScore);
  blueScoreRef.current = blueScore;
  const timeSecondsRef = useRef(timeSeconds);
  timeSecondsRef.current = timeSeconds;
  const isGoalLockedRef = useRef<boolean>(false);

  // WebRTC P2P Multiplayer References
  const hostP2PRef = useRef<ReturnType<typeof initHostP2P> | null>(null);
  const guestP2PRef = useRef<ReturnType<typeof initGuestP2P> | null>(null);
  const guestInputsRef = useRef<Map<string, { dx: number; dy: number; isKicking: boolean }>>(new Map());

  // Countdown Sequence: Centers ball and positions players
  const startCountdown = useCallback(() => {
    isGoalLockedRef.current = true;
    const currentStadium = stadiumsMap[selectedStadiumId] || STADIUMS.classic;
    const centerBall = createInitialBall(currentStadium);
    setBall(centerBall);
    ballRef.current = centerBall;

    setDiscs((prev) => {
      const cloned = prev.map((d) => ({ ...d }));
      resetDiscsPositions(cloned, currentStadium);
      discsRef.current = cloned;
      return cloned;
    });

    setMatchStatus('countdown');
    matchStatusRef.current = 'countdown';
    sounds.playCountdown(false);
    setCountdownNumber(3);

    const timer3 = setTimeout(() => {
      sounds.playCountdown(false);
      setCountdownNumber(2);
    }, 1000);

    const timer2 = setTimeout(() => {
      sounds.playCountdown(false);
      setCountdownNumber(1);
    }, 2000);

    const timer1 = setTimeout(() => {
      sounds.playCountdown(true);
      setCountdownNumber(0);
    }, 3000);

    const timerStart = setTimeout(() => {
      sounds.playWhistle(false);
      setCountdownNumber(null);
      setMatchStatus('playing');
      matchStatusRef.current = 'playing';
      isGoalLockedRef.current = false;
    }, 3600);

    return () => {
      clearTimeout(timer3);
      clearTimeout(timer2);
      clearTimeout(timer1);
      clearTimeout(timerStart);
    };
  }, [selectedStadiumId, stadiumsMap]);

  // Reset ball and players to kickoff
  const resetKickoff = useCallback(
    (nextScorer?: { name: string; team: Team; speedKmh: number }) => {
      isGoalLockedRef.current = true;
      if (nextScorer) {
        setLastGoalScorer(nextScorer);
        setMatchStatus('goal_scored');
        matchStatusRef.current = 'goal_scored';
        setTimeout(() => {
          setLastGoalScorer(null);
          startCountdown();
        }, 2200);
      } else {
        startCountdown();
      }
    },
    [startCountdown]
  );

  // Sync player profile with disc
  useEffect(() => {
    setDiscs((prev) =>
      prev.map((d) =>
        d.id === currentUserId ? { ...d, name: playerName, avatar: playerAvatar } : d
      )
    );
  }, [playerName, playerAvatar, currentUserId]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      keysDownRef.current.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Heartbeat & automatic room deletion on tab close / window unload for Room Host
  useEffect(() => {
    if (!currentRoom?.id || currentRoom.id === 'room-main') return;
    if (!isAdmin) return;

    // 1. Regular heartbeat every 5 seconds so room stays active in listing
    const interval = setInterval(() => {
      updateRoomHeartbeat(currentRoom.id, currentRoom.name, currentRoom.playerCount || 1);
    }, 5000);

    // 2. On browser tab close or window unload: delete room immediately
    const handleBeforeUnload = () => {
      deleteRoomFromDatabase(currentRoom.id);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentRoom?.id, currentRoom?.name, currentRoom?.playerCount, isAdmin]);

  // WebRTC P2P Multiplayer Networking Lifecycle
  useEffect(() => {
    if (!currentRoom?.id || currentRoom.id === 'room-main') return;

    if (isAdmin) {
      // Host side: listens for guest signals and receives their inputs
      const hostP2P = initHostP2P(currentRoom.id, {
        onGuestInput: (input) => {
          guestInputsRef.current.set(input.playerId, {
            dx: input.dx,
            dy: input.dy,
            isKicking: input.isKicking,
          });
        },
        onGuestConnected: () => {
          setChatMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              sender: 'Sistema',
              team: 'system',
              text: 'Ligação P2P em tempo real estabelecida com sucesso!',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        },
      });
      hostP2PRef.current = hostP2P;
      return () => {
        hostP2P.cleanup();
        hostP2PRef.current = null;
      };
    } else {
      // Guest side: sends inputs to host and updates game state
      const guestP2P = initGuestP2P(currentRoom.id, currentUserId, {
        onStateUpdate: (state) => {
          ballRef.current = { ...ballRef.current, ...state.ball };
          setBall((prev) => ({ ...prev, ...state.ball }));

          setDiscs((prev) =>
            prev.map((d) => {
              const remote = state.discs.find((rd) => rd.id === d.id);
              if (remote) {
                return {
                  ...d,
                  x: remote.x,
                  y: remote.y,
                  vx: remote.vx,
                  vy: remote.vy,
                  isKicking: remote.isKicking,
                };
              }
              return d;
            })
          );

          redScoreRef.current = state.redScore;
          setRedScore(state.redScore);
          blueScoreRef.current = state.blueScore;
          setBlueScore(state.blueScore);
          timeSecondsRef.current = state.timeSeconds;
          setTimeSeconds(state.timeSeconds);
          if (state.matchStatus && state.matchStatus !== matchStatusRef.current) {
            matchStatusRef.current = state.matchStatus as MatchStatus;
            setMatchStatus(state.matchStatus as MatchStatus);
          }
          setCountdownNumber(state.countdownNumber);
          if (state.lastGoalScorer !== undefined) {
            setLastGoalScorer(state.lastGoalScorer as any);
          }
        },
        onStartMatch: () => {
          isGoalLockedRef.current = true;
          setCurrentView('PLAYING');
          setRedScore(0);
          redScoreRef.current = 0;
          setBlueScore(0);
          blueScoreRef.current = 0;
          setTimeSeconds(0);
          timeSecondsRef.current = 0;
          startCountdown();
        },
        onReturnToLobby: () => {
          setCurrentView('LOBBY');
          setMatchStatus('waiting');
        },
      });
      guestP2PRef.current = guestP2P;
      return () => {
        guestP2P.cleanup();
        guestP2PRef.current = null;
      };
    }
  }, [currentRoom?.id, isAdmin, currentUserId, startCountdown]);

  // Real-time synchronization of room lobby players, settings, and match status
  useEffect(() => {
    if (!currentRoom?.id || currentRoom.id === 'room-main') {
      return;
    }

    const unsubscribe = subscribeToRoomById(currentRoom.id, (cloudRoom) => {
      if (!cloudRoom) {
        // Room was closed or deleted by host!
        if (!isAdmin) {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch {}
          setCurrentView('BROWSER');
          setChatMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              sender: 'Sistema',
              team: 'system',
              text: 'A sala foi encerrada pelo anfitrião.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
        return;
      }

      setCurrentRoom(cloudRoom);
      if (cloudRoom.stadiumId) setSelectedStadiumId(cloudRoom.stadiumId);
      if (cloudRoom.scoreLimit !== undefined) setScoreLimit(cloudRoom.scoreLimit);
      if (cloudRoom.timeLimitMinutes !== undefined) setTimeLimit(cloudRoom.timeLimitMinutes);

      // Trigger match start for guest when host starts match (guaranteed fallback over database)
      if (cloudRoom.status === 'playing' && currentView === 'LOBBY' && !isAdmin) {
        isGoalLockedRef.current = true;
        setCurrentView('PLAYING');
        setRedScore(0);
        redScoreRef.current = 0;
        setBlueScore(0);
        blueScoreRef.current = 0;
        setTimeSeconds(0);
        timeSecondsRef.current = 0;
        startCountdown();
      } else if (cloudRoom.status === 'waiting' && currentView === 'PLAYING' && !isAdmin) {
        setCurrentView('LOBBY');
        setMatchStatus('waiting');
      }

      if (cloudRoom.players && cloudRoom.players.length > 0) {
        setDiscs((prevDiscs) => {
          return cloudRoom.players!.map((p) => {
            const existing = prevDiscs.find((d) => d.id === p.id);
            const teamColor = p.team === 'red' ? '#ef4444' : p.team === 'blue' ? '#3b82f6' : '#64748b';
            if (existing) {
              return {
                ...existing,
                name: p.name,
                avatar: p.avatar,
                team: p.team,
                color: teamColor,
                isBot: Boolean(p.isBot),
                botDifficulty: p.botDifficulty,
              };
            }
            return {
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              team: p.team,
              x: p.team === 'red' ? 260 : p.team === 'blue' ? 580 : 420,
              y: 200,
              vx: 0,
              vy: 0,
              radius: 15,
              invMass: 0.5,
              damping: 0.96,
              color: teamColor,
              avatarColor: '#ffffff',
              isKicking: false,
              kickCooldown: 0,
              isBot: Boolean(p.isBot),
              botDifficulty: p.botDifficulty,
            };
          });
        });
      }
    });

    return () => unsubscribe();
  }, [currentView, currentRoom?.id, isAdmin, startCountdown]);


  // Match Start Trigger: Starts local match and notifies remote guests over WebRTC and Firestore
  const handleStartMatch = () => {
    isGoalLockedRef.current = true;
    setCurrentView('PLAYING');
    setRedScore(0);
    redScoreRef.current = 0;
    setBlueScore(0);
    blueScoreRef.current = 0;
    setTimeSeconds(0);
    timeSecondsRef.current = 0;
    setMatchStats({
      redPossessionTicks: 0,
      bluePossessionTicks: 0,
      redShots: 0,
      blueShots: 0,
      redSaves: 0,
      blueSaves: 0,
      goals: [],
    });
    statsRef.current = {
      redPossessionTicks: 0,
      bluePossessionTicks: 0,
      redShots: 0,
      blueShots: 0,
      redSaves: 0,
      blueSaves: 0,
      goals: [],
    };
    replayBufferRef.current = [];

    // Notify connected guests over WebRTC and Firestore database so match starts on all devices
    if (isAdmin && currentRoom?.id && currentRoom.id !== 'room-main') {
      hostP2PRef.current?.broadcastMessage({ type: 'START_MATCH' });
      updateRoomStatusInDatabase(
        currentRoom.id,
        currentRoom.name,
        'playing',
        currentRoom.playerCount || 1
      );
    }

    startCountdown();
  };

  // Exit Match to Lobby Trigger
  const handleExitToLobby = () => {
    if (isAdmin && currentRoom?.id && currentRoom.id !== 'room-main') {
      hostP2PRef.current?.broadcastMessage({ type: 'RETURN_TO_LOBBY' });
      updateRoomStatusInDatabase(
        currentRoom.id,
        currentRoom.name,
        'waiting',
        currentRoom.playerCount || 1
      );
    }
    setCurrentView('LOBBY');
    setMatchStatus('waiting');
  };


  // Replay frame playback loop
  useEffect(() => {
    if (!isWatchingReplay || !savedReplay || savedReplay.length === 0) return;

    let animId: number;
    let lastTime = performance.now();
    const frameInterval = 1000 / (60 * replaySpeed);

    const replayLoop = (time: number) => {
      if (replayPlaying && time - lastTime >= frameInterval) {
        lastTime = time;
        setReplayIndex((prev) => {
          const next = prev + 1;
          if (next >= savedReplay.length) {
            return 0; // loop replay
          }
          return next;
        });
      }
      animId = requestAnimationFrame(replayLoop);
    };

    animId = requestAnimationFrame(replayLoop);
    return () => cancelAnimationFrame(animId);
  }, [isWatchingReplay, savedReplay, replayPlaying, replaySpeed]);

  // Main 60FPS Game Physics Loop
  useEffect(() => {
    if (currentView !== 'PLAYING' || isWatchingReplay) return;

    let animId: number;
    const currentStadium = stadiumsMap[selectedStadiumId] || STADIUMS.classic;
    const geo = buildStadiumGeometry(currentStadium);

    const tick = () => {
      const status = matchStatusRef.current;
      const currentBall = ballRef.current;
      const currentDiscs = discsRef.current;
      const keys = keysDownRef.current;
      const touchDir = touchDirectionRef.current;
      const touchKick = touchKickRef.current;

      if (status === 'playing' || status === 'countdown') {
        const isCountdown = status === 'countdown';

        // 1. Process Human Player Inputs
        currentDiscs.forEach((disc) => {
          if (disc.team === 'spectator') return;

          // Player 1 (User / Red by default)
          if (disc.id === currentUserId) {
            let dx = 0;
            let dy = 0;
            // WASD controls
            if (keys.has('KeyW') || keys.has('KeyW'.toLowerCase())) dy -= 1;
            if (keys.has('KeyS') || keys.has('KeyS'.toLowerCase())) dy += 1;
            if (keys.has('KeyA') || keys.has('KeyA'.toLowerCase())) dx -= 1;
            if (keys.has('KeyD') || keys.has('KeyD'.toLowerCase())) dx += 1;

            // Arrow keys controls (also available unless 2-player local split is active)
            if (!isLocalTwoPlayer) {
              if (keys.has('ArrowUp')) dy -= 1;
              if (keys.has('ArrowDown')) dy += 1;
              if (keys.has('ArrowLeft')) dx -= 1;
              if (keys.has('ArrowRight')) dx += 1;
            }

            // Touch inputs
            if (touchDir.dx !== 0 || touchDir.dy !== 0) {
              dx = touchDir.dx;
              dy = touchDir.dy;
            }

            if (dx !== 0 && dy !== 0) {
              const len = Math.hypot(dx, dy);
              dx /= len;
              dy /= len;
            }

            const isKicking =
              keys.has('Space') ||
              keys.has('KeyX') ||
              keys.has('KeyK') ||
              keys.has('ControlLeft') ||
              (!isLocalTwoPlayer &&
                (keys.has('Enter') ||
                  keys.has('Numpad0') ||
                  keys.has('ShiftRight') ||
                  keys.has('KeyM'))) ||
              touchKick;

            disc.vx += dx * 0.11;
            disc.vy += dy * 0.11;
            disc.isKicking = isKicking;

            // If playing as guest in an online match, stream input to host over WebRTC
            if (!isAdmin && guestP2PRef.current) {
              guestP2PRef.current.sendInput(dx, dy, isKicking);
            }
          }

          // Player 2 (Local Multiplayer Mode - Blue team control via Arrows & Enter)
          else if (isLocalTwoPlayer && disc.team === 'blue' && !disc.isBot) {
            let dx = 0;
            let dy = 0;
            if (keys.has('ArrowUp')) dy -= 1;
            if (keys.has('ArrowDown')) dy += 1;
            if (keys.has('ArrowLeft')) dx -= 1;
            if (keys.has('ArrowRight')) dx += 1;

            if (dx !== 0 && dy !== 0) {
              const len = Math.hypot(dx, dy);
              dx /= len;
              dy /= len;
            }

            const isKicking =
              keys.has('Enter') ||
              keys.has('Numpad0') ||
              keys.has('ShiftRight') ||
              keys.has('KeyM');

            disc.vx += dx * 0.11;
            disc.vy += dy * 0.11;
            disc.isKicking = isKicking;
          }

          // Remote Online Human Player (inputs streamed via P2P WebRTC to Host)
          else if (!isLocalTwoPlayer && !disc.isBot) {
            const remoteInput = guestInputsRef.current.get(disc.id);
            if (remoteInput) {
              disc.vx += remoteInput.dx * 0.11;
              disc.vy += remoteInput.dy * 0.11;
              disc.isKicking = remoteInput.isKicking;
            }
          }

          // Bot AI
          else if (disc.isBot) {
            updateBotAI(disc, currentDiscs, currentBall, currentStadium, geo, isCountdown);
          }
        });

        // 2. Step Physics Engine with Goal Lock flag
        const result = stepPhysics(
          currentDiscs,
          currentBall,
          currentStadium,
          geo,
          isCountdown,
          statsRef.current,
          isGoalLockedRef.current
        );

        // 3. Broadcast authoritative state from Host to connected guests over WebRTC
        if (isAdmin && hostP2PRef.current) {
          hostP2PRef.current.broadcastState({
            type: 'STATE',
            ball: {
              x: currentBall.x,
              y: currentBall.y,
              vx: currentBall.vx,
              vy: currentBall.vy,
            },
            discs: currentDiscs.map((d) => ({
              id: d.id,
              x: d.x,
              y: d.y,
              vx: d.vx,
              vy: d.vy,
              isKicking: d.isKicking,
            })),
            redScore: redScoreRef.current,
            blueScore: blueScoreRef.current,
            timeSeconds: timeSecondsRef.current,
            matchStatus: matchStatusRef.current,
            countdownNumber,
            lastGoalScorer,
          });
        }

        // 4. Record frame in rolling replay buffer (last ~240 frames = 4 seconds)
        replayBufferRef.current.push({
          ball: {
            x: currentBall.x,
            y: currentBall.y,
            vx: currentBall.vx,
            vy: currentBall.vy,
          },

          players: currentDiscs.map((d) => ({
            id: d.id,
            x: d.x,
            y: d.y,
            isKicking: d.isKicking,
            team: d.team,
          })),
        });
        if (replayBufferRef.current.length > 240) {
          replayBufferRef.current.shift();
        }

        // 4. Handle Goal Scored (strictly once per goal event)
        if (result.goalScored && status === 'playing' && !isGoalLockedRef.current) {
          isGoalLockedRef.current = true;
          matchStatusRef.current = 'goal_scored';
          setMatchStatus('goal_scored');

          // Soften ball motion so it rests inside the goal net
          currentBall.vx *= 0.2;
          currentBall.vy *= 0.2;

          const scoringTeam = result.goalScored;
          sounds.playGoalCelebration();

          const scorerDisc = currentDiscs.find(
            (d) => d.id === currentBall.lastTouchPlayerId && d.team === scoringTeam
          ) || currentDiscs.find((d) => d.team === scoringTeam);

          const scorerName = scorerDisc ? scorerDisc.name : scoringTeam === 'red' ? 'Vermelho' : 'Azul';

          const goalInfo = {
            name: scorerName,
            scorerName,
            team: scoringTeam,
            timeSeconds: timeSecondsRef.current,
            speedKmh: result.goalSpeedKmh || 45,
          };

          // Save replay snapshot
          setSavedReplay([...replayBufferRef.current]);

          // Update Score once
          let newRedScore = redScoreRef.current;
          let newBlueScore = blueScoreRef.current;
          if (scoringTeam === 'red') {
            newRedScore++;
            redScoreRef.current = newRedScore;
            setRedScore(newRedScore);
          } else {
            newBlueScore++;
            blueScoreRef.current = newBlueScore;
            setBlueScore(newBlueScore);
          }

          // Add goal to stats
          statsRef.current.goals.push(goalInfo);

          // Add chat announcement
          setChatMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              sender: 'GOLO',
              team: 'system',
              text: `GOLO da Equipa ${scoringTeam === 'red' ? 'Vermelha' : 'Azul'}! Marcado por ${scorerName} (${result.goalSpeedKmh} km/h).`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);

          // Check Score Limit
          if (scoreLimit > 0 && (newRedScore >= scoreLimit || newBlueScore >= scoreLimit)) {
            setLastGoalScorer(goalInfo);
            setTimeout(() => {
              matchStatusRef.current = 'ended';
              setMatchStatus('ended');

              // Save match record to Firestore Database
              saveMatchToDatabase(
                currentRoom.name,
                currentStadium,
                newRedScore,
                newBlueScore,
                timeSecondsRef.current,
                statsRef.current,
                playerName
              );

              const userDisc = currentDiscs.find((d) => d.id === currentUserId);
              const userWon =
                userDisc &&
                ((scoringTeam === 'red' && userDisc.team === 'red') ||
                  (scoringTeam === 'blue' && userDisc.team === 'blue'));

              updatePlayerStatsInDatabase(
                playerName,
                userWon ? 'win' : 'loss',
                statsRef.current.goals.filter((g) => g.scorerName === playerName).length
              );
            }, 2400);
          } else {
            resetKickoff(goalInfo);
          }
        }
      }

      // Re-trigger React render
      setDiscs([...currentDiscs]);
      setBall({ ...currentBall });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [currentView, selectedStadiumId, isLocalTwoPlayer, scoreLimit, resetKickoff, isWatchingReplay, currentUserId, currentRoom.name, playerName, stadiumsMap]);

  // Match Seconds Clock Timer
  useEffect(() => {
    if (matchStatus !== 'playing') return;

    const interval = setInterval(() => {
      setTimeSeconds((prev) => {
        const next = prev + 1;
        timeSecondsRef.current = next;

        // Check Time Limit
        if (timeLimit > 0 && next >= timeLimit * 60) {
          sounds.playWhistle(true);
          matchStatusRef.current = 'ended';
          setMatchStatus('ended');

          // Save match to Firestore
          const currentStadium = stadiumsMap[selectedStadiumId] || STADIUMS.classic;
          const finalRed = redScoreRef.current;
          const finalBlue = blueScoreRef.current;

          saveMatchToDatabase(
            currentRoom.name,
            currentStadium,
            finalRed,
            finalBlue,
            next,
            statsRef.current,
            playerName
          );

          const userDisc = discsRef.current.find((d) => d.id === currentUserId);
          const userWon =
            userDisc &&
            ((finalRed > finalBlue && userDisc.team === 'red') ||
              (finalBlue > finalRed && userDisc.team === 'blue'));
          const isDraw = finalRed === finalBlue;

          updatePlayerStatsInDatabase(
            playerName,
            isDraw ? 'draw' : userWon ? 'win' : 'loss',
            statsRef.current.goals.filter((g) => g.scorerName === playerName).length
          );
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [matchStatus, timeLimit, currentRoom.name, currentUserId, playerName, selectedStadiumId, stadiumsMap]);

  // Chat message send handler
  const handleSendMessage = (text: string) => {
    const userDisc = discs.find((d) => d.id === currentUserId);
    const userTeam = userDisc ? userDisc.team : 'spectator';

    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: playerName,
        team: userTeam,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // Bot automated conversational response
    if (Math.random() > 0.4) {
      setTimeout(() => {
        const botResponses = [
          'Bem jogado!',
          'Cuidado com a tabela!',
          'Grande remate!',
          'Defende a baliza!',
          'Passa!',
          'gg!',
        ];
        const randomResp = botResponses[Math.floor(Math.random() * botResponses.length)];
        const activeBot = discs.find((d) => d.isBot);
        if (activeBot) {
          setChatMessages((p) => [
            ...p,
            {
              id: String(Date.now()),
              sender: activeBot.name,
              team: activeBot.team,
              text: randomResp,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]);
        }
      }, 1200);
    }
  };

  // Helper to synchronize lobby discs/players with Firestore
  const syncDiscsToFirestore = useCallback(
    (updatedDiscs: Disc[]) => {
      if (!currentRoom?.id || currentRoom.id === 'room-main') return;
      const roomPlayers: RoomPlayer[] = updatedDiscs.map((d) => ({
        id: d.id,
        name: d.name,
        avatar: d.avatar,
        team: d.team,
        isBot: Boolean(d.isBot),
        botDifficulty: d.botDifficulty,
        isHost: Boolean(
          (currentRoom.hostId && d.id === currentRoom.hostId) ||
          (!currentRoom.hostId && d.name === currentRoom.hostName)
        ),
      }));
      updateRoomPlayersInDatabase(currentRoom.id, currentRoom.name, roomPlayers);
    },
    [currentRoom?.id, currentRoom?.name, currentRoom?.hostId, currentRoom?.hostName]
  );

  // Team Management Handlers
  const handleJoinTeam = (team: Team) => {
    setDiscs((prev) => {
      const next = prev.map((d) => {
        if (d.id === currentUserId) {
          return {
            ...d,
            team,
            color: team === 'red' ? '#ef4444' : team === 'blue' ? '#3b82f6' : '#64748b',
          };
        }
        return d;
      });
      syncDiscsToFirestore(next);
      return next;
    });
  };

  const handleAddBot = (team: 'red' | 'blue') => {
    const botCount = discs.filter((d) => d.isBot).length;
    const names = ['Bruno', 'Cristiano', 'Rafa', 'Bernardo', 'Rúben', 'Diogo', 'Félix'];
    const botName = `Bot ${names[botCount % names.length]}`;
    const newBot: Disc = {
      id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: botName,
      avatar: String(botCount + 2),
      team,
      x: team === 'red' ? 340 : 500,
      y: 200,
      vx: 0,
      vy: 0,
      radius: 15,
      invMass: 0.5,
      damping: 0.96,
      color: team === 'red' ? '#ef4444' : '#3b82f6',
      avatarColor: '#ffffff',
      isKicking: false,
      kickCooldown: 0,
      isBot: true,
      botDifficulty,
    };
    setDiscs((prev) => {
      const next = [...prev, newBot];
      syncDiscsToFirestore(next);
      return next;
    });
  };

  const handleRemoveBot = (discId: string) => {
    setDiscs((prev) => {
      const next = prev.filter((d) => d.id !== discId);
      syncDiscsToFirestore(next);
      return next;
    });
  };

  // Admin Move Player Handler (Drag & Drop or Direct Assign)
  const handleMovePlayer = (playerId: string, targetTeam: Team) => {
    setDiscs((prev) => {
      const next = prev.map((d) => {
        if (d.id === playerId) {
          return {
            ...d,
            team: targetTeam,
            color: targetTeam === 'red' ? '#ef4444' : targetTeam === 'blue' ? '#3b82f6' : '#64748b',
          };
        }
        return d;
      });
      syncDiscsToFirestore(next);
      return next;
    });

    const movedDisc = discs.find((d) => d.id === playerId);
    if (movedDisc) {
      const teamLabel =
        targetTeam === 'red'
          ? 'Equipa Vermelha'
          : targetTeam === 'blue'
          ? 'Equipa Azul'
          : 'Espectadores';
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'Admin',
          team: 'system',
          text: `${movedDisc.name} foi movido para ${teamLabel} pelo anfitrião.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Save Custom Stadium from Editor
  const handleSaveCustomStadium = (newStadium: Stadium) => {
    setCustomStadiums((prev) => {
      const filtered = prev.filter((s) => s.id !== newStadium.id);
      const updated = [...filtered, newStadium];
      localStorage.setItem('haxball_custom_stadiums', JSON.stringify(updated));
      return updated;
    });

    // Save to Firebase Firestore database
    saveCustomStadiumToDatabase(newStadium, playerName).catch((err) => {
      console.warn('Erro ao guardar estádio no Firestore:', err);
    });

    setSelectedStadiumId(newStadium.id);
    setCurrentView('LOBBY');
    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'Sistema',
        team: 'system',
        text: `Estádio "${newStadium.name}" guardado na base de dados e selecionado!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Quick Play Jump
  const handleQuickPlay = () => {
    // 1v1 on Classic Stadium with 3 goals limit
    setSelectedStadiumId('classic');
    setScoreLimit(3);
    setTimeLimit(3);
    setIsLocalTwoPlayer(false);
    setDiscs([
      {
        id: currentUserId,
        name: playerName,
        avatar: playerAvatar,
        team: 'red',
        x: 260,
        y: 200,
        vx: 0,
        vy: 0,
        radius: 15,
        invMass: 0.5,
        damping: 0.96,
        color: '#ef4444',
        avatarColor: '#ffffff',
        isKicking: false,
        kickCooldown: 0,
      },
      {
        id: 'bot-pro',
        name: 'Bot Ronaldo',
        avatar: '9',
        team: 'blue',
        x: 580,
        y: 200,
        vx: 0,
        vy: 0,
        radius: 15,
        invMass: 0.5,
        damping: 0.96,
        color: '#3b82f6',
        avatarColor: '#ffffff',
        isKicking: false,
        kickCooldown: 0,
        isBot: true,
        botDifficulty: 'hard',
      },
    ]);
    handleStartMatch();
  };

  // Current display discs/ball for replay or live match
  let displayBall = ball;
  let displayDiscs = discs;

  if (isWatchingReplay && savedReplay && savedReplay[replayIndex]) {
    const frame = savedReplay[replayIndex];
    displayBall = {
      ...ball,
      x: frame.ball.x,
      y: frame.ball.y,
      vx: frame.ball.vx,
      vy: frame.ball.vy,
    };
    displayDiscs = discs.map((d) => {
      const pFrame = frame.players.find((pf) => pf.id === d.id);
      if (pFrame) {
        return {
          ...d,
          x: pFrame.x,
          y: pFrame.y,
          isKicking: pFrame.isKicking,
        };
      }
      return d;
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* 1. Mandatory Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setCurrentView('BROWSER')}
          className="text-lg font-black tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs">
            ⚽
          </div>
          <span>HaxBall Arena</span>
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <button
            onClick={() => setCurrentView('BROWSER')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'BROWSER' ? 'text-emerald-400' : ''
            }`}
          >
            Lista de Salas
          </button>
          <button
            onClick={() => setCurrentView('LOBBY')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'LOBBY' ? 'text-emerald-400' : ''
            }`}
          >
            Configurar Partida
          </button>
          <button
            onClick={() => setCurrentView('EDITOR')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'EDITOR' ? 'text-emerald-400' : ''
            }`}
          >
            Editor de Estádios
          </button>
          <button
            onClick={() => setShowDatabaseModal(true)}
            className="flex items-center gap-1.5 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-300 hover:text-emerald-300"
          >
            <Database size={13} className="text-emerald-400" />
            <span>Base de Dados</span>
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Como Jogar
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowDatabaseModal(true)}
            title="Base de Dados Firebase"
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Database size={16} className="text-emerald-400" />
          </button>

          <button
            onClick={() => {
              const muted = sounds.toggleMute();
              setIsMuted(muted);
            }}
            title={isMuted ? 'Ativar Som' : 'Desativar Som'}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <SettingsIcon size={14} />
            <span>{playerName}</span>
          </button>

          <button
            onClick={handleQuickPlay}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-transform active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Jogar Agora
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start p-3 md:p-6 w-full max-w-7xl mx-auto">
        {/* VIEW 1: ROOM BROWSER */}
        {currentView === 'BROWSER' && (
          <RoomBrowser
            rooms={rooms}
            stadiumsList={allStadiumsList}
            onOpenStadiumEditor={() => setCurrentView('EDITOR')}
            onJoinRoom={async (room) => {
              setCurrentRoom(room);
              setSelectedStadiumId(room.stadiumId);
              setScoreLimit(room.scoreLimit);
              setTimeLimit(room.timeLimitMinutes);

              // Register player into room players in database if not already there
              const existingPlayers = room.players || [];
              const isHost = room.hostId ? room.hostId === currentUserId : room.hostName === playerName;
              const alreadyIn = existingPlayers.some((p) => p.id === currentUserId);
              if (!alreadyIn) {
                const redCount = existingPlayers.filter((p) => p.team === 'red').length;
                const blueCount = existingPlayers.filter((p) => p.team === 'blue').length;
                const assignTeam: Team =
                  blueCount < redCount ? 'blue' : redCount < blueCount ? 'red' : 'spectator';
                const guestPlayer: RoomPlayer = {
                  id: currentUserId,
                  name: playerName,
                  avatar: playerAvatar,
                  team: assignTeam,
                  isHost,
                };
                const updated = [...existingPlayers, guestPlayer];
                room.players = updated;
                await updateRoomPlayersInDatabase(room.id, room.name, updated);
              }

              setCurrentView('LOBBY');
              try {
                window.history.replaceState(
                  {},
                  '',
                  `${window.location.pathname}?room=${encodeURIComponent(room.id)}`
                );
              } catch {}
            }}
            onCreateRoom={async (data) => {
              const newRoomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
              const hostPlayer: RoomPlayer = {
                id: currentUserId,
                name: playerName,
                avatar: playerAvatar,
                team: 'red',
                isHost: true,
              };
              const newRoom: Room = {
                id: newRoomId,
                name: data.name,
                hostId: currentUserId,
                hostName: playerName,
                stadiumId: data.stadiumId,
                scoreLimit: data.scoreLimit,
                timeLimitMinutes: data.timeLimitMinutes,
                maxPlayers: data.maxPlayers,
                password: data.password,
                isPrivate: Boolean(data.password),
                playerCount: 1,
                status: 'waiting',
                players: [hostPlayer],
                lastActive: Date.now(),
                createdAt: new Date().toISOString(),
              };
              setDiscs([
                {
                  id: currentUserId,
                  name: playerName,
                  avatar: playerAvatar,
                  team: 'red',
                  x: 260,
                  y: 200,
                  vx: 0,
                  vy: 0,
                  radius: 15,
                  invMass: 0.5,
                  damping: 0.96,
                  color: '#ef4444',
                  avatarColor: '#ffffff',
                  isKicking: false,
                  kickCooldown: 0,
                },
              ]);
              setRooms((prev) => [newRoom, ...prev.filter((r) => r.id !== newRoom.id)]);
              setCurrentRoom(newRoom);
              setSelectedStadiumId(data.stadiumId);
              setScoreLimit(data.scoreLimit);
              setTimeLimit(data.timeLimitMinutes);
              setCurrentView('LOBBY');
              try {
                window.history.replaceState(
                  {},
                  '',
                  `${window.location.pathname}?room=${encodeURIComponent(newRoom.id)}`
                );
              } catch {}
              await createRoomInDatabase(newRoom);
            }}
            isLoading={isLoadingRooms}
            onRefresh={() => {
              setIsLoadingRooms(true);
              getRoomsFromDatabase().then((r) => {
                setRooms(r);
                setIsLoadingRooms(false);
              });
            }}
            onQuickPlay={handleQuickPlay}
          />
        )}

        {/* VIEW 2: ROOM LOBBY */}
        {currentView === 'LOBBY' && (
          <RoomLobby
            room={currentRoom}
            currentUserId={currentUserId}
            playerName={playerName}
            isAdmin={isAdmin}
            discs={discs}
            selectedStadiumId={selectedStadiumId}
            stadiumsList={allStadiumsList}
            onOpenStadiumEditor={() => setCurrentView('EDITOR')}
            timeLimit={timeLimit}
            scoreLimit={scoreLimit}
            isLocalTwoPlayer={isLocalTwoPlayer}
            botDifficulty={botDifficulty}
            onSelectStadium={(stadiumId) => {
              setSelectedStadiumId(stadiumId);
              if (isAdmin && currentRoom.id && currentRoom.id !== 'room-main') {
                updateRoomPlayersInDatabase(currentRoom.id, currentRoom.name, currentRoom.players || []);
              }
            }}
            onSelectTimeLimit={setTimeLimit}
            onSelectScoreLimit={setScoreLimit}
            onToggleLocalTwoPlayer={(enabled) => {
              setIsLocalTwoPlayer(enabled);
              if (enabled) {
                // Ensure there is a 2nd player on blue team
                setDiscs((prev) => {
                  const hasBlueHuman = prev.some((d) => d.team === 'blue' && !d.isBot);
                  if (!hasBlueHuman) {
                    const nonBots = prev.filter((d) => !d.isBot);
                    const bots = prev.filter((d) => d.isBot);
                    const p2: Disc = {
                      id: 'player-2-local',
                      name: 'Jogador 2',
                      avatar: '2',
                      team: 'blue',
                      x: 580,
                      y: 200,
                      vx: 0,
                      vy: 0,
                      radius: 15,
                      invMass: 0.5,
                      damping: 0.96,
                      color: '#3b82f6',
                      avatarColor: '#ffffff',
                      isKicking: false,
                      kickCooldown: 0,
                    };
                    return [...nonBots, p2, ...bots];
                  }
                  return prev;
                });
              }
            }}
            onSelectBotDifficulty={(diff) => {
              setBotDifficulty(diff);
              setDiscs((prev) =>
                prev.map((d) => (d.isBot ? { ...d, botDifficulty: diff } : d))
              );
            }}
            onJoinTeam={handleJoinTeam}
            onMovePlayer={handleMovePlayer}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
            onStartMatch={handleStartMatch}
            onLeaveRoom={async () => {
              try {
                window.history.replaceState({}, '', window.location.pathname);
              } catch {}
              if (isAdmin) {
                await deleteRoomFromDatabase(currentRoom.id);
              } else if (currentRoom.id && currentRoom.id !== 'room-main') {
                const remaining = (currentRoom.players || []).filter((p) => p.id !== currentUserId);
                await updateRoomPlayersInDatabase(currentRoom.id, currentRoom.name, remaining);
              }
              setCurrentView('BROWSER');
            }}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
        )}

        {/* VIEW 4: STADIUM EDITOR */}
        {currentView === 'EDITOR' && (
          <StadiumEditor
            initialStadium={stadiumsMap[selectedStadiumId] || STADIUMS.classic}
            onSaveStadium={handleSaveCustomStadium}
            onCancel={() => setCurrentView('LOBBY')}
          />
        )}

        {/* VIEW 3: ACTIVE PLAYING ARENA */}
        {currentView === 'PLAYING' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-4">
            {/* Scoreboard */}
            <Scoreboard
              redScore={redScore}
              blueScore={blueScore}
              timeSeconds={timeSeconds}
              scoreLimit={scoreLimit}
              timeLimitMinutes={timeLimit}
              matchStatus={matchStatus}
              isMuted={isMuted}
              stats={matchStats}
              onToggleMute={() => {
                const muted = sounds.toggleMute();
                setIsMuted(muted);
              }}
              onTogglePause={() => {
                setMatchStatus((prev) => (prev === 'playing' ? 'waiting' : 'playing'));
              }}
              onRestartMatch={handleStartMatch}
              onExitToLobby={handleExitToLobby}
            />


            {/* Replay Controls (if active) */}
            {isWatchingReplay && savedReplay && (
              <ReplayPlayer
                isPlaying={replayPlaying}
                playbackSpeed={replaySpeed}
                currentFrame={replayIndex}
                totalFrames={savedReplay.length}
                onTogglePlay={() => setReplayPlaying((p) => !p)}
                onChangeSpeed={setReplaySpeed}
                onClose={() => setIsWatchingReplay(false)}
              />
            )}

            {/* Canvas Field */}
            <GameCanvas
              stadium={stadium}
              discs={displayDiscs}
              ball={displayBall}
              matchStatus={matchStatus}
              countdownNumber={countdownNumber}
              lastGoalScorer={lastGoalScorer}
              isReplay={isWatchingReplay}
            />

            {/* Touch Controls (Mobile / Tablet) */}
            <TouchControls
              onDirectionChange={(dx, dy) => {
                touchDirectionRef.current = { dx, dy };
              }}
              onKickChange={(k) => {
                touchKickRef.current = k;
              }}
            />

            {/* In-Game Chat Box */}
            <ChatBox messages={chatMessages} onSendMessage={handleSendMessage} />
          </div>
        )}
      </main>

      {/* Match End Recap Modal */}
      {matchStatus === 'ended' && (
        <MatchEndModal
          redScore={redScore}
          blueScore={blueScore}
          stats={matchStats}
          onRestart={handleStartMatch}
          onBackToLobby={handleExitToLobby}
          hasReplayFrames={Boolean(savedReplay && savedReplay.length > 0)}
          onWatchLastReplay={() => {
            setIsWatchingReplay(true);
            setReplayIndex(0);
            setReplayPlaying(true);
          }}
        />
      )}

      {/* Settings / Avatar Customization Modal */}
      {showSettingsModal && (
        <SettingsModal
          playerName={playerName}
          playerAvatar={playerAvatar}
          isMuted={isMuted}
          onSave={(newName, newAvatar) => {
            setPlayerName(newName);
            setPlayerAvatar(newAvatar);
            localStorage.setItem('haxball_player_name', newName);
            localStorage.setItem('haxball_player_avatar', newAvatar);
            setDiscs((prev) => {
              const updated = prev.map((d) => {
                if (d.id === currentUserId) {
                  return { ...d, name: newName, avatar: newAvatar };
                }
                return d;
              });
              syncDiscsToFirestore(updated);
              return updated;
            });
          }}
          onToggleMute={() => {
            const muted = sounds.toggleMute();
            setIsMuted(muted);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* How to Play Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gamepad2 size={20} className="text-emerald-400" />
                <h2 className="text-lg font-black text-white">Como Jogar HaxBall</h2>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex flex-col gap-2">
                <h4 className="font-bold text-white text-sm">Regras & Física</h4>
                <p>
                  HaxBall é um jogo de futebol 2D com física realista. O objetivo é marcar mais golos que a equipa adversária antes que o tempo ou o limite de golos termine!
                </p>
                <p>
                  Quando estás próximo da bola e carregas no botão de remate (Barra de Espaço ou X), o teu disco projeta a bola com força adicional na direção do teu movimento.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
                  <h5 className="font-bold text-red-400 mb-1">Jogador 1:</h5>
                  <ul className="space-y-1 text-[11px] text-slate-400">
                    <li>• <strong className="text-slate-200">Mover:</strong> W, A, S, D ou Setas do Teclado</li>
                    <li>• <strong className="text-slate-200">Chutar:</strong> Espaço, X, K ou Enter</li>
                    <li>• <strong className="text-slate-200">Mobile:</strong> D-Pad e Botão Chute</li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
                  <h5 className="font-bold text-blue-400 mb-1">Jogador 2 (Se Modo 2J Ativo):</h5>
                  <ul className="space-y-1 text-[11px] text-slate-400">
                    <li>• <strong className="text-slate-200">Mover:</strong> Setas do Teclado (P1 usa WASD)</li>
                    <li>• <strong className="text-slate-200">Chutar:</strong> Enter ou Shift Direito / M</li>
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
                <h5 className="font-bold text-emerald-400 mb-1">Dicas dos Profissionais:</h5>
                <ul className="space-y-1 text-[11px] text-slate-400">
                  <li>• Usa as tabelas e as paredes laterais para desmarcar colegas e fazer passes em profundidade.</li>
                  <li>• Cuidado com os postes! A bola ressalta com grande velocidade nos postes de metal.</li>
                  <li>• Podes ajustar a dificuldade dos Bots (Fácil, Médio, Craque) no ecrã da sala.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
              >
                Entendido, vamos a jogo!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firebase Database Modal */}
      {showDatabaseModal && (
        <DatabaseModal
          onClose={() => setShowDatabaseModal(false)}
          customStadiums={customStadiums}
        />
      )}
    </div>
  );
}
