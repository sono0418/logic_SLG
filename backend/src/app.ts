 // backend/src/app.ts
    import express from 'express';
    import rankingRouter from './routes/ranking';
    
    const app = express();
    // 他のミドルウェア...
    
    app.use('/api', rankingRouter); // /api/ranking というエンドポイントが作成されます
    
    app.listen(3001, () => {
      console.log('Server is running on port 3001');
    });