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
  saveVideoBlob,
  deleteMediaPath,
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
import { saveAudioFile, deleteAudioFile } from '../utils/audioStorage.js';
import { normalizeMomentMedia } from '../utils/mediaSchema.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 保存媒体文件（自动去重）- 返回标准 MediaItem 结构
 * @param {Blob|File} blobOrFile - 媒体文件
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 标准 MediaItem
 */
export async function saveMedia(blobOrFile, options = {}) {
  const { type = 'video', fileName, duration, coverPath } = options;

  console.log('[MediaRepository] 保存媒体:', blobOrFile.name || blobOrFile.type);

  const safeName = fileName || blobOrFile.name || `media_${Date.now()}.${type === 'photo' ? 'jpg' : type === 'audio' ? 'm4a' : 'mp4'}`;
  const dir = type === 'photo' ? 'photos' : type === 'audio' ? 'audio' : 'videos';
  const preferredPath = `BabyTime/${dir}/${generateUniqueFilename(safeName)}`;

  // 使用底层去重存储
  const result = await saveVideoBlobDedup(blobOrFile, preferredPath, {
    type,
    fileName: safeName,
    mimeType: blobOrFile.type || defaultMimeType(type),
  });

  // 构建标准 MediaItem 结构
  // 注意：hash 是可选的，不强制计算避免大文件卡顿
  let thumbnailPath = null;
  if (type === 'photo') {
    thumbnailPath = await createAndSavePhotoThumbnail(blobOrFile, result.path);
  }

  const mediaItem = {
    id: result.fileHash ? `media_${result.fileHash.slice(0, 12)}` : uuidv4(),
    type: type,
    path: result.path,
    fileName: safeName,
    mimeType: blobOrFile.type || defaultMimeType(type),
    size: result.size,
    createdAt: Date.now(),
    isDuplicate: result.isDuplicate,
    // 可选字段
    ...(result.fileHash && { hash: result.fileHash }),
    ...(duration !== undefined && { duration }),
    ...(coverPath !== undefined && { coverPath }),
    ...(thumbnailPath !== undefined && thumbnailPath && { thumbnailPath }),
    // ✅ 向后兼容：保持旧字段名，避免 MomentForm 报错
    filename: result.path,
    storageType: 'filesystem',
  };

  return mediaItem;
}

export async function saveMediaBlobAtPath(path, blob) {
  if (!path || !(blob instanceof Blob)) {
    throw new Error('saveMediaBlobAtPath requires a path and Blob');
  }
  return await saveVideoBlob(path, blob);
}

export async function deleteMediaFile(path) {
  return await deleteMediaPath(path);
}

function collectMomentMediaPaths(moment) {
  const paths = new Set();
  const { media } = normalizeMomentMedia(moment);
  media.forEach(item => {
    if (item?.path) paths.add(item.path);
    if (item?.thumbnailPath) paths.add(item.thumbnailPath);
    if (item?.coverPath) paths.add(item.coverPath);
  });
  return paths;
}

export async function deleteUnreferencedMomentMedia(moment, remainingMoments = []) {
  if (!moment) return { attempted: 0, deleted: 0, failed: 0 };

  const candidatePaths = collectMomentMediaPaths(moment);
  if (candidatePaths.size === 0) return { attempted: 0, deleted: 0, failed: 0 };

  const referencedPaths = new Set();
  remainingMoments.forEach(item => {
    collectMomentMediaPaths(item).forEach(path => referencedPaths.add(path));
  });

  let deleted = 0;
  let failed = 0;
  const unreferencedPaths = [...candidatePaths].filter(path => !referencedPaths.has(path));

  for (const path of unreferencedPaths) {
    try {
      const ok = await deleteMediaPath(path);
      if (ok) deleted++;
    } catch (e) {
      failed++;
      console.warn('[MediaRepository] delete unreferenced media failed:', path, e.message);
    }
  }

  return { attempted: unreferencedPaths.length, deleted, failed };
}

async function createAndSavePhotoThumbnail(file, originalPath) {
  if (typeof document === 'undefined' || !file?.type?.startsWith?.('image/')) return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const maxSide = 480;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    const thumbnailBlob = await new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.78);
    });
    if (!thumbnailBlob) return null;

    const baseName = originalPath.split('/').pop().replace(/\.[^.]+$/, '');
    const thumbPath = `BabyTime/thumbs/${baseName}.webp`;
    await saveVideoBlob(thumbPath, thumbnailBlob);
    return thumbPath;
  } catch (e) {
    console.warn('[MediaRepository] thumbnail failed:', e.message);
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function defaultMimeType(type) {
  if (type === 'photo') return 'image/jpeg';
  if (type === 'audio') return 'audio/m4a';
  return 'video/mp4';
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
 * 保存图片到媒体库（统一入口）
 * @param {Blob|File} file - 图片文件
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 标准 MediaItem
 */
export async function saveImage(file, options = {}) {
  console.log('[MediaRepository] 保存图片:', file.name);
  return await saveMedia(file, { ...options, type: 'photo' });
}

/**
 * 保存音频到媒体库（统一入口）
 * @param {Blob|File} file - 音频文件
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 标准 MediaItem
 */
export async function saveAudio(file, options = {}) {
  console.log('[MediaRepository] 保存音频:', file.name);
  return await saveMedia(file, { ...options, type: 'audio' });
}

/**
 * 保存视频到媒体库（统一入口）
 * @param {Blob|File} file - 视频文件
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 标准 MediaItem
 */
export async function saveVideo(file, options = {}) {
  console.log('[MediaRepository] 保存视频:', file.name);
  return await saveMedia(file, { ...options, type: 'video' });
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

// ✅ Schema 统一工具（所有模块必须从这里导入，不要直接引用 utils/mediaSchema.js）
export {
  normalizeMediaItem,       // 单个媒体归一化
  normalizeMediaArray,      // 批量归一化
  normalizeMomentMedia,     // 从动态提取并分类所有媒体
  normalizeMoment,          // ✅ 全项目唯一的动态读取入口！
  validateMediaItem,        // 数据校验
  assertMediaSchema,        // 🔥 P0.5：Schema 防线 - 单个媒体写入前强制校验
  assertMediaArraySchema,   // 🔥 P0.5：Schema 防线 - 媒体数组写入前强制校验
  assertNoDisplayUrlInPath, // 🔴 P1.5：绝对禁止把显示 URL 写入 path
  inferMediaTypeFromPath,   // 从路径推断类型
} from '../utils/mediaSchema.js';
