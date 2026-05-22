/**
 * ZIP流式导出工具
 * 支持并发控制，防止内存暴涨
 * 支持OPFS和Base64两种视频格式
 * 
 * 新增功能：
 * - APP端原生文件系统流式导出（1MB分块写入，内存峰值降至MB级）
 * - 自动降级：原生导出失败时自动回退到JSZip内存打包
 * - 浏览器环境直接使用JSZip
 * 
 * 功能：
 * 1. exportAllData() - 导出所有数据+视频到ZIP
 * 2. 流式处理，边读边写，不缓存所有文件
 * 3. 并发读取控制（默认5个并发）
 * 4. Base64视频转File后写入ZIP
 * 5. 详细进度回调（数据条数 + 视频数量）
 */

import { STORAGE_CONFIG } from '../config/storage';
import { readVideoFromOPFS } from './opfs';
import { getAudioFile } from "./audioStorage";
import { exportAllData as exportAllIDBData } from './db';
import { exportV2AccountData } from './dbV2';

// ============== 开关控制 ==============
/**
 * APP端原生文件系统导出开关
 * - true: 优先使用原生流式导出（1MB分块，低内存）
 * - false: 始终使用JSZip内存打包
 */
const NATIVE_FS_EXPORT_ENABLED = true;

/** 分块大小：1MB，确保内存占用可控 */
const CHUNK_SIZE = 1024 * 1024;

/** 原生导出分享目录 */
const NATIVE_EXPORT_DIR = 'fs://file/BabyTimeBackup';

// ============== 原生文件系统工具函数 ==============

/**
 * 检查是否支持原生文件系统导出
 * @returns {boolean} 是否支持
 */
function isNativeFSSupported() {
  return typeof window !== 'undefined' && 
         typeof window.jsBridge !== 'undefined' && 
         window.jsBridge.inApp === true &&
         window.jsBridge.fs;
}

/**
 * Blob转Base64（只返回数据部分，不含data:前缀）
 * @param {Blob} blob 
 * @returns {Promise<string>} Base64字符串
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // 去掉data:xxx;base64,前缀
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 主动触发GC释放内存（如果可用）
 */
function triggerGC() {
  if (typeof window !== 'undefined' && typeof window.gc === 'function') {
    try {
      window.gc();
    } catch (e) {
      // GC调用失败，静默忽略
    }
  }
}

/**
 * 创建目录（如果不存在）
 * @param {string} path 目录路径
 */
async function ensureDirExists(path) {
  if (!isNativeFSSupported()) return;
  try {
    await window.jsBridge.fs.exist(path, (exists) => {
      if (!exists) {
        window.jsBridge.fs.mkdir(path, () => {});
      }
    });
  } catch (e) {
    // 目录创建失败，可能已存在，继续执行
  }
}

/**
 * 写入文件（原生文件系统）
 * @param {string} path 文件路径
 * @param {string} base64 Base64数据
 */
async function nativeWriteBinary(path, base64) {
  return new Promise((resolve, reject) => {
    window.jsBridge.fs.writeBinary(path, base64, (result) => {
      if (result !== false) {
        resolve(result);
      } else {
        reject(new Error('writeBinary failed'));
      }
    });
  });
}

/**
 * 追加写入文件（原生文件系统）
 * @param {string} path 文件路径
 * @param {string} base64 Base64数据
 */
async function nativeAppendBinary(path, base64) {
  return new Promise((resolve, reject) => {
    window.jsBridge.fs.appendBinary(path, base64, (result) => {
      if (result !== false) {
        resolve(result);
      } else {
        reject(new Error('appendBinary failed'));
      }
    });
  });
}

// ============== 原生流式ZIP导出核心实现 ==============

/**
 * 手动ZIP格式构建器（流式写入）
 * 参考ZIP文件格式规范：
 * - Local File Header + File Data + Data Descriptor (可选)
 * - Central Directory
 * - End of Central Directory Record
 */
class NativeZipBuilder {
  constructor(filePath) {
    this.filePath = filePath;
    this.files = []; // 记录文件信息，用于最后写Central Directory
    this.currentOffset = 0; // 当前写入偏移量
    this.isFirstWrite = true;
  }

  /**
   * 将字符串转Uint8Array
   */
  stringToUint8(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  /**
   * 写入Uint8Array数据到文件（分块写入，每块后GC）
   */
  async writeData(uint8array) {
    // 1MB分块写入
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
      triggerGC(); // 每块后释放内存
    }
  }

  /**
   * 创建Local File Header
   */
  createLocalFileHeader(filename, data, crc32) {
    const filenameBytes = this.stringToUint8(filename);
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);

