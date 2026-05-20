/**
 * P4阶段：媒体上传状态管理 + 失败补偿机制
 * 功能：记录上传状态、失败自动重试、手动重传
 */

import { saveVideo, getVideo, deleteVideo } from './storageAdapter';
import { STORAGE_CONFIG } from '../config/storage';

// ========== 上传状态常量 ==========
export const UPLOAD_STATUS = {
  PENDING: 'pending',      // 等待上传
  UPLOADING: 'uploading',  // 上传中
  SUCCESS: 'success',      // 上传成功
  FAILED: 'failed',        // 上传失败
  RETRYING: 'retrying',    // 重试中
};

// ========== 存储键名 ==========
const STORAGE_KEY = 'media_upload_queue';

// ========== 单例状态 ==========
let uploadQueue = [];
let listeners = new Set();
let isProcessing = false;
let retryTimer = null;

// ========== 重试配置 ==========
const RETRY_CONFIG = {
  maxRetries: 5,                 // 最大重试次数
  baseDelay: 1000,               // 基础延迟（指数退避）
  maxDelay: 30000,               // 最大延迟
  autoRetryInterval: 60000,      // 自动重试间隔（1分钟）
};

// ========== 工具函数 ==========
function generateId() {
  return `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function notifyListeners() {
  const state = getUploadState();
  listeners.forEach(callback => {
    try {
      callback(state);
    } catch (e) {
      console.error('[MediaUpload] 监听器回调失败:', e);
    }
  });
}

// ========== 队列持久化 ==========
function saveQueue() {
  try {
    // 只持久化失败和待处理的项目
    const toSave = uploadQueue.filter(item => 
      item.status === UPLOAD_STATUS.PENDING || 
      item.status === UPLOAD_STATUS.FAILED
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('[MediaUpload] 保存队列失败:', e);
  }
}

function loadQueue() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      uploadQueue = JSON.parse(saved);
      console.log(`[MediaUpload] 从本地恢复 ${uploadQueue.length} 个待上传项`);
    }
  } catch (e) {
    console.error('[MediaUpload] 加载队列失败:', e);
    uploadQueue = [];
  }
}

// ========== 核心上传逻辑（模拟，后续对接真实后端） ==========
async function uploadMediaFile(mediaItem) {
  // TODO: 对接真实的上传API
  // 目前只是模拟上传过程
  
  const { type, data, filename } = mediaItem;
  
  console.log(`[MediaUpload] 开始上传: ${filename}`);
  
  // 模拟上传进度
  for (let progress = 0; progress <= 100; progress += 20) {
    updateUploadProgress(mediaItem.id, progress);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 模拟随机失败（30%概率失败）
  if (Math.random() < 0.3) {
    throw new Error('模拟上传失败');
  }
  
  console.log(`[MediaUpload] 上传成功: ${filename}`);
  
  return {
    success: true,
    url: `https://example.com/uploads/${filename}`,
    size: data?.size || 0,
  };
}

// ========== 公开API ==========

/**
 * 添加媒体到上传队列
 */
export function addToUploadQueue(mediaData, options = {}) {
  const {
    momentId = null,
    babyId = null,
    autoStart = true,
  } = options;
  
  const item = {
    id: generateId(),
    status: UPLOAD_STATUS.PENDING,
    progress: 0,
    retryCount: 0,
    maxRetries: RETRY_CONFIG.maxRetries,
    addedAt: new Date().toISOString(),
    lastAttemptAt: null,
    error: null,
    
    // 媒体数据
    type: mediaData.type || 'unknown', // photo/video/audio
    filename: mediaData.filename || mediaData.name || `file_${Date.now()}`,
    data: mediaData.data || mediaData,
    fileSize: mediaData.size || 0,
    mimeType: mediaData.type || mediaData.mimeType,
    
    // 关联信息
    momentId,
    babyId,
    
    // 上传后的远程URL
    remoteUrl: null,
  };
  
  uploadQueue.push(item);
  saveQueue();
  notifyListeners();
  
  console.log(`[MediaUpload] 已添加到上传队列: ${item.filename} (ID: ${item.id})`);
  
  if (autoStart) {
    processUploadQueue();
  }
  
  return item.id;
}

