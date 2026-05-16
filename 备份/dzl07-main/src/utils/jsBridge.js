/**
 * 一门APP jsBridge 文件系统封装
 * 基于官方SDK，提供Promise化的文件系统API
 * 所有调用都有降级处理，非APP环境静默跳过
 */

import { format } from 'date-fns';

// 检测是否在APP环境中
export const isInApp = () => {
  return typeof window !== 'undefined' && 
         typeof window.jsBridge !== 'undefined' && 
         window.jsBridge.inApp === true;
};

// 确保jsBridge已就绪
const ensureReady = () => {
  return new Promise((resolve) => {
    if (!window.jsBridge) {
      resolve(false);
      return;
    }
    if (window.jsBridge.isReady && window.jsBridge.isReady()) {
      resolve(true);
      return;
    }
    // 使用官方ready方法等待初始化
    window.jsBridge.ready(() => {
      resolve(true);
    });
    // 超时3秒后也放行
    setTimeout(() => resolve(!!window.jsBridge), 3000);
  });
};

/**
 * 通用Promise封装
 * 官方SDK的fs回调格式：
 * - 大多数方法：成功时直接返回数据（字符串/布尔值/数字）
 * - open/share 特殊方法：回调有两个参数 (succ, msg)，succ 为布尔值表示是否成功
 */
const promisify = (fnName, ...args) => {
  return new Promise(async (resolve, reject) => {
    if (!isInApp()) {
      reject(new Error('Not in APP environment'));
      return;
    }

    try {
      const jsb = window.jsBridge;
      if (!jsb || !jsb.fs) {
        reject(new Error('jsBridge.fs not available'));
        return;
      }

      const method = jsb.fs[fnName];
      if (typeof method !== 'function') {
        reject(new Error(`jsBridge.fs.${fnName} is not a function`));
        return;
      }

      // open 和 share 方法的回调有两个参数：(succ, msg)
      if (fnName === 'open' || fnName === 'share') {
        method.call(jsb.fs, ...args, (succ, msg) => {
          if (succ) {
            resolve({ success: true, message: msg });
          } else {
            reject(new Error(msg || `${fnName} failed`));
          }
        });
      } else {
        // 其他方法回调只有一个参数 result
        method.call(jsb.fs, ...args, (result) => {
          resolve(result);
        });
      }
    } catch (e) {
      reject(e);
    }
  });
};

// 文件系统API封装
export const jsBridgeFS = {
  // 创建目录
  mkdir: (path) => promisify('mkdir', path),

  // 判断文件/目录是否存在
  exist: (path) => promisify('exist', path),

  // 列出目录内容
  list: (path) => promisify('list', path),

  // 获取文件大小
  size: (path) => promisify('size', path),

  // 删除文件/目录
  delete: (path) => promisify('delete', path),

  // 写入文本文件
  writeText: (path, text) => promisify('writeText', path, text),

  // 追加文本
  appendText: (path, text) => promisify('appendText', path, text),

  // 读取文本文件
  readText: (path) => promisify('readText', path),

  // 写入二进制文件 (base64)
  writeBinary: (path, base64) => promisify('writeBinary', path, base64),

  // 追加二进制
  appendBinary: (path, base64) => promisify('appendBinary', path, base64),

  // 读取二进制文件 (返回base64)
  readBinary: (path) => promisify('readBinary', path),

  // 复制文件
  copy: (srcPath, dstPath) => promisify('copy', srcPath, dstPath),

  // 文件路径转URI
  toUri: (path) => promisify('toUri', path),

  // 转绝对路径
  toAbsolute: (path) => promisify('toAbsolute', path),

  // 分享文件（调系统分享面板）
  share: (path) => promisify('share', path),

  // 用系统应用打开文件
  open: (path) => promisify('open', path),

  // 下载文件到指定路径
  download: (url, path) => promisify('download', { url, path }),

  // 解压文件
  unzip: (srcPath, dstDir) => promisify('unzip', { src: srcPath, dst: dstDir }),

  // 计算MD5
  md5: (path) => promisify('md5', path),

  // 计算SHA1
  sha1: (path) => promisify('sha1', path),

  // 计算SHA256
  sha256: (path) => promisify('sha256', path),
};