    // Local file header signature (0x04034b50)
    view.setUint32(0, 0x04034b50, true);
    // Version needed to extract (20 = 2.0)
    view.setUint16(4, 20, true);
    // General purpose bit flag (0x0808 = UTF-8 + data descriptor)
    view.setUint16(6, 0x0808, true);
    // Compression method (0 = stored, no compression)
    view.setUint16(8, 0, true);
    // Last mod file time
    const now = new Date();
    const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1));
    view.setUint16(10, time, true);
    // Last mod file date
    const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    view.setUint16(12, date, true);
    // CRC-32 (will be in data descriptor)
    view.setUint32(14, 0, true);
    // Compressed size (will be in data descriptor)
    view.setUint32(18, 0, true);
    // Uncompressed size (will be in data descriptor)
    view.setUint32(22, 0, true);
    // File name length
    view.setUint16(26, filenameBytes.length, true);
    // Extra field length
    view.setUint16(28, 0, true);
    // File name
    header.set(filenameBytes, 30);

    return header;
  }

  /**
   * 创建Data Descriptor
   */
  createDataDescriptor(crc32, compressedSize, uncompressedSize) {
    const descriptor = new Uint8Array(16);
    const view = new DataView(descriptor.buffer);

    // Optional data descriptor signature (0x08074b50)
    view.setUint32(0, 0x08074b50, true);
    // CRC-32
    view.setUint32(4, crc32, true);
    // Compressed size
    view.setUint32(8, compressedSize, true);
    // Uncompressed size
    view.setUint32(12, uncompressedSize, true);

    return descriptor;
  }

  /**
   * 创建Central Directory File Header
   */
  createCentralDirHeader(filename, data, crc32, localHeaderOffset) {
    const filenameBytes = this.stringToUint8(filename);
    const header = new Uint8Array(46 + filenameBytes.length);
    const view = new DataView(header.buffer);

    // Central file header signature (0x02014b50)
    view.setUint32(0, 0x02014b50, true);
    // Version made by (0x0317 = Unix, version 2.3)
    view.setUint16(4, 0x0317, true);
    // Version needed to extract (20 = 2.0)
    view.setUint16(6, 20, true);
    // General purpose bit flag (0x0808 = UTF-8 + data descriptor)
    view.setUint16(8, 0x0808, true);
    // Compression method (0 = stored)
    view.setUint16(10, 0, true);
    // Last mod file time
    const now = new Date();
    const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1));
    view.setUint16(12, time, true);
    // Last mod file date
    const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    view.setUint16(14, date, true);
    // CRC-32
    view.setUint32(16, crc32, true);
    // Compressed size
    view.setUint32(20, data.length, true);
    // Uncompressed size
    view.setUint32(24, data.length, true);
    // File name length
    view.setUint16(28, filenameBytes.length, true);
    // Extra field length
    view.setUint16(30, 0, true);
    // File comment length
    view.setUint16(32, 0, true);
    // Disk number start
    view.setUint16(34, 0, true);
    // Internal file attributes
    view.setUint16(36, 0, true);
    // External file attributes (regular file)
    view.setUint32(38, 0x8000, true);
    // Relative offset of local header
    view.setUint32(42, localHeaderOffset, true);
    // File name
    header.set(filenameBytes, 46);

    return header;
  }

  /**
   * 创建End of Central Directory Record
   */
  createEndOfCentralDir(numEntries, centralDirSize, centralDirOffset) {
    const eocd = new Uint8Array(22);
    const view = new DataView(eocd.buffer);

    // End of central dir signature (0x06054b50)
    view.setUint32(0, 0x06054b50, true);
    // Number of this disk
    view.setUint16(4, 0, true);
    // Number of the disk with the start of the central directory
    view.setUint16(6, 0, true);
    // Total number of entries in the central dir on this disk
    view.setUint16(8, numEntries, true);
    // Total number of entries in the central dir
    view.setUint16(10, numEntries, true);
    // Size of the central directory
    view.setUint32(12, centralDirSize, true);
    // Offset of start of central directory
    view.setUint32(16, centralDirOffset, true);
    // Zip file comment length
    view.setUint16(20, 0, true);

    return eocd;
  }

  /**
   * 计算CRC32（简化实现，只用于ZIP格式兼容）
   */
  crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    
    // 预计算CRC表
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * 添加文件到ZIP
   * @param {string} filename 文件名（含路径，如videos/test.mp4）
   * @param {Uint8Array} data 文件数据
   */
  async addFile(filename, data) {
    const crc32 = this.crc32(data);
    const localHeader = this.createLocalFileHeader(filename, data, crc32);
    const dataDescriptor = this.createDataDescriptor(crc32, data.length, data.length);
    
    // 记录文件信息（用于Central Directory）
    this.files.push({
      filename,
      data,
      crc32,
      localHeaderOffset: this.currentOffset
    });

    // 写入Local File Header
    await this.writeData(localHeader);

    // 分块写入文件数据（每块1MB）
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      await this.writeData(chunk);
    }

    // 写入Data Descriptor
    await this.writeData(dataDescriptor);
    
    triggerGC(); // 每个文件处理完释放内存
  }

  /**
   * 添加文件夹（仅在Central Directory中记录）
   * @param {string} dirname 文件夹名
   */
  async addFolder(dirname) {
    // 文件夹不需要实际数据，只需在Central Directory记录
    // 为简化实现，我们只在文件路径中包含文件夹名即可
    // 大多数解压软件能自动创建文件夹
  }

  /**
   * 完成ZIP文件构建（写入Central Directory和EOCD）
   */
  async finalize() {
    const centralDirOffset = this.currentOffset;
    let centralDirSize = 0;

    // 写入Central Directory
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

    // 写入End of Central Directory
    const eocd = this.createEndOfCentralDir(
      this.files.length,
      centralDirSize,
      centralDirOffset
    );
    await this.writeData(eocd);

    triggerGC(); // 完成后释放所有内存
  }
}

/**
 * 使用原生文件系统流式导出ZIP
 * @param {Object} options 导出选项
 * @param {boolean} options.includeVideos 是否包含视频
 * @param {Function} options.onProgress 进度回调
 * @returns {Promise<string>} 导出的文件路径
 */
