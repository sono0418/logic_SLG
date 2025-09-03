import pool from './db/index';
const dropTableQuery = `
  DROP TABLE IF EXISTS "Ranking";
`;
/*
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS "Ranking" (
    "ID" SERIAL PRIMARY KEY,
    "Team_name" VARCHAR(15) NOT NULL,
    "score" INT NOT NULL
  );
`;
*/
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
  //  console.log('データベースの初期化を開始します...');
  //  await client.query(createTableQuery);
  //  console.log('テーブル "Ranking" が正常に作成または確認されました。');
    
    await client.query(dropTableQuery);
    client.release();
    console.log('データベースの初期化が完了しました。');
  } catch (err) {
    console.error('データベースの初期化中にエラーが発生しました:', err);
    // エラーが発生した場合、プロセスを終了してデプロイを失敗させる
    process.exit(1);
  }
};

initializeDatabase();