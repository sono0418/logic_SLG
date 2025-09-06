//src/context.WebSoketContext.tsx
import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomState, GameState } from '../types';
import { PlayerIdContext } from './PlayerIdContext';

// Contextが提供するデータの型を定義
interface WebSocketContextType {
  roomState: RoomState | null;
  gameState: GameState;
  sendMessage: (type: string, payload: object) => void;
  joinRoom: (roomId: string) => void;
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
    // プレイヤーIDが確定したら接続を開始
    if (playerId) {
      const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

      ws.onopen = () => {
        console.log('Global WebSocket connected');
        setIsConnected(true);
      };

      ws.onclose = () => {
        console.log('Global WebSocket disconnected');
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);

        switch (message.type) {
          case 'roomUpdate':
            setRoomState(message.payload);
            // ゲーム進行中の情報が含まれていれば、gameStateも更新
            if (message.payload.status === 'inProgress') {
              setGameState(prevState => ({ ...prevState, ...message.payload }));
            }
            break;

          case 'gameStart': { 
            const { payload } = message;
            setGameState(prevState => ({ ...prevState, ...payload, isGameFinished: false, roundCount: 0 }));
            // roomIdがペイロードに含まれているか安全確認
            if (payload.roomId) {
              const mode = payload.mode || 'tutorial';
              navigate(`/play/${mode}/${payload.roomId}`); 
            } else {
              console.error("Critical Error: gameStart payload is missing roomId.");
            }
            break;
          }

          case 'turnUpdate':
            // turnUpdateメッセージでgameStateの必要な部分を更新
            // 例: setGameState(prev => ({ ...prev, currentPlayerId: message.payload.currentPlayerId }));
            // 現在のゲームロジックではturnUpdateの詳細が未定のため、必要に応じて実装
            break;
            
          case 'nextRound':
            setGameState(prev => ({ 
              ...prev, 
              ...message.payload,
              // playerInputsをリセットするなど、ラウンド開始時の処理を追加
              playerInputs: new Array(prev.currentQuestion?.circuit.length || 0).fill(null) 
            }));
            break;
            
          case 'gameEnd':
            setGameState(prev => ({ 
              ...prev, 
              teamScore: message.payload.finalTeamScore, 
              isGameFinished: true 
            }));
            break;
        }
      };

      setWebSocket(ws);

      // Providerがアンマウントされるときに接続を閉じる
      return () => {
        ws.close();
      };
    }
  }, [playerId, navigate]);

  // sendMessage関数をメモ化し、不要な再生成を防ぐ
  const sendMessage = useCallback((type: string, payload: object) => {
    if (webSocket?.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({ type, payload }));
    }
  }, [webSocket]);

  // joinRoom関数をメモ化
  const joinRoom = useCallback((roomId: string) => {
    if (playerId && isConnected) {
      sendMessage('joinRoom', { roomId, playerId });
    }
  }, [playerId, isConnected, sendMessage]);

  // Contextの値をメモ化し、不要な再レンダリングを防ぐ
  const contextValue = useMemo(() => ({
    roomState,
    gameState,
    sendMessage,
    joinRoom,
    isConnected,
  }), [roomState, gameState, sendMessage, joinRoom, isConnected]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

