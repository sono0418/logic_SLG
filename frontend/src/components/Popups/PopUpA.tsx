// src/components/Popups/PopUpA.tsx
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PopUp.css';
import { PlayerIdContext } from '../../contexts/PlayerIdContext';

interface PopUpProps {
  onClose: () => void;
}

const PopUpA: React.FC<PopUpProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const myPlayerId = useContext(PlayerIdContext);

  if (!myPlayerId) {
    // プレイヤーIDが取得できていない場合は何もしない
    return null;
  }

  // 新しいルームを作成し、入室する
  const handleCreateRoom = async () => {
    try {
      // ① HTTP APIでルーム作成リクエストを送信
      const response = await axios.post('/api/createRoom', { playerId: myPlayerId });
      const { roomId } = response.data;
      console.log(`ルーム ${roomId} を作成しました。`);
      // ② サーバーからの成功レスポンスを受けてから遷移
      navigate(`/game/${roomId}`);
      onClose(); // ポップアップを閉じる
    } catch (error) {
      console.error('ルーム作成に失敗しました:', error);
      alert('ルーム作成に失敗しました。');
    }
  };

  // 既存のルームに入室する
  const handleJoinRoom = async () => {
    if (!inputRoomId.trim()) {
      return;
    }
    try {
      // ① HTTP APIでルーム入室リクエストを送信
      await axios.post('/api/joinRoom', { roomId: inputRoomId.trim(), playerId: myPlayerId });
      console.log(`ルーム ${inputRoomId.trim()} に入室しました。`);
      // ② サーバーからの成功レスポンスを受けてから遷移
      navigate(`/game/${inputRoomId.trim()}`);
      onClose(); // ポップアップを閉じる
    } catch (error) {
      console.error('ルーム入室に失敗しました:', error);
      alert('ルーム入室に失敗しました。ルームIDを確認してください。');
    }
  };

  // ... (既存のコードは変更なし) ...
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputRoomId(text);
    } catch (err) {
      console.error('クリップボードの読み取りに失敗しました: ', err);
      alert('ペーストに失敗しました。');
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>マルチプレイ</h2>
        <div className="PopupA">
          <div className='content-left'>
            <h3>ルーム作成</h3>
            <button className='redbutton' onClick={handleCreateRoom}>
              作成
            </button>
          </div>
          <div className='content-right'>
            <h3>ルーム入室</h3>
            <div className = "input-with-button">
              <input
                type="text"
                placeholder="ルームID"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
              />
              <button className='paste-button' onClick={handlePaste}>貼付</button>
            </div>
            <button className='bluebutton' onClick={handleJoinRoom} disabled={!inputRoomId.trim()}>
              入室
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopUpA;