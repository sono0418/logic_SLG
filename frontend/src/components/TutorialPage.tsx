import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import PopUpB from './Popups/PopUpB';
import PopUpTR from './Popups/PopUpTR';

const TutorialPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const myPlayerId = useContext(PlayerIdContext);

  const { gameState, sendMessage } = useGameWebSocket(roomId!, myPlayerId!);

  const [gamePhase, setGamePhase] = useState<'loading' | 'starting' | 'playing'>('loading');
  const [timer, setTimer] = useState(0);
  // 修正点: useStateの変数名とセッター関数名を正しく対応させました
  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isResultPopupOpen, setResultPopupOpen] = useState(false);

  // ... (useEffectフックは変更なし) ...
  useEffect(() => {
    if (gameState.currentQuestion) {
      const loadingTimeout = setTimeout(() => { setGamePhase('starting'); }, 2000);
      const startingTimeout = setTimeout(() => { setGamePhase('playing'); }, 3000);
      return () => {
        clearTimeout(loadingTimeout);
        clearTimeout(startingTimeout);
      };
    }
  }, [gameState.currentQuestion]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (gamePhase === 'playing' && !gameState.isGameFinished) {
      intervalId = setInterval(() => { setTimer(prevTimer => prevTimer + 1); }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [gamePhase, gameState.isGameFinished]);

  useEffect(() => {
    if (gameState.isGameFinished) {
      setResultPopupOpen(true); // 修正点: 正しいセッター関数を使用
    }
  }, [gameState.isGameFinished]);

  const isMyTurn = gameState.currentPlayerId === myPlayerId;
  //const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
  const totalSteps = (gameState.currentQuestion?.circuit.length ?? 0) + 1; // 入力段も含む
  const currentStepIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
  const currentGate = currentStepIndex > 0 ? gameState.currentQuestion?.circuit[currentStepIndex - 1] : null;

  const handleInput = (value: boolean) => {
    if (!isMyTurn) return;
    sendMessage('playerInput', { roomId, playerId: myPlayerId, inputValue: value });
  };
  const handleCloseResultPopup = () => {
    setResultPopupOpen(false); // ✨ 修正点: 正しいセッター関数を使用
    navigate(`/game/${roomId}`);
  };


  if (!gameState.currentQuestion) {
    return <div>ゲームを準備中...</div>;
  }

  return (
    <div className="game-container">
      {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />} {/* ✨ 修正点: 正しいセッター関数を使用 */}
      {isResultPopupOpen && <PopUpTR score={gameState.teamScore} onClose={handleCloseResultPopup} />}

      <header className="game-header">
        <div className="header-left">
          <h1>チュートリアル</h1>
          <span>{gameState.roundCount + 1}問目</span>
        </div>
        <div className="header-right">
          <button onClick={() => setNotePopupOpen(true)}>ノート</button> {/* ✨ 修正点: 正しいセッター関数を使用 */}
        </div>
      </header>

      <div className="status-bar">
        {gamePhase === 'loading' && <p className="status-text">通信中…</p>}
        {gamePhase === 'starting' && <p className="status-text start-text">スタート！</p>}
        {gamePhase === 'playing' && <p className="status-text timer">{`経過時間: ${timer}秒`}</p>}
      </div>

      <main className="game-main">
        <section className="progress-indicator">
          <h3>回路の進捗</h3>
          <div className="boxes">
            {[...Array(totalSteps)].map((_, index) => (
              <div key={index} className={`box ${index === currentStepIndex ? 'active' : ''}`}></div>
            ))}
          </div>
        </section>

        <section className="gate-display">
          {currentGate ? (
            <>
              <h4>{currentStepIndex}段目: {currentGate} ゲート</h4>
              <div className="gate-diagram">
                <span>入力</span> → <span className="gate-box">{currentGate}</span> → <span>出力</span>
              </div>
            </>
          ) : (
            <h4>最初の入力</h4>
          )}
          
          <div className="input-controls">
            <button onClick={() => handleInput(true)} disabled={!isMyTurn}>T</button>
            <button onClick={() => handleInput(false)} disabled={!isMyTurn}>F</button>
          </div>
          {!isMyTurn && <p className="wait-message">他のプレイヤーの入力を待っています...</p>}
        </section>
      </main>

      <aside className="game-sidebar">
        <h3>チームスコア</h3>
        <p className="score">{gameState.teamScore}点</p>
        <h3>プレイヤー</h3>
        <ul className="player-list">
          {gameState.players.map(player => (
            <li key={player.id} className={player.id === gameState.currentPlayerId ? 'current-turn' : ''}>
              {player.playerOrder}P
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
};

export default TutorialPage;