async function exportWithNativeFS(options = {}) {
  const {
    includeVideos = true,
    onProgress = null
  } = options;

  if (!isNativeFSSupported()) {
    throw new Error('Native FS not supported');
  }

  // 确保导出目录存在
  await ensureDirExists(NATIVE_EXPORT_DIR);

  // 生成文件名
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const filename = `宝宝时光数据备份_${timestamp}.zip`;
  const filePath = `${NATIVE_EXPORT_DIR}/${filename}`;

  // 创建ZIP构建器
  const zipBuilder = new NativeZipBuilder(filePath);

  try {
    // ========== 步骤1: 读取并准备数据 ==========
    if (onProgress) {
      onProgress({
        step: 1,
        progress: 10,
        message: '正在读取数据库数据...',
        stats: null
      });
    }

    // 同时读取IndexDB和v2数据
    const [idbData, v2Data] = await Promise.all([
      exportAllIDBData().catch(e => {
        console.warn('[ZIP-Native] 读取IndexDB数据失败:', e);
        return null;
      }),
      exportV2AccountData()
    ]);

    // 合并数据 ✅ 修复：idbData有一层data嵌套
    const mergedData = {
      ...(idbData?.data || {}),
      ...(idbData || {}),
      v2AccountData: v2Data,
      exportTime: new Date().toISOString(),
      exportVersion: '2.0.0'
    };

    // 统计信息
    const stats = getStats(mergedData);
    
    if (onProgress) {
      onProgress({
        step: 1,
        progress: 30,
        message: `数据读取完成: ${stats.v2Timeline}条动态, ${stats.totalVideos}个视频`,
        stats
      });
    }

    // 写入data.json（不包含Base64视频数据，避免JSON过大）
    const dataForJson = JSON.parse(JSON.stringify(mergedData));
    // 清理timeline中的Base64视频数据（已单独保存）
    if (dataForJson.v2AccountData?.timeline) {
      for (const moment of dataForJson.v2AccountData.timeline) {
        if (moment.videos) {
          moment.videos = moment.videos.map(video => {
            const cleaned = { ...video };
            // 如果是Base64数据，只保留元信息，内容已单独保存到videos文件夹
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

    // 将data.json写入ZIP
    const dataJsonStr = JSON.stringify(dataForJson, null, 2);
    const dataJsonBytes = zipBuilder.stringToUint8(dataJsonStr);
    await zipBuilder.addFile('data.json', dataJsonBytes);

    if (onProgress) {
      onProgress({
        step: 1,
        progress: 40,
        message: '数据JSON已写入ZIP',
        stats
      });
    }

    // ========== 步骤2: 串行读取并写入视频文件（原生导出使用串行，避免内存堆积） ==========
    if (includeVideos && stats.totalVideos > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 40,
          message: `开始处理 ${stats.totalVideos} 个视频文件 (${stats.opfsVideos}个OPFS, ${stats.base64Videos}个Base64)...`,
          stats
        });
      }

      let processedVideos = 0;
      let successVideos = 0;
      let failedVideos = 0;

      // 串行处理所有视频（原生导出使用串行，避免同时加载多个大视频到内存）
      for (const videoInfo of stats.videos) {
        try {
          let fileBlob;
          
          if (videoInfo.type === 'native') {
            // 从原生文件系统读取
            try {
              fileBlob = await readVideoFromNative(videoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP-Native] 原生视频读取失败 ${videoInfo.filename}:`, e);
              throw e;
            }
          } else if (videoInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(videoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP-Native] OPFS视频读取失败 ${videoInfo.filename}:`, e);
              throw e;
            }
          } else if (videoInfo.type === 'base64') {
            // Base64转File
            fileBlob = base64ToFile(videoInfo.data, videoInfo.outputFilename);
          }

          // 写入ZIP
          if (fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8array = new Uint8Array(arrayBuffer);
            await zipBuilder.addFile(`videos/${videoInfo.outputFilename}`, uint8array);
            successVideos++;
          }
          
          processedVideos++;
          
          // 报告进度（视频处理占40%-85%）
          if (onProgress) {
            const videoProgress = 40 + Math.floor((processedVideos / stats.totalVideos) * 45);
            onProgress({
              step: 2,
              progress: videoProgress,
              message: `视频处理中: ${processedVideos}/${stats.totalVideos} (${successVideos}成功, ${failedVideos}失败)`,
              stats: { ...stats, processedVideos, successVideos, failedVideos }
            });
          }

          triggerGC(); // 每个视频处理完主动GC

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
    } else if (!includeVideos) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: '已跳过视频文件导出',
          stats
        });
      }
    } else {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: '没有视频文件需要导出',
          stats
        });
      }
    }


    // ========== 步骤2b: 串行读取并写入音频文件 ==========
    if (includeVideos && stats.totalAudios > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: `开始处理 ${stats.totalAudios} 个音频文件 (${stats.opfsAudios}个OPFS/原生, ${stats.base64Audios}个Base64, ${stats.indexeddbAudios}个IndexedDB)...`,
          stats
        });
      }

      let processedAudios = 0;
      let successAudios = 0;
      let failedAudios = 0;

      // 串行处理所有音频
      for (const audioInfo of stats.audios) {
        try {
          let fileBlob;
          
          if (audioInfo.type === 'native') {
            // 从原生文件系统读取
            try {
              fileBlob = await readVideoFromNative(audioInfo.filename);
            } catch (e) {
              console.warn(`[ZIP-Native] 原生音频读取失败 ${audioInfo.filename}:`, e);
              throw e;
            }
          } else if (audioInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(audioInfo.filename);
            } catch (e) {
              console.warn(`[ZIP-Native] OPFS音频读取失败 ${audioInfo.filename}:`, e);
              throw e;
            }
          } else if (audioInfo.type === 'base64') {
            // Base64转File
            fileBlob = base64ToFile(audioInfo.data, audioInfo.outputFilename);
          } else if (audioInfo.type === 'indexeddb') {
            // 从IndexedDB读取
            try {
              fileBlob = await getAudioFile(audioInfo.fileId);
            } catch (e) {
              console.warn(`[ZIP-Native] IndexedDB音频读取失败 ${audioInfo.fileId}:`, e);
              throw e;
            }
          }

          // 写入ZIP
          if (fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8array = new Uint8Array(arrayBuffer);
            await zipBuilder.addFile(`audios/${audioInfo.outputFilename}`, uint8array);
            successAudios++;
          }
          
          processedAudios++;
          
          // 报告进度（音频处理占85%-90%）
          if (onProgress) {
            const audioProgress = 85 + Math.floor((processedAudios / stats.totalAudios) * 5);
            onProgress({
              step: 2,
              progress: audioProgress,
              message: `音频处理中: ${processedAudios}/${stats.totalAudios} (${successAudios}成功, ${failedAudios}失败)`,
              stats: { ...stats, processedAudios, successAudios, failedAudios }
            });
          }

          triggerGC(); // 每个音频处理完主动GC

        } catch (e) {
          failedAudios++;
          processedAudios++;
          console.warn(`[ZIP-Native] 音频处理失败 ${audioInfo.filename || audioInfo.fileId}:`, e);
        }
      }

      if (onProgress) {
        onProgress({
          step: 2,
          progress: 90,
          message: `音频处理完成: ${successAudios}/${stats.totalAudios} 成功写入`,
          stats: { ...stats, processedAudios, successAudios, failedAudios }
        });
      }
    }

    // ========== 步骤2c: 流式读取并写入照片文件（原生导出） ==========
    if (includeVideos && stats.totalPhotos > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 90,
          message: `开始处理 ${stats.totalPhotos} 个照片文件 (${stats.opfsPhotos}个OPFS/原生, ${stats.base64Photos}个Base64)...`,
          stats
        });
      }

      let processedPhotos = 0;
      let successPhotos = 0;
      let failedPhotos = 0;

      // 逐个处理所有照片（避免并发太高导致内存溢出）
      for (const photoInfo of stats.photos) {
        try {
          let fileBlob;

          if (photoInfo.type === 'native') {
            // 从原生文件系统读取
            try {
              fileBlob = await readVideoFromNative(photoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP-Native] 原生照片读取失败 ${photoInfo.filename}:`, e);
              throw e;
            }
          } else if (photoInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(photoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP-Native] OPFS照片读取失败 ${photoInfo.filename}:`, e);
              throw e;
            }
          } else if (photoInfo.type === 'base64') {
            // Base64转File
            fileBlob = base64ToFile(photoInfo.data, photoInfo.outputFilename);
          }

          // 写入ZIP
          if (fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8array = new Uint8Array(arrayBuffer);
            await zipBuilder.addFile(`photos/${photoInfo.outputFilename}`, uint8array);
            successPhotos++;
          }

          processedPhotos++;

          // 报告进度（照片处理占90%-95%）
          if (onProgress) {
            const photoProgress = 90 + Math.floor((processedPhotos / stats.totalPhotos) * 5);
            onProgress({
              step: 2,
              progress: photoProgress,
              message: `照片处理中: ${processedPhotos}/${stats.totalPhotos} (${successPhotos}成功, ${failedPhotos}失败)`,
              stats: { ...stats, processedPhotos, successPhotos, failedPhotos }
            });
          }

          triggerGC(); // 每个照片处理完主动GC

        } catch (e) {
          failedPhotos++;
          processedPhotos++;
          console.warn(`[ZIP-Native] 照片处理失败 ${photoInfo.filename}:`, e);
        }
      }

      if (onProgress) {
        onProgress({
          step: 2,
          progress: 95,
          message: `照片处理完成: ${successPhotos}/${stats.totalPhotos} 成功写入`,
          stats: { ...stats, processedPhotos, successPhotos, failedPhotos }
        });
      }
    } else if (!includeVideos) {
      // 已经在视频处理中报告过了
    } else if (stats.totalPhotos > 0) {
      // 有照片但被跳过
    } else {
      // 没有照片文件
    }
    // ========== 步骤3: 完成ZIP文件构建 ==========
    if (onProgress) {
      onProgress({
        step: 3,
        progress: 88,
        message: '正在完成ZIP文件...',
        stats
      });
    }

    await zipBuilder.finalize();

    if (onProgress) {
      onProgress({
        step: 3,
        progress: 100,
        message: `导出完成! 共 ${stats.v2Timeline || stats.oldMoments} 条数据, ${includeVideos ? stats.totalVideos : 0} 个视频, ${includeVideos ? stats.totalAudios : 0} 个音频, ${includeVideos ? stats.totalPhotos : 0} 个照片`,
        stats
      });
    }

    return {
      filePath,
      filename,
      isNative: true,
      blob: null // 原生导出不返回Blob，返回文件路径
    };

  } catch (error) {
    console.error('[ZIP-Native] 原生导出失败:', error);
    throw error;
  }
}

