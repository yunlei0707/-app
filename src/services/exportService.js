import { processVideos } from './mediaService.js';
import { createZip } from '../adapters/zipAdapter.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
// 旧版 IDB 数据兼容（可空）
function exportDBData() {
  return Promise.resolve(null);
}
import { exportV2AccountData, getCurrentMediaIndex } from "../repositories/stateRepository.js";
import { BASE_DIR } from '../constants/storage.js';
import { getMediaBlob, calculateMediaHash, normalizeMomentMedia } from '../repositories/mediaRepository.js';

// ============================================================
// ✅ 导出校验工具函数
// ============================================================

/**
 * 校验导出数据完整性
 */
function validateExportData(data) {
  const errors = [];
  const warnings = [];
  
  // 1. 检查必要字段
  if (!data || typeof data !== 'object') {
    errors.push('导出数据不是有效的对象');
    return { valid: false, errors, warnings };
  }
  
  // 2. 检查 timeline 数据
  if (data.v2AccountData?.timeline && !Array.isArray(data.v2AccountData.timeline)) {
    warnings.push('timeline 数据格式异常');
  }
  
  // 3. 检查是否有动态
  const totalMoments = (data.v2AccountData?.timeline?.length || 0) + 
                       (data.data?.moments?.length || 0) + 
                       (data.moments?.length || 0);
  
  if (totalMoments === 0) {
    warnings.push('没有找到任何动态记录');
  }
  
  // 4. 检查是否有函数类型值（状态污染检测）
  function checkForFunctions(obj, path = '') {
    for (const key in obj) {
      const value = obj[key];
      const fullPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'function') {
        errors.push(`检测到函数类型值: ${fullPath}`);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        checkForFunctions(value, fullPath);
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item && typeof item === 'object') {
            checkForFunctions(item, `${fullPath}[${i}]`);
          }
        });
      }
    }
  }
  checkForFunctions(data);
  
  const valid = errors.length === 0;
  return { valid, errors, warnings };
}

/**
 * 校验 fileMap 完整性
 */
function validateFileMap(fileMap, videoResults) {
  const errors = [];
  const warnings = [];
  
  // 检查每个视频都有对应的 fileMap 条目
  const hashedPaths = new Set();
  
  for (const video of videoResults) {
    const entry = fileMap[video.id];
    if (!entry) {
      warnings.push(`视频 ${video.id} 在 fileMap 中没有对应条目`);
    }
    if (video.blob && video.blob.size !== entry?.fileSize) {
      warnings.push(`视频 ${video.id} 大小不匹配`);
    }
    hashedPaths.add(video.path);
  }
  
  // 检查去重效果
  const uniqueCount = hashedPaths.size;
  const totalCount = videoResults.length;
  if (totalCount > uniqueCount) {
    console.log(`[Export] 去重优化: ${totalCount - uniqueCount} 个重复视频被合并`);
  }
  
  return { errors, warnings, deduplicated: totalCount - uniqueCount };
}

function safeArchiveFileName(media, fallbackExt) {
  const hash = media.fileHash || media.hash || media.id || Date.now();
  const sourceName = media.fileName || media.originalName || media.name || `media.${fallbackExt}`;
  const cleanName = String(sourceName)
    .split(/[\\/]/)
    .pop()
    .replace(/[^\w.\-()\u4e00-\u9fa5]/g, '_');
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(cleanName);
  const baseName = hasExt ? cleanName : `${cleanName}.${fallbackExt}`;
  return `${String(hash).slice(0, 12)}_${baseName}`;
}

