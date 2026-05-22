/**
 * ZIP适配器 - 封装JSZip操作
 */

/**
 * 创建ZIP实例
 */
export function createZip() {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载');
  }
  return new window.JSZip();
}

/**
 * 生成ZIP Blob
 */
export async function generateZipBlob(zip, options = {}) {
  const {
    type = 'blob',
    compression = 'DEFLATE',
    level = 6,
    onProgress = null
  } = options;

  return await zip.generateAsync(
    {
      type,
      compression,
      compressionOptions: { level },
      streamFiles: true
    },
    (metadata) => {
      if (onProgress) {
        onProgress(metadata);
      }
    }
  );
}

export default {
  createZip,
  generateZipBlob
};
