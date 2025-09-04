// src/components/GamePage.tsx

import React from 'react';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
// import './GamePage.css';

const GamePage: React.FC = () => {
  const roomId = 'ROOM1234';
  const myPlayerId = 'player-1'; 
  const maxPlayers = 4;

  const { roomState, sendMessage } = useGameWebSocket(roomId, myPlayerId);

  // ... (handle functions are the same) ...
  const handleSelectMode = (mode: 'tutorial' | 'timeAttack' | 'circuitPrediction') => {
    sendMessage('selectGameMode', { roomId, playerId: myPlayerId, mode });
  };
  const handleStartGame = () => {
    const selectedMode = roomState?.playerChoices?.[myPlayerId];
    if (selectedMode) {
      sendMessage('requestStartGame', { roomId, playerId: myPlayerId, mode: selectedMode });
    }
  };
  const handleExitRoom = () => alert('退出機能');
  const handleCopyRoomId = () => navigator.clipboard.writeText(roomId).then(() => alert('ルームIDをコピーしました！'));

  if (!roomState) {
    return <div>ルーム情報を読み込み中...</div>;
  }
  
  const isHost = roomState.hostId === myPlayerId;
  // ✨ 修正点 1: playerChoicesが存在するかチェックしてからアクセスする
  const canStartGame = isHost && !!(roomState.playerChoices && roomState.playerChoices[myPlayerId]);

  // ✨ 修正点 2: playerChoicesが存在しない場合を考慮する
  const getPlayersForMode = (mode: string) => {
    if (!roomState.playerChoices) {
      return []; // playerChoicesがなければ空の配列を返す
    }
    return roomState.players.filter(p => roomState.playerChoices[p.id] === mode);
  };

  return (
    <div className="game-selection-container">
      {/* ... (JSX部分は変更なし) ... */}
      <header className="page-header">
        <div className="room-id-display">
          <span>ルームID: {roomState.roomId}</span>
          <button onClick={handleCopyRoomId}>コピー</button>
        </div>
      </header>
      <main className="main-content">
        <section className="game-mode-section">
          <h2>ゲームモードを選択</h2>
          <div className="mode-options">
            {/* チュートリアル */}
            <button onClick={() => handleSelectMode('tutorial')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'tutorial' ? 'my-choice' : ''}`}>
              チュートリアル
              <div className="voters">
                {getPlayersForMode('tutorial').map(p => <span key={p.id} className="selector-icon">{p.playerOrder}P</span>)}
              </div>
            </button>
            {/* タイムアタック */}
            <button onClick={() => handleSelectMode('timeAttack')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'timeAttack' ? 'my-choice' : ''}`}>
              タイムアタック
              <div className="voters">
                {getPlayersForMode('timeAttack').map(p => <span key={p.id} className="selector-icon">{p.playerOrder}P</span>)}
              </div>
            </button>
            {/* 回路予測 */}
            <button onClick={() => handleSelectMode('circuitPrediction')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'circuitPrediction' ? 'my-choice' : ''}`}>
              回路予測
              <div className="voters">
                {getPlayersForMode('circuitPrediction').map(p => <span key={p.id} className="selector-icon">{p.playerOrder}P</span>)}
              </div>
            </button>
          </div>
        </section>
        <div className="actions-bar">
          <div className="utility-buttons">
            <button>ノート</button>
            <button>ランキング</button>
            <button onClick={handleExitRoom}>部屋から退出</button>
          </div>
          <div className="start-section">
            <button className="start-button" onClick={handleStartGame} disabled={!canStartGame}>
              はじめる
            </button>
            {!isHost && <p className="host-notice">ゲームの開始は1Pのみ行えます</p>}
          </div>
        </div>
      </main>
      <footer className="page-footer">
        <section className="player-status-section">
          <div className="player-slots">
            {[...Array(maxPlayers)].map((_, index) => {
              const player = roomState.players.find(p => p.playerOrder === index + 1);
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