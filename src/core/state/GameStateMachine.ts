import { GameState } from "./GameState";
import { globalEventBus } from "../events/EventBus";

export class GameStateMachine {
  private states: Map<string, GameState> = new Map();
  private currentState: GameState | null = null;

  public addState(state: GameState): void {
    this.states.set(state.name, state);
  }

  public changeState(stateName: string): void {
    const newState = this.states.get(stateName);
    if (!newState) {
      console.error(`[GameStateMachine] State "${stateName}" not found.`);
      return;
    }

    if (this.currentState) {
      this.currentState.exit();
    }

    this.currentState = newState;
    this.currentState.enter();

    globalEventBus.emit("STATE_CHANGED", stateName);
  }

  public update(dt: number): void {
    if (this.currentState) {
      this.currentState.update(dt);
    }
  }

  public getCurrentState(): string | null {
    return this.currentState ? this.currentState.name : null;
  }
}
