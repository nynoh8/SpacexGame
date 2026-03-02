import React, { useState, useEffect } from "react";
import { Rocket, Trophy } from "lucide-react";
import { playerState } from "../game/state";
import { touchState } from "./MobileControls";

export function MissileCooldownUI() {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - playerState.lastMissileTime;
      const p = Math.min(100, (elapsed / 10000) * 100);
      setProgress(p);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto">
      <p className="text-sm text-gray-300 mb-2">Missile (F/B/MSL)</p>
      <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden border border-white/10">
        <div
          className={`h-full transition-all duration-100 ${progress === 100 ? "bg-orange-500" : "bg-gray-600"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {progress === 100 && (
        <p className="text-[10px] text-orange-400 mt-1 animate-pulse font-bold">
          READY TO FIRE
        </p>
      )}
    </div>
  );
}

export function GameUI({
  showUI,
  setShowUI,
  playersCount,
  health,
  isDead,
  leaderboard,
  socketId,
  onExit,
  matchTime,
  matchResults
}: {
  showUI: boolean;
  setShowUI: (v: boolean) => void;
  playersCount: number;
  health: number;
  isDead: boolean;
  leaderboard: any[];
  socketId: string | undefined;
  onExit: () => void;
  matchTime: number;
  matchResults: any[] | null;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-6 left-6 text-white font-mono pointer-events-none">
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-6 h-6 text-emerald-400" />
        <h2 className="text-xl font-bold tracking-tight">
          Space Explorer (Multiplayer)
        </h2>
      </div>

      <div className="mb-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-emerald-500/50 inline-flex items-center gap-3">
        <div className="text-emerald-400 text-lg font-bold">MATCH TIME</div>
        <div className={`text-2xl font-bold ${matchTime < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          {formatTime(matchTime)}
        </div>
      </div>

      {showUI && (
        <>
          <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col gap-2">
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-bold">W/S</span> : Pitch
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-bold">A/D</span> : Yaw (Turn)
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-bold">Q/E</span> : Roll
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-bold">SHIFT</span> : Acelerar
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-bold">CTRL</span> : Brake
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-bold">SPACE</span> : Shoot
            </p>
          </div>
          <div className="mt-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10">
            <p className="text-sm text-gray-300">
              Players Online:{" "}
              <span className="text-emerald-400 font-bold">
                {playersCount}
              </span>
            </p>
          </div>
        </>
      )}

      <button
        onClick={() => setShowUI(!showUI)}
        className="pointer-events-auto mt-4 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md transition-all text-xs border border-white/10"
      >
        {showUI ? "Minimize UI" : "Show UI"}
      </button>

      <div className="mt-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto">
        <p className="text-sm text-gray-300 mb-2">Hull Integrity</p>
        <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full transition-all duration-300 ${health > 50 ? 'bg-emerald-500' : health > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${health}%` }}
          />
        </div>
      </div>

      <MissileCooldownUI />

      {isDead && (
        <div className="mt-8 text-center text-red-500 font-bold text-2xl animate-pulse">
          SHIP DESTROYED - RESPAWNING...
        </div>
      )}

      {/* Leaderboard */}
      {showUI && (
        <div className="mt-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 w-64 pointer-events-auto font-mono">
          <div className="flex items-center gap-2 mb-3 text-emerald-400">
            <Trophy className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Top Pilots</h3>
          </div>
          <div className="flex flex-col gap-2">
            {leaderboard.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-bold w-4">{index + 1}.</span>
                  <span className={player.id === socketId ? "text-emerald-400 font-bold" : "text-gray-300"}>
                    {player.name}
                  </span>
                </div>
                <span className="text-emerald-400 font-mono">{player.shipsOwned} {player.shipsOwned === 1 ? 'ship' : 'ships'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onExit}
        className="fixed bottom-6 left-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all font-medium border border-white/10 pointer-events-auto"
      >
        Sair
      </button>

      {matchResults && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center pointer-events-auto">
          <div className="bg-zinc-900 border border-emerald-500/30 p-8 rounded-3xl max-w-2xl w-full shadow-2xl shadow-emerald-500/10">
            <div className="text-center mb-8">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Match Summary</h2>
              <p className="text-emerald-400 font-mono">Next match starting soon...</p>
            </div>

            <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2">
              {matchResults.map((res, idx) => (
                <div 
                  key={res.id} 
                  className={`flex items-center justify-between p-4 rounded-xl border ${res.id === socketId ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/5 border-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-white/20 w-8">#{idx + 1}</span>
                    <div>
                      <div className={`font-bold ${res.id === socketId ? 'text-emerald-400' : 'text-white'}`}>{res.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-mono">{res.shipsOwned} Ships Owned</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{res.kills}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-mono">Kills</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onExit}
              className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
