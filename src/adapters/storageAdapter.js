/**
 * 🧠 Storage Adapter - 单源数据版本
 * 读取统一返回 Blob，写入 OPFS 优先，失败 fallback Filesystem
 * 新增：文件哈希计算、去重检测、引用计数、容错机制
 */

import { findMediaByHash, registerMedia } from '../utils/dbV2';

let _fsCache = null, _fsLoaded = false;

// ============================================================
// ✅ 核心：文件哈希计算（用于去重检测）
// ============================================================

/**
 * 计算文件的 SHA-256 哈希值
 * @param {Blob} blob - 文件 Blob
 * @returns {Promise<string>} 哈希值
 */
export async function calculateFileHash(blob) {
  try {
    // 使用 Web Crypto API 计算哈希
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('[StorageAdapter] 文件哈希计算完成，大小:', blob.size, '哈希:', hashHex.substring(0, 16) + '...');
    return hashHex;
  } catch (error) {
    console.warn('[StorageAdapter] 哈希计算失败，降级使用文件名+大小:', error.message);
    // 降级方案：使用文件名+大小+修改时间作为伪哈希
    return `fallback_${blob.size}_${blob.lastModified || Date.now()}`;
  }
}

/**
 * 快速哈希：只计算文件前 128KB + 后 128KB（大文件优化）
 * @param {Blob} blob - 文件 Blob
 * @returns {Promise<string>} 哈希值
 */
