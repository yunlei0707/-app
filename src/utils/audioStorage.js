/**
 * 音频文件存储工具
 * 使用 IndexedDB 直接存储 Blob，避免 Base64 编码的内存开销
 * 
 * 设计原则：
 * 1. 大音频文件存 Blob，数据库只存 fileId 引用
 * 2. 支持新旧数据兼容（旧数据 Base64 继续支持）
 * 3. 内存友好：不将整个文件读入内存做编码
 */

const DB_NAME = 'BabyAudioDB';
const STORE_NAME = 'audioFiles';
const DB_VERSION = 1;

// 支持的音频格式映射
const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac'
};

// 支持的文件扩展名列表
const SUPPORTED_AUDIO_EXTENSIONS = Object.keys(AUDIO_MIME_TYPES);

/**
 * 检查文件名是否有扩展名
 * @param {string} filename - 文件名
 * @returns {boolean} 是否有扩展名
 */
export function hasFileExtension(filename) {
  if (!filename) return false;
  return filename.lastIndexOf('.') > 0;
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（包含点），无扩展名则返回空字符串
 */
export function getFileExtension(filename) {
  if (!filename || !hasFileExtension(filename)) return '';
  return filename.toLowerCase().substring(filename.lastIndexOf('.'));
}

/**
 * 根据文件名推断音频 MIME type
 * @param {string} filename - 文件名
 * @param {string} fileType - File 对象的 type 属性（可选）
 * @returns {string} 推断的 MIME type
 */
export function inferAudioMimeType(filename, fileType = '') {
  // 1. 优先使用 File.type
  if (fileType && fileType !== 'application/octet-stream') {
    return fileType;
  }
  
  // 2. 其次用扩展名推断
  if (filename && hasFileExtension(filename)) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (AUDIO_MIME_TYPES[ext]) {
      return AUDIO_MIME_TYPES[ext];
    }
  }
  
  // 3. 都没有就默认 audio/mpeg
  return 'audio/mpeg';
}

/**
 * 检查文件是否为支持的音频格式
 * - 无扩展名的文件返回 true（先允许上传，后续提示用户）
 * - 有扩展名的才检查是否在支持列表中
 * 
 * @param {string} filename - 文件名
 * @returns {boolean} 是否支持
 */
export function isSupportedAudioFormat(filename) {
  if (!filename) return false;
  
  // 无扩展名的文件，返回 true（允许上传，后续提示）
  if (!hasFileExtension(filename)) {
    return true;
  }
  
  // 有扩展名的才检查是否在支持列表中
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
}

// 数据库实例缓存
let dbInstance = null;

/**
 * 初始化数据库
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    // 如果已有实例，直接返回
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[AudioStorage] 数据库打开失败');
      reject(new Error('音频数据库打开失败'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[AudioStorage] 数据库打开成功');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // 创建对象存储空间，使用 fileId 作为主键
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
        // 创建索引：按创建时间查询
        store.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[AudioStorage] 对象存储空间创建成功');
      }
    };
  });
}

/**
 * 确保数据库已初始化
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
async function ensureDB() {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance;
}

/**
 * 生成唯一的文件ID
 * @param {string} prefix - 前缀（如 podcast、audio）
 * @returns {string} 唯一文件ID
 */
export function generateFileId(prefix = 'audio') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 保存音频文件到 IndexedDB
 * @param {string} fileId - 文件唯一标识
 * @param {Blob|File} blob - 音频文件 Blob
 * @param {Object} metadata - 元数据（可选）
 * @returns {Promise<string>} fileId
 */
