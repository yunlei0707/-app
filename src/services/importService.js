import { unzip } from '../adapters/zipAdapter.js';
import { saveVideoBlobDedup, calculateFastHash } from '../adapters/storageAdapter.js';
import { restoreMoments } from './restoreService.js';
import { importV2AccountData } from '../utils/dbV2.js';

// ============================================================
// ✅ 导入校验工具函数
// ============================================================

/**
 * 校验导入数据完整性
 */
function validateImportData(data) {
  const errors = [];
  const warnings = [];
  
  // 1. 基础检查
  if (!data || typeof data !== 'object') {
    errors.push('导入数据不是有效的对象');
    return { valid: false, errors, warnings };
  }
  
  // 2. 检查版本兼容性
  if (data.exportVersion && data.exportVersion !== '2.1.0') {
    warnings.push(`导出版本为 ${data.exportVersion}，可能存在兼容性问题`);
  }
  
  // 3. 检查 fileMap
  if (data.fileMap && typeof data.fileMap !== 'object') {
    errors.push('fileMap 格式异常');
  }
  
  // 4. 检查是否有动态数据
  const hasData = (data.v2AccountData?.timeline?.length > 0) ||
                  (data.data?.moments?.length > 0) ||
                  (data.moments?.length > 0);
  
  if (!hasData) {
    warnings.push('备份文件中没有找到动态记录');
  }
  
  // 5. 检查是否有函数类型值（防止状态污染）
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
 * 校验 ZIP 文件完整性
 */
async function validateZipFile(zip, fileMap) {
  const errors = [];
  const warnings = [];
  
  if (!fileMap) {
    return { errors, warnings, missingFiles: [] };
  }
  
  const fileList = zip.listFiles();
  const videoFiles = fileList.filter(f => f.startsWith('videos/'));
  const expectedVideos = Object.keys(fileMap).length;
  
  if (videoFiles.length < expectedVideos) {
    warnings.push(`期望 ${expectedVideos} 个视频，实际只有 ${videoFiles.length} 个`);
  }
  
  // 检查每个视频文件是否存在
  const missingFiles = [];
  for (const [id, fileInfo] of Object.entries(fileMap)) {
    const filePath = `videos/${fileInfo.fileName}`;
    if (!fileList.includes(filePath)) {
      missingFiles.push(filePath);
      warnings.push(`视频文件缺失: ${fileInfo.fileName}`);
    }
  }
  
  return { errors, warnings, missingFiles };
}

export async function importAllData(options = {}) {
  const { zipFile, mode = 'merge', onProgress = null, signal = null } = options;
  const start = Date.now();

  console.log('[Import] ========== 开始导入 ==========');
  console.log('[Import] 模式:', mode);

  // 1. 解压 ZIP（带重试）
  let zip;
  for (let retry = 0; retry < 2; retry++) {
    try {
      zip = await unzip(zipFile);
      break;
    } catch (e) {
      if (retry === 0) {
        console.warn('[Import] ZIP 解压失败，重试中...');
        await new Promise(r => setTimeout(r, 100));
      } else {
        console.error('[Import] ZIP 解压最终失败:', e);
        throw new Error(`备份文件损坏: ${e.message}`);
      }
    }
  }
  
  console.log('[Import] ZIP 解压成功');

  // 2. 读取并校验 JSON 数据
  let data;
  try {
    data = await zip.getJSON('data.json');
  } catch (e) {
    console.error('[Import] 读取 data.json 失败:', e);
    throw new Error('备份文件格式错误：无法读取 data.json');
  }
  
  // ✅ 数据完整性校验
  const dataValidation = validateImportData(data);
  if (!dataValidation.valid) {
    console.error('[Import] 数据校验失败:', dataValidation.errors);
    throw new Error(`导入数据异常: ${dataValidation.errors.join(', ')}`);
  }
  dataValidation.warnings.forEach(w => console.warn('[Import]', w));

  const { moments, fileMap, v2AccountData } = data;
  console.log('[Import] 解析到动态数据，fileMap 条目:', Object.keys(fileMap || {}).length);

  // ✅ ZIP 文件校验
  const zipValidation = await validateZipFile(zip, fileMap);
  zipValidation.warnings.forEach(w => console.warn('[Import]', w));

  // 3. 恢复视频文件（带去重检测）
  let restoredVideos = 0;
  let duplicateVideos = 0;
  let failedVideos = [];
  const totalVideos = Object.keys(fileMap || {}).length;
  let processed = 0;
  const processedHashes = new Map(); // 哈希 -> 本地路径

  for (const [id, fileInfo] of Object.entries(fileMap || {})) {
    // 检查取消信号
    if (signal?.aborted) {
      console.log('[Import] 导入被用户取消');
      throw new Error('导入已取消');
    }
    
    try {
      const blob = await zip.getBlob(`videos/${fileInfo.fileName}`);
      if (!blob || blob.size === 0) {
        failedVideos.push({ id, error: '视频缺失或为空' });
        continue;
      }

      // ✅ 单源数据：计算哈希，检测本地是否已有相同文件
      const fileHash = await calculateFastHash(blob);
      
      if (processedHashes.has(fileHash)) {
        // 本次导入内的重复：直接复用已处理的路径
        const existingPath = processedHashes.get(fileHash);
        console.log('[Import] 检测到本次导入内的重复视频，复用:', existingPath);
        updateMomentVideoPath(moments, id, existingPath);
        updateMomentVideoPath(v2AccountData?.timeline, id, existingPath);
        duplicateVideos++;
        restoredVideos++;
      } else {
        // 使用去重保存接口（会自动检测系统内已有文件）
        const localPath = `videos/${Date.now()}_${fileInfo.fileName}`;
        const saveResult = await saveVideoBlobDedup(blob, localPath, {
          mimeType: 'video/mp4',
          fileName: fileInfo.fileName
        });
        
        console.log('[Import] 视频恢复:', fileInfo.fileName, 
                    saveResult.isNew ? '新写入' : '复用已有文件', 
                    saveResult.path);
        
        if (!saveResult.isNew) {
          duplicateVideos++;
        }
        
        processedHashes.set(fileHash, saveResult.path);
        
        // 更新动态中的视频路径
        updateMomentVideoPath(moments, id, saveResult.path);
        updateMomentVideoPath(v2AccountData?.timeline, id, saveResult.path);
        restoredVideos++;
      }
    } catch (e) {
      console.error('[Import] 恢复视频失败:', fileInfo.fileName, e.message);
      failedVideos.push({ id, fileName: fileInfo.fileName, error: e.message });
    }

    // 每处理 5 个让出主线程，防止 ANR
    processed++;
    if (processed % 5 === 0) {
      await new Promise(r => setTimeout(r, 30));
    }

    if (onProgress) {
      onProgress({ 
        step: 'videos', 
        progress: Math.floor((processed / totalVideos) * 100),
        processed,
        total: totalVideos
      });
    }
  }

  console.log('[Import] 视频恢复完成，成功:', restoredVideos, 
              '(其中去重复用:', duplicateVideos, ')',
              '失败:', failedVideos.length);

  // 4. 恢复数据
  if (v2AccountData) {
    console.log('[Import] 恢复 v2 账号数据...');
    await importV2AccountData(v2AccountData, mode);
  } else if (moments && moments.length > 0) {
    console.log('[Import] 恢复 IndexedDB 动态数据...');
    await restoreMoments(moments, { mode });
  }

  const result = {
    success: true,
    totalVideos,
    restoredVideos,
    duplicateVideos,
    failedVideos,
    duration: Date.now() - start,
    mode,
    warnings: [...dataValidation.warnings, ...zipValidation.warnings]
  };

  console.log('[Import] ========== 导入完成 ==========');
  console.log('[Import] 报告:', result);

  return result;
}

function updateMomentVideoPath(moments, id, newPath) {
  if (!Array.isArray(moments)) return;
  for (const m of moments) {
    for (const v of m.videos || []) {
      if (v.id === id || v.filename === id || v.path === id) {
        v.path = v.opfsPath = newPath;
      }
    }
  }
}

export default { importAllData };
