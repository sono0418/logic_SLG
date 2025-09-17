// src/tutorial.ts
//チュートリアル用の問題をエクスポートする
import { tutorialProblems } from './problems';

// tutorialCircuitsは、problems.tsからフィルタリングされたチュートリアル問題のリスト
export const tutorialCircuits = tutorialProblems.filter(problem => problem.isTutorial);

