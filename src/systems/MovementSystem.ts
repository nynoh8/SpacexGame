import * as THREE from 'three';
import { System } from '../core/ecs/World';
import { TransformComponent, PhysicsComponent, InputComponent } from '../components/ecs/Components';

export class MovementSystem extends System {
  private thrustForce = 50;
  private turnSpeed = 2;

  public update(dt: number): void {
    if (!this.world) return;

    const entities = this.world.getEntitiesWithComponents(['Transform', 'Physics', 'Input']);

    for (const entity of entities) {
      const transform = this.world.getComponent<TransformComponent>(entity, 'Transform')!;
      const physics = this.world.getComponent<PhysicsComponent>(entity, 'Physics')!;
      const input = this.world.getComponent<InputComponent>(entity, 'Input')!;

      // 1. Calculate Forward Direction based on current rotation
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.rotation);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(transform.rotation);

      // 2. Apply Thrust (Linear Force)
      if (input.thrust > 0) {
        const force = forward.clone().multiplyScalar(this.thrustForce * input.thrust * dt);
        physics.velocity.add(force.divideScalar(physics.mass));
      }

      // 3. Apply Rotation (Angular Velocity based on Pitch, Yaw, Roll)
      // Pitch (X axis local)
      if (input.pitch !== 0) {
        physics.angularVelocity.add(right.clone().multiplyScalar(input.pitch * this.turnSpeed * dt));
      }
      // Yaw (Y axis local)
      if (input.yaw !== 0) {
        physics.angularVelocity.add(up.clone().multiplyScalar(input.yaw * this.turnSpeed * dt));
      }
      // Roll (Z axis local)
      if (input.roll !== 0) {
        physics.angularVelocity.add(forward.clone().multiplyScalar(input.roll * this.turnSpeed * dt));
      }

      // 4. Apply Drag (Inertia)
      physics.velocity.multiplyScalar(physics.drag);
      physics.angularVelocity.multiplyScalar(physics.angularDrag);

      // 5. Update Position
      transform.position.add(physics.velocity.clone().multiplyScalar(dt));

      // 6. Update Rotation
      if (physics.angularVelocity.lengthSq() > 0.0001) {
        const axis = physics.angularVelocity.clone().normalize();
        const angle = physics.angularVelocity.length() * dt;
        const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        transform.rotation.multiplyQuaternions(deltaQuat, transform.rotation);
        transform.rotation.normalize();
      } else {
        physics.angularVelocity.set(0, 0, 0);
      }
    }
  }
}
