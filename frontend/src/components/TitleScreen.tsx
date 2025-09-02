import React from "react";
import Button from './UI/Button';

//Popsの型を定義
interface TitleScreenPops{
  onOpenPopUp: (popUpType: 'A' | 'B' | 'C') => void;
}

const TitleScreen: React.FC<TitleScreenPops> = ({ onOpenPopUp}) => {
  return (
    <div>
      <h1>論理回路のゲーム</h1>
      <Button onClick={() => onOpenPopUp('A')}>はじめる</Button>
      <Button onClick={() => onOpenPopUp('B')}>ノート</Button>
      <Button onClick={() => onOpenPopUp('C')}>ランキング</Button>
    </div>
  );
};

export default TitleScreen;