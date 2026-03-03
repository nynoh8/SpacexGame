import { System } from '../core/ecs/World';
import { InputComponent } from '../components/ecs/Components';
import { touchState } from '../components/MobileControls';

export class InputSystem extends System {
  private keys: { [key: string]: boolean } = {};

  constructor() {
    super();
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  public update(dt: number): void {
    if (!this.world) return;

    const entities = this.world.getEntitiesWithComponents(['Input', 'Player']);

    for (const entity of entities) {
      const input = this.world.getComponent<InputComponent>(entity, 'Input')!;

      // Reset inputs
      input.pitch = 0;
      input.yaw = 0;
      input.roll = 0;
      input.thrust = 0;

      // Thrust (W/S or Mobile)
      if (this.keys['KeyW'] || touchState.thrust) input.thrust = 1;
      if (this.keys['KeyS'] || touchState.brake) input.thrust = -0.5; // Reverse thrust

      // Pitch (Up/Down arrows or I/K or Mobile)
      if (this.keys['ArrowUp'] || touchState.pitchUp) input.pitch = 1;
      if (this.keys['ArrowDown'] || touchState.pitchDown) input.pitch = -1;

      // Yaw (A/D or Mobile)
      if (this.keys['KeyA'] || touchState.yawLeft) input.yaw = 1;
      if (this.keys['KeyD'] || touchState.yawRight) input.yaw = -1;

      // Roll (Q/E or Mobile)
      if (this.keys['KeyQ'] || touchState.rollLeft) input.roll = 1;
      if (this.keys['KeyE'] || touchState.rollRight) input.roll = -1;

      // Fire
      input.firePrimary = this.keys['Space'] || touchState.shoot || false;
    }
  }

  public cleanup(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
