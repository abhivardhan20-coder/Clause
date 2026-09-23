/** Per-document, in-memory LRU. Never shared between users or persisted. */
export class AnswerCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private capacity: number;
  private ttl: number;
  constructor(capacity = 20, ttl = 300_000) {
    if (!Number.isInteger(capacity) || capacity < 1 || ttl < 0)
      throw new Error("Invalid cache limits");
    this.capacity = capacity;
    this.ttl = ttl;
  }
  get(key: string, now = Date.now()): T | undefined {
    const item = this.entries.get(key);
    if (!item) return undefined;
    this.entries.delete(key);
    if (item.expires <= now) return undefined;
    this.entries.set(key, item);
    return item.value;
  }
  set(key: string, value: T, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: now + this.ttl });
    while (this.entries.size > this.capacity)
      this.entries.delete(this.entries.keys().next().value!);
  }
  clear(): void {
    this.entries.clear();
  }
}
