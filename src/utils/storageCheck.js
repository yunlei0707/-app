/**
 * 存储能力检测与最佳模式选择
 */

import { isOPFSSupported } from './opfs';

// ==================== 默认配置（如果不存在配置文件） ====================
const STORAGE_CONFIG = {
  USE_OPFS: true  // 默认开启OPFS
};

/**
 * 检测是否在原生APP环境
 */
export function isNativeAppEnvironment() {
  try {
    return window.Capacitor?.isNativePlatform?.() || false;
  } catch (e) {
    return false;
  }
}

/**
 * 检测当前环境的存储能力
 * @returns {Promise<{
 *   opfsSupported: boolean,
 *   indexedDBSupported: boolean,
 *   localStorageSupported: boolean,
 *   nativeApp: boolean,
 *   recommendedMode: 'opfs' | 'native' | 'base64'
 * }>}
 */
export async function checkStorageCapability() {
  const nativeApp = isNativeAppEnvironment();
  const opfsSupported = await isOPFSSupported();
  const indexedDBSupported = !!window.indexedDB;
  const localStorageSupported = !!window.localStorage;

  let recommendedMode = 'base64';
  if (nativeApp) {
    recommendedMode = 'native';
  } else if (opfsSupported) {
    recommendedMode = 'opfs';
  }

  return {
    opfsSupported,
    indexedDBSupported,
    localStorageSupported,
    nativeApp,
    recommendedMode,
  };
}

/**
 * 判断是否应该使用文件系统存储（原生或OPFS）
 * @returns {Promise<boolean>}
 */
export async function shouldUseFileStorage() {
  // 强制关闭
  if (STORAGE_CONFIG.USE_OPFS === false) {
    return false;
  }

  // APP原生环境始终使用文件系统
  if (isNativeAppEnvironment()) {
    return true;
  }

  // 强制开启（即使检测不通过，风险由用户承担）
  if (STORAGE_CONFIG.USE_OPFS === true) {
    return true;
  }

  // 自动检测
  const capability = await checkStorageCapability();
  return capability.opfsSupported;
}

/**
 * 获取存储统计信息
 * @param {Array} allMoments 所有动态数据
 * @returns {Promise<{
 *   totalVideos: number,
 *   opfsVideos: number,
 *   base64Videos: number,
 *   estimatedBase64Size: number,
 *   potentialSaving: number
 * }>}
 */
export async function getStorageStats(allMoments) {
  let totalVideos = 0;
  let opfsVideos = 0;
  let base64Videos = 0;
  let estimatedBase64Size = 0;

  for (const moment of allMoments) {
    if (moment.videos && Array.isArray(moment.videos)) {
      for (const video of moment.videos) {
        totalVideos++;
        // 有filename且不是base64格式 -> OPFS文件
        if (video.filename && !video.filename.startsWith('data:')) {
          opfsVideos++;
        } 
        // 有url且是base64格式，或者filename是base64格式
        else if ((video.url && video.url.startsWith('data:')) || 
                 (video.filename && video.filename.startsWith('data:'))) {
          base64Videos++;
          const base64Str = video.url || video.filename;
          const base64Length = base64Str.length;
          // base64编码大约增加33%的大小
          estimatedBase64Size += (base64Length * 3) / 4;
        }
        // 其他情况（如相对路径）也视为OPFS
        else if (video.url && !video.url.startsWith('data:')) {
          opfsVideos++;
        }
      }
    }
  }

  // 潜在节省空间：base64转成文件后大约减少33%的存储开销
  const potentialSaving = Math.floor(estimatedBase64Size * 0.33);

  return {
    totalVideos,
    opfsVideos,
    base64Videos,
    estimatedBase64Size,
    potentialSaving,
  };
}

/**
 * 格式化字节大小为可读格式
 * @param {number} bytes 字节数
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 向后兼容别名
export const shouldUseOPFS = shouldUseFileStorage;

export default {
  checkStorageCapability,
  shouldUseFileStorage,
  shouldUseOPFS,
  getStorageStats,
  formatBytes,
};
