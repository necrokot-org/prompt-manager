export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  maxSize: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats;
  private readonly defaultTTL: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
    this.stats = {
      size: 0,
      hits: 0,
      misses: 0,
      maxSize: this.maxSize,
      ttl: this.defaultTTL,
    };
  }

  /**
   * Get a value from cache
   */
  public get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.size--;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  public set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.defaultTTL;

    // Remove expired entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.cleanupExpired();

      // If still full after cleanup, remove oldest entry
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
          this.stats.size--;
        }
      }
    }

    const wasNew = !this.cache.has(key);
    this.cache.set(key, {
      value,
      timestamp: now,
      ttl: entryTTL,
    });

    if (wasNew) {
      this.stats.size++;
    }
  }

  /**
   * Check if a key exists in cache
   */
  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove a specific key from cache
   */
  public delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.size--;
    }
    return existed;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit ratio
   */
  public getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  /**
   * Remove expired entries
   */
  public cleanupExpired(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    this.stats.size -= removedCount;
    return removedCount;
  }

  /**
   * Get all cache keys
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache is empty
   */
  public isEmpty(): boolean {
    return this.cache.size === 0;
  }

  /**
   * Update TTL for a specific key
   */
  public updateTTL(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      entry.ttl = ttl;
      entry.timestamp = Date.now(); // Reset timestamp
      return true;
    }
    return false;
  }

  /**
   * Get remaining TTL for a key
   */
  public getRemainingTTL(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) {
      return -1;
    }

    const elapsed = Date.now() - entry.timestamp;
    const remaining = entry.ttl - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Invalidate entries by pattern
   */
  public invalidateByPattern(pattern: string | RegExp): number {
    let removedCount = 0;
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    this.stats.size -= removedCount;
    return removedCount;
  }

  /**
   * Batch set multiple values
   */
  public batchSet(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Batch get multiple values
   */
  public batchGet(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>();

    for (const key of keys) {
      results.set(key, this.get(key));
    }

    return results;
  }
}
