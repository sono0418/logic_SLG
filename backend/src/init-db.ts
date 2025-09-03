import pool from './db/index';

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS "Ranking" (
    "Rank" SERIAL PRIMARY KEY,
    "Team_name" VARCHAR(15) NOT NULL,
    "score" INT NOT NULL
  );
`;

const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('データベースの初期化を開始します...');
    await client.query(createTableQuery);
    console.log('テーブル "Ranking" が正常に作成または確認されました。');
    
    // もし初期データを入れたい場合は、ここに追加します
    // 例: await client.query('INSERT INTO "Ranking" ("Team_name", "score") VALUES ($1, $2)', ['Team A', 100]);
    
    client.release();
    console.log('データベースの初期化が完了しました。');
  } catch (err) {
    console.error('データベースの初期化中にエラーが発生しました:', err);
    // エラーが発生した場合、プロセスを終了してデプロイを失敗させる
    process.exit(1);
  }
};

initializeDatabase();