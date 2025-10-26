// frontend/src/components/TutorialPage.tsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// GameState 型を useGameWebSocket から import する
import { useGameWebSocket } from '../hooks/useGameWebSocket'; // 値 (フック) のインポート
import type { GameState } from '../hooks/useGameWebSocket'; // 型 のインポート
import { PlayerIdContext } from '../contexts/PlayerIdContext';
import PopUpB from './Popups/PopUpB'; // ノート用ポップアップ
import PopUpTR from './Popups/PopUpTR'; // 結果表示用ポップアップ
import './TutorialPage.css'; // スタイルシート

// GamePage から gameState と sendMessage を受け取るための Props 型定義
interface TutorialPageProps {
    gameState: GameState | null; // null の可能性を考慮
    sendMessage: (type: string, payload: object) => void;
}

// problems.ts から Gate 型を import するか、ここで定義する
// ここでは仮に any としますが、可能なら import または定義してください
type Gate = any; // typeof halfAdderCircuit['gates'][number];

// ゲートの入力値を取得するヘルパー関数 (必要なら)
// const getGateInputValues = (gate: Gate | null | undefined, gateValues: GameState['gateValues'] | null | undefined) => {
//     if (!gate || !gate.inputs || !gateValues) return [];
//     return gate.inputs.map((input: string) => ({ // input の型を string に
//       name: input,
//       value: gateValues[input] ?? null // null 合体演算子で null を返す
//     }));
// };

