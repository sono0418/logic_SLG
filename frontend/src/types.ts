// ゲーム選択画面で使われる、基本的なプレイヤー情報
export interface Player {
  id: string;
  playerOrder: number;
}

//ゲームプレイ中に使われる、担当ゲートの情報を持つプレイヤー情報
export interface GamePlayer {
  id: string;
  playerOrder: number;
  assignedGates: number[]; // このラウンドで担当するゲート番号の配列
}

// ゲーム選択画面（ルーム）の状態
export interface RoomState {
  roomId: string;
  players: Player[]; // ゲーム開始前なので、シンプルなPlayer型
  playerChoices: { [playerId:string]: 'tutorial' | 'timeAttack' | 'circuitPrediction' };
  hostId: string | null;
}

//ゲームプレイ画面の状態
export interface GameState {
  players: GamePlayer[];
  teamScore: number;
  isGameFinished: boolean;
  roundCount: number;
  currentQuestion: Question | null; // ★ Question型を使用
  playerInputs: (boolean | null)[];
}

export interface Question {
  circuit: string[];
  expectedOutput: boolean | { C: boolean; S: boolean; };
  isTutorial?: boolean;
}
