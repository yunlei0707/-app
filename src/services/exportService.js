import { processVideos } from './mediaService.js';
import { createZip } from '../adapters/zipAdapter.js';
import { exportAllData as exportDBData } from '../utils/db.js';
import { exportV2AccountData, getCurrentMediaIndex } from '../utils/dbV2.js';
import { BASE_DIR } from '../constants/storage.js';
import { getVideoBlob, calculateFastHash } from '../adapters/storageAdapter.js';

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
  console.log('[Export] 提取到视频数量:', videos.length, '，音频数量:', audios.length);

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
          blob = await getVideoBlob(v.path);
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
        const fileHash = await calculateFastHash(blob);
        
        if (processedHashes.has(fileHash)) {
          // 重复视频：复用已处理的结果
          const existing = processedHashes.get(fileHash);
          console.log('[Export] 检测到重复视频，复用:', existing.fileName);
          videoResults.push({ 
            ...v, 
            blob: existing.blob, 
            fileName: existing.fileName,
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

  // 2b. 处理音频（同样带去重检测）
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
          blob = await getVideoBlob(a.path); // 复用 getVideoBlob，音频也在 videos 目录
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
        const fileHash = await calculateFastHash(blob);
        
        if (processedHashes.has(fileHash)) {
          // 重复音频：复用已处理的结果
          const existing = processedHashes.get(fileHash);
          console.log('[Export] 检测到重复音频，复用:', existing.fileName);
          audioResults.push({ 
            ...a, 
            blob: existing.blob, 
            fileName: existing.fileName,
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
  let duplicateSkipped = 0;

  // 写入视频文件（带去重）
  for (const video of videoResults) {
    if (uniqueHashes.has(video.fileHash)) {
      // 重复文件，只更新 fileMap，不重复写入 ZIP
      duplicateSkipped++;
      const original = videoResults.find(v => v.fileHash === video.fileHash);
      fileMap[video.id] = {
        fileName: original.fileName,
        originalName: video.originalName,
        fileSize: video.blob.size,
        isDuplicate: true,
        originalId: original.id,
        mediaType: 'video'
      };
    } else {
      // 新文件，写入 ZIP
      uniqueHashes.add(video.fileHash);
      zip.addFile(`videos/${video.fileName}`, video.blob);
      fileMap[video.id] = {
        fileName: video.fileName,
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
      fileMap[audio.id] = {
        fileName: original.fileName,
        originalName: audio.originalName,
        fileSize: audio.blob.size,
        isDuplicate: true,
        originalId: original.id,
        mediaType: 'audio'
      };
    } else {
      // 新文件，写入 ZIP
      uniqueHashes.add(audio.fileHash);
      zip.addFile(`audios/${audio.fileName}`, audio.blob);
      fileMap[audio.id] = {
        fileName: audio.fileName,
        originalName: audio.originalName,
        fileSize: audio.blob.size,
        fileHash: audio.fileHash,
        mediaType: 'audio'
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
    uniqueFiles: uniqueHashes.size,
    duplicateSkipped,
    failedVideos: failedVideos.length,
    failedAudios: failedAudios.length,
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

  // 5. 生成 ZIP Blob
  console.log('[Export] 开始生成 ZIP 文件...');
  const zipBlob = await zip.generate(onProgress);
  
  // ✅ ZIP 完整性校验
  if (!zipBlob || zipBlob.size < 100) {
    throw new Error('ZIP 文件生成失败：文件大小异常');
  }
  console.log('[Export] ZIP 生成完成，大小:', zipBlob.size, 'bytes');

  // 6. 保存到本地 Documents
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const zipFilename = `baby_backup_${timestamp}.zip`;
  const zipFilePath = `${BASE_DIR}/${zipFilename}`;

  console.log('[Export] 保存到本地:', zipFilePath);
  await saveToLocal(zipBlob, zipFilePath, zipFilename);

  // ✅ fileMap 最终校验
  const fileMapValidation = validateFileMap(fileMap, videoResults);
  fileMapValidation.warnings.forEach(w => console.warn('[Export]', w));

  // 返回结果（兼容 ProfilePage 判断逻辑）
  const result = {
    success: true,
    filePath: zipFilePath,
    fileName: zipFilename,
    filename: zipFilename,
    fileSize: zipBlob.size,
    isNative: true,
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

function extractVideosFromData(data) {
  const videos = [];
  const seen = new Set();

  function addVideos(m) {
    if (!m?.videos) return;
    for (const v of m.videos) {
      const path = v.opfsPath || v.filename || v.url;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      videos.push({
        id: m.id || `vid_${videos.length}`,
        path,
        fileName: v.filename || v.opfsPath || `video_${videos.length}.mp4`,
        originalName: v.filename,
        momentId: m.id
      });
    }
  }

  if (data.v2AccountData?.timeline) data.v2AccountData.timeline.forEach(addVideos);
  if (data.data?.moments) data.data.moments.forEach(addVideos);
  if (data.moments) data.moments.forEach(addVideos);

  return videos;
}

function extractAudiosFromData(data) {
  const audios = [];
  const seen = new Set();

  function addAudios(m) {
    if (!m?.audios) return;
    for (const a of m.audios) {
      const path = a.opfsPath || a.filename || a.url;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      audios.push({
        id: m.id || `aud_${audios.length}`,
        path,
        fileName: a.filename || a.opfsPath || `audio_${audios.length}.m4a`,
        originalName: a.filename || a.name,
        momentId: m.id
      });
    }
  }

  if (data.v2AccountData?.timeline) data.v2AccountData.timeline.forEach(addAudios);
  if (data.data?.moments) data.data.moments.forEach(addAudios);
  if (data.moments) data.moments.forEach(addAudios);

  return audios;
}

async function saveToLocal(blob, path, filename) {
  const fsModule = await loadFilesystem();
  const base64 = await blobToBase64(blob);
  const fullPath = `BabyTimeBackup/${filename}`;
  
  console.log('[Export] 保存文件到:', fullPath);
  
  await fsModule.Filesystem.writeFile({
    path: fullPath,
    data: base64,
    directory: fsModule.Directory.Documents,
    recursive: true
  });
  
  // 强制返回 ProfilePage 期望的标准 fs:// 格式路径
  const finalUri = `fs://file/BabyTimeBackup/${filename}`;
  console.log('[Export] 文件已保存，返回路径:', finalUri);
  
  return finalUri;
}

async function loadFilesystem() {
  const mod = window.Capacitor?.Plugins?.Filesystem;
  const Filesystem = mod?.Filesystem || mod.default?.Filesystem || mod;
  const Directory = mod?.Directory || mod.default?.Directory || {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
    Cache: 'CACHE'
  };
  return { Filesystem, Directory };
}

function blobToBase64(blob) {
  return new Promise((r, j) => {
    const f = new FileReader();
    f.onloadend = () => r(f.result);
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
