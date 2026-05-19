/**
 * ZIP流式导出工具 - 支持并发控制，防止内存暴涨
 * - APP端原生文件系统流式导出（1MB分块写入，内存峰值降至MB级）
 * - 自动降级：原生导出失败时自动回退到JSZip内存打包
 * - 浏览器环境直接使用JSZip
 */

import { STORAGE_CONFIG } from './config/storage';
import { readVideoFromOPFS } from './opfs';
import { exportAllData as exportAllDBData } from './db';
import { exportV2AccountData } from './dbV2';

// ==================== 开关控制 ====================
const NATIVE_FS_EXPORT_ENABLED = true;
const CHUNK_SIZE = 1024 * 1024; // 1MB
const NATIVE_EXPORT_DIR = 'fs://file/BabyTimeBackup';

// ==================== 原生文件系统工具函数 ====================

function isNativeFSSupported() {
  if (typeof window === 'undefined') return false;
  // 标准Capacitor检测
  if (window.Capacitor && window.Capacitor.isNativePlatform?.()) {
    return true;
  }
  // 旧版jsBridge检测（向后兼容）
  if (typeof window.jsBridge !== 'undefined' && window.jsBridge.inApp === true && window.jsBridge.fs) {
    return true;
  }
  return false;
}

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

function triggerGC() {
  if (typeof window !== 'undefined' && typeof window.gc === 'function') {
    try {
      window.gc();
    } catch (e) {
      // 静默忽略
    }
  }
}

async function ensureDirExists(path) {
  if (!isNativeFSSupported()) return;
  try {
    const exists = await new Promise((resolve) => {
      window.jsBridge.fs.exist(path, (result) => resolve(result));
    });
    if (!exists) {
      await new Promise((resolve, reject) => {
        window.jsBridge.fs.mkdir(path, (result) => {
          if (result !== false) resolve();
          else reject(new Error('mkdir failed'));
        });
      });
    }
  } catch (e) {
    // 目录可能已存在，继续执行
  }
}

async function nativeWriteBinary(path, base64) {
  return new Promise((resolve, reject) => {
    window.jsBridge.fs.writeBinary(path, base64, (result) => {
      if (result !== false) resolve(result);
      else reject(new Error('writeBinary failed'));
    });
  });
}

async function nativeAppendBinary(path, base64) {
  return new Promise((resolve, reject) => {
    window.jsBridge.fs.appendBinary(path, base64, (result) => {
      if (result !== false) resolve(result);
      else reject(new Error('appendBinary failed'));
    });
  });
}

// ==================== 原生流式ZIP构建器 ====================

class NativeZipBuilder {
  constructor(filePath) {
    this.filePath = filePath;
    this.files = [];
    this.currentOffset = 0;
    this.isFirstWrite = true;
  }

