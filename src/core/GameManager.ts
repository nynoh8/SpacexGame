import { GameLoop } from "./GameLoop";
import { GameStateMachine } from "./state/GameStateMachine";
import { globalEventBus } from "./events/EventBus";
import { MainMenuState } from "./state/MainMenuState";
import { PlayingState } from "./state/PlayingState";

export class GameManager {
  public loop: GameLoop;
  public stateMachine: GameStateMachine;

  constructor() {
    this.stateMachine = new GameStateMachine();
    this.loop = new GameLoop(this.stateMachine);
    
    // Listen for global events
    globalEventBus.subscribe("GAME_START", () => this.loop.start());
    globalEventBus.subscribe("GAME_STOP", () => this.loop.stop());
  }

  public init(): void {
    console.log("[GameManager] Initialized.");
    this.stateMachine.addState(new MainMenuState());
    this.stateMachine.addState(new PlayingState());
    
    // Start the game loop and enter the main menu
    this.loop.start();
    this.stateMachine.changeState("MainMenu");
  }
}

export const globalGameManager = new GameManager();