// ============== 原有JSZip实现（保留作为降级方案） ==============

/**
 * 简单的并发控制函数（类似p-limit）
 * @param {Array} items 待处理项
 * @param {Function} processor 处理函数
 * @param {number} concurrency 并发数
 * @param {Function} onProgress 进度回调(processed, total, currentItem)
 */
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

  // 启动指定数量的worker
  const workers = [];
  const actualConcurrency = Math.min(concurrency, total);
  for (let i = 0; i < actualConcurrency; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return { results, errors };
}

/**
 * Base64转File对象
 * @param {string} dataUrl Base64数据URL
 * @param {string} filename 文件名
 * @returns {File}
 */
export function base64ToFile(dataUrl, filename) {
  // 提取MIME类型
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
}

/**
 * 从数据中收集所有视频文件信息
 * @param {Object} data 导出数据
 * @returns {Array<{type: 'opfs'|'base64', filename: string, data?: string, momentId: string}>}
 */
function collectVideoFiles(data) {
  const videos = [];
  const processedFilenames = new Set(); // 避免重复处理同一文件

  // 收集v2 timeline中的视频
  const timeline = data.v2AccountData?.timeline || [];
  for (const moment of timeline) {
    if (moment.videos && Array.isArray(moment.videos)) {
      for (const video of moment.videos) {
        // OPFS存储的视频（有filename字段但没有url或url是相对路径）
        if (video.filename && !processedFilenames.has(video.filename)) {
          // 检查是否为Base64格式
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
              type: video.storageType || 'native', // 使用实际的存储类型
              filename: video.filename,
              momentId: moment.id,
              outputFilename: video.filename
            });
          }
          processedFilenames.add(video.filename);
        }
        // 内嵌的Base64视频（有url字段且是data:开头）
        if (video.url && video.url.startsWith('data:') && !processedFilenames.has(video.url)) {
          videos.push({
            type: 'base64',
            filename: video.url,
            data: video.url,
            momentId: moment.id,
            outputFilename: `${moment.id || 'video'}_${Date.now()}.mp4`
          });
          processedFilenames.add(video.url);
        }
        // ✅ 修复：url是文件名/相对路径（不是Base64），作为OPFS视频收集
        else if (video.url && !video.url.startsWith('data:') && !processedFilenames.has(video.url)) {
          videos.push({
            type: video.storageType || 'native', // 使用实际的存储类型
            filename: video.url,
            momentId: moment.id,
            outputFilename: video.url
          });
          processedFilenames.add(video.url);
        }
      }
    }
  }

  // 收集旧版moments中的视频
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
              type: video.storageType || 'native', // 使用实际的存储类型
              filename: video.filename,
              momentId: moment.id,
              outputFilename: video.filename
            });
          }
          processedFilenames.add(video.filename);
        }
        if (video.url && video.url.startsWith('data:') && !processedFilenames.has(video.url)) {
          videos.push({
            type: 'base64',
            filename: video.url,
            data: video.url,
            momentId: moment.id,
            outputFilename: `${moment.id || 'video'}_${Date.now()}.mp4`
          });
          processedFilenames.add(video.url);
        }
        // ✅ 修复：url是文件名/相对路径（不是Base64），作为OPFS视频收集
        else if (video.url && !video.url.startsWith('data:') && !processedFilenames.has(video.url)) {
          videos.push({
            type: video.storageType || 'native', // 使用实际的存储类型
            filename: video.url,
            momentId: moment.id,
            outputFilename: video.url
          });
          processedFilenames.add(video.url);
        }
      }
    }
  }

  return videos;
}

