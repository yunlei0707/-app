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
 *
 * 🔥 ID 稳定性保证（P0）：
 *   优先级：existing.id → hash → path-based-id → 兜底 uuid
 *   确保同一个媒体每次 normalize 得到相同的 id，避免导出/fileMap 错乱
 */

import { v4 as uuidv4 } from 'uuid';
import { MEDIA_TYPES, REQUIRED_FIELDS } from '../types/media.js';

/**
 * 🔥 生成稳定的媒体 ID（基于路径的简单 hash）
 * 不依赖复杂计算，确保速度
 */
function generateStableId(path, seed = '') {
  const str = path + seed;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `media_${Math.abs(hash).toString(36)}`;
}

/**
 * 将任意格式的媒体数据归一化为标准 MediaItem
 * @param {string|Object} input - 任意格式的媒体数据
 * @param {'photo'|'video'|'audio'} defaultType - 默认类型（如果输入无法推断）
 * @returns {Object|null} 标准 MediaItem 或 null（无法识别时）
 */
export function normalizeMediaItem(input, defaultType = 'photo') {
  // case 1: 纯字符串路径（最常见）
  if (typeof input === 'string') {
    return createMediaItemFromPath(input, defaultType, {});
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
      id: input.id, // 🔴 P0：保留已有 id，保证稳定性
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
 * 
 * 🔥 ID 稳定化策略：
 *   1. existing.id - 如果输入已有 id，优先使用
 *   2. hash - 如果有文件 hash，使用
 *   3. path-based-id - 基于路径生成稳定 id
 *   4. uuidv4() - 兜底，仅当以上都不可用时
 * 
 * 确保：同一个媒体文件每次 normalize 得到相同的 id
 */
function createMediaItemFromPath(path, type, metadata = {}) {
  const now = Date.now();
  const defaultExt = type === 'photo' ? 'jpg' : type === 'video' ? 'mp4' : 'm4a';
  const fileName = metadata.fileName || path.split('/').pop() || `media_${now}.${defaultExt}`;
  
  // 🔴 P0：ID 稳定化 - 优先级：existing.id → hash → path-based-id → uuid
  let id;
  if (metadata.id) {
    id = metadata.id; // 最高优先级：保留已有的 id
  } else if (metadata.hash) {
    id = `media_${metadata.hash.slice(0, 12)}`; // 其次：基于 hash 生成
  } else if (path && path.length > 0) {
    id = generateStableId(path, fileName); // 再次：基于路径 + 文件名生成稳定 id
  } else {
    id = uuidv4(); // 兜底：仅当完全无法推断时才用随机 uuid
  }
  
  return {
    id,
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
 * 🔥 Schema 防线 - 写入数据库前的强制校验
 * 
 * 🔴 P0.5：防止未来继续熵增
 * 
 * 不符合 MediaItem 标准的直接抛出异常，禁止写入数据库。
 * 这是架构稳定化的最后一道防线，确保：
 *   - 不会出现第四套、第五套媒体结构
 *   - 所有新数据都符合统一标准
 * 
 * @param {Object} item - 待写入的媒体对象
 * @throws 如果校验失败，抛出异常阻止写入
 */
export function assertMediaSchema(item) {
  const result = validateMediaItem(item);
  
  if (!result.valid) {
    const errorMsg = `[MediaSchema] 写入被拒绝！不符合标准结构: ${result.errors.join(', ')}`;
    console.error(errorMsg, item);
    throw new Error(errorMsg);
  }
  
  return true;
}

/**
 * 🔥 批量校验媒体数组 Schema
 * 
 * @param {Object[]} mediaArray - 待校验的媒体数组
 * @throws 如果有任何一项校验失败，抛出异常
 */
export function assertMediaArraySchema(mediaArray) {
  if (!Array.isArray(mediaArray)) {
    const errorMsg = '[MediaSchema] 写入被拒绝！media 必须是数组';
    console.error(errorMsg, mediaArray);
    throw new Error(errorMsg);
  }
  
  mediaArray.forEach(item => assertMediaSchema(item));
  return true;
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
 * - media[] 新统一格式
 *
 * 🟡 P1：同时返回扁平数组和分类数组
 *   - media: MediaItem[] - 所有媒体（推荐使用，导出/导入最方便）
 *   - photos: MediaItem[] - 仅照片
 *   - videos: MediaItem[] - 仅视频
 *   - audios: MediaItem[] - 仅音频
 *
 * @param {Object} moment - 动态对象（任意版本）
 * @returns {Object} { media: MediaItem[], photos: MediaItem[], videos: MediaItem[], audios: MediaItem[] }
 */
export function normalizeMomentMedia(moment) {
  if (!moment) return { media: [], photos: [], videos: [], audios: [] };

  // ========== 1. 优先读取新格式 media[]（唯一标准） ==========
  if (Array.isArray(moment.media) && moment.media.length > 0) {
    const media = moment.media.map(item => normalizeMediaItem(item)).filter(Boolean);
    return {
      media,
      photos: media.filter(m => m.type === 'photo'),
      videos: media.filter(m => m.type === 'video'),
      audios: media.filter(m => m.type === 'audio'),
    };
  }

  // ========== 2. 否则，从所有旧格式字段中收集 ==========
  const photoSources = [
    ...(Array.isArray(moment.photos) ? moment.photos : []),
    ...(Array.isArray(moment.images) ? moment.images : []),
    ...(Array.isArray(moment.photoList) ? moment.photoList : []),
    // 单个图片字段
    ...(moment.photo ? [moment.photo] : []),
    ...(moment.image ? [moment.image] : []),
  ];

  // ========== 3. 收集所有可能的视频字段 ==========
  const videoSources = [
    ...(Array.isArray(moment.videos) ? moment.videos : []),
    ...(Array.isArray(moment.videoList) ? moment.videoList : []),
    // 单个视频字段
    ...(moment.video ? [moment.video] : []),
  ];

  // ========== 4. 收集所有可能的音频字段 ==========
  const audioSources = [
    ...(Array.isArray(moment.audios) ? moment.audios : []),
    ...(Array.isArray(moment.recordings) ? moment.recordings : []),
    ...(Array.isArray(moment.audioList) ? moment.audioList : []),
    // 单个音频字段
    ...(moment.audio ? [moment.audio] : []),
    ...(moment.recording ? [moment.recording] : []),
    ...(moment.audioUrl ? [moment.audioUrl] : []),
  ];

  // ========== 5. 归一化并分类 ==========
  const normalizedPhotos = photoSources.map(item => normalizeMediaItem(item, 'photo')).filter(Boolean);
  const normalizedVideos = videoSources.map(item => normalizeMediaItem(item, 'video')).filter(Boolean);
  const normalizedAudios = audioSources.map(item => normalizeMediaItem(item, 'audio')).filter(Boolean);

  // ========== 6. 去重（同一路径只保留一个） ==========
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

  // 🟡 P1：同时返回扁平数组和分类数组
  // 导出/导入推荐直接使用 media[]，页面渲染可用分类数组
  const media = [...photos, ...videos, ...audios];
  
  return { media, photos, videos, audios };
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
  const { media, photos, videos, audios } = normalizeMomentMedia(moment);

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
