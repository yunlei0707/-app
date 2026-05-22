/**
 * 🧠 LRU Cache - 最近最少使用缓存
 */

class CacheItem {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.timestamp = Date.now();
    this.ttl = ttl;
  }

  isExpired() {
    if (this.ttl === null) return false;
    return Date.now() - this.timestamp > this.ttl;
  }
}

export class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || null;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (item.isExpired()) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value, ttl = null) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, new CacheItem(key, value, ttl || this.defaultTTL));
  }

  delete(key) {
    return this.cache.delete(key);
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.isExpired()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

export const globalCache = new LRUCache({ maxSize: 200, defaultTTL: 5 * 60 * 1000 });
export const mediaCache = new LRUCache({ maxSize: 500, defaultTTL: 30 * 60 * 1000 });
export const stateCache = new LRUCache({ maxSize: 100, defaultTTL: 60 * 1000 });

export default LRUCache;
