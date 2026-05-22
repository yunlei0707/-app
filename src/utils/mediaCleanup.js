/**
 * P4阶段：媒体文件清理工具
 * 功能：清理孤儿文件（删除记录后未被引用的媒体文件）
 */

import { getAllMomentsForSync } from './db';
import { getCurrentV2Account } from "../repositories/stateRepository.js";

// ========== 清理配置 ==========
const CONFIG = {
  // 孤儿文件保留时间（24小时，给同步留时间）
  ORPHAN_GRACE_PERIOD: 24 * 60 * 60 * 1000,
  // 清理间隔（12小时检查一次）
  CLEANUP_INTERVAL: 12 * 60 * 60 * 1000,
};

// 清理计时器
let cleanupTimer = null;
let isCleaning = false;

/**
 * 收集所有被引用的媒体文件路径
 * @returns {Set<string>} 所有被引用的媒体文件路径集合
 */
async function collectAllReferencedMedia() {
  const referencedPaths = new Set();
  
  try {
    // 1. 从IndexedDB收集所有动态的媒体引用
    const allMoments = await getAllMomentsForSync();
    allMoments.forEach(moment => {
      // 收集photos
      if (moment.photos && Array.isArray(moment.photos)) {
        moment.photos.forEach(photo => {
          if (photo.path) referencedPaths.add(photo.path);
          if (photo.thumbnailPath) referencedPaths.add(photo.thumbnailPath);
        });
      }
      // 收集video
      if (moment.video?.path) referencedPaths.add(moment.video.path);
      if (moment.video?.thumbnailPath) referencedPaths.add(moment.video.thumbnailPath);
      // 收集voice
      if (moment.voice?.path) referencedPaths.add(moment.voice.path);
    });
    
    // 2. 从v2账号收集媒体引用
    const v2Account = getCurrentV2Account();
    if (v2Account && v2Account.accountData?.timeline) {
      v2Account.accountData.timeline.forEach(moment => {
        if (moment.photos && Array.isArray(moment.photos)) {
          moment.photos.forEach(photo => {
            if (photo.path) referencedPaths.add(photo.path);
            if (photo.thumbnailPath) referencedPaths.add(photo.thumbnailPath);
          });
        }
        if (moment.video?.path) referencedPaths.add(moment.video.path);
        if (moment.video?.thumbnailPath) referencedPaths.add(moment.video.thumbnailPath);
        if (moment.voice?.path) referencedPaths.add(moment.voice.path);
      });
    }
    
    console.log(`[MediaCleanup] 找到 ${referencedPaths.size} 个被引用的媒体文件`);
    
  } catch (e) {
    console.error('[MediaCleanup] 收集引用媒体失败:', e);
  }
  
  return referencedPaths;
}

/**
 * 获取所有本地存储的媒体文件
 * @returns {Array<{path: string, mtime: number}>} 媒体文件列表
 */
async function getAllLocalMediaFiles() {
  const mediaFiles = [];
  
  try {
    // 检查Capacitor Filesystem
    if (window.Capacitor?.Filesystem) {
      const { Filesystem, Directory } = window.Capacitor;
      
      // 遍历photos目录
      try {
        const photosResult = await Filesystem.readdir({
          path: 'photos',
          directory: Directory.Data,
        });
        photosResult.files.forEach(file => {
          mediaFiles.push({
            path: `photos/${file.name}`,
            mtime: file.mtime || Date.now(),
            name: file.name,
          });
        });
      } catch (e) {
        // 目录不存在是正常的
      }
      
      // 遍历videos目录
      try {
        const videosResult = await Filesystem.readdir({
          path: 'videos',
          directory: Directory.Data,
        });
        videosResult.files.forEach(file => {
          mediaFiles.push({
            path: `videos/${file.name}`,
            mtime: file.mtime || Date.now(),
            name: file.name,
          });
        });
      } catch (e) {
        // 目录不存在是正常的
      }
      
      // 遍历voice目录
      try {
        const voiceResult = await Filesystem.readdir({
          path: 'voice',
          directory: Directory.Data,
        });
        voiceResult.files.forEach(file => {
          mediaFiles.push({
            path: `voice/${file.name}`,
            mtime: file.mtime || Date.now(),
            name: file.name,
          });
        });
      } catch (e) {
        // 目录不存在是正常的
      }
    }
    
    console.log(`[MediaCleanup] 找到 ${mediaFiles.length} 个本地媒体文件`);
    
  } catch (e) {
    console.error('[MediaCleanup] 获取本地媒体文件失败:', e);
  }
  
  return mediaFiles;
}

/**
 * 删除孤儿文件
 * @param {Array<string>} orphanPaths - 孤儿文件路径列表
 * @returns {number} 成功删除的文件数量
 */
