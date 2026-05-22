/**
 * 📦 Media Collector - 媒体文件收集器
 *
 * 集中管理导出时的媒体收集逻辑，不在各处散写
 * 解决："导出 ZIP 里只有 JSON 没有媒体文件"的问题
 */

import mediaRepository from '@repositories/mediaRepository';

/**
 * 收集一条动态的所有媒体文件
 */
export async function collectMomentMedia(moment) {
  const mediaFiles = [];

  try {
    // 收集照片
    if (moment.photos && moment.photos.length > 0) {
      for (const photo of moment.photos) {
        try {
          const photoPath = typeof photo === 'string' ? photo : photo.path;
          if (photoPath) {
            const blob = await mediaRepository.getMediaBlob(photoPath);
            if (blob) {
              mediaFiles.push({
                type: 'photo',
                path: photoPath,
                blob,
                momentId: moment.id
              });
            }
          }
        } catch (e) {
          console.warn(`收集照片失败: ${photo}`, e);
        }
      }
    }

    // 收集视频
    if (moment.videos && moment.videos.length > 0) {
      for (const video of moment.videos) {
        try {
          const videoPath = typeof video === 'string' ? video : video.path;
          if (videoPath) {
            const blob = await mediaRepository.getMediaBlob(videoPath);
            if (blob) {
              mediaFiles.push({
                type: 'video',
                path: videoPath,
                blob,
                momentId: moment.id
              });
            }
          }
        } catch (e) {
          console.warn(`收集视频失败: ${video}`, e);
        }
      }
    }

    // 收集音频
    if (moment.audios && moment.audios.length > 0) {
      for (const audio of moment.audios) {
        try {
          const audioPath = typeof audio === 'string' ? audio : audio.path;
          if (audioPath) {
            const blob = await mediaRepository.getMediaBlob(audioPath);
            if (blob) {
              mediaFiles.push({
                type: 'audio',
                path: audioPath,
                blob,
                momentId: moment.id
              });
            }
          }
        } catch (e) {
          console.warn(`收集音频失败: ${audio}`, e);
        }
      }
    }
  } catch (error) {
    console.error(`收集动态 ${moment.id} 媒体失败:`, error);
  }

  return mediaFiles;
}

/**
 * 批量收集所有动态的媒体
 */
export async function collectAllMomentsMedia(moments) {
  console.log(`[MediaCollector] 开始收集 ${moments.length} 条动态的媒体...`);

  const allMedia = [];
  let successCount = 0;
  let failCount = 0;

  for (const moment of moments) {
    const media = await collectMomentMedia(moment);
    if (media.length > 0) {
      allMedia.push(...media);
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`[MediaCollector] ✅ 收集完成: 共 ${allMedia.length} 个媒体文件`);

  return {
    mediaFiles: allMedia,
    stats: {
      totalMoments: moments.length,
      withMedia: successCount,
      withoutMedia: failCount,
      totalMedia: allMedia.length,
      photos: allMedia.filter(m => m.type === 'photo').length,
      videos: allMedia.filter(m => m.type === 'video').length,
      audios: allMedia.filter(m => m.type === 'audio').length
    }
  };
}

/**
 * 全量收集 - 导出时用
 */
export async function collectAllMediaForExport({ babies, moments, capsules }) {
  console.log('[MediaCollector] 🚀 开始全量媒体收集...');

  const results = {
    mediaFiles: [],
    stats: {
      total: 0,
      photos: 0,
      videos: 0,
      audios: 0,
      avatars: 0
    }
  };

  // 1. 收集宝宝头像
  if (babies && babies.length > 0) {
    for (const baby of babies) {
      if (baby.avatar) {
        try {
          const blob = await mediaRepository.getMediaBlob(baby.avatar);
          if (blob) {
            results.mediaFiles.push({
              type: 'avatar',
              path: baby.avatar,
              blob,
              babyId: baby.id
            });
            results.stats.avatars++;
          }
        } catch (e) {
          console.warn(`收集宝宝头像失败: ${baby.avatar}`, e);
        }
      }
    }
  }

  // 2. 收集动态媒体
  if (moments && moments.length > 0) {
    const momentsResult = await collectAllMomentsMedia(moments);
    results.mediaFiles.push(...momentsResult.mediaFiles);
    results.stats.photos += momentsResult.stats.photos;
    results.stats.videos += momentsResult.stats.videos;
    results.stats.audios += momentsResult.stats.audios;
  }

  results.stats.total = results.mediaFiles.length;

  console.log('[MediaCollector] ✅ 全量媒体收集完成:', results.stats);
  return results;
}

export default {
  collectMomentMedia,
  collectAllMomentsMedia,
  collectAllMediaForExport
};
