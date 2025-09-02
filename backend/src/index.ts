import express from 'express';
import path from 'path';
import http from 'http';
import { setupWebSocketServer } from './realtime';
import WebSocket, { WebSocketServer } from 'ws';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // JSONボディをパースするためのミドルウェア

app.post('/api/rooms', async (req, res) => {
  try {
    let roomId = generateRoomId();
    while (gameRooms.has(roomId)) {
      roomId = generateRoomId();
    }
    // TODO: データベースにルーム情報を保存
    res.status(201).json({ roomId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create room' });
  }
});


// 静的ファイルをホストする
app.use(express.static(path.join(__dirname, '..', 'build')));

// その他のすべてのリクエストに対して、`index.html`を返す
app.get('/.*/', (req, res) => {
  res.sendFile(path.join(__dirname, '..','build','index.html'));
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

// 関数とインターフェースはファイルの先頭に置くのが一般的だが、動作には影響しない
function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

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

const gameRooms = new Map<string, GameState>();