import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Stars,
  KeyboardControls,
  useKeyboardControls,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { generateSpaceship, Part } from "../utils/spaceshipGenerator";
import { SpaceshipModel } from "./SpaceshipModel";
import { Rocket, Trophy } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { touchState, MobileControls } from "./MobileControls";

export const activeBullets = new Map<string, { position: THREE.Vector3, velocity: THREE.Vector3, ownerId: string, type?: string }>();
export const planetPositions = new Map<string, { position: THREE.Vector3, radius: number }>();
export const playerState = { lastMissileTime: 0 };

function getGamepadState() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gamepads[0];
  if (!gp) return {};

  return {
    pitchUp: gp.axes[1] > 0.2 || gp.buttons[13]?.pressed,
    pitchDown: gp.axes[1] < -0.2 || gp.buttons[12]?.pressed,
    yawLeft: gp.axes[0] < -0.2 || gp.buttons[14]?.pressed,
    yawRight: gp.axes[0] > 0.2 || gp.buttons[15]?.pressed,
    rollLeft: gp.buttons[4]?.pressed,
    rollRight: gp.buttons[5]?.pressed,
    thrust: gp.buttons[7]?.pressed,
    brake: gp.buttons[6]?.pressed,
    shoot: gp.buttons[0]?.pressed,
    missile: gp.buttons[2]?.pressed || gp.buttons[1]?.pressed,
  };
}

function useMergedControls() {
  const [, getKeyboard] = useKeyboardControls();
  
  return () => {
    const kbd = getKeyboard();
    const gp = getGamepadState();
    
    return {
      pitchUp: kbd.pitchUp || gp.pitchUp || touchState.pitchUp,
      pitchDown: kbd.pitchDown || gp.pitchDown || touchState.pitchDown,
      yawLeft: kbd.yawLeft || gp.yawLeft || touchState.yawLeft,
      yawRight: kbd.yawRight || gp.yawRight || touchState.yawRight,
      rollLeft: kbd.rollLeft || gp.rollLeft || touchState.rollLeft,
      rollRight: kbd.rollRight || gp.rollRight || touchState.rollRight,
      thrust: kbd.thrust || gp.thrust || touchState.thrust,
      brake: kbd.brake || gp.brake || touchState.brake,
      shoot: kbd.shoot || gp.shoot || touchState.shoot,
      missile: kbd.missile || gp.missile || touchState.missile,
    };
  };
}