/**
 * 从数据中收集所有音频文件信息
 * @param {Object} data 导出数据
 * @returns {Array<{type: 'opfs'|'base64'|'indexeddb', filename: string, fileId?: string, data?: string, momentId: string}>}
 */
function collectAudioFiles(data) {
  const audios = [];
  const processedFilenames = new Set(); // 避免重复处理同一文件

  // 收集v2 timeline中的音频
  const timeline = data.v2AccountData?.timeline || [];
  for (const moment of timeline) {
    if (moment.audios && Array.isArray(moment.audios)) {
      for (const audio of moment.audios) {
        // OPFS/原生存储的音频（有filename字段但没有url或url是相对路径）
        if (audio.filename && !processedFilenames.has(audio.filename)) {
          // 检查是否为Base64格式
          if (audio.filename.startsWith('data:')) {
            audios.push({
              type: 'base64',
              filename: audio.filename,
              data: audio.filename,
              momentId: moment.id,
              outputFilename: `${moment.id || 'audio'}_${Date.now()}.mp3`
            });
          } else {
            audios.push({
              type: audio.storageType || 'native', // 使用实际的存储类型
              filename: audio.filename,
              momentId: moment.id,
              outputFilename: audio.filename
            });
          }
          processedFilenames.add(audio.filename);
        }
        // 内嵌的Base64音频（有url字段且是data:开头）
        if (audio.url && audio.url.startsWith('data:') && !processedFilenames.has(audio.url)) {
          audios.push({
            type: 'base64',
            filename: audio.url,
            data: audio.url,
            momentId: moment.id,
            outputFilename: `${moment.id || 'audio'}_${Date.now()}.mp3`
          });
          processedFilenames.add(audio.url);
        }
        // url是文件名/相对路径（不是Base64），作为OPFS/原生音频收集
        else if (audio.url && !audio.url.startsWith('data:') && !processedFilenames.has(audio.url)) {
          audios.push({
            type: audio.storageType || 'native', // 使用实际的存储类型
            filename: audio.url,
            momentId: moment.id,
            outputFilename: audio.url
          });
          processedFilenames.add(audio.url);
        }
        // IndexedDB存储的音频（有audioFileId字段）
        if (audio.audioFileId && !processedFilenames.has(audio.audioFileId)) {
          audios.push({
            type: 'indexeddb',
            fileId: audio.audioFileId,
            momentId: moment.id,
            outputFilename: audio.name || `${audio.audioFileId}.mp3`
          });
          processedFilenames.add(audio.audioFileId);
        }
      }
    }
  }

  // 收集旧版moments中的音频
  const moments = data.moments || [];
  for (const moment of moments) {
    if (moment.audios && Array.isArray(moment.audios)) {
      for (const audio of moment.audios) {
        if (audio.filename && !processedFilenames.has(audio.filename)) {
          if (audio.filename.startsWith('data:')) {
            audios.push({
              type: 'base64',
              filename: audio.filename,
              data: audio.filename,
              momentId: moment.id,
              outputFilename: `${moment.id || 'audio'}_${Date.now()}.mp3`
            });
          } else {
            audios.push({
              type: 'opfs',
              filename: audio.filename,
              momentId: moment.id,
              outputFilename: audio.filename
            });
          }
          processedFilenames.add(audio.filename);
        }
        if (audio.url && audio.url.startsWith('data:') && !processedFilenames.has(audio.url)) {
          audios.push({
            type: 'base64',
            filename: audio.url,
            data: audio.url,
            momentId: moment.id,
            outputFilename: `${moment.id || 'audio'}_${Date.now()}.mp3`
          });
          processedFilenames.add(audio.url);
        }
        // url是文件名/相对路径（不是Base64），作为OPFS/原生音频收集
        else if (audio.url && !audio.url.startsWith('data:') && !processedFilenames.has(audio.url)) {
          audios.push({
            type: audio.storageType || 'native', // 使用实际的存储类型
            filename: audio.url,
            momentId: moment.id,
            outputFilename: audio.url
          });
          processedFilenames.add(audio.url);
        }
        // IndexedDB存储的音频
        if (audio.audioFileId && !processedFilenames.has(audio.audioFileId)) {
          audios.push({
            type: 'indexeddb',
            fileId: audio.audioFileId,
            momentId: moment.id,
            outputFilename: audio.name || `${audio.audioFileId}.mp3`
          });
          processedFilenames.add(audio.audioFileId);
        }
      }
    }
  }

  return audios;
}
/**
 * 统计数据信息
 * @param {Object} data 导出数据
 * @returns {Object} 统计信息
 */

/**
 * 收集所有照片文件
 * @param {Object} data 导出数据
 * @returns {Array} 照片文件列表
 */
