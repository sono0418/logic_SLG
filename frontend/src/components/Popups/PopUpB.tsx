// src/components/Popups/PopUpB.tsx
import React, { useState } from 'react';

// 親から渡されるPropsの型を定義
interface PopUpProps {
  onClose: () => void;
}

// 説明コンテンツ
const notePages: string[] = [
  "推奨環境：Google Chrome",
  "ANDゲートについて<br />2つの入力が共にT（真）の場合、出力がT（真）になります。共にF（偽）の場合や片方にF（偽）が含まれる場合、出力はF（偽）になります。",
  "ORゲートについて<br />2つの入力が異なる場合、出力がT（真）になります。共にT（真）、共にF（偽）の場合、出力はF（偽）になります。",
  "NOTゲートについて<br />1つの入力について、T（真）ならばF（偽）、F（偽）ならばT（真）を出力します。"
];

const PopUpB: React.FC<PopUpProps> = ({ onClose }) => {
  // 現在のページ番号を管理
  const [currentPage, setCurrentPage] = useState<number>(0);

  // 次のページへ進む関数
  const handleNextPage = () => {
    // ページ番号が最大値を超えないように制御
    setCurrentPage(prevPage => Math.min(prevPage + 1, notePages.length - 1));
  };

  // 前のページへ戻る関数
  const handlePrevPage = () => {
    // ページ番号が0未満にならないように制御
    setCurrentPage(prevPage => Math.max(prevPage - 1, 0));
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>ノート</h2>
        <p>{notePages[currentPage]}</p>

        <div>
          <button className='redbutton' onClick={handlePrevPage} disabled={currentPage === 0}>
            左へ
          </button>
          <span> {currentPage + 1} / {notePages.length} </span>
          <button className='bluebutton' onClick={handleNextPage} disabled={currentPage === notePages.length - 1}>
            右へ
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopUpB;