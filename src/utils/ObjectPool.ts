export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;

  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize: number = 0) {
    this.createFn = createFn;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  public get(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this.resetFn(obj);
      return obj;
    }
    const newObj = this.createFn();
    this.resetFn(newObj);
    return newObj;
  }

  public release(obj: T): void {
    this.pool.push(obj);
  }

  public clear(): void {
    this.pool = [];
  }
}
