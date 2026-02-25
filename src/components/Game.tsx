import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Stars,
  KeyboardControls,
  useKeyboardControls,
} from "@react-three/drei";
import * as THREE from "three";
import { Part } from "../utils/spaceshipGenerator";
import { SpaceshipModel } from "./SpaceshipModel";
import { Rocket } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

function Player({ parts, socket }: { parts: Part[]; socket: Socket }) {
  const shipRef = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls();
  const speed = useRef(0);
  const lastEmit = useRef(0);
  const lastShoot = useRef(0);

  useEffect(() => {
    socket.emit("join", { parts });
  }, [socket, parts]);

  useFrame((state, delta) => {
    if (!shipRef.current) return;

    const { forward, backward, left, right, boost, shoot } = get();

    // Rotation
    const turnSpeed = 2 * delta;
    if (left) shipRef.current.rotateY(turnSpeed);
    if (right) shipRef.current.rotateY(-turnSpeed);
    if (forward) shipRef.current.rotateX(-turnSpeed);
    if (backward) shipRef.current.rotateX(turnSpeed);

    // Thrust
    const targetSpeed = boost ? 100 : 30;
    speed.current = THREE.MathUtils.lerp(speed.current, targetSpeed, delta * 2);

    // Move forward
    shipRef.current.translateZ(-speed.current * delta);

    // Shooting
    if (shoot && state.clock.elapsedTime - lastShoot.current > 0.15) {
      lastShoot.current = state.clock.elapsedTime;
      const bulletPos = shipRef.current.position.clone();
      const bulletDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        shipRef.current.quaternion
      );
      bulletPos.add(bulletDir.clone().multiplyScalar(4)); // Spawn slightly ahead

      socket.emit("shoot", {
        id: uuidv4(),
        position: bulletPos.toArray(),
        velocity: bulletDir.multiplyScalar(300).toArray(), // Fast bullet
      });
    }

    // Camera follow
    const idealOffset = new THREE.Vector3(0, 5, 15);
    idealOffset.applyQuaternion(shipRef.current.quaternion);
    idealOffset.add(shipRef.current.position);

    const idealLookAt = new THREE.Vector3(0, 0, -20);
    idealLookAt.applyQuaternion(shipRef.current.quaternion);
    idealLookAt.add(shipRef.current.position);

    state.camera.position.lerp(idealOffset, 0.1);
    state.camera.lookAt(idealLookAt);

    // Emit position
    if (state.clock.elapsedTime - lastEmit.current > 0.05) {
      lastEmit.current = state.clock.elapsedTime;
      socket.emit("move", {
        position: shipRef.current.position.toArray(),
        quaternion: shipRef.current.quaternion.toArray(),
      });
    }
  });

  return (
    <group ref={shipRef}>
      <SpaceshipModel parts={parts} />
      {/* Engine glow light */}
      <pointLight
        position={[0, 0, 5]}
        intensity={2}
        color="#44ccff"
        distance={20}
      />
    </group>
  );
}

function RemotePlayer({
  id,
  parts,
  remoteData,
}: {
  id: string;
  parts: Part[];
  remoteData: React.MutableRefObject<Record<string, any>>;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const data = remoteData.current[id];
    if (data && ref.current) {
      ref.current.position.lerp(
        new THREE.Vector3().fromArray(data.position),
        0.3
      );
      ref.current.quaternion.slerp(
        new THREE.Quaternion().fromArray(data.quaternion),
        0.3
      );
    }
  });

  return (
    <group ref={ref}>
      <SpaceshipModel parts={parts} />
    </group>
  );
}

function BulletsManager({ socket }: { socket: Socket }) {
  const groupRef = useRef<THREE.Group>(null);
  const bullets = useRef<
    Map<
      string,
      { mesh: THREE.Mesh; velocity: THREE.Vector3; spawnedAt: number }
    >
  >(new Map());

  useEffect(() => {
    const onBullet = (data: any) => {
      const geometry = new THREE.CapsuleGeometry(0.2, 2, 4, 8);
      geometry.rotateX(Math.PI / 2); // Align with Z axis
      const material = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.fromArray(data.position);

      // Orient bullet to velocity
      const vel = new THREE.Vector3().fromArray(data.velocity);
      mesh.lookAt(mesh.position.clone().add(vel));

      groupRef.current?.add(mesh);

      bullets.current.set(data.id, {
        mesh,
        velocity: vel,
        spawnedAt: Date.now(),
      });
    };

    socket.on("bullet:new", onBullet);
    return () => {
      socket.off("bullet:new", onBullet);
    };
  }, [socket]);

  useFrame((state, delta) => {
    const now = Date.now();
    bullets.current.forEach((bullet, id) => {
      if (now - bullet.spawnedAt > 2000) {
        // 2 seconds lifetime
        groupRef.current?.remove(bullet.mesh);
        bullet.mesh.geometry.dispose();
        (bullet.mesh.material as THREE.Material).dispose();
        bullets.current.delete(id);
      } else {
        bullet.mesh.position.addScaledVector(bullet.velocity, delta);
      }
    });
  });

  return <group ref={groupRef} />;
}

