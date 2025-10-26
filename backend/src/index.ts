// src/index.ts
import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
// problems.ts から問題データをインポート
import { halfAdderProblems, halfAdderCircuit } from './problems';
import fs from 'fs';

// 問題セットを結合して1つの配列にする (チュートリアル以外も含む場合)
// 現在はチュートリアル問題のみ使用する想定
const allProblems = [...halfAdderProblems];

// --- 型定義 ---
// ゲートの型 (problems.ts の定義に合わせる)
type Gate = typeof halfAdderCircuit['gates'][number];

// WebSocket に roomId と playerId を持たせるためのインターフェース拡張
interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}

// プレイヤーの型 (ws を含む内部用)
type PlayerInternal = { playerId: string, ws: WebSocketWithIdentity, playerOrder: number };

// プレイヤーの型 (フロントエンド送信用、ws を除く)
type PlayerSerializable = { playerId: string, playerOrder: number }; // ws を除く + playerId に名前を修正

//ランキング周り
const RANKING_CSV_PATH = path.join(__dirname, 'data', 'rankings.csv');
const DATA_DIR = path.join(__dirname, 'data');

// data ディレクトリがなければ作成する (サーバー起動時)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
  console.log(`Created data directory at: ${DATA_DIR}`);
}
// CSV ファイルがなければヘッダー行を作成する (サーバー起動時)
if (!fs.existsSync(RANKING_CSV_PATH)) {
  fs.writeFileSync(RANKING_CSV_PATH, 'timestamp,teamName,score,playerId\n');
  console.log(`Created ranking CSV file with header at: ${RANKING_CSV_PATH}`);
}

// GameState インターフェース (PlayerInternal を使用)
export interface GameState {
  roomId: string;
  players: PlayerInternal[];
  roundCount: number;
  teamScore: number;
  status: 'waiting' | 'inProgress' | 'ended' | 'scoring';
  hostId: string | null;
  currentQuestion: {
    circuit: typeof halfAdderCircuit; // より具体的な型を使用
    inputAssignments: { [key: string]: boolean };
    expectedOutput: { C: boolean; S: boolean; }; // problems.ts に合わせる
    isTutorial?: boolean;
    mode?: 'tutorial' | 'timeAttack' | 'circuitPrediction';
  };
  gateValues: { [key: string]: boolean | null }; // ゲートごとの計算結果
  playerInputLog: { // プレイヤーの入力履歴
    playerId: string;
    gateId: string;
    inputValue: boolean;
    isCorrect: boolean;
    timestamp: number;
  }[];
  playerGateAssignments: { [playerId: string]: string[] }; // どのプレイヤーがどのゲート担当か
  playerChoices: { [playerId: string]: 'tutorial' | 'timeAttack' | 'circuitPrediction' }; // プレイヤーが選んだモード
  // playerInput にあった currentPlayerId, currentPlayerIndex は不要になる (ゲート割当ベースのため)
}

// フロントエンドに送る GameState の型 (players 配列の型が異なる)
type SerializableGameState = Omit<GameState, 'players'> & { players: PlayerSerializable[] };
// --- ここまで型定義 ---


export const gameRooms = new Map<string, GameState>();
const disconnectionTimers = new Map<string, NodeJS.Timeout>();

// --- ヘルパー関数: フロントエンド送信用に ws を除外 ---
function createSerializableState(room: GameState): SerializableGameState {
  const serializableRoom: Partial<SerializableGameState> = {
      roomId: room.roomId,
      players: room.players.map( // players を先に処理
          ({ ws, ...playerData }: PlayerInternal): PlayerSerializable => ({
              playerId: playerData.playerId, // ★ id ではなく playerId に
              playerOrder: playerData.playerOrder
          })
      ),
      roundCount: room.roundCount,
      teamScore: room.teamScore,
      status: room.status,
      hostId: room.hostId,
      currentQuestion: room.currentQuestion,
      gateValues: room.gateValues,
      playerInputLog: room.playerInputLog,
      playerGateAssignments: room.playerGateAssignments,
      playerChoices: room.playerChoices,
  };
  return serializableRoom as SerializableGameState; // 型アサーション
}
// --- ここまでヘルパー関数 ---

// --- ゲームロジック関数 (realtime.ts から移植) ---
function evaluateGate(gateType: string, inputs: (boolean | null)[]): boolean | null {
  // 入力に null が含まれていたら計算できない
  if (inputs.some(input => input === null)) return null;

  // boolean に変換して計算 (念のため)
  const boolInputs = inputs as boolean[];

  switch (gateType) {
    case 'AND':
      return boolInputs.every(input => input);
    case 'OR':
      return boolInputs.some(input => input);
    case 'NOT':
      if (boolInputs.length !== 1) return null; // NOT は入力1つ
      return !boolInputs[0];
    default:
      console.warn(`Unknown gate type for evaluation: ${gateType}`);
      return null;
  }
}

