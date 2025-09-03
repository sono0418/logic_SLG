import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import apiRouter from './routes/api'; // api.tsからルーターをインポート
import { setupWebSocketServer } from './realtime';

const app = express();
const port = process.env.PORT || 3000;

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