/**
 * 性能监控与优化工具
 * ✅ 性能监控 + 降级策略
 */

// ==================== 内存缓存系统（LRU）====================
const CACHE_MAX_SIZE = 100;
const cache = new Map();

/**
 * 获取缓存
 */
export function getCache(key) {
  const item = cache.get(key);
  if (item) {
    // 更新访问时间
    item.lastAccess = Date.now();
    return item.value;
  }
  return null;
}

/**
 * 设置缓存
 */
export function setCache(key, value) {
  if (cache.size >= CACHE_MAX_SIZE) {
    // 删除最久未使用的
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of cache.entries()) {
      if (v.lastAccess < oldestTime) {
        oldestTime = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  cache.set(key, {
    value,
    lastAccess: Date.now(),
    createdAt: Date.now(),
  });
}

/**
 * 清除缓存
 */
export function clearCache() {
  cache.clear();
}

// ==================== 性能监控 ====================
const metrics = {
  pageLoadTime: 0,
  firstPaint: 0,
  firstContentfulPaint: 0,
  apiCalls: [],
  renderTimes: [],
};

/**
 * 开始计时
 */
export function startMeasure(name) {
  performance.mark(`${name}-start`);
}

/**
 * 结束计时并记录
 */
export function endMeasure(name) {
  performance.mark(`${name}-end`);
  const measure = performance.measure(name, `${name}-start`, `${name}-end`);
  
  if (name.includes('api') || name.includes('db')) {
    metrics.apiCalls.push({ name, duration: measure.duration, time: Date.now() });
  } else if (name.includes('render')) {
    metrics.renderTimes.push({ name, duration: measure.duration, time: Date.now() });
  }
  
  // 清理
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);
  
  return measure.duration;
}

// ==================== 设备检测与降级策略 ====================

/**
 * 获取设备性能等级
 * @returns {'high' | 'medium' | 'low'}
 */
export function getDeviceLevel() {
  // 检测内存
  const memory = navigator.deviceMemory || 4;
  // 检测CPU核心数
  const cores = navigator.hardwareConcurrency || 4;
  // 检测是否是移动设备
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  let level = 'high';
  
  if (memory <= 2 || cores <= 4 || isMobile) {
    level = 'low';
  } else if (memory <= 4 || cores <= 6) {
    level = 'medium';
  }
  
  return level;
}

/**
 * 获取当前设备的性能配置
 */
export function getPerformanceConfig() {
  const level = getDeviceLevel();
  
  return {
    level,
    // 是否启用动画
    animations: level !== 'low',
    // 是否启用虚拟时光功能
    virtualTime: level !== 'low',
    // 默认加载的动态数量
    defaultLoadCount: level === 'low' ? 10 : 20,
    // 是否预加载图片
    preloadImages: level === 'high',
    // 是否启用模糊背景等视觉效果
    advancedEffects: level === 'high',
  };
}

/**
 * 检测页面是否卡顿
 */
export function detectJank() {
  return new Promise((resolve) => {
    const start = performance.now();
    requestAnimationFrame(() => {
      const duration = performance.now() - start;
      // 超过16ms（60fps）就算卡顿
      resolve(duration > 16);
    });
  });
}

// ==================== 防抖节流 ====================

/**
 * 防抖
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流
 */
export function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

// ==================== 性能日志 ====================

/**
 * 打印性能统计
 */
export function printPerformanceStats() {
  const avgApiTime = metrics.apiCalls.length > 0
    ? metrics.apiCalls.reduce((sum, m) => sum + m.duration, 0) / metrics.apiCalls.length
    : 0;
  
  const avgRenderTime = metrics.renderTimes.length > 0
    ? metrics.renderTimes.reduce((sum, m) => sum + m.duration, 0) / metrics.renderTimes.length
    : 0;
  
  console.log('%c📊 性能统计', 'font-weight: bold; font-size: 14px;');
  console.log(`   设备等级: ${getDeviceLevel()}`);
  console.log(`   API平均耗时: ${avgApiTime.toFixed(2)}ms (${metrics.apiCalls.length}次)`);
  console.log(`   渲染平均耗时: ${avgRenderTime.toFixed(2)}ms (${metrics.renderTimes.length}次)`);
  console.log(`   缓存命中率: ${cache.size}项`);
}

// 开发环境下10秒打印一次性能统计
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    printPerformanceStats();
  }, 10000);
}

export default {
  getCache,
  setCache,
  clearCache,
  startMeasure,
  endMeasure,
  getDeviceLevel,
  getPerformanceConfig,
  debounce,
  throttle,
  printPerformanceStats,
};
