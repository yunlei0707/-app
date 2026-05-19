/**
 * NativeAPI - 标准Capacitor原生能力封装
 * 
 * 目标架构：使用官方标准Capacitor插件
 * - @capacitor/camera：相机/相册
 * - @capacitor/filesystem：文件系统
 * - @capacitor/share：分享
 * - capacitor-voice-recorder：录音
 * 
 * 后续新功能请直接使用此API，不再调用jsBridge
 * 
 * 注意：所有导入都是动态导入，确保在Web环境下不会崩溃
 */

// 从window对象安全获取Capacitor，避免直接import导致Web环境崩溃
const Capacitor = window.Capacitor || null;

// ====== 环境检测 ======

/**
 * 检测是否在原生APP环境
 * @returns {boolean}
 */
export function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

/**
 * 检测是否支持原生API
 * @returns {boolean}
 */
export function isNativeSupported() {
  return isNativePlatform();
}

// ====== 文件系统工具函数 ======

/**
 * File转Base64
 * @param {File} file 
 * @param {Function} onProgress 
 * @returns {Promise<string>}
 */
export async function fileToBase64(file, onProgress = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    
    reader.onerror = () => reject(new Error('File read failed'));
    
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

/**
 * Base64转Blob
 * @param {string} base64 
 * @param {string} mimeType 
 * @returns {Promise<Blob>}
 */
export async function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const response = await fetch(`data:${mimeType};base64,${base64}`);
  return await response.blob();
}

// ====== 延迟加载插件 ======

async function loadCameraPlugin() {
  try {
    if (!isNativeSupported()) {
      return null;
    }
    return await import('@capacitor/camera');
  } catch (e) {
    console.warn('[NativeAPI] Camera plugin not available:', e.message);
    return null;
  }
}

async function loadFilesystemPlugin() {
  try {
    if (!isNativeSupported()) {
      return null;
    }
    return await import('@capacitor/filesystem');
  } catch (e) {
    console.warn('[NativeAPI] Filesystem plugin not available:', e.message);
    return null;
  }
}

async function loadSharePlugin() {
  try {
    if (!isNativeSupported()) {
      return null;
    }
    return await import('@capacitor/share');
  } catch (e) {
    console.warn('[NativeAPI] Share plugin not available:', e.message);
    return null;
  }
}

async function loadVoiceRecorderPlugin() {
  try {
    if (!isNativeSupported()) {
      return null;
    }
    return await import('capacitor-voice-recorder');
  } catch (e) {
    console.warn('[NativeAPI] VoiceRecorder plugin not available:', e.message);
    return null;
  }
}

// ====== 相机/相册API ======

/**
 * 从相册选择图片
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export async function pickImage(options = {}) {
  const plugin = await loadCameraPlugin();
  if (!plugin) {
    throw new Error('Camera plugin not available');
  }

  const { Camera } = plugin;
  
  const result = await Camera.getPhoto({
    quality: options.quality || 80,
    allowEditing: options.allowEditing || false,
    resultType: options.resultType || 'base64',
    saveToGallery: options.saveToGallery || false,
    source: 'photos',
  });

  return {
    base64: result.base64String,
    path: result.path,
    webPath: result.webPath,
    format: result.format,
  };
}

/**
 * 拍照
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export async function takePhoto(options = {}) {
  const plugin = await loadCameraPlugin();
  if (!plugin) {
    throw new Error('Camera plugin not available');
  }

  const { Camera } = plugin;
  
  const result = await Camera.getPhoto({
    quality: options.quality || 80,
    allowEditing: options.allowEditing || false,
    resultType: options.resultType || 'base64',
    saveToGallery: options.saveToGallery || true,
    source: 'camera',
  });

  return {
    base64: result.base64String,
    path: result.path,
    webPath: result.webPath,
    format: result.format,
  };
}

// ====== 文件系统API ======

/**
 * 写入文件
 * @param {string} path 
 * @param {string} data - base64格式
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export async function writeFile(path, data, options = {}) {
  const plugin = await loadFilesystemPlugin();
  if (!plugin) {
    throw new Error('Filesystem plugin not available');
  }

  const { Filesystem, Directory } = plugin;
  
  const result = await Filesystem.writeFile({
    path,
    data,
    directory: options.directory || Directory.Documents,
    recursive: options.recursive !== false,
  });

  return result;
}

/**
 * 读取文件
 * @param {string} path 
 * @param {Object} options 
 * @returns {Promise<string>} base64
 */
export async function readFile(path, options = {}) {
  const plugin = await loadFilesystemPlugin();
  if (!plugin) {
    throw new Error('Filesystem plugin not available');
  }

  const { Filesystem, Directory } = plugin;
  
  const result = await Filesystem.readFile({
    path,
    directory: options.directory || Directory.Documents,
  });

  return result.data;
}

/**
 * 删除文件
 * @param {string} path 
 * @param {Object} options 
 * @returns {Promise<void>}
 */
export async function deleteFile(path, options = {}) {
  const plugin = await loadFilesystemPlugin();
  if (!plugin) {
    throw new Error('Filesystem plugin not available');
  }

  const { Filesystem, Directory } = plugin;
  
  await Filesystem.deleteFile({
    path,
    directory: options.directory || Directory.Documents,
  });
}