export async function saveAudioFile(fileId, blob, metadata = {}) {
  console.log('[AudioStorage] ===== saveAudioFile 开始 ====');
  console.log('[AudioStorage] fileId:', fileId);
  console.log('[AudioStorage] 原始 Blob:', {
    size: blob?.size,
    type: blob?.type,
    instanceOfBlob: blob instanceof Blob
  });
  
  if (!fileId) {
    console.error('[AudioStorage] fileId 不能为空');
    throw new Error('fileId 不能为空');
  }
  if (!blob || !(blob instanceof Blob)) {
    console.error('[AudioStorage] 无效的音频文件 Blob');
    throw new Error('无效的音频文件 Blob');
  }

  // 保留原始 Blob 的 MIME type，只有当 type 为空时才用 audio/mpeg 作为 fallback
  let audioBlob = blob;
  if (!blob.type) {
    console.warn('[AudioStorage] Blob MIME type 为空，使用 fallback audio/mpeg');
    audioBlob = new Blob([blob], { type: 'audio/mpeg' });
  } else if (blob.type === 'application/octet-stream') {
    console.warn('[AudioStorage] Blob MIME type 为 application/octet-stream，保持不变');
  }
  // 其他情况直接使用原始 type，不强制修改

  const db = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const audioRecord = {
      fileId,
      blob: audioBlob,
      size: audioBlob.size,
      type: audioBlob.type,
      createdAt: new Date().toISOString(),
      ...metadata
    };
    
    console.log('[AudioStorage] 保存的 audioRecord:', {
      fileId: audioRecord.fileId,
      size: audioRecord.size,
      type: audioRecord.type,
      hasBlob: !!audioRecord.blob
    });

    const request = store.put(audioRecord);

    request.onsuccess = () => {
      console.log(`[AudioStorage] 音频保存成功: ${fileId}, 大小: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB, type: ${audioBlob.type}`);
      console.log('[AudioStorage] ===== saveAudioFile 成功 ====');
      resolve(fileId);
    };

    request.onerror = () => {
      console.error(`[AudioStorage] 音频保存失败: ${fileId}`);
      console.error('[AudioStorage] IndexedDB 错误:', request.error);
      reject(new Error('音频保存失败: ' + (request.error?.message || '未知错误')));
    };
  });
}

/**
 * 从 IndexedDB 获取音频文件 Blob
 * @param {string} fileId - 文件唯一标识
 * @returns {Promise<Blob|null>} 音频 Blob，不存在则返回 null
 */
export async function getAudioFile(fileId) {
  console.log('[AudioStorage] ===== getAudioFile 开始 ====');
  console.log('[AudioStorage] fileId:', fileId);
  
  if (!fileId) {
    console.error('[AudioStorage] fileId 为空');
    return null;
  }

  const db = await ensureDB();
  console.log('[AudioStorage] 数据库已连接');

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(fileId);

    request.onsuccess = () => {
      const result = request.result;
      console.log('[AudioStorage] IndexedDB 查询结果:', result ? '找到记录' : '未找到记录');
      
      if (result) {
        console.log('[AudioStorage] 记录详情:', {
          fileId: result.fileId,
          size: result.size,
          type: result.type,
          hasBlob: !!result.blob,
          blobInstanceOfBlob: result.blob instanceof Blob
        });
        
        if (!result.blob) {
          console.error('[AudioStorage] 记录存在但 blob 为空!');
          resolve(null);
          return;
        }
        
        console.log(`[AudioStorage] 音频读取成功: ${fileId}, 大小: ${(result.blob.size / 1024 / 1024).toFixed(2)}MB`);
        console.log('[AudioStorage] ===== getAudioFile 成功 ====');
        resolve(result.blob);
      } else {
        console.warn(`[AudioStorage] 音频不存在: ${fileId}`);
        console.warn('[AudioStorage] ===== getAudioFile 返回 null ====');
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error(`[AudioStorage] 音频读取失败: ${fileId}`);
      console.error('[AudioStorage] IndexedDB 错误:', request.error);
      reject(new Error('音频读取失败: ' + (request.error?.message || '未知错误')));
    };
  });
}

/**
 * 删除音频文件
 * @param {string} fileId - 文件唯一标识
 * @returns {Promise<boolean>} 是否删除成功
 */
