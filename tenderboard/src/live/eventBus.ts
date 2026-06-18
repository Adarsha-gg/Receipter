import type { LiveRunEvent } from './types.js';

type Listener = (event: LiveRunEvent) => void;

export class RunEventBus {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(runId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(runId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(runId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(runId);
      }
    };
  }

  publish(runId: string, event: LiveRunEvent): void {
    for (const listener of this.listeners.get(runId) ?? []) {
      listener(event);
    }
  }

  listenerCount(runId: string): number {
    return this.listeners.get(runId)?.size ?? 0;
  }
}

export function formatSseEvent(event: LiveRunEvent): string {
  return `event: update\ndata: ${JSON.stringify(event)}\n\n`;
}
