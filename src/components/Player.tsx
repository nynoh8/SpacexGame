import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardControls } from "@react-three/drei";
import { Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { Part } from "../utils/spaceshipGenerator";
import { SpaceshipModel } from "./SpaceshipModel";
import { touchState } from "./MobileControls";
import { activeBullets, planetPositions, playerState } from "../game/state";

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

export function Player({
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

  useFrame((state, delta) => {
    if (!shipRef.current) return;

    if (isDead) {
      return;
    }

    const { pitchUp, pitchDown, yawLeft, yawRight, rollLeft, rollRight, thrust, brake, shoot, missile } = getControls();

    const speedMult = stats?.speedMultiplier || 1;
    const turnMult = stats?.turnSpeedMultiplier || 1;
    const fireRateMult = stats?.fireRateMultiplier || 1;

    const turnPower = 3.0 * turnMult;
    
    if (pitchUp) angularVelocity.current.x += turnPower * delta;
    if (pitchDown) angularVelocity.current.x -= turnPower * delta;
    if (yawLeft) angularVelocity.current.y += turnPower * delta;
    if (yawRight) angularVelocity.current.y -= turnPower * delta;
    if (rollLeft) angularVelocity.current.z += turnPower * delta;
    if (rollRight) angularVelocity.current.z -= turnPower * delta;

    angularVelocity.current.multiplyScalar(0.92);

    shipRef.current.rotateX(angularVelocity.current.x * delta);
    shipRef.current.rotateY(angularVelocity.current.y * delta);
    shipRef.current.rotateZ(angularVelocity.current.z * delta);

    if (thrust) {
      velocity.current = THREE.MathUtils.lerp(velocity.current, 200 * speedMult, delta * 0.5);
    } else if (brake) {
      velocity.current = THREE.MathUtils.lerp(velocity.current, 0, delta * 2);
    } else {
      velocity.current = THREE.MathUtils.lerp(velocity.current, 30 * speedMult, delta * 0.2);
    }

    shipRef.current.translateZ(-velocity.current * delta);

    if (shoot && state.clock.elapsedTime - lastShoot.current > (0.15 / fireRateMult)) {
      lastShoot.current = state.clock.elapsedTime;
      const bulletPos = shipRef.current.position.clone();
      const bulletDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        shipRef.current.quaternion,
      );
      bulletPos.add(bulletDir.clone().multiplyScalar(4));

      socket.emit("shoot", {
        id: uuidv4(),
        position: bulletPos.toArray(),
        velocity: bulletDir.multiplyScalar(300).toArray(),
        type: 'normal'
      });
    }

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
        velocity: bulletDir.multiplyScalar(150).toArray(),
        type: 'missile'
      });
    }

    activeBullets.forEach((bullet, id) => {
      if (bullet.ownerId !== socket.id) {
        const dist = shipRef.current!.position.distanceTo(bullet.position);
        if (dist < 4.0) {
          const damageAmount = bullet.type === 'missile' ? 60 : 20;
          socket.emit("damage", { targetId: socket.id, attackerId: bullet.ownerId, amount: damageAmount, bulletId: id });
          activeBullets.delete(id);
        }
      } else {
        // Check if my bullet hits an NPC
        Object.keys(remoteData.current).forEach((playerId) => {
          const rData = remoteData.current[playerId];
          if (rData && rData.isNPC && !rData.isDead && rData.position) {
            const remotePos = new THREE.Vector3().fromArray(rData.position);
            const dist = remotePos.distanceTo(bullet.position);
            if (dist < 4.0) {
              const damageAmount = bullet.type === 'missile' ? 60 : 20;
              socket.emit("damage", { targetId: playerId, attackerId: socket.id, amount: damageAmount, bulletId: id });
              activeBullets.delete(id);
            }
          }
        });
      }
    });

    Object.keys(remoteData.current).forEach((playerId) => {
      if (playerId !== socket.id) {
        const rData = remoteData.current[playerId];
        if (!rData || !rData.position || rData.isDead) return;
        const remotePos = new THREE.Vector3().fromArray(rData.position);
        const dist = shipRef.current!.position.distanceTo(remotePos);
        if (dist < 4.0) {
          socket.emit("damage", { targetId: socket.id, attackerId: playerId, amount: 9999, bulletId: "player_collision" });
        }
      }
    });

    planetPositions.forEach((planet) => {
      const dist = shipRef.current!.position.distanceTo(planet.position);
      if (dist < planet.radius + 2) {
        socket.emit("damage", { targetId: socket.id, attackerId: socket.id, amount: 9999, bulletId: "planet" });
      }
    });

    const idealOffset = new THREE.Vector3(0, 5, 15);
    idealOffset.applyQuaternion(shipRef.current.quaternion);
    idealOffset.add(shipRef.current.position);

    const idealLookAt = new THREE.Vector3(0, 0, -20);
    idealLookAt.applyQuaternion(shipRef.current.quaternion);
    idealLookAt.add(shipRef.current.position);

    state.camera.position.lerp(idealOffset, 0.1);
    state.camera.lookAt(idealLookAt);

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

  return (
    <group ref={shipRef}>
      <group visible={!isDead}>
        <SpaceshipModel parts={parts} />
        <pointLight
          position={[0, 0, 5]}
          intensity={2}
          color="#dbeafe"
          distance={20}
        />
        <pointLight
          position={[0, 8, 0]}
          intensity={3}
          color="#f8fafc"
          distance={40}
        />
      </group>
    </group>
  );
}
