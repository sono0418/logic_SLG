import express from 'express';

const app = express();
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