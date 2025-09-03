// backend/src/db/index.ts
import pg, { PoolClient } from 'pg';

const pool = new pg.Pool({
    // 環境変数からデータベースの接続URLを読み込む
    connectionString: process.env.DATABASE_URL, 
    // Render上のPostgreSQLはSSL接続が必須
    ssl: {
        rejectUnauthorized: false,
    },
});

// 接続テストとログ出力
pool.connect((err: Error, client: PoolClient, release: () => void) => {
    if (err) {
        return console.error('データベースへの接続中にエラーが発生しました:', err.stack);
    }
    console.log('データベースに正常に接続しました 🎉');
    release(); 
});

export default pool;