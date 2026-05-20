/**
 * 文件工具函数
 */
import { Capacitor } from '@capacitor/core';

/**
 * 获取用于显示的文件路径
 * ✅ 只在原生环境调用 Capacitor.convertFileSrc，Web 端直接用
 * 
 * @param {string} path - 文件路径
 * @returns {string} 可用于 img/video/audio src 的路径
 */
export function getDisplaySrc(path) {
  if (!path) return '';
  
  // 已经是可访问 URL 的直接返回
  if (path.startsWith('data:') || 
      path.startsWith('http') || 
      path.startsWith('blob:')) {
    return path;
  }
  
  // ⚠️ 关键：只在原生环境转换，Web 端不需要
  if (Capacitor.isNativePlatform()) {
    return Capacitor.convertFileSrc(path);
  }
  
  // Web 端直接返回原路径
  return path;
}

/**
 * 从文件名获取 MIME 类型
 */
export function getMimeTypeFromFileName(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Blob 转 Base64（仅返回数据部分，不包含前缀）
 */
export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      resolve(base64.split(',')[1]); // 只返回数据部分
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