  stringToUint8(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  async writeData(uint8array) {
    for (let offset = 0; offset < uint8array.length; offset += CHUNK_SIZE) {
      const chunk = uint8array.slice(offset, offset + CHUNK_SIZE);
      const blob = new Blob([chunk], { type: 'application/octet-stream' });
      const base64 = await blobToBase64(blob);
      if (this.isFirstWrite) {
        await nativeWriteBinary(this.filePath, base64);
        this.isFirstWrite = false;
      } else {
        await nativeAppendBinary(this.filePath, base64);
      }
      this.currentOffset += chunk.length;
      triggerGC();
    }
  }

  createLocalFileHeader(filename, data, crc32) {
    const filenameBytes = this.stringToUint8(filename);
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0x0808, true); // flags (UTF-8 + data descriptor)
    view.setUint16(8, 0, true); // compression method
    const now = new Date();
    const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1));
    view.setUint16(10, time, true);
    const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    view.setUint16(12, date, true);
    view.setUint32(14, 0, true); // CRC-32 placeholder
    view.setUint32(18, 0, true); // compressed size placeholder
    view.setUint32(22, 0, true); // uncompressed size placeholder
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true); // extra field length
    header.set(filenameBytes, 30);
    return header;
  }

  createDataDescriptor(crc32, compressedSize, uncompressedSize) {
    const descriptor = new Uint8Array(16);
    const view = new DataView(descriptor.buffer);
    view.setUint32(0, 0x08074b50, true); // signature
    view.setUint32(4, crc32, true);
    view.setUint32(8, compressedSize, true);
    view.setUint32(12, uncompressedSize, true);
    return descriptor;
  }

  createCentralDirHeader(filename, data, crc32, localHeaderOffset) {
    const filenameBytes = this.stringToUint8(filename);
    const header = new Uint8Array(46 + filenameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 0x0317, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0808, true);
    view.setUint16(10, 0, true);
    const now = new Date();
    const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1));
    view.setUint16(12, time, true);
    const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    view.setUint16(14, date, true);
    view.setUint32(16, crc32, true);
    view.setUint32(20, data.length, true);
    view.setUint32(24, data.length, true);
    view.setUint16(28, filenameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0x8000, true);
    view.setUint32(42, localHeaderOffset, true);
    header.set(filenameBytes, 46);
    return header;
  }

  createEndOfCentralDir(numEntries, centralDirSize, centralDirOffset) {
    const eocd = new Uint8Array(22);
    const view = new DataView(eocd.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, numEntries, true);
    view.setUint16(10, numEntries, true);
    view.setUint32(12, centralDirSize, true);
    view.setUint32(16, centralDirOffset, true);
    view.setUint16(20, 0, true);
    return eocd;
  }

  crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >> 1)) : (c >> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  async addFile(filename, data) {
    const crc32 = this.crc32(data);
    const localHeader = this.createLocalFileHeader(filename, data, crc32);
    const dataDescriptor = this.createDataDescriptor(crc32, data.length, data.length);

    this.files.push({
      filename,
      data,
      crc32,
      localHeaderOffset: this.currentOffset,
    });

    await this.writeData(localHeader);
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      await this.writeData(chunk);
    }
    await this.writeData(dataDescriptor);
    triggerGC();
  }

  async finalize() {
    let centralDirSize = 0;
    const centralDirOffset = this.currentOffset;
    for (const file of this.files) {
      const centralHeader = this.createCentralDirHeader(
        file.filename,
        file.data,
        file.crc32,
        file.localHeaderOffset
      );
      centralDirSize += centralHeader.length;
      await this.writeData(centralHeader);
    }
    const eocd = this.createEndOfCentralDir(this.files.length, centralDirSize, centralDirOffset);
    await this.writeData(eocd);
    triggerGC();
  }
}

// ==================== 原生导出实现 ====================

