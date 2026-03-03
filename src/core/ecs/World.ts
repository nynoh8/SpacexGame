export type Entity = number;

export interface Component {
  [key: string]: any;
}

export abstract class System {
  public world: World | null = null;
  abstract update(dt: number): void;
}

export class World {
  private nextEntityId: Entity = 0;
  private entities: Set<Entity> = new Set();
  private components: Map<string, Map<Entity, Component>> = new Map();
  private systems: System[] = [];

  public createEntity(): Entity {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  public destroyEntity(entity: Entity): void {
    this.entities.delete(entity);
    for (const componentMap of this.components.values()) {
      componentMap.delete(entity);
    }
  }

  public addComponent<T extends Component>(entity: Entity, componentName: string, component: T): void {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName)!.set(entity, component);
  }

  public removeComponent(entity: Entity, componentName: string): void {
    if (this.components.has(componentName)) {
      this.components.get(componentName)!.delete(entity);
    }
  }

  public getComponent<T extends Component>(entity: Entity, componentName: string): T | undefined {
    const componentMap = this.components.get(componentName);
    if (componentMap) {
      return componentMap.get(entity) as T;
    }
    return undefined;
  }

  public hasComponent(entity: Entity, componentName: string): boolean {
    const componentMap = this.components.get(componentName);
    return componentMap ? componentMap.has(entity) : false;
  }

  public getEntitiesWithComponents(componentNames: string[]): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities) {
      let hasAll = true;
      for (const name of componentNames) {
        if (!this.hasComponent(entity, name)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        result.push(entity);
      }
    }
    return result;
  }

  public addSystem(system: System): void {
    system.world = this;
    this.systems.push(system);
  }

  public update(dt: number): void {
    for (const system of this.systems) {
      system.update(dt);
    }
  }

  public clear(): void {
    this.entities.clear();
    this.components.clear();
    this.nextEntityId = 0;
  }
}
