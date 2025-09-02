import React, { useEffect, useRef, useState } from 'react';

// APIからのレスポンスの型を定義
interface JoinRoomResponse {
  playerId: string;
}

const GameComponent = () => {
  const ws = useRef<WebSocket | null>(null);
  const [message, setMessage] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

useEffect(() => {
    // API呼び出しとWebSocket接続を一つの非同期関数にまとめる
    const setupGame = async () => {
      // 1. HTTP APIでルームに参加し、playerIdを取得
      // ユーザーが入力した、またはAPIで生成されたルームIDを使用する
      const apiRoomId = 'gameRoom123'; 
      try {
        const response = await fetch(`https://logic-slg.onrender.com/api/rooms/${apiRoomId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key: 'value' }),
        });
        // HTTPリクエストが失敗した場合のエラーハンドリング
        if (!response.ok) {
          throw new Error('Failed to join room via API');
        }

        const data: JoinRoomResponse = await response.json();
        const apiPlayerId = data.playerId;

        setRoomId(apiRoomId);
        setPlayerId(apiPlayerId);
// 2. IDを取得したらWebSocket接続を確立
        ws.current = new WebSocket('wss://logic-slg.onrender.com');

        ws.current.onopen = () => {
          console.log('WebSocket接続が確立されました。');
          // 3. 接続確立後、joinRoomメッセージを送信
          ws.current?.send(JSON.stringify({ 
            type: 'joinRoom', // バックエンドの型に合わせる
            payload: { 
              roomId: apiRoomId, 
              playerId: apiPlayerId 
            } 
          }));
        };

        ws.current.onmessage = (event) => {
          const receivedData = JSON.parse(event.data);
          console.log('サーバーからメッセージを受信:', receivedData);
          setMessage(receivedData.message);
          // 受信したデータに応じてゲームの状態を更新
        };

        ws.current.onclose = () => {
          console.log('WebSocket接続が閉じられました。');
        };

        ws.current.onerror = (error) => {
          console.error('WebSocketエラー:', error);
        };
      } catch (error) {
        console.error('APIまたはWebSocketのセットアップに失敗しました:', error);
      }
    };
    setupGame();
    // コンポーネントがアンマウントされるときに接続をクリーンアップ
    return () => {
      ws.current?.close();
    };
  }, []);

  const sendMessage = (inputValue: boolean) => {
    // ルームIDとプレイヤーIDが設定されていることを確認してから送信
    if (ws.current?.readyState === WebSocket.OPEN && roomId && playerId) {
      ws.current.send(JSON.stringify({ 
        type: 'playerInput', // バックエンドの型に合わせる
        payload: { 
          roomId: roomId,
          playerId: playerId,
          inputValue: inputValue 
        } 
      }));
    }
  };


    return (
        <div>
            <p>サーバーからのメッセージ: {message}</p>
            <button onClick={() => sendMessage(true)}>Tを出力</button>
            <button onClick={() => sendMessage(false)}>Fを出力</button>
        </div>
    );

};

export default GameComponent;