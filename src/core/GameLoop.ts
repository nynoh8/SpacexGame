import { GameStateMachine } from "./state/GameStateMachine";

export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private stateMachine: GameStateMachine;

  constructor(stateMachine: GameStateMachine) {
    this.stateMachine = stateMachine;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    console.log("[GameLoop] Started.");
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log("[GameLoop] Stopped.");
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Calculate delta time in seconds (capped to avoid huge jumps if tab is inactive)
    let dt = (currentTime - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    
    this.lastTime = currentTime;

    // Update the game logic via the state machine
    this.stateMachine.update(dt);

    // Request next frame
    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
