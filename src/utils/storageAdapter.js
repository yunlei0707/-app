/**
 * ✅ 生产级：存储适配器
 * 使用标准 Capacitor Filesystem 插件
 */
import { getVideoPath } from '../constants/storage.js';

// ==================== 工具函数 ====================

// Filesystem 单例缓存（P1-2 优化：避免重复加载插件）
let _filesystemCache = null;

function isAppEnvironment() {
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
      console.log('[Storage] 从Capacitor.Plugins获取文件系统插件');
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
    
    console.warn('[Storage] 未找到文件系统插件');
    return null;
  } catch (e) {
    console.warn('[Storage] Filesystem plugin not available', e);
    return null;
  }
}

/**
 * 生成唯一文件名
 */
export function generateUniqueFilename(originalName) {
  const ext = originalName.split('.').pop() || 'mp4';
  const uuid = crypto.randomUUID();
  return `${uuid}.${ext}`;
}

/**
 * File转Base64，带进度
 */
function fileToBase64(file, onProgress = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      if (onProgress) onProgress(100);
      resolve(base64);
    };
    
    reader.onerror = reject;
    
    if (onProgress) {
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }
    
    reader.readAsDataURL(file);
  });
}

// ==================== 原生文件系统操作 ====================

/**
 * 保存文件到APP原生文件系统（照片/视频/音频通用）
 * ✅ 支持 Blob 直接写入，避免大文件转 Base64 卡死
 */
export async function saveVideoToNative(file, onProgress = null) {
  if (!isAppEnvironment()) {
    throw new Error('请在APP中使用此功能');
  }

  try {
    console.log('[Storage] 保存文件:', file.name, '大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    const filename = generateUniqueFilename(file.name);
    const startTime = Date.now();

    // 加载插件
    const filesystem = await loadFilesystem();
    if (!filesystem) throw new Error('文件系统不可用');
    const { Filesystem, Directory } = filesystem;

    // ✅ 方案1：直接 Blob 写入（Capacitor 5+ 支持）
    let writeSucceeded = false;
    try {
      await Filesystem.writeFile({
        path: getVideoPath(filename),
        data: file,  // 直接传 Blob/File 对象
        directory: Directory.Documents,
        recursive: true,
      });
      writeSucceeded = true;
      console.log('[Storage] ✅ 直接Blob写入成功');
    } catch (blobError) {
      console.warn('[Storage] Blob写入失败，降级为Base64:', blobError.message);
    }

    // ❌ 方案2：降级为 Base64（仅用于小文件/兼容旧版本）
    if (!writeSucceeded) {
      const base64 = await fileToBase64(file, onProgress);
      await Filesystem.writeFile({
        path: getVideoPath(filename),
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const avgSpeed = (file.size / 1024 / 1024 / totalTime).toFixed(1);
    console.log(`[Storage] ✅ 保存成功: ${filename}, 平均速度: ${avgSpeed} MB/s`);

    if (onProgress) onProgress(100);

    return {
      filename,
      size: file.size,
      type: file.type,
      storageType: 'native',
      avgSpeed: parseFloat(avgSpeed),
    };

  } catch (e) {
    console.error('[Storage] ❌ 保存失败:', e);
    throw new Error(`保存失败: ${e.message}`);
  }
}

/**
 * 从原生文件系统读取视频
 * ✅ 兼容新旧格式：新数据 Blob，旧数据 Base64
 */
export async function readVideoFromNative(filename) {
  if (!isAppEnvironment()) {
    throw new Error('请在APP中使用此功能');
  }

  try {
    const filesystem = await loadFilesystem();
    if (!filesystem) throw new Error('文件系统不可用');
    const { Filesystem, Directory } = filesystem;

    const result = await Filesystem.readFile({
      path: getVideoPath(filename),
      directory: Directory.Documents,
    });

    // ✅ 自动检测返回类型
    if (result.data instanceof Blob) {
      // 新格式：直接是 Blob 对象
      console.log('[Storage] ✅ 检测到新版Blob格式数据');
      return result.data;
    } else if (typeof result.data === 'string') {
      // 旧格式：Base64 字符串（兼容老数据）
      console.log('[Storage] ⚠️ 检测到旧版Base64格式数据，兼容读取');
      const response = await fetch(`data:video/mp4;base64,${result.data}`);
      return await response.blob();
    }

    console.warn('[Storage] 未知数据格式:', typeof result.data);
    return result.data;

  } catch (e) {
    console.error('[Storage] 读取视频失败:', filename, e);
    throw new Error('视频文件不存在或已损坏');
  }
}

/**
 * 删除视频
 */
export async function deleteVideoFromNative(filename) {
  if (!isAppEnvironment()) return false;

  try {
    const filesystem = await loadFilesystem();
    if (!filesystem) throw new Error('文件系统不可用');
    const { Filesystem, Directory } = filesystem;

    await Filesystem.deleteFile({
      path: getVideoPath(filename),
      directory: Directory.Documents,
    });

    console.log('[Storage] 视频已删除:', filename);
    return true;

  } catch (e) {
    console.error('[Storage] 删除视频失败:', e);
    return false;
  }
}

// ==================== 统一入口（自动选择最佳方式） ====================

/**
 * 智能保存视频
 */
export async function saveVideo(file, onProgress = null) {
  if (isAppEnvironment()) {
    return saveVideoToNative(file, onProgress);
  } else {
    // Web环境：降级到OPFS
    const { saveVideoToOPFS } = await import('./opfs');
    return saveVideoToOPFS(file);
  }
}

/**
 * 智能读取视频
 */
export async function readVideo(filename, storageType = null) {
  if (storageType === 'native' || isAppEnvironment()) {
    try {
      return await readVideoFromNative(filename);
    } catch (e) {
      console.log('[Storage] 原生读取失败，降级到OPFS');
    }
  }
  
  // 降级到OPFS
  const { readVideoFromOPFS } = await import('./opfs');
  return readVideoFromOPFS(filename);
}

/**
 * 智能删除视频
 */
export async function deleteVideo(filename, storageType = null) {
  if (storageType === 'native' || isAppEnvironment()) {
    try {
      return await deleteVideoFromNative(filename);
    } catch (e) {
      console.log('[Storage] 原生删除失败，降级到OPFS');
    }
  }
  
  // 降级到OPFS
  const { deleteVideoFromOPFS } = await import('./opfs');
  return deleteVideoFromOPFS(filename);
}

export default {
  isAppEnvironment,
  generateUniqueFilename,
  saveVideo,
  readVideo,
  deleteVideo,
  saveVideoToNative,
  readVideoFromNative,
  deleteVideoFromNative,
};
