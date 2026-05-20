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
  if (VoiceRecorderModule) {
    console.log('[Native] 录音插件已缓存，直接返回');
    return VoiceRecorderModule;
  }
  try {
    console.log('[Native] 开始加载录音插件...');
    const module = await import('capacitor-voice-recorder');
    console.log('[Native] 录音插件module keys:', Object.keys(module));
    
    // 兼容不同的导出方式
    VoiceRecorderModule = module.VoiceRecorder || module.default || module;
    console.log('[Native] 录音插件加载结果:', {
      hasModule: !!VoiceRecorderModule,
      hasStartRecording: !!VoiceRecorderModule?.startRecording,
      hasRequestPermission: !!VoiceRecorderModule?.requestAudioRecordingPermission,
      hasHasPermission: !!VoiceRecorderModule?.hasAudioRecordingPermission,
    });
    return VoiceRecorderModule;
  } catch (e) {
    console.error('[Native] ❌ 录音插件加载失败:', e);
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
  console.log('[Native] 开始请求录音权限');
  
  if (!isNativePlatform()) {
    console.log('[Native] 不是原生环境，跳过权限请求');
    return true;
  }
  
  try {
    const recorder = await loadVoiceRecorder();
    if (!recorder) {
      console.error('[Native] ❌ 录音插件未加载，无法请求权限');
      return false;
    }
    
    console.log('[Native] 检查录音权限...');
    const hasPermission = await recorder.hasAudioRecordingPermission();
    console.log('[Native] 当前录音权限状态:', hasPermission);
    
    if (!hasPermission.value) {
      console.log('[Native] 权限未授予，开始请求权限...');
      const result = await recorder.requestAudioRecordingPermission();
      console.log('[Native] 请求权限结果:', result);
      return result.value === 'granted' || result.value === true;
    }
    console.log('[Native] ✅ 已有录音权限');
    return true;
  } catch (e) {
    console.error('[Native] ❌ 请求录音权限异常:', e);
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
  if (!cameraModule) throw new Error('相机插件不可用');

  // 兼容不同的导出方式
  const CameraAPI = cameraModule.Camera || cameraModule.default || cameraModule;
  
  console.log('[Native] 调用相机选择器');
  const photo = await CameraAPI.getPhoto({
    quality: options.quality || 85,
    resultType: 'uri',
    source: options.source || (cameraModule.CameraSource?.Prompt || 'PROMPT'),
    width: options.width || 1920,
    height: options.height || 1920,
    correctOrientation: true,
  });

  console.log('[Native] 拍照完成:', photo.webPath || photo.path);
  return photo.webPath || photo.path || photo.uri;
}

// ==================== 录音能力 ====================

export async function startRecording() {
  console.log('[Native] ========= startRecording 被调用 ========');
  window.alert('📻 native.js: startRecording 开始执行');
  
  if (!isNativePlatform()) {
    window.alert('📻 native.js: 不是原生环境，尝试Web录音');
    console.log('[Native] 不是原生环境，尝试Web录音');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      window._mediaRecorder = new MediaRecorder(stream);
      window._audioChunks = [];
      window._mediaRecorder.ondataavailable = (e) => window._audioChunks.push(e.data);
      window._mediaRecorder.start();
      console.log('[Native] Web录音启动成功');
      window.alert('📻 native.js: Web录音启动成功');
      return true;
    } catch (e) {
      console.error('[Native] Web录音失败:', e);
      window.alert('📻 native.js: Web录音失败: ' + e.message);
      throw new Error('麦克风权限被拒绝');
    }
  }

  window.alert('📻 native.js: 开始原生录音流程');
  console.log('[Native] 开始原生录音流程');
  
  // ✅ 先请求权限
  window.alert('📻 native.js: 开始请求录音权限');
  const hasPermission = await requestAudioPermission();
  window.alert('📻 native.js: 权限请求结果: ' + hasPermission);
  
  if (!hasPermission) {
    throw new Error('请授予录音权限后重试');
  }

  window.alert('📻 native.js: 开始加载录音插件');
  const recorder = await loadVoiceRecorder();
  window.alert('📻 native.js: 插件加载结果: ' + (recorder ? '成功' : '失败'));
  
  if (!recorder) {
    throw new Error('录音插件不可用');
  }

  window.alert('📻 native.js: 调用 recorder.startRecording()');
  console.log('[Native] 调用startRecording()');
  try {
    await recorder.startRecording();
    console.log('[Native] ✅ 录音已启动');
    window.alert('📻 native.js: ✅ recorder.startRecording() 成功');
    return true;
  } catch (e) {
    console.error('[Native] ❌ 启动录音异常:', e);
    window.alert('📻 native.js: ❌ 启动录音失败: ' + e.message);
    throw e;
  }
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
