/**
 * Capacitor 桥接层 - 将Capacitor API封装成jsBridge兼容的接口
 * 
 * 功能：
 * 1. 检测是否在Capacitor APP环境
 * 2. 将Capacitor Filesystem API封装成jsBridge.fs兼容的接口
 * 3. 将Capacitor录音API封装成jsBridge.audioRecorder兼容的接口
 */

// 检测是否在Capacitor APP环境
export const isCapacitorApp = () => {
  return typeof window !== 'undefined' && 
         window.Capacitor && 
         typeof window.Capacitor.isNativePlatform === 'function' &&
         window.Capacitor.isNativePlatform();
};

// 动态导入Capacitor Filesystem插件
const getFilesystemPlugin = async () => {
  const capacitorModule = '@capacitor/filesystem';
  const { Filesystem, Directory } = await import(capacitorModule);
  return { Filesystem, Directory };
};

// ====== 文件系统 API - 兼容 jsBridge.fs 接口 ======

/**
 * 创建目录
 * @param {string} path 目录路径
 */
const mkdir = async (path) => {
  try {
    const { Filesystem, Directory } = await getFilesystemPlugin();
    await Filesystem.mkdir({
      path: path.replace('fs://', ''),
      directory: Directory.Data,
      recursive: true
    });
    return true;
  } catch (e) {
    // 目录可能已存在，忽略错误
    return true;
  }
};

/**
 * 检查文件/目录是否存在
 * @param {string} path 文件路径
 */
const exist = async (path) => {
  try {
    const { Filesystem, Directory } = await getFilesystemPlugin();
    await Filesystem.stat({
      path: path.replace('fs://', ''),
      directory: Directory.Data
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * 列出目录内容
 * @param {string} path 目录路径
 */
const list = async (path) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  const result = await Filesystem.readdir({
    path: path.replace('fs://', ''),
    directory: Directory.Data
  });
  return result.files;
};

/**
 * 获取文件大小
 * @param {string} path 文件路径
 */
const size = async (path) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  const result = await Filesystem.stat({
    path: path.replace('fs://', ''),
    directory: Directory.Data
  });
  return result.size;
};

/**
 * 删除文件/目录
 * @param {string} path 文件路径
 */
const deleteFile = async (path) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  try {
    await Filesystem.rm({
      path: path.replace('fs://', ''),
      directory: Directory.Data,
      recursive: true
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * 写入文本文件
 * @param {string} path 文件路径
 * @param {string} text 文本内容
 */
const writeText = async (path, text) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  await Filesystem.writeFile({
    path: path.replace('fs://', ''),
    data: text,
    directory: Directory.Data,
    recursive: true
  });
  return true;
};

/**
 * 追加文本文件
 * @param {string} path 文件路径
 * @param {string} text 文本内容
 */
const appendText = async (path, text) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  let existingText = '';
  try {
    const result = await Filesystem.readFile({
      path: path.replace('fs://', ''),
      directory: Directory.Data
    });
    existingText = result.data;
  } catch (e) {
    // 文件不存在，创建新文件
  }
  
  await Filesystem.writeFile({
    path: path.replace('fs://', ''),
    data: existingText + text,
    directory: Directory.Data,
    recursive: true
  });
  return true;
};

/**
 * 读取文本文件
 * @param {string} path 文件路径
 */
const readText = async (path) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  const result = await Filesystem.readFile({
    path: path.replace('fs://', ''),
    directory: Directory.Data
  });
  return result.data;
};

/**
 * 写入二进制文件 (Base64)
 * @param {string} path 文件路径
 * @param {string} base64 Base64编码的数据
 */
const writeBinary = async (path, base64) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  await Filesystem.writeFile({
    path: path.replace('fs://', ''),
    data: base64,
    directory: Directory.Data,
    recursive: true
  });
  return true;
};

/**
 * 读取二进制文件 (返回Base64)
 * @param {string} path 文件路径
 */
const readBinary = async (path) => {
  const { Filesystem, Directory } = await getFilesystemPlugin();
  const result = await Filesystem.readFile({
    path: path.replace('fs://', ''),
    directory: Directory.Data
  });
  return result.data;
};

/**
 * 分享文件 - 使用Capacitor Share插件
 * @param {string} path 文件路径
 * @param {Function} callback - 回调函数 (succ, msg)
 */
const share = async (path, callback) => {
  try {
    const { Share } = await import('@capacitor/share');
    const { Filesystem, Directory } = await getFilesystemPlugin();
    
    const result = await Filesystem.getUri({
      path: path.replace('fs://', ''),
      directory: Directory.Data
    });
    
    await Share.share({
      url: result.uri,
      title: '分享文件'
    });
    
    if (callback && typeof callback === 'function') {
      callback(true, '分享成功');
    }
    return { success: true };
  } catch (error) {
    console.error('[CapacitorBridge] 分享失败:', error);
    // 如果Share插件不可用，降级处理
    if (callback && typeof callback === 'function') {
      callback(false, error.message || '分享失败');
    }
    throw error;
  }
};

/**
 * 打开文件 - 使用Capacitor Browser或文件打开插件
 * @param {string} path 文件路径
 * @param {Function} callback - 回调函数 (succ, msg)
 */
const openFile = async (path, callback) => {
  try {
    const { Browser } = await import('@capacitor/browser');
    const { Filesystem, Directory } = await getFilesystemPlugin();
    
    const result = await Filesystem.getUri({
      path: path.replace('fs://', ''),
      directory: Directory.Data
    });
    
    await Browser.open({ url: result.uri });
    
    if (callback && typeof callback === 'function') {
      callback(true, '打开成功');
    }
    return { success: true };
  } catch (error) {
    console.error('[CapacitorBridge] 打开文件失败:', error);
    if (callback && typeof callback === 'function') {
      callback(false, error.message || '打开失败');
    }
    throw error;
  }
};

// ====== 录音 API - 兼容 jsBridge.audioRecorder 接口 ======

// 录音状态
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;

/**
 * 检查录音是否可用
 * Capacitor环境下使用Web Audio API（在webview中支持）
 */
const isAudioRecorderAvailable = () => {
  return isCapacitorApp() && 
         typeof navigator !== 'undefined' && 
         navigator.mediaDevices && 
         navigator.mediaDevices.getUserMedia;
};

/**
 * 开始录音
 */
const startRecord = async (options = {}, callback) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingStartTime = Date.now();
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      if (callback && typeof callback === 'function') {
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        callback(true, { duration });
      }
    };
    
    mediaRecorder.start();
    return true;
  } catch (error) {
    console.error('[CapacitorBridge] 开始录音失败:', error);
    if (callback && typeof callback === 'function') {
      callback(false, { message: error.message });
    }
    throw error;
  }
};

