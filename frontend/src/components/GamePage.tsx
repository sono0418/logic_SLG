// src/components/GamePage.tsx
import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PopUpB from './Popups/PopUpB';
import PopUpC from './Popups/PopUpC';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import { WebSocketContext } from '../contexts/WebSocketContext';
import './GamePage.css';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const myPlayerId = useContext(PlayerIdContext);
  const navigate = useNavigate();
  const wsContext = useContext(WebSocketContext);

  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isRankingPopupOpen, setRankingPopupOpen] = useState(false);

  // 入室処理
  useEffect(() => {
    if (wsContext && wsContext.isConnected && roomId) {
      wsContext.joinRoom(roomId);
    }
  }, [wsContext, wsContext?.isConnected, roomId]);

  if (!wsContext || !myPlayerId) {
    return <div>接続中...</div>;
  }

  const { roomState, sendMessage } = wsContext;

  // --- イベントハンドラ ---
  const handleSelectMode = (mode: 'tutorial' | 'timeAttack' | 'circuitPrediction') => {
    if (myPlayerId && roomId) {
      sendMessage('selectGameMode', { roomId, playerId: myPlayerId, mode });
    }
  };

  const handleStartGame = () => {
    const selectedMode = roomState?.playerChoices?.[myPlayerId!];
    if (selectedMode && myPlayerId && roomId) {
      sendMessage('startGame', { roomId, playerId: myPlayerId, mode: selectedMode });
    }
  };

  const handleExitRoom = () => {
    if (myPlayerId && roomId) {
      sendMessage('exitRoom', { roomId, playerId: myPlayerId });
    }
    navigate('/');
  };

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).then(() => {
        alert('ルームIDをコピーしました！');
      });
    }
  };

  // --- roomState が揃っていないときはローディング ---
  if (!roomState || !roomState.players) {
    return <div>ルーム情報を読み込み中...</div>;
  }

  // --- 安全にプロパティを参照 ---
  const players = roomState.players ?? [];
  const playerChoices = roomState.playerChoices ?? {};

  const isHost = roomState.hostId === myPlayerId;
  const canStartGame = isHost && !!playerChoices[myPlayerId];

  const getPlayersForMode = (mode: string) => {
    return players.filter(p => playerChoices[p.id] === mode);
  };

  return (
    <div className="game-selection-container">
      <header className="page-header">
        <h1>ゲーム選択</h1>
        <div className="room-id-display">
          <span>ルームID: {roomState.roomId ?? '---'}</span>
          <button onClick={handleCopyRoomId}>コピー</button>
        </div>
      </header>
      <main className="main-content">
        <section className="game-mode-section">
          <h2>ゲームモードを選択</h2>
          <div className="mode-options">
            <button
              onClick={() => handleSelectMode('tutorial')}
              className={`mode-option ${playerChoices[myPlayerId] === 'tutorial' ? 'my-choice' : ''}`}
            >
              チュートリアル
              <div className="voters">
                {(getPlayersForMode('tutorial') ?? []).map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>
            <button
              onClick={() => handleSelectMode('timeAttack')}
              className={`mode-option ${playerChoices[myPlayerId] === 'timeAttack' ? 'my-choice' : ''}`}
            >
              タイムアタック
              <div className="voters">
                {(getPlayersForMode('timeAttack') ?? []).map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>
            <button
              onClick={() => handleSelectMode('circuitPrediction')}
              className={`mode-option ${playerChoices[myPlayerId] === 'circuitPrediction' ? 'my-choice' : ''}`}
            >
              回路予測
              <div className="voters">
                {(getPlayersForMode('circuitPrediction') ?? []).map(p => (
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
            <button className="start-button" onClick={handleStartGame} disabled={!canStartGame}>はじめる</button>
            {!isHost && <p className="host-notice">ゲームの開始は1Pのみ行えます</p>}
          </div>
        </div>
        {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />}
        {isRankingPopupOpen && <PopUpC onClose={() => setRankingPopupOpen(false)} />}
      </main>
      <footer className="page-footer">
        <section className="player-status-section">
          <div className="player-slots">
            {[...Array(4)].map((_, index) => {
              const player = players.find(p => p.playerOrder === index + 1);
              return (
                <div key={index} className={`player-slot ${player ? 'active' : 'inactive'}`}>
                  <span className="player-order-label">{index + 1}P</span>
                  <span className="player-name">{player ? `Player ${player.playerOrder}` : '待機中...'}</span>
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
