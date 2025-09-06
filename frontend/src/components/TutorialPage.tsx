import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import PopUpB from './Popups/PopUpB';
import PopUpTR from './Popups/PopUpTR';
import './TutorialPage.css';

const TutorialPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const myPlayerId = useContext(PlayerIdContext);

  // useGameWebSocketフックから、最新のゲーム状態とメッセージ送信関数を取得
  const { gameState, sendMessage } = useGameWebSocket(roomId!, myPlayerId!);

  const [gamePhase, setGamePhase] = useState<'loading' | 'starting' | 'playing'>('loading');
  const [timer, setTimer] = useState(0);
  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isResultPopupOpen, setResultPopupOpen] = useState(false);

  // (useEffectフックは変更なし)
  useEffect(() => {
    if (gameState.currentQuestion) {
      const loadingTimeout = setTimeout(() => { setGamePhase('starting'); }, 2000);
      const startingTimeout = setTimeout(() => { setGamePhase('playing'); }, 3000);
      return () => { clearTimeout(loadingTimeout); clearTimeout(startingTimeout); };
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
      setResultPopupOpen(true);
    }
  }, [gameState.isGameFinished]);


  // ✨ =================================================================
  // ✨ UI表示のための新しいヘルパーロジック
  // ✨ =================================================================
  
  // 自分自身のプレイヤー情報をgameStateから見つける
  const myPlayerData = gameState.players.find(p => p.id === myPlayerId);

  // 自分に次にやるべき仕事（ゲート）があるか探す
  let nextGateIndex: number | null = null;
  if (myPlayerData && myPlayerData.assignedGates) {
    // 担当ゲートの中で、まだ入力されていない最初のものを探す
    const nextGate = myPlayerData.assignedGates.find(gateIdx => gameState.playerInputs[gateIdx] === null);
    if (nextGate !== undefined) {
      nextGateIndex = nextGate;
    }
  }
  
  // 表示するゲートのタイプ
  const nextGateType = (nextGateIndex !== null && gameState.currentQuestion) 
    ? gameState.currentQuestion.circuit[nextGateIndex] 
    : null;


  // -- イベントハンドラの修正 --
  const handleInput = (value: boolean) => {
    // 自分の担当ゲートがなければ何もしない
    if (nextGateIndex === null) return;

    // ✨ どのゲートへの入力かを伝えるために "gateIndex" を追加
    sendMessage('playerInput', {
      roomId,
      playerId: myPlayerId,
      inputValue: value,
      gateIndex: nextGateIndex,
    });
  };

  const handleCloseResultPopup = () => {
    setResultPopupOpen(false);
    navigate(`/game/${roomId}`);
  };


  // -- レンダリング --
  if (!gameState.currentQuestion) {
    return <div>ゲームを準備中...</div>;
  }

  return (
    <div className="game-container">
      {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />}
      {isResultPopupOpen && <PopUpTR score={gameState.teamScore} onClose={handleCloseResultPopup} />}

      <header className="game-header">
        <div className="header-left">
          <h1>チュートリアル</h1>
          <span>{gameState.roundCount + 1}問目</span>
        </div>
        <div className="header-right">
          <button onClick={() => setNotePopupOpen(true)}>ノート</button>
        </div>
      </header>

      <div className="status-bar">
        {gamePhase === 'loading' && <p className="status-text">通信中…</p>}
        {gamePhase === 'starting' && <p className="status-text start-text">スタート！</p>}
        {gamePhase === 'playing' && <p className="status-text timer">{`経過時間: ${timer}秒`}</p>}
      </div>

      <div className="content-wrapper">
        <main className="game-main">
          {/* ... (進捗ボックスのロジックも将来的には更新が必要) ... */}

          <section className="gate-display">
            {/* ✨ 表示ロジックを全面的に変更 */}
            {nextGateType ? (
              <>
                <h4>あなたの次の担当: {nextGateIndex! + 1}番目の「{nextGateType}」ゲート</h4>
                <div className="gate-diagram">
                  <span>入力</span> → <span className="gate-box">{nextGateType}</span> → <span>出力</span>
                </div>
                <div className="input-controls">
                  <button onClick={() => handleInput(true)}>T</button>
                  <button onClick={() => handleInput(false)}>F</button>
                </div>
              </>
            ) : (
              <div className="wait-message-container">
                <h4>あなたの担当はすべて完了しました。</h4>
                <p className="wait-message">他のプレイヤーの入力を待っています...</p>
              </div>
            )}
          </section>
        </main>
        
        <aside className="game-sidebar">
          <h3>チームスコア</h3>
          <p className="score">{gameState.teamScore}点</p>
          <h3>プレイヤー</h3>
          <ul className="player-list">
            {gameState.players.map(player => (
              <li key={player.id}>
                {player.playerOrder}P : 担当ゲート {player.assignedGates.join(', ')}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default TutorialPage;

