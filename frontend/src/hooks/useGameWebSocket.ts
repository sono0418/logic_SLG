// src/hooks/useGameWebSocket.ts
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// WebSocketサーバーのURL
const WEBSOCKET_URL = 'wss://logic-slg.onrender.com';

// GameStateインターフェース (バックエンドと型を合わせる)
// Player の型定義をバックエンドの SerializableGameState に合わせる
type PlayerSerializable = {
  playerId: string;
  playerOrder: number;
  // ws プロパティはフロントエンドでは不要
};

export interface GameState {
  roomId: string;
  players: PlayerSerializable[]; // ws を含まない Player 型を使用
  roundCount: number;
  teamScore: number;
  status: 'waiting' | 'inProgress' | 'ended' | 'scoring';
  hostId: string | null;
  playerChoices?: { [playerId: string]: 'tutorial' | 'timeAttack' | 'circuitPrediction' }; // ? を付けてオプショナルにする
  currentQuestion: {
    circuit: {
      gates: any[]; // 必要なら Gate 型を定義
      outputs: any;
    };
    inputAssignments: { [key: string]: boolean };
    expectedOutput: { C: boolean; S: boolean; };
    isTutorial?: boolean;
    // バックエンドから gameMode が送られてくる場合は追加
    // gameMode?: 'tutorial' | 'timeAttack' | 'circuitPrediction';
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
  // バックエンドから送られてくる可能性のある他のプロパティも追加
  // (例: currentPlayerIndex, currentPlayerId など)
  currentPlayerIndex?: number;
  currentPlayerId?: string;
}

export const useGameWebSocket = (roomId: string | undefined, playerId: string | null) => { // roomId, playerId が undefined/null の可能性を考慮
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // roomId または playerId がなければ何もしない
    if (!roomId || !playerId) {
      console.warn('[WebSocket Hook] roomId or playerId is missing. WebSocket connection not established.');
      return;
    }

    console.log('[WebSocket Hook] Attempting to connect...'); // 接続試行ログ
    const ws = new WebSocket(WEBSOCKET_URL);
    webSocketRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket Hook] WebSocket connected');
      ws.send(JSON.stringify({
        type: 'joinRoom',
        payload: { roomId, playerId },
      }));
    };

    ws.onmessage = (event) => {
      try { // try-catch を追加
        const message = JSON.parse(event.data);
        // ▼▼▼ 受信直後のログ ▼▼▼
        console.log('[WebSocket Hook] Received message:', message);

        switch (message.type) {
          case 'joinSuccess': // joinSuccess の case も追加 (ログ用)
             console.log(`[WebSocket Hook] Successfully joined room ${message.payload?.roomId} as player ${message.payload?.playerId}`);
             // joinSuccess 自体では gameState は更新しない (roomUpdate を待つ)
             break;
          case 'roomUpdate':
          case 'gameStateUpdate':
          case 'nextRound':
          case 'roundComplete': // roundComplete も gameState 全体を含む可能性があるならここに含める
          case 'gameEnd': // gameEnd も gameState 全体を含む可能性があるならここに含める
          case 'skipRequested': // skipRequested も gameState 全体を含む可能性があるならここに含める
             // ▼▼▼ setGameState 直前のログ ▼▼▼
             console.log(`[WebSocket Hook] Calling setGameState for type "${message.type}" with payload:`, message.payload);
             // ペイロードが null や undefined でないことを確認 (任意)
             if (message.payload) {
               setGameState(message.payload);
             } else {
               console.warn(`[WebSocket Hook] Received null or undefined payload for type "${message.type}"`);
             }
             break;
          case 'gameStart': // gameStart を分離してログ追加
             console.log(`[WebSocket Hook] Received gameStart. Calling setGameState with payload (status should be here):`, message.payload?.status, message.payload);
              // ペイロードが null や undefined でないことを確認 (任意)
             if (message.payload) {
                setGameState(message.payload);
             } else {
                console.warn(`[WebSocket Hook] Received null or undefined payload for type "gameStart"`);
             }
             break;
          case 'error': // バックエンドからのエラーメッセージ処理
             console.error('[WebSocket Hook] Received error from server:', message.payload);
             // 必要に応じてユーザーに通知
             alert(`サーバーエラー: ${message.payload}`);
             // エラーによっては前の画面に戻るなどの処理を追加
             // navigate('/');
             break;
          default:
            console.warn(`[WebSocket Hook] Unknown message type: ${message.type}`);
            break;
        }
      } catch (error) { // JSON パースエラーなどをキャッチ
        console.error('[WebSocket Hook] Error processing message:', error, 'Raw data:', event.data);
      }
    };

    ws.onclose = (event) => { // close イベントの詳細もログに出力
        console.log(`[WebSocket Hook] WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
        // 意図しない切断の場合に再接続処理などを追加することも可能
    };
    ws.onerror = (error) => {
        console.error('[WebSocket Hook] WebSocket error:', error);
        // エラー発生時のフォールバック処理 (例: エラーページへ遷移)
        // navigate('/error');
    };

    // クリーンアップ関数
    return () => {
      if (webSocketRef.current) {
        console.log('[WebSocket Hook] Closing WebSocket connection...'); // 切断ログ
        webSocketRef.current.close();
        webSocketRef.current = null; // 参照をクリア
      }
    };
    // roomId と playerId が変更されたら再接続する
  }, [roomId, playerId, navigate]); // navigate はエラー時の遷移で使うなら依存配列に入れる

  // メッセージ送信関数
  const sendMessage = (type: string, payload: object) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      console.log(`[WebSocket Hook] Sending message - Type: ${type}, Payload:`, payload); // 送信ログ
      webSocketRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.error('[WebSocket Hook] Cannot send message: WebSocket is not open. State:', webSocketRef.current?.readyState);
      // 送信失敗時のエラーハンドリング (例: 再試行、ユーザーへの通知)
    }
  };

  // gameState が更新されたことを確認するログ (デバッグ用)
  useEffect(() => {
    console.log("[WebSocket Hook] gameState updated:", gameState);
  }, [gameState]);

  return { gameState, sendMessage };
};