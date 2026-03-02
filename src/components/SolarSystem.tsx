import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { planetPositions } from "../game/state";

const SOLAR_SYSTEM_DATA = [
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

          <mesh scale={data.isSun ? 1.02 : 1.05}>
            <sphereGeometry args={[data.size, 32, 32]} />
            <meshBasicMaterial
              color={data.emissive || data.color}
              transparent
              opacity={data.isSun ? 0.3 : 0.1}
              side={THREE.BackSide}
            />
          </mesh>

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

export function SolarSystem() {
  const center: [number, number, number] = [0, 0, -3000];

  return (
    <>
      <pointLight
        position={center}
        intensity={6}
        distance={50000}
        decay={1}
        color="#fff5e6"
      />
      <ambientLight intensity={0.8} color="#e0e5ff" />
      <directionalLight position={[1000, 2000, 1000]} intensity={1.2} color="#ffffff" />
      <hemisphereLight args={["#ffffff", "#444455", 0.6]} />

      {SOLAR_SYSTEM_DATA.map((body) => (
        <CelestialBody key={body.name} data={body} center={center} />
      ))}
    </>
  );
}
