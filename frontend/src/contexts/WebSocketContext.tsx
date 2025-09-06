import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomState, GameState } from '../types';
import { PlayerIdContext } from './PlayerIdContext';

interface WebSocketContextType {
  roomState: RoomState | null;
  gameState: GameState;
  sendMessage: (type: string, payload: object) => void;
  isConnected: boolean;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const playerId = useContext(PlayerIdContext);
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [], teamScore: 0, isGameFinished: false, roundCount: 0, currentQuestion: null, playerInputs: [],
  });

  useEffect(() => {
    if (playerId) {
      const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);
      ws.onopen = () => { console.log('Global WebSocket connected'); setIsConnected(true); };
      ws.onclose = () => { console.log('Global WebSocket disconnected'); setIsConnected(false); };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);
        switch (message.type) {
          case 'roomUpdate':
            setRoomState(message.payload);
            if (message.payload.status === 'inProgress') {
              setGameState(prevState => ({ ...prevState, ...message.payload }));
            }
            break;
          case 'gameStart': { 
            const { payload } = message;
            setGameState(prevState => ({ ...prevState, ...payload, isGameFinished: false, roundCount: 0 }));
            const mode = payload.mode || 'tutorial';
            navigate(`/play/${mode}/${payload.roomId}`); 
            break;
          }
          case 'turnUpdate':
            setGameState(prev => ({ ...prev, currentPlayerId: message.payload.currentPlayerId }));
            break;
          case 'nextRound':
            setGameState(prev => ({ ...prev, ...message.payload, playerInputs: [] }));
            break;
          case 'gameEnd':
            setGameState(prev => ({ ...prev, teamScore: message.payload.finalTeamScore, isGameFinished: true }));
            break;
        }
      };
      setWebSocket(ws);
      return () => { ws.close(); };
    }
  }, [playerId, navigate]);

  // ✨ useCallbackでsendMessage関数をメモ化する
  const sendMessage = useCallback((type: string, payload: object) => {
    if (webSocket?.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({ type, payload }));
    }
  }, [webSocket]);

  // ✨ useMemoでContextの値をメモ化する
  const contextValue = useMemo(() => ({
    roomState,
    gameState,
    sendMessage,
    isConnected,
  }), [roomState, gameState, sendMessage, isConnected]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

