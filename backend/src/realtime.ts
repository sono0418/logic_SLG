// src/realtime.ts
import { WebSocketServer, WebSocket } from "ws";
import { halfAdderProblems, halfAdderCircuit } from './problems'; // import は修正済みのはず

console.log("--- realtime.ts loaded - Version: 20251022_01 (Change this each time!) ---");

const allProblems = [...halfAdderProblems];

// --- 型定義 ---
type Gate = typeof halfAdderCircuit['gates'][number];

// WebSocket に roomId と playerId を持たせるためのインターフェース拡張
interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}

// プレイヤーの型 (ws を含む内部用)
type PlayerInternal = { playerId: string, ws: WebSocketWithIdentity, playerOrder: number }; // ws の型を WebSocketWithIdentity に

// プレイヤーの型 (フロントエンド送信用、ws を除く)
type PlayerSerializable = Omit<PlayerInternal, 'ws'>;

// GameState インターフェース (PlayerInternal を使用)
export interface GameState {
  roomId: string;
  players: PlayerInternal[]; // ★ PlayerInternal を使用
  roundCount: number;
  teamScore: number;
  status: 'waiting' | 'inProgress' | 'ended' | 'scoring';
  hostId: string | null;
  currentQuestion: {
    circuit: typeof halfAdderCircuit; // より具体的な型を使用
    inputAssignments: { [key: string]: boolean };
    expectedOutput: { C: boolean; S: boolean; };
    isTutorial?: boolean;
    // mode プロパティを追加 (startGame で使用するため)
    mode?: 'tutorial' | 'timeAttack' | 'circuitPrediction';
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

// フロントエンドに送る GameState の型 (players 配列の型が異なる)
type SerializableGameState = Omit<GameState, 'players'> & { players: PlayerSerializable[] };



export const gameRooms = new Map<string, GameState>();

// --- ヘルパー関数: フロントエンド送信用に ws を除外 ---
function createSerializableGameState(room: GameState): SerializableGameState { // 戻り値の型を修正
  return {
    ...room, // room の他のプロパティはそのままコピー
    // p の型を明示
    players: room.players.map(({ ws, ...playerData }: PlayerInternal): PlayerSerializable => playerData), // players 配列から ws を除外
  };
}
// --- ここまでヘルパー関数 ---

// --- ゲームロジック関数 ---
// gateType の型を string | Gate['type'] などにしても良い
function evaluateGate(gateType: string, inputs: (boolean | null)[]): boolean | null {
  if (inputs.includes(null)) return null;
  switch (gateType) {
    case 'AND':
      return inputs.every(input => input);
    case 'OR':
      return inputs.some(input => input);
    case 'NOT':
      // NOTゲートは入力が1つのはず
      if (inputs.length !== 1) return null; // 不正な入力はnullを返す
      return !inputs[0];
    default:
      console.warn(`Unknown gate type for evaluation: ${gateType}`); // 未知のゲートタイプ警告
      return null;
  }
}

// (generateNewQuestion は未使用なので省略)

// パラメータに型を追加
function assignGatesToPlayers(players: PlayerInternal[], gates: Gate[]) {
  const assignments: { [playerId: string]: string[] } = {};
  // p の型を明示
  players.forEach((p: PlayerInternal) => assignments[p.playerId] = []);
  // stage プロパティがないためコメントアウト
  const sortedGates = [...gates]; // .sort((a, b) => a.stage - b.stage);
  let playerIndex = 0;

  for (const gate of sortedGates) {
    // プレイヤーが存在しないケースを考慮 (配列が空など)
    if (players[playerIndex]) {
        assignments[players[playerIndex].playerId].push(gate.id);
    }
    playerIndex = (playerIndex + 1) % players.length;
  }
  return assignments;
}

function scoreAndAdvanceRound(room: GameState) {
  let gateCorrectScore = 0;
  const gateScorePerCorrect = 10;
  const correctGateIds = new Set<string>(); // Set を使ってユニークなゲートIDのみカウント
  room.playerInputLog.forEach(log => {
    if (log.isCorrect) {
      correctGateIds.add(log.gateId);
    }
  });
  gateCorrectScore = correctGateIds.size * gateScorePerCorrect;


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
  // gate の型を明示
  const allGatesPerfect = room.currentQuestion.circuit.gates.every((gate: Gate) => {
      // 該当ゲートの最後の入力ログを探す
      const lastLogForGate = room.playerInputLog.slice().reverse().find(l => l.gateId === gate.id);
      // ログがあり、かつ正解であること
      return lastLogForGate && lastLogForGate.isCorrect;
  });
  if (allGatesPerfect && isFinalOutputCorrect) {
      bonusScore = 20;
  }

  const roundScore = gateCorrectScore + finalOutputScore + bonusScore;
  room.teamScore += roundScore;

  // roundComplete 送信 (変更なし)
  // p の型を明示
  room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
      type: 'roundComplete',
      payload: {
        scoreSummary: {
            gateCorrectScore,
            finalOutputScore,
            bonusScore,
            roundScore: roundScore,
            totalScore: room.teamScore,
            isFinalOutputCorrect
        },
        playerInputLog: room.playerInputLog,
        currentQuestion: room.currentQuestion,
        gateValues: room.gateValues
      }
  })));

  room.roundCount++;

  if (room.roundCount < allProblems.length) {
      const nextQuestion = allProblems[room.roundCount];
      room.currentQuestion = nextQuestion as any;
      room.playerInputLog = [];
      room.gateValues = { ...nextQuestion.inputAssignments };
      // gate の型を明示
      nextQuestion.circuit.gates.forEach((gate: Gate) => {
          room.gateValues[gate.id] = null;
      });
      const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
      // p の型を明示
      room.players = shuffledPlayers.map((p: PlayerInternal, index: number) => ({ ...p, playerOrder: index + 1 }));
      room.playerGateAssignments = assignGatesToPlayers(room.players, nextQuestion.circuit.gates);
      room.status = 'inProgress'; // status を inProgress に戻す

      // nextRound 送信 (変更なし)
      const serializableNextRoundState = createSerializableGameState(room);
      // p の型を明示
      room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
          type: 'nextRound',
          payload: serializableNextRoundState
      })));
  } else {
      // ゲーム終了 (変更なし)
      room.status = 'ended';
      // p の型を明示
      room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
          type: 'gameEnd',
          payload: { finalTeamScore: room.teamScore }
      })));
      gameRooms.delete(room.roomId);
  }
}
// --- ここまでゲームロジック関数 ---

