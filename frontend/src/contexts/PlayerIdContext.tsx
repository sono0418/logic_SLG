import React, { createContext, useState, useEffect } from 'react';
import type {ReactNode} from 'react';

export const PlayerIdContext = createContext<string | null>(null);

interface PlayerIdProviderProps {
  children: ReactNode;
}

export const PlayerIdProvider: React.FC<PlayerIdProviderProps> = ({ children }) => {
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    let storedPlayerId = localStorage.getItem('myPlayerId');
    if (!storedPlayerId) {
      storedPlayerId = `player-${crypto.randomUUID()}`; // "player-" プレフィックスを追加
      localStorage.setItem('myPlayerId', storedPlayerId);
    }
    setPlayerId(storedPlayerId);
  }, []);

  return (
    <PlayerIdContext.Provider value={playerId}>
      {children}
    </PlayerIdContext.Provider>
  );
};
