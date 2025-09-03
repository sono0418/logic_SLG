// この行を追加して、データベース接続ファイルを実行させます
import './db/index'; 
import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import apiRouter from './routes/api'; // api.tsからルーターをインポート
import { setupWebSocketServer } from './realtime';
import WebSocket, { WebSocket as WsWebSocket } from "ws";

type Player = {
  playerId: string;
  ws: WsWebSocket; // DOM WebSocket と区別
  score: number;
};
// ゲームの状態を管理するインターフェースを定義
interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, score: number }[];
  currentPlayerId: string | null; // 現在のターンプレイヤーのID
  roundCount: number;
  currentQuestion: {
    circuit: string[];
    expectedOutput: boolean;
  };
  currentPlayerIndex: number;
  playerInputs: (boolean | null)[];
  status: 'waiting' | 'inProgress' | 'ended';
}

// gameRoomsマップを定義
const gameRooms = new Map<string, GameState>();
const app = express();
const port = process.env.PORT || 3000;
function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

// ルーム作成APIの実装
app.post('/api/rooms', async (req, res) => {
  try {
    let roomId = generateRoomId();
    // 重複をチェックするループ
    while (gameRooms.has(roomId)) {
      roomId = generateRoomId();
    }

    // データベースにルームを挿入（省略）
    // ...

    res.status(201).json({ roomId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create room' });
  }
});
app.use(express.json());

// APIエンドポイントをルーター経由で設定
app.use('/api', apiRouter);

// ルーム作成APIが重複しているため、index.tsから削除

// 静的ファイルをホストする
app.use(express.static(path.join(__dirname, '..', 'dist')));

// その他のすべてのリクエストに対して、`index.html`を返す
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// HTTPサーバーを作成
const server = http.createServer(app);
// WebSocketサーバーのインスタンスを作成
const wss = new WebSocketServer({ server });
// WebSocketのロジックをこのインスタンスに適用
setupWebSocketServer(wss);
// wss.on('message', ...) ハンドラ内

// サーバーを起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
// wss.on('connection', ws => { ...
// ws.on('message', ... はこの中にネストされます
// GameStateインターフェースにstatusプロパティを追加
wss.on('connection', ws => {
  console.log('Client connected.');

  ws.on('message', message => {
    try {
      const data = JSON.parse(message.toString());

      // 'joinRoom' メッセージを処理
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
          };
          gameRooms.set(roomId, newRoom);
          room = newRoom;
          console.log(`New room ${roomId} created with status: ${room.status}`);
        }
        room.players.push({ playerId, ws, score: 0 });
        console.log(`Player ${playerId} joined room ${roomId}`);
        ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));
        room.players.forEach(p => {
          p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room }));
        });
      }
      
      // 'startGame' メッセージを処理
      else if (data.type === 'startGame') {
        const { roomId, playerId } = data.payload;
        const room = gameRooms.get(roomId);

        if (!room || room.players[0].playerId !== playerId || room.players.length < 2 || room.status === 'inProgress') {
          return;
        }

        room.status = 'inProgress';
        room.currentQuestion = { circuit: ['AND', 'OR'], expectedOutput: true };
        room.currentPlayerIndex = 0;
        room.currentPlayerId = room.players[0].playerId;

        room.players.forEach(p => {
          p.ws.send(JSON.stringify({ 
            type: 'gameStart', 
            payload: { 
              currentQuestion: room.currentQuestion, 
              currentPlayerIndex: room.currentPlayerIndex,
              currentPlayerId: room.currentPlayerId,
              players: room.players.map(p => ({ id: p.playerId, score: p.score }))
            }
          }));
        });
        console.log(`Game started in room ${roomId}. Status: ${room.status}`);
      }
      
      // 'playerInput' メッセージを処理
      else if (data.type === 'playerInput') {
        const { roomId, playerId, inputValue } = data.payload;
        const room = gameRooms.get(roomId);

        if (!room || room.status !== 'inProgress' || room.currentPlayerId !== playerId) {
          return;
        }

        room.playerInputs[room.currentPlayerIndex] = inputValue;

        if (room.currentPlayerIndex === room.players.length - 1) {
          // --- 最終評価とスコアリング ---
          let currentOutput = room.playerInputs[0] as boolean;
          for (let i = 1; i < room.playerInputs.length; i++) {
            const gateType = room.currentQuestion.circuit[i - 1];
            const nextInput = room.playerInputs[i] as boolean;
            if (gateType === 'AND') {
              currentOutput = currentOutput && nextInput;
            } else if (gateType === 'OR') {
              currentOutput = currentOutput || nextInput;
            } else if (gateType === 'NOT') {
              currentOutput = !currentOutput;
            }
          }
          const isCorrect = currentOutput === room.currentQuestion.expectedOutput;
          if (isCorrect) {
            room.players.forEach(p => p.score += 10);
          }
          
          room.roundCount++;
          if (room.roundCount >= 3) {
            room.status = 'ended';
            room.players.forEach(p => {
              p.ws.send(JSON.stringify({
                type: 'gameEnd',
                payload: {
                  isCorrect,
                  finalOutput: currentOutput,
                  expectedOutput: room.currentQuestion.expectedOutput,
                  players: room.players.map(player => ({ id: player.playerId, score: player.score }))
                }
              }));
            });
            gameRooms.delete(roomId);
          } else {
            const newQuestion = generateNewQuestion();
            room.currentQuestion = newQuestion;
            room.currentPlayerIndex = 0;
            room.currentPlayerId = room.players[0].playerId;
            room.playerInputs = new Array(room.players.length).fill(null);

            room.players.forEach(p => {
              p.ws.send(JSON.stringify({
                type: 'nextRound',
                payload: {
                  roundCount: room.roundCount,
                  currentQuestion: room.currentQuestion,
                  players: room.players.map(player => ({ id: player.playerId, score: player.score }))
                }
              }));
            });
          }
        } else {
          // 次のターンに進める
          room.currentPlayerIndex++;
          room.currentPlayerId = room.players[room.currentPlayerIndex].playerId;
          
          room.players.forEach(p => {
            p.ws.send(JSON.stringify({
              type: 'turnUpdate',
              payload: {
                currentPlayerId: room.currentPlayerId,
                lastInput: inputValue,
                circuitGateType: room.currentQuestion.circuit[room.currentPlayerIndex - 1]
              }
            }));
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

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