import React, { forwardRef } from "react";
import * as THREE from "three";
import { Part } from "../utils/spaceshipGenerator";

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
const coneGeometry = new THREE.ConeGeometry(1, 1, 16);

export const SpaceshipModel = forwardRef<THREE.Group, { parts: Part[] }>(
  ({ parts }, ref) => {
    return (
      <group ref={ref}>
        {parts.map((part) => {
          let geometry;
          switch (part.type) {
            case "box":
              geometry = boxGeometry;
              break;
            case "cylinder":
              geometry = cylinderGeometry;
              break;
            case "cone":
              geometry = coneGeometry;
              break;
            default:
              geometry = boxGeometry;
          }

          return (
            <mesh
              key={part.id}
              position={part.position}
              scale={part.scale}
              rotation={part.rotation}
              geometry={geometry}
              castShadow
              receiveShadow
            >
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