// プレイヤーにゲートを割り当てる関数
function assignGatesToPlayers(players: PlayerInternal[], gates: Gate[]) {
  const assignments: { [playerId: string]: string[] } = {};
  players.forEach((p: PlayerInternal) => assignments[p.playerId] = []);
  // stage プロパティに基づいてソート (problems.ts の定義に stage があるため)
  const sortedGates = [...gates].sort((a, b) => (a.stage || 0) - (b.stage || 0));
  let playerIndex = 0;
  for (const gate of sortedGates) {
    if (players[playerIndex]) { // プレイヤーが存在するか確認
        assignments[players[playerIndex].playerId].push(gate.id);
    }
    playerIndex = (playerIndex + 1) % players.length;
  }
  return assignments;
}

// スコア計算とラウンド進行
function scoreAndAdvanceRound(room: GameState) {
  let gateCorrectScore = 0;
  const gateScorePerCorrect = 10;
  const correctGateIds = new Set<string>(); // 正解したユニークなゲートID
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
  // 最終出力が null でないことを確認
  const isFinalOutputCorrect = finalOutputC !== null && finalOutputS !== null &&
                               finalOutputC === room.currentQuestion.expectedOutput.C &&
                               finalOutputS === room.currentQuestion.expectedOutput.S;
  if (isFinalOutputCorrect) {
      finalOutputScore = 50;
  }

  let bonusScore = 0;
  // 全ゲートが正解で最終出力も正解ならボーナス
  const allGatesPerfect = room.currentQuestion.circuit.gates.every((gate: Gate) => {
      const lastLogForGate = room.playerInputLog.slice().reverse().find(l => l.gateId === gate.id);
      return lastLogForGate && lastLogForGate.isCorrect;
  });
  if (allGatesPerfect && isFinalOutputCorrect) {
      bonusScore = 20;
  }

  const roundScore = gateCorrectScore + finalOutputScore + bonusScore;
  room.teamScore += roundScore;

  // roundComplete 送信 (ws 除外は不要)
  room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
      type: 'roundComplete',
      payload: {
          scoreSummary: {
              gateCorrectScore,
              finalOutputScore,
              bonusScore,
              roundScore,
              totalScore: room.teamScore,
              isFinalOutputCorrect
          },
          playerInputLog: room.playerInputLog, // 詳細表示用
          // currentQuestion, gateValues は nextRound で送るので必須ではないかも
          currentQuestion: room.currentQuestion,
          gateValues: room.gateValues
      }
  })));

  room.roundCount++;

  // 次の問題があるか (チュートリアル/通常モード共通で allProblems を使う想定)
  if (room.roundCount < allProblems.length) {
      const nextQuestion = allProblems[room.roundCount];
      room.currentQuestion = nextQuestion; // isTutorial なども含まれる
      room.playerInputLog = [];
      room.gateValues = { ...nextQuestion.inputAssignments };
      nextQuestion.circuit.gates.forEach((gate: Gate) => {
          room.gateValues[gate.id] = null;
      });
      // プレイヤー順シャッフル (任意)
      const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
      room.players = shuffledPlayers.map((p: PlayerInternal, index: number) => ({ ...p, playerOrder: index + 1 }));
      // ゲート再割り当て
      room.playerGateAssignments = assignGatesToPlayers(room.players, nextQuestion.circuit.gates);
      room.status = 'inProgress'; // scoring から戻す

      // nextRound 送信 (シリアライズ必須)
      const serializableNextRoundState = createSerializableState(room);
      room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
          type: 'nextRound',
          payload: serializableNextRoundState
      })));
  } else {
      // ゲーム終了
      room.status = 'ended';
      const isTutorialComplete = room.currentQuestion?.isTutorial ?? false; 
      room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
          type: 'gameEnd',
          payload: { 
            finalTeamScore: room.teamScore,
            isTutorialComplete: isTutorialComplete
           }
      })));
      gameRooms.delete(room.roomId); // ルーム削除
  }
}
// --- ここまでゲームロジック関数 ---


const app = express();
const port = process?.env?.PORT || 10000;

app.use(express.json());

