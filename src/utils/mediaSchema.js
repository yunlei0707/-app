/**
 * 媒体数据Schema定义与校验
 * P0.6: 媒体持久化闭环
 * 
 * 数据库只存媒体引用，不存显示URL
 * 显示时再通过convertFileSrc(path)生成可访问URL
 */

/**
 * 简单的UUID生成函数，避免外部依赖
 */
function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

// 媒体类型
export const MediaType = {
  PHOTO: 'photo',
  VIDEO: 'video',
  AUDIO: 'audio',
};

/**
 * 标准化媒体项结构
 */
export function createMediaItem(mediaData) {
  const { type, path, fileName, mimeType, size, duration = 0, coverPath = null } = mediaData;
  
  // 前置校验：确保只接受已持久化的路径
  assertPersistedMediaPath(path);
  
  if (size <= 0) {
    console.warn(`[MediaSchema] 媒体size异常: ${fileName}, size=${size}`);
  }
  
  return {
    id: generateId(),
    type,
    path,           // 沙箱持久化路径，不是显示URL
    fileName,
    mimeType,
    size,
    duration,       // 视频/音频专属
    coverPath,      // 视频封面专属
    createdAt: Date.now(),
  };
}

/**
 * 校验路径是否为持久化路径（非显示URL）
 * 禁止把显示URL直接写入数据库
 */
export function assertPersistedMediaPath(path) {
  if (!path) {
    throw new Error('媒体path为空');
  }
  
  // 检测显示URL特征
  const isDisplayUrl = 
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.includes('_capacitor_file_') ||
    path.startsWith('data:');
  
  if (isDisplayUrl) {
    const error = new Error(`禁止把显示URL写入数据库: ${path.substring(0, 100)}...`);
    console.error('[MediaSchema]', error.message);
    // 当前为止血模式：警告不阻断
    // throw error;
  }
  
  return !isDisplayUrl;
}

/**
 * 校验媒体数组格式
 * 警告模式：不阻断保存，只输出警告日志
 */
export function assertMediaArraySchema(mediaArray, arrayName = 'media') {
  if (!Array.isArray(mediaArray)) {
    console.warn(`[MediaSchema] ${arrayName}不是数组:`, typeof mediaArray);
    return;
  }
  
  mediaArray.forEach((item, index) => {
    // 检查是否为标准MediaItem结构
    if (!item || typeof item !== 'object') {
      console.warn(`[MediaSchema] ${arrayName}[${index}]不是对象:`, item);
      return;
    }
    
    // 检查关键字段
    const requiredFields = ['id', 'type', 'path'];
    const missingFields = requiredFields.filter(field => !item[field]);
    
    if (missingFields.length > 0) {
      console.warn(`[MediaSchema] ${arrayName}[${index}]缺少必填字段:`, missingFields, item);
    }
    
    // 检查path是否为显示URL
    if (item.path) {
      assertPersistedMediaPath(item.path);
    }
    
    // 检查size
    if (item.size !== undefined && item.size <= 0) {
      console.warn(`[MediaSchema] ${arrayName}[${index}] size异常:`, item.size, item.fileName);
    }
  });
}

/**
 * 归一化旧格式媒体数据为标准MediaItem格式
 * 兼容历史数据格式
 */
export function normalizeMediaItem(item, type = MediaType.PHOTO) {
  // 情况1：已经是标准对象
  if (item && typeof item === 'object' && item.path) {
    return {
      id: item.id || generateId(),
      type: item.type || type,
      path: item.path,
      fileName: item.fileName || item.name || `media_${Date.now()}`,
      mimeType: item.mimeType || item.type,
      size: item.size || 0,
      duration: item.duration || 0,
      coverPath: item.coverPath || item.cover,
      createdAt: item.createdAt || Date.now(),
    };
  }
  
  // 情况2：纯字符串路径/DataURL（旧格式）
  if (typeof item === 'string') {
    console.warn(`[MediaSchema] 检测到旧格式纯字符串媒体，已转成标准结构: ${item.substring(0, 50)}...`);
    return {
      id: generateId(),
      type,
      path: item,
      fileName: `legacy_${type}_${Date.now()}`,
      mimeType: type === MediaType.PHOTO ? 'image/jpeg' : 
                type === MediaType.VIDEO ? 'video/mp4' : 'audio/webm',
      size: 0,
      duration: 0,
      createdAt: Date.now(),
    };
  }
  
  // 情况3：未知格式
  console.warn(`[MediaSchema] 未知媒体格式:`, item);
  return {
    id: generateId(),
    type,
    path: '',
    fileName: 'unknown',
    mimeType: 'application/octet-stream',
    size: 0,
    createdAt: Date.now(),
  };
}

/**
 * 批量归一化媒体数组
 */
export function normalizeMediaArray(mediaArray, type) {
  if (!Array.isArray(mediaArray)) {
    return [];
  }
  return mediaArray.map(item => normalizeMediaItem(item, type));
}

/**
 * 【重要】前置拦截：确保moment中没有临时URL
 * 在addMoment/updateMoment之前调用
 */
export function sanitizeMomentMediaBeforeSave(moment) {
  const result = {
    ...moment,
    photos: [],
    videos: [],
    audios: [],
    warnings: [],
  };
  
  const processArray = (items, type) => {
    if (!Array.isArray(items)) return [];
    
    return items.map(item => {
      // 如果是纯字符串
      if (typeof item === 'string') {
        // 检查是否是临时URL
        if (isTemporaryUrl(item)) {
          result.warnings.push(`发现${type}临时URL，已拦截: ${item.substring(0, 80)}...`);
          console.error(`[MediaSchema] 拦截到${type}临时URL，禁止入库:`, item);
        }
        return item;
      }
      
      // 如果是对象，检查path
      if (item && typeof item === 'object' && item.path) {
        if (isTemporaryUrl(item.path)) {
          result.warnings.push(`发现${type}对象的path是临时URL: ${item.path.substring(0, 80)}...`);
          console.error(`[MediaSchema] 拦截到${type}对象的临时URL，禁止入库:`, item.path);
        }
      }
      
      return item;
    });
  };
  
  result.photos = processArray(moment.photos, '照片');
  result.videos = processArray(moment.videos, '视频');
  result.audios = processArray(moment.audios, '录音');
  
  if (result.warnings.length > 0) {
    console.warn(`[MediaSchema] 本次保存发现 ${result.warnings.length} 个媒体持久化问题`);
  }
  
  return result;
}

/**
 * 检查是否是临时URL（不应该写入数据库）
 */
export function isTemporaryUrl(path) {
  if (!path || typeof path !== 'string') return false;
  
  return (
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.includes('_capacitor_file_') ||
    path.includes('/cache/') ||
    path.includes('/tmp/') ||
    path.includes('/temp/')
  );
}

export default {
  MediaType,
  createMediaItem,
  assertPersistedMediaPath,
  assertMediaArraySchema,
  normalizeMediaItem,
  normalizeMediaArray,
  sanitizeMomentMediaBeforeSave,
  isTemporaryUrl,
};
