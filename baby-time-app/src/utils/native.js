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
    // 兼容不同的导出方式：module.VoiceRecorder / module.default / module
    VoiceRecorderModule = module.VoiceRecorder || module.default || module;
    console.log('[Native] 录音插件加载成功:', !!VoiceRecorderModule);
    return VoiceRecorderModule;
  } catch (e) {
    console.warn('[Native] VoiceRecorder plugin not available:', e);
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
    const recorder = await loadVoiceRecorder();
    if (!recorder) {
      console.error('[Native] 录音插件未加载');
      return false;
    }
    
    console.log('[Native] 检查录音权限');
    const hasPermission = await recorder.hasAudioRecordingPermission();
    console.log('[Native] 当前录音权限:', hasPermission.value);
    
    if (!hasPermission.value) {
      const result = await recorder.requestAudioRecordingPermission();
      console.log('[Native] 请求录音权限结果:', result.value);
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

  console.log('[Native] 开始拍照流程');
  
  // ✅ 先请求权限（核心修复：确保"每次询问"也能弹窗）
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('请授予相机权限后重试');
  }

  const cameraModule = await loadCamera();
  const filesystemModule = await loadFilesystem();
  if (!cameraModule) throw new Error('相机插件不可用');
  if (!filesystemModule) throw new Error('文件系统插件不可用');

  // 兼容不同的导出方式
  const CameraAPI = cameraModule.Camera || cameraModule.default || cameraModule;
  const { Filesystem, Directory } = filesystemModule;
  
  console.log('[Native] 调用相机选择器');
  const photo = await CameraAPI.getPhoto({
    quality: options.quality || 85,
    resultType: 'base64',
    source: options.source || (cameraModule.CameraSource?.Prompt || 'PROMPT'),
    width: options.width || 1920,
    height: options.height || 1920,
    correctOrientation: true,
  });

  console.log('[Native] 拍照完成，开始保存到 BabyTime/photos/ 目录');
  
  // 生成唯一文件名
  const ext = photo.format || 'jpeg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  
  // 写入APP文件系统
  await Filesystem.writeFile({
    path: `BabyTime/photos/${filename}`,
    data: photo.base64String,
    directory: Directory.Documents,
    recursive: true,
  });
  
  console.log('[Native] 照片保存成功:', filename);
  
  // 返回完整的文件信息对象
  return {
    filename,
    name: `photo_${Date.now()}.${ext}`,
    size: Math.round(photo.base64String.length * 0.75), // base64粗略估算
    type: `image/${ext}`,
    storageType: 'native',
    displayURL: photo.webPath || photo.path || photo.uri,
  };
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

  console.log('[Native] 开始录音流程');
  
  // ✅ 先请求权限
  const hasPermission = await requestAudioPermission();
  if (!hasPermission) {
    throw new Error('请授予录音权限后重试');
  }

  const recorder = await loadVoiceRecorder();
  if (!recorder) {
    throw new Error('录音插件不可用');
  }

  console.log('[Native] 启动录音');
  await recorder.startRecording();
  console.log('[Native] 录音已启动');
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

  const recorder = await loadVoiceRecorder();
  if (!recorder) {
    throw new Error('录音插件不可用');
  }

  console.log('[Native] 停止录音');
  const result = await recorder.stopRecording();
  console.log('[Native] 录音结果:', result.value ? '有数据' : '无数据');
  
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

  const shareModule = await loadShare();
  if (!shareModule) return false;

  // 兼容不同的导出方式
  const ShareAPI = shareModule.Share || shareModule.default || shareModule;
  await ShareAPI.share({
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

  const FilesystemModule = await loadFilesystem();
  if (!FilesystemModule) throw new Error('文件系统不可用');
  const { Filesystem, Directory } = FilesystemModule;

  return await Filesystem.writeFile({
    path,
    data,
    directory: Directory[directory],
    recursive: true,
  });
}

export async function readFile(path, directory = 'Documents') {
  if (!isNativePlatform()) {
    return localStorage.getItem(`file_${path}`) || '';
  }

  const FilesystemModule = await loadFilesystem();
  if (!FilesystemModule) throw new Error('文件系统不可用');
  const { Filesystem, Directory } = FilesystemModule;

  const result = await Filesystem.readFile({
    path,
    directory: Directory[directory],
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
