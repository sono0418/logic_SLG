import React from 'react';
import { useParams } from 'react-router-dom';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>(); // URLからroomIdを取得
  return (
    <div>
      <h1>ルームID: {roomId} </h1>
      {/* ここにゲームのUIを実装 */}
    </div>
  );
};

export default GamePage;