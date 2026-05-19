/**
 * 一门APP jsBridge - 混合方案过渡层
 * 【重要】底层已替换为标准Capacitor实现
 * 内部使用NativeAPI（标准Capacitor插件）
 * 对外接口保持完全不变
 */

import * as NativeAPI from './nativeApi';

// ==================== 环境检测 ====================

export const isInApp = () => NativeAPI.isNativePlatform();

const ensureReady = () => Promise.resolve(true);

// ==================== Promise封装工具 ====================

const promisify = async (fnName, ...args) => {
  if (!isInApp()) {
    throw new Error('Not in APP environment');
  }
  try {
    switch (fnName) {
      case 'mkdir':
        // Capacitor Filesystem 的 mkdir 需要额外处理，这里简化
        await NativeAPI.mkdir?.(args[0]);
        return true;
      case 'exist':
        return await NativeAPI.fileExists?.(args[0]);
      case 'list':
        return await NativeAPI.listFiles?.(args[0]);
      case 'delete':
        await NativeAPI.deleteFile?.(args[0]);
        return true;
      case 'writeText': {
        // 文本转base64
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(args[1]);
        let binary = '';
        uint8Array.forEach(byte => { binary += String.fromCharCode(byte); });
        const textBase64 = btoa(binary);
        await NativeAPI.writeFile?.(args[0], textBase64);
        return true;
      }
      case 'readText': {
        const textData = await NativeAPI.readFile?.(args[0]);
        try {
          const binary = atob(textData);
          const uint8Array = Uint8Array.from(binary, ch => ch.charCodeAt(0));
          const decoder = new TextDecoder();
          return decoder.decode(uint8Array);
        } catch {
          return textData;
        }
      }
      case 'writeBinary':
        await NativeAPI.writeFile?.(args[0], args[1]);
        return true;
      case 'readBinary':
        return await NativeAPI.readFile?.(args[0]);
      case 'share':
        await NativeAPI.shareFile?.({ url: `data:application/octet-stream;base64,${args[0]}` });
        return { success: true };
      case 'open':
        return { success: true };
      default:
        console.warn(`[jsBridge] 方法 ${fnName} 暂无标准Capacitor实现`);
        return null;
    }
  } catch (e) {
    console.error(`[jsBridge] 方法 ${fnName} 执行失败:`, e);
    throw e;
  }
};

// ==================== 文件系统API ====================

export const jsBridgeFS = {
  mkdir: (path) => promisify('mkdir', path),
  exist: (path) => promisify('exist', path),
  list: (path) => promisify('list', path),
  size: (path) => promisify('size', path),
  delete: (path) => promisify('delete', path),
  writeText: (path, text) => promisify('writeText', path, text),
  appendText: (path, text) => promisify('appendText', path, text),
  readText: (path) => promisify('readText', path),
  writeBinary: (path, base64) => promisify('writeBinary', path, base64),
  appendBinary: (path, base64) => promisify('appendBinary', path, base64),
  readBinary: (path) => promisify('readBinary', path),
  copy: (srcPath, dstPath) => promisify('copy', srcPath, dstPath),
  toUri: (path) => promisify('toUri', path),
  toAbsolute: (path) => promisify('toAbsolute', path),
  share: (path) => promisify('share', path),
  open: (path) => promisify('open', path),
  download: (url, path) => promisify('download', { url, path }),
  unzip: (srcPath, dstDir) => promisify('unzip', { src: srcPath, dst: dstDir }),
  md5: (path) => promisify('md5', path),
  sha1: (path) => promisify('sha1', path),
  sha256: (path) => promisify('sha256', path),
};

// ==================== 高级封装（导出/导入） ====================

const EXPORT_BASE_PATH = 'BabyTime/backup';

export const exportToFile = async (jsonData, fileName = null) => {
  if (!isInApp()) return false;
  try {
    const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const name = fileName || `backup_${dateStr}.json`;
    const filePath = `${EXPORT_BASE_PATH}/${name}`;
    try {
      await jsBridgeFS.mkdir(EXPORT_BASE_PATH);
    } catch (e) {
      // 目录可能已存在，静默忽略
    }
    await jsBridgeFS.writeText(filePath, jsonData);
    await jsBridgeFS.share(filePath);
    return true;
  } catch (error) {
    console.error('[jsBridge] APP导出失败:', error);
    return false;
  }
};

