/**
 * 生产级：Capacitor原生能力统一封装层
 * 提供相机、文件系统、分享、录音等原生能力
 * 提供Web端降级实现
 */

// ==================== 基础工具 ====================

function getCapacitor() {
  try {
    return window.Capacitor || null;
  } catch (e) {
    return null;
  }
}

export function isNativePlatform() {
  try {
    const Capacitor = getCapacitor();
    return Capacitor && typeof Capacitor.isNativePlatform === 'function'
      ? Capacitor.isNativePlatform()
      : false;
  } catch (e) {
    return false;
  }
}

export function convertFileSrc(filePath) {
  if (!filePath) return '';
  // 如果已经是 http/https 或 base64，直接返回
  if (filePath.startsWith('http') || filePath.startsWith('data:')) {
    return filePath;
  }
  const Capacitor = getCapacitor();
  return Capacitor ? Capacitor.convertFileSrc(filePath) : filePath;
}

// ==================== 相机/相册能力 ====================

let Camera = null;
let Filesystem = null;
let CameraSource = null;

async function loadCameraPlugin() {
  if (!isNativePlatform()) return null;
  if (Camera) return Camera;
  try {
    const module = await import('@capacitor/camera');
    Camera = module.Camera;
    CameraSource = module.CameraSource;
    return Camera;
  } catch (e) {
    console.warn('[Native] 相机插件加载失败:', e);
    return null;
  }
}

async function loadFilesystemPlugin() {
  if (!isNativePlatform()) return null;
  if (Filesystem) return Filesystem;
  try {
    const module = await import('@capacitor/filesystem');
    Filesystem = module.Filesystem;
    return Filesystem;
  } catch (e) {
    console.warn('[Native] 文件系统插件加载失败:', e);
    return null;
  }
}

/**
 * 拍照或从相册选择
 * @param {Object} options
 * @returns {Promise<string>} 文件URI
 */
export async function takePhoto(options = {}) {
  // Web端降级实现
  if (!isNativePlatform()) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          resolve(url);
        } else {
          reject(new Error('未选择图片'));
        }
      };
      input.click();
    });
  }

  // 原生环境
  const camera = await loadCameraPlugin();
  const filesystem = await loadFilesystemPlugin();
  if (!camera || !filesystem) {
    throw new Error('相机插件不可用');
  }

  const photo = await camera.getPhoto({
    quality: options.quality || 85,
    resultType: 'uri',
    source: options.source || CameraSource.Prompt,
    width: options.width || 1920,
    height: options.height || 1920,
    correctOrientation: true,
  });
  return photo.webPath || photo.path || photo.uri;
}

// ==================== 录音能力 ====================

let VoiceRecorder = null;
let isRecording = false;

async function loadVoiceRecorderPlugin() {
  if (!isNativePlatform()) return null;
  if (VoiceRecorder) return VoiceRecorder;
  try {
    const module = await import('capacitor-voice-recorder');
    VoiceRecorder = module.VoiceRecorder;
    return VoiceRecorder;
  } catch (e) {
    console.warn('[Native] 录音插件加载失败:', e);
    return null;
  }
}

export async function checkAudioPermission() {
  if (!isNativePlatform()) {
    return true; // Web环境在调用时才检查
  }
  const recorder = await loadVoiceRecorderPlugin();
  if (!recorder) return false;
  try {
    const result = await recorder.checkPermissions();
    return result?.value?.audioRecording === 'granted' || result?.value?.audioRecording === true;
  } catch (e) {
    console.warn('[Native] 检查录音权限失败:', e);
    return false;
  }
}

export async function requestAudioPermission() {
  if (!isNativePlatform()) {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false;
    }
  }

  const recorder = await loadVoiceRecorderPlugin();
  if (!recorder) return false;
  try {
    const hasPermission = await checkAudioPermission();
    if (hasPermission) return true;
    const result = await recorder.requestAudioRecordingPermissions();
    return result?.value === 'granted' || result?.value === true;
  } catch (e) {
    console.warn('[Native] 请求录音权限失败:', e);
    return true; // 某些设备可能绕过了权限检查
  }
}

export async function startRecording() {
  if (!isNativePlatform()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      window._mediaRecorder = new MediaRecorder(stream);
      window._audioChunks = [];
      window._mediaRecorder.ondataavailable = (e) => {
        window._audioChunks.push(e.data);
      };
      window._mediaRecorder.start();
      isRecording = true;
      return true;
    } catch (e) {
      console.error('[Native] Web录音失败:', e);
      throw new Error('麦克风权限被拒绝或不可用');
    }
  }

  const recorder = await loadVoiceRecorderPlugin();
  if (!recorder) {
    throw new Error('录音插件不可用');
  }
  const canRecord = await requestAudioPermission();
  if (!canRecord) {
    throw new Error('录音权限被拒绝');
  }
  try {
    await recorder.startRecording();
    isRecording = true;
    return true;
  } catch (e) {
    console.error('[Native] 开始录音失败:', e);
    if (e.message?.includes('permission') || e.message?.includes('Permission')) {
      throw new Error('请在应用设置中允许录音权限');
    }
    throw e;
  }
}

export async function stopRecording() {
  if (!isRecording) return null;

  if (!isNativePlatform()) {
    return new Promise((resolve) => {
      window._mediaRecorder.onstop = () => {
        const blob = new Blob(window._audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        isRecording = false;
        resolve({
          uri: url,
          duration: 0,
          size: blob.size,
          mimeType: 'audio/webm',
          base64: null,
        });
      };
      window._mediaRecorder.stop();
    });
  }

  const recorder = await loadVoiceRecorderPlugin();
  if (!recorder) return null;

  const result = await recorder.stopRecording();
  isRecording = false;
  const filesystem = await loadFilesystemPlugin();
  if (filesystem && result?.value?.recordDataBase64) {
    const fileName = `audio_${Date.now()}.m4a`;
    const savedFile = await filesystem.writeFile({
      path: fileName,
      data: result.value.recordDataBase64,
      directory: 'Data',
    });
    return {
      uri: savedFile.uri,
      duration: result.value.duration || 0,
      size: result.value.fileSize || 0,
      mimeType: result.value.mimeType || 'audio/m4a',
      base64: result.value.recordDataBase64,
    };
  }
  return null;
}

// ==================== 分享能力 ====================

let Share = null;

async function loadSharePlugin() {
  if (!isNativePlatform()) return null;
  if (Share) return Share;
  try {
    const module = await import('@capacitor/share');
    Share = module.Share;
    return Share;
  } catch (e) {
    console.warn('[Native] 分享插件加载失败:', e);
    return null;
  }
}

export async function shareContent(options = {}) {
  if (!isNativePlatform()) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: options.title || '宝贝时光',
          text: options.text || '',
          url: options.url || window.location.href,
        });
        return true;
      } catch (e) {
        return false;
      }
    } else {
      const text = `${options.title || ''}\n${options.text || ''}\n${options.url || ''}`;
      try {
        await navigator.clipboard.writeText(text.trim());
        alert('已复制到剪贴板');
        return true;
      } catch {
        return false;
      }
    }
  }

  const share = await loadSharePlugin();
  if (!share) return false;
  try {
    await share.share({
      title: options.title || '宝贝时光',
      text: options.text || '',
      url: options.url || '',
    });
    return true;
  } catch (e) {
    console.warn('[Native] 分享失败:', e);
    return false;
  }
}

// ==================== 导出全部能力 ====================

export default {
  isNativePlatform,
  convertFileSrc,
  takePhoto,
  requestAudioPermission,
  startRecording,
  stopRecording,
  shareContent,
};