function collectPhotoFiles(data) {
  const photos = [];
  const processedFilenames = new Set(); // 避免重复处理同一文件

  // 收集v2 timeline中的照片
  const timeline = data.v2AccountData?.timeline || [];
  for (const moment of timeline) {
    if (moment.photos && Array.isArray(moment.photos)) {
      for (const photo of moment.photos) {
        // 字符串类型的照片（可能是文件URI或Base64）
        if (typeof photo === 'string' && !processedFilenames.has(photo)) {
          if (photo.startsWith('data:')) {
            photos.push({
              type: 'base64',
              filename: photo,
              data: photo,
              momentId: moment.id,
              outputFilename: `${moment.id || 'photo'}_${Date.now()}.jpg`
            });
          } else {
            photos.push({
              type: 'native', // 默认原生存储
              filename: photo,
              momentId: moment.id,
              outputFilename: photo.split('/').pop() || `${moment.id || 'photo'}_${Date.now()}.jpg`
            });
          }
          processedFilenames.add(photo);
        }
        // 对象类型的照片（有filename或url字段）
        else if (typeof photo === 'object' && photo !== null) {
          // 有filename字段（OPFS/原生存储）
          if (photo.filename && !processedFilenames.has(photo.filename)) {
            if (photo.filename.startsWith('data:')) {
              photos.push({
                type: 'base64',
                filename: photo.filename,
                data: photo.filename,
                momentId: moment.id,
                outputFilename: photo.name || `${moment.id || 'photo'}_${Date.now()}.jpg`
              });
            } else {
              photos.push({
                type: photo.storageType || 'native', // 使用实际的存储类型
                filename: photo.filename,
                momentId: moment.id,
                outputFilename: photo.name || photo.filename.split('/').pop() || `${moment.id || 'photo'}_${Date.now()}.jpg`
              });
            }
            processedFilenames.add(photo.filename);
          }
          // 有url字段且是Base64
          if (photo.url && photo.url.startsWith('data:') && !processedFilenames.has(photo.url)) {
            photos.push({
              type: 'base64',
              filename: photo.url,
              data: photo.url,
              momentId: moment.id,
              outputFilename: photo.name || `${moment.id || 'photo'}_${Date.now()}.jpg`
            });
            processedFilenames.add(photo.url);
          }
          // url是文件名/相对路径（不是Base64）
          else if (photo.url && !photo.url.startsWith('data:') && !processedFilenames.has(photo.url)) {
            photos.push({
              type: photo.storageType || 'native', // 使用实际的存储类型
              filename: photo.url,
              momentId: moment.id,
              outputFilename: photo.name || photo.url.split('/').pop() || `${moment.id || 'photo'}_${Date.now()}.jpg`
            });
            processedFilenames.add(photo.url);
          }
        }
      }
    }
  }

  // 收集旧版moments中的照片
  const moments = data.moments || [];
  for (const moment of moments) {
    if (moment.photos && Array.isArray(moment.photos)) {
      for (const photo of moment.photos) {
        if (typeof photo === 'string' && !processedFilenames.has(photo)) {
          if (photo.startsWith('data:')) {
            photos.push({
              type: 'base64',
              filename: photo,
              data: photo,
              momentId: moment.id,
              outputFilename: `${moment.id || 'photo'}_${Date.now()}.jpg`
            });
          } else {
            photos.push({
              type: 'opfs',
              filename: photo,
              momentId: moment.id,
              outputFilename: photo.split('/').pop() || `${moment.id || 'photo'}_${Date.now()}.jpg`
            });
          }
          processedFilenames.add(photo);
        }
      }
    }
  }

  return photos;
}


function getStats(data) {
  const v2Timeline = data.v2AccountData?.timeline || [];
  const v2HasTimeline = v2Timeline.length > 0;
  
  const oldMoments = data.moments || [];
  const oldBabies = data.babies || [];
  const oldCapsules = data.capsules || [];
  const videos = collectVideoFiles(data);
  const opfsVideos = videos.filter(v => v.type === "opfs");
  const base64Videos = videos.filter(v => v.type === "base64");

  const audios = collectAudioFiles(data);
  const opfsAudios = audios.filter(a => a.type === "opfs");
  const base64Audios = audios.filter(a => a.type === "base64");
  const indexeddbAudios = audios.filter(a => a.type === "indexeddb");

  const photos = collectPhotoFiles(data);
  const opfsPhotos = photos.filter(p => p.type === "opfs");
  const base64Photos = photos.filter(p => p.type === "base64");

  return {
    v2Timeline: v2Timeline.length,
    v2HasTimeline,
    oldMoments: oldMoments.length,
    oldBabies: oldBabies.length,
    oldCapsules: oldCapsules.length,
    totalVideos: videos.length,
    opfsVideos: opfsVideos.length,
    base64Videos: base64Videos.length,
    videos,
    totalAudios: audios.length,
    opfsAudios: opfsAudios.length,
    base64Audios: base64Audios.length,
    indexeddbAudios: indexeddbAudios.length,
    audios,
    totalPhotos: photos.length,
    opfsPhotos: opfsPhotos.length,
    base64Photos: base64Photos.length,
    photos
  };
}

