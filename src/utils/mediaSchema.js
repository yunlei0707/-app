/**
 * 🛡️ Media Schema 校验与转换工具
 *
 * 职责：只做一件事 - 把任何旧格式统一成标准 MediaItem
 *
 * 兼容范围：
 * - ✅ 纯字符串路径 → MediaItem
 * - ✅ { url } → MediaItem
 * - ✅ { path } → MediaItem
 * - ✅ { filename } → MediaItem
 * - ✅ { audioUrl, recording } → MediaItem（音频特殊兼容）
 * - ❌ 完全无法识别 → 返回 null 并打 warn 日志
 *
 * 架构原则：所有层统一调用，不要自己猜字段名
 */

import { v4 as uuidv4 } from 'uuid';
import { MEDIA_TYPES, REQUIRED_FIELDS } from '../types/media.js';

/**
 * 将任意格式的媒体数据归一化为标准 MediaItem
 * @param {string|Object} input - 任意格式的媒体数据
 * @param {'photo'|'video'|'audio'} defaultType - 默认类型（如果输入无法推断）
 * @returns {Object|null} 标准 MediaItem 或 null（无法识别时）
 */
export function normalizeMediaItem(input, defaultType = 'photo') {
  // case 1: 纯字符串路径（最常见）
  if (typeof input === 'string') {
    return createMediaItemFromPath(input, defaultType);
  }

  // case 2: 已经是标准/接近标准的对象
  if (input && typeof input === 'object') {
    // 从旧格式的各种可能字段中提取 path
    const path = input.path || input.url || input.filename || input.opfsPath || input.audioUrl || '';
    
    if (!path) {
      console.warn('[MediaSchema] 无法识别的媒体对象，缺少路径字段:', input);
      return null;
    }

    // 提取元数据（兼容各种旧字段名）
    const type = input.type || inferMediaTypeFromPath(path) || defaultType;
    const fileName = input.fileName || input.name || input.filename || path.split('/').pop() || 'unknown';
    
    return createMediaItemFromPath(path, type, {
      fileName,
      mimeType: input.mimeType,
      duration: input.duration,
      size: input.size,
      hash: input.hash,
      coverPath: input.coverPath || input.cover,
      waveform: input.waveform,
      createdAt: input.createdAt,
    });
  }

  console.warn('[MediaSchema] 无法识别的媒体输入类型:', typeof input, input);
  return null;
}

/**
 * 从路径创建标准 MediaItem（内部工具）
 */
function createMediaItemFromPath(path, type, metadata = {}) {
  const now = Date.now();
  const defaultExt = type === 'photo' ? 'jpg' : type === 'video' ? 'mp4' : 'm4a';
  const fileName = metadata.fileName || path.split('/').pop() || `media_${now}.${defaultExt}`;
  
  return {
    id: uuidv4(),
    type: inferMediaTypeFromPath(path) || type,
    path,
    fileName,
    mimeType: metadata.mimeType || `application/octet-stream`,
    size: metadata.size || 0,
    createdAt: metadata.createdAt || now,
    // 可选字段 - 不存在就不填
    ...(metadata.duration !== undefined && { duration: metadata.duration }),
    ...(metadata.coverPath !== undefined && { coverPath: metadata.coverPath }),
    ...(metadata.waveform !== undefined && { waveform: metadata.waveform }),
    ...(metadata.hash !== undefined && { hash: metadata.hash }),
  };
}

/**
 * 从文件路径推断媒体类型
 */
export function inferMediaTypeFromPath(path) {
  if (!path || typeof path !== 'string') return null;

  const ext = path.split('.').pop().toLowerCase();

  const photoExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
  const audioExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];

  if (photoExts.includes(ext)) return MEDIA_TYPES.PHOTO;
  if (videoExts.includes(ext)) return MEDIA_TYPES.VIDEO;
  if (audioExts.includes(ext)) return MEDIA_TYPES.AUDIO;

  return null;
}

/**
 * 校验 MediaItem 是否符合标准（宽松校验，只检查必填字段存在）
 * @param {Object} item - 待校验的媒体对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMediaItem(item) {
  const errors = [];

  if (!item || typeof item !== 'object') {
    errors.push('不是有效的对象');
    return { valid: false, errors };
  }

  // 只检查必填字段是否存在，不要求完整的 hash 等
  for (const field of REQUIRED_FIELDS) {
    if (item[field] === undefined || item[field] === null || item[field] === '') {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  // 检查 type 是否合法
  if (!Object.values(MEDIA_TYPES).includes(item.type)) {
    errors.push(`无效的媒体类型: ${item.type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 批量归一化媒体数组
 */
