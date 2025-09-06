import React, { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomState, GameState } from '../types';
import { PlayerIdContext } from './PlayerIdContext';

// Contextが提供するデータの型を定義
interface WebSocketContextType {
  roomState: RoomState | null;
  gameState: GameState;
  sendMessage: (type: string, payload: object) => void;
  isConnected: boolean;
}

// Contextを作成
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
    players: [],
    teamScore: 0,
    isGameFinished: false,
    roundCount: 0,
    currentQuestion: null,
    playerInputs: [],
  });

  useEffect(() => {
    if (playerId) {
      const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

      ws.onopen = () => {
        console.log('Global WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);

        switch (message.type) {
          case 'roomUpdate':
            setRoomState(message.payload);
            if (message.payload.status === 'inProgress') {
              setGameState(prevState => ({
                ...prevState,
                currentQuestion: message.payload.currentQuestion,
                players: message.payload.players,
                teamScore: message.payload.teamScore,
                roundCount: message.payload.roundCount,
                isGameFinished: message.payload.isGameFinished || false,
              }));
            }
            break;

          case 'gameStart': { 
            const { payload } = message;
            setGameState(prevState => ({
              ...prevState,
              players: payload.players,
              teamScore: payload.teamScore,
              currentQuestion: payload.currentQuestion,
              playerInputs: payload.playerInputs || [],
              isGameFinished: false,
              roundCount: 0,
            }));
            const mode = payload.mode || 'tutorial';
            navigate(`/play/${mode}/${payload.roomId}`); 
            break;
          }

          case 'turnUpdate':
            setGameState(prev => ({
              ...prev,
              currentPlayerId: message.payload.currentPlayerId,
              // lastInputなどの追加情報も必要に応じてgameStateに保存できます
            }));
            break;
          
          case 'nextRound':
            setGameState(prev => ({
              ...prev,
              roundCount: message.payload.roundCount,
              currentQuestion: message.payload.currentQuestion,
              teamScore: message.payload.updatedTeamScore,
              playerInputs: [], // 新しいラウンドなので入力をリセット
            }));
            break;
            
          case 'gameEnd':
            setGameState(prev => ({
              ...prev,
              teamScore: message.payload.finalTeamScore,
              isGameFinished: true,
            }));
            break;
        }
      };

      ws.onclose = () => {
        console.log('Global WebSocket disconnected');
        setIsConnected(false);
      };

      setWebSocket(ws);

      return () => {
        ws.close();
      };
    }
  }, [playerId, navigate]);

  const sendMessage = (type: string, payload: object) => {
    if (webSocket?.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({ type, payload }));
    }
  };

  return (
    <WebSocketContext.Provider value={{ roomState, gameState, sendMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

