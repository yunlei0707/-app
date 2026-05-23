/**
 * 媒体持久化工具
 * P0.6: 媒体持久化闭环
 * 
 * 负责：
 * 1. 将Blob/File写入文件系统沙箱
 * 2. 返回真实的持久化路径
 * 3. 读取媒体文件
 */

import { MediaType, createMediaItem, assertPersistedMediaPath } from './mediaSchema';

// 媒体存储目录
const MEDIA_DIRS = {
  [MediaType.PHOTO]: 'media/photos',
  [MediaType.VIDEO]: 'media/videos',
  [MediaType.AUDIO]: 'media/audios',
};

/**
 * 检测当前运行环境
 */
function getEnvironment() {
  if (typeof window === 'undefined') {
    return 'server';
  }
  
  // Capacitor原生环境
  if (window.Capacitor?.isNativePlatform()) {
    return 'capacitor';
  }
  
  // 浏览器环境
  return 'browser';
}

/**
 * 获取文件系统操作对象
 */
async function getFileSystem() {
  const env = getEnvironment();
  
  if (env === 'capacitor') {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    return {
      type: 'capacitor',
      Filesystem,
      Directory,
    };
  }
  
  // 浏览器环境使用OPFS
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    const root = await navigator.storage.getDirectory();
    return {
      type: 'opfs',
      root,
    };
  }
  
  return { type: 'none' };
}

/**
 * DataURL转Blob
 */
export function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * File转Blob
 */
export function fileToBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([reader.result], { type: file.type }));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 生成唯一文件名
 */