/**
 * 停止录音
 */
const stopRecord = async (callback) => {
  if (!mediaRecorder) {
    if (callback && typeof callback === 'function') {
      callback(true, { duration: 0 });
    }
    return;
  }
  
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
};

/**
 * 读取录音数据
 */
const readRecord = async (callback) => {
  if (audioChunks.length === 0) {
    if (callback && typeof callback === 'function') {
      callback('');
    }
    return;
  }
  
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  
  reader.onload = () => {
    if (callback && typeof callback === 'function') {
      callback(reader.result);
    }
  };
  
  reader.readAsDataURL(audioBlob);
};

// 设置监听器的占位实现
const setAudioListener = () => {
  // Capacitor环境下不需要原生监听器，使用Web API直接控制
};

// ====== 导出 ======

export const capacitorFS = {
  mkdir,
  exist,
  list,
  size,
  delete: deleteFile,
  writeText,
  appendText,
  readText,
  writeBinary,
  readBinary,
  share,
  open: openFile
};

export const capacitorAudioRecorder = {
  isAvailable: isAudioRecorderAvailable,
  setListener: setAudioListener,
  startRecord,
  stopRecord,
  read: readRecord
};

/**
 * 初始化Capacitor桥接 - 将Capacitor API挂载到window.jsBridge
 * 这样现有代码不需要修改就能在Capacitor环境下运行
 */
export const initCapacitorBridge = async () => {
  if (!isCapacitorApp()) {
    console.log('[CapacitorBridge] 非Capacitor环境，跳过初始化');
    return false;
  }
  
  console.log('[CapacitorBridge] 检测到Capacitor环境，初始化桥接层...');
  
  // 检查是否已经初始化过
  if (window.jsBridge && window.jsBridge.isCapacitorBridge) {
    console.log('[CapacitorBridge] 桥接层已初始化，跳过');
    return true;
  }
  
  // 创建window.jsBridge对象，兼容现有代码
  window.jsBridge = {
    inApp: true,
    isCapacitorBridge: true,
    isReady: () => true,
    ready: (callback) => callback && callback(),
    fs: capacitorFS,
    audioRecorder: capacitorAudioRecorder
  };
  
  console.log('[CapacitorBridge] 桥接层初始化完成');
  return true;
};

export default {
  isCapacitorApp,
  initCapacitorBridge,
  fs: capacitorFS,
  audioRecorder: capacitorAudioRecorder
};
