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
 * 获取可正常显示的媒体源地址（图片/视频/音频通用）
 * 统一处理 Base64、网络图片、Capacitor 本地文件路径
 * 
 * ⚠️ 关键优化：只在原生环境调用 convertFileSrc，Web 端直接返回
 * 
 * @param {string} uri - 媒体 URI（可以是 base64、http 或本地文件路径）
 * @returns {string} 可在 WebView 中正常显示的媒体地址
 */
export function getImageSrc(uri) {
  if (!uri) return '';
  
  // 1. 已经是可访问 URL 的直接返回
  if (uri.startsWith('http') || 
      uri.startsWith('data:') || 
      uri.startsWith('blob:')) {
    return uri;
  }
  
  // 2. ⚠️ 关键：只在原生环境调用 convertFileSrc，Web 端直接用
  const Capacitor = getCapacitor();
  const isNative = !!(
    Capacitor &&
    (
      (typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) ||
      (typeof Capacitor.getPlatform === 'function' && ['android', 'ios'].includes(Capacitor.getPlatform())) ||
      Capacitor.Plugins
    )
  );

  if (isNative) {
    if (typeof Capacitor.convertFileSrc === 'function') {
      return Capacitor.convertFileSrc(uri);
    }
  }
  
  // 非原生环境或不支持转换，直接返回原路径
  return uri;
}

export function getMediaObjectSrc(media) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.displayURL ||
    media.url ||
    media.path ||
    media.filename ||
    media.coverPath ||
    media.cover ||
    '';
}

export function getPodcastCoverSrc(cover) {
  return getImageSrc(getMediaObjectSrc(cover));
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
  getMediaObjectSrc,
  getPodcastCoverSrc,
};
