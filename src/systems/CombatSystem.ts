import * as THREE from 'three';
import { System } from '../core/ecs/World';
import { TransformComponent, PhysicsComponent, InputComponent, ProjectileComponent, HealthComponent, createTransform, createPhysics, createProjectile } from '../components/ecs/Components';
import { globalEventBus } from '../core/events/EventBus';

export class CombatSystem extends System {
  private fireCooldowns: Map<number, number> = new Map();
  private fireRate = 0.2; // seconds between shots
  private projectileSpeed = 200;

  public update(dt: number): void {
    if (!this.world) return;

    // Handle firing
    const shooters = this.world.getEntitiesWithComponents(['Transform', 'Input']);
    for (const entity of shooters) {
      const input = this.world.getComponent<InputComponent>(entity, 'Input')!;
      
      // Update cooldown
      let cooldown = this.fireCooldowns.get(entity) || 0;
      if (cooldown > 0) {
        cooldown -= dt;
        this.fireCooldowns.set(entity, cooldown);
      }

      if (input.firePrimary && cooldown <= 0) {
        this.fireProjectile(entity);
        this.fireCooldowns.set(entity, this.fireRate);
      }
    }

    // Handle projectiles
    const projectiles = this.world.getEntitiesWithComponents(['Transform', 'Physics', 'Projectile']);
    const targets = this.world.getEntitiesWithComponents(['Transform', 'Health']);

    for (const projectile of projectiles) {
      const projComp = this.world.getComponent<ProjectileComponent>(projectile, 'Projectile');
      const projTransform = this.world.getComponent<TransformComponent>(projectile, 'Transform');
      
      if (!projComp || !projTransform) continue;

      projComp.lifeTime += dt;
      if (projComp.lifeTime >= projComp.maxLifeTime) {
        this.world.destroyEntity(projectile);
        continue;
      }

      // Simple collision detection (sphere check)
      for (const target of targets) {
        if (target === projComp.ownerId) continue; // Don't hit self

        const targetTransform = this.world.getComponent<TransformComponent>(target, 'Transform');
        const health = this.world.getComponent<HealthComponent>(target, 'Health');

        if (!targetTransform || !health || health.isDead) continue;

        const distance = projTransform.position.distanceTo(targetTransform.position);
        if (distance < 5) { // Assuming ship radius is ~5
          // Hit!
          health.currentHealth -= projComp.damage;
          if (health.currentHealth <= 0) {
            health.currentHealth = 0;
            health.isDead = true;
            globalEventBus.emit('ENTITY_DESTROYED', target);
            // We could destroy the entity here, but maybe we want a death animation state
            // For now, just destroy it
            this.world.destroyEntity(target);
          }
          
          // Destroy projectile
          this.world.destroyEntity(projectile);
          break; // Projectile is destroyed, stop checking targets
        }
      }
    }
  }

  private fireProjectile(ownerId: number) {
    if (!this.world) return;

    const ownerTransform = this.world.getComponent<TransformComponent>(ownerId, 'Transform')!;
    const ownerPhysics = this.world.getComponent<PhysicsComponent>(ownerId, 'Physics');

    const projectile = this.world.createEntity();
    
    // Spawn slightly ahead of the ship
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ownerTransform.rotation);
    const spawnPos = ownerTransform.position.clone().add(forward.clone().multiplyScalar(5));

    this.world.addComponent(projectile, 'Transform', createTransform(spawnPos, ownerTransform.rotation.clone()));
    
    const physics = createPhysics(0.1, 1, 1); // No drag for projectiles
    // Add owner's velocity to projectile velocity
    const baseVel = ownerPhysics ? ownerPhysics.velocity : new THREE.Vector3();
    physics.velocity.copy(baseVel).add(forward.multiplyScalar(this.projectileSpeed));
    this.world.addComponent(projectile, 'Physics', physics);
    
    this.world.addComponent(projectile, 'Projectile', createProjectile(ownerId, 20, 3));
  }
}
