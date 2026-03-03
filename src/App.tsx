import React, { useState, useRef, useEffect } from "react";
import {
  SpaceshipViewer,
  SpaceshipViewerRef,
} from "./components/SpaceshipViewer";
import { Game } from "./components/Game";
import { GameScene } from "./components/GameScene";
import { HUD } from "./components/HUD";
import { globalGameManager } from "./core/GameManager";
import { generateSpaceship, Part } from "./utils/spaceshipGenerator";
import { getShipStats } from "./utils/shipStats";
import {
  Download,
  RefreshCw,
  Box,
  Settings2,
  Code,
  Rocket,
  Hash,
  User,
  Swords,
  Target
} from "lucide-react";

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [mode, setMode] = useState<"hangar" | "training" | "multiplayer">("hangar");
  const [seed, setSeed] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [stats, setStats] = useState<any>(null);
  const viewerRef = useRef<SpaceshipViewerRef>(null);

  useEffect(() => {
    handleGenerate();
    globalGameManager.init();
    return () => {
      globalGameManager.loop.stop();
    };
  }, []);

  const handleGenerate = () => {
    const newSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
    setSeed(newSeed);
    setParts(generateSpaceship(newSeed));
    setStats(getShipStats(newSeed));
  };

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSeed = e.target.value.toUpperCase();
    setSeed(newSeed);
    if (newSeed) {
      setParts(generateSpaceship(newSeed));
      setStats(getShipStats(newSeed));
    }
  };

  const handleExport = () => {
    if (viewerRef.current) {
      viewerRef.current.exportGLTF();
    }
  };

  const startTraining = () => {
    setMode("training");
  };

  if (mode === "multiplayer" || mode === "training") {
    return <Game initialSeed={seed} playerName={playerName} onExit={() => setMode("hangar")} mode={mode} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-md z-10 absolute top-0 left-0 right-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <Box className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AeroForge 3D</h1>
        </div>
      </header>

      {/* Main 3D Viewer Area */}
      <main className="flex-1 relative">
        <SpaceshipViewer ref={viewerRef} parts={parts} />

        {/* Controls Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-[600px] max-w-full">
          <div className="flex w-full gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" /> Pilot Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter name..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 transition-colors"
                maxLength={16}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3 h-3" /> Ship Seed
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seed}
                  onChange={handleSeedChange}
                  placeholder="Enter seed..."
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 transition-colors uppercase"
                  maxLength={12}
                />
                <button
                  onClick={handleGenerate}
                  className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                  title="Random Seed"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-white/10"></div>

          <div className="flex items-center gap-4 w-full justify-between">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export GLTF</span>
            </button>

            <div className="flex gap-2 flex-1">
              <button
                onClick={startTraining}
                disabled={!seed}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-xl transition-all font-bold shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] disabled:shadow-none"
              >
                <Target className="w-5 h-5" />
                <span>TRAINING</span>
              </button>

              <button
                onClick={() => setMode("multiplayer")}
                disabled={!seed}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-xl transition-all font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] disabled:shadow-none"
              >
                <Swords className="w-5 h-5" />
                <span>MULTIPLAYER</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats / Info Overlay */}
        <div className="absolute top-24 left-6 p-4 bg-black/40 backdrop-blur-md border border-white/5 rounded-xl text-xs font-mono text-gray-400 flex flex-col gap-2 pointer-events-none w-64">
          <div className="flex items-center gap-2 text-white">
            <Settings2 className="w-4 h-4" />
            <span className="font-semibold">Ship Characteristics</span>
          </div>
          <div className="w-full h-px bg-white/10 my-1"></div>
          {stats && (
            <>
              <div className="flex justify-between gap-4">
                <span>Hull Strength:</span>
                <span className={stats.maxHealth > 100 ? "text-emerald-400" : "text-yellow-400"}>
                  {stats.maxHealth}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Top Speed:</span>
                <span className={stats.speedMultiplier > 1 ? "text-emerald-400" : "text-yellow-400"}>
                  {(stats.speedMultiplier * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Agility:</span>
                <span className={stats.turnSpeedMultiplier > 1 ? "text-emerald-400" : "text-yellow-400"}>
                  {(stats.turnSpeedMultiplier * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Firepower:</span>
                <span className={stats.damageMultiplier > 1 ? "text-emerald-400" : "text-yellow-400"}>
                  {(stats.damageMultiplier * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Fire Rate:</span>
                <span className={stats.fireRateMultiplier > 1 ? "text-emerald-400" : "text-yellow-400"}>
                  {(stats.fireRateMultiplier * 100).toFixed(0)}%
                </span>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
