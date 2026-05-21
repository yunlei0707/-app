/**
 * 🧠 Media Service - 视频处理业务层
 * 
 * 职责：批量视频处理、并发控制、失败收集、文件名规范化
 * 不直接操作存储（调用 storageAdapter），不直接操作 ZIP（调用 zipAdapter）
 */

import { getVideoBlob } from '../adapters/storageAdapter.js';

/**
 * 批量处理视频
 * @param {Array<VideoInfo>} videos - 视频列表
 * @param {Object} options
 * @param {Function} [options.onProgress=null] - 进度回调 ({ current, total })
 * @param {AbortSignal} [options.signal=null] - 取消信号
 * @returns {Promise<Object>} { results: Array, failed: Array }
 */
export async function processVideos(videos, options = {}) {
  const { onProgress = null, signal = null } = options;

  if (!Array.isArray(videos)) {
    throw new Error('[mediaService] videos 必须是数组');
  }

  console.log(`[mediaService] 开始处理 ${videos.length} 个视频，无数量限制...`);

  const results = [];
  const failed = [];
  let processed = 0;

  // ✅ 串行处理，保护 IO，避免同时打开太多文件句柄导致 ANR
  for (const video of videos) {
    // 检查取消信号
    if (signal?.aborted) {
      console.log('[mediaService] 导出已取消');
      throw new Error('导出已取消');
    }

    try {
      if (!video.path) {
        throw new Error('视频路径为空');
      }

      // 调用底层适配器（永远返回 Blob）
      const blob = await getVideoBlob(video.path);

      // 规范化文件名（Android/iOS 解压防坑）
      const fileName = normalizeFileName(video.fileName || video.path.split('/').pop());

      results.push({
        id: video.id,
        momentId: video.momentId,
        originalName: video.fileName,
        fileName,
        blob
      });

    } catch (err) {
      console.warn(`[mediaService] 视频处理失败: ${video.id}`, err.message);
      failed.push({
        id: video.id,
        path: video.path,
        error: err.message
      });
    }

    // 更新进度
    processed++;
    if (onProgress) {
      onProgress({ current: processed, total: videos.length });
    }

    // 每处理 5 个让出一次主线程（防止 UI 卡死 / ANR）
    if (processed % 5 === 0 && processed < videos.length) {
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  console.log(`[mediaService] 处理完成: 成功 ${results.length}, 失败 ${failed.length}`);
  return { results, failed };
}

/**
 * 文件名规范化（防止 Android/iOS ZIP 解压乱码）
 * - 中文、空格、特殊字符全部转下划线
 * - 统一小写
 * - 保留扩展名
 * @param {string} name - 原始文件名
 * @returns {string} 规范化后的文件名
 */
export function normalizeFileName(name) {
  if (!name) return `video_${Date.now()}.mp4`;
  
  // 保留扩展名
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop() : 'mp4';
  const baseName = parts.join('.');
  
  // 规范化：只保留字母、数字、下划线、点、横杠
  const normalized = baseName
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .toLowerCase();
  
  // 避免空文件名
  const finalName = normalized || `video_${Date.now()}`;
  
  return `${finalName}.${ext}`;
}

export default {
  processVideos,
  normalizeFileName
};
