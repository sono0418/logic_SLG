// src/components/GamePage.tsx
import React, { useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import PopUpB from './Popups/PopUpB';
import PopUpC from './Popups/PopUpC';
import './GamePage.css';
import axios from 'axios'; // axiosをインポート

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const myPlayerId = useContext(PlayerIdContext);
  const maxPlayers = 4;

  // ルームIDとプレイヤーIDがなければローディング表示
  if (!roomId || !myPlayerId) {
    return <div>プレイヤー情報を読み込み中...</div>;
  }

  // WebSocketフックから状態とメッセージ送信関数を取得
  const { roomState, sendMessage } = useGameWebSocket(roomId!, myPlayerId);
  const navigate = useNavigate();
  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isRankingPopupOpen, setRankingPopupOpen] = useState(false);

  // roomStateがまだ読み込めていない場合はローディング表示
  if (!roomState) {
    return <div>ルーム情報を読み込み中...</div>;
  }

  // ゲームモード選択時の処理
  const handleSelectMode = (mode: string) => {
    sendMessage('selectGameMode', { roomId, playerId: myPlayerId, mode });
  };

  // 部屋から退出する際の処理（HTTP APIを呼び出し）
  const handleExitRoom = async () => {
    try {
      await axios.post(`/api/exitRoom`, { roomId: roomId!, playerId: myPlayerId });
      // トップページに遷移
      navigate('/');
    } catch (error) {
      console.error('部屋から退出できませんでした:', error);
      alert('退出処理に失敗しました。');
    }
  };

  // ゲームを開始する際の処理（HTTP APIを呼び出し）
  const handleStartGame = async () => {
    const selectedMode = roomState?.playerChoices?.[myPlayerId];
    if (selectedMode) {
      try {
        await axios.post(`/api/startGame`, { roomId, playerId: myPlayerId, mode: selectedMode });
        // API呼び出しが成功したら、次のページに遷移
        navigate(`/play/${selectedMode}/${roomId}`);
      } catch (error) {
        console.error('ゲームを開始できませんでした:', error);
        alert('ゲーム開始に失敗しました。');
      }
    }
  };

  // ルームIDをクリップボードにコピー
  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).then(() => {
        alert('ルームIDをコピーしました！');
      });
    }
  };

  // ホストかどうかの判定
  const isHost = roomState.hostId === myPlayerId;
  // ゲームを開始できる条件
  const canStartGame = isHost && !!(roomState.playerChoices && roomState.playerChoices[myPlayerId]);

  // 特定のモードを選択したプレイヤーをフィルタリング
  const getPlayersForMode = (mode: string) => {
    if (!roomState.playerChoices) {
      return [];
    }
    return roomState.players.filter(p => roomState.playerChoices[p.id] === mode);
  };

  // JSXのレンダリング
  return (
    <div className="game-selection-container">
      <header className="page-header">
        <div className="room-id-display">
          <span>ルームID: {roomState.roomId}</span>
          <button onClick={handleCopyRoomId}>コピー</button>
        </div>
      </header>
      <main className="main-content">
        <section className="game-mode-section">
          <div className="mode-options">
            {/* チュートリアルモード選択ボタン */}
            <button onClick={() => handleSelectMode('tutorial')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'tutorial' ? 'my-choice' : ''}`}>
              チュートリアル
              <div className="voters">
                {getPlayersForMode('tutorial').map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>

            {/* タイムアタックモード選択ボタン */}
            <button onClick={() => handleSelectMode('timeAttack')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'timeAttack' ? 'my-choice' : ''}`}>
              タイムアタック
              <div className="voters">
                {getPlayersForMode('timeAttack').map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>

            {/* 回路予測モード選択ボタン */}
            <button onClick={() => handleSelectMode('circuitPrediction')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'circuitPrediction' ? 'my-choice' : ''}`}>
              回路予測
              <div className="voters">
                {getPlayersForMode('circuitPrediction').map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>
          </div>
        </section>
        <div className="actions-bar">
          <div className="utility-buttons">
            <button onClick={() => setNotePopupOpen(true)}>ノート</button>
            <button onClick={() => setRankingPopupOpen(true)}>ランキング</button>
            <button onClick={handleExitRoom}>部屋から退出</button>
          </div>
          <div className="start-section">
            <button className="start-button" onClick={handleStartGame} disabled={!canStartGame}>
              はじめる
            </button>
            {!isHost && <p className="host-notice">ゲームの開始は1Pのみ行えます</p>}
          </div>
        </div>
        {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />}
        {isRankingPopupOpen && <PopUpC onClose={() => setRankingPopupOpen(false)} />}
      </main>
      <footer className="page-footer">
        <section className="player-status-section">
          <div className="player-slots">
            {[...Array(maxPlayers)].map((_, index) => {
              const player = roomState.players.find(p => p.playerOrder === index + 1);
              return (
                <div key={index} className={`player-slot ${player ? 'active' : 'inactive'}`}>
                  <span className="player-order-label">{index + 1}P</span>
                  <span className="player-name">{player ? ` `: '待機中...'}</span>
                </div>
              );
            })}
          </div>
        </section>
      </footer>
    </div>
  );
};

export default GamePage;