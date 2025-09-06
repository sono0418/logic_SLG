// src/realtime.ts

import { WebSocketServer, WebSocket } from "ws";
import { tutorialCircuits, handleTutorialLogic } from './tutorial';

// wsインスタンスにプロパティを追加するための型拡張
interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}

// ゲームの状態を管理するインターフェースを定義
export interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, playerOrder: number, assignedGates: number[] }[];
  currentPlayerId: string | null;
  roundCount: number;
  teamScore: number;
  currentQuestion: {
    circuit: string[];
    expectedOutput: boolean | { C: boolean; S: boolean; };
    isTutorial?: boolean;
  };
  currentPlayerIndex: number;
  playerInputs: (boolean | null)[];
  status: 'waiting' | 'inProgress' | 'ended';
  playerChoices: { [playerId: string]: string };
  hostId: string | null;
}
export const gameRooms = new Map<string, GameState>();

function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

function generateNewQuestion() {
  const gateTypes = ['AND', 'OR', 'NOT'];
  const circuitLength = Math.floor(Math.random() * 2) + 2;
  const circuit = [];
  for (let i = 0; i < circuitLength; i++) {
    circuit.push(gateTypes[Math.floor(Math.random() * gateTypes.length)]);
  }
  const initialInput = Math.random() < 0.5;
  let expectedOutput = initialInput;
  for (let i = 0; i < circuit.length; i++) {
    const gateType = circuit[i];
    if (gateType === 'AND') {
      expectedOutput = expectedOutput && (Math.random() < 0.5);
    } else if (gateType === 'OR') {
      expectedOutput = expectedOutput || (Math.random() < 0.5);
    } else if (gateType === 'NOT') {
      expectedOutput = !expectedOutput;
    }
  }
  return { circuit, expectedOutput };
}

export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', ws => {
    const wsWithId = ws as WebSocketWithIdentity;

    ws.on('message', message => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'joinRoom') {
          const { roomId, playerId } = data.payload;
          let room = gameRooms.get(roomId);

          if (!room) {
            const newRoom: GameState = {
              roomId,
              players: [],
              currentQuestion: { circuit: [], expectedOutput: false },
              currentPlayerIndex: 0,
              playerInputs: [],
              status: 'waiting',
              currentPlayerId: null,
              roundCount: 0,
              teamScore: 0,
              playerChoices: {},
              hostId: playerId,
            };
            gameRooms.set(roomId, newRoom);
            room = newRoom;
          }
          
          const playerOrder = room.players.length + 1;
          room.players.push({ playerId, ws, playerOrder, assignedGates: [] }); // assignedGatesを追加
          
          wsWithId.roomId = roomId;
          wsWithId.playerId = playerId;
          
          ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));
          room.players.forEach(p => {
            p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room }));
          });
        }
        
        else if (data.type === 'startGame') {
          const { roomId, playerId, mode } = data.payload;
          const room = gameRooms.get(roomId);

          if (!room || room.players[0].playerId !== playerId || room.players.length < 2 || room.status === 'inProgress') {
            return;
          }

          room.status = 'inProgress';
          room.roundCount = 0;
          
          // ① プレイヤーの順番をラウンド毎にランダム化
          // ② タスク（ゲート）の事前割り当て
          const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
          const circuitToAssign = mode === 'tutorial' ? tutorialCircuits[0].circuit : generateNewQuestion().circuit;

          shuffledPlayers.forEach(p => p.assignedGates = []);
          circuitToAssign.forEach((gate, index) => {
            const playerIndex = index % shuffledPlayers.length;
            shuffledPlayers[playerIndex].assignedGates.push(index);
          });
          room.players = shuffledPlayers.map((p, i) => ({...p, playerOrder: i + 1}));
          room.currentQuestion = { circuit: circuitToAssign, expectedOutput: true }; // 例
          room.playerInputs = new Array(circuitToAssign.length).fill(null);

          // 最初の担当ゲートを全プレイヤーに表示するためのメッセージ
          const initialGatesMessage = room.players.map(p => ({
            playerId: p.playerId,
            assignedGates: p.assignedGates
          }));
          
          room.players.forEach(p => {
            p.ws.send(JSON.stringify({ 
              type: 'gameStart', 
              payload: { 
                players: initialGatesMessage,
                teamScore: room.teamScore
              }
            }));
          });
        }
        
        else if (data.type === 'playerInput') {
          const { roomId, playerId, inputValue, gateIndex } = data.payload; // gateIndexを追加
          const room = gameRooms.get(roomId);

          if (!room || room.status !== 'inProgress') {
            return;
          }

          // プレイヤーの担当ゲートかどうかを確認
          const player = room.players.find(p => p.playerId === playerId);
          if (!player || !player.assignedGates.includes(gateIndex)) {
            return; // 不正な入力
          }

          room.playerInputs[gateIndex] = inputValue;

          // 全員の入力が揃ったか確認
          if (room.playerInputs.every(input => input !== null)) {
            // --- 最終評価とスコアリング ---
            // ... (ロジックは単線リレーのまま)
          } else {
            // まだ入力が残っている場合
            // 次の担当ゲートがあれば、その情報を送信するロジックが必要
          }
        }
      } catch (error) {
        console.error(error);
      }
    });

    ws.on('close', () => {
      const wsWithId = ws as WebSocketWithIdentity;
      const roomId = wsWithId.roomId;
      const playerId = wsWithId.playerId;

      if (roomId && playerId) {
        const room = gameRooms.get(roomId);
        if (room) {
          const originalPlayerCount = room.players.length;
          room.players = room.players.filter(p => p.playerId !== playerId);
          const newPlayerCount = room.players.length;

          if (newPlayerCount === 0) {
            gameRooms.delete(roomId);
            return;
          }

          room.players.forEach((p, index) => {
            p.playerOrder = index + 1;
          });

          if (originalPlayerCount > newPlayerCount && room.hostId === playerId) {
            room.hostId = room.players[0].playerId;
          }

          room.players.forEach(p => {
            if (p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({
                type: 'roomUpdate',
                payload: {
                  roomId: room.roomId,
                  players: room.players.map(player => ({ id: player.playerId, playerOrder: player.playerOrder })),
                  playerChoices: room.playerChoices,
                  hostId: room.hostId,
                  teamScore: room.teamScore,
                }
              }));
            }
          });
        }
      }
    });
  });
}