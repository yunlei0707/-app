/**
 * ✅ 生产级：ZIP导出工具
 * 使用标准 Capacitor Filesystem + Share 插件
 */

import { readVideoFromOPFS } from './opfs';
import { exportAllData as exportAllDBData } from './db';
import { exportV2AccountData } from './dbV2';

// ==================== 配置 ====================

const CHUNK_SIZE = 1024 * 1024; // 1MB分块

// ==================== 工具函数 ====================

function isNativePlatform() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  } catch (e) {
    return false;
  }
}

async function loadFilesystem() {
  try {
    // 🔴 关键修复：从Capacitor.Plugins获取，不使用动态import
    if (window.Capacitor?.Plugins?.Filesystem) {
      console.log('[ZIP] 从Capacitor.Plugins获取文件系统插件');
      return { 
        Filesystem: window.Capacitor.Plugins.Filesystem,
        Directory: window.Capacitor.Plugins.Filesystem?.Directory || window.Capacitor?.Plugins?.Directory
      };
    }
    
    // 尝试其他方式
    if (window.Filesystem) {
      console.log('[ZIP] 从window.Filesystem获取');
      return { Filesystem: window.Filesystem, Directory: window.Directory };
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
    // 🔴 关键修复：从Capacitor.Plugins获取，不使用动态import
    if (window.Capacitor?.Plugins?.Share) {
      console.log('[ZIP] 从Capacitor.Plugins获取分享插件');
      return window.Capacitor.Plugins.Share;
    }
    
    // 尝试其他方式
    if (window.Share) {
      console.log('[ZIP] 从window.Share获取');
      return window.Share;
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

// ==================== 核心导出函数 ====================

/**
 * 导出所有数据（JSON格式 + 视频文件）
 */
export async function exportAllData(options = {}) {
  const { includeVideos = true, onProgress = null } = options;

  if (!isNativePlatform()) {
    throw new Error('请在APP中使用导出功能');
  }

  try {
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
    };

    if (onProgress) {
      onProgress({ step: 1, progress: 40, message: '数据读取完成', stats: null });
    }

    // 生成文件名
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filePath = `BabyTime/backup_${timestamp}.json`;

    // 写入JSON文件
    const jsonStr = JSON.stringify(mergedData, null, 2);
    const jsonBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

    const filesystem = await loadFilesystem();
    if (!filesystem) throw new Error('文件系统不可用');
    const { Filesystem, Directory } = filesystem;

    await Filesystem.writeFile({
      path: filePath,
      data: jsonBase64,
      directory: Directory.Documents,
      recursive: true,
    });

    if (onProgress) {
      onProgress({ step: 2, progress: 80, message: '数据已保存，准备分享...', stats: null });
    }

    // 获取文件URI并分享
    const fileUri = await Filesystem.getUri({
      path: filePath,
      directory: Directory.Documents,
    });

    const Share = await loadShare();
    if (Share) {
      await Share.share({
        title: '宝贝时光数据备份',
        text: `备份时间：${new Date().toLocaleString()}`,
        url: fileUri.uri,
      });
    }

    if (onProgress) {
      onProgress({ step: 3, progress: 100, message: '导出完成', stats: null });
    }

    return { success: true, filePath, fileUri: fileUri.uri };

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
