import React, { useState, useRef, useEffect } from "react";
import {
  SpaceshipViewer,
  SpaceshipViewerRef,
} from "./components/SpaceshipViewer";
import { Game } from "./components/Game";
import { generateSpaceship, Part } from "./utils/spaceshipGenerator";
import {
  Download,
  RefreshCw,
  Box,
  Settings2,
  Code,
  Rocket,
} from "lucide-react";

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [mode, setMode] = useState<"hangar" | "game">("hangar");
  const viewerRef = useRef<SpaceshipViewerRef>(null);

  useEffect(() => {
    handleGenerate();
  }, []);

  const handleGenerate = () => {
    setParts(generateSpaceship());
  };

  const handleExport = () => {
    if (viewerRef.current) {
      viewerRef.current.exportGLTF();
    }
  };

  if (mode === "game") {
    return <Game parts={parts} onExit={() => setMode("hangar")} />;
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode("game")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors font-medium border border-emerald-500/30"
          >
            <Rocket className="w-4 h-4" />
            <span>Launch Game</span>
          </button>
        </div>
      </header>

      {/* Main 3D Viewer Area */}
      <main className="flex-1 relative">
        <SpaceshipViewer ref={viewerRef} parts={parts} />

        {/* Controls Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-medium"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Generate New</span>
          </button>

          <div className="w-px h-8 bg-white/10"></div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-medium"
          >
            <Download className="w-5 h-5" />
            <span>Export GLTF</span>
          </button>

          <div className="w-px h-8 bg-white/10"></div>

          <button
            onClick={() => setMode("game")}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl transition-all font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
          >
            <Rocket className="w-5 h-5" />
            <span>PLAY</span>
          </button>
        </div>

        {/* Stats / Info Overlay */}
        <div className="absolute top-24 left-6 p-4 bg-black/40 backdrop-blur-md border border-white/5 rounded-xl text-xs font-mono text-gray-400 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-2 text-white">
            <Settings2 className="w-4 h-4" />
            <span className="font-semibold">Ship Stats</span>
          </div>
          <div className="w-full h-px bg-white/10 my-1"></div>
          <div className="flex justify-between gap-8">
            <span>Parts:</span>
            <span className="text-emerald-400">{parts.length}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span>Format:</span>
            <span className="text-emerald-400">GLTF 2.0</span>
          </div>
          <div className="flex justify-between gap-8">
            <span>Ready for:</span>
            <span className="text-emerald-400">Game Engines</span>
          </div>
        </div>
      </main>
    </div>
  );
}
