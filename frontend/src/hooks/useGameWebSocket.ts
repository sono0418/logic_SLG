// src/hooks/useGameWebSocket.ts
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// WebSocketサーバーのURL
const WEBSOCKET_URL = 'wss://logic-slg.onrender.com';

// 新しいGameStateインターフェースを定義
export interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, playerOrder: number }[];
  roundCount: number;
  teamScore: number;
  status: 'waiting' | 'inProgress' | 'ended' | 'scoring';
  hostId: string | null;

  currentQuestion: {
    circuit: {
      gates: any[];
      outputs: any;
    };
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

export const useGameWebSocket = (roomId: string, playerId: string) => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WEBSOCKET_URL);
    webSocketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({
        type: 'joinRoom',
        payload: { roomId, playerId },
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);

      switch (message.type) {
        case 'joinSuccess':
          console.log(`Successfully joined room ${message.payload.roomId} as player ${message.payload.playerId}`);
          break;
        case 'roomUpdate':
        case 'gameStart':
        case 'gameStateUpdate':
        case 'nextRound':
        case 'roundComplete':
        case 'gameEnd':
        case 'skipRequested':
          setGameState(message.payload);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
          break;
      }
    };

    ws.onclose = () => console.log('WebSocket disconnected');
    ws.onerror = (error) => console.error('WebSocket error:', error);

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, [roomId, playerId, navigate]);

  const sendMessage = (type: string, payload: object) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify({ type, payload }));
    }
  };

  return { gameState, sendMessage };
};
