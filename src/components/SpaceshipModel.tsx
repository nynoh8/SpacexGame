import React, { forwardRef } from "react";
import * as THREE from "three";
import { Part } from "../utils/spaceshipGenerator";

export const SpaceshipModel = forwardRef<THREE.Group, { parts: Part[] }>(
  ({ parts }, ref) => {
    return (
      <group ref={ref}>
        {parts.map((part) => {
          let geometry;
          switch (part.type) {
            case "box":
              geometry = <boxGeometry args={[1, 1, 1]} />;
              break;
            case "cylinder":
              geometry = <cylinderGeometry args={[1, 1, 1, 16]} />;
              break;
            case "cone":
              geometry = <coneGeometry args={[1, 1, 16]} />;
              break;
            default:
              geometry = <boxGeometry args={[1, 1, 1]} />;
          }

          return (
            <mesh
              key={part.id}
              position={part.position}
              scale={part.scale}
              rotation={part.rotation}
              castShadow
              receiveShadow
            >
              {geometry}
              <meshStandardMaterial
                color={part.color}
                roughness={0.4}
                metalness={0.6}
              />
            </mesh>
          );
        })}
      </group>
    );
  },
);
