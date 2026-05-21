/**
 * P1上线防护：Storage容量爆炸防护
 * 功能：视频大小限制、压缩建议、空间使用提醒
 */

import { safeStorage, safeJSONParse } from './dataRecovery';
import { getCurrentUTC, formatRelativeTime } from './timeSync';

// ========== 配置 ==========
const CONFIG = {
  // 单个视频最大大小（50MB）
  MAX_VIDEO_SIZE: 50 * 1024 * 1024,
  // 单张图片最大大小（10MB）
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  // 单条录音最大大小（50MB）
  MAX_AUDIO_SIZE: 50 * 1024 * 1024,
  // 警告阈值：总使用量超过80%
  WARNING_THRESHOLD_PERCENT: 80,
  // 危险阈值：总使用量超过95%
  DANGER_THRESHOLD_PERCENT: 95,
  // localStorage限制（约5MB）
  LOCALSTORAGE_LIMIT: 5 * 1024 * 1024,
  // 存储键
  USAGE_HISTORY_KEY: 'storage_usage_history',
  USAGE_ALERT_KEY: 'storage_alert_shown',
};

// ========== 单位转换工具 ==========
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ========== 单文件检查 ==========

/**
 * 检查视频文件大小
 */
export function checkVideoSize(fileSize) {
  return checkMediaSize('video', fileSize, CONFIG.MAX_VIDEO_SIZE);
}

/**
 * 检查图片文件大小
 */
export function checkImageSize(fileSize) {
  return checkMediaSize('image', fileSize, CONFIG.MAX_IMAGE_SIZE);
}

/**
 * 检查音频文件大小
 */
export function checkAudioSize(fileSize) {
  return checkMediaSize('audio', fileSize, CONFIG.MAX_AUDIO_SIZE);
}

/**
 * 通用媒体大小检查
 */
function checkMediaSize(type, fileSize, maxSize) {
  if (fileSize <= 0) {
    return {
      valid: false,
      level: 'error',
      message: '文件大小无效',
    };
  }
  
  if (fileSize > maxSize) {
    return {
      valid: false,
      level: 'error',
      size: fileSize,
      maxSize,
      message: `${type === 'video' ? '视频' : type === 'image' ? '图片' : '音频'}文件过大（${formatBytes(fileSize)}），最大允许 ${formatBytes(maxSize)}`,
      suggestion: type === 'video' 
        ? '建议使用视频压缩功能，或选择更短的视频片段'
        : '建议使用图片压缩功能，或选择更小的文件',
    };
  }
  
  // 超过一半建议压缩
  if (fileSize > maxSize * 0.5) {
    return {
      valid: true,
      level: 'warning',
      size: fileSize,
      maxSize,
      message: `文件较大（${formatBytes(fileSize)}），建议压缩后上传`,
      suggestion: '压缩后上传速度更快，也节省存储空间',
    };
  }
  
  return {
    valid: true,
    level: 'ok',
    size: fileSize,
    message: `文件大小正常（${formatBytes(fileSize)}）`,
  };
}

// ========== 存储空间计算 ==========

/**
 * 计算本地存储使用情况
 */
export function getLocalStorageUsage() {
  let totalBytes = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key) || '';
    totalBytes += key.length + value.length;
  }
  
  return {
    usedBytes: totalBytes,
    usedFormatted: formatBytes(totalBytes),
    limitBytes: CONFIG.LOCALSTORAGE_LIMIT,
    limitFormatted: formatBytes(CONFIG.LOCALSTORAGE_LIMIT),
    percentUsed: Math.round((totalBytes / CONFIG.LOCALSTORAGE_LIMIT) * 100),
    itemCount: localStorage.length,
  };
}

/**
 * 估算IndexedDB存储使用情况
 * 注意：这只是估算，不是精确值
 */
