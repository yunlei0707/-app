/**
 * 视频迁移进度组件
 * 将base64视频迁移到OPFS存储
 */

import { useState, useEffect } from 'react';
import { saveVideoToOPFS } from '@utils/opfs';
import { formatBytes } from '@utils/storageCheck';

export function MigrationProgress({ moments, onComplete, onClose }) {
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const [migratedCount, setMigratedCount] = useState(0);
  const [savedSize, setSavedSize] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState(null);

  // 从localStorage恢复迁移进度
  useEffect(() => {
    const saved = localStorage.getItem('migrationProgress');
    if (saved) {
      const data = JSON.parse(saved);
      setMigratedCount(data.migratedCount || 0);
      setSavedSize(data.savedSize || 0);
    }
  }, []);

  // 保存迁移进度到localStorage
  const saveProgress = (count, size) => {
    localStorage.setItem('migrationProgress', JSON.stringify({
      migratedCount: count,
      savedSize: size,
    }));
  };

  // base64转File对象
  const base64ToFile = async (base64, filename) => {
    const response = await fetch(base64);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  // 开始迁移
  const startMigration = async () => {
    setIsRunning(true);
    setError(null);

    // 筛选出需要迁移的视频（有url但没有filename的）
    const videosToMigrate = [];
    for (const moment of moments) {
      if (moment.videos && Array.isArray(moment.videos)) {
        for (let i = 0; i < moment.videos.length; i++) {
          const video = moment.videos[i];
          if (video.url && !video.filename) {
            videosToMigrate.push({
              moment,
              videoIndex: i,
              video,
            });
          }
        }
      }
    }

    const total = videosToMigrate.length;
    let completed = 0;

    for (const item of videosToMigrate) {
      if (isPaused) {
        break;
      }

      try {
        setCurrentItem(`正在处理: ${item.moment.content?.substring(0, 20) || '无标题'}...`);

        // base64转File
        const file = await base64ToFile(
          item.video.url,
          `video_${item.moment.id}_${item.videoIndex}.mp4`
        );

        // 保存到OPFS
        const { filename } = await saveVideoToOPFS(file);

        // 更新moment数据
        item.moment.videos[item.videoIndex] = {
          ...item.video,
          filename,
          size: file.size,
          url: null, // 清除base64
        };

        // 计算节省的空间（base64比原文件大33%）
        const base64Size = item.video.url.length * 3 / 4;
        const saving = base64Size - file.size;

        completed++;
        const newCount = migratedCount + 1;
        const newSize = savedSize + saving;

        setMigratedCount(newCount);
        setSavedSize(newSize);
        setProgress(Math.floor((completed / total) * 100));
        saveProgress(newCount, newSize);

        // 让出主线程
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (e) {
        console.error('迁移视频失败:', e);
        // 单个视频失败不影响整体，继续下一个
      }
    }

    setIsRunning(false);
    setCurrentItem('');

    if (!isPaused && onComplete) {
      onComplete(moments);
      // 迁移完成，清除进度记录
      localStorage.removeItem('migrationProgress');
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    startMigration();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4">存储优化</h3>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>正在将视频从Base64编码迁移到文件系统存储...</p>
            <p className="mt-2">此操作可以减少约33%的存储空间占用。</p>
          </div>

          {/* 进度条 */}
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-500 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm text-center">{progress}%</p>

          {/* 当前处理项 */}
          {currentItem && (
            <p className="text-sm text-gray-500 truncate">{currentItem}</p>
          )}

          {/* 统计信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-gray-500">已迁移</p>
              <p className="text-lg font-bold">{migratedCount} 个视频</p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <p className="text-gray-500">已节省空间</p>
              <p className="text-lg font-bold text-green-600">
                {formatBytes(savedSize)}
              </p>
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            {!isRunning && !isPaused && (
              <button
                onClick={startMigration}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
              >
                开始迁移
              </button>
            )}

            {isRunning && (
              <button
                onClick={handlePause}
                className="flex-1 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600"
              >
                暂停
              </button>
            )}

            {isPaused && (
              <button
                onClick={handleResume}
                className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
              >
                继续
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MigrationProgress;