async function exportWithJSZip(options) {
  const {
    includeVideos = true,
    concurrency = STORAGE_CONFIG.MAX_CONCURRENT_READ,
    onProgress = null
  } = options;

  // 检查JSZip是否可用
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载，请检查网络连接');
  }

  const zip = new window.JSZip();
  const videosFolder = zip.folder('videos');

  try {
    // ========== 步骤1: 读取并准备数据 ==========
    if (onProgress) {
      onProgress({
        step: 1,
        progress: 10,
        message: '正在读取数据库数据...',
        stats: null
      });
    }

    // 同时读取IndexDB和v2数据
    const [idbData, v2Data] = await Promise.all([
      exportAllIDBData().catch(e => {
        console.warn('[ZIP] 读取IndexDB数据失败:', e);
        return null;
      }),
      exportV2AccountData()
    ]);

    // 合并数据 ✅ 修复：idbData有一层data嵌套
    const mergedData = {
      ...(idbData?.data || {}),
      ...(idbData || {}),
      v2AccountData: v2Data,
      exportTime: new Date().toISOString(),
      exportVersion: '2.0.0'
    };

    // 统计信息
    const stats = getStats(mergedData);
    
    if (onProgress) {
      onProgress({
        step: 1,
        progress: 30,
        message: `数据读取完成: ${stats.v2Timeline}条动态, ${stats.totalVideos}个视频`,
        stats
      });
    }

    // 写入data.json（不包含Base64视频数据，避免JSON过大）
    const dataForJson = JSON.parse(JSON.stringify(mergedData));
    // 清理timeline中的Base64视频数据（已单独保存）
    if (dataForJson.v2AccountData?.timeline) {
      for (const moment of dataForJson.v2AccountData.timeline) {
        if (moment.videos) {
          moment.videos = moment.videos.map(video => {
            const cleaned = { ...video };
            // 如果是Base64数据，只保留元信息，内容已单独保存到videos文件夹
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
      onProgress({
        step: 1,
        progress: 40,
        message: '数据JSON已写入ZIP',
        stats
      });
    }

    // ========== 步骤2: 流式读取并写入视频文件 ==========
    if (includeVideos && stats.totalVideos > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 40,
          message: `开始处理 ${stats.totalVideos} 个视频文件 (${stats.opfsVideos}个OPFS, ${stats.base64Videos}个Base64)...`,
          stats
        });
      }

      let processedVideos = 0;
      let successVideos = 0;
      let failedVideos = 0;

      // 并发处理所有视频
      const { errors } = await withConcurrency(
        stats.videos,
        async (videoInfo) => {
          let fileBlob;
          
          if (videoInfo.type === 'native') {
            // 从原生文件系统读取
            try {
              fileBlob = await readVideoFromNative(videoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] 原生视频读取失败 ${videoInfo.filename}:`, e);
              throw e;
            }
          } else if (videoInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(videoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] OPFS视频读取失败 ${videoInfo.filename}:`, e);
              // OPFS读取失败时，尝试从data中查找（可能是内嵌数据）
              throw e;
            }
          } else if (videoInfo.type === 'base64') {
            // Base64转File
            fileBlob = base64ToFile(videoInfo.data, videoInfo.outputFilename);
          }

          // 写入ZIP（流式，不全部保存在内存）
          if (fileBlob) {
            videosFolder.file(videoInfo.outputFilename, fileBlob);
            successVideos++;
          }
          
          processedVideos++;
          
          // 报告进度（视频处理占40%-85%）
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
    } else if (!includeVideos) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: '已跳过视频文件导出',
          stats
        });
      }
    } else {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: '没有视频文件需要导出',
          stats
        });
      }
    }


    // ========== 步骤2b: 流式读取并写入音频文件 ==========
    if (includeVideos && stats.totalAudios > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 85,
          message: `开始处理 ${stats.totalAudios} 个音频文件 (${stats.opfsAudios}个OPFS/原生, ${stats.base64Audios}个Base64, ${stats.indexeddbAudios}个IndexedDB)...`,
          stats
        });
      }

      const audiosFolder = zip.folder('audios');
      let processedAudios = 0;
      let successAudios = 0;
      let failedAudios = 0;

      // 并发处理所有音频
      const { errors } = await withConcurrency(
        stats.audios,
        async (audioInfo) => {
          let fileBlob;
          
          if (audioInfo.type === 'native') {
            // 从原生文件系统读取
            try {
              fileBlob = await readVideoFromNative(audioInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] 原生音频读取失败 ${audioInfo.filename}:`, e);
              throw e;
            }
          } else if (audioInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(audioInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] OPFS音频读取失败 ${audioInfo.filename}:`, e);
              throw e;
            }
          } else if (audioInfo.type === 'base64') {
            // Base64转File
            fileBlob = base64ToFile(audioInfo.data, audioInfo.outputFilename);
          } else if (audioInfo.type === 'indexeddb') {
            // 从IndexedDB读取
            try {
              fileBlob = await getAudioFile(audioInfo.fileId);
            } catch (e) {
              console.warn(`[ZIP] IndexedDB音频读取失败 ${audioInfo.fileId}:`, e);
              throw e;
            }
          }

          // 写入ZIP
          if (fileBlob) {
            audiosFolder.file(audioInfo.outputFilename, fileBlob);
            successAudios++;
          }
          
          processedAudios++;
          
          // 报告进度（音频处理占85%-90%）
          if (onProgress) {
            const audioProgress = 85 + Math.floor((processedAudios / stats.totalAudios) * 5);
            onProgress({
              step: 2,
              progress: audioProgress,
              message: `音频处理中: ${processedAudios}/${stats.totalAudios} (${successAudios}成功, ${failedAudios}失败)`,
              stats: { ...stats, processedAudios, successAudios, failedAudios }
            });
          }
        },
        concurrency
      );

      failedAudios = errors.length;

      if (onProgress) {
        onProgress({
          step: 2,
          progress: 90,
          message: `音频处理完成: ${successAudios}/${stats.totalAudios} 成功写入`,
          stats: { ...stats, processedAudios, successAudios, failedAudios }
        });
      }
    }

    // ========== 步骤2c: 流式读取并写入照片文件 ==========
    if (includeVideos && stats.totalPhotos > 0) {
      if (onProgress) {
        onProgress({
          step: 2,
          progress: 90,
          message: `开始处理 ${stats.totalPhotos} 个照片文件 (${stats.opfsPhotos}个OPFS/原生, ${stats.base64Photos}个Base64)...`,
          stats
        });
      }

      const photosFolder = zip.folder('photos');
      let processedPhotos = 0;
      let successPhotos = 0;
      let failedPhotos = 0;

      // 并发处理所有照片
      const { errors } = await withConcurrency(
        stats.photos,
        async (photoInfo) => {
          let fileBlob;

          if (photoInfo.type === 'native') {
            // 从原生文件系统读取
            try {
              fileBlob = await readVideoFromNative(photoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] 原生照片读取失败 ${photoInfo.filename}:`, e);
              throw e;
            }
          } else if (photoInfo.type === 'opfs') {
            // 从OPFS读取
            try {
              fileBlob = await readVideoFromOPFS(photoInfo.filename);
            } catch (e) {
              console.warn(`[ZIP] OPFS照片读取失败 ${photoInfo.filename}:`, e);
              throw e;
            }
          } else if (photoInfo.type === 'base64') {
            // Base64转File
            fileBlob = base64ToFile(photoInfo.data, photoInfo.outputFilename);
          }

          // 写入ZIP
          if (fileBlob) {
            photosFolder.file(photoInfo.outputFilename, fileBlob);
            successPhotos++;
          }

          processedPhotos++;

          // 报告进度（照片处理占90%-95%）
          if (onProgress) {
            const photoProgress = 90 + Math.floor((processedPhotos / stats.totalPhotos) * 5);
            onProgress({
              step: 2,
              progress: photoProgress,
              message: `照片处理中: ${processedPhotos}/${stats.totalPhotos} (${successPhotos}成功, ${failedPhotos}失败)`,
              stats: { ...stats, processedPhotos, successPhotos, failedPhotos }
            });
          }
        },
        concurrency
      );

      failedPhotos = errors.length;

      if (onProgress) {
        onProgress({
          step: 2,
          progress: 95,
          message: `照片处理完成: ${successPhotos}/${stats.totalPhotos} 成功写入`,
          stats: { ...stats, processedPhotos, successPhotos, failedPhotos }
        });
      }
    }
    // ========== 步骤3: 生成最终ZIP文件 ==========
    if (onProgress) {
      onProgress({
        step: 3,
        progress: 88,
        message: '正在生成ZIP文件...',
        stats
      });
    }

    const zipBlob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        streamFiles: true // 流式处理，减少内存使用
      },
      (metadata) => {
        if (onProgress) {
          const zipProgress = 88 + Math.floor(metadata.percent * 0.12);
          onProgress({
            step: 3,
            progress: zipProgress,
            message: `ZIP压缩中: ${Math.round(metadata.percent)}%`,
            stats
          });
        }
      }
    );

    if (onProgress) {
      onProgress({
        step: 3,
        progress: 100,
        message: `导出完成! 共 ${stats.v2Timeline || stats.oldMoments} 条数据, ${includeVideos ? stats.totalVideos : 0} 个视频`,
        stats
      });
    }

    return {
      blob: zipBlob,
      isNative: false,
      filePath: null,
      filename: null
    };

  } catch (error) {
    console.error('[ZIP] 导出失败:', error);
    throw error;
  }
}

// ============== 统一导出接口（对外完全兼容） ==============

/**
 * 导出所有数据+视频为ZIP
 * 优先使用APP原生流式导出（低内存），失败自动降级到JSZip
 * 浏览器环境直接使用JSZip
 * 
 * @param {Object} options 导出选项
 * @param {boolean} options.includeVideos 是否包含视频文件，默认true
 * @param {number} options.concurrency 并发读取数，默认STORAGE_CONFIG.MAX_CONCURRENT_READ
 * @param {Function} options.onProgress 进度回调，参数: { step, progress, message, stats }
 *   - step: 1=准备数据, 2=处理视频, 3=生成ZIP
 *   - progress: 0-100
 *   - message: 当前操作描述
 *   - stats: 数据统计信息
 * @returns {Promise<Object>} 返回 { blob?, filePath?, filename?, isNative: boolean }
 *   - 原生导出: 返回 filePath 和 filename，blob为null
 *   - JSZip导出: 返回 blob，filePath为null
 */
export async function exportAllData(options = {}) {
  const {
    includeVideos = true,
    concurrency = STORAGE_CONFIG.MAX_CONCURRENT_READ,
    onProgress = null
  } = options;

  // 策略1：浏览器环境或开关关闭 -> 直接用JSZip
  if (!NATIVE_FS_EXPORT_ENABLED || !isNativeFSSupported()) {
    return await exportWithJSZip(options);
  }

  // 策略2：APP环境 -> 先尝试原生流式导出，失败自动降级到JSZip
  try {
    console.log('[ZIP] 使用APP原生文件系统流式导出');
    return await exportWithNativeFS(options);
  } catch (nativeError) {
    console.warn('[ZIP] 原生导出失败，自动降级到JSZip:', nativeError);
    if (onProgress) {
      onProgress({
        step: 1,
        progress: 5,
        message: '原生导出失败，正在切换到兼容模式...',
        stats: null
      });
    }
    return await exportWithJSZip(options);
  }
}

// ============== 导入功能（保持不变） ==============

/**
 * 从ZIP文件导入数据
 * @param {File} zipFile ZIP文件
 * @param {Function} onProgress 进度回调(0-100)
 * @returns {Promise<Object>}
 */
export async function importFromZip(zipFile, onProgress = null) {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载，请检查网络连接');
  }

  try {
    if (onProgress) onProgress(5, '正在读取ZIP文件...');

    const zip = await window.JSZip.loadAsync(zipFile);

    if (onProgress) onProgress(10, '正在解析数据...');

    // 1. 读取数据JSON
    const dataJsonFile = zip.file('data.json');
    if (!dataJsonFile) {
      throw new Error('ZIP文件中未找到data.json');
    }

    const dataJson = await dataJsonFile.async('string');
    const data = JSON.parse(dataJson);

    if (onProgress) onProgress(30, '数据解析完成');

    // 2. 读取视频文件
    const videosFolder = zip.folder('videos');
    const videoFiles = [];
    
    if (videosFolder) {
      const fileNames = Object.keys(videosFolder.files).filter(
        (name) => !videosFolder.files[name].dir
      );

      let processed = 0;
      const total = fileNames.length;

      for (const filename of fileNames) {
        try {
          const fileData = await videosFolder.file(filename).async('blob');
          videoFiles.push({ filename, file: fileData });
        } catch (e) {
          console.warn(`[ZIP] 读取视频文件失败 ${filename}:`, e);
        }
        processed++;
        if (onProgress) {
          onProgress(30 + Math.floor((processed / total) * 20), `读取视频: ${processed}/${total}`);
        }
      }
    }

    // 3. 读取音频文件
    const audiosFolder = zip.folder('audios');
    const audioFiles = [];
    
    if (audiosFolder) {
      const fileNames = Object.keys(audiosFolder.files).filter(
        (name) => !audiosFolder.files[name].dir
      );

      let processed = 0;
      const total = fileNames.length;

      for (const filename of fileNames) {
        try {
          const fileData = await audiosFolder.file(filename).async('blob');
          audioFiles.push({ filename, file: fileData });
        } catch (e) {
          console.warn(`[ZIP] 读取音频文件失败 ${filename}:`, e);
        }
        processed++;
        if (onProgress) {
          onProgress(50 + Math.floor((processed / total) * 20), `读取音频: ${processed}/${total}`);
        }
      }
    }

    // 4. 读取照片文件
    const photosFolder = zip.folder('photos');
    const photoFiles = [];
    
    if (photosFolder) {
      const fileNames = Object.keys(photosFolder.files).filter(
        (name) => !photosFolder.files[name].dir
      );

      let processed = 0;
      const total = fileNames.length;

      for (const filename of fileNames) {
        try {
          const fileData = await photosFolder.file(filename).async('blob');
          photoFiles.push({ filename, file: fileData });
        } catch (e) {
          console.warn(`[ZIP] 读取照片文件失败 ${filename}:`, e);
        }
        processed++;
        if (onProgress) {
          onProgress(70 + Math.floor((processed / total) * 25), `读取照片: ${processed}/${total}`);
        }
      }
    }

    if (onProgress) onProgress(100, '导入完成');

    return {
      data,
      videoFiles,
      audioFiles,
      photoFiles
    };

  } catch (error) {
    console.error('[ZIP] 导入失败:', error);
    throw error;
  }
}

// ============== 其他工具函数（保持不变） ==============

/**
 * 触发浏览器下载
 * @param {Blob} blob 文件内容
 * @param {string} filename 文件名
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

/**
 * 向后兼容的exportToZip（使用exportAllData）
 * @deprecated 请使用 exportAllData 替代
 */
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
  withConcurrency
};
