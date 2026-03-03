import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Stars,
  KeyboardControls,
} from "@react-three/drei";
import { generateSpaceship, Part } from "../utils/spaceshipGenerator";
import { io, Socket } from "socket.io-client";
import { MobileControls } from "./MobileControls";
import { Player } from "./Player";
import { RemotePlayer, Explosion } from "./RemotePlayer";
import { BulletsManager } from "./BulletsManager";
import { SolarSystem } from "./SolarSystem";
import { Radar, RadarLogic } from "./Radar";
import { GameUI } from "./GameUI";


export function Game({ initialSeed, playerName, onExit, mode }: { initialSeed: string; playerName: string; onExit: () => void; mode: "training" | "multiplayer" }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [health, setHealth] = useState(100);
  const [isDead, setIsDead] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [explosionPos, setExplosionPos] = useState<[number, number, number] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [joinError, setJoinError] = useState("");
  const [localParts, setLocalParts] = useState<Part[]>([]);
  const [matchTime, setMatchTime] = useState(120);
  const [matchResults, setMatchResults] = useState<any[] | null>(null);

  const remoteData = useRef<Record<string, any>>({});
  const localData = useRef<any>({
    position: [0, 0, -2800],
    quaternion: [0, 0, 0, 1],
  });

  useEffect(() => {
    setLocalParts(generateSpaceship(initialSeed));
  }, [initialSeed]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("join", {
        name: playerName,
        seed: initialSeed,
        position: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100],
        quaternion: [0, 0, 0, 1],
        mode: mode
      });
    });

    newSocket.on("join_error", (msg) => {
      setJoinError(msg);
    });

    newSocket.on("join_success", (player) => {
      setHealth(player.health);
      setStats(player.stats);
      localData.current.stats = player.stats;
      localData.current.activeSeed = player.activeSeed;
    });

    newSocket.on("leaderboard:update", (lb) => {
      setLeaderboard(lb);
    });

    newSocket.on("match:timer", (time) => {
      setMatchTime(time);
    });

    newSocket.on("match:end", (results) => {
      setMatchResults(results);
    });

    newSocket.on("match:start", () => {
      setMatchResults(null);
    });

    newSocket.on("init", (serverPlayers: any[]) => {
      const others = serverPlayers.filter((p) => p.id !== newSocket.id);
      setPlayers(others);
      others.forEach((p) => {
        remoteData.current[p.id] = {
          position: p.position,
          quaternion: p.quaternion,
          health: p.health,
          isDead: p.isDead,
          activeSeed: p.activeSeed,
          name: p.name,
          isNPC: p.isNPC
        };
      });
    });

    newSocket.on("player:join", (player: any) => {
      setPlayers((prev) => {
        if (prev.some(p => p.id === player.id)) {
          return prev.map(p => p.id === player.id ? player : p);
        }
        return [...prev, player];
      });
      remoteData.current[player.id] = {
        position: player.position,
        quaternion: player.quaternion,
        health: player.health,
        isDead: false,
        activeSeed: player.activeSeed,
        name: player.name,
        isNPC: player.isNPC
      };
    });

    newSocket.on("player:move", (data: any) => {
      if (remoteData.current[data.id]) {
        remoteData.current[data.id].position = data.position;
        remoteData.current[data.id].quaternion = data.quaternion;
      }
    });

    newSocket.on("player:health", (data: any) => {
      if (data.id === newSocket.id) {
        setHealth(data.health);
      } else if (remoteData.current[data.id]) {
        remoteData.current[data.id].health = data.health;
      }
    });

    newSocket.on("player:die", (data: any) => {
      if (data.id === newSocket.id) {
        setIsDead(true);
        setExplosionPos(localData.current.position);
      } else if (remoteData.current[data.id]) {
        remoteData.current[data.id].isDead = true;
      }
    });

    newSocket.on("player:respawn", (data: any) => {
      if (data.id === newSocket.id) {
        setIsDead(false);
        setHealth(data.health);
        setExplosionPos(null);
        localData.current.position = data.position;
        localData.current.activeSeed = data.activeSeed;
        localData.current.stats = data.stats;
        setStats(data.stats);
        setLocalParts(generateSpaceship(data.activeSeed));
      } else if (remoteData.current[data.id]) {
        remoteData.current[data.id].isDead = false;
        remoteData.current[data.id].health = data.health;
        remoteData.current[data.id].position = data.position;
        remoteData.current[data.id].activeSeed = data.activeSeed;
        setPlayers((prev) => prev.map(p => p.id === data.id ? { ...p, activeSeed: data.activeSeed } : p));
      }
    });

    newSocket.on("player:leave", (id: string) => {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      delete remoteData.current[id];
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  if (joinError) {
    return (
      <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white font-mono gap-4">
        <div className="text-red-500 text-xl font-bold">{joinError}</div>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all font-medium border border-white/10"
        >
          Return to Hangar
        </button>
      </div>
    );
  }

  if (!socket || !stats) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center text-white font-mono">
        Connecting to server...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black overflow-hidden font-sans">
      <KeyboardControls
        map={[
          { name: "pitchUp", keys: ["s", "S", "ArrowDown"] },
          { name: "pitchDown", keys: ["w", "W", "ArrowUp"] },
          { name: "yawLeft", keys: ["a", "A", "ArrowLeft"] },
          { name: "yawRight", keys: ["d", "D", "ArrowRight"] },
          { name: "rollLeft", keys: ["q", "Q"] },
          { name: "rollRight", keys: ["e", "E"] },
          { name: "thrust", keys: ["Shift"] },
          { name: "brake", keys: ["Control"] },
          { name: "shoot", keys: ["Space"] },
          { name: "missile", keys: ["f", "F"] },
        ]}
      >
        <Canvas shadows camera={{ fov: 60, far: 30000 }}>
          <color attach="background" args={["#0f172a"]} />
          <Stars
            radius={300}
            depth={50}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />

          <Player
            parts={localParts}
            socket={socket}
            localData={localData}
            remoteData={remoteData}
            health={health}
            isDead={isDead}
            stats={stats}
            playerName={playerName}
          />
          {isDead && explosionPos && <Explosion position={explosionPos} />}
          {players.map((p) => (
            <RemotePlayer
              key={p.id}
              id={p.id}
              activeSeed={p.activeSeed}
              name={p.name}
              remoteData={remoteData}
            />
          ))}
          <BulletsManager socket={socket} />

          <SolarSystem />
          <RadarLogic
            players={players}
            remoteData={remoteData}
            localData={localData}
          />
        </Canvas>
      </KeyboardControls>

      <GameUI
        showUI={showUI}
        setShowUI={setShowUI}
        playersCount={players.length + 1}
        health={health}
        isDead={isDead}
        leaderboard={leaderboard}
        socketId={socket.id}
        onExit={onExit}
        matchTime={matchTime}
        matchResults={matchResults}
      />

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none opacity-50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-3 bg-white"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-3 bg-white"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-white"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-px bg-white"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-400 rounded-full"></div>
      </div>

      <MobileControls />
      <Radar />
    </div>
  );
}
