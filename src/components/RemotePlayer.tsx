import React, { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { generateSpaceship } from "../utils/spaceshipGenerator";
import { SpaceshipModel } from "./SpaceshipModel";

const explosionGeometry = new THREE.SphereGeometry(1, 32, 32);
const explosionMaterial = new THREE.MeshBasicMaterial({ color: "#ff5500", transparent: true, opacity: 1 });

export function Explosion({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const material = useMemo(() => explosionMaterial.clone(), []);

  useFrame((_, delta) => {
    if (ref.current && materialRef.current) {
      ref.current.scale.addScalar(delta * 20);
      materialRef.current.opacity -= delta * 1.5;
    }
  });

  return (
    <mesh position={position} ref={ref} geometry={explosionGeometry}>
      <primitive object={material} ref={materialRef} attach="material" />
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

  return (
    <group ref={ref}>
      <group visible={!isDead}>
        <SpaceshipModel parts={parts} />
        {/* Top light for visibility */}
        <pointLight
          position={[0, 8, 0]}
          intensity={3}
          color="#f8fafc"
          distance={40}
        />
      </group>
      {isDead && explosionPos && <Explosion position={explosionPos} />}
    </group>
  );
}
