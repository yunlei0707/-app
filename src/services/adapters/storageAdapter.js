/**
 * 🧠 Storage Adapter - 统一视频读取层
 * 
 * 核心原则：永远只返回 Blob，上层永远不需要关心数据来源
 * 支持：OPFS / Capacitor Filesystem / 其他存储后端
 */

import { readVideoFromOPFS } from '../../utils/opfs.js';

let _filesystemCache = null;
let _filesystemLoaded = false;

/**
 * 统一获取视频 Blob（永远只返回 Blob）
 * 自动尝试多种存储方式，上层不需要关心来源
 */
export async function getVideoBlob(path) {
  if (!path) {
    throw new Error('[storageAdapter] 视频路径为空');
  }

  let blob = null;

  // 1️⃣ 优先尝试 OPFS（最快，原生支持 Blob）
  try {
    blob = await readVideoFromOPFS(path);
    if (blob instanceof Blob && blob.size > 0) {
      console.debug(`[storageAdapter] OPFS 读取成功: ${path}`);
      return blob;
    }
  } catch (e) {
    console.debug(`[storageAdapter] OPFS 读取失败，尝试 fallback: ${path}`);
  }

  // 2️⃣ Fallback: Capacitor Filesystem（返回 base64，需要转 Blob）
  try {
    const base64 = await readFromFilesystem(path);
    if (base64) {
      blob = base64ToBlob(base64);
      if (blob instanceof Blob && blob.size > 0) {
        console.debug(`[storageAdapter] Filesystem 读取成功: ${path}`);
        return blob;
      }
    }
  } catch (e) {
    console.debug(`[storageAdapter] Filesystem 读取失败: ${path}`);
  }

  // 3️⃣ 全部失败
  throw new Error(`[storageAdapter] 视频读取失败: ${path}`);
}

/**
 * 从 Capacitor Filesystem 读取（返回 base64）
 */
async function readFromFilesystem(path) {
  const fs = await loadFilesystem();
  if (!fs) {
    throw new Error('[storageAdapter] Filesystem 不可用');
  }

  const result = await fs.Filesystem.readFile({
    path: path,
    directory: fs.Directory.Data
  });

  return result.data;
}

/**
 * Base64 转 Blob（内部工具函数，不对外暴露）
 */
function base64ToBlob(base64, mimeType = 'video/mp4') {
  try {
    // 去掉可能的 data:video/mp4;base64, 前缀
    const cleanBase64 = base64.split(',')[1] || base64;
    
    const byteString = atob(cleanBase64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([uint8Array], { type: mimeType });
  } catch (e) {
    console.error('[storageAdapter] base64 转 Blob 失败:', e);
    throw new Error('[storageAdapter] 视频数据转换失败');
  }
}

/**
 * 懒加载 Capacitor Filesystem
 */
async function loadFilesystem() {
  if (_filesystemLoaded) return _filesystemCache;

  try {
    if (window.Capacitor?.Plugins?.Filesystem) {
      const module = window.Capacitor.Plugins.Filesystem;
      const Filesystem = module.Filesystem || module.default?.Filesystem || module;
      const Directory = module.Directory || module.default?.Directory || {
        Documents: 'DOCUMENTS',
        Data: 'DATA',
        Cache: 'CACHE'
      };

      _filesystemCache = { Filesystem, Directory };
      _filesystemLoaded = true;
      return _filesystemCache;
    }
  } catch (e) {
    console.warn('[storageAdapter] Filesystem 加载失败:', e);
  }

  return null;
}

export default {
  getVideoBlob
};

/**
 * 统一保存视频 Blob（OPFS 优先，失败则 fallback 到 Filesystem）
 * @param {string} path - 存储路径
 * @param {Blob} blob - 视频 Blob
 * @returns {string} 最终写入的路径
 */
export async function saveVideoBlob(path, blob) {
  if (!(blob instanceof Blob)) {
    throw new Error(`[storageAdapter] saveVideoBlob 只接受 Blob，收到: ${typeof blob}`);
  }

  if (blob.size === 0) {
    throw new Error('[storageAdapter] 视频 Blob 为空');
  }

  // 1️⃣ 优先尝试 OPFS 写入（最快，原生支持 Blob）
  try {
    await writeToOPFS(path, blob);
    console.debug(`[storageAdapter] OPFS 写入成功: ${path}`);
    return path;
  } catch (e) {
    console.warn(`[storageAdapter] OPFS 写入失败，fallback 到 Filesystem: ${path}`, e.message);
  }

  // 2️⃣ Fallback: Capacitor Filesystem（需要 base64）
  try {
    const base64 = await blobToBase64(blob);
    const finalPath = await writeToFilesystem(path, base64);
    console.debug(`[storageAdapter] Filesystem 写入成功: ${finalPath}`);
    return finalPath;
  } catch (e) {
    console.error(`[storageAdapter] Filesystem 写入也失败: ${path}`, e.message);
    throw new Error(`[storageAdapter] 视频写入失败: ${e.message}`);
  }
}

/**
 * 写入 OPFS
 */
async function writeToOPFS(path, blob) {
  // OPFS 根目录
  const root = await navigator.storage.getDirectory();
  
  // 创建目录结构
  const parts = path.split('/').filter(Boolean);
  let dir = root;
  
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }
  
  // 创建文件
  const fileName = parts[parts.length - 1];
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * 写入 Capacitor Filesystem
 */
async function writeToFilesystem(path, base64) {
  const fs = await loadFilesystem();
  if (!fs) throw new Error('[storageAdapter] Filesystem 不可用');

  // 只保留文件内容部分（去掉 data:video/mp4;base64, 前缀）
  const cleanBase64 = base64.split(',')[1] || base64;

  await fs.Filesystem.writeFile({
    path: path,
    data: cleanBase64,
    directory: fs.Directory.Data,
    recursive: true
  });

  return path;
}

/**
 * Blob 转 Base64（仅用于 Filesystem 写入，内部用）
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
