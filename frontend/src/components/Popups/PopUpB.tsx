// src/components/Popups/PopUpB.tsx
import React, { useState } from 'react';

// 親から渡されるPropsの型を定義
interface PopUpProps {
  onClose: () => void;
}

// 説明コンテンツ
const notePages: string[] = [
  "これは1ページ目の説明です。",
  "これは2ページ目の説明です。",
  "これは3ページ目の説明です。"
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
        <h2>ノート</h2>
        <p>{notePages[currentPage]}</p>

        <div>
          <button onClick={handlePrevPage} disabled={currentPage === 0}>
            左へ
          </button>
          <span> {currentPage + 1} / {notePages.length} </span>
          <button onClick={handleNextPage} disabled={currentPage === notePages.length - 1}>
            右へ
          </button>
        </div>
        
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
};

export default PopUpB;