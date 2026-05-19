/**
 * ✅ 生产级：Capacitor原生能力统一封装层
 * 所有UI组件直接调用此文件
 */

// 懒加载插件（避免Web环境打包报错）
let CameraModule = null;
let FilesystemModule = null;
let VoiceRecorderModule = null;
let ShareModule = null;

async function loadCamera() {
  if (CameraModule) return CameraModule;
  try {
    const module = await import('@capacitor/camera');
    CameraModule = module;
    return CameraModule;
  } catch (e) {
    console.warn('[Native] Camera plugin not available');
    return null;
  }
}

async function loadFilesystem() {
  if (FilesystemModule) return FilesystemModule;
  try {
    const module = await import('@capacitor/filesystem');
    FilesystemModule = module;
    return FilesystemModule;
  } catch (e) {
    console.warn('[Native] Filesystem plugin not available');
    return null;
  }
}

async function loadVoiceRecorder() {
  if (VoiceRecorderModule) return VoiceRecorderModule;
  try {
    const module = await import('capacitor-voice-recorder');
    VoiceRecorderModule = module;
    return VoiceRecorderModule;
  } catch (e) {
    console.warn('[Native] VoiceRecorder plugin not available');
    return null;
  }
}

async function loadShare() {
  if (ShareModule) return ShareModule;
  try {
    const module = await import('@capacitor/share');
    ShareModule = module;
    return ShareModule;
  } catch (e) {
    console.warn('[Native] Share plugin not available');
    return null;
  }
}

// ==================== 权限请求核心函数 ====================

/**
 * 请求相机权限（主动弹窗，解决"每次询问"不弹窗问题）
 */
export async function requestCameraPermission() {
  if (!isNativePlatform()) return true;
  
  try {
    const Camera = await loadCamera();
    if (!Camera) return false;
    
    const status = await Camera.Camera.checkPermissions();
    if (status.camera !== 'granted' || status.photos !== 'granted') {
      const result = await Camera.Camera.requestPermissions();
      return result.camera === 'granted' || result.photos === 'granted';
    }
    return true;
  } catch (e) {
    console.error('[Native] 请求相机权限失败:', e);
    return false;
  }
}

/**
 * 请求录音权限
 */
export async function requestAudioPermission() {
  if (!isNativePlatform()) return true;
  
  try {
    const VoiceRecorder = await loadVoiceRecorder();
    if (!VoiceRecorder) return false;
    
    const hasPermission = await VoiceRecorder.VoiceRecorder.hasAudioRecordingPermission();
    if (!hasPermission.value) {
      const result = await VoiceRecorder.VoiceRecorder.requestAudioRecordingPermission();
      return result.value === 'granted' || result.value === true;
    }
    return true;
  } catch (e) {
    console.error('[Native] 请求录音权限失败:', e);
    return false;
  }
}

// ==================== 环境检测 ====================

export function isNativePlatform() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  } catch (e) {
    return false;
  }
}

export function convertFileSrc(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http') || filePath.startsWith('data:')) {
    return filePath;
  }
  return window.Capacitor?.convertFileSrc?.(filePath) || filePath;
}

// ==================== 相机/相册能力 ====================

export async function takePhoto(options = {}) {
  // Web端降级
  if (!isNativePlatform()) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        file ? resolve(URL.createObjectURL(file)) : reject(new Error('未选择图片'));
      };
      input.click();
    });
  }

  // ✅ 先请求权限（核心修复：确保"每次询问"也能弹窗）
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('请授予相机权限后重试');
  }

  const Camera = await loadCamera();
  if (!Camera) throw new Error('相机插件不可用');

  const photo = await Camera.Camera.getPhoto({
    quality: options.quality || 85,
    resultType: 'uri',
    source: options.source || Camera.CameraSource.Prompt,
    width: options.width || 1920,
    height: options.height || 1920,
    correctOrientation: true,
  });

  return photo.webPath || photo.path || photo.uri;
}

// ==================== 录音能力 ====================

export async function startRecording() {
  if (!isNativePlatform()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      window._mediaRecorder = new MediaRecorder(stream);
      window._audioChunks = [];
      window._mediaRecorder.ondataavailable = (e) => window._audioChunks.push(e.data);
      window._mediaRecorder.start();
      return true;
    } catch (e) {
      throw new Error('麦克风权限被拒绝');
    }
  }

  // ✅ 先请求权限
  const hasPermission = await requestAudioPermission();
  if (!hasPermission) {
    throw new Error('请授予录音权限后重试');
  }

  const VoiceRecorder = await loadVoiceRecorder();
  if (!VoiceRecorder) throw new Error('录音插件不可用');

  await VoiceRecorder.VoiceRecorder.startRecording();
  return true;
}

export async function stopRecording() {
  if (!isNativePlatform()) {
    if (!window._mediaRecorder) return null;
    return new Promise((resolve) => {
      window._mediaRecorder.onstop = () => {
        const blob = new Blob(window._audioChunks, { type: 'audio/webm' });
        resolve({ uri: URL.createObjectURL(blob), base64: null });
      };
      window._mediaRecorder.stop();
    });
  }

  const VoiceRecorder = await loadVoiceRecorder();
  if (!VoiceRecorder) return null;

  const result = await VoiceRecorder.VoiceRecorder.stopRecording();
  return {
    base64: result.value?.recordDataBase64,
    duration: result.value?.duration || 0,
    mimeType: result.value?.mimeType,
  };
}

// ==================== 分享能力 ====================

export async function shareContent(options = {}) {
  if (!isNativePlatform()) {
    if (navigator.share) {
      await navigator.share({
        title: options.title || '宝贝时光',
        text: options.text || '',
        url: options.url || window.location.href,
      });
      return true;
    }
    await navigator.clipboard.writeText(options.text || '');
    alert('已复制到剪贴板');
    return true;
  }

  const Share = await loadShare();
  if (!Share) return false;

  await Share.Share.share({
    title: options.title || '宝贝时光',
    text: options.text || '',
    url: options.url || '',
  });
  return true;
}

// ==================== 文件系统能力 ====================

export async function writeFile(path, data, directory = 'Documents') {
  if (!isNativePlatform()) {
    localStorage.setItem(`file_${path}`, data);
    return true;
  }

  const Filesystem = await loadFilesystem();
  if (!Filesystem) throw new Error('文件系统不可用');

  return await Filesystem.Filesystem.writeFile({
    path,
    data,
    directory: Filesystem.Directory[directory],
    recursive: true,
  });
}

export async function readFile(path, directory = 'Documents') {
  if (!isNativePlatform()) {
    return localStorage.getItem(`file_${path}`) || '';
  }

  const Filesystem = await loadFilesystem();
  if (!Filesystem) throw new Error('文件系统不可用');

  const result = await Filesystem.Filesystem.readFile({
    path,
    directory: Filesystem.Directory[directory],
  });
  return result.data;
}

export default {
  isNativePlatform,
  convertFileSrc,
  takePhoto,
  requestCameraPermission,
  requestAudioPermission,
  startRecording,
  stopRecording,
  shareContent,
  writeFile,
  readFile,
};
