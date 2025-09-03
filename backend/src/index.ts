import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import apiRouter from './routes/api'; // api.tsからルーターをインポート
import { setupWebSocketServer } from './realtime';
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

// サーバーを起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});