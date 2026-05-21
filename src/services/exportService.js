/**
 * 🧠 Export Service - 🔥唯一导出入口
 * 
 * 职责：流程编排、进度管理、fileMap 一致性、导出报告
 * 不直接操作存储、不直接操作 ZIP（全部委托下层）
 * 
 * 六步标准流程：
 * 1️⃣ 获取数据 → 2️⃣ 处理视频 → 3️⃣ 创建ZIP → 4️⃣ 写入JSON → 5️⃣ 生成ZIP → 6️⃣ 保存本地
 */

import { processVideos } from './mediaService.js';
import { createZip } from './adapters/zipAdapter.js';
import { exportAllData as exportDBData } from '../utils/db.js';
import { exportV2AccountData } from '../utils/dbV2.js';
import { BASE_DIR } from '../constants/storage.js';

let _filesystemCache = null;
let _filesystemLoaded = false;

/**
 * 🔥 唯一导出入口
 * @param {Object} options
 * @param {boolean} options.includeVideos - 是否导出视频
 * @param {Function} options.onProgress - 进度回调
 * @param {AbortSignal} options.signal - 取消信号
 * @returns {Object} { success, filePath, fileName, fileSize, report }
 */
export async function exportAllData(options = {}) {
  const {
    includeVideos = false,
    onProgress = null,
    signal = null
  } = options;

  const startTime = Date.now();

  console.log('[exportService] 开始导出流程...');

  try {
    // ========== 1️⃣ 获取数据 ==========
    if (onProgress) onProgress({ step: 'loading', percent: 5, message: '正在读取数据...' });
    checkAbort(signal);

    const mergedData = await getAllMomentsFromDB();
    const videos = extractVideosFromData(mergedData);

    if (onProgress) onProgress({
      step: 'ready',
      percent: 10,
      message: `数据读取完成，共 ${videos.length} 个视频`
    });

    // ========== 2️⃣ 处理视频 ==========
    let videoResults = [];
    let failedVideos = [];

    if (includeVideos && videos.length > 0) {
      checkAbort(signal);

      const mediaResult = await processVideos(videos, {
        onProgress: (p) => {
          // 视频处理占 10-80% 进度
          const percent = 10 + Math.floor((p.current / p.total) * 70);
          if (onProgress) {
            onProgress({
              step: 'processing',
              percent,
              message: `处理视频中: ${p.current}/${p.total}`,
              stats: {
                total: p.total,
                current: p.current,
                success: videoResults.length,
                failed: failedVideos.length
              }
            });
          }
        },
        signal
      });

      videoResults = mediaResult.results;
      failedVideos = mediaResult.failed;
    }

    // ========== 3️⃣ 创建 ZIP ==========
    checkAbort(signal);
    if (onProgress) onProgress({ step: 'packing', percent: 80, message: '正在打包...' });

    const zip = createZip();
    const fileMap = {};

    // 添加视频文件
    for (const video of videoResults) {
      const path = `videos/${video.fileName}`;
      zip.addFile(path, video.blob); // ✅ 只传 Blob

      // fileMap 强一致性记录
      fileMap[video.id] = {
        fileName: video.fileName,
        originalName: video.originalName,
        fileSize: video.blob.size
      };
    }

    // ========== 4️⃣ 写入 JSON ==========
    mergedData.fileMap = fileMap;
    mergedData.exportVersion = '2.1.0';
    mergedData.schemaVersion = 1;

    const jsonBlob = new Blob(
      [JSON.stringify(mergedData, null, 2)],
      { type: 'application/json' }
    );
    zip.addFile('data.json', jsonBlob);

    // ========== 5️⃣ 生成 ZIP ==========
    checkAbort(signal);
    if (onProgress) onProgress({ step: 'zipping', percent: 80, message: '正在压缩...' });

    const zipBlob = await zip.generate((zipPercent) => {
      // ZIP 压缩进度占 80-95%
      const percent = 80 + Math.floor(zipPercent * 0.15);
      if (onProgress) {
        onProgress({
          step: 'zipping',
          percent,
          message: `压缩中 ${zipPercent.toFixed(0)}%`
        });
      }
    });

    // ========== 6️⃣ 保存本地 ==========
    checkAbort(signal);
    if (onProgress) onProgress({ step: 'saving', percent: 95, message: '正在保存文件...' });

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const zipFilename = `baby_backup_${timestamp}.zip`;
    const zipFilePath = `${BASE_DIR}/${zipFilename}`;

    const filePath = await saveToLocal(zipBlob, zipFilePath, zipFilename);

    // ========== 完成：生成报告 ==========
    const duration = Date.now() - startTime;
    const report = {
      time: new Date().toISOString(),
      duration,
      totalVideos: videos.length,
      successVideos: videoResults.length,
      failedVideos: failedVideos.length,
      fileSize: zipBlob.size,
      compressionRatio: calcTotalSize(videoResults) / zipBlob.size || 1,
      includeVideos,
      failedList: failedVideos
    };

    console.log('[exportService] 导出报告:', report);

    if (onProgress) onProgress({
      step: 'complete',
      percent: 100,
      message: '导出完成！',
      report
    });

    return {
      success: true,
      filePath,
      fileName: zipFilename,
      fileSize: zipBlob.size,
      report
    };

  } catch (error) {
    if (error.message === '导出已取消') {
      console.log('[exportService] 用户取消了导出');
    } else {
      console.error('[exportService] 导出失败:', error);
    }
    throw error;
  }
}