function generateFileName(type, extension) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${type}_${timestamp}_${random}.${extension}`;
}

/**
 * 从MIME类型获取文件扩展名
 */
function getExtensionFromMime(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
  };
  return map[mimeType] || 'bin';
}

/**
 * 将Blob持久化到文件系统（Capacitor）
 */
async function saveBlobToCapacitor(blob, type, fileName, Filesystem, Directory) {
  // Blob转Base64
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
  
  const dir = MEDIA_DIRS[type];
  const path = `${dir}/${fileName}`;
  
  // 确保目录存在
  try {
    await Filesystem.mkdir({
      path: dir,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e) {
    // 目录已存在，忽略
  }
  
  // 写入文件
  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
  
  return path;
}

/**
 * 将Blob持久化到文件系统（OPFS）
 */
async function saveBlobToOPFS(blob, type, fileName, root) {
  const dirPath = MEDIA_DIRS[type].split('/');
  
  // 确保目录存在
  let currentDir = root;
  for (const dirName of dirPath) {
    currentDir = await currentDir.getDirectoryHandle(dirName, { create: true });
  }
  
  // 写入文件
  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  
  return `${MEDIA_DIRS[type]}/${fileName}`;
}

/**
 * 保存媒体到持久化存储
 * @param {Blob|File} blob - 媒体Blob或File对象
 * @param {string} type - 媒体类型（MediaType.PHOTO/VIDEO/AUDIO）
 * @param {Object} options - 选项：fileName, mimeType, duration, coverBlob
 * @returns {Promise<Object>} 标准MediaItem
 */
export async function saveMedia(blob, type, options = {}) {
  if (!blob) {
    throw new Error('媒体Blob不能为空');
  }
  
  const fs = await getFileSystem();
  const mimeType = options.mimeType || blob.type || 'application/octet-stream';
  const extension = getExtensionFromMime(mimeType);
  const fileName = options.fileName || generateFileName(type, extension);
  const size = blob.size;
  const duration = options.duration || 0;
  
  let path = null;
  
  try {
    if (fs.type === 'capacitor') {
      path = await saveBlobToCapacitor(blob, type, fileName, fs.Filesystem, fs.Directory);
    } else if (fs.type === 'opfs') {
      path = await saveBlobToOPFS(blob, type, fileName, fs.root);
    } else {
      // 不支持文件系统，回退到DataURL（仅作为降级方案）
      console.warn('[MediaPersistence] 文件系统不支持，使用DataURL作为降级方案');
      path = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    
    // 处理视频封面
    let coverPath = null;
    if (type === MediaType.VIDEO && options.coverBlob) {
      const coverExt = getExtensionFromMime(options.coverBlob.type || 'image/jpeg');
      const coverFileName = `cover_${fileName.replace(/\.[^.]+$/, '')}.${coverExt}`;
      
      if (fs.type === 'capacitor') {
        coverPath = await saveBlobToCapacitor(options.coverBlob, type, coverFileName, fs.Filesystem, fs.Directory);
      } else if (fs.type === 'opfs') {
        coverPath = await saveBlobToOPFS(options.coverBlob, type, coverFileName, fs.root);
      }
    }
    
    // 创建标准MediaItem
    const mediaItem = createMediaItem({
      type,
      path,
      fileName,
      mimeType,
      size,
      duration,
      coverPath,
    });
    
    console.log(`[MediaPersistence] 媒体持久化成功: ${type}, ${fileName}, size=${size}`);
    return mediaItem;
    
  } catch (error) {
    console.error('[MediaPersistence] 媒体持久化失败:', error);
    throw error;
  }
}

/**
 * 保存图片
 */
export async function savePhoto(blobOrFile, options = {}) {
  const blob = blobOrFile instanceof File ? await fileToBlob(blobOrFile) : blobOrFile;
  return saveMedia(blob, MediaType.PHOTO, {
    mimeType: blobOrFile.type,
    fileName: blobOrFile.name,
    ...options,
  });
}

/**
 * 保存视频
 */
export async function saveVideo(blobOrFile, options = {}) {
  const blob = blobOrFile instanceof File ? await fileToBlob(blobOrFile) : blobOrFile;
  return saveMedia(blob, MediaType.VIDEO, {
    mimeType: blobOrFile.type,
    fileName: blobOrFile.name,
    ...options,
  });
}

/**
 * 保存音频
 */
export async function saveAudio(blobOrFile, options = {}) {
  const blob = blobOrFile instanceof File ? await fileToBlob(blobOrFile) : blobOrFile;
  return saveMedia(blob, MediaType.AUDIO, {
    mimeType: blobOrFile.type || 'audio/webm',
    ...options,
  });
}

/**
 * 从持久化路径获取可显示的URL
 * 显示时调用，不存入数据库
 */
export async function getDisplayUrl(path) {
  if (!path) return null;
  
  // 如果已经是可显示URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://') || 
      path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  
  const fs = await getFileSystem();
  
  try {
    if (fs.type === 'capacitor') {
      const { Capacitor } = await import('@capacitor/core');
      const { Filesystem, Directory } = fs;
      
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Data,
      });
      
      // 返回DataURL
      const mimeType = path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'image/jpeg' :
                       path.endsWith('.png') ? 'image/png' :
                       path.endsWith('.mp4') ? 'video/mp4' :
                       path.endsWith('.webm') ? (path.includes('video') ? 'video/webm' : 'audio/webm') :
                       'application/octet-stream';
      
      return `data:${mimeType};base64,${result.data}`;
    } else if (fs.type === 'opfs') {
      // OPFS路径转Blob URL
      const dirPath = path.split('/');
      const fileName = dirPath.pop();
      
      let currentDir = fs.root;
      for (const dirName of dirPath) {
        currentDir = await currentDir.getDirectoryHandle(dirName);
      }
      
      const fileHandle = await currentDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    }
  } catch (error) {
    console.error('[MediaPersistence] 读取媒体失败:', path, error);
  }
  
  return path;
}

/**
 * 删除持久化媒体
 */
export async function deleteMedia(path) {
  if (!path) return;
  
  // 不删除显示URL
  if (!assertPersistedMediaPath(path)) {
    return;
  }
  
  const fs = await getFileSystem();
  
  try {
    if (fs.type === 'capacitor') {
      await fs.Filesystem.deleteFile({
        path,
        directory: fs.Directory.Data,
      });
    } else if (fs.type === 'opfs') {
      const dirPath = path.split('/');
      const fileName = dirPath.pop();
      
      let currentDir = fs.root;
      for (const dirName of dirPath) {
        currentDir = await currentDir.getDirectoryHandle(dirName);
      }
      
      await currentDir.removeEntry(fileName);
    }
    
    console.log(`[MediaPersistence] 媒体删除成功: ${path}`);
  } catch (error) {
    console.error('[MediaPersistence] 媒体删除失败:', path, error);
  }
}

export default {
  MediaType,
  dataURLToBlob,
  fileToBlob,
  saveMedia,
  savePhoto,
  saveVideo,
  saveAudio,
  getDisplayUrl,
  deleteMedia,
};
