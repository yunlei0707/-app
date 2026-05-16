/**
 * 存储能力检测与最佳模式选择
 */

import { STORAGE_CONFIG } from '../config/storage';
import { isOPFSSupported } from './opfs';

/**
 * 检测当前环境的存储能力
 * @returns {Promise<{
 *   opfsSupported: boolean,
 *   indexedDBSupported: boolean,
 *   localStorageSupported: boolean,
 *   recommendedMode: 'opfs' | 'base64'
 * }>}
 */
export async function checkStorageCapability() {
  const opfsSupported = await isOPFSSupported();
  const indexedDBSupported = !!window.indexedDB;
  const localStorageSupported = !!window.localStorage;

  let recommendedMode = 'base64';
  if (opfsSupported) {
    recommendedMode = 'opfs';
  }

  return {
    opfsSupported,
    indexedDBSupported,
    localStorageSupported,
    recommendedMode,
  };
}

/**
 * 判断是否应该使用OPFS存储
 * 考虑配置开关和实际兼容性
 * @returns {Promise<boolean>}
 */
export async function shouldUseOPFS() {
  // 强制关闭
  if (STORAGE_CONFIG.USE_OPFS === false) {
    return false;
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
        if (video.filename) {
          opfsVideos++;
        } else if (video.url) {
          base64Videos++;
          // base64编码大约增加33%的大小
          // base64字符串大小估算
          const base64Length = video.url.length;
          estimatedBase64Size += (base64Length * 3) / 4;
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

export default {
  checkStorageCapability,
  shouldUseOPFS,
  getStorageStats,
  formatBytes,
};
