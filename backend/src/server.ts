// src/server.ts

import express from 'express';
import path from 'path';
import apiRouter from './routes/api';

const app = express();

// JSONボディをパースするためのミドルウェア
app.use(express.json());

// APIルーティング
app.use('/api', apiRouter);

// 静的ファイルをホストする
app.use(express.static(path.join(__dirname, '..', '..', 'build')));

export default app;