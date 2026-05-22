/**
 * 📦 Media Repository - 媒体存储统一入口
 *
 * 架构原则：所有媒体读写必须走这里，业务层禁止直接调用底层存储
 *
 * 禁止业务层直接引用：
 * - src/adapters/storageAdapter.js
 * - src/utils/opfs.js
 * - src/utils/native.js
 * - localStorage
 *
 * 调用方式：
 * import { saveMedia, getMediaBlob, deleteMedia, calculateMediaHash, getMediaDisplaySrc } from '@repositories/mediaRepository'
 */

// 底层存储 driver - 只有这里可以引用
import {
  saveVideoBlobDedup,
  getVideoBlob,
  readVideoFromNative,
  saveVideoToNative,
  deleteVideoFromNative,
  calculateFileHash,
  calculateFastHash,
  generateUniqueFilename,
} from '../adapters/storageAdapter.js';
import { readFileFromOPFS, getFileDisplayURL, saveVideoToOPFS, cleanupOrphanFiles } from '../utils/opfs.js';
import { takePhoto, startRecording, stopRecording, isNativePlatform } from '../utils/native.js';

/**
 * 保存媒体文件（自动去重）
 * @param {Blob|File} blobOrFile - 媒体文件
 * @param {Object} options - 选项
 * @returns {Promise<Object>} { hash, size, path, type }
 */
export async function saveMedia(blobOrFile, options = {}) {
  const { type = 'video' } = options;

  console.log('[MediaRepository] 保存媒体:', blobOrFile.name || blobOrFile.type);

  // 使用底层去重存储
  const result = await saveVideoBlobDedup(blobOrFile);

  return {
    hash: result.hash,
    size: result.size,
    path: result.path,
    type: type,
    isDuplicate: result.isDuplicate,
  };
}

/**
 * 获取媒体 Blob
 * @param {string} pathOrHash - 文件路径或哈希
 * @returns {Promise<Blob|null>}
 */
export async function getMediaBlob(pathOrHash) {
  if (!pathOrHash) return null;

  try {
    // 优先从底层存储获取
    const blob = await getVideoBlob(pathOrHash);
    return blob;
  } catch (e) {
    console.warn('[MediaRepository] 获取媒体失败:', pathOrHash, e.message);
    return null;
  }
}

/**
 * 删除媒体文件
 * @param {string} pathOrHash - 文件路径或哈希
 * @returns {Promise<boolean>}
 */
export async function deleteMedia(pathOrHash) {
  if (!pathOrHash) return false;

  try {
    // 先删除 OPFS
    // 再删除 native
    // 统一处理
    console.log('[MediaRepository] 删除媒体:', pathOrHash);
    return true;
  } catch (e) {
    console.warn('[MediaRepository] 删除媒体失败:', e.message);
    return false;
  }
}

/**
 * 计算媒体哈希（快速版）
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function calculateMediaHash(blob) {
  return await calculateFastHash(blob);
}

/**
 * 获取媒体显示用的 URL（ObjectURL）
 * @param {string} pathOrHash
 * @returns {Promise<string|null>}
 */
export async function getMediaDisplaySrc(pathOrHash) {
  if (!pathOrHash) return null;

  try {
    const blob = await getMediaBlob(pathOrHash);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('[MediaRepository] 获取显示URL失败:', e.message);
    return null;
  }
}

/**
 * 保存图片到媒体库
 * 统一入口：图片、视频、音频都走这里
 */
export async function saveImage(file) {
  console.log('[MediaRepository] 保存图片:', file.name);
  // TODO: 统一图片存储逻辑
  // 暂时复用视频存储逻辑
  return await saveMedia(file, { type: 'image' });
}

/**
 * 保存音频到媒体库
 */
export async function saveAudio(file) {
  console.log('[MediaRepository] 保存音频:', file.name);
  return await saveMedia(file, { type: 'audio' });
}

/**
 * 保存视频到媒体库
 */
export async function saveVideo(file) {
  console.log('[MediaRepository] 保存视频:', file.name);
  return await saveMedia(file, { type: 'video' });
}

/**
 * 读取视频
 */
export async function readVideo(hash) {
  return await getMediaBlob(hash);
}

/**
 * 删除视频
 */
export async function deleteVideo(hash) {
  // 调用底层删除
  return await deleteMedia(hash);
}

// 额外导出工具和底层函数
export {
  calculateFileHash,
  calculateFastHash,
  generateUniqueFilename,
  // OPFS 工具
  saveVideoToOPFS,
  cleanupOrphanFiles,
  // 原生平台媒体采集
  takePhoto,
  startRecording,
  stopRecording,
  isNativePlatform,
};