export async function exportAllData(options = {}) {
  const { includeVideos = false, onProgress = null, signal = null } = options;
  const start = Date.now();

  console.log('[Export] ========== 开始导出 ==========');
  console.log('[Export] includeVideos:', includeVideos);

  // 1. 读取最新数据（直接从存储，不依赖缓存）
  const data = await getAllMomentsFromDB();
  
  // ✅ 数据完整性校验
  const dataValidation = validateExportData(data);
  if (!dataValidation.valid) {
    console.error('[Export] 数据校验失败:', dataValidation.errors);
    throw new Error(`导出数据异常: ${dataValidation.errors.join(', ')}`);
  }
  dataValidation.warnings.forEach(w => console.warn('[Export]', w));

  const videos = extractVideosFromData(data);
  const audios = extractAudiosFromData(data);
  const photos = extractPhotosFromData(data);
  console.log('[Export] 提取到视频数量:', videos.length, '，音频数量:', audios.length, '，照片数量:', photos.length);

  // 2. 处理视频（串行读取 Blob，带去重检测）
  let videoResults = [];
  let failedVideos = [];
  const processedHashes = new Map(); // 哈希 -> 第一个视频结果

  if (includeVideos && videos.length > 0) {
    console.log('[Export] 开始处理视频，共', videos.length, '个');
    
    for (const v of videos) {
      // 检查取消信号
      if (signal?.aborted) {
        console.log('[Export] 导出被用户取消');
        throw new Error('导出已取消');
      }
      
      let blob = null;
      
      // 最多重试 3 次，每次间隔 200ms（处理视频写入异步问题）
      for (let retry = 0; retry < 3; retry++) {
        try {
          console.log('[Export] 读取视频:', v.path?.substring(0, 30) + '...', '第', retry + 1, '次尝试');
          blob = await getMediaBlob(v.path);
          if (blob && blob.size > 0) {
            console.log('[Export] 读取成功，大小:', blob.size);
            break;
          }
        } catch (e) {
          console.warn('[Export] 读取失败，重试中:', e.message);
          if (retry < 2) {
            await new Promise(r => setTimeout(r, 200));
            continue;
          }
          console.error('[Export] 读取视频最终失败:', v.path, e.message);
          failedVideos.push({ ...v, error: e.message });
        }
      }
      
      if (blob && blob.size > 0) {
        // ✅ 单源数据：计算哈希，检测重复
        const fileHash = await calculateMediaHash(blob);
        
        if (processedHashes.has(fileHash)) {
          // 重复视频：复用已处理的结果
          const existing = processedHashes.get(fileHash);
          console.log('[Export] 检测到重复视频，复用:', existing.fileName);
          videoResults.push({ 
            ...v, 
            blob: existing.blob, 
            fileName: existing.fileName,
            fileHash,
            archiveFileName: existing.archiveFileName,
            isDuplicate: true,
            originalId: existing.id
          });
        } else {
          // 新视频：正常处理
          const result = { ...v, blob, fileHash };
          videoResults.push(result);
          processedHashes.set(fileHash, result);
        }
      }
      
      // 让出主线程（每处理 3 个视频）
      if (videoResults.length % 3 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
    
    console.log('[Export] 视频处理完成，成功:', videoResults.length, 
                '去重:', processedHashes.size, 
                '失败:', failedVideos.length);
  }

  // 2b. 处理照片（同样带去重检测）
  let photoResults = [];
  let failedPhotos = [];
  const photoHashes = new Map();

  if (includeVideos && photos.length > 0) {
    console.log('[Export] 开始处理照片，共', photos.length, '个');
    
    for (const p of photos) {
      if (signal?.aborted) throw new Error('导出已取消');
      
      let blob = null;
      for (let retry = 0; retry < 3; retry++) {
        try {
          blob = await getMediaBlob(p.path);
          if (blob && blob.size > 0) break;
        } catch (e) {
          if (retry < 2) {
            await new Promise(r => setTimeout(r, 200));
            continue;
          }
          failedPhotos.push({ ...p, error: e.message });
        }
      }
      
      if (blob && blob.size > 0) {
        const fileHash = await calculateMediaHash(blob);
        if (photoHashes.has(fileHash)) {
          const existing = photoHashes.get(fileHash);
          photoResults.push({
            ...p,
            blob: existing.blob,
            fileName: existing.fileName,
            fileHash,
            archiveFileName: existing.archiveFileName,
            isDuplicate: true
          });
        } else {
          const result = { ...p, blob, fileHash };
          photoResults.push(result);
          photoHashes.set(fileHash, result);
        }
      }
    }
    console.log('[Export] 照片处理完成，成功:', photoResults.length, '失败:', failedPhotos.length);
  }

  // 2c. 处理音频（同样带去重检测）
  let audioResults = [];
  let failedAudios = [];

  if (includeVideos && audios.length > 0) {
    console.log('[Export] 开始处理音频，共', audios.length, '个');
    
    for (const a of audios) {
      // 检查取消信号
      if (signal?.aborted) {
        console.log('[Export] 导出被用户取消');
        throw new Error('导出已取消');
      }
      
      let blob = null;
      
      // 最多重试 3 次，每次间隔 200ms
      for (let retry = 0; retry < 3; retry++) {
        try {
          console.log('[Export] 读取音频:', a.path?.substring(0, 30) + '...', '第', retry + 1, '次尝试');
          blob = await getMediaBlob(a.path); // 复用 getMediaBlob，音频也在 videos 目录
          if (blob && blob.size > 0) {
            console.log('[Export] 读取成功，大小:', blob.size);
            break;
          }
        } catch (e) {
          console.warn('[Export] 读取失败，重试中:', e.message);
          if (retry < 2) {
            await new Promise(r => setTimeout(r, 200));
            continue;
          }
          console.error('[Export] 读取音频最终失败:', a.path, e.message);
          failedAudios.push({ ...a, error: e.message });
        }
      }
      
      if (blob && blob.size > 0) {
        // ✅ 单源数据：计算哈希，检测重复
        const fileHash = await calculateMediaHash(blob);
        
        if (processedHashes.has(fileHash)) {
          // 重复音频：复用已处理的结果
          const existing = processedHashes.get(fileHash);
          console.log('[Export] 检测到重复音频，复用:', existing.fileName);
          audioResults.push({ 
            ...a, 
            blob: existing.blob, 
            fileName: existing.fileName,
            fileHash,
            archiveFileName: existing.archiveFileName,
            isDuplicate: true,
            originalId: existing.id
          });
        } else {
          // 新音频：正常处理
          const result = { ...a, blob, fileHash };
          audioResults.push(result);
          processedHashes.set(fileHash, result);
        }
      }
      
      // 让出主线程（每处理 5 个音频）
      if (audioResults.length % 5 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
    
    console.log('[Export] 音频处理完成，成功:', audioResults.length, 
                '失败:', failedAudios.length);
  }

  // 3. 创建 ZIP 并写入文件（带去重）
  const zip = createZip();
  const fileMap = {};
  const uniqueHashes = new Set();
  const archiveNamesByHash = new Map();
  let duplicateSkipped = 0;

  // 写入视频文件（带去重）
  for (const video of videoResults) {
    if (uniqueHashes.has(video.fileHash)) {
      // 重复文件，只更新 fileMap，不重复写入 ZIP
      duplicateSkipped++;
      const original = videoResults.find(v => v.fileHash === video.fileHash);
      const archiveFileName = archiveNamesByHash.get(video.fileHash) || original.archiveFileName || safeArchiveFileName(original, 'mp4');
      fileMap[video.id] = {
        fileName: archiveFileName,
        originalName: video.originalName,
        fileSize: video.blob.size,
        isDuplicate: true,
        originalId: original.id,
        mediaType: 'video'
      };
    } else {
      // 新文件，写入 ZIP
      uniqueHashes.add(video.fileHash);
      const archiveFileName = safeArchiveFileName(video, 'mp4');
      video.archiveFileName = archiveFileName;
      archiveNamesByHash.set(video.fileHash, archiveFileName);
      zip.addFile(`videos/${archiveFileName}`, video.blob);
      fileMap[video.id] = {
        fileName: archiveFileName,
        originalName: video.originalName,
        fileSize: video.blob.size,
        fileHash: video.fileHash,
        mediaType: 'video'
      };
    }
  }

  // 写入音频文件（带去重，复用同一个去重 Map）
  for (const audio of audioResults) {
    if (uniqueHashes.has(audio.fileHash)) {
      // 重复文件，只更新 fileMap，不重复写入 ZIP
      duplicateSkipped++;
      const original = [...videoResults, ...audioResults].find(a => a.fileHash === audio.fileHash);
      const archiveFileName = archiveNamesByHash.get(audio.fileHash) || original.archiveFileName || safeArchiveFileName(original, 'm4a');
      fileMap[audio.id] = {
        fileName: archiveFileName,
        originalName: audio.originalName,
        fileSize: audio.blob.size,
        isDuplicate: true,
        originalId: original.id,
        mediaType: 'audio'
      };
    } else {
      // 新文件，写入 ZIP
      uniqueHashes.add(audio.fileHash);
      const archiveFileName = safeArchiveFileName(audio, 'm4a');
      audio.archiveFileName = archiveFileName;
      archiveNamesByHash.set(audio.fileHash, archiveFileName);
      zip.addFile(`audios/${archiveFileName}`, audio.blob);
      fileMap[audio.id] = {
        fileName: archiveFileName,
        originalName: audio.originalName,
        fileSize: audio.blob.size,
        fileHash: audio.fileHash,
        mediaType: 'audio'
      };
    }
  }

  // 写入照片文件（带去重，复用同一个去重 Map）
  for (const photo of photoResults) {
    if (uniqueHashes.has(photo.fileHash)) {
      // 重复文件，只更新 fileMap，不重复写入 ZIP
      duplicateSkipped++;
      const original = [...videoResults, ...audioResults, ...photoResults].find(p => p.fileHash === photo.fileHash);
      const archiveFileName = archiveNamesByHash.get(photo.fileHash) || original.archiveFileName || safeArchiveFileName(original, 'jpg');
      fileMap[photo.id] = {
        fileName: archiveFileName,
        originalName: photo.originalName,
        fileSize: photo.blob.size,
        isDuplicate: true,
        originalId: original.id,
        mediaType: 'photo'
      };
    } else {
      // 新文件，写入 ZIP
      uniqueHashes.add(photo.fileHash);
      const archiveFileName = safeArchiveFileName(photo, 'jpg');
      photo.archiveFileName = archiveFileName;
      archiveNamesByHash.set(photo.fileHash, archiveFileName);
      zip.addFile(`photos/${archiveFileName}`, photo.blob);
      fileMap[photo.id] = {
        fileName: archiveFileName,
        originalName: photo.originalName,
        fileSize: photo.blob.size,
        fileHash: photo.fileHash,
        mediaType: 'photo'
      };
    }
  }
  
  if (duplicateSkipped > 0) {
    console.log(`[Export] ZIP 去重: 跳过 ${duplicateSkipped} 个重复文件，节省存储空间`);
  }

  // 4. 写入 JSON 数据
  data.fileMap = fileMap;
  data.exportVersion = '2.1.0';
  data.schemaVersion = 1;
  data.exportStats = {
    totalVideos: videos.length,
    totalAudios: audios.length,
    totalPhotos: photos.length,
    uniqueFiles: uniqueHashes.size,
    duplicateSkipped,
    failedVideos: failedVideos.length,
    failedAudios: failedAudios.length,
    failedPhotos: failedPhotos.length,
    exportTime: new Date().toISOString()
  };

  // ✅ JSON 序列化前最终校验
  const jsonStr = JSON.stringify(data, null, 2);
  if (!jsonStr || jsonStr.length < 100) {
    throw new Error('导出数据异常：JSON 内容过短');
  }

  zip.addFile(
    'data.json',
    new Blob([jsonStr], { type: 'application/json' })
  );
  zip.addFile(
    'data.js',
    new Blob([
      `window.BABY_TIME_BACKUP = ${jsonStr};\n`,
      `export default window.BABY_TIME_BACKUP;\n`
    ], { type: 'application/javascript' })
  );

  // 5. 生成 ZIP Blob
  console.log('[Export] 开始生成 ZIP 文件...');
  const zipBlob = await zip.generate(percent => onProgress?.({
    progress: Math.round(percent),
    message: '正在生成压缩包...'
  }));
  
  // ✅ ZIP 完整性校验
  if (!zipBlob || zipBlob.size < 100) {
    throw new Error('ZIP 文件生成失败：文件大小异常');
  }
  console.log('[Export] ZIP 生成完成，大小:', zipBlob.size, 'bytes');

  // 6. 保存到本地 Documents
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const zipFilename = `baby_backup_${timestamp}.zip`;
  const zipFilePath = `BabyTimeBackup/${zipFilename}`;

  console.log('[Export] 保存到本地:', zipFilePath);
  let savedPath = '';
  let savedToNative = false;
  try {
    savedPath = await saveToLocal(zipBlob, zipFilePath, zipFilename);
    savedToNative = true;
  } catch (e) {
    console.warn('[Export] 原生文件保存失败，降级为浏览器 Blob 导出:', e.message);
  }

  // ✅ fileMap 最终校验
  const fileMapValidation = validateFileMap(fileMap, videoResults);
  fileMapValidation.warnings.forEach(w => console.warn('[Export]', w));

  // 返回结果（兼容 ProfilePage 判断逻辑）
  const result = {
    success: true,
    filePath: savedPath,
    fileName: zipFilename,
    filename: zipFilename,
    fileSize: zipBlob.size,
    isNative: savedToNative,
    blob: zipBlob,
    report: {
      duration: Date.now() - start,
      totalVideos: videos.length,
      totalAudios: audios.length,
      uniqueFiles: uniqueHashes.size,
      successVideos: videoResults.length,
      failedVideos,
      successAudios: audioResults.length,
      failedAudios,
      duplicateSkipped,
      warnings: [...dataValidation.warnings, ...fileMapValidation.warnings]
    }
  };

  console.log('[Export] ========== 导出完成 ==========');
  console.log('[Export] 报告:', result.report);

  return result;
}

async function getAllMomentsFromDB() {
  const [idbData, v2Data] = await Promise.all([
    exportDBData().catch(() => null),
    exportV2AccountData()
  ]);

  return {
    ...(idbData?.data || {}),
    ...(idbData || {}),
    v2AccountData: v2Data,
    exportTime: new Date().toISOString()
  };
}

// ✅ 通用媒体提取函数 - 使用 Schema 统一工具处理所有格式
function extractAllMediaFromMoments(moments) {
  const result = [];
  const seenPaths = new Set();

  if (!Array.isArray(moments)) return [];

  for (const m of moments) {
    // ✅ 使用统一入口提取所有媒体，自动兼容所有旧格式
    const { photos, videos, audios } = normalizeMomentMedia(m);
    
    for (const media of [...photos, ...videos, ...audios]) {
      // 去重：同一路径只导出一次
      if (!media.path || seenPaths.has(media.path)) continue;
      seenPaths.add(media.path);
      
      result.push({
        id: media.id,
        path: media.path,
        fileName: media.fileName,
        originalName: media.fileName,
        momentId: m.id,
        type: media.type,
        hash: media.hash,
        size: media.size,
        duration: media.duration,
      });
    }
  }

  return result;
}

// 保持旧接口向后兼容
function extractPhotosFromData(data) {
  const allMoments = [
    ...(data.v2AccountData?.timeline || []),
    ...(data.data?.moments || []),
    ...(data.moments || []),
  ];
  return extractAllMediaFromMoments(allMoments).filter(m => m.type === 'photo');
}

function extractVideosFromData(data) {
  const allMoments = [
    ...(data.v2AccountData?.timeline || []),
    ...(data.data?.moments || []),
    ...(data.moments || []),
  ];
  return extractAllMediaFromMoments(allMoments).filter(m => m.type === 'video');
}

function extractAudiosFromData(data) {
  const allMoments = [
    ...(data.v2AccountData?.timeline || []),
    ...(data.data?.moments || []),
    ...(data.moments || []),
  ];
  return extractAllMediaFromMoments(allMoments).filter(m => m.type === 'audio');
}

async function saveToLocal(blob, path, filename) {
  const base64 = await blobToBase64(blob);
  const fullPath = path || `BabyTimeBackup/${filename}`;
  
  console.log('[Export] 保存文件到:', fullPath);
  
  await Filesystem.writeFile({
    path: fullPath,
    data: base64,
    directory: Directory.Documents,
    recursive: true
  });

  let uri = '';
  try {
    const result = await Filesystem.getUri({
      path: fullPath,
      directory: Directory.Documents,
    });
    uri = result.uri;
  } catch (e) {
    console.warn('[Export] getUri失败，使用逻辑路径:', e.message);
  }
  
  const finalUri = uri || `fs://file/${fullPath}`;
  console.log('[Export] 文件已保存，返回路径:', finalUri);
  
  return finalUri;
}

function blobToBase64(blob) {
  return new Promise((r, j) => {
    const f = new FileReader();
    f.onloadend = () => r(String(f.result).split(',')[1] || '');
    f.onerror = j;
    f.readAsDataURL(blob);
  });
}

// 兼容旧代码
export function exportAllDataWithVideos(opts) {
  return exportAllData({ ...opts, includeVideos: true });
}

// 兼容 zipExport.js 的导出
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function isNativePlatform() {
  return !!window.Capacitor;
}

export default { exportAllData, exportAllDataWithVideos, triggerDownload, isNativePlatform };
