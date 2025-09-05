// src/tutorial.ts
import { WebSocket } from "ws";
import { GameState } from './realtime'; // realtime.tsからGameStateインターフェースをインポート

export const tutorialCircuits = [
  { circuit: ['AND', 'NOT'], expectedOutput: false, isTutorial: true },
  { circuit: ['OR', 'AND'], expectedOutput: true, isTutorial: true },
  { circuit: ['OR', 'NOT', 'AND'], expectedOutput: false, isTutorial: true }
];

/**
 * チュートリアルモードのゲームロジックを処理します。
 *
 * @param room - 現在のゲームルームの状態
 * @param isCorrect - プレイヤーの入力が正しいか
 * @param roomId - ルームID
 * @returns チュートリアルが終了した場合はtrue、継続する場合はfalse
 */
export function handleTutorialLogic(room: GameState, isCorrect: boolean, roomId: string): boolean {
  if (isCorrect) {
    room.teamScore += 10;
  }
  
  room.roundCount++;

  if (room.roundCount < tutorialCircuits.length) {
    room.currentQuestion = tutorialCircuits[room.roundCount];
    room.currentPlayerIndex = 0;
    room.currentPlayerId = room.players[0].playerId;
    room.playerInputs = new Array(room.players.length).fill(null);

    room.players.forEach(p => {
      p.ws.send(JSON.stringify({
        type: 'nextRound',
        payload: {
          roundCount: room.roundCount,
          currentQuestion: room.currentQuestion,
          updatedTeamScore: room.teamScore,
        }
      }));
    });
    return false; // チュートリアル継続
  } else {
    room.status = 'ended';
    room.players.forEach(p => {
      p.ws.send(JSON.stringify({
        type: 'gameEnd',
        payload: { message: 'Tutorial complete!', finalTeamScore: room.teamScore }
      }));
    });
    return true; // チュートリアル終了
  }
}