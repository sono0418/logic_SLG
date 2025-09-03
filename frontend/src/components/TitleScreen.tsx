//frontend/src/components/TitleScreen.tsx
import React from "react";
import Button from './UI/Button';
import './TitleScreen.css'; 

//Popsの型を定義
interface TitleScreenPops{
  onOpenPopUp: (popUpType: 'A' | 'B' | 'C') => void;
}

const TitleScreen: React.FC<TitleScreenPops> = ({ onOpenPopUp}) => {
  return (
    <div className="title-screen">
      <h1>論理回路の<br></br>ゲーム</h1>
      <div className="button">
        <Button onClick={() => onOpenPopUp('A')}>はじめる</Button>
        <div className="small-button">
          <Button onClick={() => onOpenPopUp('B')}>ノート</Button>
          <Button onClick={() => onOpenPopUp('C')}>ランキング</Button>
        </div>
      </div>
    </div>
  );
};

export default TitleScreen;