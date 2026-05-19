/**
 * ✅ 生产级：图片路径统一处理工具
 * 统一处理 Capacitor 文件路径转换，确保图片在原生环境正常显示
 * 
 * 【重要】所有图片显示必须使用此工具，否则会出现"上传成功但不显示"的问题
 */

/**
 * 获取Capacitor对象（每次调用时检查，避免模块加载时还没注入）
 * @returns {object|null} Capacitor对象
 */
function getCapacitor() {
  try {
    return window.Capacitor || null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取可正常显示的图片源地址
 * 统一处理 Base64、网络图片、Capacitor 本地文件路径
 * 
 * @param {string} uri - 图片 URI（可以是 base64、http 或本地文件路径）
 * @returns {string} 可在 WebView 中正常显示的图片地址
 */
export function getImageSrc(uri) {
  if (!uri) return '';
  
  // 1. 已经是 http/https 的网络图片直接返回
  if (uri.startsWith('http')) {
    return uri;
  }
  
  // 2. Base64 编码图片直接返回（虽然方案建议避免，但做兼容处理）
  if (uri.startsWith('data:')) {
    return uri;
  }
  
  // 3. Capacitor 本地文件路径转换（核心：必须转换才能在 WebView 中显示）
  const Capacitor = getCapacitor();
  return Capacitor && typeof Capacitor.convertFileSrc === 'function' 
    ? Capacitor.convertFileSrc(uri) 
    : uri;
}

/**
 * 批量处理图片数组
 * @param {Array} photos - 图片 URI 数组
 * @returns {Array} 处理后的图片地址数组
 */
export function getImageSrcList(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.map(photo => getImageSrc(photo));
}

export default {
  getImageSrc,
  getImageSrcList,
};
