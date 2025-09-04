import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PopUp.css';

interface PopUpProps {
  onClose: () => void;
}

const PopUpA: React.FC<PopUpProps> = ({ onClose }) => {
  const navigate = useNavigate(); // React Routerのナビゲーションフック
  const [inputRoomId, setInputRoomId] = useState<string>('');

  // 新しいルームIDを生成する
  const generateRoomId = (): string => {
    const min = 10000;
    const max = 99999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  };

  //ルーム作成→入室処理
  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    navigate(`/game/${newRoomId}`);
  };

  //ルームID入力→入室処理
  const handleJoinRoom = () => {
    if (inputRoomId.trim()) {
      navigate(`/game/${inputRoomId.trim()}`);
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
            <input
              type="text"
              placeholder="ルームID"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
            />
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
