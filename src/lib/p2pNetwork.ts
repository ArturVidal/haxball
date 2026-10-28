import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface PlayerInputMessage {
  type: 'INPUT';
  playerId: string;
  dx: number;
  dy: number;
  isKicking: boolean;
}

export interface GameStateMessage {
  type: 'STATE';
  ball: { x: number; y: number; vx: number; vy: number };
  discs: { id: string; x: number; y: number; vx: number; vy: number; isKicking: boolean }[];
  redScore: number;
  blueScore: number;
  timeSeconds: number;
  matchStatus: string;
  countdownNumber: number | null;
  lastGoalScorer?: { name: string; team: string; speedKmh: number } | null;
}

export interface ControlMessage {
  type: 'START_MATCH' | 'RETURN_TO_LOBBY' | 'PAUSE_MATCH';
}

export type NetworkMessage = PlayerInputMessage | GameStateMessage | ControlMessage;

/**
 * Host P2P manager: listens for incoming guest signals, connects WebRTC data channels,
 * and receives guest inputs while broadcasting authoritative game physics states.
 */
export function initHostP2P(
  roomId: string,
  callbacks: {
    onGuestInput: (input: PlayerInputMessage) => void;
    onGuestConnected?: (guestId: string) => void;
    onGuestDisconnected?: (guestId: string) => void;
  }
) {
  const peerConnections = new Map<string, RTCPeerConnection>();
  const dataChannels = new Map<string, RTCDataChannel>();
  const unsubscribers: (() => void)[] = [];

  const signalsCollectionRef = collection(db, 'rooms', roomId, 'signals');

  const unsubscribeCollection = onSnapshot(signalsCollectionRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      const guestId = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added' || change.type === 'modified') {
        // Step 1: Guest initiated connection
        if (data.status === 'init' && !peerConnections.has(guestId)) {
          const pc = new RTCPeerConnection(ICE_SERVERS);
          peerConnections.set(guestId, pc);

          // Create low-latency unreliable data channel for fast game physics
          const dc = pc.createDataChannel('haxball-game', {
            ordered: false,
            maxRetransmits: 0,
          });

          dc.onopen = () => {
            dataChannels.set(guestId, dc);
            if (callbacks.onGuestConnected) callbacks.onGuestConnected(guestId);
          };

          dc.onclose = () => {
            dataChannels.delete(guestId);
            if (callbacks.onGuestDisconnected) callbacks.onGuestDisconnected(guestId);
          };

          dc.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'INPUT') {
                callbacks.onGuestInput(msg);
              }
            } catch {
              // Ignore malformed packets
            }
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              setDoc(
                doc(db, 'rooms', roomId, 'signals', guestId),
                {
                  hostCandidates: arrayUnion(JSON.stringify(event.candidate)),
                },
                { merge: true }
              ).catch(() => {});
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await setDoc(
            doc(db, 'rooms', roomId, 'signals', guestId),
            {
              offer: JSON.stringify(offer),
              status: 'offer_sent',
              hostId: 'host',
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }

        // Step 2: Guest returned answer
        if (data.status === 'answer_sent' && data.answer) {
          const pc = peerConnections.get(guestId);
          if (pc && pc.signalingState === 'have-local-offer') {
            try {
              const answerObj = JSON.parse(data.answer);
              await pc.setRemoteDescription(new RTCSessionDescription(answerObj));

              // Add any guest candidates that arrived
              if (Array.isArray(data.guestCandidates)) {
                for (const cStr of data.guestCandidates) {
                  try {
                    const candidateObj = JSON.parse(cStr);
                    await pc.addIceCandidate(new RTCIceCandidate(candidateObj));
                  } catch {}
                }
              }
            } catch (err) {
              console.warn('Error setting remote answer on host:', err);
            }
          }
        }

        // Step 3: Handle guest ICE candidates arriving incrementally
        if (data.guestCandidates && Array.isArray(data.guestCandidates)) {
          const pc = peerConnections.get(guestId);
          if (pc && pc.remoteDescription) {
            for (const cStr of data.guestCandidates) {
              try {
                const candidateObj = JSON.parse(cStr);
                await pc.addIceCandidate(new RTCIceCandidate(candidateObj));
              } catch {}
            }
          }
        }
      } else if (change.type === 'removed') {
        const pc = peerConnections.get(guestId);
        if (pc) {
          pc.close();
          peerConnections.delete(guestId);
        }
        dataChannels.delete(guestId);
      }
    });
  });

  unsubscribers.push(unsubscribeCollection);

  return {
    broadcastState: (state: GameStateMessage) => {
      if (dataChannels.size === 0) return;
      const json = JSON.stringify(state);
      dataChannels.forEach((dc) => {
        if (dc.readyState === 'open') {
          try {
            dc.send(json);
          } catch {}
        }
      });
    },

    broadcastMessage: (msg: ControlMessage) => {
      if (dataChannels.size === 0) return;
      const json = JSON.stringify(msg);
      dataChannels.forEach((dc) => {
        if (dc.readyState === 'open') {
          try {
            dc.send(json);
          } catch {}
        }
      });
    },

    cleanup: () => {
      unsubscribers.forEach((unsub) => unsub());
      dataChannels.forEach((dc) => dc.close());
      dataChannels.clear();
      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();
    },
  };
}

