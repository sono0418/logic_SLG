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

// バックエンドのURLを環境変数から取得
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000/api/ranking";

const PopUpC: React.FC<PopUpProps> = ({ onClose }) => {
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // コンポーネントがマウントされた時に一度だけデータを取得
  useEffect(() => {
    // データの取得を非同期で行う関数
    const fetchScores = async () => {
      try {
        setIsLoading(true);
        // バックエンドからデータを取得
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const sortedScores = data.sort((a: PlayerScore, b: PlayerScore) => b.score - a.score);
        setScores(sortedScores);
      } catch (error) {
        console.error("データの取得に失敗しました", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScores();
  }, []); // 依存配列が空なので、コンポーネントが最初に表示された時（マウント時）に一度だけ実行される

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