function Planet({
  position,
  size,
  color,
  name,
}: {
  position: [number, number, number];
  size: number;
  color: string;
  name: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.05;
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
      </mesh>
      {/* Atmosphere */}
      <mesh scale={1.05}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function Universe() {
  const planets = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      position: [
        (Math.random() - 0.5) * 4000,
        (Math.random() - 0.5) * 4000,
        (Math.random() - 0.5) * 4000 - 1000,
      ] as [number, number, number],
      size: 20 + Math.random() * 150,
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5).getStyle(),
      name: `Planet ${i + 1}`,
    }));
  }, []);

  return (
    <>
      {planets.map((p) => (
        <Planet key={p.id} {...p} />
      ))}
    </>
  );
}

export function Game({ parts, onExit }: { parts: Part[]; onExit: () => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const remoteData = useRef<Record<string, any>>({});

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("init", (serverPlayers: any[]) => {
      const others = serverPlayers.filter((p) => p.id !== newSocket.id);
      setPlayers(others);
      others.forEach((p) => {
        remoteData.current[p.id] = {
          position: p.position,
          quaternion: p.quaternion,
        };
      });
    });

    newSocket.on("player:join", (player: any) => {
      setPlayers((prev) => [...prev, player]);
      remoteData.current[player.id] = {
        position: player.position,
        quaternion: player.quaternion,
      };
    });

    newSocket.on("player:move", (data: any) => {
      if (remoteData.current[data.id]) {
        remoteData.current[data.id].position = data.position;
        remoteData.current[data.id].quaternion = data.quaternion;
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

  if (!socket) {
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
          { name: "forward", keys: ["ArrowUp", "w", "W"] },
          { name: "backward", keys: ["ArrowDown", "s", "S"] },
          { name: "left", keys: ["ArrowLeft", "a", "A"] },
          { name: "right", keys: ["ArrowRight", "d", "D"] },
          { name: "boost", keys: ["Shift"] },
          { name: "shoot", keys: ["Space"] },
        ]}
      >
        <Canvas shadows camera={{ fov: 60 }}>
          <color attach="background" args={["#000005"]} />
          <ambientLight intensity={0.2} />
          <directionalLight
            position={[100, 100, 50]}
            intensity={1.5}
            castShadow
          />
          <Stars
            radius={300}
            depth={50}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />

          <Player parts={parts} socket={socket} />
          {players.map((p) => (
            <RemotePlayer
              key={p.id}
              id={p.id}
              parts={p.parts}
              remoteData={remoteData}
            />
          ))}
          <BulletsManager socket={socket} />

          <Universe />
        </Canvas>
      </KeyboardControls>

      {/* Game UI */}
      <div className="absolute top-6 left-6 text-white font-mono pointer-events-none">
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold tracking-tight">
            Space Explorer (Multiplayer)
          </h2>
        </div>
        <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col gap-2">
          <p className="text-sm text-gray-300">
            <span className="text-emerald-400 font-bold">W/S</span> : Pitch
            Up/Down
          </p>
          <p className="text-sm text-gray-300">
            <span className="text-emerald-400 font-bold">A/D</span> : Yaw
            Left/Right
          </p>
          <p className="text-sm text-gray-300">
            <span className="text-emerald-400 font-bold">SHIFT</span> : Boost
          </p>
          <p className="text-sm text-gray-300">
            <span className="text-emerald-400 font-bold">SPACE</span> : Shoot
          </p>
        </div>
        <div className="mt-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10">
          <p className="text-sm text-gray-300">
            Players Online:{" "}
            <span className="text-emerald-400 font-bold">
              {players.length + 1}
            </span>
          </p>
        </div>
      </div>

      <button
        onClick={onExit}
        className="absolute top-6 right-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all font-medium border border-white/10"
      >
        Return to Hangar
      </button>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none opacity-50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-3 bg-white"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-3 bg-white"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-white"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-px bg-white"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-400 rounded-full"></div>
      </div>
    </div>
  );
}
