export type EventCallback = (payload?: any) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public subscribe(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public unsubscribe(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  public emit(event: string, payload?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback(payload));
    }
  }
}

export const globalEventBus = new EventBus();
