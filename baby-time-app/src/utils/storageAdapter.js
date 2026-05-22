/**
 * 存储适配器 - 自动选择最佳存储方式
 * APP环境用原生文件系统（更快、更稳定）
 * 网页环境降级到OPFS
 */

import { STORAGE_CONFIG } from '../config/storage';

// 检测是否在Capacitor APP环境
export function isAppEnvironment() {
  return !!window.Capacitor;
}

// 生成唯一文件名（复用现有逻辑）
export function generateUniqueFilename(originalName) {
  const ext = originalName.split('.').pop() || 'mp4';
  const uuid = crypto.randomUUID();
  return `${uuid}.${ext}`;
}

// ====== 方案一：APP原生文件系统存储 ======

/**
 * 保存视频到APP原生文件系统
 * @param {File} file 视频文件
 * @param {Function} onProgress 进度回调 (percent, speedMBs)
 */
export async function saveVideoToNative(file, onProgress = null) {
  try {
    console.log('[StorageAdapter] 使用原生文件系统保存视频');
    const filename = generateUniqueFilename(file.name);
    const totalSize = file.size;
    const startTime = Date.now();

    // 转成Base64（Capacitor Filesystem要求）
    const base64 = await fileToBase64(file, (percent) => {
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const writtenBytes = (percent / 100) * totalSize;
        const speedMBs = (writtenBytes / 1024 / 1024 / elapsed).toFixed(1);
        onProgress(percent, speedMBs);
      }
    });

    // 写入APP文件系统
    const capacitorModule = '@capacitor/filesystem';
    const { Filesystem, Directory } = await import(capacitorModule);
    
    const writeStart = Date.now();
    await Filesystem.writeFile({
      path: `BabyTime/videos/${filename}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    const totalTime = (Date.now() - startTime) / 1000;
    const avgSpeed = (totalSize / 1024 / 1024 / totalTime).toFixed(1);

    console.log(`[StorageAdapter] 视频保存成功: ${filename}, 大小: ${(totalSize/1024/1024).toFixed(2)}MB, 平均速度: ${avgSpeed} MB/s`);

    return {
      filename,
      size: file.size,
      type: file.type,
      storageType: 'native',
      avgSpeed: parseFloat(avgSpeed),
    };

  } catch (e) {
    console.error('[StorageAdapter] 原生文件系统保存失败:', e);
    throw new Error(`视频保存失败: ${e.message}`);
  }
}

/**
 * 从APP原生文件系统读取视频
 */
export async function readVideoFromNative(filename) {
  try {
    const capacitorModule = '@capacitor/filesystem';
    const { Filesystem, Directory } = await import(capacitorModule);
    
    const result = await Filesystem.readFile({
      path: `BabyTime/videos/${filename}`,
      directory: Directory.Documents,
    });

    // base64转Blob
    const response = await fetch(`data:video/mp4;base64,${result.data}`);
    return await response.blob();

  } catch (e) {
    console.error('[StorageAdapter] 读取视频失败:', filename, e);
    throw new Error('视频文件丢失或损坏');
  }
}

/**
 * 从APP原生文件系统删除视频
 */
export async function deleteVideoFromNative(filename) {
  try {
    const capacitorModule = '@capacitor/filesystem';
    const { Filesystem, Directory } = await import(capacitorModule);
    
    await Filesystem.deleteFile({
      path: `BabyTime/videos/${filename}`,
      directory: Directory.Documents,
    });

    console.log('[StorageAdapter] 视频已删除:', filename);
    return true;

  } catch (e) {
    console.error('[StorageAdapter] 删除视频失败:', filename, e);
    return false;
  }
}

// ====== 统一存储入口 ======

/**
 * 智能选择存储方式保存视频
 */
export async function saveVideo(file, onProgress = null) {
  if (isAppEnvironment()) {
    return saveVideoToNative(file, onProgress);
  } else {
    // 网页环境：导入原有的OPFS实现
    const { saveVideoToOPFS } = await import('./opfs');
    return saveVideoToOPFS(file);
  }
}

/**
 * 保存照片到APP原生文件系统
 * @param {File} file 照片文件
 */
export async function savePhotoToNative(file) {
  try {
    console.log('[StorageAdapter] 使用原生文件系统保存照片');
    const filename = generateUniqueFilename(file.name);

    // 转成Base64（Capacitor Filesystem要求）
    const base64 = await fileToBase64(file);

    // 写入APP文件系统
    const capacitorModule = '@capacitor/filesystem';
    const { Filesystem, Directory } = await import(capacitorModule);
    
    await Filesystem.writeFile({
      path: `BabyTime/photos/${filename}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    console.log(`[StorageAdapter] 照片保存成功: ${filename}, 大小: ${(file.size/1024/1024).toFixed(2)}MB`);

    return {
      filename,
      name: file.name,
      size: file.size,
      type: file.type,
      storageType: 'native',
    };

  } catch (e) {
    console.error('[StorageAdapter] 原生文件系统保存照片失败:', e);
    throw new Error(`照片保存失败: ${e.message}`);
  }
}

/**
 * 智能保存照片
 */
export async function savePhoto(file) {
  if (isAppEnvironment()) {
    return savePhotoToNative(file);
  } else {
    // 网页环境：导入原有的OPFS实现
    const { savePhotoToOPFS } = await import('./opfs');
    return savePhotoToOPFS(file);
  }
}

/**
 * 从APP原生文件系统读取照片
 */
export async function readPhotoFromNative(filename) {
  try {
    const capacitorModule = '@capacitor/filesystem';
    const { Filesystem, Directory } = await import(capacitorModule);
    
    const result = await Filesystem.readFile({
      path: `BabyTime/photos/${filename}`,
      directory: Directory.Documents,
    });

    // base64转Blob
    const response = await fetch(`data:image/jpeg;base64,${result.data}`);
    return await response.blob();

  } catch (e) {
    console.error('[StorageAdapter] 读取照片失败:', filename, e);
    throw new Error('照片文件丢失或损坏');
  }
}

/**
 * 智能读取媒体文件（视频/音频/照片）
 * 统一入口：自动识别文件类型，支持原生文件系统和OPFS
 */
export async function getVideoBlob(filename, storageType = null) {
  // 路径清洗：移除URL前缀
  if (filename && typeof filename === 'string') {
    filename = filename
      .replace(/^https?:\/\/localhost\/_capacitor_file_/, '')
      .replace(/^files:\/\//, '')
      .replace(/^file:\/\//, '')
      .replace(/^content:\/\//, '');
  }
  
  // 根据storageType决定读取方式
  if (storageType === 'native' || isAppEnvironment()) {
    try {
      // 优先尝试 videos 目录
      return await readVideoFromNative(filename);
    } catch (e1) {
      // 失败后尝试 photos 目录
      try {
        return await readPhotoFromNative(filename);
      } catch (e2) {
        console.log('[StorageAdapter] 原生读取失败，降级尝试OPFS');
      }
    }
  }
  
  // OPFS 方式
  try {
    const { readVideoFromOPFS } = await import('./opfs');
    return await readVideoFromOPFS(filename);
  } catch (e) {
    console.error('[StorageAdapter] 所有读取方式都失败:', filename);
    throw new Error('文件读取失败：' + filename);
  }
}

/**
 * 智能读取视频
 */
export async function readVideo(filename, storageType = null) {
  // 根据storageType决定读取方式
  if (storageType === 'native' || isAppEnvironment()) {
    try {
      return await readVideoFromNative(filename);
    } catch (e) {
      // 原生读取失败，降级尝试OPFS
      console.log('[StorageAdapter] 原生读取失败，降级尝试OPFS');
    }
  }
  
  // 降级到OPFS
  const { readVideoFromOPFS } = await import('./opfs');
  return readVideoFromOPFS(filename);
}

/**
 * 智能删除视频
 */
export async function deleteVideo(filename, storageType = null) {
  if (storageType === 'native' || isAppEnvironment()) {
    try {
      return await deleteVideoFromNative(filename);
    } catch (e) {
      console.log('[StorageAdapter] 原生删除失败，降级尝试OPFS');
    }
  }
  
  // 降级到OPFS
  const { deleteVideoFromOPFS } = await import('./opfs');
  return deleteVideoFromOPFS(filename);
}

// ====== 工具函数 ======

/**
 * File转Base64，带进度
 */
function fileToBase64(file, onProgress = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      // 去掉 data:xxx;base64, 前缀
      const base64 = reader.result.split(',')[1];
      if (onProgress) onProgress(100);
      resolve(base64);
    };
    
    reader.onerror = reject;
    
    // 模拟进度（FileReader没有原生进度事件）
    if (onProgress) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 95) {
          clearInterval(interval);
          progress = 95;
        }
        onProgress(Math.min(progress, 95));
      }, 100);
      
      reader.onloadend = () => {
        clearInterval(interval);
      };
    }
    
    reader.readAsDataURL(file);
  });
}