// --- WebSocket サーバー設定 ---
export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => { // ws の型を WebSocket に
    const wsWithId = ws as WebSocketWithIdentity; // 型アサーション
    console.log('Client connected.');

    ws.on('message', (message: Buffer) => { // message の型を Buffer に
      try {
        const data = JSON.parse(message.toString()); // Buffer を文字列に変換してからパース

        // --- joinRoom 処理 ---
        if (data.type === 'joinRoom') {
          const { roomId, playerId } = data.payload;
          if (typeof roomId !== 'string' || typeof playerId !== 'string') {
              console.warn('Invalid joinRoom payload:', data.payload);
              return;
          }
          wsWithId.roomId = roomId;
          wsWithId.playerId = playerId;
          let room = gameRooms.get(roomId);

          if (!room) {
            console.log(`New room ${roomId} created with status: waiting`);
            const initialQuestion = halfAdderProblems.find(p => p.isTutorial); // 修正済み
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
              hostId: playerId,
              currentQuestion: initialQuestion as any,
              gateValues: {},
              playerInputLog: [],
              playerGateAssignments: {},
            };
            gameRooms.set(roomId, newRoom);
            room = newRoom;
          }

          // プレイヤー追加 / 再接続処理
          const existingPlayerIndex = room.players.findIndex((p: PlayerInternal) => p.playerId === playerId); // p の型を明示
          if (existingPlayerIndex === -1) {
              const playerOrder = room.players.length + 1;
              room.players.push({ playerId, ws: wsWithId, playerOrder });
              console.log(`Player ${playerId} joined room ${roomId}`);
          } else {
             console.log(`Player ${playerId} reconnected to room ${roomId}`);
             room.players[existingPlayerIndex].ws = wsWithId; // ws を更新
          }

          // joinSuccess 送信 (変更なし)
          ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));

          // roomUpdate 送信 (変更なし)
          const serializableRoomState = createSerializableGameState(room);
          // p の型を明示
          room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: serializableRoomState })));

        // --- startGame 処理 ---
        } else if (data.type === 'startGame') {
          console.log("!!! startGame function WAS CALLED !!!");
          const { roomId, mode } = data.payload; // mode も受け取る
          // mode の型をチェック (任意)
          if (typeof mode !== 'string' || !['tutorial', 'timeAttack', 'circuitPrediction'].includes(mode)) {
             console.warn(`startGame: Invalid mode "${mode}" received.`);
             ws.send(JSON.stringify({ type: 'error', payload: '無効なゲームモードです。' }));
             return;
          }

          const room = gameRooms.get(roomId);
          // 開始条件チェック
          if (!room) { console.warn(`startGame: Room ${roomId} not found.`); return; }
          if (room.hostId !== wsWithId.playerId) { console.warn(`startGame: Player ${wsWithId.playerId} is not the host of room ${roomId}.`); return; }
          if (room.players.length < 2) { // プレイヤー人数チェック
             console.warn(`startGame: Not enough players in room ${roomId}. Need at least 2.`);
             ws.send(JSON.stringify({ type: 'error', payload: 'プレイヤーが2人以上必要です。' }));
             return;
          }
          if (room.status !== 'waiting') { console.warn(`startGame: Room ${roomId} is not in waiting status.`); return; }

          // ▼▼▼ ステータス設定と初期化 ▼▼▼
          room.status = 'inProgress'; // ★ ステップ 1: status を設定
          room.roundCount = 0;
          room.teamScore = 0;
          //とりまコメントアウト  room.currentQuestion.mode = mode; // mode を gameState に保存 (必要なら)

          // モードに応じた問題セットを選択
          const questions = mode === 'tutorial' ? allProblems.filter(p => p.isTutorial) : allProblems; // 通常モードは未実装
          if (questions.length === 0) { console.error(`No questions found for mode: ${mode}`); return; }
          const initialQuestion = questions[0];

          // プレイヤーシャッフルとゲート割り当て
          const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
          // p の型を明示
          room.players = shuffledPlayers.map((p: PlayerInternal, index: number) => ({ ...p, playerOrder: index + 1 }));
          room.playerGateAssignments = assignGatesToPlayers(room.players, initialQuestion.circuit.gates);

          // 現在の問題とゲート値設定
          room.currentQuestion = initialQuestion as any;
          room.gateValues = { ...initialQuestion.inputAssignments };
          // gate の型を明示
          initialQuestion.circuit.gates.forEach((gate: Gate) => {
            room.gateValues[gate.id] = null;
          });
          room.playerInputLog = [];
          // ▲▲▲ ここまで初期化 ▲▲▲


          console.log("DEBUG: About to serialize game state...");
          // ▼▼▼ シリアライズと送信 ▼▼▼
          const serializableGameState = createSerializableGameState(room); // ★ ステップ 2: status 設定後にシリアライズ

          console.log(`Game started in room ${roomId}. Status: ${room.status}`); // status をログに出力
          console.log("!!! CHECKPOINT BEFORE SENDING GAMESTART !!!");
          console.log("Sending gameStart with serializable payload (status included):", serializableGameState.status, serializableGameState); // シリアライズ後の status もログ確認

          room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({ // ★ ステップ 3: シリアライズしたものを送信 (1回だけ！)
            type: 'gameStart',
            payload: serializableGameState
          })));
          // ▲▲▲ ここまでシリアライズ・送信 ▲▲▲

        // --- playerInput 処理 ---
        } else if (data.type === 'playerInput') {
          const { roomId, playerId, gateId, inputValue } = data.payload;
          const room = gameRooms.get(roomId);

          // 入力検証
          if (!room || room.status !== 'inProgress') { console.warn(`playerInput denied: Room ${roomId} not found or not in progress.`); return; }
          const playerAssignments = room.playerGateAssignments[playerId];
          if (!playerAssignments || !playerAssignments.includes(gateId)) { console.warn(`playerInput denied: Gate ${gateId} not assigned to player ${playerId}.`); return; }
          if (room.gateValues[gateId] !== null) { console.warn(`playerInput denied: Gate ${gateId} already resolved.`); return; }

          // gate の型を明示
          const currentGate = room.currentQuestion.circuit.gates.find((g: Gate) => g.id === gateId);
          if (!currentGate) { console.error(`playerInput error: Gate ${gateId} not found in current question.`); return; }

          // 正誤判定
          const inputValues = currentGate.inputs.map(input => room.gateValues[input]);
          const correctOutput = evaluateGate(currentGate.type, inputValues);
          const isCorrect = correctOutput !== null && inputValue === correctOutput;

          room.playerInputLog.push({ playerId, gateId, inputValue, isCorrect, timestamp: Date.now() });

          if (isCorrect) {
            room.gateValues[gateId] = inputValue;
            console.log(`Player ${playerId} correctly resolved gate ${gateId} with ${inputValue}`);
          } else {
             console.log(`Player ${playerId} incorrectly resolved gate ${gateId} with ${inputValue}`);
          }

          // gameStateUpdate 送信 (変更なし)
          const serializableUpdateState = createSerializableGameState(room);
          // p の型を明示
          room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: serializableUpdateState })));

          // 全ゲート完了チェック
          // gate の型を明示
          const allGatesCompleted = room.currentQuestion.circuit.gates.every((gate: Gate) => room.gateValues[gate.id] !== null);
          if (allGatesCompleted) {
            console.log(`All gates completed for round ${room.roundCount} in room ${roomId}. Moving to scoring.`);
            room.status = 'scoring';
            scoreAndAdvanceRound(room);
          }
        } else if (data.type === 'selectGameMode') {
          console.warn('Received deprecated selectGameMode event.');
        } else {
          console.warn(`Unknown message type received: ${data.type}`);
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({ type: 'error', payload: 'An internal server error occurred.' }));
      }
    });

    // --- 接続終了処理 ---
    ws.on('close', () => {
      console.log(`Client disconnected: ${wsWithId.playerId || 'Unknown'}`);
      if (wsWithId.roomId && wsWithId.playerId) {
        const room = gameRooms.get(wsWithId.roomId);
        if (room) {
          // p の型を明示
          room.players = room.players.filter((p: PlayerInternal) => p.playerId !== wsWithId.playerId);
          console.log(`Player ${wsWithId.playerId} removed from room ${wsWithId.roomId}. Remaining: ${room.players.length}`);

          if (room.players.length === 0) {
            console.log(`Room ${wsWithId.roomId} is empty, deleting.`);
            gameRooms.delete(wsWithId.roomId);
          } else {
            if (room.hostId === wsWithId.playerId) {
              room.hostId = room.players[0]?.playerId || null;
              console.log(`Host left. New host of room ${wsWithId.roomId}: ${room.hostId}`);
            }
            // p の型を明示
            room.players.forEach((p: PlayerInternal, index: number) => p.playerOrder = index + 1);

            // roomUpdate 送信 (変更なし)
            const serializableCloseState = createSerializableGameState(room);
            // p の型を明示
            room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: serializableCloseState })));
          }
        }
      }
    });

    // --- エラー処理 ---
    ws.on('error', (error: Error) => { // error の型を明示
       console.error(`WebSocket error for client ${wsWithId.playerId || 'Unknown'}:`, error);
    });

  });

  console.log('WebSocket server setup complete.');
}
// --- ここまで WebSocket サーバー設定 ---