import React, { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { generateSpaceship } from "../utils/spaceshipGenerator";
import { SpaceshipModel } from "./SpaceshipModel";

export function Explosion({ position }: { position: [number, number, number] }) {
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

export function RemotePlayer({
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
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: `${health}%` }} />
          </div>
        </div>
      </Html>
      {/* Top light for visibility */}
      <pointLight
        position={[0, 8, 0]}
        intensity={3}
        color="#f8fafc"
        distance={40}
      />
    </group>
  );
}
