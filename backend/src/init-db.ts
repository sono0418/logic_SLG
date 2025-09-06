import dotenv from 'dotenv';
dotenv.config();

import pool from './db/index';

/*何かで間違えてDBリセットしたくなった時に使う
const dropTableQuery = `
  DROP TABLE IF EXISTS "Ranking";
`;
//...
await client.query(dropTableQuery);

テストデータを追加したくなった時に使う
const insertInitialDataQuery = `
  INSERT INTO "Ranking" ("Team_name", "score") VALUES
  ('デプロイ用１', 1),
  ('デプロイ用２', 2);
`;
//...
await client.query(insertInitialDataQuery);
   */
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS "Ranking" (
    "ID" SERIAL PRIMARY KEY,
    "Team_name" VARCHAR(15) NOT NULL,
    "score" INT NOT NULL
  );
`;

const initializeDatabase = async () => {
  // clientをtryの外で宣言し、finallyで確実に解放できるようにする
  const client = await pool.connect();
  try {
    console.log('データベースの初期化を開始します...');
    await client.query(createTableQuery);
    console.log('テーブル "Ranking" が正常に作成または確認されました。');
    
    // ✨ 修正点: 'rows'という変数はこのファイルに存在しないため、この行を削除しました。
    // データの取得確認は、APIエンドポイント側で行います。
    
    console.log('データベースの初期化が完了しました。');
  } catch (err) {
    console.error('データベースの初期化中にエラーが発生しました:', err);
    // エラーが発生した場合、プロセスを終了してデプロイを失敗させる
    process.exit(1);
  } finally {
    // 接続をプールに返す
    client.release();
  }
};

// データベース初期化を実行
initializeDatabase();
