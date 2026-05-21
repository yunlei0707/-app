import { processVideos } from './mediaService.js';
import { createZip } from '../adapters/zipAdapter.js';
import { exportAllData as exportDBData } from '../utils/db.js';
import { exportV2AccountData } from '../utils/dbV2.js';
import { BASE_DIR } from '../constants/storage.js';
import { getVideoBlob } from '../adapters/storageAdapter.js';

export async function exportAllData(options = {}) {
  const { includeVideos = false, onProgress = null, signal = null } = options;
  const start = Date.now();

  // 1. 读取最新数据（直接从存储，不依赖缓存）
  const data = await getAllMomentsFromDB();
  const videos = extractVideosFromData(data);

  // 2. 处理视频（串行读取 Blob）
  let videoResults = [];
  let failedVideos = [];

  console.log('[Export] includeVideos:', includeVideos, 'videos count:', videos.length);

  if (includeVideos && videos.length > 0) {
    console.log('[Export] 开始处理视频，共', videos.length, '个');
    for (const v of videos) {
      try {
        console.log('[Export] 读取视频:', v.path);
        const blob = await getVideoBlob(v.path);
        console.log('[Export] 读取成功，大小:', blob.size);
        videoResults.push({ ...v, blob });
      } catch (e) {
        console.error('[Export] 读取视频失败:', v.path, e.message);
        failedVideos.push({ ...v, error: e.message });
      }
    }
    console.log('[Export] 视频处理完成，成功:', videoResults.length, '失败:', failedVideos.length);
  }

  // 3. 创建 ZIP 并写入文件
  const zip = createZip();
  const fileMap = {};

  // 写入视频文件
  for (const video of videoResults) {
    zip.addFile(`videos/${video.fileName}`, video.blob);
    fileMap[video.id] = {
      fileName: video.fileName,
      originalName: video.originalName,
      fileSize: video.blob.size
    };
  }

  // 4. 写入 JSON 数据
  data.fileMap = fileMap;
  data.exportVersion = '2.1.0';
  data.schemaVersion = 1;

  zip.addFile(
    'data.json',
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );

  // 5. 生成 ZIP Blob
  const zipBlob = await zip.generate(onProgress);

  // 6. 保存到本地 Documents
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const zipFilename = `baby_backup_${timestamp}.zip`;
  const zipFilePath = `${BASE_DIR}/${zipFilename}`;

  await saveToLocal(zipBlob, zipFilePath, zipFilename);

  // 返回结果（兼容 ProfilePage 判断逻辑）
  return {
    success: true,
    filePath: zipFilePath,
    fileName: zipFilename,
    filename: zipFilename,
    fileSize: zipBlob.size,
    isNative: true,
    blob: zipBlob,
    report: {
      duration: Date.now() - start,
      totalVideos: videos.length,
      successVideos: videoResults.length,
      failedVideos
    }
  };
}

async function getAllMomentsFromDB() {
  const [idbData, v2Data] = await Promise.all([
    exportDBData().catch(() => null),
    exportV2AccountData()
  ]);

  return {
    ...(idbData?.data || {}),
    ...(idbData || {}),
    v2AccountData: v2Data,
    exportTime: new Date().toISOString()
  };
}

function extractVideosFromData(data) {
  const videos = [];
  const seen = new Set();

  function addVideos(m) {
    if (!m?.videos) return;
    for (const v of m.videos) {
      const path = v.opfsPath || v.filename || v.url;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      videos.push({
        id: m.id || `vid_${videos.length}`,
        path,
        fileName: v.filename || v.opfsPath || `video_${videos.length}.mp4`,
        originalName: v.filename,
        momentId: m.id
      });
    }
  }

  if (data.v2AccountData?.timeline) data.v2AccountData.timeline.forEach(addVideos);
  if (data.data?.moments) data.data.moments.forEach(addVideos);
  if (data.moments) data.moments.forEach(addVideos);

  return videos;
}

async function saveToLocal(blob, path, filename) {
  const fsModule = await loadFilesystem();
  const base64 = await blobToBase64(blob);
  const fullPath = `BabyTimeBackup/${filename}`;
  
  const result = await fsModule.Filesystem.writeFile({
    path: fullPath,
    data: base64,
    directory: fsModule.Directory.Documents,
    recursive: true
  });
  
  // 返回 ProfilePage 期望的 fs:// 格式路径
  return result.uri || `fs://file/BabyTimeBackup/${filename}`;
}

async function loadFilesystem() {
  const mod = window.Capacitor?.Plugins?.Filesystem;
  const Filesystem = mod?.Filesystem || mod.default?.Filesystem || mod;
  const Directory = mod?.Directory || mod.default?.Directory || {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
    Cache: 'CACHE'
  };
  return { Filesystem, Directory };
}

function blobToBase64(blob) {
  return new Promise((r, j) => {
    const f = new FileReader();
    f.onloadend = () => r(f.result);
    f.onerror = j;
    f.readAsDataURL(blob);
  });
}

// 兼容旧代码
export function exportAllDataWithVideos(opts) {
  return exportAllData({ ...opts, includeVideos: true });
}

// 兼容 zipExport.js 的导出
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

export function isNativePlatform() {
  return !!window.Capacitor;
}

export default { exportAllData, exportAllDataWithVideos, triggerDownload, isNativePlatform };