export async function deleteAudioFile(fileId) {
  if (!fileId) {
    return false;
  }

  const db = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(fileId);

    request.onsuccess = () => {
      console.log(`[AudioStorage] 音频删除成功: ${fileId}`);
      resolve(true);
    };

    request.onerror = () => {
      console.error(`[AudioStorage] 音频删除失败: ${fileId}`);
      reject(new Error('音频删除失败'));
    };
  });
}

/**
 * 将 Blob 转换为 Base64 URL
 * @param {Blob} blob - 音频 Blob
 * @returns {Promise<string>} Base64 URL
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Blob 转 Base64 失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 获取音频的可播放 URL（Object URL）
 * 使用完后需要调用 URL.revokeObjectURL 释放
 * 
 * @param {string} fileId - 文件唯一标识
 * @returns {Promise<string|null>} Object URL，失败则返回 null
 */
export async function getAudioURL(fileId, useBase64 = false) {
  console.log('[AudioStorage] ===== getAudioURL 开始 ====');
  console.log('[AudioStorage] 传入的 fileId:', fileId);
  console.log('[AudioStorage] useBase64:', useBase64);
  
  if (!fileId) {
    console.error('[AudioStorage] fileId 为空，无法获取音频');
    return null;
  }
  
  try {
    const blob = await getAudioFile(fileId);
    console.log('[AudioStorage] 从 IndexedDB 获取的 Blob:', blob ? {
      size: blob.size,
      type: blob.type,
      instanceOfBlob: blob instanceof Blob
    } : 'null');
    
    if (!blob) {
      console.error('[AudioStorage] 未找到对应 Blob，fileId 可能无效');
      return null;
    }
    
    // 🔴 APP 环境下或者强制使用 Base64 时，把 Blob 转成 Base64
    // 因为 APP WebView 对 Blob URL 支持不好
    if (useBase64) {
      console.log('[AudioStorage] 强制使用 Base64 模式');
      const base64 = await blobToBase64(blob);
      console.log('[AudioStorage] Blob 转 Base64 成功，长度:', base64.length);
      return base64;
    }
    
    // 直接使用 Blob 的原始 MIME type 创建 Object URL
    const objectUrl = URL.createObjectURL(blob);
    console.log('[AudioStorage] 创建的 Object URL:', objectUrl);
    console.log('[AudioStorage] ===== getAudioURL 成功 ====');
    return objectUrl;
  } catch (error) {
    console.error('[AudioStorage] ===== getAudioURL 失败 ====');
    console.error('[AudioStorage] 错误类型:', error.name);
    console.error('[AudioStorage] 错误消息:', error.message);
    console.error('[AudioStorage] 完整错误:', error);
    return null;
  }
}

/**
 * 检查音频文件是否存在
 * @param {string} fileId - 文件唯一标识
 * @returns {Promise<boolean>} 是否存在
 */
export async function hasAudioFile(fileId) {
  if (!fileId) {
    return false;
  }

  const db = await ensureDB();

  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getKey(fileId);

    request.onsuccess = () => {
      resolve(request.result !== undefined);
    };

    request.onerror = () => {
      resolve(false);
    };
  });
}

/**
 * 获取所有音频文件的元信息（不包含 Blob）
 * @returns {Promise<Array>} 音频文件列表
 */
export async function listAudioFiles() {
  const db = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      // 移除 blob 数据，只返回元信息
      const fileList = results.map(({ blob, ...metadata }) => metadata);
      resolve(fileList);
    };

    request.onerror = () => {
      reject(new Error('获取音频文件列表失败'));
    };
  });
}

/**
 * 清理过期的音频文件（可选，用于维护）
 * @param {number} days - 保留天数，默认 30 天
 * @returns {Promise<number>} 删除的文件数量
 */
export async function cleanupOldAudioFiles(days = 30) {
  const allFiles = await listAudioFiles();
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const file of allFiles) {
    const fileTime = new Date(file.createdAt).getTime();
    if (fileTime < cutoffTime) {
      await deleteAudioFile(file.fileId);
      deletedCount++;
    }
  }

  console.log(`[AudioStorage] 清理完成，删除 ${deletedCount} 个过期音频文件`);
  return deletedCount;
}

