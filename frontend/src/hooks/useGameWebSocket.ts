import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomState, GameState} from '../types'; // GamePlayerもインポート

export const useGameWebSocket = (roomId: string, playerId: string) => {
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  
  // ✨ 1. GameStateの初期値を、新しい設計図(types.ts)に合わせる
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    teamScore: 0,
    isGameFinished: false,
    roundCount: 0,
    currentQuestion: null,
    playerInputs: [],
  });

  const webSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);
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
        case 'roomUpdate':
          setRoomState(message.payload);
          // (将来的に、ゲーム中の再接続のためにここも賢くします)
          break;

        // ✨ 2. gameStartで受け取るデータ形式の変更に対応
        case 'gameStart': { 
          console.log('Received gameStart signal. Saving state and navigating...');
          
          const { payload } = message;

          // 新しいペイロードからgameStateを構築
          setGameState(prevState => ({
            ...prevState,
            players: payload.players, // サーバーからのプレイヤーリスト(assignedGatesを含む)
            teamScore: payload.teamScore,
            currentQuestion: payload.currentQuestion,
            playerInputs: payload.playerInputs,
            isGameFinished: false,
            roundCount: 0,
          }));
          
          const mode = payload.mode || 'tutorial'; // modeがない場合のフォールバック
          navigate(`/play/${mode}/${roomId}`); 
          break;
        }

        // ... (turnUpdate, roundResult, gameEndはステップ3でUIと合わせて修正します)
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

