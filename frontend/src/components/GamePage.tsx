// src/components/GamePage.tsx
import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import type { GameState } from '../hooks/useGameWebSocket'; // GameState を type import
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import PopUpB from './Popups/PopUpB';
import PopUpC from './Popups/PopUpC';
import './GamePage.css';
// import GameComponent from './GameComponent'; // ゲーム画面への遷移は useEffect で行うため不要
// import TutorialPage from './TutorialPage'; // ゲーム画面への遷移は useEffect で行うため不要

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const myPlayerId = useContext(PlayerIdContext);
  const maxPlayers = 4; // 最大プレイヤー数
  const { gameState, sendMessage } = useGameWebSocket(roomId, myPlayerId); // roomId が undefined の可能性も考慮
  const navigate = useNavigate();
  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isRankingPopupOpen, setRankingPopupOpen] = useState(false);

  // ゲーム状態に応じた画面遷移
  useEffect(() => {
    // デバッグ用ログ (必要に応じてコメント解除)
    // console.log("useEffect running. Current gameState:", gameState);
    // console.log(
    //   "useEffect checking status:", gameState?.status,
    //   "isTutorial:", gameState?.currentQuestion?.isTutorial
    // );

    // gameState が存在し、ステータスが 'inProgress' になったら実行
    if (gameState?.status === 'inProgress') {
      // チュートリアルモードかどうかを判定
      // gameState.currentQuestion?.isTutorial が true の場合にチュートリアル画面へ
      if (gameState.currentQuestion?.isTutorial) { // isTutorial フラグを確認
        console.log("Navigating to Tutorial Page...");
        navigate(`/play/tutorial/${roomId}`);
      } else {
        // 通常モードの場合 (現在は未実装とのこと)
        console.log("Navigating to Standard Game Page (Not Implemented Yet)...");
        // navigate(`/play/standard/${roomId}`); // 例: 通常ゲーム用のルート
      }
    }
    // gameState.status または gameState.currentQuestion.isTutorial が変更されたらこのeffectを再実行
  }, [gameState?.status, gameState?.currentQuestion?.isTutorial, navigate, roomId]); // 依存配列


  // ローディング表示: gameState がまだない、または roomId/myPlayerId がない場合
  if (!roomId || !myPlayerId || !gameState) {
    return <div>ルーム情報を読み込み中...</div>;
  }

  // --- ハンドラ関数 ---
  const handleSelectMode = (mode: 'tutorial' | 'timeAttack' | 'circuitPrediction') => {
    // すでにゲームが始まっていたらモード選択は送らない (任意)
    if (gameState?.status !== 'waiting') return;
    sendMessage('selectGameMode', { roomId, playerId: myPlayerId, mode });
  };

  const handleExitRoom = () => {
    sendMessage('exitRoom', { roomId, playerId: myPlayerId });
    navigate('/'); // トップページに遷移
  };

  const handleStartGame = () => {
    // 自分の選択したモードを取得
    const selectedMode = gameState?.playerChoices?.[myPlayerId];
    // モードが選択されていて、かつ待機中の場合のみゲーム開始
    if (selectedMode && gameState?.status === 'waiting') {
      sendMessage('startGame', { roomId, playerId: myPlayerId, mode: selectedMode });
    }
  };

  const handleCopyRoomId = () => {
    if (roomId){
      navigator.clipboard.writeText(roomId).then(() => {
        alert('ルームIDをコピーしました！');
      }).catch(err => {
        console.error('ルームIDのコピーに失敗しました:', err); // エラーハンドリング
        alert('ルームIDのコピーに失敗しました。');
      });
    }
  };
  // --- ここまでハンドラ関数 ---

  // --- データ準備 (レンダリング用) ---
  const isHost = gameState.hostId === myPlayerId;
  // 開始ボタン有効化条件: ホストであり、かつ自分がモード選択済みであること
  const canStartGame = isHost && !!(gameState?.playerChoices?.[myPlayerId]);

  // 特定モードを選択中のプレイヤーリストを取得する関数
  const getPlayersForMode = (mode: string): GameState['players'] => { // 戻り値の型を明示
    // gameState や playerChoices が存在しない場合は空配列を返す
    if (!gameState?.playerChoices) {
      return [];
    }
    const choices = gameState.playerChoices;
    // filter 内で choices の存在確認と playerId を使用
    return gameState.players.filter(p => choices && choices[p.playerId] === mode);
  };
  // --- ここまでデータ準備 ---

  // --- レンダリング ---
  // status が 'inProgress' の場合は useEffect によって画面遷移するので、
  // ここでは 'waiting' 状態の表示のみを返せば良い
  return (
    <div className="game-selection-container">
      {/* --- ヘッダー --- */}
      <header className="page-header">
        <div className="room-id-display">
          <span>ルームID: {gameState.roomId}</span>
          <button onClick={handleCopyRoomId}>コピー</button>
        </div>
      </header>

      {/* --- メインコンテンツ --- */}
      <main className="main-content">
        {/* --- ゲームモード選択 --- */}
        <section className="game-mode-section">
          <h2>モード選択</h2> {/* 見出しを追加 (任意) */}
          <div className="mode-options">
            {/* Tutorial Button */}
            <button
              onClick={() => handleSelectMode('tutorial')}
              // ▼▼▼ クラス名 `btn-red` を追加 ▼▼▼
              className={`mode-option btn-red ${gameState.playerChoices?.[myPlayerId] === 'tutorial' ? 'my-choice' : ''}`}
            >
              チュートリアル
              <div className="voters">
                {getPlayersForMode('tutorial').map(p => (
                  <span key={p.playerId} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>

            {/* Time Attack Button */}
            <button
              onClick={() => handleSelectMode('timeAttack')}
              // ▼▼▼ クラス名 `btn-green` を追加 ▼▼▼
              className={`mode-option btn-green ${gameState.playerChoices?.[myPlayerId] === 'timeAttack' ? 'my-choice' : ''}`}
            >
              タイムアタック
              <div className="voters">
                {getPlayersForMode('timeAttack').map(p => (
                  <span key={p.playerId} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>

            {/* Circuit Prediction Button */}
            <button
              onClick={() => handleSelectMode('circuitPrediction')}
              // ▼▼▼ クラス名 `btn-blue` を追加 ▼▼▼
              className={`mode-option btn-blue ${gameState.playerChoices?.[myPlayerId] === 'circuitPrediction' ? 'my-choice' : ''}`}
            >
              回路予測
              <div className="voters">
                {getPlayersForMode('circuitPrediction').map(p => (
                  <span key={p.playerId} className="selector-icon">{p.playerOrder}P</span>
                ))}
              </div>
            </button>
          </div>
        </section>

        {/* --- 操作ボタンエリア --- */}
        <div className="actions-bar">
          <div className="utility-buttons">
            {/* ▼▼▼ クラス名 `btn-green` を追加 ▼▼▼ */}
            <button className="btn-green" onClick={() => setNotePopupOpen(true)}>ノート</button>
            {/* ▼▼▼ クラス名 `btn-blue` を追加 ▼▼▼ */}
            <button className="btn-blue" onClick={() => setRankingPopupOpen(true)}>ランキング</button>
            {/* ▼▼▼ クラス名 `btn-red` を追加 ▼▼▼ */}
            <button className="btn-red" onClick={handleExitRoom}>部屋から退出</button>
          </div>
          <div className="start-section">
            {/* ▼▼▼ クラス名 `btn-red` を追加 ▼▼▼ */}
            <button
              className="start-button btn-red"
              onClick={handleStartGame}
              disabled={!canStartGame} // canStartGame で制御
            >
              はじめる
            </button>
            {/* ホストでない、かつゲームが始まっていない場合のみ注意書きを表示 */}
            {!isHost && gameState.status === 'waiting' && <p className="host-notice">ゲームの開始は1Pのみ行えます</p>}
          </div>
        </div>

        {/* --- ポップアップ --- */}
        {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />}
        {isRankingPopupOpen && <PopUpC onClose={() => setRankingPopupOpen(false)} />}
      </main>

      {/* --- フッター (プレイヤー表示) --- */}
      <footer className="page-footer">
        <section className="player-status-section">
          <h2>プレイヤー</h2> {/* 見出しを追加 (任意) */}
          <div className="player-slots">
            {[...Array(maxPlayers)].map((_, index) => {
              // gameState.players が存在するか確認
              const player = gameState.players?.find(p => p.playerOrder === index + 1);
              return (
                <div key={index} className={`player-slot ${player ? 'active' : 'inactive'}`}>
                  <span className="player-order-label">{index + 1}P</span>
                  {/* プレイヤー名表示 (自分の場合は強調表示などしても良い) */}
                  <span className={`player-name ${player?.playerId === myPlayerId ? 'my-player' : ''}`}>
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