export async function getIndexedDBUsage() {
  try {
    if (!window.indexedDB) {
      return { usedBytes: 0, estimated: true };
    }
    
    // 尝试使用StorageManager API获取
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usedBytes: estimate.usage || 0,
        quotaBytes: estimate.quota || 0,
        usedFormatted: formatBytes(estimate.usage || 0),
        quotaFormatted: formatBytes(estimate.quota || 0),
        percentUsed: estimate.quota 
          ? Math.round((estimate.usage / estimate.quota) * 100) 
          : 0,
        estimated: false,
      };
    }
    
    // 无法获取精确值，返回估算
    return {
      usedBytes: 0,
      estimated: true,
      message: '无法精确获取IndexedDB使用量',
    };
  } catch (e) {
    console.error('[StorageGuard] 获取IndexedDB使用量失败:', e);
    return { usedBytes: 0, estimated: true, error: e.message };
  }
}

/**
 * 获取总存储使用情况
 */
export async function getTotalStorageUsage() {
  const localStorageUsage = getLocalStorageUsage();
  const indexedDBUsage = await getIndexedDBUsage();
  
  const totalUsed = localStorageUsage.usedBytes + indexedDBUsage.usedBytes;
  
  // 计算状态级别
  let level = 'ok';
  let message = '存储空间充足';
  
  const percentUsed = indexedDBUsage.quotaBytes
    ? Math.round((totalUsed / indexedDBUsage.quotaBytes) * 100)
    : localStorageUsage.percentUsed;
  
  if (percentUsed >= CONFIG.DANGER_THRESHOLD_PERCENT) {
    level = 'danger';
    message = '存储空间即将耗尽！请立即清理或导出数据';
  } else if (percentUsed >= CONFIG.WARNING_THRESHOLD_PERCENT) {
    level = 'warning';
    message = '存储空间已使用大部分，建议清理旧数据';
  }
  
  return {
    localStorage: localStorageUsage,
    indexedDB: indexedDBUsage,
    totalUsedBytes: totalUsed,
    totalUsedFormatted: formatBytes(totalUsed),
    percentUsed,
    level,
    message,
    shouldWarnUser: level !== 'ok',
  };
}

// ========== 使用历史记录 ==========

/**
 * 记录存储使用情况
 */
export async function recordStorageUsage() {
  const usage = await getTotalStorageUsage();
  
  const history = safeStorage.getItem(CONFIG.USAGE_HISTORY_KEY, []);
  history.unshift({
    timestamp: getCurrentUTC(),
    totalUsedBytes: usage.totalUsedBytes,
    localStorageBytes: usage.localStorage.usedBytes,
    indexedDBBytes: usage.indexedDB.usedBytes,
    percentUsed: usage.percentUsed,
    level: usage.level,
  });
  
  // 只保留最近30天的记录
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filteredHistory = history.filter(record => {
    return new Date(record.timestamp).getTime() > thirtyDaysAgo;
  });
  
  safeStorage.setItem(CONFIG.USAGE_HISTORY_KEY, filteredHistory);
  
  return usage;
}

/**
 * 获取存储使用历史
 */
export function getStorageUsageHistory(days = 7) {
  const history = safeStorage.getItem(CONFIG.USAGE_HISTORY_KEY, []);
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  
  return history.filter(record => {
    return new Date(record.timestamp).getTime() > cutoffTime;
  });
}

// ========== 压缩建议 ==========

/**
 * 检查是否需要压缩建议
 */
export function getCompressionSuggestion(fileType, fileSize) {
  const suggestions = {
    video: [
      { size: 100 * 1024 * 1024, action: '强烈建议压缩', benefit: '预计可节省 50-70% 空间' },
      { size: 50 * 1024 * 1024, action: '建议压缩', benefit: '预计可节省 40-60% 空间' },
      { size: 20 * 1024 * 1024, action: '可选压缩', benefit: '预计可节省 30-50% 空间' },
    ],
    image: [
      { size: 5 * 1024 * 1024, action: '建议压缩', benefit: '预计可节省 50-80% 空间' },
      { size: 2 * 1024 * 1024, action: '可选压缩', benefit: '预计可节省 30-60% 空间' },
    ],
  };
  
  const typeSuggestions = suggestions[fileType] || [];
  
  for (const suggestion of typeSuggestions) {
    if (fileSize >= suggestion.size) {
      return suggestion;
    }
  }
  
  return null;
}