async function exportWithNativeFS(options = {}) {
  const { includeVideos = true, onProgress = null } = options;

  if (!isNativeFSSupported()) {
    throw new Error('Native FS not supported');
  }

  await ensureDirExists(NATIVE_EXPORT_DIR);

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const filename = `宝宝时光数据备份_${timestamp}.zip`;
  const filePath = `${NATIVE_EXPORT_DIR}/${filename}`;
  const zipBuilder = new NativeZipBuilder(filePath);

  try {
    if (onProgress) {
      onProgress({ step: 1, progress: 10, message: '正在读取数据库数据...', stats: null });
    }

    const [idbData, v2Data] = await Promise.all([
      exportAllDBData().catch(e => {
        console.warn('[ZIP-Native] 读取IndexDB数据失败:', e);
        return null;
      }),
      exportV2AccountData()
    ]);

    const mergedData = {
      ...(idbData?.data || {}),
      ...(idbData || {}),
      v2AccountData: v2Data,
      exportTime: new Date().toISOString(),
      exportVersion: '2.0.0'
    };

    const stats = getStats(mergedData);

    if (onProgress) {
      onProgress({
        step: 1,
        progress: 30,
        message: `数据读取完成: ${stats.v2Timeline}条动态, ${stats.totalVideos}个视频`,
        stats
      });
    }

    // 清理timeline中的Base64视频数据
    const dataForJson = JSON.parse(JSON.stringify(mergedData));
    if (dataForJson.v2AccountData?.timeline) {
      for (const moment of dataForJson.v2AccountData.timeline) {
        if (moment.videos) {
          moment.videos = moment.videos.map(video => {
            const cleaned = { ...video };
            if (cleaned.filename?.startsWith('data:')) {
              cleaned.isBase64Exported = true;
              cleaned.originalFilename = cleaned.filename;
              delete cleaned.filename;
            }
            if (cleaned.url?.startsWith('data:')) {
              cleaned.isBase64Exported = true;
              cleaned.originalUrl = '已导出为独立视频文件';
              delete cleaned.url;
            }
            return cleaned;
          });
        }
      }
    }

    const dataJsonStr = JSON.stringify(dataForJson, null, 2);
    const dataJsonBytes = zipBuilder.stringToUint8(dataJsonStr);
    await zipBuilder.addFile('data.json', dataJsonBytes);

    if (onProgress) {
      onProgress({ step: 1, progress: 40, message: '数据JSON已写入ZIP', stats });
    }

    if (includeVideos && stats.totalVideos > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 40,
          message: `开始处理 ${stats.totalVideos} 个视频文件...`,
          stats
        });
      }

      let processedVideos = 0;
      let successVideos = 0;
      let failedVideos = 0;

      for (const videoInfo of stats.videos) {
        try {
          let fileBlob = null;
          if (videoInfo.type === 'opfs') {
            fileBlob = await readVideoFromOPFS(videoInfo.filename);
          } else if (videoInfo.type === 'base64') {
            fileBlob = base64ToFile(videoInfo.data, videoInfo.outputFilename);
          }
          if (fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8array = new Uint8Array(arrayBuffer);
            await zipBuilder.addFile(`videos/${videoInfo.outputFilename}`, uint8array);
            successVideos++;
          }
          processedVideos++;
          if (onProgress) {
            const videoProgress = 40 + Math.floor((processedVideos / stats.totalVideos) * 45);
            onProgress({
              step: 2,
              progress: videoProgress,
              message: `视频处理中: ${processedVideos}/${stats.totalVideos} (${successVideos}成功, ${failedVideos}失败)`,
              stats: { ...stats, processedVideos, successVideos, failedVideos }
            });
          }
          triggerGC();
        } catch (e) {
          failedVideos++;
          processedVideos++;
          console.warn(`[ZIP-Native] 视频处理失败 ${videoInfo.filename}:`, e);
        }
      }

      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: `视频处理完成: ${successVideos}/${stats.totalVideos} 成功写入`,
          stats: { ...stats, processedVideos, successVideos, failedVideos }
        });
      }
    } else {
      if (onProgress) {
        onProgress({ step: 2, progress: 85, message: includeVideos ? '没有视频文件需要导出' : '已跳过视频文件导出', stats });
      }
    }

    if (onProgress) {
      onProgress({ step: 3, progress: 88, message: '正在完成ZIP文件...', stats });
    }

    await zipBuilder.finalize();

    if (onProgress) {
      onProgress({
        step: 3,
        progress: 100,
        message: `导出完成！共 ${stats.v2Timeline || stats.oldMoments} 条数据，${includeVideos ? stats.totalVideos : 0} 个视频`,
        stats
      });
    }

    return { filePath, filename, isNative: true, blob: null };
  } catch (error) {
    console.error('[ZIP-Native] 原生导出失败:', error);
    throw error;
  }
}

// ==================== 降级方案：JSZip ====================

