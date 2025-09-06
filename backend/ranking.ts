import { Router } from 'express';
import pool from 'src/db'; // db/index.ts から pool をインポート

const router = Router();

// ランキングを取得するためのAPIエンドポイント
router.get('/ranking', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // スコアの高い順に並べ替えるSQLクエリ
    // ORDER BY score DESC で降順に並べます
    const result = await client.query('SELECT "Team_name", "score" FROM "Ranking" ORDER BY "score" DESC');
    
    // 取得したデータをJSON形式で返す
    res.json(result.rows);
    
    client.release(); // クライアントをプールに返却
  } catch (err) {
    console.error('ランキングの取得中にエラーが発生しました:', err);
    res.status(500).json({ error: 'ランキングデータの取得に失敗しました。' });
  }
});

export default router;