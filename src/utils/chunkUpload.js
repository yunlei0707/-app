/**
 * P4阶段：分片上传工具
 * 功能：大文件分片上传 + 断点续传 + 上传进度追踪
 */

// ========== 配置 ==========
const CONFIG = {
  // 分片大小（1MB）
  CHUNK_SIZE: 1024 * 1024,
  // 并发上传数量
  CONCURRENT_COUNT: 3,
  // 重试次数
  MAX_RETRY: 3,
  // 重试延迟（毫秒）
  RETRY_DELAY: 1000,
};

// ========== 上传状态 ==========
export const UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  SUCCESS: 'success',
  ERROR: 'error',
};

// ========== 本地存储键 ==========
const UPLOAD_PROGRESS_KEY = 'chunkUploadProgress';

/**
 * 计算文件的MD5（用于断点续传标识）
 */
async function computeFileMD5(file, onProgress) {
  // 简化实现：使用文件名+大小+修改时间作为标识
  // 生产环境应使用真实的MD5计算
  const identifier = `${file.name}_${file.size}_${file.lastModified}`;
  // 模拟计算延迟
  await new Promise(r => setTimeout(r, 500));
  if (onProgress) onProgress(100);
  return btoa(identifier).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * 将文件切割成分片
 */
function createChunks(file) {
  const chunks = [];
  const totalChunks = Math.ceil(file.size / CONFIG.CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CONFIG.CHUNK_SIZE;
    const end = Math.min(start + CONFIG.CHUNK_SIZE, file.size);
    chunks.push({
      index: i,
      start,
      end,
      blob: file.slice(start, end),
      status: UPLOAD_STATUS.PENDING,
      retryCount: 0,
    });
  }
  
  return chunks;
}

/**
 * 保存上传进度到本地存储
 */
function saveProgress(fileId, progress) {
  try {
    const allProgress = JSON.parse(localStorage.getItem(UPLOAD_PROGRESS_KEY) || '{}');
    allProgress[fileId] = {
      ...progress,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(allProgress));
  } catch (e) {
    console.error('[ChunkUpload] 保存进度失败:', e);
  }
}

/**
 * 从本地存储读取上传进度
 */
function loadProgress(fileId) {
  try {
    const allProgress = JSON.parse(localStorage.getItem(UPLOAD_PROGRESS_KEY) || '{}');
    return allProgress[fileId] || null;
  } catch (e) {
    console.error('[ChunkUpload] 读取进度失败:', e);
    return null;
  }
}

/**
 * 清理过期的上传进度（超过7天）
 */
export function cleanupExpiredProgress() {
  try {
    const allProgress = JSON.parse(localStorage.getItem(UPLOAD_PROGRESS_KEY) || '{}');
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    Object.keys(allProgress).forEach(fileId => {
      const progress = allProgress[fileId];
      if (now - new Date(progress.updatedAt).getTime() > sevenDays) {
        delete allProgress[fileId];
      }
    });
    
    localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(allProgress));
  } catch (e) {
    console.error('[ChunkUpload] 清理过期进度失败:', e);
  }
}

/**
 * 单个分片上传（模拟）
 * TODO: 对接真实的上传API
 */
async function uploadChunk(chunk, fileId, onProgress) {
  return new Promise((resolve, reject) => {
    // 模拟上传进度
    const totalDuration = 500 + Math.random() * 1000;
    const interval = 50;
    let elapsed = 0;
    
    const timer = setInterval(() => {
      elapsed += interval;
      const progress = Math.min(100, (elapsed / totalDuration) * 100);
      if (onProgress) onProgress(progress);
      
      if (elapsed >= totalDuration) {
        clearInterval(timer);
        resolve({ success: true, chunkIndex: chunk.index });
      }
    }, interval);
    
    // 模拟1%概率失败（用于测试重试）
    if (Math.random() < 0.01 && chunk.retryCount < CONFIG.MAX_RETRY) {
      clearInterval(timer);
      reject(new Error('网络错误'));
    }
  });
}

/**
 * 分片上传任务类
 */
