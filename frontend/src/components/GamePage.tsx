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

  // 新しいContextから、アプリ全体のWebSocketの状態と関数を取得
  const wsContext = useContext(WebSocketContext);
  
  // このページが表示されたとき、または接続状態が変わったときに一度だけ実行
  useEffect(() => {
    // Contextが利用可能で、接続が確立しており、IDも確定していたらjoinRoomメッセージを送信
    if (wsContext && wsContext.isConnected && roomId && myPlayerId) {
      wsContext.sendMessage('joinRoom', { roomId, playerId: myPlayerId });
    }
  }, [wsContext, wsContext?.isConnected, roomId, myPlayerId]); // これらの値が変わるたびに再評価

  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isRankingPopupOpen, setRankingPopupOpen] = useState(false);

  // ContextやIDが準備できるまではローディング表示
  if (!wsContext || !myPlayerId) {
    return <div>プレイヤー情報を読み込み中...</div>;
  }
  
  // Contextから必要なものを分割代入で取り出す
  const { roomState, sendMessage } = wsContext;

  const handleSelectMode = (mode: 'tutorial' | 'timeAttack' | 'circuitPrediction') => {
    if (myPlayerId && roomId) {
      sendMessage('selectGameMode', { roomId, playerId: myPlayerId, mode });
    }
  };

  const handleStartGame = () => {
    const selectedMode = roomState?.playerChoices?.[myPlayerId!];
    if (selectedMode && myPlayerId && roomId) {
      // サーバーに 'startGame' メッセージを送るだけ (遷移はContextが担当)
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

  // roomStateがまだサーバーから届いていない場合もローディング表示
  if (!roomState) {
    return <div>ルーム情報を読み込み中...</div>;
  }
  
  const isHost = roomState.hostId === myPlayerId;
  const canStartGame = isHost && !!(roomState.playerChoices && roomState.playerChoices[myPlayerId]);

  const getPlayersForMode = (mode: string) => {
    if (!roomState.playerChoices) {
      return [];
    }
    return roomState.players.filter(p => roomState.playerChoices[p.id] === mode);
  };

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
          <h2>ゲームモードを選択</h2>
          <div className="mode-options">
            <button onClick={() => handleSelectMode('tutorial')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'tutorial' ? 'my-choice' : ''}`}>
              チュートリアル
              <div className="voters">
                {getPlayersForMode('tutorial').map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>
            <button onClick={() => handleSelectMode('timeAttack')} className={`mode-option ${roomState.playerChoices?.[myPlayerId] === 'timeAttack' ? 'my-choice' : ''}`}>
              タイムアタック
              <div className="voters">
                {getPlayersForMode('timeAttack').map(p => (
                  <span key={p.id} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>
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
            {[...Array(4)].map((_, index) => {
              const player = roomState.players.find(p => p.playerOrder === index + 1);
              return (
                <div key={index} className={`player-slot ${player ? 'active' : 'inactive'}`}>
                  <span className="player-order-label">{index + 1}P</span>
                  <span className="player-name">{player ? ` ` : '待機中...'}</span>
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

