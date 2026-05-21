/**
 * 🧠 ZIP Adapter - JSZip 隔离层
 * 
 * 核心原则：彻底隔离 window.JSZip，上层永远不需要直接调用 JSZip
 * 只暴露两个方法：addFile（只接受 Blob）、generate（流式生成）
 * 
 * 🔥 架构级强制约束：函数签名只接受 Blob，想传 base64？IDE 直接报错！
 */

/**
 * 创建 ZIP 实例
 * 只暴露安全的方法，禁止上层直接操作 JSZip 内部对象
 * @returns {Object} { addFile, generate }
 */
export function createZip() {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('[zipAdapter] JSZip 未加载，请检查依赖');
  }

  const zip = new window.JSZip();

  return {
    /**
     * 添加文件到 ZIP
     * ⚠️ 只接受 Blob！禁止传 base64！
     * @param {string} filePath - ZIP 内的文件路径
     * @param {Blob} blob - 文件 Blob
     */
    addFile(filePath, blob) {
      if (!(blob instanceof Blob)) {
        throw new Error(`[zipAdapter] addFile 只接受 Blob 类型，收到: ${typeof blob}`);
      }
      if (blob.size === 0) {
        console.warn(`[zipAdapter] 警告：文件大小为 0: ${filePath}`);
      }

      zip.file(filePath, blob);
      console.debug(`[zipAdapter] 添加文件: ${filePath}, size: ${blob.size} bytes`);
    },

    /**
     * 流式生成 ZIP
     * @param {Function} onProgress - 进度回调 (0-100)
     * @returns {Promise<Blob>} ZIP Blob
     */
    async generate(onProgress = null) {
      console.log('[zipAdapter] 开始流式生成 ZIP...');

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          streamFiles: true, // ✅ 关键：流式生成，内存减半
          compression: 'DEFLATE',
          compressionOptions: { level: 3 } // 平衡速度/压缩率
        },
        (metadata) => {
          // JSZip 内部进度回调（0-100）
          if (onProgress) {
            onProgress(metadata.percent);
          }
        }
      );

      // 有效性校验
      if (zipBlob.size < 1000) {
        throw new Error(`[zipAdapter] ZIP 生成异常，大小仅 ${zipBlob.size} bytes`);
      }

      console.log(`[zipAdapter] ZIP 生成完成，大小: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
      return zipBlob;
    }
  };
}

export default {
  createZip
};

/**
 * 解压 ZIP 文件
 * @param {Blob} fileBlob - ZIP 文件 Blob
 * @returns {Object} { getJSON, getBlob, listFiles, getRawZip }
 */
export async function unzip(fileBlob) {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('[zipAdapter] JSZip 未加载，请检查依赖');
  }

  if (!(fileBlob instanceof Blob)) {
    throw new Error(`[zipAdapter] unzip 只接受 Blob 类型，收到: ${typeof fileBlob}`);
  }

  console.log('[zipAdapter] 开始解压 ZIP，大小:', (fileBlob.size / 1024 / 1024).toFixed(2), 'MB');
  const zip = await window.JSZip.loadAsync(fileBlob);

  return {
    /**
     * 读取 JSON 文件
     * @param {string} path - 文件路径
     * @returns {Promise<Object>} 解析后的 JSON
     */
    async getJSON(path) {
      const file = zip.file(path);
      if (!file) {
        throw new Error(`[zipAdapter] ZIP 中缺少文件: ${path}`);
      }
      const content = await file.async('string');
      try {
        return JSON.parse(content);
      } catch (e) {
        throw new Error(`[zipAdapter] JSON 解析失败: ${path}, ${e.message}`);
      }
    },

    /**
     * 读取 Blob 文件
     * @param {string} path - 文件路径
     * @returns {Promise<Blob|null>} 文件 Blob
     */
    async getBlob(path) {
      const file = zip.file(path);
      if (!file) {
        console.warn(`[zipAdapter] ZIP 中缺失文件: ${path}`);
        return null;
      }
      return await file.async('blob');
    },

    /**
     * 列出 ZIP 中所有文件
     * @returns {Array<string>} 文件路径列表
     */
    listFiles() {
      return Object.keys(zip.files);
    },

    /**
     * 获取 ZIP 原始对象（高级用）
     * @returns {Object} JSZip 实例
     */
    getRawZip() {
      return zip;
    }
  };
}
