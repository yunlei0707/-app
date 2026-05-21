/**
 * 🧠 ZIP Adapter - window.JSZip 隔离层
 * 只接收 Blob，流式生成，隔离上层
 */

export function createZip() {
  if (!window.JSZip) throw new Error('[zipAdapter] window.JSZip 未加载');
  const zip = new window.JSZip();

  return {
    addFile(path, blob) {
      if (!(blob instanceof Blob)) throw new Error('addFile 只接收 Blob');
      zip.file(path, blob);
      console.debug(`[zipAdapter] 添加文件: ${path}, size: ${blob.size}`);
    },

    async generate(onProgress = null) {
      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          streamFiles: true,
          compression: 'DEFLATE',
          compressionOptions: { level: 3 }
        },
        metadata => onProgress?.(metadata.percent)
      );

      if (zipBlob.size < 1000) throw new Error('ZIP 文件生成失败');
      return zipBlob;
    }
  };
}

export async function unzip(fileBlob) {
  if (!window.JSZip) throw new Error('[zipAdapter] window.JSZip 未加载');
  if (!(fileBlob instanceof Blob)) throw new Error('unzip 只接收 Blob');

  const zip = await window.JSZip.loadAsync(fileBlob);

  return {
    async getJSON(path) {
      const f = zip.file(path);
      if (!f) throw new Error(`ZIP 缺少文件: ${path}`);
      const content = await f.async('string');
      return JSON.parse(content);
    },

    async getBlob(path) {
      const f = zip.file(path);
      return f ? await f.async('blob') : null;
    },

    listFiles() {
      return Object.keys(zip.files);
    },

    getRawZip() {
      return zip;
    }
  };
}

export default { createZip, unzip };
