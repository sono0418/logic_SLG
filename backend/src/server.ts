import express from 'express';
import path from 'path';

const app = express();
//const port = process.env.PORT || 3000;

// JSONボディをパースするためのミドルウェア
app.use(express.json());

// 静的ファイルをホストする
app.use(express.static(path.join(__dirname, '..', 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

/* 
app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});*/

// この時点ではまだサーバーを起動しない
export default app;