/**
 * 更新上传进度
 */
export function updateUploadProgress(itemId, progress) {
  const item = uploadQueue.find(i => i.id === itemId);
  if (item) {
    item.progress = progress;
    notifyListeners();
  }
}

/**
 * 更新上传状态
 */
export function updateUploadStatus(itemId, status, error = null) {
  const item = uploadQueue.find(i => i.id === itemId);
  if (item) {
    item.status = status;
    item.lastAttemptAt = new Date().toISOString();
    if (error) {
      item.error = error;
    }
    saveQueue();
    notifyListeners();
  }
}

/**
 * 处理单个上传项
 */
async function processUploadItem(item) {
  if (item.status === UPLOAD_STATUS.SUCCESS) {
    return true;
  }
  
  // 检查重试次数
  if (item.retryCount >= item.maxRetries) {
    console.warn(`[MediaUpload] 超过最大重试次数: ${item.filename}`);
    updateUploadStatus(item.id, UPLOAD_STATUS.FAILED, '超过最大重试次数');
    return false;
  }
  
  updateUploadStatus(item.id, item.retryCount > 0 ? UPLOAD_STATUS.RETRYING : UPLOAD_STATUS.UPLOADING);
  item.retryCount++;
  
  try {
    const result = await uploadMediaFile(item);
    
    if (result.success) {
      item.status = UPLOAD_STATUS.SUCCESS;
      item.progress = 100;
      item.remoteUrl = result.url;
      saveQueue();
      notifyListeners();
      return true;
    } else {
      throw new Error('上传返回失败');
    }
    
  } catch (error) {
    console.error(`[MediaUpload] 上传失败 (${item.retryCount}/${item.maxRetries}): ${item.filename}`, error);
    updateUploadStatus(item.id, UPLOAD_STATUS.FAILED, error.message);
    return false;
  }
}

/**
 * 处理上传队列
 */
export async function processUploadQueue() {
  if (isProcessing) {
    console.log('[MediaUpload] 队列正在处理中，跳过');
    return;
  }
  
  // 获取所有需要处理的项
  const pendingItems = uploadQueue.filter(item => 
    item.status === UPLOAD_STATUS.PENDING || 
    item.status === UPLOAD_STATUS.FAILED
  );
  
  if (pendingItems.length === 0) {
    console.log('[MediaUpload] 队列中没有待处理的项');
    return;
  }
  
  isProcessing = true;
  console.log(`[MediaUpload] 开始处理上传队列，共 ${pendingItems.length} 项`);
  
  try {
    // 串行处理，避免并发过高
    for (const item of pendingItems) {
      // 指数退避延迟
      if (item.retryCount > 0) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, item.retryCount - 1),
          RETRY_CONFIG.maxDelay
        );
        console.log(`[MediaUpload] 第 ${item.retryCount} 次重试，延迟 ${delay}ms: ${item.filename}`);
        await new Promise(r => setTimeout(r, delay));
      }
      
      await processUploadItem(item);
    }
  } finally {
    isProcessing = false;
    saveQueue();
    notifyListeners();
    console.log('[MediaUpload] 队列处理完成');
  }
}

/**
 * 手动重试单个上传项
 */
export async function retryUpload(itemId) {
  const item = uploadQueue.find(i => i.id === itemId);
  if (!item) {
    throw new Error('上传项不存在');
  }
  
  // 重置重试计数
  item.retryCount = 0;
  item.error = null;
  item.status = UPLOAD_STATUS.PENDING;
  saveQueue();
  notifyListeners();
  
  return processUploadItem(item);
}

/**
 * 重试所有失败的上传项
 */
