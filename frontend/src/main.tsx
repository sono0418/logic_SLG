import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { PlayerIdProvider } from './contexts/PlayerIdContext'; // ✨ インポート

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlayerIdProvider>
      <App />
    </PlayerIdProvider>
  </React.StrictMode>,
);