export async function calculateFastHash(blob) {
  const CHUNK_SIZE = 128 * 1024; // 128KB
  
  try {
    let sampleBuffer;
    
    if (blob.size <= CHUNK_SIZE * 2) {
      // 小文件：全量计算
      sampleBuffer = await blob.arrayBuffer();
    } else {
      // 大文件：取前128KB + 后128KB
      const startChunk = blob.slice(0, CHUNK_SIZE);
      const endChunk = blob.slice(blob.size - CHUNK_SIZE, blob.size);
      const startBuffer = await startChunk.arrayBuffer();
      const endBuffer = await endChunk.arrayBuffer();
      
      // 合并两个样本
      const combined = new Uint8Array(startBuffer.byteLength + endBuffer.byteLength);
      combined.set(new Uint8Array(startBuffer), 0);
      combined.set(new Uint8Array(endBuffer), startBuffer.byteLength);
      sampleBuffer = combined.buffer;
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', sampleBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('[StorageAdapter] 快速哈希完成，文件大小:', blob.size, '哈希:', hashHex.substring(0, 16) + '...');
    return hashHex;
  } catch (error) {
    console.warn('[StorageAdapter] 快速哈希计算失败:', error.message);
    return `fallback_${blob.size}_${Date.now()}`;
  }
}

// ============================================================
// ✅ 单源数据：去重保存接口
// ============================================================

/**
 * 保存视频 Blob（带去重检测）
 * @param {Blob} blob - 视频 Blob
 * @param {string} preferredPath - 建议路径（如果去重失败则使用）
 * @param {Object} options - 选项 { mimeType, fileName }
 * @returns {Promise<Object>} { path: string, isNew: boolean, fileHash: string }
 */
export async function saveVideoBlobDedup(blob, preferredPath, options = {}) {
  const { mimeType = 'video/mp4', fileName } = options;
  
  console.log('[StorageAdapter] 开始去重保存，文件大小:', blob.size);
  
  // 1. 计算文件哈希
  const fileHash = await calculateFastHash(blob);
  
  // 2. 检查是否已存在
  const existingMedia = findMediaByHash(fileHash);
  
  if (existingMedia) {
    // 文件已存在，直接复用
    console.log('[StorageAdapter] 文件已存在，复用路径:', existingMedia.path);
    
    // 增加引用计数
    registerMedia(fileHash, existingMedia);
    
    return {
      path: existingMedia.path,
      isNew: false,
      fileHash,
      size: existingMedia.size,
      mimeType: existingMedia.mimeType
    };
  }
  
  // 3. 新文件，实际写入存储
  console.log('[StorageAdapter] 新文件，开始写入:', preferredPath);
  
  try {
    const finalPath = await saveVideoBlob(preferredPath, blob);
    
    // 4. 注册到媒体索引
    registerMedia(fileHash, {
      path: finalPath,
      size: blob.size,
      mimeType,
      fileName: fileName || preferredPath.split('/').pop()
    });
    
    console.log('[StorageAdapter] 文件写入完成:', finalPath);
    
    return {
      path: finalPath,
      isNew: true,
      fileHash,
      size: blob.size,
      mimeType
    };
  } catch (error) {
    console.error('[StorageAdapter] 文件写入失败:', error);
    throw new Error(`文件保存失败: ${error.message}`);
  }
}

// ============================================================
// ✅ 基础读写接口（向后兼容）
// ============================================================

export async function getVideoBlob(path) {
  if (!path) {
    const error = new Error('视频路径为空');
    console.error('[StorageAdapter]', error.message);
    throw error;
  }

  // ✅ 路径清洗：去掉 URL 前缀，只保留相对路径
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    const urlObj = new URL(cleanPath);
    cleanPath = urlObj.pathname;
    // 去掉 /Documents/ 或 /Data/ 前缀
    cleanPath = cleanPath.replace(/^\/[^\/]+\//, ''); // /Documents/xxx -> xxx
  }
  
  // ✅ 路径补全：如果只有文件名（没有目录前缀），加上默认路径
  if (!cleanPath.includes('/')) {
    // 判断是视频还是音频
    const isAudio = cleanPath.endsWith('.m4a') || cleanPath.endsWith('.aac') || cleanPath.endsWith('.mp3');
    const prefix = isAudio ? 'BabyTime/audios/' : 'BabyTime/videos/';
    cleanPath = prefix + cleanPath;
  }
  
  console.log('[StorageAdapter] 原始路径:', path, '-> 清洗后:', cleanPath);

  let blob = null;

  // 尝试 OPFS
  try {
    blob = await readVideoFromOPFS(cleanPath);
    if (blob && blob.size > 0) {
      console.log('[StorageAdapter] 从 OPFS 读取成功:', cleanPath);
      return blob;
    }
  } catch (e) {
    console.warn('[StorageAdapter] OPFS 读取失败:', e.message);
  }

  // 尝试 Filesystem
  try {
    const base64 = await readFromFilesystem(cleanPath);
    if (base64) {
      console.log('[StorageAdapter] 从 Filesystem 读取成功:', cleanPath);
      return base64ToBlob(base64);
    }
  } catch (e) {
    console.warn('[StorageAdapter] Filesystem 读取失败:', e.message);
  }

  const error = new Error(`视频读取失败: ${cleanPath}`);
  console.error('[StorageAdapter]', error.message);
  throw error;
}

async function readFromFilesystem(path) {
  const fs = await loadFilesystem();
  const result = await fs.Filesystem.readFile({
    path,
    directory: fs.Directory.Documents
  });
  return result.data;
}

function base64ToBlob(base64, mime = 'video/mp4') {
  const clean = base64.split(',')[1] || base64;
  const bytes = atob(clean);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

async function readVideoFromOPFS(path) {
  if (!navigator.storage?.getDirectory) throw new Error('OPFS 不支持');
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  return file;
}

export async function saveVideoBlob(path, blob) {
  try {
    const result = await saveToOPFS(path, blob);
    console.log('[StorageAdapter] 保存到 OPFS 成功:', path);
    return result;
  } catch (e) {
    console.warn('[StorageAdapter] OPFS 保存失败，降级到 Filesystem:', e.message);
    try {
      const result = await saveToFilesystem(path, blob);
      console.log('[StorageAdapter] 保存到 Filesystem 成功:', path);
      return result;
    } catch (e2) {
      console.error('[StorageAdapter] Filesystem 保存也失败:', e2.message);
      throw e2;
    }
  }
}

async function saveToOPFS(path, blob) {
  if (!navigator.storage?.getDirectory) throw new Error('OPFS 不支持');
  const root = await navigator.storage.getDirectory();
  const parts = path.split('/');
  const filename = parts.pop();
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return path;
}

async function saveToFilesystem(path, blob) {
  const fs = await loadFilesystem();
  const base64 = await blobToBase64(blob);
  await fs.Filesystem.writeFile({
    path,
    data: base64,
    directory: fs.Directory.Documents,
    recursive: true
  });
  return path;
}

function blobToBase64(blob) {
  return new Promise((r, j) => {
    const f = new FileReader();
    f.onloadend = () => r(f.result);
    f.onerror = j;
    f.readAsDataURL(blob);
  });
}

async function loadFilesystem() {
  const mod = window.Capacitor?.Plugins?.Filesystem;
  const Filesystem = mod?.Filesystem || mod.default?.Filesystem || mod;
  const Directory = mod?.Directory || mod.default?.Directory || {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
    Cache: 'CACHE'
  };
  return { Filesystem, Directory };
}

export default { 
  getVideoBlob, 
  saveVideoBlob, 
  saveVideoBlobDedup,
  calculateFileHash,
  calculateFastHash
};
