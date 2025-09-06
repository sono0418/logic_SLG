import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
// import apiRouter from './routes/api'; // (未使用)
// import { setupWebSocketServer } from './realtime'; // (未使用)
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

// ✨ 修正点 1: generateRoomId の中身を元に戻す
function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}
// (定義ここまで変更なし)


// (静的ファイル配信部分は変更なし)
app.use(express.json());
const staticPath = path.join(__dirname, '..', 'dist');
app.use(express.static(staticPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});
// (静的ファイル配信ここまで変更なし)

const server = http.createServer(app);
const wss = new WebSocketServer({ server });


// ✨ WebSocketインスタンスにプロパティを追加するための「型」を定義
interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}


wss.on('connection', ws => {
  console.log('Client connected.');

  // ✨ wsインスタンスを、プロパティを持てる型として扱う
  const wsWithId = ws as WebSocketWithIdentity;

  ws.on('message', message => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'joinRoom') {
        const { roomId, playerId } = data.payload;
        let room = gameRooms.get(roomId);

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

        const playerOrder = room.players.length + 1;
        room.players.push({ playerId, ws, playerOrder });

        // ✨ 接続に「名札」を付ける！
        wsWithId.roomId = roomId;
        wsWithId.playerId = playerId;

        console.log(`Player ${playerId} joined room ${roomId}`);
        ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));
        
        // roomUpdateで送るpayloadから、wsオブジェクトを除外する
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

      else if (data.type === 'startGame') {
        const { roomId, playerId, mode } = data.payload;
        const room = gameRooms.get(roomId);

        // ✨ 修正点 1: 1人でもテストできるように、プレイヤー人数の条件を緩和
        if (!room || room.players[0].playerId !== playerId || room.players.length < 1 || room.status === 'inProgress') {
          console.log('Game start condition not met.');
          return;
        }

        room.status = 'inProgress';
        room.roundCount = 0;
        room.currentPlayerIndex = 0;
        room.currentPlayerId = room.players[0].playerId;

        if (mode === 'tutorial') {
          room.currentQuestion = tutorialCircuits[0];
        } else {
          room.currentQuestion = generateNewQuestion();
        }
        room.playerInputs = new Array(room.players.length).fill(null);

        room.players.forEach(p => {
          p.ws.send(JSON.stringify({ 
            type: 'gameStart', 
            payload: { 
              currentQuestion: room.currentQuestion, 
              currentPlayerIndex: room.currentPlayerIndex,
              currentPlayerId: room.currentPlayerId,
              players: room.players.map(p => ({ id: p.playerId, playerOrder: p.playerOrder })),
              teamScore: room.teamScore,
              mode: mode,
            }
          }));
        });
        console.log(`Game started in room ${roomId}. Status: ${room.status}`);
      }
      
      else if (data.type === 'playerInput') {
        // (この部分は変更なし)
      }
      
      else if (data.type === 'selectGameMode') {
        const { roomId, playerId, mode } = data.payload;
        const room = gameRooms.get(roomId);

        // ✨ 修正点 2: ホスト以外のプレイヤーもモードを選択できるように、hostIdのチェックを削除
        if (!room || room.status !== 'waiting') {
            console.log(`selectGameMode denied. Room status: ${room?.status}`);
            return;
        }

        room.playerChoices[playerId] = mode;
        
        const roomUpdatePayload = { 
            roomId: room.roomId,
            players: room.players.map(player => ({ id: player.playerId, playerOrder: player.playerOrder })),
            playerChoices: room.playerChoices,
            hostId: room.hostId,
        };
        room.players.forEach(p => {
          p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: roomUpdatePayload }));
        });
      }
      
    } catch (error) {
      console.error(error);
    }
  });


  // ✨ 3.【最重要】接続が切れた際の退出処理をここに実装
  ws.on('close', () => {
    console.log('Client disconnected.');

    // 名札からroomIdとplayerIdを取得
    const { roomId, playerId } = wsWithId;

    if (roomId && playerId) {
      const room = gameRooms.get(roomId);
      if (room) {
        // プレイヤーをルームから削除
        room.players = room.players.filter(p => p.playerId !== playerId);
        console.log(`Player ${playerId} left room ${roomId}.`);

        // もしルームが空になったら、ルーム自体を削除
        if (room.players.length === 0) {
          gameRooms.delete(roomId);
          console.log(`Room ${roomId} is now empty and has been deleted.`);
          return; // 処理終了
        }

        // プレイヤー番号の再割り振り（1P繰り上げなど）
        room.players.forEach((p, index) => {
          p.playerOrder = index + 1;
        });

        // 退出したのがホストだった場合、新しいホストを指名
        if (room.hostId === playerId) {
          room.hostId = room.players[0].playerId;
          console.log(`Host of room ${roomId} changed to ${room.hostId}.`);
        }

        // 残っているメンバーに最新のルーム情報を通知
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
    }
  });
});

// ✨ 修正点 2: generateNewQuestion の中身を元に戻す
function generateNewQuestion() {
  const gateTypes = ['AND', 'OR', 'NOT'];
  const circuitLength = Math.floor(Math.random() * 2) + 2;
  const circuit = [];
  for (let i = 0; i < circuitLength; i++) {
    circuit.push(gateTypes[Math.floor(Math.random() * gateTypes.length)]);
  }
  const initialInput = Math.random() < 0.5;
  let expectedOutput = initialInput;
  for (let i = 0; i < circuit.length; i++) {
    const gateType = circuit[i];
    if (gateType === 'AND') {
      expectedOutput = expectedOutput && (Math.random() < 0.5);
    } else if (gateType === 'OR') {
      expectedOutput = expectedOutput || (Math.random() < 0.5);
    } else if (gateType === 'NOT') {
      expectedOutput = !expectedOutput;
    }
  }
  return { circuit, expectedOutput };
}
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