export function normalizeMediaArray(items, defaultType = 'photo') {
  if (!Array.isArray(items)) return [];

  return items
    .map(item => normalizeMediaItem(item, defaultType))
    .filter(Boolean);
}

/**
 * 🛡️ 归一化单个动态的所有媒体 - 这是唯一的媒体读取入口
 *
 * 所有页面读取动态的媒体时，必须先调用此函数！
 * 不要自己分别读 photos/videos/audios/audioUrl/recording 等字段
 *
 * 兼容所有历史格式：
 * - photos/videos/audios 数组
 * - photo/video/audio 单个对象
 * - audioUrl / recording 旧字段
 * - 纯字符串路径
 * - { url } / { path } / { filename } 对象
 *
 * @param {Object} moment - 动态对象（任意版本）
 * @returns {Object} { photos: MediaItem[], videos: MediaItem[], audios: MediaItem[] }
 */
export function normalizeMomentMedia(moment) {
  if (!moment) return { photos: [], videos: [], audios: [] };

  const allMedia = [];

  // ========== 1. 收集所有可能的照片字段 ==========
  const photoSources = [
    ...(Array.isArray(moment.photos) ? moment.photos : []),
    ...(Array.isArray(moment.images) ? moment.images : []),
    ...(Array.isArray(moment.photoList) ? moment.photoList : []),
    // 单个图片字段
    ...(moment.photo ? [moment.photo] : []),
    ...(moment.image ? [moment.image] : []),
  ];

  // ========== 2. 收集所有可能的视频字段 ==========
  const videoSources = [
    ...(Array.isArray(moment.videos) ? moment.videos : []),
    ...(Array.isArray(moment.videoList) ? moment.videoList : []),
    // 单个视频字段
    ...(moment.video ? [moment.video] : []),
  ];

  // ========== 3. 收集所有可能的音频字段 ==========
  const audioSources = [
    ...(Array.isArray(moment.audios) ? moment.audios : []),
    ...(Array.isArray(moment.recordings) ? moment.recordings : []),
    ...(Array.isArray(moment.audioList) ? moment.audioList : []),
    // 单个音频字段
    ...(moment.audio ? [moment.audio] : []),
    ...(moment.recording ? [moment.recording] : []),
    ...(moment.audioUrl ? [moment.audioUrl] : []),
  ];

  // ========== 4. 归一化并分类 ==========
  const normalizedPhotos = photoSources.map(item => normalizeMediaItem(item, 'photo')).filter(Boolean);
  const normalizedVideos = videoSources.map(item => normalizeMediaItem(item, 'video')).filter(Boolean);
  const normalizedAudios = audioSources.map(item => normalizeMediaItem(item, 'audio')).filter(Boolean);

  // ========== 5. 去重（同一路径只保留一个） ==========
  const seenPaths = new Set();
  
  const photos = normalizedPhotos.filter(m => {
    if (seenPaths.has(m.path)) return false;
    seenPaths.add(m.path);
    return true;
  });
  
  const videos = normalizedVideos.filter(m => {
    if (seenPaths.has(m.path)) return false;
    seenPaths.add(m.path);
    return true;
  });
  
  const audios = normalizedAudios.filter(m => {
    if (seenPaths.has(m.path)) return false;
    seenPaths.add(m.path);
    return true;
  });

  return { photos, videos, audios };
}

/**
 * 🛡️ 归一化整个动态 - 将任意旧格式动态转成统一的新格式
 *
 * 这是全项目读取动态数据的唯一入口！
 * 所有页面读动态时都应该先调用这个函数。
 *
 * @param {Object} moment - 动态对象（任意版本）
 * @returns {Object} 统一格式的动态对象
 */
export function normalizeMoment(moment) {
  if (!moment) return null;

  // 先归一化所有媒体
  const { photos, videos, audios } = normalizeMomentMedia(moment);

  // 返回统一格式
  return {
    ...moment,
    // ✅ 统一的媒体数组 - 所有新代码只读这个！
    media: [
      ...photos,
      ...videos,
      ...audios,
    ],
    // 保留旧字段，向下兼容
    photos,
    videos,
    audios,
  };
}