// ==================== 高级封装 ====================

// 导出目录基础路径
const EXPORT_BASE_PATH = 'fs://download/宝宝时光备份';
const EXPORT_DIR = `${EXPORT_BASE_PATH}`;

/**
 * 导出数据到本地文件并分享
 * @param {string} jsonData - 要导出的JSON数据
 * @param {string} fileName - 文件名（不含路径）
 * @returns {Promise<boolean>} - 是否成功
 */
export const exportToFile = async (jsonData, fileName = null) => {
  if (!isInApp()) {
    return false;
  }

  try {
    // 生成文件名（带日期）
    const dateStr = format(new Date(), 'yyyyMMdd_HHmmss');
    const name = fileName || `backup_${dateStr}.json`;
    const filePath = `${EXPORT_DIR}/${name}`;

    // 确保目录存在
    try {
      await jsBridgeFS.mkdir(EXPORT_DIR);
    } catch (e) {
      // 目录可能已存在，静默忽略
    }

    // 写入文件
    await jsBridgeFS.writeText(filePath, jsonData);

    // 分享文件（调系统分享面板）
    await jsBridgeFS.share(filePath);

    return true;
  } catch (error) {
    console.error('[jsBridge] APP导出失败:', error);
    return false;
  }
};

/**
 * 从本地文件读取数据
 * @param {string} filePath - 文件路径
 * @returns {Promise<object|null>} - 解析后的JSON数据，失败返回null
 */
export const importFromFile = async (filePath) => {
  if (!isInApp()) {
    return null;
  }

  try {
    // 确保是fs://路径
    const fullPath = filePath.startsWith('fs://') ? filePath : `fs://file/${filePath}`;

    // 读取文件内容
    const content = await jsBridgeFS.readText(fullPath);

    // 解析JSON
    const data = JSON.parse(content);
    return data;
  } catch (error) {
    console.error('[jsBridge] APP导入失败:', error);
    return null;
  }
};

// ==================== 录音API封装 ====================

// 录音状态和监听器管理
let audioRecorderListeners = {
  onDuration: null,      // event 10: 录音进度，每秒回调
  onMaxDuration: null,   // event 11: 达到最大录音长度
  onAmplitude: null,     // event 12: 声波振幅，每200毫秒回调
  onStopped: null,       // event 13: 已停止录音
  onUploadProgress: null, // event 20: 上传进度
  onUploadEnd: null,     // event 21: 上传结束
};

/**
 * 设置录音监听器
 * @param {Object} callbacks - 回调函数对象
 */
export const setAudioRecorderListener = (callbacks) => {
  audioRecorderListeners = { ...audioRecorderListeners, ...callbacks };
};

/**
 * 清除录音监听器
 */
export const clearAudioRecorderListener = () => {
  audioRecorderListeners = {
    onDuration: null,
    onMaxDuration: null,
    onAmplitude: null,
    onStopped: null,
    onUploadProgress: null,
    onUploadEnd: null,
  };
};

/**
 * 注册原生录音监听器（内部使用）
 */
const setupNativeRecorderListener = () => {
  if (!window.jsBridge || !window.jsBridge.audioRecorder) return;
  
  window.jsBridge.audioRecorder.setListener((event, data) => {
    switch (event) {
      case 10: // 录音进度，每秒回调
        audioRecorderListeners.onDuration?.(data?.duration);
        break;
      case 11: // 达到最大录音长度
        audioRecorderListeners.onMaxDuration?.(data?.duration);
        break;
      case 12: // 声波振幅，每200毫秒回调
        audioRecorderListeners.onAmplitude?.(data?.amplitude);
        break;
      case 13: // 已停止录音
        audioRecorderListeners.onStopped?.(data);
        break;
      case 20: // 上传进度
        audioRecorderListeners.onUploadProgress?.(data);
        break;
      case 21: // 上传结束
        audioRecorderListeners.onUploadEnd?.(data);
        break;
    }
  });
};

