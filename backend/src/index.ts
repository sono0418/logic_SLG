import express from 'express';
import path from 'path';
import http from 'http';
import { setupWebSocketServer } from './realtime';
import WebSocket, { WebSocketServer } from 'ws';
const app = express();
app.use(express.json()); // JSONボディをパースするためのミドルウェアを追加

// ランダムな5桁の数字を生成する関数
function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

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
}

// gameRoomsマップを定義
const gameRooms = new Map<string, GameState>();
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


// Reactのビルドファイルをホストする
app.use(express.static(path.join(__dirname, '..', 'build')));

// その他のすべてのリクエストに対して、`index.html`を返す
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

// HTTPサーバーを作成
const server = http.createServer(app);

// WebSocketサーバーのインスタンスを作成
const wss = new WebSocketServer({ server });

// WebSocketのロジックをこのインスタンスに適用
setupWebSocketServer(wss);

// WebSocketサーバーのロジック
wss.on('connection', ws => {
  console.log('クライアントが接続しました。');

  ws.on('message', (message: WebSocket.RawData) => {
    // 受信したメッセージを処理
    console.log(`メッセージを受信: ${message}`);
    // ここにゲームのロジックを追加
    ws.send(JSON.stringify({ type: 'message_response', payload: { text: 'メッセージを受信しました' } }));
  });

  ws.on('close', () => {
    console.log('クライアントが切断しました。');
  });

  ws.on('error', error => {
    console.error('WebSocketエラー:', error);
  });
});

const port = process.env.PORT || 3000;

// サーバーを起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});