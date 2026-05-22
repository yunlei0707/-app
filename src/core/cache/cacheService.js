/**
 * 📦 Cache Service - 统一缓存服务
 *
 * 封装 LRU Cache，提供类型化的缓存接口
 * 所有缓存必须走这里，禁止各组件自己搞缓存
 *
 * ✅ 验收标准：同一个媒体文件第二次读取 < 10ms
 */

import { globalCache, mediaCache, stateCache } from './lruCache';

// ===== 缓存键命名空间 =====
const CACHE_KEYS = {
  MEDIA_BLOB: 'media:blob:',
  MEDIA_THUMBNAIL: 'media:thumb:',
  DB_BABY: 'db:baby:',
  DB_MOMENT: 'db:moment:',
  DB_CAPSULE: 'db:capsule:',
  UI: 'ui:',
  STATS: 'compute:stats:'
};

// ===== 媒体缓存（核心：< 10ms 命中）=====

export async function withMediaCache(filePath, readFn) {
  const startTime = performance.now();
  const key = CACHE_KEYS.MEDIA_BLOB + filePath;

  // 先查缓存
  const cached = mediaCache.get(key);
  if (cached) {
    const elapsed = Math.round(performance.now() - startTime);
    console.debug(`[CacheService] ✅ 媒体缓存命中: ${filePath}, 耗时: ${elapsed}ms`);
    return cached;
  }

  // 未命中，执行读取
  console.debug(`[CacheService] 媒体缓存未命中: ${filePath}`);
  const result = await readFn();

  // 写入缓存
  mediaCache.set(key, result, 10 * 60 * 1000); // 10 分钟

  const elapsed = Math.round(performance.now() - startTime);
  console.debug(`[CacheService] 媒体读取完成: ${elapsed}ms`);

  return result;
}

export function removeMediaCache(filePath) {
  mediaCache.delete(CACHE_KEYS.MEDIA_BLOB + filePath);
}

export function clearMediaCache() {
  mediaCache.clear();
  console.log('[CacheService] 媒体缓存已清空');
}

// ===== DB 查询缓存 =====

export async function withDBCache(cacheKey, queryFn, ttl = 30000) {
  const key = 'db:' + cacheKey;

  const cached = globalCache.get(key);
  if (cached !== undefined) {
    console.debug(`[CacheService] DB 查询缓存命中: ${cacheKey}`);
    return cached;
  }

  const result = await queryFn();
  globalCache.set(key, result, ttl);
  return result;
}

export function invalidateDBCache(prefix = '') {
  if (prefix) {
    globalCache.deleteByPrefix('db:' + prefix);
  } else {
    globalCache.deleteByPrefix('db:');
  }
  console.log(`[CacheService] DB 缓存已失效: ${prefix || '全部'}`);
}

// ===== 统计 =====

export function getCacheStats() {
  return {
    global: globalCache.getStats(),
    media: mediaCache.getStats(),
    state: stateCache.getStats()
  };
}

export const cacheService = {
  withMediaCache,
  removeMediaCache,
  clearMediaCache,
  withDBCache,
  invalidateDBCache,
  getStats: getCacheStats
};

export default cacheService;