// ====== 方案三：进度估算工具 ======

/**
 * 导入进度计算器
 * 计算实时速度和剩余时间
 */
export class ImportProgressCalculator {
  constructor(totalFiles = 0) {
    this.startTime = Date.now();
    this.totalFiles = totalFiles;
    this.completedFiles = 0;
    this.totalBytes = 0;
    this.completedBytes = 0;
    this.lastUpdateTime = this.startTime;
    this.lastUpdateBytes = 0;
  }

  /**
   * 更新单个文件进度
   * @param {number} fileSize 文件大小（字节）
   * @param {number} percent 完成百分比（0-100）
   */
  updateFileProgress(fileSize, percent) {
    const now = Date.now();
    const elapsedSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
    
    // 只在至少过了500ms后才更新速度，避免抖动
    if (elapsedSinceLastUpdate > 0.5) {
      const bytesSinceLastUpdate = (fileSize * percent / 100) - this.lastUpdateBytes;
      this.lastUpdateTime = now;
      this.lastUpdateBytes = fileSize * percent / 100;
    }
    
    this.completedBytes = fileSize * percent / 100;
  }

  /**
   * 标记文件完成
   */
  markFileComplete(fileSize) {
    this.completedFiles++;
    this.completedBytes = fileSize;
    this.totalBytes += fileSize;
  }

