import { GameState } from "./GameState";
import { globalEventBus } from "../events/EventBus";
import { World } from "../ecs/World";
import { MovementSystem } from "../../systems/MovementSystem";
import { InputSystem } from "../../systems/InputSystem";
import { AISystem } from "../../systems/AISystem";
import { createTransform, createPhysics, createInput, createPlayer, createAI, createNPC, createHealth } from "../../components/ecs/Components";
import * as THREE from 'three';
import { CombatSystem } from "../../systems/CombatSystem";

export class PlayingState implements GameState {
  public name = "Playing";
  public world: World;
  private inputSystem: InputSystem;

  constructor() {
    this.world = new World();
    this.inputSystem = new InputSystem();
    this.world.addSystem(this.inputSystem);
    this.world.addSystem(new AISystem());
    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new CombatSystem());
  }

  public enter(): void {
    console.log("[PlayingState] Entered");
    globalEventBus.emit("UI_SHOW_HUD");

    // Initialize player entity
    const playerEntity = this.world.createEntity();
    this.world.addComponent(playerEntity, "Transform", createTransform(new THREE.Vector3(0, 0, 0)));
    this.world.addComponent(playerEntity, "Physics", createPhysics());
    this.world.addComponent(playerEntity, "Input", createInput());
    this.world.addComponent(playerEntity, "Player", createPlayer("local"));
    this.world.addComponent(playerEntity, "Health", createHealth(100));

    globalEventBus.emit("PLAYER_SPAWNED", playerEntity);

    // Spawn some NPCs for training
    for (let i = 0; i < 3; i++) {
      const npcEntity = this.world.createEntity();
      const randomPos = new THREE.Vector3(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 200 - 100
      );
      this.world.addComponent(npcEntity, "Transform", createTransform(randomPos));
      this.world.addComponent(npcEntity, "Physics", createPhysics());
      this.world.addComponent(npcEntity, "Input", createInput());
      this.world.addComponent(npcEntity, "AI", createAI(randomPos, 150, 300, 100));
      this.world.addComponent(npcEntity, "NPC", createNPC("drone"));
      this.world.addComponent(npcEntity, "Health", createHealth(50));
    }
  }

  public update(dt: number): void {
    this.world.update(dt);
  }

  public exit(): void {
    console.log("[PlayingState] Exited");
    globalEventBus.emit("UI_HIDE_HUD");
    this.inputSystem.cleanup();
    this.world.clear();
  }
}