function Player({
  parts,
  socket,
  localData,
  remoteData,
  health,
  isDead,
  stats,
  playerName,
}: {
  parts: Part[];
  socket: Socket;
  localData: React.MutableRefObject<any>;
  remoteData: React.MutableRefObject<any>;
  health: number;
  isDead: boolean;
  stats: any;
  playerName: string;
}) {
  const shipRef = useRef<THREE.Group>(null);
  const getControls = useMergedControls();
  const velocity = useRef(0);
  const angularVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const lastEmit = useRef(0);
  const lastShoot = useRef(0);

  useEffect(() => {
    // Join is now handled in Game component
  }, []);

  useFrame((state, delta) => {
    if (!shipRef.current) return;

    if (isDead) {
      // Just let camera stay
      return;
    }

    const { pitchUp, pitchDown, yawLeft, yawRight, rollLeft, rollRight, thrust, brake, shoot, missile } = getControls();

    // Stats multipliers
    const speedMult = stats?.speedMultiplier || 1;
    const turnMult = stats?.turnSpeedMultiplier || 1;
    const fireRateMult = stats?.fireRateMultiplier || 1;

    // Inertia factors
    const turnPower = 3.0 * turnMult;
    
    // Apply input to angular velocity
    if (pitchUp) angularVelocity.current.x += turnPower * delta;
    if (pitchDown) angularVelocity.current.x -= turnPower * delta;
    if (yawLeft) angularVelocity.current.y += turnPower * delta;
    if (yawRight) angularVelocity.current.y -= turnPower * delta;
    if (rollLeft) angularVelocity.current.z += turnPower * delta;
    if (rollRight) angularVelocity.current.z -= turnPower * delta;

    // Apply drag to angular velocity
    angularVelocity.current.multiplyScalar(0.92);

    // Apply angular velocity to rotation
    shipRef.current.rotateX(angularVelocity.current.x * delta);
    shipRef.current.rotateY(angularVelocity.current.y * delta);
    shipRef.current.rotateZ(angularVelocity.current.z * delta);

    // Thrust
    if (thrust) {
      velocity.current = THREE.MathUtils.lerp(velocity.current, 200 * speedMult, delta * 0.5);
    } else if (brake) {
      velocity.current = THREE.MathUtils.lerp(velocity.current, 0, delta * 2);
    } else {
      velocity.current = THREE.MathUtils.lerp(velocity.current, 30 * speedMult, delta * 0.2); // Cruising speed
    }

    // Move forward
    shipRef.current.translateZ(-velocity.current * delta);

    // Shooting
    if (shoot && state.clock.elapsedTime - lastShoot.current > (0.15 / fireRateMult)) {
      lastShoot.current = state.clock.elapsedTime;
      const bulletPos = shipRef.current.position.clone();
      const bulletDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        shipRef.current.quaternion,
      );
      bulletPos.add(bulletDir.clone().multiplyScalar(4)); // Spawn slightly ahead

      socket.emit("shoot", {
        id: uuidv4(),
        position: bulletPos.toArray(),
        velocity: bulletDir.multiplyScalar(300).toArray(), // Fast bullet
        type: 'normal'
      });
    }

    // Missile
    if (missile && Date.now() - playerState.lastMissileTime > 10000) {
      playerState.lastMissileTime = Date.now();
      const bulletPos = shipRef.current.position.clone();
      const bulletDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        shipRef.current.quaternion,
      );
      bulletPos.add(bulletDir.clone().multiplyScalar(4));

      socket.emit("shoot", {
        id: uuidv4(),
        position: bulletPos.toArray(),
        velocity: bulletDir.multiplyScalar(150).toArray(), // Slower missile
        type: 'missile'
      });
    }

    // Collision detection
    activeBullets.forEach((bullet, id) => {
      if (bullet.ownerId !== socket.id) {
        const dist = shipRef.current!.position.distanceTo(bullet.position);
        if (dist < 4.0) {
          const damageAmount = bullet.type === 'missile' ? 60 : 20;
          socket.emit("damage", { targetId: socket.id, attackerId: bullet.ownerId, amount: damageAmount, bulletId: id });
          activeBullets.delete(id); // Optimistically remove
        }
      }
    });

    // Player collision
    Object.keys(remoteData.current).forEach((playerId) => {
      if (playerId !== socket.id) {
        const rData = remoteData.current[playerId];
        if (!rData || !rData.position) return;
        const remotePos = new THREE.Vector3().fromArray(rData.position);
        const dist = shipRef.current!.position.distanceTo(remotePos);
        if (dist < 4.0) {
          socket.emit("damage", { targetId: socket.id, attackerId: playerId, amount: 9999, bulletId: "player_collision" });
        }
      }
    });

    // Planet collision
    planetPositions.forEach((planet) => {
      const dist = shipRef.current!.position.distanceTo(planet.position);
      if (dist < planet.radius + 2) { // 2 is roughly the ship radius
        socket.emit("damage", { targetId: socket.id, attackerId: socket.id, amount: 9999, bulletId: "planet" });
      }
    });

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
      const pos = shipRef.current.position.toArray();
      const quat = shipRef.current.quaternion.toArray();

      localData.current.position = pos;
      localData.current.quaternion = quat;

      socket.emit("move", {
        position: pos,
        quaternion: quat,
      });
    }
  });

  if (isDead) return null;

  return (
    <group ref={shipRef}>
      <SpaceshipModel parts={parts} />
      <Html center position={[0, 4, 0]}>
        <div className="text-emerald-400 font-bold text-xs pointer-events-none whitespace-nowrap bg-black/50 px-2 py-1 rounded border border-emerald-500/30 flex flex-col items-center gap-1">
          <span>▼ {playerName || "Player"}</span>
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${health}%` }} />
          </div>
        </div>
      </Html>
      {/* Engine glow light */}
      <pointLight
        position={[0, 0, 5]}
        intensity={2}
        color="#44ccff"
        distance={20}
      />
      {/* Top light for visibility */}
      <pointLight
        position={[0, 8, 0]}
        intensity={3}
        color="#ffffff"
        distance={40}
      />
    </group>
  );
}

function Explosion({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.scale.addScalar(delta * 20);
      (ref.current.material as THREE.MeshBasicMaterial).opacity -= delta * 1.5;
    }
  });

  return (
    <mesh position={position} ref={ref}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#ff5500" transparent opacity={1} />
    </mesh>
  );
}

function RemotePlayer({
  id,
  activeSeed,
  name,
  remoteData,
}: {
  id: string;
  activeSeed: string;
  name: string;
  remoteData: React.MutableRefObject<Record<string, any>>;
}) {
  const ref = useRef<THREE.Group>(null);
  const [health, setHealth] = useState(100);
  const [isDead, setIsDead] = useState(false);
  const [explosionPos, setExplosionPos] = useState<[number, number, number] | null>(null);
  const parts = useMemo(() => generateSpaceship(activeSeed), [activeSeed]);

  useFrame(() => {
    const data = remoteData.current[id];
    if (data && data.position && data.quaternion) {
      if (data.health !== health) setHealth(data.health);
      
      if (data.isDead && !isDead) {
        setIsDead(true);
        setExplosionPos(data.position);
      } else if (!data.isDead && isDead) {
        setIsDead(false);
        setExplosionPos(null);
      }

      if (ref.current && !data.isDead) {
        ref.current.position.lerp(
          new THREE.Vector3().fromArray(data.position),
          0.3,
        );
        ref.current.quaternion.slerp(
          new THREE.Quaternion().fromArray(data.quaternion),
          0.3,
        );
      }
    }
  });

  if (isDead) {
    return explosionPos ? <Explosion position={explosionPos} /> : null;
  }

  return (
    <group ref={ref}>
      <SpaceshipModel parts={parts} />
      <Html center position={[0, 4, 0]}>
        <div className="text-red-400 font-bold text-xs pointer-events-none whitespace-nowrap bg-black/50 px-2 py-1 rounded border border-red-500/30 flex flex-col items-center gap-1">
          <span>▼ {name || "Enemy"}</span>
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: `${health}%` }} />
          </div>
        </div>
      </Html>
      {/* Top light for visibility */}
      <pointLight
        position={[0, 8, 0]}
        intensity={3}
        color="#ffffff"
        distance={40}
      />
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
      const isMissile = data.type === 'missile';
      const geometry = isMissile 
        ? new THREE.CapsuleGeometry(0.5, 4, 4, 8) 
        : new THREE.CapsuleGeometry(0.2, 2, 4, 8);
      geometry.rotateX(Math.PI / 2); // Align with Z axis
      const material = new THREE.MeshBasicMaterial({ color: isMissile ? 0xff5500 : 0x00ffcc });
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
      activeBullets.set(data.id, {
        position: mesh.position,
        velocity: vel,
        ownerId: data.ownerId,
        type: data.type
      });
    };

    const onDestroy = (id: string) => {
      const bullet = bullets.current.get(id);
      if (bullet) {
        groupRef.current?.remove(bullet.mesh);
        bullet.mesh.geometry.dispose();
        (bullet.mesh.material as THREE.Material).dispose();
        bullets.current.delete(id);
        activeBullets.delete(id);
      }
    };

    socket.on("bullet:new", onBullet);
    socket.on("bullet:destroy", onDestroy);
    return () => {
      socket.off("bullet:new", onBullet);
      socket.off("bullet:destroy", onDestroy);
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
        activeBullets.delete(id);
      } else {
        bullet.mesh.position.addScaledVector(bullet.velocity, delta);
        const active = activeBullets.get(id);
        if (active) {
          active.position.copy(bullet.mesh.position);
        }
      }
    });
  });

  return <group ref={groupRef} />;
}

const SOLAR_SYSTEM = [
  {
    name: "Sun",
    size: 400,
    distance: 0,
    color: "#ffcc00",
    emissive: "#ffaa00",
    isSun: true,
  },
  { name: "Mercury", size: 8, distance: 800, color: "#888888" },
  { name: "Venus", size: 18, distance: 1100, color: "#e3bb76" },
  { name: "Earth", size: 20, distance: 1500, color: "#2b82c9" },
  { name: "Mars", size: 12, distance: 1900, color: "#c1440e" },
  { name: "Jupiter", size: 180, distance: 2800, color: "#d39c7e" },
  {
    name: "Saturn",
    size: 150,
    distance: 3800,
    color: "#ead6b8",
    hasRings: true,
  },
  { name: "Uranus", size: 70, distance: 4800, color: "#4b70dd" },
  { name: "Neptune", size: 68, distance: 5500, color: "#274687" },
];

function CelestialBody({
  data,
  center,
}: {
  data: any;
  center: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Random initial orbit angle
  const [angle] = useState(Math.random() * Math.PI * 2);
  const orbitSpeed = data.distance > 0 ? 20 / data.distance : 0;

  useFrame((_, delta) => {
    if (ref.current && data.distance > 0) {
      ref.current.rotation.y += orbitSpeed * delta * 0.1;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      planetPositions.set(data.name, { position: worldPos, radius: data.size });
    }
  });

  return (
    <group position={center} ref={ref}>
      <group rotation={[0, angle, 0]}>
        <group position={[0, 0, data.distance]}>
          <mesh ref={meshRef}>
            <sphereGeometry args={[data.size, 64, 64]} />
            {data.isSun ? (
              <meshBasicMaterial color={data.color} />
            ) : (
              <meshStandardMaterial
                color={data.color}
                roughness={0.7}
                metalness={0.1}
              />
            )}
          </mesh>

          {/* Atmosphere / Glow */}
          <mesh scale={data.isSun ? 1.02 : 1.05}>
            <sphereGeometry args={[data.size, 32, 32]} />
            <meshBasicMaterial
              color={data.emissive || data.color}
              transparent
              opacity={data.isSun ? 0.3 : 0.1}
              side={THREE.BackSide}
            />
          </mesh>

          {/* Saturn Rings */}
          {data.hasRings && (
            <mesh rotation={[Math.PI / 2.2, 0, 0]}>
              <ringGeometry args={[data.size * 1.2, data.size * 2.2, 64]} />
              <meshStandardMaterial
                color={data.color}
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

function SolarSystem() {
  const center: [number, number, number] = [0, 0, -3000];

  return (
    <>
      {/* Sun Light */}
      <pointLight
        position={center}
        intensity={4}
        distance={50000}
        decay={1}
        color="#ffffff"
      />
      <ambientLight intensity={0.4} />
      <directionalLight position={[1000, 1000, 1000]} intensity={0.5} />

      {SOLAR_SYSTEM.map((body) => (
        <CelestialBody key={body.name} data={body} center={center} />
      ))}
    </>
  );
}

function RadarLogic({
  players,
  remoteData,
  localData,
}: {
  players: any[];
  remoteData: any;
  localData: any;
}) {
  useFrame(() => {
    const radarDOM = document.getElementById("radar-dots");
    if (!radarDOM) return;

    const localPos = new THREE.Vector3().fromArray(
      localData.current.position || [0, 0, 0],
    );
    const localQuat = new THREE.Quaternion().fromArray(
      localData.current.quaternion || [0, 0, 0, 1],
    );

    let html = "";
    players.forEach((p) => {
      const rData = remoteData.current[p.id];
      if (!rData || !rData.position) return;
      const remotePos = new THREE.Vector3().fromArray(rData.position);
      const relativePos = remotePos.clone().sub(localPos);
      relativePos.applyQuaternion(localQuat.clone().invert());

      const scale = 50 / 4000; // 4000 units radar range
      let rx = relativePos.x * scale;
      let ry = relativePos.z * scale;

      const dist = Math.sqrt(rx * rx + ry * ry);
      if (dist > 45) {
        rx = (rx / dist) * 45;
        ry = (ry / dist) * 45;
      }

      html += `<div style="position:absolute; width:6px; height:6px; background:#ef4444; border-radius:50%; left:calc(50% + ${rx}px); top:calc(50% + ${ry}px); transform:translate(-50%, -50%); box-shadow:0 0 5px #ef4444;"></div>`;
    });

    radarDOM.innerHTML = html;
  });
  return null;
}

function MissileCooldownUI() {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let frame: number;
    const update = () => {
      const elapsed = Date.now() - playerState.lastMissileTime;
      if (elapsed < 10000) {
        setProgress((elapsed / 10000) * 100);
      } else {
        setProgress(100);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mt-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto">
      <p className="text-sm text-gray-300 mb-2">Missile (F/B/MSL)</p>
      <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden border border-white/10">
        <div 
          className={`h-full transition-all duration-100 ${progress === 100 ? 'bg-orange-500' : 'bg-gray-500'}`} 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
}

export function Game({ initialSeed, playerName, onExit }: { initialSeed: string; playerName: string; onExit: () => void }) {
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
        quaternion: [0, 0, 0, 1]
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
          name: p.name
        };
      });
    });

    newSocket.on("player:join", (player: any) => {
      setPlayers((prev) => [...prev, player]);
      remoteData.current[player.id] = {
        position: player.position,
        quaternion: player.quaternion,
        health: player.health,
        isDead: false,
        activeSeed: player.activeSeed,
        name: player.name
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
        ]}
      >
        <Canvas shadows camera={{ fov: 60, far: 30000 }}>
          <color attach="background" args={["#000005"]} />
          <Stars
            radius={300}
            depth={50}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />

          <Player parts={localParts} socket={socket} localData={localData} remoteData={remoteData} health={health} isDead={isDead} stats={stats} playerName={playerName} />
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

      {/* Game UI */}
      <div className="absolute top-6 left-6 text-white font-mono pointer-events-none">
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold tracking-tight">
            Space Explorer (Multiplayer)
          </h2>
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
                <span className="text-emerald-400 font-bold">SHIFT</span> : Thrust
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
                  {players.length + 1}
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
        
        {/* Health Bar */}
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
      </div>

      {/* Leaderboard */}
      {showUI && (
        <div className="absolute top-6 right-6 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 w-64 pointer-events-auto font-mono">
          <div className="flex items-center gap-2 mb-3 text-emerald-400">
            <Trophy className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Top Pilots</h3>
          </div>
          <div className="flex flex-col gap-2">
            {leaderboard.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-bold w-4">{index + 1}.</span>
                  <span className={player.id === socket.id ? "text-emerald-400 font-bold" : "text-gray-300"}>
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
        className="absolute bottom-6 left-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all font-medium border border-white/10 pointer-events-auto"
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

      <MobileControls />

      {/* Radar */}
      <div className="absolute bottom-6 right-6 w-32 h-32 bg-emerald-900/20 border-2 border-emerald-500/50 rounded-full backdrop-blur-md overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_5px_white]"></div>
        <div id="radar-dots" className="absolute inset-0"></div>
      </div>
    </div>
  );
}
