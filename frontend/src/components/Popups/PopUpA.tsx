// src/hooks/useGameWebSocket.ts
import { useState, useEffect, useRef } from 'react';
import type { RoomState, GameState, GamePlayer } from '../types';
import type { Question } from '../types'; // Question型もインポート

// WebSocket接続を管理するシングルトン
class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private listeners: ((event: MessageEvent) => void)[] = [];

  private constructor() {
    this.connect();
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

    this.ws.onmessage = (event) => {
      this.listeners.forEach(listener => listener(event));
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected. Attempting to reconnect...');
    };

    this.ws.onerror = (error) => console.error('WebSocket error:', error);
  }

  public addMessageListener(listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  public removeMessageListener(listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected. Message not sent.');
    }
  }

  public getWs(): WebSocket | null {
    return this.ws;
  }
}

const wsManager = WebSocketManager.getInstance();

export const useGameWebSocket = (roomId: string, playerId: string) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleMessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    console.log('Received message:', message);

    switch (message.type) {
      case 'roomUpdate':
        setRoomState(message.payload);
        // `prev`にRoomState型を明示
        setGameState((prev: GameState | null) => prev ? { ...prev, players: message.payload.players } : null);
        break;

      case 'gameStart':
        setGameState(message.payload);
        break;

      case 'nextRound':
        setGameState((prev: GameState | null) => prev ? {
          ...prev,
          roundCount: message.payload.roundCount,
          currentQuestion: message.payload.currentQuestion,
          teamScore: message.payload.updatedTeamScore,
          playerInputs: new Array(prev.players.length).fill(null),
        } : null);
        break;

      case 'gameEnd':
        setGameState((prev: GameState | null) => prev ? {
          ...prev,
          isGameFinished: true,
          teamScore: message.payload.finalTeamScore,
        } : null);
        break;

      case 'playerInputUpdate':
        setGameState((prev: GameState | null) => {
          if (!prev) return null;
          const newPlayerInputs = [...prev.playerInputs];
          const { gateIndex, inputValue } = message.payload;
          newPlayerInputs[gateIndex] = inputValue;
          return { ...prev, playerInputs: newPlayerInputs };
        });
        break;
    }
  };

  useEffect(() => {
    wsManager.addMessageListener(handleMessage);

    const ws = wsManager.getWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'syncState',
        payload: { roomId, playerId },
      }));
    }

    return () => {
      wsManager.removeMessageListener(handleMessage);
    };
  }, [roomId, playerId]);

  const sendMessage = (type: string, payload: object) => {
    wsManager.sendMessage({ type, payload });
  };

  return { roomState, gameState, sendMessage };
};