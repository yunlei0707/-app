/**
 * 🧠 Import Service - 🔥唯一导入入口
 * 
 * 职责：ZIP解压、数据预检、媒体恢复、冲突处理、进度管理
 * 不直接操作存储、不直接操作 ZIP（全部委托下层）
 * 
 * 五步标准流程：
 * 1️⃣ 解压 ZIP → 2️⃣ 读取并校验 JSON → 3️⃣ 恢复视频 → 4️⃣ 重建路径映射 → 5️⃣ 恢复数据库
 */

import { unzip } from './adapters/zipAdapter.js';
import { saveVideoBlob } from './adapters/storageAdapter.js';
import { restoreMoments } from './restoreService.js';
import { importV2AccountData } from '../utils/dbV2.js';

/**
 * 🔥 唯一导入入口
 * @param {Object} options
 * @param {Blob} options.zipFile - ZIP 文件 Blob
 * @param {string} [options.mode='merge'] - 导入模式：merge / overwrite
 * @param {Function} [options.onProgress=null] - 进度回调 ({ step, progress, message, result })
 * @param {AbortSignal} [options.signal=null] - 取消信号
 * @returns {Promise<Object>} { success, totalMoments, restoredMoments, totalVideos, restoredVideos, failedVideos, duration, mode }
 */
export async function importAllData(options = {}) {
  const {
    zipFile,
    mode = 'merge',
    onProgress = null,
    signal = null
  } = options;

  const startTime = Date.now();
  console.log('[importService] 开始导入流程，模式:', mode);

  try {
    // ========== 1️⃣ 解压 ZIP ==========
    if (onProgress) onProgress({ 
      step: 'unzip', 
      progress: 10, 
      message: '正在解压备份文件...' 
    });
    checkAbort(signal);

    const zip = await unzip(zipFile);

    // ========== 2️⃣ 读取并校验 JSON ==========
    if (onProgress) onProgress({ 
      step: 'validate', 
      progress: 20, 
      message: '正在校验数据格式...' 
    });
    checkAbort(signal);

    const data = await zip.getJSON('data.json');
    const { moments, fileMap, v2AccountData } = data;

    // 数据校验
    if (!moments && !v2AccountData) {
      throw new Error('备份文件中没有有效数据');
    }

    // 校验 schema 版本
    if (data.schemaVersion !== 1) {
      console.warn(`[importService] 不支持的 schema 版本: ${data.schemaVersion}，尝试兼容导入`);
    }

    // ========== 3️⃣ 恢复视频文件 ==========
    let restoredVideos = 0;
    let failedVideos = [];
    const totalVideos = Object.keys(fileMap || {}).length;

    if (totalVideos > 0) {
      if (onProgress) onProgress({ 
        step: 'restore_media', 
        progress: 30, 
        message: `正在恢复视频文件 0/${totalVideos}` 
      });

      let processed = 0;
      for (const [id, fileInfo] of Object.entries(fileMap || {})) {
        if (signal?.aborted) {
          throw new Error('导入已取消');
        }

        try {
          const zipPath = `videos/${fileInfo.fileName}`;
          const blob = await zip.getBlob(zipPath);
          
          if (!blob || blob.size === 0) {
            throw new Error('视频文件为空或缺失');
          }

          // 生成本地存储路径
          const localPath = `videos/${Date.now()}_${fileInfo.fileName}`;
          await saveVideoBlob(localPath, blob);

          // 更新 moments 中的视频路径
          updateMomentVideoPath(moments, id, localPath);
          // 同时更新 v2AccountData 里的视频路径
          if (v2AccountData?.timeline) {
            updateMomentVideoPath(v2AccountData.timeline, id, localPath);
          }

          restoredVideos++;

        } catch (err) {
          console.warn(`[importService] 视频恢复失败: ${id}`, err.message);
          failedVideos.push({ id, error: err.message });
        }

        processed++;
        if (onProgress) {
          onProgress({
            step: 'restore_media',
            progress: 30 + Math.floor((processed / totalVideos) * 50),
            message: `正在恢复视频文件 ${processed}/${totalVideos}`
          });
        }

        // 每处理 5 个让出主线程（防止 ANR）
        if (processed % 5 === 0 && processed < totalVideos) {
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    }

    // ========== 4️⃣ 恢复数据库 ==========
    if (onProgress) onProgress({ 
      step: 'restore_db', 
      progress: 85, 
      message: '正在恢复数据...' 
    });
    checkAbort(signal);

    let restoredMoments = 0;

    // 优先恢复 v2 账号数据（无数量限制）
    if (v2AccountData) {
      await importV2AccountData(v2AccountData, mode);
      restoredMoments = v2AccountData.timeline?.length || 0;
    }

    // 恢复 IndexedDB 数据（无数量限制）
    if (moments && moments.length > 0 && !v2AccountData) {
      const result = await restoreMoments(moments, { mode });
      restoredMoments = result.restored || 0;
      // 冲突信息可以通过 result.conflicts 获取，后续可用于UI展示
    }

    // ========== 5️⃣ 完成 ==========
    const duration = Date.now() - startTime;
    const result = {
      success: true,
      totalMoments: restoredMoments,
      restoredMoments,
      totalVideos,
      restoredVideos,
      failedVideos,
      duration,
      mode
    };

    if (onProgress) onProgress({
      step: 'complete',
      progress: 100,
      message: '导入完成！',
      result
    });

    console.log('[importService] 导入完成:', result);
    return result;

  } catch (error) {
    if (error.message === '导入已取消') {
      console.log('[importService] 用户取消了导入');
    } else {
      console.error('[importService] 导入失败:', error);
    }
    throw error;
  }
}

// ==================== 内部辅助函数 ====================

/**
 * 检查取消信号
 * @param {AbortSignal} signal - 取消信号
 */
function checkAbort(signal) {
  if (signal?.aborted) {
    throw new Error('导入已取消');
  }
}

/**
 * 更新 moment 中的视频路径
 * @param {Array} moments - 动态列表
 * @param {string} videoId - 视频ID
 * @param {string} newPath - 新路径
 */
function updateMomentVideoPath(moments, videoId, newPath) {
  if (!Array.isArray(moments)) return;

  for (const moment of moments) {
    if (!Array.isArray(moment.videos)) continue;

    for (const video of moment.videos) {
      if (video.id === videoId || video.filename === videoId || video.path === videoId) {
        video.path = newPath;
        video.opfsPath = newPath;
      }
    }
  }
}

export default {
  importAllData
};
