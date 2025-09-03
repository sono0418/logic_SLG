// backend/src/db/index.ts
import pg, { PoolClient } from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// 接続テストとログ出力
// ライブラリが期待する型に合わせて引数を修正
pool.connect((err: Error | undefined, client: PoolClient | undefined, done: (release?: any) => void) => {
    if (err) {
        console.error('データベースへの接続中にエラーが発生しました:', err.stack);
    } else {
        console.log('データベースに正常に接続しました ');
    }
    
    // 成功・失敗にかかわらず、クライアントは必ずプールに返却します
    // これをしないと接続がプールに戻らず、いずれ接続できなくなります
    if (done) {
        done();
    }
});

export default pool;