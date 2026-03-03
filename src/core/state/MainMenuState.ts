import { GameState } from "./GameState";
import { globalEventBus } from "../events/EventBus";

export class MainMenuState implements GameState {
  public name = "MainMenu";

  public enter(): void {
    console.log("[MainMenuState] Entered");
    globalEventBus.emit("UI_SHOW_MAIN_MENU");
  }

  public update(dt: number): void {
    // Menu logic if any (e.g., rotating background camera)
  }

  public exit(): void {
    console.log("[MainMenuState] Exited");
    globalEventBus.emit("UI_HIDE_MAIN_MENU");
  }
}
