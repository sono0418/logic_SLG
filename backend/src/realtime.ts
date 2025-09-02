// /logic_SLG/backend/src/realtime.ts

import { WebSocket, WebSocketServer } from 'ws';

// ゲームの状態を管理するインターフェース
interface GameState {
  roomId: string;
  players: { playerId: string, ws: WebSocket, score: number }[];
  currentQuestion: {
    circuit: string[]; // 論理回路の構成 (例: ['AND', 'OR', 'NOT'])
    expectedOutput: boolean; // 最終的な正解
  };
  currentPlayerIndex: number; // 現在のプレイヤーのインデックス
  playerInputs: (boolean | null)[]; // プレイヤーの入力履歴
}

// 複数のゲームルームを管理するマップ
const gameRooms = new Map<string, GameState>();

/**
 * WebSocketサーバーを初期化し、イベントハンドラーを設定する関数
 * @param wss WebSocketサーバーのインスタンス
 */
export const setupWebSocketServer = (wss: WebSocketServer) => {
  wss.on('connection', ws => {
    console.log('クライアントが接続しました。');
    ws.send(JSON.stringify({ type: 'welcome', payload: 'Welcome to the game!' }));

    ws.on('message', message => {
      try {
        const data = JSON.parse(message.toString());

        // ルーム参加を処理
        if (data.type === 'joinRoom') {
          const { roomId, playerId } = data.payload;
          let room = gameRooms.get(roomId);

          if (!room) {
            // ルームが存在しない場合、新しいルームを作成
            const newRoom: GameState = {
              roomId: roomId,
              players: [],
              currentQuestion: {
                circuit: [],
                expectedOutput: false
              },
              currentPlayerIndex: 0,
              playerInputs: []
            };
            gameRooms.set(roomId, newRoom);
            room = newRoom;
          }

          // プレイヤーをルームに追加
          room.players.push({ playerId, ws, score: 0 });
          console.log(`Player ${playerId} joined room ${roomId}`);

          // プレイヤーに参加成功を通知
          ws.send(JSON.stringify({ type: 'joinSuccess', payload: { roomId, playerId } }));

          // ルームの全プレイヤーに更新情報をブロードキャスト
          room.players.forEach(p => {
            if (p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({ type: 'roomUpdate', payload: room }));
            }
          });

        // プレイヤーの入力を処理
        } else if (data.type === 'playerInput') {
          const { roomId, playerId, inputValue } = data.payload;
          const room = gameRooms.get(roomId);

          if (!room) return;

          // ... (元のコードの論理回路の計算とターンの進行ロジック) ...

          // ターンを進める
          room.currentPlayerIndex++;
          // ... (次のプレイヤーへのメッセージ送信またはゲーム終了判定ロジック) ...
        }
      } catch (error) {
        console.error('メッセージのパースまたは処理中にエラーが発生しました:', error);
      }
    });

    ws.on('close', () => {
      console.log('クライアントが切断しました。');
      // プレイヤーが退室した際の処理（例：ゲームルームからプレイヤーを削除）
    });

    ws.on('error', error => {
      console.error('WebSocketエラー:', error);
    });
  });
};