// ==================== 内部辅助函数 ====================

/**
 * 从数据库获取所有数据
 */
async function getAllMomentsFromDB() {
  const [idbData, v2Data] = await Promise.all([
    exportDBData().catch(e => {
      console.warn('[exportService] 读取 IndexDB 失败:', e);
      return null;
    }),
    exportV2AccountData()
  ]);

  return {
    ...(idbData?.data || {}),
    ...(idbData || {}),
    v2AccountData: v2Data,
    exportTime: new Date().toISOString()
  };
}

/**
 * 从数据中提取视频列表
 */
function extractVideosFromData(data) {
  const videos = [];
  const seenPaths = new Set();

  function addMomentVideos(moment) {
    if (!moment?.videos || !Array.isArray(moment.videos)) return;

    for (const video of moment.videos) {
      const path = video.opfsPath || video.filename || video.url;
      if (!path || seenPaths.has(path)) continue;

      seenPaths.add(path);
      videos.push({
        id: moment.id || `vid_${videos.length}`,
        path,
        fileName: video.filename || video.opfsPath || `video_${videos.length}.mp4`,
        momentId: moment.id
      });
    }
  }

  // v2 账号数据
  if (data.v2AccountData?.timeline) {
    data.v2AccountData.timeline.forEach(addMomentVideos);
  }
  // IndexedDB 数据
  if (data.data?.moments) {
    data.data.moments.forEach(addMomentVideos);
  }
  // 顶层 moments
  if (data.moments) {
    data.moments.forEach(addMomentVideos);
  }

  console.log(`[exportService] 提取到 ${videos.length} 个视频`);
  return videos;
}

/**
 * 保存 ZIP 到本地文件系统
 */
async function saveToLocal(blob, filePath, fileName) {
  const fs = await loadFilesystem();
  if (!fs) throw new Error('[exportService] 文件系统不可用');

  // Blob → base64（仅用于 Filesystem 写入）
  const base64 = await blobToBase64(blob);

  await fs.Filesystem.writeFile({
    path: filePath,
    data: base64,
    directory: fs.Directory.Documents,
    recursive: true
  });

  console.log(`[exportService] 文件已保存: ${filePath}`);
  return filePath;
}

/**
 * Blob → Base64（仅用于 Filesystem 写入接口，不对外暴露）
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 懒加载 Filesystem
 */
async function loadFilesystem() {
  if (_filesystemLoaded) return _filesystemCache;

  try {
    if (window.Capacitor?.Plugins?.Filesystem) {
      const module = window.Capacitor.Plugins.Filesystem;
      const Filesystem = module.Filesystem || module.default?.Filesystem || module;
      const Directory = module.Directory || module.default?.Directory || {
        Documents: 'DOCUMENTS',
        Data: 'DATA',
        Cache: 'CACHE'
      };

      _filesystemCache = { Filesystem, Directory };
      _filesystemLoaded = true;
      return _filesystemCache;
    }
  } catch (e) {
    console.warn('[exportService] Filesystem 加载失败:', e);
  }

  return null;
}

/**
 * 检查取消信号
 */
function checkAbort(signal) {
  if (signal?.aborted) {
    throw new Error('导出已取消');
  }
}

/**
 * 计算视频总大小
 */
function calcTotalSize(videoResults) {
  return videoResults.reduce((sum, v) => sum + (v.blob?.size || 0), 0);
}

// ==================== 兼容性导出 ====================

/**
 * 兼容旧调用方式
 */
export const exportAllDataWithVideos = (opts) => exportAllData({ ...opts, includeVideos: true });

/**
 * Web 下载（兼容保留）
 */
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
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  } catch (e) {
    return false;
  }
}

export default {
  exportAllData,
  exportAllDataWithVideos,
  triggerDownload,
  isNativePlatform
};
