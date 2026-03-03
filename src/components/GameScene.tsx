import React, { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { globalGameManager } from '../core/GameManager';
import { PlayingState } from '../core/state/PlayingState';
import { TransformComponent, PhysicsComponent, InputComponent } from '../components/ecs/Components';
import { Ship } from './Ship';
import { globalEventBus } from '../core/events/EventBus';
import { MobileControls } from './MobileControls';

const Projectile: React.FC<{ transform: TransformComponent }> = ({ transform }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(transform.position);
      meshRef.current.quaternion.copy(transform.rotation);
    }
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color="#ff0000" />
    </mesh>
  );
};

const SceneContent: React.FC = () => {
  const [playerEntity, setPlayerEntity] = useState<number | null>(null);
  const [entityCount, setEntityCount] = useState(0);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  // We need to get the world from the playing state
  const getPlayingState = () => {
    const state = globalGameManager.stateMachine.getCurrentState();
    if (state === "Playing") {
      // Hacky way to get the world for now, we should expose it properly
      return (globalGameManager.stateMachine as any).states.get("Playing") as PlayingState;
    }
    return null;
  };

  useEffect(() => {
    const onPlayerSpawned = (entityId: number) => {
      setPlayerEntity(entityId);
    };
    globalEventBus.subscribe("PLAYER_SPAWNED", onPlayerSpawned);
    return () => globalEventBus.unsubscribe("PLAYER_SPAWNED", onPlayerSpawned);
  }, []);

  useFrame((state, delta) => {
    const playingState = getPlayingState();
    if (!playingState) return;

    const world = (playingState as any).world;
    if (!world) return;

    // Check if entity count changed to trigger re-render
    const currentEntities = world.getEntitiesWithComponents(["Transform"]).length;
    if (currentEntities !== entityCount) {
      setEntityCount(currentEntities);
    }

    if (playerEntity === null) return;

    const transform = world.getComponent(playerEntity, "Transform") as TransformComponent | undefined;
    const physics = world.getComponent(playerEntity, "Physics") as PhysicsComponent | undefined;
    const input = world.getComponent(playerEntity, "Input") as InputComponent | undefined;

    if (!transform) return;

    // Update HUD stats
    if (physics) {
      globalEventBus.emit("PLAYER_STATS_UPDATED", {
        health: world.hasComponent(playerEntity, "Health") ? (world.getComponent(playerEntity, "Health") as any).currentHealth : 100,
        speed: physics.velocity.length()
      });
    }

    // Camera follow logic (Third person)
    if (cameraRef.current && transform) {
      const cameraOffset = new THREE.Vector3(0, 5, 15);
      const rotatedOffset = cameraOffset.applyQuaternion(transform.rotation);
      const targetPosition = transform.position.clone().add(rotatedOffset);
      
      // Smooth damp
      cameraRef.current.position.lerp(targetPosition, 0.1);
      cameraRef.current.lookAt(transform.position);
    }
  });

  // Render entities
  const renderEntities = () => {
    const playingState = getPlayingState();
    if (!playingState) return null;
    
    const world = (playingState as any).world;
    if (!world) return null;

    const entities = world.getEntitiesWithComponents(["Transform"]);
    
    return entities.map((entity: number) => {
      const transform = world.getComponent(entity, "Transform") as TransformComponent;
      const isPlayer = world.hasComponent(entity, "Player");
      const isProjectile = world.hasComponent(entity, "Projectile");
      
      if (isProjectile) {
        return <Projectile key={entity} transform={transform} />;
      }

      return (
        <Ship 
          key={entity} 
          transform={transform} 
          color={isPlayer ? "#3b82f6" : "#ef4444"} 
        />
      );
    });
  };

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 5, 15]} fov={60} />
      
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {renderEntities()}
      
      {/* Grid for reference */}
      <gridHelper args={[200, 200, 0x444444, 0x222222]} position={[0, -10, 0]} />
    </>
  );
};

export const GameScene: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-black">
      <Canvas shadows>
        <SceneContent />
      </Canvas>
      <MobileControls />
    </div>
  );
};
