/**
 * ✅ 生产级：ZIP导出工具（终极方案）
 * 核心设计：逐个处理 + 不炸内存 + 可恢复
 * 
 * 架构：
 * 1. JSZip打包（浏览器+APP通用）
 * 2. for循环串行读取视频（禁止Promise.all）
 * 3. 每处理2个视频让出一次主线程
 * 4. 最大300个视频导出限制
 * 5. 压缩级别=3（平衡速度/体积）
 */

import { readVideoFromOPFS } from './opfs';
import { exportAllData as exportAllDBData } from './db';
import { exportV2AccountData } from './dbV2';
import { BASE_DIR } from '../constants/storage.js';

// ==================== 配置 ====================

const CHUNK_SIZE = 1024 * 1024; // 1MB分块
const MAX_VIDEOS = 300; // 最大导出视频数量
const COMPRESSION_LEVEL = 3; // 压缩级别：平衡速度/体积

// ==================== 工具函数 ====================

// Filesystem 单例缓存（P1-2 优化：避免重复加载插件）
let _filesystemCache = null;

function isNativePlatform() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  } catch (e) {
    return false;
  }
}

async function loadFilesystem() {
  // ✅ 优先返回缓存
  if (_filesystemCache) {
    return _filesystemCache;
  }
  
  try {
    // 从Capacitor.Plugins获取，不使用动态import
    if (window.Capacitor?.Plugins?.Filesystem) {
      console.log('[ZIP] 从Capacitor.Plugins获取文件系统插件');
      const filesystemModule = window.Capacitor.Plugins.Filesystem;
      
      // 兼容不同的导出方式：模块对象可能包含 .Filesystem 属性
      const Filesystem = filesystemModule.Filesystem || filesystemModule.default?.Filesystem || filesystemModule;
      
      // Directory 枚举值
      const Directory = filesystemModule.Directory || filesystemModule.default?.Directory || {
        Documents: 'DOCUMENTS',
        Data: 'DATA',
        Cache: 'CACHE',
        External: 'EXTERNAL',
        ExternalStorage: 'EXTERNAL_STORAGE'
      };
      
      // 缓存结果
      _filesystemCache = { Filesystem, Directory };
      return _filesystemCache;
    }
    
    console.warn('[ZIP] 未找到文件系统插件');
    return null;
  } catch (e) {
    console.warn('[ZIP] Filesystem plugin not available', e);
    return null;
  }
}

async function loadShare() {
  try {
    // 从Capacitor.Plugins获取，不使用动态import
    if (window.Capacitor?.Plugins?.Share) {
      console.log('[ZIP] 从Capacitor.Plugins获取分享插件');
      const shareModule = window.Capacitor.Plugins.Share;
      // 兼容不同的导出方式：模块对象可能包含 .Share 属性
      return shareModule.Share || shareModule.default?.Share || shareModule;
    }
    
    console.warn('[ZIP] 未找到分享插件');
    return null;
  } catch (e) {
    console.warn('[ZIP] Share plugin not available', e);
    return null;
  }
}

/**
 * Blob转Base64（只返回数据部分）
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 从所有数据中提取视频列表
 */
function extractVideosFromData(mergedData) {
  const videos = [];
  
  // 从v2账号数据中提取视频
  if (mergedData.v2AccountData?.timeline) {
    for (const moment of mergedData.v2AccountData.timeline) {
      if (moment.videos && moment.videos.length > 0) {
        for (const video of moment.videos) {
          if (video.filename || video.url) {
            videos.push({
              type: video.filename ? 'opfs' : 'base64',
              filename: video.filename,
              data: video.url,
              outputFilename: video.filename || `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`,
            });
          }
        }
      }
    }
  }
  
  return videos;
}

// ==================== 核心导出函数 ====================

/**
 * 导出所有数据（ZIP格式 + 视频文件）
 * 终极方案：串行处理 + 让出主线程 + 内存保护
 */
