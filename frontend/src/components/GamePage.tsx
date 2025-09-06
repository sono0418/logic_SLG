// src/components/GamePage.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PopUpB from './Popups/PopUpB';
import PopUpC from './Popups/PopUpC';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import { WebSocketContext } from '../contexts/WebSocketContext';
import './GamePage.css';

type Mode = 'tutorial' | 'timeAttack' | 'circuitPrediction';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const myPlayerId = useContext(PlayerIdContext);
  const navigate = useNavigate();
  const wsContext = useContext(WebSocketContext);

  // UI
  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isRankingPopupOpen, setRankingPopupOpen] = useState(false);

  // 「はじめる」二度押し防止 & gameStart 直後の一瞬の再レンダリング耐性
  const [isStarting, setIsStarting] = useState(false);

  // ===== 入室処理：接続が確立したら一度だけ実行 =====
  useEffect(() => {
    if (!wsContext || !roomId) return;
    if (wsContext.isConnected) {
      wsContext.joinRoom(roomId);
    }
    // 依存は isConnected と roomId のみ（wsContext の参照変化で何度も走らないように）
  }, [wsContext?.isConnected, roomId]);

  // ===== Context 未準備時はローディング =====
  if (!wsContext || !myPlayerId) {
    return <div>接続中...</div>;
  }

  const { roomState, sendMessage } = wsContext;

  // ===== 安全な取り出し（必ずデフォルト値にフォールバック）=====
  const players = useMemo(
    () => (Array.isArray(roomState?.players) ? roomState!.players : []),
    [roomState?.players]
  );

  const playerChoices: Record<string, Mode> = useMemo(() => {
    const pc = roomState?.playerChoices;
    return pc && typeof pc === 'object' ? (pc as Record<string, Mode>) : {};
  }, [roomState?.playerChoices]);

  const roomIdSafe = roomState?.roomId ?? roomId ?? '---';
  const isHost = roomState?.hostId === myPlayerId;

  // host かつ自分の選択が入っている時のみ開始可能
  const canStartGame = isHost && !!playerChoices[myPlayerId] && !isStarting;

  // ===== ハンドラ =====
  const handleSelectMode = (mode: Mode) => {
    if (!roomId || !myPlayerId) return;
    // roomState が未整備でも送信はできるが、画面は防御描画にしておく
    sendMessage('selectGameMode', { roomId, playerId: myPlayerId, mode });
  };

  const handleStartGame = () => {
    if (!roomId || !myPlayerId) return;
    const selectedMode = playerChoices[myPlayerId];
    if (!selectedMode) return;

    setIsStarting(true); // 直後の再描画で UI が空になっても安全
    sendMessage('startGame', { roomId, playerId: myPlayerId, mode: selectedMode });

    // 安全策：即時の再レンダリングで GamePage が再描画されても落ちないよう、
    // 少しの間だけ開始中 UI を維持。navigate は Context 側(gameStart受信時)で行う前提。
    // もし navigate をここで行う設計に変える場合は、Context では navigate しないよう片方に寄せる。
    setTimeout(() => {
      // 何もせず、Context の gameStart → navigate を待つ
      // （navigate を二重にしないためのダミー。必要ならここでガード付き navigate も可）
    }, 0);
  };

  const handleExitRoom = () => {
    if (myPlayerId && roomId) {
      sendMessage('exitRoom', { roomId, playerId: myPlayerId });
    }
    navigate('/');
  };

  const handleCopyRoomId = () => {
    if (!roomIdSafe) return;
    navigator.clipboard.writeText(String(roomIdSafe)).then(() => {
      alert('ルームIDをコピーしました！');
    });
  };

  // ===== Helper =====
  const getPlayersForMode = (mode: Mode) => {
    // players / playerChoices が未定義でも安全
    return players.filter((p) => playerChoices[p.id] === mode);
  };

  // ===== 画面描画（常に防御的）=====
  return (
    <div className="game-selection-container">
      <header className="page-header">
        <h1>ゲーム選択</h1>
        <div className="room-id-display">
          <span>ルームID: {roomIdSafe}</span>
          <button onClick={handleCopyRoomId}>コピー</button>
        </div>
      </header>

      <main className="main-content">
        <section className="game-mode-section">
          <h2>ゲームモードを選択</h2>

          <div className={`mode-options ${isStarting ? 'is-starting' : ''}`}>
            <button
              onClick={() => handleSelectMode('tutorial')}
              className={`mode-option ${playerChoices[myPlayerId] === 'tutorial' ? 'my-choice' : ''}`}
              disabled={isStarting}
            >
              チュートリアル
              <div className="voters">
                {(getPlayersForMode('tutorial') ?? []).map((p) => (
                  <span key={p.id} className="selector-icon">
                    {p.playerOrder}P
                  </span>
                ))}
              </div>
            </button>

            <button
              onClick={() => handleSelectMode('timeAttack')}
              className={`mode-option ${playerChoices[myPlayerId] === 'timeAttack' ? 'my-choice' : ''}`}
              disabled={isStarting}
            >
              タイムアタック
              <div className="voters">
                {(getPlayersForMode('timeAttack') ?? []).map((p) => (
                  <span key={p.id} className="selector-icon">
                    {p.playerOrder}P
                  </span>
                ))}
              </div>
            </button>

            <button
              onClick={() => handleSelectMode('circuitPrediction')}
              className={`mode-option ${playerChoices[myPlayerId] === 'circuitPrediction' ? 'my-choice' : ''}`}
              disabled={isStarting}
            >
              回路予測
              <div className="voters">
                {(getPlayersForMode('circuitPrediction') ?? []).map((p) => (
                  <span key={p.id} className="selector-icon">
                    {p.playerOrder}P
                  </span>
                ))}
              </div>
            </button>
          </div>

          {isStarting && (
            <p className="starting-hint">ゲームを開始しています…しばらくお待ちください</p>
          )}
        </section>

        <div className="actions-bar">
          <div className="utility-buttons">
            <button onClick={() => setNotePopupOpen(true)} disabled={isStarting}>
              ノート
            </button>
            <button onClick={() => setRankingPopupOpen(true)} disabled={isStarting}>
              ランキング
            </button>
            <button onClick={handleExitRoom} disabled={isStarting}>
              部屋から退出
            </button>
          </div>

          <div className="start-section">
            <button
              className="start-button"
              onClick={handleStartGame}
              disabled={!canStartGame}
              aria-busy={isStarting}
            >
              {isStarting ? 'はじめる（準備中…）' : 'はじめる'}
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
              const player = players.find((p) => p.playerOrder === index + 1);
              return (
                <div key={index} className={`player-slot ${player ? 'active' : 'inactive'}`}>
                  <span className="player-order-label">{index + 1}P</span>
                  <span className="player-name">
                    {player ? `Player ${player.playerOrder}` : '待機中...'}
                  </span>
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
