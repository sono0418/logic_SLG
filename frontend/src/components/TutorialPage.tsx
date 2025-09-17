import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import { useGameWebSocket } from '../hooks/useGameWebSocket';
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import PopUpB from './Popups/PopUpB';
import PopUpTR from './Popups/PopUpTR';
import './TutorialPage.css';

// ヘルパー関数: ゲートの入力値を取得
const getGateInputValues = (gate, gateValues) => {
  if (!gate || !gate.inputs || !gateValues) return [];
  return gate.inputs.map(input => ({
    name: input,
    value: gateValues[input]
  }));
};

const TutorialPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const myPlayerId = useContext(PlayerIdContext);

  const { gameState, sendMessage } = useGameWebSocket(roomId, myPlayerId);

  const [isNotePopupOpen, setNotePopupOpen] = useState(false);
  const [isScoringPopupOpen, setScoringPopupOpen] = useState(false);
  const [scoreSummary, setScoreSummary] = useState(null);
  const [skipRequestedPlayers, setSkipRequestedPlayers] = useState([]);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [roundScores, setRoundScores] = useState({ gate: 0, final: 0, bonus: 0 });

  const inputLogIndex = useRef(0);
  const animationTimeout = useRef(null);

  const myGateAssignments = gameState?.playerGateAssignments?.[myPlayerId] || [];
  const myCurrentGateId = myGateAssignments.find(gateId => gameState?.gateValues?.[gateId] === null);
  const myCurrentGate = myCurrentGateId ? gameState?.currentQuestion?.circuit?.gates.find(g => g.id === myCurrentGateId) : null;
  const myGateInputs = myCurrentGate ? getGateInputValues(myCurrentGate, gameState?.gateValues) : [];
  const isMyTurn = !!myCurrentGate;

  useEffect(() => {
    // スコアリングフェーズへの移行を検知
    if (gameState?.status === 'scoring' && gameState.payload?.scoreSummary) {
      setScoreSummary(gameState.payload.scoreSummary);
      setScoringPopupOpen(true);
      animateTimeline(gameState.payload.playerInputLog);
      setShowSkipButton(true);
    } else if (gameState?.status !== 'scoring') {
      // スコアリング以外の状態に切り替わった場合、ポップアップを閉じる
      setScoringPopupOpen(false);
      setScoreSummary(null);
      setShowSkipButton(false);
    }
  }, [gameState?.status, gameState?.payload]);

  const animateTimeline = (log) => {
    if (inputLogIndex.current >= log.length) {
      if (animationTimeout.current) clearTimeout(animationTimeout.current);
      setTimeout(() => {
        setRoundScores(prev => ({...prev, total: scoreSummary.totalScore}));
        setScoringPopupOpen(false);
      }, 1500);
      return;
    }

    const currentLog = log[inputLogIndex.current];
    setRoundScores(prev => ({
        ...prev,
        gate: prev.gate + (currentLog.isCorrect ? 10 : 0)
    }));

    inputLogIndex.current++;
    animationTimeout.current = setTimeout(() => {
      animateTimeline(log);
    }, 1000); // 1秒間隔でアニメーション
  };

  const handleSkipTimeline = () => {
    sendMessage('skipTimeline', { roomId, playerId: myPlayerId });
    if (animationTimeout.current) clearTimeout(animationTimeout.current);
    const remainingLogs = gameState?.payload?.playerInputLog?.slice(inputLogIndex.current) || [];
    const finalGateScore = remainingLogs.reduce((acc, log) => acc + (log.isCorrect ? 10 : 0), roundScores.gate);
    setRoundScores({
      gate: finalGateScore,
      final: scoreSummary?.finalOutputScore,
      bonus: scoreSummary?.bonusScore,
      total: scoreSummary?.totalScore
    });
    setTimeout(() => setScoringPopupOpen(false), 1500);
  };
  
  const handleInput = (value) => {
    if (!isMyTurn) return;
    sendMessage('playerInput', { roomId, playerId: myPlayerId, gateId: myCurrentGateId, inputValue: value });
  };
  
  useEffect(() => {
    if (!gameState) return;
    switch (gameState.type) {
      case 'gameStart':
      case 'gameStateUpdate':
      case 'nextRound':
      case 'gameEnd':
        setScoreSummary(null);
        setSkipRequestedPlayers([]);
        setScoringPopupOpen(false);
        break;
      case 'roundComplete':
        setScoreSummary(gameState.payload?.scoreSummary);
        break;
      case 'skipRequested':
        setSkipRequestedPlayers(gameState.payload?.players);
        break;
      default:
        // 未知のイベントタイプを無視
        break;
    }
  }, [gameState]);

  if (!gameState || !gameState.currentQuestion || !gameState.playerGateAssignments) {
    return <div>ゲームを準備中...</div>;
  }
  
  const circuitGates = gameState.currentQuestion.circuit.gates;

  return (
    <div className="game-container">
      {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />}
      {isScoringPopupOpen && scoreSummary && (
        <PopUpTR score={scoreSummary.totalScore} onClose={() => setScoringPopupOpen(false)} title="結果発表" >
          <div>
            <h3>スコア詳細</h3>
            <p>ゲート正解スコア: {scoreSummary.gateCorrectScore}</p>
            <p>最終出力スコア: {scoreSummary.finalOutputScore}</p>
            <p>ボーナススコア: {scoreSummary.bonusScore}</p>
          </div>
          {showSkipButton && <button onClick={handleSkipTimeline}>スキップ</button>}
          <div className="skip-players">
            {skipRequestedPlayers.map(p => (
              <span key={p.playerId}>{p.playerOrder}P</span>
            ))}
          </div>
        </PopUpTR>
      )}

      <header className="game-header">
        <div className="header-left">
          <h1>チュートリアル</h1>
          <span>{gameState.roundCount + 1}問目</span>
        </div>
        <div className="header-right">
          <button onClick={() => setNotePopupOpen(true)}>ノート</button>
        </div>
      </header>

      <main className="game-main">
        <section className="circuit-display">
          <h3>担当ゲート</h3>
          <div className="my-gates-container">
            {myGateAssignments.map(gateId => {
              const gate = circuitGates.find(g => g.id === gateId);
              if (!gate) return null;
              const isResolved = gameState.gateValues?.[gateId] !== null;
              const inputValues = getGateInputValues(gate, gameState.gateValues);
              return (
                <div key={gateId} className={`gate-card ${isResolved ? 'resolved' : ''} ${myCurrentGateId === gateId ? 'active' : ''}`}>
                  <h4>{gate.type} ゲート</h4>
                  <div className="inputs">
                    {inputValues.map((input, index) => (
                      <span key={index}>{input.name}: {input.value === null ? '?' : input.value.toString()}</span>
                    ))}
                  </div>
                  <div className="gate-output">
                    <span>出力: {isResolved ? gameState.gateValues[gateId].toString() : '?'}</span>
                  </div>
                  {myCurrentGateId === gateId && (
                    <div className="input-controls">
                      <button onClick={() => handleInput(true)} disabled={!isMyTurn}>T</button>
                      <button onClick={() => handleInput(false)} disabled={!isMyTurn}>F</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="game-sidebar">
          <h3>チームスコア</h3>
          <p className="score">{gameState.teamScore}点</p>
          <h3>プレイヤー</h3>
          <ul className="player-list">
            {gameState.players.map(player => (
              <li key={player.playerId} className={player.playerId === myPlayerId ? 'my-player' : ''}>
                {player.playerOrder}P
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
};

const App = () => (
  <Router>
    <TutorialPage />
  </Router>
);

export default App;