/**
 * Guest P2P manager: connects to the host's WebRTC peer connection, receives authoritative
 * state updates and start commands, and transmits local movement/kick inputs.
 */
export function initGuestP2P(
  roomId: string,
  guestId: string,
  callbacks: {
    onStateUpdate: (state: GameStateMessage) => void;
    onStartMatch: () => void;
    onReturnToLobby: () => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }
) {
  let pc: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let isCleanedUp = false;

  const signalDocRef = doc(db, 'rooms', roomId, 'signals', guestId);

  // Initialize guest signal document in Firestore
  setDoc(
    signalDocRef,
    {
      status: 'init',
      guestId,
      createdAt: Date.now(),
    },
    { merge: true }
  ).catch((err) => console.warn('Could not initialize guest signal:', err));

  const unsubscribeDoc = onSnapshot(signalDocRef, async (docSnap) => {
    if (isCleanedUp || !docSnap.exists()) return;
    const data = docSnap.data();

    // Host provided an offer
    if (data.status === 'offer_sent' && data.offer && !pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);

      pc.ondatachannel = (event) => {
        dataChannel = event.channel;

        dataChannel.onopen = () => {
          if (callbacks.onConnected) callbacks.onConnected();
        };

        dataChannel.onclose = () => {
          if (callbacks.onDisconnected) callbacks.onDisconnected();
        };

        dataChannel.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'STATE') {
              callbacks.onStateUpdate(msg);
            } else if (msg.type === 'START_MATCH') {
              callbacks.onStartMatch();
            } else if (msg.type === 'RETURN_TO_LOBBY') {
              callbacks.onReturnToLobby();
            }
          } catch {}
        };
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          setDoc(
            signalDocRef,
            {
              guestCandidates: arrayUnion(JSON.stringify(event.candidate)),
            },
            { merge: true }
          ).catch(() => {});
        }
      };

      try {
        const offerObj = JSON.parse(data.offer);
        await pc.setRemoteDescription(new RTCSessionDescription(offerObj));

        // Add any host candidates that were already gathered
        if (Array.isArray(data.hostCandidates)) {
          for (const cStr of data.hostCandidates) {
            try {
              const candidateObj = JSON.parse(cStr);
              await pc.addIceCandidate(new RTCIceCandidate(candidateObj));
            } catch {}
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await setDoc(
          signalDocRef,
          {
            answer: JSON.stringify(answer),
            status: 'answer_sent',
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Error handling offer on guest:', err);
      }
    }

    // Incremental host ICE candidates
    if (data.hostCandidates && Array.isArray(data.hostCandidates) && pc && pc.remoteDescription) {
      for (const cStr of data.hostCandidates) {
        try {
          const candidateObj = JSON.parse(cStr);
          await pc.addIceCandidate(new RTCIceCandidate(candidateObj));
        } catch {}
      }
    }
  });

  return {
    sendInput: (dx: number, dy: number, isKicking: boolean) => {
      if (dataChannel && dataChannel.readyState === 'open') {
        const msg: PlayerInputMessage = {
          type: 'INPUT',
          playerId: guestId,
          dx,
          dy,
          isKicking,
        };
        try {
          dataChannel.send(JSON.stringify(msg));
        } catch {}
      }
    },

    cleanup: () => {
      isCleanedUp = true;
      unsubscribeDoc();
      if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
      }
      if (pc) {
        pc.close();
        pc = null;
      }
      deleteDoc(signalDocRef).catch(() => {});
    },
  };
}