export async function retryAllFailed() {
  const failedItems = uploadQueue.filter(i => i.status === UPLOAD_STATUS.FAILED);
  
  console.log(`[MediaUpload] 批量重试 ${failedItems.length} 个失败项`);
  
  for (const item of failedItems) {
    item.retryCount = 0;
    item.error = null;
    item.status = UPLOAD_STATUS.PENDING;
  }
  
  saveQueue();
  notifyListeners();
  
  return processUploadQueue();
}

/**
 * 从队列中移除项
 */
export function removeFromUploadQueue(itemId) {
  const index = uploadQueue.findIndex(i => i.id === itemId);
  if (index !== -1) {
    uploadQueue.splice(index, 1);
    saveQueue();
    notifyListeners();
    return true;
  }
  return false;
}

/**
 * 清空已完成的上传项
 */
export function clearCompletedUploads() {
  const beforeCount = uploadQueue.length;
  uploadQueue = uploadQueue.filter(i => i.status !== UPLOAD_STATUS.SUCCESS);
  const removedCount = beforeCount - uploadQueue.length;
  saveQueue();
  notifyListeners();
  return removedCount;
}

/**
 * 获取上传状态
 */
export function getUploadState() {
  const total = uploadQueue.length;
  const pending = uploadQueue.filter(i => i.status === UPLOAD_STATUS.PENDING).length;
  const uploading = uploadQueue.filter(i => 
    i.status === UPLOAD_STATUS.UPLOADING || 
    i.status === UPLOAD_STATUS.RETRYING
  ).length;
  const success = uploadQueue.filter(i => i.status === UPLOAD_STATUS.SUCCESS).length;
  const failed = uploadQueue.filter(i => i.status === UPLOAD_STATUS.FAILED).length;
  const totalProgress = total > 0 
    ? Math.round(uploadQueue.reduce((sum, i) => sum + i.progress, 0) / total)
    : 0;
  
  return {
    queue: [...uploadQueue],
    stats: {
      total,
      pending,
      uploading,
      success,
      failed,
      totalProgress,
    },
    isProcessing,
  };
}

/**
 * 添加状态监听器
 */
export function addUploadListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * 启动自动重试机制
 */
export function startAutoRetry() {
  if (retryTimer) {
    clearInterval(retryTimer);
  }
  
  retryTimer = setInterval(() => {
    const failedCount = uploadQueue.filter(i => i.status === UPLOAD_STATUS.FAILED).length;
    if (failedCount > 0) {
      console.log(`[MediaUpload] 自动重试触发，检测到 ${failedCount} 个失败项`);
      processUploadQueue();
    }
  }, RETRY_CONFIG.autoRetryInterval);
  
  console.log('[MediaUpload] 自动重试机制已启动');
}

/**
 * 停止自动重试
 */
export function stopAutoRetry() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
    console.log('[MediaUpload] 自动重试机制已停止');
  }
}

/**
 * 初始化媒体上传模块
 */
export function initMediaUpload() {
  loadQueue();
  startAutoRetry();
  
  // 启动时处理待处理项
  setTimeout(() => {
    processUploadQueue();
  }, 2000);
  
  console.log('[MediaUpload] 媒体上传模块已初始化');
}

/**
 * 清理资源
 */
export function cleanupMediaUpload() {
  stopAutoRetry();
  listeners.clear();
}

// ========== React Hook（如果需要） ==========
// 这里只提供纯函数工具，Hook可以在组件中自行实现

// 默认导出
export default {
  UPLOAD_STATUS,
  addToUploadQueue,
  updateUploadProgress,
  updateUploadStatus,
  processUploadQueue,
  retryUpload,
  retryAllFailed,
  removeFromUploadQueue,
  clearCompletedUploads,
  getUploadState,
  addUploadListener,
  startAutoRetry,
  stopAutoRetry,
  initMediaUpload,
  cleanupMediaUpload,
};
