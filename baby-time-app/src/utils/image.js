/**
 * 图片处理工具函数
 */

/**
 * 获取图片显示URL
 * 处理base64、blob URL、本地路径等多种格式
 */
export function getImageSrc(image) {
  if (!image) return '';
  
  // 已经是完整URL
  if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('blob:') || image.startsWith('data:'))) {
    return image;
  }
  
  // 图片对象
  if (image && typeof image === 'object') {
    if (image.url) return image.url;
    if (image.thumbnail) return image.thumbnail;
    if (image.base64) return image.base64;
    if (image.filename) return image.filename;
  }
  
  // 字符串类型的文件名
  if (typeof image === 'string') {
    return image;
  }
  
  return '';
}

/**
 * 计算图片哈希（用于去重）
 */
export async function calculateImageHash(file) {
  if (!file) return '';
  
  try {
    // 对于Blob/File对象
    if (file instanceof Blob || file instanceof File) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // 对于base64字符串
    if (typeof file === 'string' && file.startsWith('data:')) {
      const base64 = file.split(',')[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('计算图片哈希失败:', e);
  }
  
  return '';
}

export default {
  getImageSrc,
  calculateImageHash
};
