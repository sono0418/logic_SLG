import { WebSocketServer } from 'ws';
import http from 'http';
import { WebSocket } from 'ws';

// Expressサーバーのインスタンスを作成 (ここでは省略)
// const app = express();

// ExpressアプリをHTTPサーバーにアタッチ
import express from 'express';
const app = express();
const server = http.createServer(app);

// HTTPサーバーにWebSocketサーバーをアタッチ
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
// サーバーを起動
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
// wss.on('connection', ws => { ... }); の中に、
// ws.on('message', ...) を含める
wss.on('connection', ws => {
  console.log('client connected.');
  ws.send('Welcome to the game!');
  // connectionイベントハンドラのスコープ内に移動
  ws.on('message', message => {
    console.log(`Received message: ${message}`);
    // ここにゲームロジックを記述
  });
  ws.on('close', () => {
  console.log('Client disconnected.');
  // プレイヤーが退室した際の処理
});
});
// ゲームの状態を管理するインターフェース
interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, score: number }[];
  currentQuestion: {
    circuit: string[]; // 論理回路の構成 (例: ['AND', 'OR', 'NOT'])
    expectedOutput: boolean; // 最終的な正解
  };
  currentPlayerIndex: number; // 現在のプレイヤーのインデックス
  playerInputs: (boolean | null)[]; // プレイヤーの入力履歴
}

// 複数のゲームルームを管理するマップ
const gameRooms = new Map<string, GameState>();
// WebSocketサーバーのインスタンス
// const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  // 接続時に、フロントエンドからルームIDとプレイヤーIDを受け取る想定
  // この部分は、フロントエンドとの通信プロトコルによって実装方法が変わります。
  ws.on('message', message => {
    const data = JSON.parse(message.toString());
    if (data.type === 'joinRoom') {
      const { roomId, playerId } = data.payload;
      let room = gameRooms.get(roomId);
      
      if (!room) {
    // ルームが存在しない場合、新しいルームを作成
    const newRoom = {
      roomId: roomId,
      players: [],
      // その他の初期ゲーム状態をここに設定
      currentQuestion: {
        circuit: [], // 論理回路の初期値
        expectedOutput: false
      },
      currentPlayerIndex: 0,
      playerInputs: []
    };
    gameRooms.set(roomId, newRoom);
    room = newRoom; // room変数を新しいルームに再代入
  }
  
     interface GameState {
  // ... その他のプロパティ ...
  // wsライブラリのWebSocket型に修正
  players: { playerId: string, ws: WebSocket, score: number }[];
}
      // プレイヤーをルームに追加
      room.players.push({ playerId, ws, score: 0 });
      console.log(`Player ${playerId} joined room ${roomId}`);
      
      // プレイヤーに参加成功を通知
      ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));
      
      // ルームの全プレイヤーに更新情報をブロードキャスト
      room.players.forEach(p => {
        p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room }));
      });

    // プレイヤーの入力を処理
    } else if (data.type === 'playerInput') {
      const { roomId, playerId, inputValue } = data.payload;
      const room = gameRooms.get(roomId);

      if (!room) return; // ルームが存在しない場合は処理を停止

      const currentGateType = room.currentQuestion.circuit[room.currentPlayerIndex];
      const previousInputValue = room.playerInputs[room.currentPlayerIndex - 1];
      let gateOutput = false;

      // 論理回路の計算
      if (currentGateType === 'AND') {
        gateOutput = previousInputValue && inputValue;
      } else if (currentGateType === 'OR') {
        gateOutput = previousInputValue || inputValue;
      }
      // ... 他のゲートも同様に実装

      // プレイヤーの入力を履歴に追加
      room.playerInputs[room.currentPlayerIndex] = inputValue;

      // ターンを進める
      room.currentPlayerIndex++;

      // 次のプレイヤーに結果を送信
      const nextPlayer = room.players[room.currentPlayerIndex];
      if (nextPlayer) {
        nextPlayer.ws.send(JSON.stringify({ 
          type: 'yourTurn', 
          payload: { inputValue: gateOutput, gateType: room.currentQuestion.circuit[room.currentPlayerIndex] }
        }));
      } else {
        // 全員が終了した場合、最終判定
        // finalOutputがroom.currentQuestion.expectedOutputと一致するかを判定
        // スコアを更新し、結果を全プレイヤーにブロードキャスト
      }
    }
  });
});