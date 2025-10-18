// src/realtime.ts
import { WebSocketServer, WebSocket } from "ws";
import { tutorialProblems, halfAdderCircuit } from './problems';

// --- ヘルパー関数: フロントエンド送信用に ws を除外 ---
function createSerializableGameState(room: GameState): Omit<GameState, 'players'> & { players: Omit<GameState['players'][number], 'ws'>[] } {
  return {
    ...room, // room の他のプロパティはそのままコピー
    players: room.players.map(({ ws, ...playerData }) => playerData), // players 配列から ws を除外
  };
}
// --- ここまでヘルパー関数 ---

// 問題セットを結合して1つの配列にする
const allProblems = [...tutorialProblems];

// --- 型定義 ---
export interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, playerOrder: number }[]; // ws はバックエンド内部でのみ使用
  roundCount: number;
  teamScore: number;
  status: 'waiting' | 'inProgress' | 'ended' | 'scoring';
  hostId: string | null;
  currentQuestion: {
    circuit: typeof halfAdderCircuit;
    inputAssignments: { [key: string]: boolean };
    expectedOutput: { C: boolean; S: boolean; };
    isTutorial?: boolean;
  };
  gateValues: { [key: string]: boolean | null };
  playerInputLog: {
    playerId: string;
    gateId: string;
    inputValue: boolean;
    isCorrect: boolean;
    timestamp: number;
  }[];
  playerGateAssignments: { [playerId: string]: string[] };
}

interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}
// --- ここまで型定義 ---

export const gameRooms = new Map<string, GameState>();

// --- ゲームロジック関数 ---
function evaluateGate(gateType: string, inputs: (boolean | null)[]): boolean | null {
  if (inputs.includes(null)) return null;
  switch (gateType) {
    case 'AND':
      return inputs.every(input => input);
    case 'OR':
      return inputs.some(input => input);
    case 'NOT':
      return !inputs[0];
    default:
      return null;
  }
}

// 注意: 現在の実装では generateNewQuestion は呼ばれていません。
// scoreAndAdvanceRound 内で allProblems[room.roundCount] を使っています。
function generateNewQuestion() {
  const selectedProblem = allProblems[Math.floor(Math.random() * allProblems.length)];
  return { ...selectedProblem, isTutorial: false }; // 本番用としてisTutorialをfalseに上書き
}

function assignGatesToPlayers(players: GameState['players'], gates: GameState['currentQuestion']['circuit']['gates']) {
  const assignments: { [playerId: string]: string[] } = {};
  players.forEach(p => assignments[p.playerId] = []);
  // stage プロパティが存在しないため、単純に順番に割り当てます
  // もし stage に基づく割り当てが必要な場合は、gates 配列の要素に stage プロパティを追加してください
  const sortedGates = [...gates]; // .sort((a, b) => a.stage - b.stage); // stage があればソート
  let playerIndex = 0;
  for (const gate of sortedGates) {
    assignments[players[playerIndex].playerId].push(gate.id);
    playerIndex = (playerIndex + 1) % players.length;
  }
  return assignments;
}