const TutorialPage: React.FC<TutorialPageProps> = ({ gameState, sendMessage }) => {
    // URL パラメータから roomId を取得
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate(); // 画面遷移用フック
    const myPlayerId = useContext(PlayerIdContext); // 自分のプレイヤーID

    // --- State定義 ---
    const [isNotePopupOpen, setNotePopupOpen] = useState(false); // ノートポップアップ表示状態
    const [showEndPopup, setShowEndPopup] = useState(false); // ゲーム終了ポップアップ表示状態
    const [finalScore, setFinalScore] = useState<number | null>(null); // 最終スコア
    const [askRegister, setAskRegister] = useState(false); // スコア登録を尋ねるかどうかの状態
    const [teamName, setTeamName] = useState(""); // 入力されたチーム名
    const [isRegistering, setIsRegistering] = useState(false); // スコア登録処理中かどうかのフラグ
    // アニメーション用 (scoreAndAdvanceRound から roundComplete を受け取る場合は不要かも)
    // const inputLogIndex = useRef(0);
    // const animationTimeout = useRef<NodeJS.Timeout | null>(null);
    // const [roundScores, setRoundScores] = useState({ gate: 0, final: 0, bonus: 0, total: 0 }); // roundComplete を使う場合は不要かも
    // const [skipRequestedPlayers, setSkipRequestedPlayers] = useState([]); // skip 機能がなければ不要

    // --- ゲーム終了検知 ---
    useEffect(() => {
        // gameState が存在し、ステータスが 'ended' になったら実行
        if (gameState?.status === 'ended') {
            console.log("Game ended detected!");
            setFinalScore(gameState.teamScore); // gameState から最終スコアを取得
            setShowEndPopup(true); // 終了ポップアップを表示

            // gameEnd ペイロードに isTutorialComplete が含まれる想定
            // ここでは gameState.currentQuestion.isTutorial で代用
            // バックエンドの gameEnd ペイロードに合わせて修正してください
            const isTutorialComplete = gameState.currentQuestion?.isTutorial ?? false; // 仮
            if (isTutorialComplete) {
               setAskRegister(true); // チュートリアル完了なら登録を尋ねる
            } else {
               setAskRegister(false);
            }
        }
    }, [gameState?.status, gameState?.teamScore, gameState?.currentQuestion?.isTutorial]); // 依存配列


    // --- ハンドラ関数 ---

    // ゲート入力ハンドラ
    const handleInput = (value: boolean) => {
        // 自分のターンでなければ何もしない (isMyTurn の計算が必要)
        const myAssignments = (myPlayerId && gameState?.playerGateAssignments?.[myPlayerId]) || [];
        const currentGateId = myAssignments.find(gateId => gameState?.gateValues?.[gateId] === null);
        if (!currentGateId) return; // 自分の担当ゲートが既に解決済みか、割り当てがない場合は無視

        sendMessage('playerInput', { roomId, playerId: myPlayerId, gateId: currentGateId, inputValue: value });
    };

    // ゲーム終了ポップアップを閉じるハンドラ
    const handleCloseEndPopup = () => {
        setShowEndPopup(false);
        // モード選択画面 (GamePage) に遷移
        if (roomId) {
            navigate(`/game/${roomId}`);
        } else {
            navigate('/'); // roomId がなければフォールバックでタイトルへ
        }
    };

    // スコア登録確認への応答ハンドラ
    const handleRegisterResponse = (register: boolean) => {
        if (!register) {
             // 「いいえ」ならモード選択画面 (GamePage) へ
            if (roomId) {
                navigate(`/game/${roomId}`);
            } else {
                navigate('/');
            }
        }
        // 「はい」が押されたら JSX 側で入力フォームが表示される
    };

    // チーム名入力ハンドラ
    const handleTeamNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTeamName(event.target.value);
    };

    // スコア登録実行ハンドラ
    const handleRegisterSubmit = () => {
        if (teamName.trim() && finalScore !== null && myPlayerId && roomId) {
            setIsRegistering(true); // 登録中フラグを立てる
            sendMessage('registerScore', {
                teamName: teamName.trim(),
                score: finalScore,
                playerId: myPlayerId // どのプレイヤーが登録したかの情報
             });

            // サーバーからの応答を待たずにモード選択画面へ遷移（シンプルにするため）
            // 実際には 'scoreRegistered' メッセージを待つ方が確実
            setTimeout(() => {
                navigate(`/game/${roomId}`);
            }, 500); // 0.5秒待って遷移 (UI的に少し間を置く)
        } else {
            alert("チーム名を入力してください。");
        }
    };

    // --- データ準備 (レンダリング用) ---

    // gameState がない場合はローディング表示 (またはエラー表示)
    if (!gameState || !myPlayerId) {
        // GamePage から遷移してきた直後は gameState がまだ古い可能性もあるため考慮
        console.warn("TutorialPage rendered without gameState or myPlayerId");
        return <div>ゲーム情報を読み込み中...</div>;
    }

    // 自分の担当ゲート、現在の担当ゲート、自分のターンかどうかの判定
    const myGateAssignments = gameState.playerGateAssignments?.[myPlayerId] || [];
    const myCurrentGateId = myGateAssignments.find(gateId => gameState.gateValues?.[gateId] === null);
    // currentQuestion と circuit が存在するかチェック
    const circuitGates = gameState.currentQuestion?.circuit?.gates || [];
    const myCurrentGate = myCurrentGateId ? circuitGates.find((g: Gate) => g.id === myCurrentGateId) : null;
    const isMyTurn = !!myCurrentGate;

    // --- レンダリング ---
    return (
        <div className="game-container">
            {/* ノートポップアップ */}
            {isNotePopupOpen && <PopUpB onClose={() => setNotePopupOpen(false)} />}

            {/* ゲーム終了ポップアップ */}
            {showEndPopup && finalScore !== null && (
                <PopUpTR
                    score={finalScore}
                    onClose={handleCloseEndPopup} // ポップアップ外クリックや閉じるボタンで GamePage へ
                    title="ゲーム終了！"
                >
                    {askRegister ? ( // スコア登録を尋ねる場合
                        <div>
                            <p>最終スコア: {finalScore}</p>
                            <p>スコアをランキングに登録しますか？</p>
                            <div className="popup-actions">
                                <button onClick={() => handleRegisterResponse(true)} disabled={isRegistering}>はい</button>
                                <button onClick={() => handleRegisterResponse(false)} disabled={isRegistering}>いいえ</button>
                            </div>
                            {/* 「はい」選択時のみ表示されるフォーム */}
                            <div className={`register-form ${askRegister ? 'visible' : 'hidden'}`}> {/* CSSで表示制御 */}
                                <label htmlFor="teamNameInput">チーム名:</label>
                                <input
                                    id="teamNameInput"
                                    type="text"
                                    value={teamName}
                                    onChange={handleTeamNameChange}
                                    maxLength={20}
                                    disabled={isRegistering}
                                    placeholder="20文字以内"
                                />
                                <button onClick={handleRegisterSubmit} disabled={isRegistering || !teamName.trim()}>
                                    {isRegistering ? '登録中...' : '登録'}
                                </button>
                            </div>
                        </div>
                    ) : ( // スコア登録を尋ねない場合
                        <div>
                            <p>最終スコア: {finalScore}</p>
                            <div className="popup-actions">
                                <button onClick={handleCloseEndPopup}>モード選択へ</button>
                            </div>
                        </div>
                    )}
                </PopUpTR>
            )}

            {/* ゲーム中のUI (status が ended でなければ表示) */}
            {gameState.status !== 'ended' && (
                <>
                    <header className="game-header">
                        <div className="header-left">
                            <h1>{gameState.currentQuestion?.isTutorial ? 'チュートリアル' : 'ゲーム'}</h1>
                            {/* roundCount は 0 から始まるので +1 する */}
                            <span>{gameState.roundCount >= 0 ? `${gameState.roundCount + 1}問目` : '準備中'}</span>
                        </div>
                        <div className="header-right">
                            <button onClick={() => setNotePopupOpen(true)}>ノート</button>
                        </div>
                    </header>

                    {/* ステータス表示 (任意) */}
                    <div className="status-bar">
                        {gameState.status === 'inProgress' && <p className="status-text">ゲーム中…</p>}
                        {gameState.status === 'scoring' && <p className="status-text">採点中…</p>}
                    </div>

                    <main className="game-main">
                        <section className="circuit-display">
                            <h3>担当ゲート</h3>
                            {myGateAssignments.length > 0 ? (
                                <div className="my-gates-container">
                                    {myGateAssignments.map(gateId => {
                                        const gate = circuitGates.find((g: Gate) => g.id === gateId);
                                        if (!gate) return <div key={gateId} className="gate-card error">ゲート情報なし ({gateId})</div>; // エラー表示

                                        const isResolved = gameState.gateValues?.[gateId] !== null;
                                        // ゲート入力値の取得 (簡易版)
                                        const inputValues = gate.inputs.map((input: string) => ({
                                            name: input,
                                            // gateValues が存在しない場合も考慮
                                            value: gameState.gateValues?.[input] ?? null
                                        }));

                                        return (
                                            <div key={gateId} className={`gate-card ${isResolved ? 'resolved' : ''} ${myCurrentGateId === gateId ? 'active' : ''}`}>
                                                <h4>{gate.type} ゲート ({gateId})</h4>
                                                <div className="inputs">
                                                    {inputValues.map((input: {name: string; value: boolean | null}, index: number) => (
                                                        <span key={index} className={`input-value ${input.value === null ? 'unknown' : ''}`}>
                                                            {input.name}: {input.value === null ? '?' : String(input.value).toUpperCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="gate-output">
                                                    <span>出力: {isResolved ? String(gameState.gateValues[gateId]).toUpperCase() : '?'}</span>
                                                </div>
                                                {/* 自分のターンで、まだ解決していないゲートなら入力ボタン表示 */}
                                                {myCurrentGateId === gateId && !isResolved && (
                                                    <div className="input-controls">
                                                        <button onClick={() => handleInput(true)} disabled={!isMyTurn}>TRUE</button>
                                                        <button onClick={() => handleInput(false)} disabled={!isMyTurn}>FALSE</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p>担当ゲートが割り当てられていません。</p> // ゲートがない場合の表示
                            )}
                        </section>

                        <aside className="game-sidebar">
                            <h3>チームスコア</h3>
                            <p className="score">{gameState.teamScore}点</p>
                            <h3>プレイヤー</h3>
                            <ul className="player-list">
                                {gameState.players.map(player => (
                                    <li key={player.playerId} className={player.playerId === myPlayerId ? 'my-player' : ''}>
                                        {player.playerOrder}P {/* 自分のプレイヤーは太字など強調表示するCSSを追加すると良い */}
                                    </li>
                                ))}
                            </ul>
                        </aside>
                    </main>
                </>
            )}
        </div>
    );
};

export default TutorialPage;