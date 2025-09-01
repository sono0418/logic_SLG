import React, { useState, useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TitleScreen from './components/TitleScreen';
import PopUpA from './components/Popups/PopUpA';
import PopUpB from './components/Popups/PopUpB';
import PopUpC from './components/Popups/PopUpC';
import GamePage from './components/GamePage';

// ポップアップの種類を定義する
type PopUpType = 'none' | 'A' | 'B' | 'C';

const App: React.FC = () => {
  // 状態の管理: 現在表示されているポップアップの種類
  const [currentPopUp, setCurrentPopUp] = useState<PopUpType>('none');
  const [backendMessage, setBackendMessage] = useState('');

  // ③ バックエンドからデータを取得するためのuseEffectを追加
  useEffect(() => {
    fetch('https://logic-slg.onrender.com/')
      .then(response => response.text())
      .then(data => {
        setBackendMessage(data);
      })
      .catch(error => console.error('Error fetching data:', error));
  }, []); // 空の配列は、コンポーネントがマウントされた時に一度だけ実行されることを意味します

  // ポップアップを閉じるための関数
  const handleClosePopUp = () => {
    setCurrentPopUp('none');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div>
            <h1>{backendMessage}</h1>
            <TitleScreen onOpenPopUp={setCurrentPopUp} />

            {/* 条件付きレンダリング */}
            {currentPopUp === 'A' && <PopUpA onClose={handleClosePopUp} />}
            {currentPopUp === 'B' && <PopUpB onClose={handleClosePopUp} />}
            {currentPopUp === 'C' && <PopUpC onClose={handleClosePopUp} />}
          </div>
        } />
        <Route path="/game/:roomId" element={<GamePage />} />
      </Routes>
    </Router>
  );
};

export default App;