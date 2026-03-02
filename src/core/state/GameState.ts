export interface GameState {
  name: string;
  enter(): void;
  update(dt: number): void;
  exit(): void;
}
