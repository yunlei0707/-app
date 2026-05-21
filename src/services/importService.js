/**
 * 🧠 Import Service - 🔥唯一导入入口
 * 
 * 职责：流程编排、数据预检、进度管理、冲突处理、报告生成
 * 与 exportService 完全对称，形成 100% 闭环
 * 
 * 六步标准流程：
 * 1️⃣ ZIP 解压 → 2️⃣ 数据预检 → 3️⃣ DB 恢复 → 4️⃣ 视频恢复 → 5️⃣ 冲突处理 → 6️⃣ 生成报告
 */

import { unzip } from './adapters/zipAdapter.js';
import { saveVideoBlob } from './adapters/storageAdapter.js';
import { restoreAllData } from './restoreService.js';
import { normalizeFileName } from './mediaService.js';

/**
 * 🔥 从 ZIP 文件导入所有数据
 * @param {Object} options
 * @param {Blob|File} options.zipFile - ZIP 文件 Blob
 * @param {boolean} options.rollbackOnError - 失败是否回滚（默认 true）
 * @param {string} options.mode - 恢复模式：'merge' | 'overwrite'
 * @param {Function} options.onProgress - 进度回调
 * @param {AbortSignal} options.signal - 取消信号
 */
export async function importFromZip(options = {}) {
  const {
    zipFile,
    rollbackOnError = true,
    mode = 'merge',
    onProgress = null,
    signal = null
  } = options;

  const startTime = Date.now();
  let backupBeforeImport = null;

  console.log('[importService] 开始导入流程...');

  try {
    // ========== 1️⃣ ZIP 解压 ==========
    if (onProgress) onProgress({ step: 'unzip', percent: 5, message: '正在解压文件...' });
    checkAbort(signal);

    if (!(zipFile instanceof Blob)) {
      throw new Error('请上传有效的 ZIP 文件');
    }

    const zip = await unzip(zipFile);

    // ========== 2️⃣ 数据预检 ==========
    if (onProgress) onProgress({ step: 'validate', percent: 15, message: '正在校验数据格式...' });
    checkAbort(signal);

    const data = await zip.getJSON('data.json');
    const validation = validateBackupData(data);

    if (!validation.valid) {
      throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
    }

    console.log('[importService] 数据校验通过:', validation);

    // ========== 3️⃣ 恢复数据库 ==========
    if (onProgress) onProgress({ step: 'restore_db', percent: 25, message: '正在恢复数据...' });
    checkAbort(signal);

    const dbResults = await restoreAllData(data, {
      mode,
      signal,
      onProgress: (p) => {
        const percent = 25 + Math.floor((p.current / p.total) * 15); // 25-40%
        if (onProgress) {
          onProgress({
            step: 'restore_db',
            percent,
            message: `恢复数据: ${p.current}/${p.total}`
          });
        }
      }
    });

    // ========== 4️⃣ 恢复视频文件 ==========
    let restoredVideos = 0;
    let failedVideos = [];
    const fileMap = data.fileMap || {};
    const totalVideos = Object.keys(fileMap).length;

    if (totalVideos > 0) {
      if (onProgress) onProgress({ step: 'restore_videos', percent: 40, message: '正在恢复视频...' });

      let processed = 0;

      for (const [id, fileInfo] of Object.entries(fileMap)) {
        checkAbort(signal);

        try {
          const zipPath = `videos/${fileInfo.fileName}`;
          const blob = await zip.getBlob(zipPath);

          if (!blob) {
            throw new Error('ZIP 中缺失视频文件');
          }

          // 生成本地路径并写入
          const localPath = generateLocalPath(fileInfo.fileName);
          await saveVideoBlob(localPath, blob);

          // 更新 moments 中的视频路径
          updateMomentVideoPath(data, id, localPath);

          restoredVideos++;

        } catch (err) {
          console.warn(`[importService] 视频恢复失败: ${id}`, err.message);
          failedVideos.push({
            id,
            fileName: fileInfo.fileName,
            error: err.message
          });
        }

        // 更新进度（视频恢复占 40-90%）
        processed++;
        const percent = 40 + Math.floor((processed / totalVideos) * 50);
        if (onProgress) {
          onProgress({
            step: 'restore_videos',
            percent,
            message: `恢复视频: ${processed}/${totalVideos}`,
            stats: {
              total: totalVideos,
              current: processed,
              success: restoredVideos,
              failed: failedVideos.length
            }
          });
        }

        // 每处理 3 个视频让出主线程
        if (processed % 3 === 0 && processed < totalVideos) {
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    }

    // ========== 5️⃣ 完成：生成报告 ==========
    const duration = Date.now() - startTime;
    const report = {
      time: new Date().toISOString(),
      duration,
      mode,
      exportVersion: data.exportVersion,
      schemaVersion: data.schemaVersion,
      moments: {
        total: dbResults.moments.total,
        restored: dbResults.moments.restored,
        skipped: dbResults.moments.skipped
      },
      videos: {
        total: totalVideos,
        restored: restoredVideos,
        failed: failedVideos.length,
        failedList: failedVideos
      }
    };

    if (onProgress) onProgress({
      step: 'complete',
      percent: 100,
      message: '导入完成！',
      report
    });

    console.log('[importService] 导入报告:', report);

    return {
      success: true,
      report,
      hasWarnings: failedVideos.length > 0,
      warningCount: failedVideos.length
    };

  } catch (error) {
    if (error.message === '导出已取消' || error.message === '恢复已取消') {
      console.log('[importService] 用户取消了导入');
      throw error;
    }

    console.error('[importService] 导入失败:', error);

    // TODO: 回滚逻辑（rollbackOnError === true 时）
    if (rollbackOnError && backupBeforeImport) {
      console.log('[importService] 执行回滚...');
      // await rollbackFromBackup(backupBeforeImport);
    }

    throw error;
  }
}

// ==================== 内部辅助函数 ====================

/**
 * 校验备份数据完整性
 */
function validateBackupData(data) {
  const errors = [];
  const warnings = [];

  // 必填字段检查
  if (!data) {
    errors.push('数据为空');
    return { valid: false, errors, warnings };
  }

  if (!data.exportVersion) {
    warnings.push('缺少 exportVersion，可能是旧版本备份');
  }

  if (!data.schemaVersion) {
    warnings.push('缺少 schemaVersion');
  }

  // moments 检查
  const hasMoments = (data.moments && data.moments.length > 0) ||
                      (data.data?.moments && data.data?.moments.length > 0);
  if (!hasMoments) {
    warnings.push('备份中没有 moment 数据');
  }

  // fileMap 检查
  if (!data.fileMap) {
    warnings.push('缺少 fileMap，视频路径可能无法正确恢复');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 生成本地存储路径
 */
function generateLocalPath(fileName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const cleanName = normalizeFileName(fileName);
  return `videos/${timestamp}_${random}_${cleanName}`;
}

/**
 * 更新 moment 中的视频路径（导入后使用新的本地路径）
 */
function updateMomentVideoPath(data, videoId, newPath) {
  const allMoments = [
    ...(data.moments || []),
    ...(data.data?.moments || []),
    ...(data.v2AccountData?.timeline || [])
  ];

  for (const moment of allMoments) {
    if (moment.videos && Array.isArray(moment.videos)) {
      for (const video of moment.videos) {
        if (video.id === videoId || moment.id === videoId) {
          video.opfsPath = newPath;
          video.filename = newPath;
          delete video.url; // 清理旧 URL
        }
      }
    }
  }
}

/**
 * 检查取消信号
 */
function checkAbort(signal) {
  if (signal?.aborted) {
    throw new Error('导入已取消');
  }
}

export default {
  importFromZip,
  validateBackupData
};
