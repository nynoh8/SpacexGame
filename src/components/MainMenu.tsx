import React, { useEffect, useState } from 'react';
import { globalEventBus } from '../core/events/EventBus';
import { globalGameManager } from '../core/GameManager';

export const MainMenu: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const showMenu = () => setIsVisible(true);
    const hideMenu = () => setIsVisible(false);

    globalEventBus.subscribe("UI_SHOW_MAIN_MENU", showMenu);
    globalEventBus.subscribe("UI_HIDE_MAIN_MENU", hideMenu);

    return () => {
      globalEventBus.unsubscribe("UI_SHOW_MAIN_MENU", showMenu);
      globalEventBus.unsubscribe("UI_HIDE_MAIN_MENU", hideMenu);
    };
  }, []);

  if (!isVisible) return null;

  const handleTraining = () => {
    console.log("Starting Training Mode...");
    globalGameManager.stateMachine.changeState("Playing");
  };

  const handleMultiplayer = () => {
    console.log("Starting Multiplayer Mode...");
    // For now, just go to playing state. Later we will add networking logic.
    globalGameManager.stateMachine.changeState("Playing");
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
      <h1 className="text-6xl font-bold text-white mb-12 tracking-widest uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
        Space Vanguard
      </h1>
      
      <div className="flex flex-col gap-6 w-80">
        <button 
          onClick={handleTraining}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg uppercase tracking-wider transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
        >
          Training Mode (Offline)
        </button>
        
        <button 
          onClick={handleMultiplayer}
          className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg uppercase tracking-wider transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(147,51,234,0.5)]"
        >
          Multiplayer (Online)
        </button>
      </div>
    </div>
  );
};
