import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';

// このファイルでgameRoomsやデータベースにアクセスできるようにする
// 例:
// import { gameRooms } from '../realtime';
// import { pool } from '../database';

const router = express.Router();

// ルーム作成API
router.post('/rooms', async (req, res) => {
  try {
    const roomId = uuidv4();
    // TODO: データベースにルーム情報を保存
    // gameRooms.set(roomId, newGame); // WebSocketロジックと連携
    res.status(201).json({ roomId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create room' });
  }
});

// ルーム参加API
router.post('/rooms/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const playerId = uuidv4();
    // TODO: データベースにプレイヤー情報を保存
    // gameRooms.get(roomId).players.push({ playerId, ... }); // WebSocketロジックと連携
    res.status(200).json({ playerId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to join room' });
  }
});

export default router;