export class ChunkUploadTask {
  constructor(file, options = {}) {
    this.file = file;
    this.options = {
      chunkSize: CONFIG.CHUNK_SIZE,
      concurrentCount: CONFIG.CONCURRENT_COUNT,
      maxRetry: CONFIG.MAX_RETRY,
      ...options,
    };
    
    this.fileId = null;
    this.chunks = [];
    this.status = UPLOAD_STATUS.PENDING;
    this.progress = 0;
    this.uploadedChunks = 0;
    this.totalChunks = 0;
    
    this.callbacks = {
      onProgress: options.onProgress,
      onStatusChange: options.onStatusChange,
      onComplete: options.onComplete,
      onError: options.onError,
    };
    
    this.aborted = false;
  }
  
  /**
   * 初始化（计算MD5、创建分片）
   */
  async init() {
    try {
      // 计算文件标识
      this.fileId = await computeFileMD5(this.file, (progress) => {
        console.log(`[ChunkUpload] MD5计算进度: ${progress}%`);
      });
      
      // 创建分片
      this.chunks = createChunks(this.file);
      this.totalChunks = this.chunks.length;
      
      // 检查是否有未完成的上传
      const savedProgress = loadProgress(this.fileId);
      if (savedProgress && savedProgress.uploadedChunks) {
        console.log(`[ChunkUpload] 发现未完成的上传，已上传 ${savedProgress.uploadedChunks}/${this.totalChunks} 个分片`);
        // 恢复上传进度
        savedProgress.uploadedIndices.forEach(index => {
          if (this.chunks[index]) {
            this.chunks[index].status = UPLOAD_STATUS.SUCCESS;
          }
        });
        this.uploadedChunks = savedProgress.uploadedChunks;
        this.updateProgress();
      }
      
      console.log(`[ChunkUpload] 初始化完成，文件: ${this.file.name}, 分片数: ${this.totalChunks}`);
      return true;
      
    } catch (e) {
      console.error('[ChunkUpload] 初始化失败:', e);
      this.setStatus(UPLOAD_STATUS.ERROR);
      if (this.callbacks.onError) this.callbacks.onError(e);
      return false;
    }
  }
  
  /**
   * 开始上传
   */
  async start() {
    if (this.status === UPLOAD_STATUS.UPLOADING) {
      console.warn('[ChunkUpload] 上传正在进行中');
      return;
    }
    
    if (!this.fileId) {
      const inited = await this.init();
      if (!inited) return;
    }
    
    this.aborted = false;
    this.setStatus(UPLOAD_STATUS.UPLOADING);
    
    try {
      // 并发上传
      await this.uploadConcurrent();
      
      // 所有分片上传完成，发送合并请求
      if (this.uploadedChunks === this.totalChunks && !this.aborted) {
        await this.mergeChunks();
        this.setStatus(UPLOAD_STATUS.SUCCESS);
        this.updateProgress();
        
        // 清理本地进度
        this.clearProgress();
        
        if (this.callbacks.onComplete) {
          this.callbacks.onComplete({
            fileId: this.fileId,
            fileName: this.file.name,
            fileSize: this.file.size,
          });
        }
      }
      
    } catch (e) {
      console.error('[ChunkUpload] 上传失败:', e);
      this.setStatus(UPLOAD_STATUS.ERROR);
      if (this.callbacks.onError) this.callbacks.onError(e);
    }
  }
  
  /**
   * 暂停上传
   */
  pause() {
    this.aborted = true;
    this.setStatus(UPLOAD_STATUS.PAUSED);
    this.saveProgress();
    console.log('[ChunkUpload] 上传已暂停');
  }
  
  /**
   * 恢复上传
   */
  async resume() {
    console.log('[ChunkUpload] 恢复上传');
    await this.start();
  }
  
  /**
   * 取消上传
   */
  cancel() {
    this.aborted = true;
    this.clearProgress();
    console.log('[ChunkUpload] 上传已取消');
  }
  
