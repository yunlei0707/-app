/**
 * ✅ 生产级：Capacitor 原生能力统一封装层
 * 封装相机、文件系统、分享、录音等原生能力
 * 提供 Web 端降级实现（开发环境）
 */

// 从window对象安全检测Capacitor，避免直接import导致Web环境崩溃
function getCapacitor() {
  try {
    return window.Capacitor;
  } catch (e) {
    return null;
  }
}

// 检查是否在原生环境运行
const Capacitor = getCapacitor();
export const isNativePlatform = Capacitor?.isNativePlatform?.() || false;

/**
 * 转换文件路径为 Web 可访问路径
 * @param {string} filePath - 原生文件路径
 * @returns {string} Web 可访问路径
 */
export function convertFileSrc(filePath) {
  if (!filePath) return '';
  // 如果已经是 http/https 或 base64，直接返回
  if (filePath.startsWith('http') || filePath.startsWith('data:')) {
    return filePath;
  }
  return Capacitor.convertFileSrc(filePath);
}

// ==================== 相机/相册能力 ====================

let Camera = null;
let Filesystem = null;

// 懒加载 Capacitor 插件
let CameraSource = null;

async function loadCameraPlugin() {
  if (!isNativePlatform) return null;
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
  if (!isNativePlatform) return null;
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
 * @param {Object} options - 选项
 * @returns {Promise<string>} 文件 URI
 */
export async function takePhoto(options = {}) {
  // Web 端降级实现
  if (!isNativePlatform) {
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
    resultType: 'uri',  // 返回URI而不是base64，减少内存
    source: options.source || CameraSource.Prompt,
    width: options.width || 1920,
    height: options.height || 1920,
    correctOrientation: true,
  });
  
  // 返回文件路径（Capacitor会自动处理临时文件）
  return photo.webPath || photo.path || photo.uri;
}

// ==================== 录音能力 ====================

let VoiceRecorder = null;
let isRecording = false;

async function loadVoiceRecorderPlugin() {
  if (!isNativePlatform) return null;
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

/**
 * 检查录音权限状态
 */
export async function checkAudioPermission() {
  if (!isNativePlatform) {
    return true; // Web环境在调用时才检查
  }
  
  const recorder = await loadVoiceRecorderPlugin();
  if (!recorder) return false;
  
  try {
    const result = await recorder.checkPermissions();
    return result.value?.audio_recording === 'granted' || result.value?.audio_recording === true;
  } catch (e) {
    console.warn('[Native] 检查录音权限失败:', e);
    return false;
  }
}

/**
 * 请求录音权限
 */
export async function requestAudioPermission() {
  if (!isNativePlatform) {
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
    // 先检查当前权限状态
    const hasPermission = await checkAudioPermission();
    if (hasPermission) return true;
    
    // 请求权限
    const result = await recorder.requestAudioRecordingPermission();
    return result.value === 'granted' || result.value === true;
  } catch (e) {
    console.warn('[Native] 请求录音权限失败:', e);
    // 即使权限检查失败也继续尝试（某些设备可能绕过了权限检查）
    return true;
  }
}

/**
 * 开始录音
 */
export async function startRecording() {
  if (!isNativePlatform) {
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
      console.error('[Native] Web 录音失败:', e);
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
    // 如果是权限相关错误，给出更友好的提示
    if (e.message?.includes('permission') || e.message?.includes('Permission')) {
      throw new Error('请在应用设置中允许录音权限');
    }
    throw e;
  }
}

/**
 * 停止录音
 */
export async function stopRecording() {
  if (!isRecording) return null;
  
  if (!isNativePlatform) {
    return new Promise((resolve) => {
      window._mediaRecorder.onstop = () => {
        const blob = new Blob(window._audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        isRecording = false;
        resolve({
          uri: url,
          duration: 0,
          size: blob.size,
          mimeType: 'audio/webm'
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
  if (filesystem && result.value?.recordDataBase64) {
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
      mimeType: result.value.mimeType || 'audio/m4a'
    };
  }
  
  return null;
}

// ==================== 分享能力 ====================

let Share = null;

async function loadSharePlugin() {
  if (!isNativePlatform) return null;
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

/**
 * 分享内容
 * @param {Object} options - 分享选项
 */
export async function shareContent(options = {}) {
  if (!isNativePlatform) {
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
