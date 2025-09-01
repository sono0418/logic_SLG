import React from 'react';

// コンポーネントの定義
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => {
  return (
    <button {...props}>
      {children}
    </button>
  );
};

// ここが重要！デフォルトエクスポートにする
export default Button;