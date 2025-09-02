import React from 'react';
import { useParams } from 'react-router-dom';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>(); // URLからroomIdを取得

  return (
    <div>
      <h1>ゲーム画面</h1>
      <p>ルームID: {roomId} に入室しました！</p>
      {/* ここにゲームのUIを実装 */}
    </div>
  );
};

export default GamePage;