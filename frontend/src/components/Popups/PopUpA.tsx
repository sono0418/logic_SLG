// src/components/Popups/PopUpA.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 親から渡されるPropsの型を定義
interface PopUpProps {
  onClose: () => void;
}

const PopUpA: React.FC<PopUpProps> = ({ onClose }) => {
  // React Routerのナビゲーションフック
  const navigate = useNavigate();

  // ルーム入室用の入力値と、APIから受け取ったIDを管理する状態
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket接続を保持する状態
  const [_ws, setWs] = useState<WebSocket | null>(null);

  // ルーム作成ボタンがクリックされた時の処理
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. HTTP APIでルームを作成
      const response = await fetch('/api/rooms', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to create room.');
      }
      const data = await response.json();
      const { roomId, playerId } = data;

      // 2. WebSocket接続を確立
      const newWs = new WebSocket('wss://logic-slg.onrender.com/');
      newWs.onopen = () => {
        const message = {
          type: 'joinRoom',
          payload: {
            roomId: roomId,
            playerId: playerId,
          },
        };
        newWs.send(JSON.stringify(message));
        console.log('ルーム作成完了。WebSocket経由で入室しました。');
      };
      setWs(newWs);

      // 3. ページを遷移
      navigate(`/game/${roomId}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // ルーム入室ボタンがクリックされた時の処理
  const handleJoinRoom = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. HTTP APIでプレイヤーIDを取得
      const BACKEND_URL = 'https://logic-slg.onrender.com';
      const response = await fetch(`${BACKEND_URL}/api/rooms/${inputRoomId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to join room. Room ID might be invalid.');
      }
      const data = await response.json();
      const { playerId } = data;

      // 2. WebSocket接続を確立
      const newWs = new WebSocket('wss://logic-slg.onrender.com/');
      newWs.onopen = () => {
        const message = {
          type: 'joinRoom',
          payload: {
            roomId: inputRoomId,
            playerId: playerId,
          },
        };
        newWs.send(JSON.stringify(message));
        console.log('ルーム入室完了。WebSocket経由で入室しました。');
      };
      setWs(newWs);

      // 3. ページを遷移
      navigate(`/game/${inputRoomId}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close-button" onClick={onClose}>
          &times;
        </button>

        <h2>マルチプレイ</h2>

        <div>
          <h3>ルーム作成</h3>
          <button onClick={handleCreateRoom} disabled={isLoading}>
            {isLoading ? '作成中...' : '作成'}
          </button>
        </div>

        <div>
          <h3>ルーム入室</h3>
          <input
            type="text"
            placeholder="ルームID"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value)}
            disabled={isLoading}
          />
          <button onClick={handleJoinRoom} disabled={isLoading || !inputRoomId}>
            {isLoading ? '入室中...' : '入室'}
          </button>
        </div>

        {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      </div>
    </div>
  );
};

export default PopUpA;