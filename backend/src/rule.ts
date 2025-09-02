import { WebSocketServer } from 'ws';
import http from 'http';
import express from 'express';
import { WebSocket } from 'ws';

const app = express();
// ... Expressアプリケーション (app) の作成 ...

// ExpressアプリをHTTPサーバーにアタッチ
const server = http.createServer(app);

// HTTPサーバーにWebSocketサーバーをアタッチ
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
// ゲームの状態を管理するインターフェースを定義
interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, score: number }[];
  currentQuestion: {
    circuit: string[];
    expectedOutput: boolean;
  };
  currentPlayerIndex: number;
  playerInputs: (boolean | null)[];
  
// GameStateインターフェースとgameRoomsマップは
// このコードより前に定義されている必要があります

}
const gameRooms = new Map<string, GameState>();
wss.on('connection', ws => {
  ws.on('message', message => {
  try {
    const data = JSON.parse(message.toString());

    // クライアントからのメッセージタイプが 'joinRoom' の場合
    if (data.type === 'joinRoom') {
      const { roomId, playerId } = data.payload;
      let room = gameRooms.get(roomId);

      // ルームが存在しない場合は新規作成
      if (!room) {
        console.log(`Room ${roomId} not found. Creating a new one.`);
        const newRoom = {
          roomId: roomId,
          players: [], // 初期は空の配列
          currentQuestion: {
            circuit: ['AND', 'OR'], // 例：AND、ORゲートを含む回路
            expectedOutput: true // 正しい最終出力
          },
          currentPlayerIndex: 0, // 最初のプレイヤーから開始
          playerInputs: [] // プレイヤーの入力履歴
        };
        gameRooms.set(roomId, newRoom);
        room = newRoom; // room変数に新しいルームを代入
      }
      if (room.players.length >= 4) {
    // 参加人数が4人以上の場合、エラーメッセージを返す
    ws.send(JSON.stringify({ 
      type: 'joinError', 
      payload: { message: 'Room is full. Cannot join.' } 
    }));
    return; // 以降の処理を停止
    }
      // 新しいプレイヤーをルームに追加
      // players配列に { playerId, ws, score } オブジェクトを追加
      room.players.push({ playerId, ws, score: 0 });
      console.log(`Player ${playerId} joined room ${roomId}`);

      // 参加が成功したことをプレイヤーに通知
      ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));

      // ルーム内の全プレイヤーに現在の状態をブロードキャスト
      room.players.forEach(p => {
        p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room }));
      });
    }
    // ... 他のメッセージタイプ ('playerInput' など) の処理が続く
  } catch (error) {
    console.error('Failed to process message:', error);
  }
});
  ws.on('close', () => {
});
});

