import type { QueueEntry } from "../engine/matchmaking.js";

export class QueueManager {
  private queue: Map<string, QueueEntry> = new Map(); // clé : userId

  join(entry: QueueEntry): boolean {
    if (this.queue.has(entry.userId)) return false;
    this.queue.set(entry.userId, entry);
    return true;
  }

  leave(userId: string): boolean {
    return this.queue.delete(userId);
  }

  has(userId: string): boolean {
    return this.queue.has(userId);
  }

  list(): QueueEntry[] {
    return [...this.queue.values()];
  }

  removeMany(userIds: string[]): void {
    for (const userId of userIds) {
      this.queue.delete(userId);
    }
  }

  size(): number {
    return this.queue.size;
  }
}
