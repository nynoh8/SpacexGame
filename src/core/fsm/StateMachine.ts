export interface State<T> {
  name: string;
  enter(entity: T): void;
  update(entity: T, dt: number): void;
  exit(entity: T): void;
}

export class StateMachine<T> {
  private states: Map<string, State<T>> = new Map();
  private currentState: State<T> | null = null;
  private entity: T;

  constructor(entity: T) {
    this.entity = entity;
  }

  public addState(state: State<T>): void {
    this.states.set(state.name, state);
  }

  public changeState(name: string): void {
    const nextState = this.states.get(name);
    if (!nextState) {
      console.warn(`State ${name} not found`);
      return;
    }

    if (this.currentState) {
      this.currentState.exit(this.entity);
    }

    this.currentState = nextState;
    this.currentState.enter(this.entity);
  }

  public update(dt: number): void {
    if (this.currentState) {
      this.currentState.update(this.entity, dt);
    }
  }

  public getCurrentState(): string | null {
    return this.currentState ? this.currentState.name : null;
  }
}