// --- 静的ファイル配信 ---
const staticPath = path.join(process.cwd(), 'dist'); // dist は backend/dist を指す
console.log(`Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));
// --- ここまで静的ファイル配信 ---

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- WebSocket サーバー設定 ---
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected.');
  const wsWithId = ws as WebSocketWithIdentity;

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());

      // --- joinRoom 処理 ---
      if (data.type === 'joinRoom') {
        const { roomId, playerId } = data.payload;
        if (typeof roomId !== 'string' || typeof playerId !== 'string') {
            console.warn('Invalid joinRoom payload:', data.payload); return;
        }
        wsWithId.roomId = roomId;
        wsWithId.playerId = playerId;
        let room = gameRooms.get(roomId);

        // 再接続処理
        if (disconnectionTimers.has(playerId)) {
            clearTimeout(disconnectionTimers.get(playerId)!);
            disconnectionTimers.delete(playerId);
            console.log(`Player ${playerId} reconnected within the grace period.`);
        }

        // 新規ルーム作成
        if (!room) {
          console.log(`New room ${roomId} created with status: waiting`);
          const initialQuestion = halfAdderProblems.find(p => p.isTutorial); // チュートリアル問題を初期値に
          if (!initialQuestion) {
            console.error("No tutorial questions found.");
            ws.send(JSON.stringify({ type: 'error', payload: '初期問題が見つかりません。' })); return;
          }
          const newRoom: GameState = {
            roomId,
            players: [],
            roundCount: -1, // startGame で 0 にする
            teamScore: 0,
            status: 'waiting',
            hostId: playerId,
            currentQuestion: initialQuestion, // problems.ts の型を使う
            gateValues: {}, // startGame で初期化
            playerInputLog: [],
            playerGateAssignments: {}, // startGame で初期化
            playerChoices: {}, // 空で初期化
          };
          gameRooms.set(roomId, newRoom);
          room = newRoom;
        }

        // プレイヤー追加/更新
        const existingPlayerIndex = room.players.findIndex((p: PlayerInternal) => p.playerId === playerId);
        if (existingPlayerIndex === -1) {
            const playerOrder = room.players.length + 1;
            room.players.push({ playerId, ws: wsWithId, playerOrder });
            console.log(`Player ${playerId} joined room ${roomId}`);
        } else {
           console.log(`Player ${playerId} reconnected/updated in room ${roomId}`);
           room.players[existingPlayerIndex].ws = wsWithId; // ws を更新
        }

        // joinSuccess 送信
        ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));

        // roomUpdate 送信 (シリアライズ！)
        const serializableRoomState = createSerializableState(room);
        room.players.forEach((p: PlayerInternal) => {
            p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: serializableRoomState }));
        });

      // --- startGame 処理 ---
      } else if (data.type === 'startGame') {
        const { roomId, mode } = data.payload;
        if (typeof mode !== 'string' || !['tutorial', 'timeAttack', 'circuitPrediction'].includes(mode)) {
           console.warn(`startGame: Invalid mode "${mode}" received.`);
           ws.send(JSON.stringify({ type: 'error', payload: '無効なゲームモードです。' })); return;
        }
        const room = gameRooms.get(roomId);
        // 開始条件チェック
        if (!room) { console.warn(`startGame: Room ${roomId} not found.`); return; }
        if (room.hostId !== wsWithId.playerId) { console.warn(`startGame: Player ${wsWithId.playerId} is not the host.`); return; }
        if (room.players.length < 2) { // プレイヤー人数チェック (チュートリアルでも2人と仮定)
           console.warn(`startGame: Not enough players in room ${roomId}. Need at least 2.`);
           ws.send(JSON.stringify({ type: 'error', payload: 'プレイヤーが2人以上必要です。' })); return;
        }
        if (room.status !== 'waiting') { console.warn(`startGame: Room not waiting.`); return; }

        // ゲーム状態初期化
        room.status = 'inProgress'; // ★ status を設定
        room.roundCount = 0;
        room.teamScore = 0;
        // room.currentQuestion.mode = mode; // currentQuestion ごと設定するので不要かも

        // モードに応じた問題セットを選択 (現在は tutorial のみ考慮)
        const questions = mode === 'tutorial' ? allProblems.filter(p => p.isTutorial) : allProblems;
        if (questions.length === 0) { console.error(`No questions found for mode: ${mode}`); return; }
        const initialQuestion = questions[0]; // 最初の問題

        // プレイヤーシャッフルとゲート割り当て
        const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
        room.players = shuffledPlayers.map((p: PlayerInternal, index: number) => ({ ...p, playerOrder: index + 1 }));
        room.playerGateAssignments = assignGatesToPlayers(room.players, initialQuestion.circuit.gates);

        // 現在の問題とゲート値設定
        room.currentQuestion = initialQuestion; // isTutorial などの情報も含まれる
        room.gateValues = { ...initialQuestion.inputAssignments };
        initialQuestion.circuit.gates.forEach((gate: Gate) => {
          room.gateValues[gate.id] = null;
        });
        room.playerInputLog = [];

        console.log(`Game started in room ${roomId}. Status: ${room.status}`);

        // gameStart 送信 (シリアライズ！)
        const serializableGameState = createSerializableState(room); // ★ status 設定後にシリアライズ
        console.log("Sending gameStart with serializable payload (status included):", serializableGameState.status, serializableGameState); // ★ ログ追加
        room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({
          type: 'gameStart',
          payload: serializableGameState // ★ シリアライズしたものを送信
        })));

      // --- playerInput 処理 (realtime.ts ベース) ---
      } else if (data.type === 'playerInput') {
        const { roomId, playerId, gateId, inputValue } = data.payload;
        // 型チェック (任意)
        if (typeof gateId !== 'string' || typeof inputValue !== 'boolean') {
            console.warn('Invalid playerInput payload:', data.payload); return;
        }
        const room = gameRooms.get(roomId);

        // 入力検証
        if (!room || room.status !== 'inProgress') { console.warn(`playerInput denied: Room ${roomId} not found or not in progress.`); return; }
        const playerAssignments = room.playerGateAssignments[playerId];
        if (!playerAssignments || !playerAssignments.includes(gateId)) { console.warn(`playerInput denied: Gate ${gateId} not assigned to player ${playerId}.`); return; }
        if (room.gateValues[gateId] !== null) { console.warn(`playerInput denied: Gate ${gateId} already resolved.`); return; }

        const currentGate = room.currentQuestion.circuit.gates.find((g: Gate) => g.id === gateId);
        if (!currentGate) { console.error(`playerInput error: Gate ${gateId} not found in current question.`); return; }

        // 正誤判定
        const inputValues = currentGate.inputs.map(input => room.gateValues[input]); // 入力元のゲート値を取得
        const correctOutput = evaluateGate(currentGate.type, inputValues);
        // 入力が揃っていない場合 (correctOutput === null) は不正解とする
        const isCorrect = correctOutput !== null && inputValue === correctOutput;

        // 入力ログを追加
        room.playerInputLog.push({ playerId, gateId, inputValue, isCorrect, timestamp: Date.now() });

        // 正解ならゲート値を更新
        if (isCorrect) {
          room.gateValues[gateId] = inputValue;
          console.log(`Player ${playerId} correctly resolved gate ${gateId} with ${inputValue}`);
        } else {
           console.log(`Player ${playerId} incorrectly resolved gate ${gateId} with ${inputValue}`);
        }

        // gameStateUpdate 送信 (シリアライズ！)
        const serializableUpdateState = createSerializableState(room);
        room.players.forEach((p: PlayerInternal) => p.ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: serializableUpdateState })));

        // 全ゲート完了チェック
        const allGatesCompleted = room.currentQuestion.circuit.gates.every((gate: Gate) => room.gateValues[gate.id] !== null);
        if (allGatesCompleted) {
          console.log(`All gates completed for round ${room.roundCount} in room ${roomId}. Moving to scoring.`);
          room.status = 'scoring';
          scoreAndAdvanceRound(room); // スコア計算と次のラウンドへ
        }

      // --- selectGameMode 処理 ---
      }else if (data.type === 'selectGameMode') {
        const { roomId, playerId, mode } = data.payload;

        // mode のバリデーション
      if (typeof mode !== 'string' || !['tutorial', 'timeAttack', 'circuitPrediction'].includes(mode)) {
        console.warn(`selectGameMode: Invalid mode "${mode}" received.`);
        ws.send(JSON.stringify({ type: 'error', payload: '無効なゲームモードが選択されました。' }));
        return; // ★ 無効ならここで処理を抜ける
      }
     
      // ★ ここから下では mode は 'tutorial' | 'timeAttack' | 'circuitPrediction' のいずれかのはず
      const room = gameRooms.get(roomId);
      if (!room || room.status !== 'waiting') {
        console.log(`selectGameMode denied. Room status: ${room?.status}`);
        return;
      }

      // playerChoices を更新
      if (!room.playerChoices) room.playerChoices = {};

      // ▼▼▼ ここで型アサーションを追加 ▼▼▼
      room.playerChoices[playerId] = mode as 'tutorial' | 'timeAttack' | 'circuitPrediction';
    
      console.log(`Player ${playerId} selected mode ${mode} in room ${roomId}`);

      // roomUpdate 送信
      const serializableRoomState = createSerializableState(room);
      room.players.forEach((p: PlayerInternal) => {
        p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: serializableRoomState }));
      });
      } else if (data.type === 'registerScore') {
        const { teamName, score, playerId } = data.payload;
        // 簡単なバリデーション
        if (typeof teamName === 'string' && typeof score === 'number' && typeof playerId === 'string' && teamName.trim()) {
          const timestamp = Date.now();
          // CSV に追記するデータ行 (改行コード \n を忘れずに)
          const csvRow = `${timestamp},"${teamName.replace(/"/g, '""')}","${score}","${playerId}"\n`; // 名前中の " をエスケープ

          // 非同期でファイルに追記
          fs.appendFile(RANKING_CSV_PATH, csvRow, (err) => {
        if (err) {
          console.error(`Failed to write score to CSV for player ${playerId}:`, err);
          // エラーをクライアントに通知
          ws.send(JSON.stringify({ type: 'error', payload: 'スコアの登録に失敗しました。' }));
        } else {
          console.log(`Score registered for player ${playerId}: ${teamName}, ${score}`);
          // 成功をクライアントに通知 (任意)
          ws.send(JSON.stringify({ type: 'scoreRegistered', payload: { success: true } }));
        }
    });
  } else {
    console.warn(`Invalid registerScore payload received from ${playerId}:`, data.payload);
    ws.send(JSON.stringify({ type: 'error', payload: 'スコア登録データが無効です。' }));
  }
}
else {
          console.warn(`Unknown message type received: ${data.type}`);
      }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({ type: 'error', payload: 'An internal server error occurred.' }));
      }
  });

  // --- close 処理 ---
  ws.on('close', () => {
    console.log(`Client disconnected: ${wsWithId.playerId || 'Unknown'}`);
    const { roomId, playerId } = wsWithId;

    if (roomId && playerId) {
      // 猶予期間タイマー
      const timerId = setTimeout(() => {
        console.log(`Grace period for ${playerId} expired. Removing from room.`);
        const room = gameRooms.get(roomId);
        if (room) {
          room.players = room.players.filter((p: PlayerInternal) => p.playerId !== playerId);
          console.log(`Player ${playerId} removed from room ${roomId}. Remaining: ${room.players.length}`);

          if (room.players.length === 0) {
            console.log(`Room ${roomId} is empty, deleting.`);
            gameRooms.delete(roomId);
            disconnectionTimers.delete(playerId);
            return;
          }

          // ホスト変更
          if (room.hostId === playerId) {
            room.hostId = room.players[0]?.playerId || null;
            console.log(`Host left. New host of room ${roomId}: ${room.hostId}`);
          }
          // プレイヤー順序更新
          room.players.forEach((p: PlayerInternal, index: number) => p.playerOrder = index + 1);

          // roomUpdate 送信 (シリアライズ！)
          const serializableCloseState = createSerializableState(room);
          room.players.forEach((p: PlayerInternal) => {
              p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: serializableCloseState }));
          });
        }
        disconnectionTimers.delete(playerId);
      }, 3000); // 3秒

      disconnectionTimers.set(playerId, timerId);
      console.log(`Starting 3-second grace period for player ${playerId} in room ${roomId}.`);
    }
  });

  // --- error 処理 ---
  ws.on('error', (error: Error) => {
       console.error(`WebSocket error for client ${wsWithId.playerId || 'Unknown'}:`, error);
  });
});
// --- ここまで WebSocket サーバー設定 ---

// --- サーバー起動 ---
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
// --- ここまでサーバー起動 ---

// --- 静的ファイル配信 (ルートハンドラ) ---
// 他の API ルートなどより後に定義する
app.get('*', (req, res) => {
  // フロントエンドからのリクエストか判定 (任意だが推奨)
  // 例: Accept ヘッダーが text/html を含むか、パスが /api で始まらないかなど
  if (req.headers.accept && req.headers.accept.includes('text/html') && !req.path.startsWith('/api')) {
      const indexPath = path.join(staticPath, 'index.html');
      console.log(`Attempting to send file: ${indexPath} for path ${req.path}`);
      res.sendFile(indexPath, (err) => {
          if (err) {
              console.error("Error sending index.html:", err);
              // エラーの場合でも 404 を返す方が適切な場合もある
              if (!res.headersSent) {
                res.status(500).send("Internal server error loading application");
              }
          }
      });
  } else {
      // API へのリクエストや、HTML を期待しないリクエストはここでは処理しない
      // (通常は 404 Not Found になるか、他のミドルウェアで処理される)
      res.status(404).send('Not Found');
  }
});
// --- ここまで静的ファイル配信 ---