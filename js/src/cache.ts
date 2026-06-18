/** Minimal TTL cache. Single-process, in-memory; entries expire lazily on read. */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.store.set(key, { value, expires: this.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
