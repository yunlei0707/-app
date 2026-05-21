import { unzip } from '../adapters/zipAdapter.js';
import { saveVideoBlob } from '../adapters/storageAdapter.js';
import { restoreMoments } from './restoreService.js';
import { importV2AccountData } from '../utils/dbV2.js';

export async function importAllData(options = {}) {
  const { zipFile, mode = 'merge', onProgress = null, signal = null } = options;
  const start = Date.now();

  // 1. 解压 ZIP
  const zip = await unzip(zipFile);

  // 2. 读取 JSON 数据
  const data = await zip.getJSON('data.json');
  const { moments, fileMap, v2AccountData } = data;

  // 3. 恢复视频文件
  let restoredVideos = 0;
  let failedVideos = [];
  const totalVideos = Object.keys(fileMap || {}).length;
  let processed = 0;

  for (const [id, fileInfo] of Object.entries(fileMap || {})) {
    try {
      const blob = await zip.getBlob(`videos/${fileInfo.fileName}`);
      if (!blob || blob.size === 0) {
        failedVideos.push({ id, error: '视频缺失' });
        continue;
      }

      const localPath = `videos/${Date.now()}_${fileInfo.fileName}`;
      await saveVideoBlob(localPath, blob);

      // 更新动态中的视频路径
      updateMomentVideoPath(moments, id, localPath);
      restoredVideos++;
    } catch (e) {
      failedVideos.push({ id, error: e.message });
    }

    // 每处理 5 个让出主线程，防止 ANR
    processed++;
    if (processed % 5 === 0) {
      await new Promise(r => setTimeout(r, 30));
    }

    if (onProgress) {
      onProgress({ step: 'videos', progress: Math.floor((processed / totalVideos) * 100) });
    }
  }

  // 4. 恢复数据
  if (v2AccountData) {
    await importV2AccountData(v2AccountData, mode);
  } else if (moments && moments.length > 0) {
    await restoreMoments(moments, { mode });
  }

  return {
    success: true,
    totalVideos,
    restoredVideos,
    failedVideos,
    duration: Date.now() - start,
    mode
  };
}

function updateMomentVideoPath(moments, id, newPath) {
  if (!Array.isArray(moments)) return;
  for (const m of moments) {
    for (const v of m.videos || []) {
      if (v.id === id || v.filename === id || v.path === id) {
        v.path = v.opfsPath = newPath;
      }
    }
  }
}

export default { importAllData };
