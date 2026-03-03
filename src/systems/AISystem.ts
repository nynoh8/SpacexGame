import * as THREE from 'three';
import { System } from '../core/ecs/World';
import { AIComponent, TransformComponent, InputComponent } from '../components/ecs/Components';
import { StateMachine, State } from '../core/fsm/StateMachine';

// Define the context for our AI states
interface AIContext {
  entity: number;
  world: any; // The ECS World
}

// --- AI States ---

class PatrolState implements State<AIContext> {
  public name = 'Patrol';
  private targetPoint = new THREE.Vector3();

  public enter(context: AIContext): void {
    this.pickNewTarget(context);
  }

  public update(context: AIContext, dt: number): void {
    const { entity, world } = context;
    const transform = world.getComponent(entity, 'Transform') as TransformComponent;
    const input = world.getComponent(entity, 'Input') as InputComponent;
    const ai = world.getComponent(entity, 'AI') as AIComponent;

    if (!transform || !input || !ai) return;

    // Check for player
    const players = world.getEntitiesWithComponents(['Player', 'Transform']);
    if (players.length > 0) {
      const playerTransform = world.getComponent(players[0], 'Transform') as TransformComponent;
      const dist = transform.position.distanceTo(playerTransform.position);
      if (dist < ai.detectionRadius) {
        ai.targetEntity = players[0];
        ai.stateMachine.changeState('Chase');
        return;
      }
    }

    // Move towards target point
    const distToTarget = transform.position.distanceTo(this.targetPoint);
    if (distToTarget < 10) {
      this.pickNewTarget(context);
    }

    steerTowards(transform, input, this.targetPoint, dt);
    input.thrust = 0.5; // Cruise speed
  }

  public exit(context: AIContext): void {}

  private pickNewTarget(context: AIContext) {
    const ai = context.world.getComponent(context.entity, 'AI') as AIComponent;
    if (!ai) return;

    // Random point within patrol radius
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI * 2;
    const r = Math.random() * ai.patrolRadius;

    this.targetPoint.set(
      ai.patrolCenter.x + r * Math.sin(angle1) * Math.cos(angle2),
      ai.patrolCenter.y + r * Math.sin(angle1) * Math.sin(angle2),
      ai.patrolCenter.z + r * Math.cos(angle1)
    );
  }
}

class ChaseState implements State<AIContext> {
  public name = 'Chase';

  public enter(context: AIContext): void {}

  public update(context: AIContext, dt: number): void {
    const { entity, world } = context;
    const transform = world.getComponent(entity, 'Transform') as TransformComponent;
    const input = world.getComponent(entity, 'Input') as InputComponent;
    const ai = world.getComponent(entity, 'AI') as AIComponent;

    if (!transform || !input || !ai || ai.targetEntity === null) {
      ai?.stateMachine.changeState('Patrol');
      return;
    }

    const targetTransform = world.getComponent(ai.targetEntity, 'Transform') as TransformComponent;
    if (!targetTransform) {
      ai.targetEntity = null;
      ai.stateMachine.changeState('Patrol');
      return;
    }

    const dist = transform.position.distanceTo(targetTransform.position);

    if (dist > ai.detectionRadius * 1.5) {
      // Lost target
      ai.targetEntity = null;
      ai.stateMachine.changeState('Patrol');
      return;
    }

    if (dist < ai.attackRadius) {
      ai.stateMachine.changeState('Attack');
      return;
    }

    steerTowards(transform, input, targetTransform.position, dt);
    input.thrust = 1.0; // Max speed
  }

  public exit(context: AIContext): void {}
}

class AttackState implements State<AIContext> {
  public name = 'Attack';

  public enter(context: AIContext): void {}

  public update(context: AIContext, dt: number): void {
    const { entity, world } = context;
    const transform = world.getComponent(entity, 'Transform') as TransformComponent;
    const input = world.getComponent(entity, 'Input') as InputComponent;
    const ai = world.getComponent(entity, 'AI') as AIComponent;

    if (!transform || !input || !ai || ai.targetEntity === null) {
      ai?.stateMachine.changeState('Patrol');
      return;
    }

    const targetTransform = world.getComponent(ai.targetEntity, 'Transform') as TransformComponent;
    if (!targetTransform) {
      ai.targetEntity = null;
      ai.stateMachine.changeState('Patrol');
      return;
    }

    const dist = transform.position.distanceTo(targetTransform.position);

    if (dist > ai.attackRadius * 1.2) {
      ai.stateMachine.changeState('Chase');
      input.firePrimary = false;
      return;
    }

    steerTowards(transform, input, targetTransform.position, dt);
    
    // Slow down when close
    input.thrust = dist < ai.attackRadius * 0.5 ? 0.2 : 0.8;
    
    // Fire if facing target
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
    const toTarget = targetTransform.position.clone().sub(transform.position).normalize();
    const dot = forward.dot(toTarget);

    input.firePrimary = dot > 0.95; // roughly within 18 degrees
  }

  public exit(context: AIContext): void {
    const ai = context.world.getComponent(context.entity, 'AI') as AIComponent;
    if (ai) {
      const input = context.world.getComponent(context.entity, 'Input') as InputComponent;
      if (input) input.firePrimary = false;
    }
  }
}

// Helper function to steer a ship towards a target point
function steerTowards(transform: TransformComponent, input: InputComponent, target: THREE.Vector3, dt: number) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(transform.rotation);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.rotation);

  const toTarget = target.clone().sub(transform.position).normalize();

  // Calculate pitch and yaw needed
  const pitchDot = up.dot(toTarget);
  const yawDot = right.dot(toTarget);

  input.pitch = pitchDot > 0.1 ? 1 : pitchDot < -0.1 ? -1 : 0;
  input.yaw = yawDot > 0.1 ? -1 : yawDot < -0.1 ? 1 : 0;
  
  // Auto-roll to stay upright relative to world Y (optional, but looks better)
  const worldUp = new THREE.Vector3(0, 1, 0);
  const rollDot = right.dot(worldUp);
  input.roll = rollDot > 0.1 ? 1 : rollDot < -0.1 ? -1 : 0;
}

// --- AI System ---

export class AISystem extends System {
  public update(dt: number): void {
    if (!this.world) return;

    const entities = this.world.getEntitiesWithComponents(['AI', 'Transform', 'Input']);

    for (const entity of entities) {
      const ai = this.world.getComponent<AIComponent>(entity, 'AI')!;

      // Initialize FSM if not present
      if (!ai.stateMachine) {
        const context: AIContext = { entity, world: this.world };
        ai.stateMachine = new StateMachine<AIContext>(context);
        ai.stateMachine.addState(new PatrolState());
        ai.stateMachine.addState(new ChaseState());
        ai.stateMachine.addState(new AttackState());
        ai.stateMachine.changeState('Patrol');
      }

      // Update FSM
      ai.stateMachine.update(dt);
    }
  }
}