  /**
   * 并发上传分片
   */
  async uploadConcurrent() {
    const pendingChunks = this.chunks.filter(c => c.status !== UPLOAD_STATUS.SUCCESS);
    let activeCount = 0;
    let currentIndex = 0;
    
    return new Promise((resolve, reject) => {
      const uploadNext = async () => {
        if (this.aborted) {
          resolve();
          return;
        }
        
        if (currentIndex >= pendingChunks.length) {
          if (activeCount === 0) {
            resolve();
          }
          return;
        }
        
        activeCount++;
        const chunk = pendingChunks[currentIndex++];
        
        try {
          await this.uploadSingleChunk(chunk);
          
        } catch (e) {
          // 单个分片失败不影响整体，会在uploadSingleChunk中处理重试
          console.warn(`[ChunkUpload] 分片 ${chunk.index} 上传失败:`, e);
        } finally {
          activeCount--;
          uploadNext();
        }
      };
      
      // 启动并发
      for (let i = 0; i < this.options.concurrentCount; i++) {
        uploadNext();
      }
    });
  }
  
  /**
   * 上传单个分片（含重试逻辑）
   */
  async uploadSingleChunk(chunk) {
    while (chunk.retryCount < this.options.maxRetry && !this.aborted) {
      try {
        chunk.status = UPLOAD_STATUS.UPLOADING;
        
        await uploadChunk(chunk, this.fileId, (progress) => {
          // 更新该分片的进度
          // console.log(`[ChunkUpload] 分片 ${chunk.index} 进度: ${progress}%`);
        });
        
        chunk.status = UPLOAD_STATUS.SUCCESS;
        this.uploadedChunks++;
        this.updateProgress();
        this.saveProgress();
        return;
        
      } catch (e) {
        chunk.retryCount++;
        console.warn(`[ChunkUpload] 分片 ${chunk.index} 上传失败，重试 ${chunk.retryCount}/${this.options.maxRetry}`);
        
        if (chunk.retryCount < this.options.maxRetry) {
          // 延迟重试
          await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY * chunk.retryCount));
        } else {
          chunk.status = UPLOAD_STATUS.ERROR;
          throw e;
        }
      }
    }
  }
  
  /**
   * 合并分片（模拟）
   * TODO: 对接真实的合并API
   */
  async mergeChunks() {
    console.log('[ChunkUpload] 开始合并分片...');
    // 模拟合并耗时
    await new Promise(r => setTimeout(r, 1000));
    console.log('[ChunkUpload] 分片合并完成');
  }
  
  /**
   * 更新进度
   */
  updateProgress() {
    this.progress = Math.round((this.uploadedChunks / this.totalChunks) * 100);
    
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress({
        progress: this.progress,
        uploadedChunks: this.uploadedChunks,
        totalChunks: this.totalChunks,
        uploadedBytes: this.uploadedChunks * this.options.chunkSize,
        totalBytes: this.file.size,
      });
    }
  }
  
  /**
   * 更新状态
   */
  setStatus(status) {
    this.status = status;
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status);
    }
  }
  
  /**
   * 保存进度
   */
  saveProgress() {
    const uploadedIndices = this.chunks
      .filter(c => c.status === UPLOAD_STATUS.SUCCESS)
      .map(c => c.index);
    
    saveProgress(this.fileId, {
      fileName: this.file.name,
      fileSize: this.file.size,
      uploadedChunks: this.uploadedChunks,
      totalChunks: this.totalChunks,
      uploadedIndices,
    });
  }
  
  /**
   * 清理进度
   */
  clearProgress() {
    try {
      const allProgress = JSON.parse(localStorage.getItem(UPLOAD_PROGRESS_KEY) || '{}');
      delete allProgress[this.fileId];
      localStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (e) {
      console.error('[ChunkUpload] 清理进度失败:', e);
    }
  }
}

/**
 * 创建上传任务（便捷函数）
 */
export function createUploadTask(file, options = {}) {
  return new ChunkUploadTask(file, options);
}

/**
 * 获取所有未完成的上传任务
 */
export function getPendingUploads() {
  try {
    const allProgress = JSON.parse(localStorage.getItem(UPLOAD_PROGRESS_KEY) || '{}');
    return Object.entries(allProgress)
      .filter(([_, progress]) => progress.uploadedChunks < progress.totalChunks)
      .map(([fileId, progress]) => ({
        fileId,
        ...progress,
      }));
  } catch (e) {
    console.error('[ChunkUpload] 获取待上传列表失败:', e);
    return [];
  }
}

// 默认导出
export default {
  CONFIG,
  UPLOAD_STATUS,
  ChunkUploadTask,
  createUploadTask,
  getPendingUploads,
  cleanupExpiredProgress,
};