async function withConcurrency(items, processor, concurrency = 5, onProgress = null) {
  const results = [];
  const errors = [];
  let completed = 0;
  const total = items.length;
  const itemsCopy = [...items];

  async function worker() {
    while (itemsCopy.length > 0) {
      const item = itemsCopy.shift();
      try {
        const result = await processor(item);
        results.push({ item, result, success: true });
      } catch (e) {
        console.warn('[ZIP] 处理项失败:', item, e);
        errors.push({ item, error: e });
        results.push({ item, error: e, success: false });
      }
      completed++;
      if (onProgress) {
        onProgress(completed, total, item);
      }
    }
  }

  const actualConcurrency = Math.min(concurrency, total);
  const workers = [];
  for (let i = 0; i < actualConcurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return { results, errors };
}

export function base64ToFile(dataUrl, filename) {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

function collectVideoFiles(data) {
  const videos = [];
  const processedFilenames = new Set();

  const timeline = data.v2AccountData?.timeline || [];
  for (const moment of timeline) {
    if (moment.videos && Array.isArray(moment.videos)) {
      for (const video of moment.videos) {
        if (video.filename && !processedFilenames.has(video.filename)) {
          if (video.filename.startsWith('data:')) {
            videos.push({
              type: 'base64',
              filename: video.filename,
              data: video.filename,
              momentId: moment.id,
              outputFilename: `${moment.id || 'video'}_${Date.now()}.mp4`
            });
          } else {
            videos.push({
              type: 'opfs',
              filename: video.filename,
              momentId: moment.id,
              outputFilename: video.filename
            });
          }
          processedFilenames.add(video.filename);
        }
        if (video.url && !processedFilenames.has(video.url)) {
          if (video.url.startsWith('data:')) {
            videos.push({
              type: 'base64',
              filename: video.url,
              data: video.url,
              momentId: moment.id,
              outputFilename: `${moment.id || 'video'}_${Date.now()}.mp4`
            });
          } else {
            videos.push({
              type: 'opfs',
              filename: video.url,
              momentId: moment.id,
              outputFilename: video.url
            });
          }
          processedFilenames.add(video.url);
        }
      }
    }
  }

  const moments = data.moments || [];
  for (const moment of moments) {
    if (moment.videos && Array.isArray(moment.videos)) {
      for (const video of moment.videos) {
        if (video.filename && !processedFilenames.has(video.filename)) {
          if (video.filename.startsWith('data:')) {
            videos.push({
              type: 'base64',
              filename: video.filename,
              data: video.filename,
              momentId: moment.id,
              outputFilename: `${moment.id || 'video'}_${Date.now()}.mp4`
            });
          } else {
            videos.push({
              type: 'opfs',
              filename: video.filename,
              momentId: moment.id,
              outputFilename: video.filename
            });
          }
          processedFilenames.add(video.filename);
        }
        if (video.url && !processedFilenames.has(video.url)) {
          if (video.url.startsWith('data:')) {
            videos.push({
              type: 'base64',
              filename: video.url,
              data: video.url,
              momentId: moment.id,
              outputFilename: `${moment.id || 'video'}_${Date.now()}.mp4`
            });
          } else {
            videos.push({
              type: 'opfs',
              filename: video.url,
              momentId: moment.id,
              outputFilename: video.url
            });
          }
          processedFilenames.add(video.url);
        }
      }
    }
  }
  return videos;
}

function getStats(data) {
  const v2Timeline = data.v2AccountData?.timeline || [];
  const oldMoments = data.moments || [];
  const oldBabies = data.babies || [];
  const oldCapsules = data.capsules || [];
  const videos = collectVideoFiles(data);
  const opfsVideos = videos.filter(v => v.type === 'opfs');
  const base64Videos = videos.filter(v => v.type === 'base64');
  return {
    v2Timeline: v2Timeline.length,
    v2HasTimeline: v2Timeline.length > 0,
    oldMoments: oldMoments.length,
    oldBabies: oldBabies.length,
    oldCapsules: oldCapsules.length,
    totalVideos: videos.length,
    opfsVideos: opfsVideos.length,
    base64Videos: base64Videos.length,
    videos
  };
}

async function exportWithJSZip(options = {}) {
  const { includeVideos = true, concurrency = STORAGE_CONFIG.MAX_CONCURRENT_READ, onProgress = null } = options;

  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载，请检查网络连接');
  }

  const zip = new window.JSZip();
  const videosFolder = zip.folder('videos');

  try {
    if (onProgress) {
      onProgress({ step: 1, progress: 10, message: '正在读取数据库数据...', stats: null });
    }

    const [idbData, v2Data] = await Promise.all([
      exportAllDBData().catch(e => {
        console.warn('[ZIP] 读取IndexDB数据失败:', e);
        return null;
      }),
      exportV2AccountData()
    ]);

    const mergedData = {
      ...(idbData?.data || {}),
      ...(idbData || {}),
      v2AccountData: v2Data,
      exportTime: new Date().toISOString(),
      exportVersion: '2.0.0'
    };

    const stats = getStats(mergedData);

    if (onProgress) {
      onProgress({
        step: 1,
        progress: 30,
        message: `数据读取完成: ${stats.v2Timeline}条动态, ${stats.totalVideos}个视频`,
        stats
      });
    }

    const dataForJson = JSON.parse(JSON.stringify(mergedData));
    if (dataForJson.v2AccountData?.timeline) {
      for (const moment of dataForJson.v2AccountData.timeline) {
        if (moment.videos) {
          moment.videos = moment.videos.map(video => {
            const cleaned = { ...video };
            if (cleaned.filename?.startsWith('data:')) {
              cleaned.isBase64Exported = true;
              cleaned.originalFilename = cleaned.filename;
              delete cleaned.filename;
            }
            if (cleaned.url?.startsWith('data:')) {
              cleaned.isBase64Exported = true;
              cleaned.originalUrl = '已导出为独立视频文件';
              delete cleaned.url;
            }
            return cleaned;
          });
        }
      }
    }

    zip.file('data.json', JSON.stringify(dataForJson, null, 2));

    if (onProgress) {
      onProgress({ step: 1, progress: 40, message: '数据JSON已写入ZIP', stats });
    }

    if (includeVideos && stats.totalVideos > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 40,
          message: `开始处理 ${stats.totalVideos} 个视频文件...`,
          stats
        });
      }

      let processedVideos = 0;
      let successVideos = 0;
      let failedVideos = 0;

      const { errors } = await withConcurrency(
        stats.videos,
        async (videoInfo) => {
          let fileBlob = null;
          if (videoInfo.type === 'opfs') {
            fileBlob = await readVideoFromOPFS(videoInfo.filename);
          } else if (videoInfo.type === 'base64') {
            fileBlob = base64ToFile(videoInfo.data, videoInfo.outputFilename);
          }
          if (fileBlob) {
            videosFolder.file(videoInfo.outputFilename, fileBlob);
            successVideos++;
          }
          processedVideos++;
          if (onProgress) {
            const videoProgress = 40 + Math.floor((processedVideos / stats.totalVideos) * 45);
            onProgress({
              step: 2,
              progress: videoProgress,
              message: `视频处理中: ${processedVideos}/${stats.totalVideos} (${successVideos}成功, ${failedVideos}失败)`,
              stats: { ...stats, processedVideos, successVideos, failedVideos }
            });
          }
        },
        concurrency
      );
      failedVideos = errors.length;

      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: `视频处理完成: ${successVideos}/${stats.totalVideos} 成功写入`,
          stats: { ...stats, processedVideos, successVideos, failedVideos }
        });
      }
    } else {
      if (onProgress) {
        onProgress({ step: 2, progress: 85, message: includeVideos ? '没有视频文件需要导出' : '已跳过视频文件导出', stats });
      }
    }

    if (onProgress) {
      onProgress({ step: 3, progress: 90, message: '正在生成ZIP文件...', stats });
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      if (onProgress && metadata.percent) {
        const progress = 90 + Math.floor(metadata.percent * 0.1);
        onProgress({ step: 3, progress, message: 'ZIP生成中...', stats });
      }
    });

    if (onProgress) {
      onProgress({
        step: 3,
        progress: 100,
        message: `导出完成！共 ${stats.v2Timeline || stats.oldMoments} 条数据，${includeVideos ? stats.totalVideos : 0} 个视频`,
        stats
      });
    }

    return { blob: zipBlob, isNative: false, filePath: null, filename: null };
  } catch (error) {
    console.error('[ZIP] 导出失败:', error);
    throw error;
  }
}

