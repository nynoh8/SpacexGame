import * as THREE from 'three';
import { Component } from '../../core/ecs/World';

export interface TransformComponent extends Component {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
}

export const createTransform = (
  position = new THREE.Vector3(),
  rotation = new THREE.Quaternion(),
  scale = new THREE.Vector3(1, 1, 1)
): TransformComponent => ({
  position,
  rotation,
  scale,
});

export interface PhysicsComponent extends Component {
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  mass: number;
  drag: number;
  angularDrag: number;
}

export const createPhysics = (
  mass = 1,
  drag = 0.98,
  angularDrag = 0.95
): PhysicsComponent => ({
  velocity: new THREE.Vector3(),
  angularVelocity: new THREE.Vector3(),
  mass,
  drag,
  angularDrag,
});

export interface InputComponent extends Component {
  pitch: number; // -1 to 1
  yaw: number;   // -1 to 1
  roll: number;  // -1 to 1
  thrust: number; // 0 to 1
  firePrimary: boolean;
  fireSecondary: boolean;
}

export const createInput = (): InputComponent => ({
  pitch: 0,
  yaw: 0,
  roll: 0,
  thrust: 0,
  firePrimary: false,
  fireSecondary: false,
});

export interface HealthComponent extends Component {
  maxHealth: number;
  currentHealth: number;
  isDead: boolean;
}

export const createHealth = (maxHealth = 100): HealthComponent => ({
  maxHealth,
  currentHealth: maxHealth,
  isDead: false,
});

export interface PlayerComponent extends Component {
  id: string;
}

export const createPlayer = (id: string): PlayerComponent => ({
  id,
});

export interface AIComponent extends Component {
  targetEntity: number | null;
  stateMachine: any; // We'll type this properly later or just use any for now
  patrolCenter: THREE.Vector3;
  patrolRadius: number;
  detectionRadius: number;
  attackRadius: number;
}

export const createAI = (
  patrolCenter = new THREE.Vector3(),
  patrolRadius = 100,
  detectionRadius = 200,
  attackRadius = 50
): AIComponent => ({
  targetEntity: null,
  stateMachine: null,
  patrolCenter,
  patrolRadius,
  detectionRadius,
  attackRadius,
});

export interface NPCComponent extends Component {
  type: string;
}

export const createNPC = (type = 'enemy'): NPCComponent => ({
  type,
});

export interface ProjectileComponent extends Component {
  ownerId: number;
  damage: number;
  lifeTime: number;
  maxLifeTime: number;
}

export const createProjectile = (
  ownerId: number,
  damage = 10,
  maxLifeTime = 2
): ProjectileComponent => ({
  ownerId,
  damage,
  lifeTime: 0,
  maxLifeTime,
});