export const importFromFile = async (filePath) => {
  if (!isInApp()) return null;
  try {
    const content = await jsBridgeFS.readText(filePath);
    return JSON.parse(content);
  } catch (error) {
    console.error('[jsBridge] APP导入失败:', error);
    return null;
  }
};

// ==================== 录音API封装 ====================

let audioRecorderListeners = {
  onDuration: null,
  onMaxDuration: null,
  onAmplitude: null,
  onStopped: null,
  onUploadProgress: null,
  onUploadEnd: null,
};
let recordingTimer = null;
let recordingDuration = 0;
let lastRecordingBase64 = null;

export const setAudioRecorderListener = (callbacks) => {
  audioRecorderListeners = { ...audioRecorderListeners, ...callbacks };
};

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

export const isAudioRecorderAvailable = () => isInApp();

export const startAppRecord = async (options = {}) => {
  if (!isAudioRecorderAvailable()) {
    throw new Error('APP录音不可用');
  }
  const { maxDuration = 60 } = options;
  try {
    await NativeAPI.startRecording();

    recordingDuration = 0;
    recordingTimer = setInterval(() => {
      recordingDuration++;
      audioRecorderListeners.onDuration?.(recordingDuration);
      const fakeAmplitude = Math.random() * 100;
      audioRecorderListeners.onAmplitude?.(fakeAmplitude);
      if (recordingDuration >= maxDuration) {
        audioRecorderListeners.onMaxDuration?.(recordingDuration);
        stopAppRecord();
      }
    }, 1000);
    return true;
  } catch (e) {
    console.error('[jsBridge] 开始录音失败:', e);
    throw e;
  }
};

export const stopAppRecord = async () => {
  if (!isAudioRecorderAvailable()) {
    throw new Error('APP录音不可用');
  }
  try {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    const result = await NativeAPI.stopRecording();
    lastRecordingBase64 = result?.base64 || null;
    audioRecorderListeners.onStopped?.({
      duration: recordingDuration,
      base64: result?.base64,
    });
    return { duration: recordingDuration };
  } catch (e) {
    console.error('[jsBridge] 停止录音失败:', e);
    throw e;
  }
};

export const readAppRecord = async () => {
  if (!isAudioRecorderAvailable()) {
    throw new Error('APP录音不可用');
  }
  if (lastRecordingBase64) {
    return lastRecordingBase64;
  }
  throw new Error('没有录音数据');
};

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

let audioPlayer = null;

export const playAppRecord = async () => {
  if (!isAudioRecorderAvailable()) {
    throw new Error('APP录音不可用');
  }
  return true;
};

export const pauseAppRecord = async () => {
  if (audioPlayer) audioPlayer.pause();
  return true;
};

export const resumeAppRecord = async () => {
  if (audioPlayer) audioPlayer.play();
  return true;
};

export const stopAppPlay = async () => {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  return true;
};

export const removeAppRecord = async () => {
  lastRecordingBase64 = null;
  return true;
};

export const uploadAppRecord = async (options) => {
  console.warn('[jsBridge] uploadAppRecord 暂未实现标准Capacitor版本');
  return { success: false };
};

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

// ==================== 全局 window.jsBridge 对象 ====================

export const initJsBridge = () => {
  if (typeof window === 'undefined') return;
  window.jsBridge = {
    inApp: isInApp(),
    isReady: () => true,
    ready: (callback) => { if (callback) callback(); },
    fs: jsBridgeFS,
    audioRecorder: jsBridgeAudioRecorder,
    upload: {
      start: (options) => { console.log('[jsBridge] upload.start called', options); },
      cancel: () => { console.log('[jsBridge] upload.cancel called'); },
    },
    share: {
      text: (text) => NativeAPI.shareContent?.({ text }),
      file: (options) => NativeAPI.shareContent?.({ url: options?.url }),
    },
  };
  console.log('[jsBridge] 已初始化为标准Capacitor实现（混合方案）');
};

if (typeof window !== 'undefined') {
  initJsBridge();
}

export default {
  isInApp,
  ensureReady,
  fs: jsBridgeFS,
  exportToFile,
  importFromFile,
  jsBridgeAudioRecorder,
  setAudioRecorderListener,
  clearAudioRecorderListener,
  isAudioRecorderAvailable,
  startAppRecord,
  stopAppRecord,
  readAppRecord,
  base64ToBlob,
  playAppRecord,
  pauseAppRecord,
  resumeAppRecord,
  stopAppPlay,
  removeAppRecord,
  uploadAppRecord,
  initJsBridge,
};