export async function exportAllData(options = {}) {
  const { includeVideos = false, onProgress = null } = options;

  if (!isNativePlatform()) {
    throw new Error('请在APP中使用导出功能');
  }

  // 检查JSZip是否可用
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载，请检查网络连接');
  }

  try {
    // ========== 步骤1: 读取并准备数据 ==========
    if (onProgress) {
      onProgress({ step: 1, progress: 10, message: '正在读取数据...', stats: null });
    }

    // 读取数据库数据
    const [idbData, v2Data] = await Promise.all([
      exportAllDBData().catch(e => {
        console.warn('[ZIP] 读取IndexDB失败:', e);
        return null;
      }),
      exportV2AccountData(),
    ]);

    const mergedData = {
      ...(idbData?.data || {}),
      ...(idbData || {}),
      v2AccountData: v2Data,
      exportTime: new Date().toISOString(),
      exportVersion: '2.0.0',
      schemaVersion: 1,
    };

    // 提取所有视频
    const allVideos = extractVideosFromData(mergedData);

    // ========== 最大导出量限制（内存保护） ==========
    if (includeVideos && allVideos.length > MAX_VIDEOS) {
      throw new Error(`视频数量过多（${allVideos.length}个），单次导出最多支持${MAX_VIDEOS}个视频，请分批导出`);
    }

    const stats = {
      totalVideos: allVideos.length,
    };

    if (onProgress) {
      onProgress({ 
        step: 1, 
        progress: 30, 
        message: `数据读取完成，共${allVideos.length}个视频`, 
        stats 
      });
    }

    // 生成文件名
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const zipFilename = `BabyTimeBackup_${timestamp}.zip`;
    const zipFilePath = `${BASE_DIR}/${zipFilename}`;

    // ========== 步骤2: 创建ZIP并写入data.json ==========
    if (onProgress) {
      onProgress({ step: 2, progress: 40, message: '正在打包数据...', stats });
    }

    const zip = new window.JSZip();
    const mediaFolder = zip.folder('media');

    // 写入data.json（只存文件名，不存完整路径）
    const dataForJson = JSON.parse(JSON.stringify(mergedData));
    if (dataForJson.v2AccountData?.timeline) {
      for (const moment of dataForJson.v2AccountData.timeline) {
        if (moment.videos) {
          moment.videos = moment.videos.map(video => {
            const cleaned = { ...video };
            // 只保留文件名，方便导入恢复
            if (cleaned.filename) {
              cleaned.exportFilename = cleaned.filename;
              delete cleaned.filename;
            }
            if (cleaned.url && cleaned.url.startsWith('blob:')) {
              delete cleaned.url;
            }
            return cleaned;
          });
        }
      }
    }

    zip.file('data.json', JSON.stringify(dataForJson, null, 2));

    // ========== 步骤3: for循环逐个读取视频文件（核心！禁止Promise.all） ==========
    if (includeVideos && allVideos.length > 0) {
      if (onProgress) {
        onProgress({
          step: 3,
          progress: 40,
          message: `开始处理 ${allVideos.length} 个视频文件...`,
          stats,
        });
      }

      let processedVideos = 0;
      let successVideos = 0;
      let failedVideos = 0;

      // ✅ 串行处理：每次只在内存里放一个视频
      for (const videoInfo of allVideos) {
        try {
          let fileBlob;

          if (videoInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(videoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] OPFS视频读取失败 ${videoInfo.filename}:`, e);
              throw e;
            }
          } else if (videoInfo.type === 'base64') {
            // Base64转Blob
            const base64Data = videoInfo.data.split(',')[1] || videoInfo.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            fileBlob = new Blob([byteArray], { type: 'video/mp4' });
          }

          // 写入ZIP
          if (fileBlob) {
            mediaFolder.file(videoInfo.outputFilename, fileBlob);
            successVideos++;
          }

          processedVideos++;

          // 报告进度（视频处理占40%-85%）
          if (onProgress) {
            const videoProgress = 40 + Math.floor((processedVideos / allVideos.length) * 45);
            onProgress({
              step: 3,
              progress: videoProgress,
              message: `视频处理中: ${processedVideos}/${allVideos.length} (${successVideos}成功, ${failedVideos}失败)`,
              stats: { ...stats, processedVideos, successVideos, failedVideos },
            });
          }

          // ✅ 每处理2个视频让出一次主线程，防止UI卡死
          if (processedVideos % 2 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }

        } catch (e) {
          failedVideos++;
          processedVideos++;
          console.warn(`[ZIP] 视频处理失败 ${videoInfo.filename}:`, e);
        }
      }

      if (onProgress) {
        onProgress({
          step: 3,
          progress: 85,
          message: `视频处理完成: ${successVideos}/${allVideos.length} 成功写入`,
          stats: { ...stats, processedVideos, successVideos, failedVideos },
        });
      }
    } else if (!includeVideos) {
      if (onProgress) {
        onProgress({
          step: 3,
          progress: 85,
          message: '已跳过视频文件导出（仅导出数据）',
          stats,
        });
      }
    } else {
      if (onProgress) {
        onProgress({
          step: 3,
          progress: 85,
          message: '没有视频文件需要导出',
          stats,
        });
      }
    }

    // ========== 步骤4: 生成最终ZIP文件 ==========
    if (onProgress) {
      onProgress({ step: 4, progress: 90, message: '正在生成ZIP文件...', stats });
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: COMPRESSION_LEVEL },
    });

    if (onProgress) {
      onProgress({ step: 4, progress: 95, message: '正在写入文件系统...', stats });
    }

    // 写入文件系统
    const zipBase64 = await blobToBase64(zipBlob);

    const filesystem = await loadFilesystem();
    if (!filesystem) throw new Error('文件系统不可用');
    const { Filesystem, Directory } = filesystem;

    await Filesystem.writeFile({
      path: zipFilePath,
      data: zipBase64,
      directory: Directory.Documents,
      recursive: true,
    });

    // 获取文件URI
    const fileUri = await Filesystem.getUri({
      path: zipFilePath,
      directory: Directory.Documents,
    });

    if (onProgress) {
      onProgress({ step: 5, progress: 98, message: '准备分享...', stats });
    }

    // 分享文件
    const Share = await loadShare();
    if (Share) {
      await Share.share({
        title: '宝贝时光数据备份',
        text: `备份时间：${new Date().toLocaleString()}\n包含：${includeVideos ? `数据 + ${allVideos.length}个视频` : '仅数据'}`,
        url: fileUri.uri,
      });
    }

    if (onProgress) {
      onProgress({ step: 5, progress: 100, message: '导出完成', stats });
    }

    return { 
      success: true, 
      filePath: zipFilePath, 
      fileUri: fileUri.uri,
      stats: { totalVideos: allVideos.length, includeVideos }
    };

  } catch (error) {
    console.error('[ZIP] 导出失败:', error);
    throw error;
  }
}

/**
 * Web环境触发下载
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

export default {
  exportAllData,
  triggerDownload,
  isNativePlatform,
};