function scoreAndAdvanceRound(room: GameState) {
  let gateCorrectScore = 0;
  const gateScorePerCorrect = 10;
  // 正解した入力ログのみをカウント (同じゲートへの複数回の正解入力もカウントされる可能性あり)
  // ユニークなゲートIDごとにカウントする場合は修正が必要
  const correctGateIds = room.playerInputLog
      .filter(log => log.isCorrect)
      .map(log => log.gateId);
  gateCorrectScore = correctGateIds.length * gateScorePerCorrect;

  let finalOutputScore = 0;
  const finalGateIdC = room.currentQuestion.circuit.outputs.C;
  const finalGateIdS = room.currentQuestion.circuit.outputs.S;
  const finalOutputC = room.gateValues[finalGateIdC];
  const finalOutputS = room.gateValues[finalGateIdS];
  const isFinalOutputCorrect = finalOutputC === room.currentQuestion.expectedOutput.C && finalOutputS === room.currentQuestion.expectedOutput.S;
  if (isFinalOutputCorrect) {
      finalOutputScore = 50;
  }

  let bonusScore = 0;
  // 全てのゲートに対して、最後の入力が正解だったかを見る (より正確な判定が必要かも)
  const allGatesPerfect = room.currentQuestion.circuit.gates.every(gate => {
      const lastLogForGate = room.playerInputLog.slice().reverse().find(l => l.gateId === gate.id);
      return lastLogForGate && lastLogForGate.isCorrect;
  });
  if (allGatesPerfect && isFinalOutputCorrect) { // 最終出力も合っている場合のみボーナス
      bonusScore = 20;
  }

  const roundScore = gateCorrectScore + finalOutputScore + bonusScore;
  room.teamScore += roundScore;

  // roundComplete はシリアライズ不要 (room 全体ではない)
  room.players.forEach(p => p.ws.send(JSON.stringify({
      type: 'roundComplete',
      payload: {
          scoreSummary: {
              gateCorrectScore,
              finalOutputScore,
              bonusScore,
              roundScore: roundScore, // 今回のラウンドスコアも追加
              totalScore: room.teamScore,
              isFinalOutputCorrect
          },
          playerInputLog: room.playerInputLog, // 採点詳細表示用
          // currentQuestion や gateValues は nextRound で送るので不要かも？
          currentQuestion: room.currentQuestion,
          gateValues: room.gateValues
      }
  })));

  room.roundCount++;

  if (room.roundCount < allProblems.length) {
      // 次のラウンドの準備
      const nextQuestion = allProblems[room.roundCount]; // インデックスで次の問題を選択
      room.currentQuestion = nextQuestion as any; // 型アサーション (問題の型が一致している前提)
      room.playerInputLog = []; // ログリセット
      room.gateValues = { ...nextQuestion.inputAssignments }; // 入力値を設定
      nextQuestion.circuit.gates.forEach(gate => { // ゲート出力をリセット
          room.gateValues[gate.id] = null;
      });
      // プレイヤー順をシャッフル (任意)
      const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
      room.players = shuffledPlayers.map((p, index) => ({ ...p, playerOrder: index + 1 })); // playerOrder も更新
      // ゲート割り当てを再計算
      room.playerGateAssignments = assignGatesToPlayers(room.players, nextQuestion.circuit.gates);
      room.status = 'inProgress'; // scoring から inProgress に戻す

      // === nextRound の修正箇所 ===
      // nextRound メッセージを送信 (シリアライズ必須、1回だけ！)
      const serializableNextRoundState = createSerializableGameState(room);
      room.players.forEach(p => p.ws.send(JSON.stringify({
          type: 'nextRound',
          payload: serializableNextRoundState // シリアライズしたものを送る
      })));
      // === ここまで修正 ===

  } else {
      // ゲーム終了
      room.status = 'ended';
      // gameEnd はシリアライズ不要 (room 全体ではない)
      room.players.forEach(p => p.ws.send(JSON.stringify({
          type: 'gameEnd',
          payload: { finalTeamScore: room.teamScore }
      })));
      gameRooms.delete(room.roomId); // ルーム情報を削除
  }
}
// --- ここまでゲームロジック関数 ---

