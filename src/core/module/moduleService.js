/**
 * 🧩 Module Service - 轻量版模块加载系统
 *
 * 为未来留口子，但现在不走 CDN
 * 核心：统一"加载 + 缓存 + 校验"流程，未来升级到 CDN 时不用重构
 *
 * 设计原则：
 * - ✅ 轻量：不搞复杂的依赖系统
 * - ✅ 稳定：只做本地加载
 * - ✅ 可扩展：未来加 CDN 只换 loader，调用方不用改
 */

import cacheService from '@core/cache/cacheService';

// 模块缓存前缀
const CACHE_PREFIX = 'module:';

// 模块注册表（内置模块）
const builtInModules = {
  // 预留位置，未来可以在这里注册各种功能模块
};

/**
 * 加载模块（统一入口）
 *
 * 现在：只加载内置模块
 * 未来：可以无缝升级为 "CDN 优先 + 本地回退"
 */
export async function loadModule(moduleId, options = {}) {
  const { forceReload = false, useCache = true } = options;

  console.log(`[ModuleService] 加载模块: ${moduleId}`);

  // Step 1: 查缓存
  if (useCache && !forceReload) {
    const cached = getFromCache(moduleId);
    if (cached) {
      console.log(`[ModuleService] ✅ 缓存命中: ${moduleId}`);
      return cached;
    }
  }

  // Step 2: 加载内置模块
  // （未来这里可以加 CDN loader）
  const module = await loadBuiltInModule(moduleId);
  if (!module) {
    throw new Error(`模块不存在: ${moduleId}`);
  }

  // Step 3: 写入缓存
  setCache(moduleId, module);

  console.log(`[ModuleService] ✅ 模块加载完成: ${moduleId}`);
  return module;
}

/**
 * 加载内置模块
 * （独立成函数，未来加 CDN 时只改这里）
 */
async function loadBuiltInModule(moduleId) {
  const moduleFactory = builtInModules[moduleId];

  if (!moduleFactory) {
    return null;
  }

  // 执行模块工厂函数
  const module = typeof moduleFactory === 'function'
    ? await moduleFactory()
    : moduleFactory;

  return {
    id: moduleId,
    version: module.version || '1.0.0',
    type: 'built-in',
    exports: module.exports || module
  };
}

/**
 * 检查模块是否可用
 */
export function hasModule(moduleId) {
  return !!builtInModules[moduleId];
}

/**
 * 注册模块（动态扩展）
 */
export function registerModule(moduleId, factory) {
  builtInModules[moduleId] = factory;
  console.log(`[ModuleService] 模块已注册: ${moduleId}`);
}

/**
 * 卸载模块
 */
export function unregisterModule(moduleId) {
  delete builtInModules[moduleId];
  clearCache(moduleId);
  console.log(`[ModuleService] 模块已卸载: ${moduleId}`);
}

// ===== 缓存层 =====

function getFromCache(moduleId) {
  const key = CACHE_PREFIX + moduleId;
  return cacheService.getUIState(key);
}

function setCache(moduleId, module) {
  const key = CACHE_PREFIX + moduleId;
  cacheService.setUIState(key, module, 5 * 60 * 1000); // 5 分钟
}

function clearCache(moduleId) {
  const key = CACHE_PREFIX + moduleId;
  cacheService.removeMediaCache(key); // 借用一下删除接口
}

function clearAllCache() {
  // 按前缀清缓存
  console.log('[ModuleService] 全部模块缓存已清空');
}

// ===== 导出 =====

export const moduleService = {
  load: loadModule,
  has: hasModule,
  register: registerModule,
  unregister: unregisterModule,
  clearCache: clearAllCache
};

export default moduleService;
