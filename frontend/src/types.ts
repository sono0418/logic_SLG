// src/types.ts

// プレイヤーの基本情報
export interface Player {
  id: string;          // プレイヤーID
  playerOrder: number; // 1P, 2P などの順番
}

// ゲーム選択画面（ルーム）の状態
export interface RoomState {
  roomId: string;
  players: Player[]; //ルーム内の全プレイヤーリスト
  //↓ 各プレイヤーの希望を記録するオブジェクト
  //↓例: { "player-1-id": "tutorial", "player-2-id": "timeAttack" }
  playerChoices: { [playerId: string]: 'tutorial' | 'timeAttack' | 'circuitPrediction' };
  hostId: string | null;     // 1P (ホスト) のプレイヤーID
}
// 問題のデータ構造
export interface Question {
  circuit: string[];      // 例: ["AND", "OR"]
  expectedOutput: boolean;
}

// ゲームプレイ画面の状態
export interface GameState {
  currentQuestion: Question | null;
  currentPlayerId: string | null;
  players: Player[];         // プレイヤーリスト（スコアは持たない）
  teamScore: number;         // チームのスコア
  roundCount: number; 
  lastInput?: boolean;      // 直前のプレイヤーの入力
  roundResult?: {           // ラウンド結果
    isCorrect: boolean;
    finalOutput: boolean;
    expectedOutput: boolean;
    updatedTeamScore: number; // 更新されたチームスコア
  };
  isGameFinished: boolean; // ゲームが終了したかどうか
}