// ==================== 统一导出接口 ====================

export async function exportAllData(options = {}) {
  const { includeVideos = true, concurrency = STORAGE_CONFIG.MAX_CONCURRENT_READ, onProgress = null } = options;

  if (!NATIVE_FS_EXPORT_ENABLED || !isNativeFSSupported()) {
    return await exportWithJSZip(options);
  }

  try {
    console.log('[ZIP] 使用APP原生文件系统流式导出');
    return await exportWithNativeFS(options);
  } catch (nativeError) {
    console.warn('[ZIP] 原生导出失败，自动降级到JSZip:', nativeError);
    if (onProgress) {
      onProgress({ step: 1, progress: 5, message: '原生导出失败，正在切换到兼容模式...', stats: null });
    }
    return await exportWithJSZip(options);
  }
}

// ==================== 导入功能 ====================

export async function importFromZip(zipFile, onProgress = null) {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载，请检查网络连接');
  }
  try {
    if (onProgress) onProgress(5, '正在读取ZIP文件...');
    const zip = await window.JSZip.loadAsync(zipFile);

    const dataJsonFile = zip.file('data.json');
    if (!dataJsonFile) {
      throw new Error('ZIP文件中未找到data.json');
    }
    const dataJson = await dataJsonFile.async('string');
    const data = JSON.parse(dataJson);
    if (onProgress) onProgress(30, '数据解析完成');

    const videosFolder = zip.folder('videos');
    const videoFiles = [];
    if (videosFolder) {
      const fileNames = Object.keys(videosFolder.files).filter(name => !videosFolder.files[name].dir);
      let processed = 0;
      const total = fileNames.length;
      for (const filename of fileNames) {
        try {
          const fileBlob = await videosFolder.file(filename).async('blob');
          videoFiles.push({ filename, file: fileBlob });
        } catch (e) {
          console.warn(`[ZIP] 读取视频文件失败 ${filename}:`, e);
        }
        processed++;
        if (onProgress) {
          onProgress(30 + Math.floor((processed / total) * 60), `读取视频: ${processed}/${total}`);
        }
      }
    }

    if (onProgress) onProgress(100, '导入完成');
    return { data, videoFiles };
  } catch (error) {
    console.error('[ZIP] 导入失败:', error);
    throw error;
  }
}

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

export async function exportToZip(data, onProgress) {
  console.warn('exportToZip is deprecated, use exportAllData instead');
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载');
  }
  const zip = new window.JSZip();
  zip.file('data.json', JSON.stringify(data, null, 2));
  const videoFiles = collectVideoFiles(data);
  const videosFolder = zip.folder('videos');
  for (const video of videoFiles) {
    try {
      if (video.type === 'opfs') {
        const file = await readVideoFromOPFS(video.filename);
        videosFolder.file(video.outputFilename, file);
      } else if (video.type === 'base64') {
        const file = base64ToFile(video.data, video.outputFilename);
        videosFolder.file(video.outputFilename, file);
      }
    } catch (e) {
      console.warn(`[ZIP] 视频处理失败 ${video.filename}:`, e);
    }
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, (metadata) => {
    if (onProgress) onProgress(Math.floor(metadata.percent));
  });
}

export default {
  exportAllData,
  exportToZip,
  importFromZip,
  triggerDownload,
  base64ToFile,
  withConcurrency,
};
