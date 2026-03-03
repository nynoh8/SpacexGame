import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TransformComponent } from '../components/ecs/Components';

interface ShipProps {
  transform: TransformComponent;
  color?: string;
}

export const Ship: React.FC<ShipProps> = ({ transform, color = "blue" }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(transform.position);
      meshRef.current.quaternion.copy(transform.rotation);
      meshRef.current.scale.copy(transform.scale);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Simple spaceship shape */}
      <mesh castShadow receiveShadow>
        <coneGeometry args={[1, 3, 4]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      
      {/* Engine glow */}
      <mesh position={[0, -1.5, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.8, 0.5, 8]} />
        <meshBasicMaterial color="cyan" transparent opacity={0.8} />
      </mesh>
    </group>
  );
};
