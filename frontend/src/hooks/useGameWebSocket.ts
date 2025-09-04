// src/hooks/useGameWebSocket.ts

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomState, GameState } from '../types'; // 型定義ファイルをインポート

const WEBSOCKET_URL = 'wss://logic-slg.onrender.com'; 

export const useGameWebSocket = (roomId: string, playerId: string) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: null,
    currentPlayerId: null,
    players: [],
    teamScore: 0, //teamScore を初期化
    isGameFinished: false,
  });

  const webSocketRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

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
        //  playerChoices を含む新しい形式に対応
        case 'roomUpdate':
          setRoomState(message.payload);
          break;

        // ✨ チームスコア形式に対応
        case 'gameStart':
          setGameState(prev => ({
            ...prev,
            currentQuestion: message.payload.currentQuestion,
            currentPlayerId: message.payload.currentPlayerId,
            players: message.payload.players,
            teamScore: message.payload.teamScore, // teamScore をセット
            isGameFinished: false,
          }));
          navigate(`/game/${roomId}`);
          break;

        case 'turnUpdate':
          setGameState(prev => ({
            ...prev,
            currentPlayerId: message.payload.currentPlayerId,
            lastInput: message.payload.lastInput,
            roundResult: undefined,
          }));
          break;
        
        // ✨ チームスコア形式に対応
        case 'roundResult':
          setGameState(prev => ({
            ...prev,
            teamScore: message.payload.updatedTeamScore, // teamScore を更新
            roundResult: message.payload,
          }));
          break;

        // ✨ チームスコア形式に対応
        case 'gameEnd':
          setGameState(prev => ({
            ...prev,
            teamScore: message.payload.finalTeamScore, // 最終スコアをセット
            isGameFinished: true,
          }));
          break;
      }
    };

    ws.onclose = () => console.log('WebSocket disconnected');
    ws.onerror = (error) => console.error('WebSocket error:', error);

    return () => {
      ws.close();
    };
  }, [roomId, playerId, navigate]);

  const sendMessage = (type: string, payload: object) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify({ type, payload }));
    }
  };

  return { roomState, gameState, sendMessage };
};