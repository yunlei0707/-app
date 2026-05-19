/**
 * ✅ 生产级：存储适配器
 * 使用标准 Capacitor Filesystem 插件
 */

// ==================== 工具函数 ====================

function isAppEnvironment() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  } catch (e) {
    return false;
  }
}

async function loadFilesystem() {
  try {
    const module = await import('@capacitor/filesystem');
    return module.Filesystem;
  } catch (e) {
    console.warn('[Storage] Filesystem plugin not available');
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
 * 保存视频到APP原生文件系统
 */
export async function saveVideoToNative(file, onProgress = null) {
  if (!isAppEnvironment()) {
    throw new Error('请在APP中使用此功能');
  }

  try {
    console.log('[Storage] 保存视频到原生文件系统');
    const filename = generateUniqueFilename(file.name);
    const totalSize = file.size;

    // 转成Base64（Capacitor Filesystem要求）
    const base64 = await fileToBase64(file, onProgress);

    // 写入文件系统
    const Filesystem = await loadFilesystem();
    if (!Filesystem) throw new Error('文件系统不可用');

    await Filesystem.writeFile({
      path: `BabyTime/videos/${filename}`,
      data: base64,
      directory: Filesystem.Directory.Documents,
      recursive: true,
    });

    console.log('[Storage] 视频保存成功:', filename);

    return {
      filename,
      size: file.size,
      type: file.type,
      storageType: 'native',
    };

  } catch (e) {
    console.error('[Storage] 视频保存失败:', e);
    throw new Error(`保存失败: ${e.message}`);
  }
}

/**
 * 从原生文件系统读取视频
 */
export async function readVideoFromNative(filename) {
  if (!isAppEnvironment()) {
    throw new Error('请在APP中使用此功能');
  }

  try {
    const Filesystem = await loadFilesystem();
    if (!Filesystem) throw new Error('文件系统不可用');

    const result = await Filesystem.readFile({
      path: `BabyTime/videos/${filename}`,
      directory: Filesystem.Directory.Documents,
    });

    // base64转Blob
    const response = await fetch(`data:video/mp4;base64,${result.data}`);
    return await response.blob();

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
    const Filesystem = await loadFilesystem();
    if (!Filesystem) throw new Error('文件系统不可用');

    await Filesystem.deleteFile({
      path: `BabyTime/videos/${filename}`,
      directory: Filesystem.Directory.Documents,
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