  /**
   * 获取当前进度信息
   */
  getStats(currentFilename = '') {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const avgSpeedMBs = elapsed > 0 ? (this.totalBytes / 1024 / 1024 / elapsed) : 0;
    
    // 估算剩余时间
    let remainingSeconds = 0;
    if (avgSpeedMBs > 0 && this.completedFiles < this.totalFiles) {
      const avgFileSize = this.totalBytes / Math.max(this.completedFiles, 1);
      const remainingFiles = this.totalFiles - this.completedFiles;
      const remainingBytes = remainingFiles * avgFileSize;
      remainingSeconds = Math.round(remainingBytes / 1024 / 1024 / avgSpeedMBs);
    }

    return {
      completedFiles: this.completedFiles,
      totalFiles: this.totalFiles,
      currentFilename,
      elapsedSeconds: Math.round(elapsed),
      avgSpeedMBs: avgSpeedMBs.toFixed(1),
      remainingSeconds,
      totalMB: (this.totalBytes / 1024 / 1024).toFixed(1),
      progressPercent: Math.round((this.completedFiles / Math.max(this.totalFiles, 1)) * 100),
    };
  }

  /**
   * 格式化显示文本
   */
  formatMessage(currentFilename = '') {
    const stats = this.getStats(currentFilename);
    
    let message = `视频导入中: ${stats.completedFiles}/${stats.totalFiles}`;
    
    if (currentFilename) {
      message += `\n当前: ${currentFilename}`;
    }
    
    if (parseFloat(stats.avgSpeedMBs) > 0) {
      message += `\n速度: ${stats.avgSpeedMBs} MB/s | 已用时: ${stats.elapsedSeconds}秒`;
      
      if (stats.remainingSeconds > 0) {
        // 格式化剩余时间
        if (stats.remainingSeconds < 60) {
          message += ` | 预计剩余: ~${stats.remainingSeconds}秒`;
        } else {
          const minutes = Math.floor(stats.remainingSeconds / 60);
          const seconds = stats.remainingSeconds % 60;
          message += ` | 预计剩余: ~${minutes}分${seconds}秒`;
        }
      }
    }
    
    return message;
  }
}

export default {
  isAppEnvironment,
  saveVideo,
  readVideo,
  deleteVideo,
  saveVideoToNative,
  readVideoFromNative,
  deleteVideoFromNative,
  ImportProgressCalculator,
};
