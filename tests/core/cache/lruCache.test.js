/**
 * LRU Cache 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache } from '../../../src/core/cache/lruCache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({ maxSize: 3 });
  });

  describe('基础功能', () => {
    it('应该能设置和获取值', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('不存在的 key 返回 undefined', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('has 方法能正确判断 key 是否存在', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('delete 方法能删除值', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('clear 方法能清空缓存', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('size 属性返回正确大小', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU 淘汰机制', () => {
    it('超出 maxSize 时淘汰最久未使用的', () => {
      // maxSize = 3
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // 访问 key1，使其成为最近使用的
      cache.get('key1');

      // 添加 key4，应该淘汰 key2（最久未使用）
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false); // 被淘汰
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('更新已存在的 key 会更新使用顺序', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // 更新 key1，相当于访问了
      cache.set('key1', 'newValue1');

      // 添加 key4，应该淘汰 key2
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('newValue1');
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('TTL 过期机制', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('过期的 key get 时返回 undefined', () => {
      cache.set('key1', 'value1', 1000); // 1秒过期
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1500);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('过期的 key has 时返回 false', () => {
      cache.set('key1', 'value1', 1000);
      expect(cache.has('key1')).toBe(true);

      vi.advanceTimersByTime(1500);
      expect(cache.has('key1')).toBe(false);
    });

    it('没有设置 TTL 的值不会过期', () => {
      cache.set('key1', 'value1');
      
      vi.advanceTimersByTime(999999);
      expect(cache.get('key1')).toBe('value1');
    });

    it('使用 defaultTTL', () => {
      const cacheWithTTL = new LRUCache({ maxSize: 10, defaultTTL: 1000 });
      cacheWithTTL.set('key1', 'value1');
      expect(cacheWithTTL.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1500);
      expect(cacheWithTTL.get('key1')).toBeUndefined();
    });
  });

  describe('边界情况', () => {
    it('maxSize = 1 时正常工作', () => {
      const smallCache = new LRUCache({ maxSize: 1 });
      smallCache.set('key1', 'value1');
      expect(smallCache.get('key1')).toBe('value1');

      smallCache.set('key2', 'value2');
      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.get('key2')).toBe('value2');
    });

    it('支持 null 和 false 作为 value', () => {
      cache = new LRUCache({ maxSize: 4 });
      cache.set('key1', null);
      cache.set('key2', false);
      cache.set('key3', 0);
      cache.set('key4', '');

      expect(cache.get('key1')).toBe(null);
      expect(cache.get('key2')).toBe(false);
      expect(cache.get('key3')).toBe(0);
      expect(cache.get('key4')).toBe('');
    });

    it('支持对象作为 value', () => {
      const obj = { name: 'test', data: [1, 2, 3] };
      cache.set('key1', obj);
      expect(cache.get('key1')).toEqual(obj);
    });
  });
});