// --- WebSocket サーバー設定 ---
export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', ws => {
    const wsWithId = ws as WebSocketWithIdentity;
    console.log('Client connected.'); // 接続ログ

    ws.on('message', message => {
      try {
        const data = JSON.parse(message.toString());

        // --- joinRoom 処理 ---
        if (data.type === 'joinRoom') {
          const { roomId, playerId } = data.payload;
          wsWithId.roomId = roomId;
          wsWithId.playerId = playerId;
          let room = gameRooms.get(roomId);

          // 新規ルーム作成
          if (!room) {
            console.log(`New room ${roomId} created with status: waiting`); // ルーム作成ログ
            const initialQuestion = tutorialProblems.find(p => p.isTutorial); // チュートリアル問題を検索
            if (!initialQuestion) {
              console.error("No tutorial questions found.");
              ws.send(JSON.stringify({ type: 'error', payload: 'Tutorial questions not available.' }));
              return;
            }
            const newRoom: GameState = {
              roomId,
              players: [],
              roundCount: 0,
              teamScore: 0,
              status: 'waiting',
              hostId: playerId, // 最初のプレイヤーをホストに
              currentQuestion: initialQuestion as any,
              gateValues: {}, // 初期化は startGame で行う
              playerInputLog: [],
              playerGateAssignments: {},
            };
            gameRooms.set(roomId, newRoom);
            room = newRoom;
          }

          // プレイヤーをルームに追加
          // 既存プレイヤーチェック (任意だが推奨)
          if (!room.players.some(p => p.playerId === playerId)) {
              const playerOrder = room.players.length + 1;
              room.players.push({ playerId, ws: wsWithId, playerOrder }); // wsWithId を使う
              console.log(`Player ${playerId} joined room ${roomId}`); // 参加ログ
          } else {
             // 再接続などの場合の処理 (ws を更新するなど)
             console.log(`Player ${playerId} reconnected to room ${roomId}`);
             room.players = room.players.map(p => p.playerId === playerId ? { ...p, ws: wsWithId } : p);
          }

          // joinSuccess を送信 (シリアライズ不要)
          ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));

          // === roomUpdate の修正箇所 ===
          // roomUpdate を送信 (シリアライズ必須、1回だけ！)
          const serializableRoomState = createSerializableGameState(room);
          room.players.forEach(p => p.ws.send(JSON.stringify({
              type: 'roomUpdate', // タイプを roomUpdate に
              payload: serializableRoomState // シリアライズしたものを送る
          })));
          // === ここまで修正 ===

        // --- startGame 処理 ---
        } else if (data.type === 'startGame') {
          const { roomId, mode } = data.payload;
          const room = gameRooms.get(roomId);
          // 開始条件チェック
          if (!room) {
             console.warn(`startGame: Room ${roomId} not found.`); return;
          }
          if (room.hostId !== wsWithId.playerId) { // ホストのみ開始可能
             console.warn(`startGame: Player ${wsWithId.playerId} is not the host of room ${roomId}.`); return;
          }
          // プレイヤー人数チェック (チュートリアルでも2人必要か？ 仕様による -> 2人必要と仮定)
          if (room.players.length < 2) {
             console.warn(`startGame: Not enough players in room ${roomId}. Need at least 2.`);
             ws.send(JSON.stringify({ type: 'error', payload: 'プレイヤーが2人以上必要です。' })); // フロントにエラー通知
             return;
          }
          if (room.status !== 'waiting') {
             console.warn(`startGame: Room ${roomId} is not in waiting status.`); return;
          }

          room.status = 'inProgress';
          room.roundCount = 0; // ラウンドカウント初期化
          room.teamScore = 0; // スコア初期化

          // モードに応じた問題セットを選択 (現在はチュートリアルのみ考慮)
          const questions = mode === 'tutorial' ? allProblems.filter(p => p.isTutorial) : allProblems; // 通常モードは未実装
          if (questions.length === 0) {
              console.error(`No questions found for mode: ${mode}`);
              // エラーをフロントに通知する処理を追加しても良い
              return;
          }
          const initialQuestion = questions[0]; // 最初の問題を取得

          // プレイヤー順をシャッフル
          const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
          room.players = shuffledPlayers.map((p, index) => ({ ...p, playerOrder: index + 1 })); // playerOrder も更新

          // ゲート割り当て
          room.playerGateAssignments = assignGatesToPlayers(room.players, initialQuestion.circuit.gates);

          // 現在の問題とゲート値を設定
          room.currentQuestion = initialQuestion as any;
          room.gateValues = { ...initialQuestion.inputAssignments }; // 入力値をコピー
          initialQuestion.circuit.gates.forEach(gate => { // ゲート出力を null で初期化
            room.gateValues[gate.id] = null;
          });
          room.playerInputLog = []; // 入力ログをリセット

          console.log(`Game started in room ${roomId}. Status: inProgress`); // 開始ログ

          // === gameStart の修正箇所 ===
          // gameStart を送信 (シリアライズ必須、1回だけ！)
          const serializableGameState = createSerializableGameState(room);
          console.log("Sending gameStart with serializable payload:", serializableGameState); // 送信ログ
          room.players.forEach(p => p.ws.send(JSON.stringify({
              type: 'gameStart',
              payload: serializableGameState // シリアライズしたものを送る
          })));
          // === ここまで修正 ===

        // --- playerInput 処理 ---
        } else if (data.type === 'playerInput') {
          const { roomId, playerId, gateId, inputValue } = data.payload;
          const room = gameRooms.get(roomId);

          // 入力検証
          if (!room || room.status !== 'inProgress') {
            console.warn(`playerInput denied: Room ${roomId} not found or not in progress.`); return;
          }
          const playerAssignments = room.playerGateAssignments[playerId];
          // 担当外のゲート、または既に解決済みのゲートへの入力を弾く
          if (!playerAssignments || !playerAssignments.includes(gateId)) {
            console.warn(`playerInput denied: Gate ${gateId} not assigned to player ${playerId}.`); return;
          }
          // 既に値が入っている場合は入力を無視（もしくはエラーを返す）
          if (room.gateValues[gateId] !== null) {
            console.warn(`playerInput denied: Gate ${gateId} already resolved.`);
            // 必要ならフロントにエラーメッセージを送る
            // ws.send(JSON.stringify({ type: 'error', payload: `ゲート ${gateId} は解決済みです。` }));
            return;
          }


          const currentGate = room.currentQuestion.circuit.gates.find(g => g.id === gateId);
          if (!currentGate) {
            console.error(`playerInput error: Gate ${gateId} not found in current question.`); return;
          }

          // 正誤判定
          const inputValues = currentGate.inputs.map(input => room.gateValues[input]);
          const correctOutput = evaluateGate(currentGate.type, inputValues);
          // correctOutput が null の場合 (入力がまだ揃っていない) は isCorrect = false とする
          const isCorrect = correctOutput !== null && inputValue === correctOutput;

          // 入力ログを追加
          room.playerInputLog.push({
            playerId,
            gateId,
            inputValue,
            isCorrect,
            timestamp: Date.now()
          });

          // 正解ならゲート値を更新
          if (isCorrect) {
            room.gateValues[gateId] = inputValue;
            console.log(`Player ${playerId} correctly resolved gate ${gateId} with ${inputValue}`); // 正解ログ
          } else {
             console.log(`Player ${playerId} incorrectly resolved gate ${gateId} with ${inputValue}`); // 不正解ログ
             // 不正解の場合のペナルティなどをここに追加可能
          }

          // === gameStateUpdate の修正箇所 ===
          // gameStateUpdate を送信 (シリアライズ必須、1回だけ！)
          const serializableUpdateState = createSerializableGameState(room);
          room.players.forEach(p => p.ws.send(JSON.stringify({
              type: 'gameStateUpdate',
              payload: serializableUpdateState // シリアライズしたものを送る
          })));
          // === ここまで修正 ===

          // 全ゲート完了チェック
          const allGatesCompleted = room.currentQuestion.circuit.gates.every(gate => room.gateValues[gate.id] !== null);
          if (allGatesCompleted) {
            console.log(`All gates completed for round ${room.roundCount} in room ${roomId}. Moving to scoring.`); // ラウンド完了ログ
            room.status = 'scoring';
            scoreAndAdvanceRound(room); // スコア計算と次のラウンドへ
          }
        // --- selectGameMode は廃止 ---
        } else if (data.type === 'selectGameMode') {
          // このイベントは startGame に統合されたため、何もしない
          console.warn('Received deprecated selectGameMode event.');
        } else {
          console.warn(`Unknown message type received: ${data.type}`); // 未知のメッセージタイプ
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        // エラー発生時にクライアントに通知する (任意)
        ws.send(JSON.stringify({ type: 'error', payload: 'An internal server error occurred.' }));
      }
    });

    // --- 接続終了処理 ---
    ws.on('close', () => {
      console.log(`Client disconnected: ${wsWithId.playerId || 'Unknown'}`); // 切断ログ
      if (wsWithId.roomId && wsWithId.playerId) {
        const room = gameRooms.get(wsWithId.roomId);
        if (room) {
          // プレイヤーをリストから削除
          room.players = room.players.filter(p => p.playerId !== wsWithId.playerId);
          console.log(`Player ${wsWithId.playerId} removed from room ${wsWithId.roomId}. Remaining: ${room.players.length}`); // 削除ログ

          // ルームが空になったら削除
          if (room.players.length === 0) {
            console.log(`Room ${wsWithId.roomId} is empty, deleting.`); // ルーム削除ログ
            gameRooms.delete(wsWithId.roomId);
          } else {
            // ホストが抜けたら新しいホストを設定 (最初のプレイヤーを仮ホストに)
            if (room.hostId === wsWithId.playerId) {
              room.hostId = room.players[0]?.playerId || null; // 新しいホストIDを設定
              console.log(`Host left. New host of room ${wsWithId.roomId}: ${room.hostId}`); // ホスト変更ログ
            }
            // プレイヤー順序を更新 (任意だが推奨)
            room.players.forEach((p, index) => p.playerOrder = index + 1);

            // 他のプレイヤーに roomUpdate を送信 (シリアライズ必須)
            const serializableCloseState = createSerializableGameState(room);
            room.players.forEach(p => p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: serializableCloseState })));
          }
        }
      }
    });

    // --- エラー処理 ---
    ws.on('error', (error) => {
       console.error(`WebSocket error for client ${wsWithId.playerId || 'Unknown'}:`, error); // エラーログ
       // 必要に応じて接続切断処理などをここで行う
    });

  });

  console.log('WebSocket server setup complete.'); // サーバー起動ログ
}
// --- ここまで WebSocket サーバー設定 ---