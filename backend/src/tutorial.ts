// src/tutorial.ts
//チュートリアル用の問題をエクスポートする
import { halfAdderProblems } from './problems';

// tutorialCircuitsは、problems.tsからフィルタリングされたチュートリアル問題のリスト
export const tutorialCircuits = halfAdderProblems.filter(problem => problem.isTutorial);

