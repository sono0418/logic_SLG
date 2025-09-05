import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TitleScreen from './components/TitleScreen';
import PopUpA from './components/Popups/PopUpA';
import PopUpB from './components/Popups/PopUpB';
import PopUpC from './components/Popups/PopUpC';
import GamePage from './components/GamePage';
import TutorialPage from './components/TutorialPage';

// ポップアップの種類を定義する
type PopUpType = 'none' | 'A' | 'B' | 'C';

const App: React.FC = () => {
// 状態の管理: 現在表示されているポップアップの種類
  const [currentPopUp, setCurrentPopUp] = useState<PopUpType>('none');

  // ポップアップを閉じるための関数
  const handleClosePopUp = () => {
    setCurrentPopUp('none');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div>
            <TitleScreen onOpenPopUp={setCurrentPopUp} />
            {currentPopUp === 'A' && <PopUpA onClose={handleClosePopUp} />}
            {currentPopUp === 'B' && <PopUpB onClose={handleClosePopUp} />}
            {currentPopUp === 'C' && <PopUpC onClose={handleClosePopUp} />}
          </div>
        } />

        {/* ゲーム選択画面へのルート */}
        <Route path="/game/:roomId" element={<GamePage />} />
        {/*チュートリアルページへのルート*/}
        <Route path="/play/tutorial/:roomId" element={<TutorialPage />} />
      </Routes>
    </Router> 
  );
};

export default App;