async function deleteOrphanFiles(orphanPaths) {
  let deletedCount = 0;
  
  try {
    if (window.Capacitor?.Filesystem) {
      const { Filesystem, Directory } = window.Capacitor;
      
      for (const path of orphanPaths) {
        try {
          await Filesystem.deleteFile({
            path: path,
            directory: Directory.Data,
          });
          deletedCount++;
          console.log(`[MediaCleanup] 已删除孤儿文件: ${path}`);
        } catch (e) {
          console.warn(`[MediaCleanup] 删除文件失败: ${path}`, e);
        }
      }
    }
  } catch (e) {
    console.error('[MediaCleanup] 删除孤儿文件失败:', e);
  }
  
  return deletedCount;
}

/**
 * 执行孤儿文件清理
 * @param {boolean} force - 是否强制执行（忽略保留期）
 * @returns {Object} 清理结果
 */
export async function runOrphanCleanup(force = false) {
  if (isCleaning) {
    console.log('[MediaCleanup] 清理正在进行中，跳过');
    return { success: false, reason: '清理进行中' };
  }
  
  isCleaning = true;
  
  try {
    console.log('[MediaCleanup] 开始执行孤儿文件清理');
    
    // 1. 收集所有被引用的媒体文件
    const referencedPaths = await collectAllReferencedMedia();
    
    // 2. 获取所有本地媒体文件
    const localFiles = await getAllLocalMediaFiles();
    
    // 3. 找出孤儿文件
    const now = Date.now();
    const orphanFiles = localFiles.filter(file => {
      // 检查是否被引用
      const isReferenced = referencedPaths.has(file.path);
      
      // 检查保留期（强制模式跳过）
      const isInGracePeriod = (now - file.mtime) < CONFIG.ORPHAN_GRACE_PERIOD;
      
      return !isReferenced && (force || !isInGracePeriod);
    });
    
    console.log(`[MediaCleanup] 发现 ${orphanFiles.length} 个孤儿文件待清理`);
    
    // 4. 删除孤儿文件
    const orphanPaths = orphanFiles.map(f => f.path);
    const deletedCount = await deleteOrphanFiles(orphanPaths);
    
    // 5. 保存最后清理时间
    localStorage.setItem('lastMediaCleanupTime', now.toString());
    
    const result = {
      success: true,
      totalFiles: localFiles.length,
      referencedFiles: referencedPaths.size,
      orphanFiles: orphanFiles.length,
      deletedFiles: deletedCount,
    };
    
    console.log('[MediaCleanup] 清理完成:', result);
    
    // 记录清理日志
    const cleanupLog = JSON.parse(localStorage.getItem('mediaCleanupLog') || '[]');
    cleanupLog.unshift({
      time: new Date().toISOString(),
      ...result,
    });
    localStorage.setItem('mediaCleanupLog', JSON.stringify(cleanupLog.slice(0, 20)));
    
    return result;
    
  } catch (e) {
    console.error('[MediaCleanup] 清理失败:', e);
    return { success: false, error: e.message };
    
  } finally {
    isCleaning = false;
  }
}

/**
 * 获取最后清理时间
 * @returns {Date|null} 最后清理时间
 */
export function getLastCleanupTime() {
  const timeStr = localStorage.getItem('lastMediaCleanupTime');
  return timeStr ? new Date(parseInt(timeStr)) : null;
}

/**
 * 获取清理日志
 * @returns {Array} 清理日志列表
 */
export function getCleanupLogs() {
  try {
    return JSON.parse(localStorage.getItem('mediaCleanupLog') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * 启动定期清理任务
 */
export function startPeriodicCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  
  // 启动时检查是否需要清理
  const lastCleanup = getLastCleanupTime();
  const now = Date.now();
  
  if (!lastCleanup || (now - lastCleanup.getTime()) > CONFIG.CLEANUP_INTERVAL) {
    console.log('[MediaCleanup] 距上次清理已超过12小时，执行清理');
    runOrphanCleanup().catch(e => console.error('[MediaCleanup] 定期清理失败:', e));
  }
  
  // 设置定期清理
  cleanupTimer = setInterval(() => {
    runOrphanCleanup().catch(e => console.error('[MediaCleanup] 定期清理失败:', e));
  }, CONFIG.CLEANUP_INTERVAL);
  
  console.log('[MediaCleanup] 定期清理已启动，间隔12小时');
}

/**
 * 停止定期清理任务
 */
export function stopPeriodicCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('[MediaCleanup] 定期清理已停止');
  }
}

// 默认导出
export default {
  runOrphanCleanup,
  startPeriodicCleanup,
  stopPeriodicCleanup,
  getLastCleanupTime,
  getCleanupLogs,
};
