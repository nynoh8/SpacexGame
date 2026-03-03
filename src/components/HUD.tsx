import React, { useEffect, useState } from 'react';
import { globalEventBus } from '../core/events/EventBus';
import { globalGameManager } from '../core/GameManager';

export const HUD: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [health, setHealth] = useState(100);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    const showHUD = () => setIsVisible(true);
    const hideHUD = () => setIsVisible(false);
    
    // Check initial state
    if (globalGameManager.stateMachine.getCurrentState() === "Playing") {
      setIsVisible(true);
    }
    
    // Listen for UI events
    globalEventBus.subscribe("UI_SHOW_HUD", showHUD);
    globalEventBus.subscribe("UI_HIDE_HUD", hideHUD);

    // Listen for player updates (we'll emit this from the movement system later)
    const updateStats = (data: { health: number, speed: number }) => {
      setHealth(data.health);
      setSpeed(data.speed);
    };
    globalEventBus.subscribe("PLAYER_STATS_UPDATED", updateStats);

    return () => {
      globalEventBus.unsubscribe("UI_SHOW_HUD", showHUD);
      globalEventBus.unsubscribe("UI_HIDE_HUD", hideHUD);
      globalEventBus.unsubscribe("PLAYER_STATS_UPDATED", updateStats);
    };
  }, []);

  if (!isVisible) return null;

  const handleQuit = () => {
    globalGameManager.stateMachine.changeState("MainMenu");
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-8">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="bg-black/50 p-4 rounded-lg border border-white/20 backdrop-blur-sm">
          <div className="text-white font-mono text-sm opacity-70 uppercase">Hull Integrity</div>
          <div className="w-48 h-4 bg-red-900/50 rounded-full mt-2 overflow-hidden border border-red-500/30">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-300" 
              style={{ width: `${health}%` }}
            />
          </div>
          <div className="text-white font-mono text-xl mt-1">{health}%</div>
        </div>
        
        <button 
          onClick={handleQuit}
          className="pointer-events-auto px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded uppercase text-sm tracking-wider transition-colors backdrop-blur-sm"
        >
          Abort Mission
        </button>
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end">
        <div className="bg-black/50 p-4 rounded-lg border border-white/20 backdrop-blur-sm flex flex-col items-center min-w-[120px]">
          <div className="text-white font-mono text-xs opacity-70 uppercase tracking-widest">Velocity</div>
          <div className="text-white font-mono text-3xl font-bold text-blue-400">{speed.toFixed(0)}</div>
          <div className="text-white font-mono text-[10px] opacity-50 uppercase">m/s</div>
        </div>
        
        {/* Crosshair (Center) - We can position it absolutely or keep it here */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-50">
          <div className="w-8 h-8 border-2 border-green-400 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
