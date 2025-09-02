// src/routes/api.ts

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ルーム作成API
router.post('/rooms', (req, res) => {
  const roomId = uuidv4();
  res.status(201).json({ roomId });
});

// ルーム参加API
router.post('/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const playerId = uuidv4();
  res.status(200).json({ playerId });
});

export default router;