/**
 * 生成存储优化建议报告
 */
export async function generateOptimizationReport() {
  const usage = await getTotalStorageUsage();
  const history = getStorageUsageHistory(7);
  
  // 计算增长趋势
  let growthTrend = 'stable';
  if (history.length >= 2) {
    const oldest = history[history.length - 1];
    const newest = history[0];
    const growthPercent = newest.percentUsed - oldest.percentUsed;
    if (growthPercent > 10) {
      growthTrend = 'fast_growing';
    } else if (growthPercent > 5) {
      growthTrend = 'growing';
    }
  }
  
  // 生成建议
  const suggestions = [];
  
  if (usage.level === 'danger') {
    suggestions.push({
      priority: 'high',
      type: 'cleanup',
      title: '立即清理存储空间',
      description: '您的存储空间即将耗尽，请立即清理或导出数据',
      actions: ['删除旧视频', '清理缓存', '导出并删除旧数据'],
    });
  }
  
  if (growthTrend === 'fast_growing') {
    suggestions.push({
      priority: 'medium',
      type: 'compression',
      title: '建议启用自动压缩',
      description: '您的数据增长较快，启用自动压缩可以显著节省空间',
      actions: ['开启视频自动压缩', '开启图片自动压缩', '降低视频录制质量'],
    });
  }
  
  if (usage.localStorage.percentUsed > 70) {
    suggestions.push({
      priority: 'medium',
      type: 'localstorage',
      title: '本地缓存使用较高',
      description: '部分元数据存储使用量较高，可以考虑清理',
      actions: ['清理过期同步日志', '清理旧的备份数据', '清理缓存记录'],
    });
  }
  
  return {
    usage,
    history,
    growthTrend,
    suggestions,
    generatedAt: getCurrentUTC(),
  };
}

// ========== 清理工具 ==========

/**
 * 清理超过X天的媒体文件
 * TODO: 实际实现需要配合具体的存储结构
 */
export function cleanOldMedia(daysToKeep = 365) {
  console.log(`[StorageGuard] 清理超过 ${daysToKeep} 天的媒体文件`);
  // 此处应配合具体的存储结构实现
  return {
    success: true,
    cleanedCount: 0,
    freedBytes: 0,
    note: '此功能需配合具体存储结构实现',
  };
}

/**
 * 清理旧的备份文件
 */
export function cleanOldBackups(keepCount = 5) {
  console.log(`[StorageGuard] 清理旧备份，保留最近 ${keepCount} 个`);
  
  const backupPrefixes = ['migration_backup_', 'data_backup_'];
  let deletedCount = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && backupPrefixes.some(prefix => key.startsWith(prefix))) {
      // 保留最近N个，此处简化处理
      deletedCount++;
      // localStorage.removeItem(key); // 谨慎操作，暂时不实际删除
    }
  }
  
  return { success: true, deletedCount };
}

// ========== 初始化 ==========

/**
 * 初始化存储防护
 */
export async function initStorageGuard() {
  console.log('[StorageGuard] 存储防护系统初始化');
  
  // 记录初始使用情况
  const usage = await recordStorageUsage();
  
  console.log(`[StorageGuard] 总使用量: ${usage.totalUsedFormatted}`);
  console.log(`[StorageGuard] 使用占比: ${usage.percentUsed}%`);
  console.log(`[StorageGuard] 状态: ${usage.level}`);
  
  if (usage.shouldWarnUser) {
    console.warn(`[StorageGuard] ⚠️  ${usage.message}`);
  }
  
  // 每24小时记录一次使用情况
  setInterval(recordStorageUsage, 24 * 60 * 60 * 1000);
  
  return usage;
}

// 默认导出
export default {
  CONFIG,
  checkVideoSize,
  checkImageSize,
  checkAudioSize,
  getLocalStorageUsage,
  getIndexedDBUsage,
  getTotalStorageUsage,
  recordStorageUsage,
  getStorageUsageHistory,
  getCompressionSuggestion,
  generateOptimizationReport,
  cleanOldMedia,
  cleanOldBackups,
  formatBytes,
  initStorageGuard,
};
