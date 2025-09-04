// src/components/Popups/PopUpC.tsx
import React, { useState, useEffect } from 'react';

// 親から渡されるPropsの型を定義
interface PopUpProps {
  onClose: () => void;
}

// ランキングデータの型を定義
interface PlayerScore {
  id: number;
  name: string;
  score: number;
}

const API_URL = "バックエンドのURL"; // バックエンドのURL

const PopUpC: React.FC<PopUpProps> = ({ onClose }) => {
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // コンポーネントがマウントされた時に一度だけデータを取得
  useEffect(() => {
    // データの取得を非同期で行う関数
    const fetchScores = async () => {
      try {
        setIsLoading(true);
        // 実際にはここにAPI呼び出しのコードを記述します。
        // 多分API作られてないからAIと相談してAPIつくるかうまいこと呼び出すかしよう

        // 今回はダミーデータを使います
        const mockData: PlayerScore[] = [
          { id: 1, name: "Player A", score: 5000 },
          { id: 2, name: "Player B", score: 4500 },
          { id: 3, name: "Player C", score: 4800 },
        ];
        const sortedScores = mockData.sort((a, b) => b.score - a.score);
        setScores(sortedScores);
        //ここまでダミー
      } catch (error) {
        console.error("データの取得に失敗しました", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScores();
  }, []); // 依存配列が空なので、コンポーネントが最初に表示された時（マウント時）に一度だけ実行される

// 例: ranking.ts (APIエンドポイントのファイル)
import express, { Request, Response } from 'express';
import { getDbConnection } from './db'; // データベース接続関数をインポート

const router = express.Router();

router.get('/ranking', async (req: Request, res: Response) => {
  let connection;
  try {
    connection = await getDbConnection();
    // スコアの降順（高い順）でデータを取得するSQLクエリ
    const [rows] = await connection.execute('SELECT player_name, score FROM Players ORDER BY score DESC');
    
    // 取得したデータをJSONとして返す
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch ranking:', error);
    res.status(500).json({ message: 'ランキングの取得に失敗しました' });
  } finally {
    if (connection) connection.release();
  }
});


  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>ランキング</h2>
        {isLoading ? (
          <p>ランキングを読み込み中...</p>
        ) : (
          <ol>
            {scores.map((player, index) => (
              <li key={player.id}>
                {index + 1}位: {player.name} - {player.score}点
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default PopUpC;