/**
 * 兼容处理：获取播客音频的播放 URL
 * 支持四种格式：
 * 1. 新格式：{ audioFileId: 'xxx' } - IndexedDB Blob 存储
 * 2. OPFS格式：{ filename: 'xxx' } - OPFS 文件存储
 * 3. 旧格式：Base64 字符串 - data: URL
 * 4. 旧格式：{ url: 'base64' } - 对象包裹的 Base64
 * 
 * @param {Object|string} podcastAudio - 播客音频数据
 * @param {Function} readOPFSFile - OPFS 读取函数（可选，用于兼容）
 * @returns {Promise<string|null>} 可播放的 URL
 */
export async function getPodcastPlayUrl(podcastAudio, readOPFSFile = null, useBase64 = false) {
  console.log('[AudioStorage] ===== getPodcastPlayUrl 开始 ====');
  console.log('[AudioStorage] 传入的 podcastAudio:', typeof podcastAudio);
  console.log('[AudioStorage] useBase64:', useBase64);
  console.log('[AudioStorage] podcastAudio 内容:', JSON.stringify(podcastAudio, (key, value) => {
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }, 2));

  if (!podcastAudio) {
    console.error('[AudioStorage] podcastAudio 为空');
    return null;
  }

  const isDirectAudioUrl = (value) => (
    typeof value === 'string' &&
    (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/presets/') ||
      value.startsWith('/static/') ||
      value.startsWith('./') ||
      value.startsWith('data:')
    )
  );

  if (isDirectAudioUrl(podcastAudio)) {
    return podcastAudio;
  }

  if (typeof podcastAudio === 'object') {
    const directUrl = podcastAudio.url || podcastAudio.path || podcastAudio.src;
    if (isDirectAudioUrl(directUrl)) {
      return directUrl;
    }
  }

  // 情况 1: 新格式 - audioFileId 引用 IndexedDB 存储
  if (typeof podcastAudio === 'object' && podcastAudio.audioFileId) {
    console.log('[AudioStorage] 匹配格式 1: IndexedDB audioFileId');
    console.log('[AudioStorage] audioFileId:', podcastAudio.audioFileId);
    const url = await getAudioURL(podcastAudio.audioFileId, useBase64);
    console.log('[AudioStorage] IndexedDB 返回的 URL:', url ? '获取成功' : '获取失败');
    return url;
  }

  // 情况 2: OPFS 格式
  if (typeof podcastAudio === 'object' && podcastAudio.filename && readOPFSFile) {
    try {
      console.log('[AudioStorage] 匹配格式 2: OPFS filename');
      console.log('[AudioStorage] OPFS filename:', podcastAudio.filename);
      const file = await readOPFSFile(podcastAudio.filename);
      return URL.createObjectURL(file);
    } catch (e) {
      console.error('[AudioStorage] OPFS 音频读取失败:', e);
      return null;
    }
  }

  // 情况 3: 旧格式 - Base64 字符串
  if (typeof podcastAudio === 'string' && podcastAudio.startsWith('data:')) {
    console.log('[AudioStorage] 匹配格式 3: Base64 字符串');
    return podcastAudio;
  }

  // 情况 4: 旧格式 - 对象中的 url 字段（Base64）
  if (typeof podcastAudio === 'object' && podcastAudio.url && podcastAudio.url.startsWith('data:')) {
    console.log('[AudioStorage] 匹配格式 4: 对象中的 url 字段（Base64）');
    return podcastAudio.url;
  }

  console.error('[AudioStorage] 无法识别的音频格式!');
  console.error('[AudioStorage] podcastAudio 的 keys:', typeof podcastAudio === 'object' ? Object.keys(podcastAudio) : '不是对象');
  return null;
}

/**
 * 预初始化数据库（可在应用启动时调用）
 */
export function preInitAudioDB() {
  initDB().catch(err => {
    console.warn('[AudioStorage] 预初始化失败，将在需要时重试:', err);
  });
}
// 部署触发注释
// 部署触发
// 强制触发
// 再触发一次
// 再触发