/**
 * 创建目录
 * @param {string} path 
 * @param {Object} options 
 * @returns {Promise<void>}
 */
export async function mkdir(path, options = {}) {
  const plugin = await loadFilesystemPlugin();
  if (!plugin) {
    throw new Error('Filesystem plugin not available');
  }

  const { Filesystem, Directory } = plugin;
  
  await Filesystem.mkdir({
    path,
    directory: options.directory || Directory.Documents,
    recursive: options.recursive !== false,
  });
}

/**
 * 检查文件是否存在
 * @param {string} path 
 * @param {Object} options 
 * @returns {Promise<boolean>}
 */
export async function fileExists(path, options = {}) {
  const plugin = await loadFilesystemPlugin();
  if (!plugin) {
    return false;
  }

  const { Filesystem, Directory } = plugin;
  
  try {
    await Filesystem.stat({
      path,
      directory: options.directory || Directory.Documents,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 列出目录
 * @param {string} path 
 * @param {Object} options 
 * @returns {Promise<Array>}
 */
export async function listFiles(path, options = {}) {
  const plugin = await loadFilesystemPlugin();
  if (!plugin) {
    throw new Error('Filesystem plugin not available');
  }

  const { Filesystem, Directory } = plugin;
  
  const result = await Filesystem.readdir({
    path,
    directory: options.directory || Directory.Documents,
  });

  return result.files;
}

// ====== 录音API ======

let currentRecording = null;

/**
 * 检查录音权限
 * @returns {Promise<boolean>}
 */
export async function checkAudioPermissions() {
  const plugin = await loadVoiceRecorderPlugin();
  if (!plugin) {
    return false;
  }

  const { VoiceRecorder } = plugin;
  
  const status = await VoiceRecorder.checkPermissions();
  return status.audio_recording === 'granted';
}

/**
 * 请求录音权限
 * @returns {Promise<boolean>}
 */
export async function requestAudioPermissions() {
  const plugin = await loadVoiceRecorderPlugin();
  if (!plugin) {
    return false;
  }

  const { VoiceRecorder } = plugin;
  
  const status = await VoiceRecorder.requestPermissions();
  return status.audio_recording === 'granted';
}

/**
 * 开始录音
 * @returns {Promise<void>}
 */
export async function startRecording() {
  const plugin = await loadVoiceRecorderPlugin();
  if (!plugin) {
    throw new Error('VoiceRecorder plugin not available');
  }

  const { VoiceRecorder } = plugin;
  
  const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
  if (!canRecord.value) {
    throw new Error('Device does not support voice recording');
  }

  const hasPermission = await checkAudioPermissions();
  if (!hasPermission) {
    const granted = await requestAudioPermissions();
    if (!granted) {
      throw new Error('Audio recording permission denied');
    }
  }

  await VoiceRecorder.startRecording();
  currentRecording = { startTime: Date.now() };
}

/**
 * 停止录音
 * @returns {Promise<Object>} { base64, mimeType, duration }
 */
export async function stopRecording() {
  const plugin = await loadVoiceRecorderPlugin();
  if (!plugin) {
    throw new Error('VoiceRecorder plugin not available');
  }

  const { VoiceRecorder } = plugin;
  
  const result = await VoiceRecorder.stopRecording();
  const duration = currentRecording ? Date.now() - currentRecording.startTime : 0;
  currentRecording = null;

  return {
    base64: result.value.recordDataBase64,
    mimeType: result.value.mimeType,
    duration: Math.round(duration / 1000),
  };
}

/**
 * 检查是否正在录音
 * @returns {Promise<boolean>}
 */
export async function isRecording() {
  const plugin = await loadVoiceRecorderPlugin();
  if (!plugin) {
    return false;
  }

  const { VoiceRecorder } = plugin;
  
  const status = await VoiceRecorder.isRecording();
  return status.value;
}

// ====== 分享API ======

/**
 * 分享文本
 * @param {string} text 
 * @param {string} title 
 * @returns {Promise<void>}
 */
export async function shareText(text, title = '') {
  const plugin = await loadSharePlugin();
  if (!plugin) {
    throw new Error('Share plugin not available');
  }

  const { Share } = plugin;
  
  await Share.share({
    title,
    text,
  });
}

/**
 * 分享文件
 * @param {Object} options 
 * @returns {Promise<void>}
 */
export async function shareFile(options = {}) {
  const plugin = await loadSharePlugin();
  if (!plugin) {
    throw new Error('Share plugin not available');
  }

  const { Share } = plugin;
  
  await Share.share({
    title: options.title || '',
    text: options.text || '',
    url: options.url,
    dialogTitle: options.dialogTitle || '分享',
  });
}

// ====== 导出默认对象 ======

export default {
  isNativePlatform,
  isNativeSupported,
  fileToBase64,
  base64ToBlob,
  pickImage,
  takePhoto,
  writeFile,
  readFile,
  deleteFile,
  mkdir,
  fileExists,
  listFiles,
  checkAudioPermissions,
  requestAudioPermissions,
  startRecording,
  stopRecording,
  isRecording,
  shareText,
  shareFile,
};
