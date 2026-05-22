/**
 * 媒体处理服务
 * 提供视频、音频等媒体文件的通用处理
 */

/**
 * 规范化文件名，移除非法字符
 */
export function sanitizeFilename(filename) {
  if (!filename) return 'unknown';
  return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);
}

/**
 * 判断是否为Base64数据
 */
export function isBase64Data(data) {
  return data && typeof data === 'string' && data.startsWith('data:');
}

/**
 * Base64转Blob
 */
export function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const data = base64.split(',')[1] || base64;
  const byteCharacters = atob(data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: mimeType });
}

/**
 * 并发控制工具
 */
export async function withConcurrency(items, handler, concurrency = 5) {
  const results = [];
  const errors = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await handler(items[index], index);
      } catch (error) {
        errors.push({ index, error, item: items[index] });
        results[index] = null;
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);

  return { results, errors };
}

export default {
  sanitizeFilename,
  isBase64Data,
  base64ToBlob,
  withConcurrency
};
