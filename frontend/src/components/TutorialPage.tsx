import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import { WebSocketContext } from '../contexts/WebSocketContext';
import PopUpB from './Popups/PopUpB';
import PopUpTR from './Popups/PopUpTR';
import './TutorialPage.css';

const TutorialPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const myPlayerId = useContext(PlayerIdContext);
  const wsContext = useContext(WebSocketContext);

  // ... (gamePhase, timer, popupsなどのuseStateは変更なし)
  const [gamePhase, setGamePhase] = useState<'loading' | 'starting' | 'playing'>('loading');
  const [timer, setTimer] = useState(0);
  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isResultPopupOpen, setResultPopupOpen] = useState(false);


  // ContextやIDが準備できるまではローディング表示
  if (!wsContext || !myPlayerId) {
    return <div>プレイヤー情報を読み込み中...</div>;
  }

  const { gameState, sendMessage } = wsContext;

  // ✨ =================================================================
  // ✨ 修正点：ゲームの初期データが届くまで、ここで待機する
  // ✨ =================================================================
  // gameStateの中に、ゲーム開始の証であるcurrentQuestionが存在しない場合は、
  // まだサーバーからの情報が届いていないと判断し、準備中画面を表示し続ける
  if (!gameState.currentQuestion) {
    return <div>ゲームを準備中...</div>;
  }
  // =================================================================
  // ✨ この行以降は、gameState.currentQuestionが必ず存在することが保証される
  // =================================================================


  // (ここから下のuseEffectやヘルパー関数、JSXは以前のままでOKです)
  useEffect(() => {
    // gamePhaseがloadingの時だけ実行し、無限ループを防ぐ
    if (gameState.currentQuestion && gamePhase === 'loading') {
      const loadingTimeout = setTimeout(() => { setGamePhase('starting'); }, 1500);
      const startingTimeout = setTimeout(() => { setGamePhase('playing'); }, 2500);
      return () => { clearTimeout(loadingTimeout); clearTimeout(startingTimeout); };
    }
  }, [gameState.currentQuestion, gamePhase]);

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


  const myPlayerData = gameState.players.find(p => p.id === myPlayerId);
  let nextGateIndex: number | null = null;
  if (myPlayerData && myPlayerData.assignedGates) {
    const nextGate = myPlayerData.assignedGates.find(gateIdx => gameState.playerInputs[gateIdx] === null);
    if (nextGate !== undefined) {
      nextGateIndex = nextGate;
    }
  }
  const nextGateType = (nextGateIndex !== null && gameState.currentQuestion) 
    ? gameState.currentQuestion.circuit[nextGateIndex] 
    : null;

  const handleInput = (value: boolean) => {
    if (nextGateIndex === null) return;
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

  // 以前ここにあった if (!gameState.currentQuestion) は上に移動しました

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
          <section className="gate-display">
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
                {player.playerOrder}P : 担当 {player.assignedGates.join(', ')}番
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default TutorialPage;