/**
 * 检查APP录音是否可用
 */
export const isAudioRecorderAvailable = () => {
  return isInApp() && window.jsBridge && window.jsBridge.audioRecorder;
};

/**
 * 开始录音（APP环境）
 * @param {Object} options - 录音选项
 * @returns {Promise<boolean>} - 是否成功开始
 */
export const startAppRecord = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }

    const { maxDuration = 60, hiddenUI = true, source = 'mic' } = options;

    // 设置监听器
    setupNativeRecorderListener();

    window.jsBridge.audioRecorder.startRecord({
      maxDuration,
      hiddenUI,
      source,
    }, (succ, data) => {
      if (succ) {
        resolve(true);
      } else {
        reject(new Error(data?.message || '开始录音失败'));
      }
    });
  });
};

/**
 * 停止录音（APP环境）
 * @returns {Promise<{duration: number}>} - 录音时长
 */
export const stopAppRecord = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }

    window.jsBridge.audioRecorder.stopRecord((succ, data) => {
      if (succ) {
        resolve(data || { duration: 0 });
      } else {
        reject(new Error(data?.message || '停止录音失败'));
      }
    });
  });
};

/**
 * 读取录音文件（Base64）
 * @returns {Promise<string>} - Base64编码的音频数据
 */
export const readAppRecord = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }

    window.jsBridge.audioRecorder.read((contentAsBase64) => {
      if (contentAsBase64) {
        resolve(contentAsBase64);
      } else {
        reject(new Error('读取录音数据失败'));
      }
    });
  });
};

/**
 * Base64转Blob
 * @param {string} base64 - Base64数据
 * @param {string} mimeType - MIME类型
 * @returns {Blob}
 */
export const base64ToBlob = (base64, mimeType = 'audio/mp4') => {
  const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * 播放录音（APP环境）
 */
export const playAppRecord = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }
    window.jsBridge.audioRecorder.play((succ) => {
      resolve(succ);
    });
  });
};

/**
 * 暂停播放（APP环境）
 */
export const pauseAppRecord = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }
    window.jsBridge.audioRecorder.pause((succ) => {
      resolve(succ);
    });
  });
};

/**
 * 恢复播放（APP环境）
 */
export const resumeAppRecord = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }
    window.jsBridge.audioRecorder.resume((succ) => {
      resolve(succ);
    });
  });
};

/**
 * 停止播放（APP环境）
 */
export const stopAppPlay = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }
    window.jsBridge.audioRecorder.stop((succ) => {
      resolve(succ);
    });
  });
};

/**
 * 删除录音（APP环境）
 */
export const removeAppRecord = () => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }
    window.jsBridge.audioRecorder.remove((succ) => {
      resolve(succ);
    });
  });
};

/**
 * 上传录音（APP环境）
 * @param {Object} options
 * @param {string} options.url - 上传地址
 * @param {string} options.name - form-data表单项名称
 */
export const uploadAppRecord = (options) => {
  return new Promise((resolve, reject) => {
    if (!isAudioRecorderAvailable()) {
      reject(new Error('APP录音不可用'));
      return;
    }
    window.jsBridge.audioRecorder.upload(options, (succ, data) => {
      if (succ) {
        resolve(data);
      } else {
        reject(new Error(data?.message || '上传失败'));
      }
    });
  });
};

// 导出录音API
export const jsBridgeAudioRecorder = {
  isAvailable: isAudioRecorderAvailable,
  setListener: setAudioRecorderListener,
  clearListener: clearAudioRecorderListener,
  startRecord: startAppRecord,
  stopRecord: stopAppRecord,
  read: readAppRecord,
  toBlob: base64ToBlob,
  play: playAppRecord,
  pause: pauseAppRecord,
  resume: resumeAppRecord,
  stop: stopAppPlay,
  remove: removeAppRecord,
  upload: uploadAppRecord,
};

// 默认导出
export default {
  isInApp,
  ensureReady,
  fs: jsBridgeFS,
  exportToFile,
  importFromFile,
  audioRecorder: jsBridgeAudioRecorder,
};
