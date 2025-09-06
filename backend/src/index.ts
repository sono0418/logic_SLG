import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import WebSocket from "ws";

// (ここからGameStateなどの定義は変更なし)
const tutorialCircuits = [
  { circuit: ['AND', 'NOT'], expectedOutput: false, isTutorial: true },
  { circuit: ['OR', 'AND'], expectedOutput: true, isTutorial: true },
  { circuit: ['OR', 'NOT', 'AND'], expectedOutput: false, isTutorial: true }
];
interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, playerOrder: number }[];
  currentPlayerId: string | null;
  roundCount: number;
  teamScore: number;
  currentQuestion: {
    circuit: string[];
    expectedOutput: boolean;
    isTutorial?: boolean;
  };
  currentPlayerIndex: number;
  playerInputs: (boolean | null)[];
  status: 'waiting' | 'inProgress' | 'ended';
  playerChoices: { [playerId: string]: string };
  hostId: string | null;
}
const gameRooms = new Map<string, GameState>();
const app = express();
const port = process?.env?.PORT || 3000;

function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

// ✨ =================================================================
// ✨ 1. 猶予期間タイマーを管理するためのMapを追加
// ✨ =================================================================
const disconnectionTimers = new Map<string, NodeJS.Timeout>();


// (静的ファイル配信部分は変更なし)
app.use(express.json());
const staticPath = path.join(__dirname, '..', 'dist');
app.use(express.static(staticPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}

wss.on('connection', ws => {
  console.log('Client connected.');

  const wsWithId = ws as WebSocketWithIdentity;

  ws.on('message', message => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'joinRoom') {
        const { roomId, playerId } = data.payload;
        let room = gameRooms.get(roomId);

        // ✨ 2. プレイヤーが再接続してきた場合、猶予期間タイマーを解除
        if (disconnectionTimers.has(playerId)) {
          clearTimeout(disconnectionTimers.get(playerId)!);
          disconnectionTimers.delete(playerId);
          console.log(`Player ${playerId} reconnected within the grace period.`);
        }

        if (!room) {
          const newRoom: GameState = {
            roomId,
            players: [],
            currentQuestion: { circuit: [], expectedOutput: false },
            currentPlayerIndex: 0,
            playerInputs: [],
            status: 'waiting',
            currentPlayerId: null,
            roundCount: 0,
            teamScore: 0,
            playerChoices: {},
            hostId: playerId,
          };
          gameRooms.set(roomId, newRoom);
          room = newRoom;
          console.log(`New room ${roomId} created with status: ${room.status}`);
        }

        // 既存のプレイヤー情報を更新、または新規追加
        const existingPlayerIndex = room.players.findIndex(p => p.playerId === playerId);
        if (existingPlayerIndex !== -1) {
            room.players[existingPlayerIndex].ws = ws; // WebSocketインスタンスを更新
        } else {
            const playerOrder = room.players.length + 1;
            room.players.push({ playerId, ws, playerOrder });
        }
        
        wsWithId.roomId = roomId;
        wsWithId.playerId = playerId;

        console.log(`Player ${playerId} joined room ${roomId}`);
        ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));
        
        const roomUpdatePayload = {
            roomId: room.roomId,
            players: room.players.map(p => ({ id: p.playerId, playerOrder: p.playerOrder })),
            playerChoices: room.playerChoices,
            hostId: room.hostId,
        };
        room.players.forEach(p => {
          p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: roomUpdatePayload }));
        });
      }

      // (startGame, playerInput, selectGameMode のロジックは変更なし)
      else if (data.type === 'startGame') {
        // ...
      }
      else if (data.type === 'playerInput') {
        // ...
      }
      else if (data.type === 'selectGameMode') {
        // ...
      }
      
    } catch (error) {
      console.error(error);
    }
  });


  // ✨ 3.【最重要】接続が切れた際の処理を「猶予期間」を持たせる形に修正
  ws.on('close', () => {
    console.log('Client disconnected.');

    const { roomId, playerId } = wsWithId;

    if (roomId && playerId) {
      // 3秒後に本当に退出させるタイマーをセット
      const timerId = setTimeout(() => {
        console.log(`Grace period for ${playerId} expired. Removing from room.`);
        const room = gameRooms.get(roomId);
        if (room) {
          room.players = room.players.filter(p => p.playerId !== playerId);

          if (room.players.length === 0) {
            gameRooms.delete(roomId);
            console.log(`Room ${roomId} deleted.`);
            return;
          }

          room.players.forEach((p, index) => {
            p.playerOrder = index + 1;
          });

          if (room.hostId === playerId) {
            room.hostId = room.players[0].playerId;
          }

          const roomUpdatePayload = {
              roomId: room.roomId,
              players: room.players.map(p => ({ id: p.playerId, playerOrder: p.playerOrder })),
              playerChoices: room.playerChoices,
              hostId: room.hostId,
          };
          room.players.forEach(p => {
            p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: roomUpdatePayload }));
          });
        }
        disconnectionTimers.delete(playerId);
      }, 3000); // 3秒の猶予

      disconnectionTimers.set(playerId, timerId);
      console.log(`Starting 3-second grace period for player ${playerId} in room ${roomId}.`);
    }
  });
});

// (generateNewQuestion, server.listen は変更なし)
function generateNewQuestion() {
  // ...
}
server.listen(port, () => {
  // ...
});

