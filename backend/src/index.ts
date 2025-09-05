import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import apiRouter from './routes/api';
import { setupWebSocketServer } from './realtime';
import WebSocket from "ws";

// チュートリアル用の問題配列を定義
const tutorialCircuits = [
  { circuit: ['AND', 'NOT'], expectedOutput: false, isTutorial: true },
  { circuit: ['OR', 'AND'], expectedOutput: true, isTutorial: true },
  { circuit: ['OR', 'NOT', 'AND'], expectedOutput: false, isTutorial: true }
];

interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, playerOrder: number }[];
  currentPlayerId: string | null;
  roundCount: number;
  teamScore: number;
  currentQuestion: {
    circuit: string[];
    expectedOutput: boolean;
    isTutorial?: boolean;
  };
  currentPlayerIndex: number;
  playerInputs: (boolean | null)[];
  status: 'waiting' | 'inProgress' | 'ended';
  playerChoices: { [playerId: string]: string };
  hostId: string | null;
}

const gameRooms = new Map<string, GameState>();
const app = express();
const port = process?.env?.PORT || 3000;

function generateRoomId(): string {
  const min = 10000;
  const max = 99999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}


// ここから消さないで！！！！//////////////////
app.use(express.json());
const staticPath = path.join(__dirname, '..', 'dist');
app.use(express.static(staticPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});
//ここまで///////////////////////////////////

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  console.log('Client connected.');

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
          console.log(`New room ${roomId} created with status: ${room.status}`);
        }
        
        const playerOrder = room.players.length + 1;
        room.players.push({ playerId, ws, playerOrder });
        
        console.log(`Player ${playerId} joined room ${roomId}`);
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
        room.currentPlayerIndex = 0;
        room.currentPlayerId = room.players[0].playerId;

        if (mode === 'tutorial') {
          room.currentQuestion = tutorialCircuits[0];
        } else {
          room.currentQuestion = generateNewQuestion();
        }
        room.playerInputs = new Array(room.players.length).fill(null);

        room.players.forEach(p => {
          p.ws.send(JSON.stringify({ 
            type: 'gameStart', 
            payload: { 
              currentQuestion: room.currentQuestion, 
              currentPlayerIndex: room.currentPlayerIndex,
              currentPlayerId: room.currentPlayerId,
              players: room.players.map(p => ({ id: p.playerId, playerOrder: p.playerOrder })),
              teamScore: room.teamScore,
              mode: mode,
            }
          }));
        });
        console.log(`Game started in room ${roomId}. Status: ${room.status}`);
      }
      
      else if (data.type === 'playerInput') {
        const { roomId, playerId, inputValue } = data.payload;
        const room = gameRooms.get(roomId);

        if (!room || room.status !== 'inProgress' || room.currentPlayerId !== playerId) {
          return;
        }

        room.playerInputs[room.currentPlayerIndex] = inputValue;

        if (room.currentPlayerIndex === room.players.length - 1) {
          let currentOutput = room.playerInputs[0] as boolean;
          for (let i = 1; i < room.playerInputs.length; i++) {
            const gateType = room.currentQuestion.circuit[i - 1];
            const nextInput = room.playerInputs[i] as boolean;
            if (gateType === 'AND') {
              currentOutput = currentOutput && nextInput;
            } else if (gateType === 'OR') {
              currentOutput = currentOutput || nextInput;
            } else if (gateType === 'NOT') {
              currentOutput = !currentOutput;
            }
          }
          const isCorrect = currentOutput === room.currentQuestion.expectedOutput;
          if (isCorrect) {
            room.teamScore += 10;
          }
          
          room.roundCount++;

          if (room.currentQuestion.isTutorial) {
            if (room.roundCount < tutorialCircuits.length) {
              room.currentQuestion = tutorialCircuits[room.roundCount];
              room.currentPlayerIndex = 0;
              room.currentPlayerId = room.players[0].playerId;
              room.playerInputs = new Array(room.players.length).fill(null);

              room.players.forEach(p => {
                p.ws.send(JSON.stringify({
                  type: 'nextRound',
                  payload: {
                    roundCount: room.roundCount,
                    currentQuestion: room.currentQuestion,
                    updatedTeamScore: room.teamScore,
                  }
                }));
              });
            } else {
              room.status = 'ended';
              room.players.forEach(p => {
                p.ws.send(JSON.stringify({
                  type: 'gameEnd',
                  payload: { message: 'Tutorial complete!', finalTeamScore: room.teamScore }
                }));
              });
              gameRooms.delete(roomId);
            }
          } else {
            if (room.roundCount >= 3) {
              room.status = 'ended';
              room.players.forEach(p => {
                p.ws.send(JSON.stringify({
                  type: 'gameEnd',
                  payload: {
                    isCorrect,
                    finalOutput: currentOutput,
                    expectedOutput: room.currentQuestion.expectedOutput,
                    finalTeamScore: room.teamScore,
                  }
                }));
              });
              gameRooms.delete(roomId);
            } else {
              const newQuestion = generateNewQuestion();
              room.currentQuestion = newQuestion;
              room.currentPlayerIndex = 0;
              room.currentPlayerId = room.players[0].playerId;
              room.playerInputs = new Array(room.players.length).fill(null);
  
              room.players.forEach(p => {
                p.ws.send(JSON.stringify({
                  type: 'nextRound',
                  payload: {
                    roundCount: room.roundCount,
                    currentQuestion: room.currentQuestion,
                    updatedTeamScore: room.teamScore,
                  }
                }));
              });
            }
          }

        } else {
          room.currentPlayerIndex++;
          room.currentPlayerId = room.players[room.currentPlayerIndex].playerId;

          room.players.forEach(p => {
            p.ws.send(JSON.stringify({
              type: 'turnUpdate',
              payload: {
                currentPlayerId: room.currentPlayerId,
                lastInput: inputValue,
                circuitGateType: room.currentQuestion.circuit[room.currentPlayerIndex - 1]
              }
            }));
          });
        }
      }
      
      else if (data.type === 'selectGameMode') {
        const { roomId, playerId, mode } = data.payload;
        const room = gameRooms.get(roomId);

        if (!room || room.status !== 'waiting' || room.hostId !== playerId) {
            console.log(`Unauthorized selectGameMode request from player ${playerId} in room ${roomId}.`);
            return;
        }

        room.playerChoices[playerId] = mode;
        
        room.players.forEach(p => {
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
        });
      }
    } catch (error) {
      console.error(error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

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

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



