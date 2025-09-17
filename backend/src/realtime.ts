// src/realtime.ts
import { WebSocketServer, WebSocket } from "ws";
import { tutorialProblems, halfAdderCircuit } from './problems';

// 問題セットを結合して1つの配列にする
const allProblems = [...tutorialProblems];

export interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, playerOrder: number }[];
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
export const gameRooms = new Map<string, GameState>();

interface WebSocketWithIdentity extends WebSocket {
  roomId?: string;
  playerId?: string;
}

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

function generateNewQuestion() {
  const selectedProblem = allProblems[Math.floor(Math.random() * allProblems.length)];
  return { ...selectedProblem, isTutorial: false }; // 本番用としてisTutorialをfalseに上書き
}

function assignGatesToPlayers(players: any[], gates: any[]) {
  const assignments: { [playerId: string]: string[] } = {};
  players.forEach(p => assignments[p.playerId] = []);
  const sortedGates = [...gates].sort((a, b) => a.stage - b.stage);
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
  const allGatesPerfect = room.currentQuestion.circuit.gates.every(gate => {
      const log = room.playerInputLog.find(l => l.gateId === gate.id);
      return log && log.isCorrect;
  });
  if (allGatesPerfect) {
      bonusScore = 20;
  }
  const roundScore = gateCorrectScore + finalOutputScore + bonusScore;
  room.teamScore += roundScore;
  room.players.forEach(p => p.ws.send(JSON.stringify({
      type: 'roundComplete',
      payload: {
          scoreSummary: {
              gateCorrectScore,
              finalOutputScore,
              bonusScore,
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
      room.currentQuestion = nextQuestion;
      room.playerInputLog = [];
      room.gateValues = { ...nextQuestion.inputAssignments };
      nextQuestion.circuit.gates.forEach(gate => {
          room.gateValues[gate.id] = null;
      });
      const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
      room.players = shuffledPlayers;
      room.playerGateAssignments = assignGatesToPlayers(room.players, nextQuestion.circuit.gates);
      room.players.forEach(p => p.ws.send(JSON.stringify({
          type: 'nextRound',
          payload: room
      })));
  } else {
      room.status = 'ended';
      room.players.forEach(p => p.ws.send(JSON.stringify({
          type: 'gameEnd',
          payload: { finalTeamScore: room.teamScore }
      })));
      gameRooms.delete(room.roomId);
  }
}

export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', ws => {
    const wsWithId = ws as WebSocketWithIdentity;
    ws.on('message', message => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'joinRoom') {
          const { roomId, playerId } = data.payload;
          wsWithId.roomId = roomId;
          wsWithId.playerId = playerId;
          let room = gameRooms.get(roomId);
          if (!room) {
            const initialQuestion = tutorialProblems.find(p => p.isTutorial);
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
          const playerOrder = room.players.length + 1;
          room.players.push({ playerId, ws, playerOrder });
          ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));
          room.players.forEach(p => p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room })));
        
        } else if (data.type === 'startGame') {
          const { roomId, mode } = data.payload;
          const room = gameRooms.get(roomId);
          if (!room || room.players.length < 2 || room.status !== 'waiting') return;
          room.status = 'inProgress';
          room.roundCount = 0;
          const questions = mode === 'tutorial' ? allProblems.filter(p => p.isTutorial) : allProblems;
          if (questions.length === 0) {
              console.error(`No questions found for mode: ${mode}`);
              return;
          }
          const initialQuestion = questions[0];
          const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
          room.players = shuffledPlayers;
          room.playerGateAssignments = assignGatesToPlayers(room.players, initialQuestion.circuit.gates);
          room.currentQuestion = initialQuestion as any;
          room.gateValues = { ...initialQuestion.inputAssignments };
          initialQuestion.circuit.gates.forEach(gate => {
            room.gateValues[gate.id] = null;
          });
          room.playerInputLog = [];
          room.players.forEach(p => p.ws.send(JSON.stringify({ type: 'gameStart', payload: room })));
        
        } else if (data.type === 'playerInput') {
          const { roomId, playerId, gateId, inputValue } = data.payload;
          const room = gameRooms.get(roomId);
          if (!room || room.status !== 'inProgress') return;
          if (!room.playerGateAssignments[playerId].includes(gateId) || room.gateValues[gateId] !== null) return;
          const currentGate = room.currentQuestion.circuit.gates.find(g => g.id === gateId);
          if (!currentGate) return;
          const inputValues = currentGate.inputs.map(input => room.gateValues[input]);
          const correctOutput = evaluateGate(currentGate.type, inputValues);
          const isCorrect = correctOutput !== null && inputValue === correctOutput;
          room.playerInputLog.push({
            playerId,
            gateId,
            inputValue,
            isCorrect,
            timestamp: Date.now()
          });
          if (isCorrect) {
            room.gateValues[gateId] = inputValue;
          }
          room.players.forEach(p => p.ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: room })));
          const allGatesCompleted = room.currentQuestion.circuit.gates.every(gate => room.gateValues[gate.id] !== null);
          if (allGatesCompleted) {
            room.status = 'scoring';
            scoreAndAdvanceRound(room);
          }
        
        } else if (data.type === 'selectGameMode') {
          // このイベントはstartGameに統合されたため、ここでは処理しない
          console.log('selectGameMode event is deprecated.');
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (wsWithId.roomId && wsWithId.playerId) {
        const room = gameRooms.get(wsWithId.roomId);
        if (room) {
          room.players = room.players.filter(p => p.playerId !== wsWithId.playerId);
          if (room.players.length === 0) {
            gameRooms.delete(wsWithId.roomId);
          } else {
            room.players.forEach(p => p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room })));
          }
        }
      }
    });
  });
}