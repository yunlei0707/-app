/**
 * OPFS (Origin Private File System) 核心操作
 * 视频文件的存储、读取、删除等功能
 */

import { STORAGE_CONFIG } from '../config/storage';

/**
 * 检测OPFS是否可用
 * @returns {Promise<boolean>}
 */
export async function isOPFSSupported() {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      return false;
    }
    // 尝试获取根目录，确认权限可用
    const root = await navigator.storage.getDirectory();
    return !!root;
  } catch (e) {
    if (STORAGE_CONFIG.DEBUG_MODE) {
      console.error('[OPFS] 检测失败:', e);
    }
    return false;
  }
}

/**
 * 生成唯一文件名
 * @param {string} originalName 原始文件名
 * @returns {string} UUID + 原始扩展名
 */
export function generateUniqueFilename(originalName) {
  const ext = originalName.split('.').pop() || 'mp4';
  const uuid = crypto.randomUUID();
  return `${uuid}.${ext}`;
}

/**
 * 保存视频到OPFS
 * @param {File} file 视频文件
 * @returns {Promise<{filename: string, size: number, type: string}>}
 */
export async function saveVideoToOPFS(file) {
  try {
    const root = await navigator.storage.getDirectory();
    const filename = generateUniqueFilename(file.name);
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    if (STORAGE_CONFIG.DEBUG_MODE) {
      console.log(`[OPFS] 视频已保存: ${filename}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      filename,
      size: file.size,
      type: file.type,
    };
  } catch (e) {
    console.error('[OPFS] 保存视频失败:', e);
    throw new Error('视频保存失败，请重试');
  }
}

/**
 * 从OPFS读取视频文件
 * @param {string} filename 文件名
 * @returns {Promise<File>}
 */
export async function readVideoFromOPFS(filename) {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename);
    const file = await fileHandle.getFile();

    if (STORAGE_CONFIG.DEBUG_MODE) {
      console.log(`[OPFS] 读取视频: ${filename}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    return file;
  } catch (e) {
    console.error(`[OPFS] 读取视频失败: ${filename}`, e);
    throw new Error('视频文件丢失或损坏');
  }
}

/**
 * 从OPFS删除视频文件
 * @param {string} filename 文件名
 * @returns {Promise<boolean>}
 */
export async function deleteVideoFromOPFS(filename) {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(filename);

    if (STORAGE_CONFIG.DEBUG_MODE) {
      console.log(`[OPFS] 视频已删除: ${filename}`);
    }

    return true;
  } catch (e) {
    console.warn(`[OPFS] 删除视频失败: ${filename}`, e);
    return false;
  }
}

/**
 * 获取OPFS中的所有视频文件列表
 * @returns {Promise<string[]>}
 */
export async function getAllVideoFilenames() {
  try {
    const root = await navigator.storage.getDirectory();
    const filenames = [];

    for await (const entry of root.values()) {
      if (entry.kind === 'file') {
        filenames.push(entry.name);
      }
    }

    return filenames;
  } catch (e) {
    console.error('[OPFS] 获取文件列表失败:', e);
    return [];
  }
}

/**
 * 清理孤儿文件：删除没有被任何动态引用的OPFS文件
 * @param {Array} allMoments 所有动态数据
 * @returns {Promise<number>} 清理的文件数量
 */
export async function cleanupOrphanFiles(allMoments) {
  try {
    // 收集所有被引用的文件名
    const usedFilenames = new Set();
    for (const moment of allMoments) {
      if (moment.videos && Array.isArray(moment.videos)) {
        for (const video of moment.videos) {
          if (video.filename) {
            usedFilenames.add(video.filename);
          }
        }
      }
    }

    // 获取OPFS中所有文件
    const allFiles = await getAllVideoFilenames();

    // 找出并删除孤儿文件
    let deletedCount = 0;
    for (const filename of allFiles) {
      if (!usedFilenames.has(filename)) {
        await deleteVideoFromOPFS(filename);
        deletedCount++;
      }
    }

    if (STORAGE_CONFIG.DEBUG_MODE && deletedCount > 0) {
      console.log(`[OPFS] 清理了 ${deletedCount} 个孤儿文件`);
    }

    return deletedCount;
  } catch (e) {
    console.error('[OPFS] 清理孤儿文件失败:', e);
    return 0;
  }
}

/**
 * 计算OPFS存储使用量
 * @returns {Promise<{totalSize: number, fileCount: number}>}
 */
export async function getOPFSUsage() {
  try {
    const filenames = await getAllVideoFilenames();
    let totalSize = 0;

    for (const filename of filenames) {
      try {
        const file = await readVideoFromOPFS(filename);
        totalSize += file.size;
      } catch (e) {
        // 单个文件读取失败不影响整体统计
      }
    }

    return {
      totalSize,
      fileCount: filenames.length,
    };
  } catch (e) {
    console.error('[OPFS] 获取存储使用量失败:', e);
    return { totalSize: 0, fileCount: 0 };
  }
}


/**
 * 通用：保存任意文件到OPFS
 * @param {File} file 文件对象
 * @returns {Promise<{filename: string, size: number, type: string}>}
 */
export async function saveFileToOPFS(file) {
  try {
    const root = await navigator.storage.getDirectory();
    const filename = generateUniqueFilename(file.name);
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    if (STORAGE_CONFIG.DEBUG_MODE) {
      console.log(`[OPFS] 文件已保存: ${filename}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      filename,
      size: file.size,
      type: file.type,
    };
  } catch (e) {
    console.error('[OPFS] 保存文件失败:', e);
    throw new Error('文件保存失败，请重试');
  }
}

/**
 * 保存照片到OPFS
 * @param {File} file 图片文件
 * @returns {Promise<{filename: string, size: number, type: string}>}
 */
export async function savePhotoToOPFS(file) {
  return saveFileToOPFS(file);
}

/**
 * 保存音频文件到OPFS
 * @param {File} file 音频文件
 * @returns {Promise<{filename: string, size: number, type: string}>}
 */
export async function saveAudioToOPFS(file) {
  return saveFileToOPFS(file);
}

/**
 * 从OPFS读取任意文件
 * @param {string} filename 文件名
 * @returns {Promise<File>}
 */
export async function readFileFromOPFS(filename) {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file;
  } catch (e) {
    console.error(`[OPFS] 读取文件失败: ${filename}`, e);
    throw e;
  }
}


/**
 * 获取文件的显示URL
 * @param {string|Object} photo 文件名或照片对象
 * @returns {Promise<string>} 可显示的URL
 */
export async function getFileDisplayURL(photo) {
  // 如果是字符串，直接返回（兼容旧数据）
  if (typeof photo === 'string') {
    return photo;
  }
  
  // 如果有url（Base64），直接返回
  if (photo.url) {
    return photo.url;
  }
  
  // 如果有filename（OPFS），从OPFS读取并转成URL
  if (photo.filename) {
    try {
      const file = await readFileFromOPFS(photo.filename);
      return URL.createObjectURL(file);
    } catch (e) {
      console.error('[OPFS] 获取文件显示URL失败:', e);
      return '';
    }
  }
  
  return '';
}
