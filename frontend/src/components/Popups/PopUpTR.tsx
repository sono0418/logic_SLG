import React from 'react';

// 親から渡されるPropsの型を定義
interface ResultPopupProps {
  score: number;
  onClose: () => void;
}

const ResultPopup: React.FC<ResultPopupProps> = ({ score, onClose }) => (
  <div className="popup-overlay">
    <div className="popup-content">
      <h2>リザルト</h2>
      <p>最終チームスコア: {score}点</p>
      <button onClick={onClose}>ゲーム選択に戻る</button>
    </div>
  </div>
);

export default ResultPopup;
