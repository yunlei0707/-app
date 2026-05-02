/**
 * 音乐播放器组件
 * 右下角悬浮圆形唱片播放器，支持展开/收起
 */

import { useRef, useState, useEffect } from 'react';
import { useMusic } from '../store/MusicContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, Plus, ChevronUp, ChevronDown, Disc3 } from 'lucide-react';

export function MusicPlayer() {
  const {
    playlist,
    currentIndex,
    currentMusic,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    isExpanded,
    localFile,
    hasUserInteracted,
    togglePlay,
    handlePrevious,
    handleNext,
    addLocalMusic,
    setVolume,
    toggleMute,
    setIsExpanded,
    formatTime,
    progress,
    selectMusic,
  } = useMusic();

  const fileInputRef = useRef(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [localBodyOverflow, setLocalBodyOverflow] = useState('');

  // 处理本地文件选择
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      addLocalMusic(file);
    }
  };

  // 切换展开/收起
  const toggleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (!newExpanded) {
      setShowPlaylist(false);
    }
  };

  // 展开/收起时控制body滚动
  useEffect(() => {
    if (isExpanded) {
      // 记录当前滚动位置
      setLocalBodyOverflow(document.body.style.overflow);
      // 禁止滚动
      document.body.style.overflow = 'hidden';
    } else {
      // 恢复滚动
      document.body.style.overflow = localBodyOverflow || '';
    }
    
    return () => {
      document.body.style.overflow = localBodyOverflow || '';
    };
  }, [isExpanded, localBodyOverflow]);

  // 进度条点击
  const handleProgressClick = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    // 音频seek功能需要通过ref访问
    const audio = document.querySelector('audio');
    if (audio) {
      audio.currentTime = percent * duration;
    }
  };

  // 播放列表项点击
  const handlePlaylistItemClick = (index) => {
    selectMusic(index);
  };

  // 如果没有音乐且没有本地文件，不显示播放器
  if (!currentMusic && !localFile) {
    return null;
  }

  const displayMusic = localFile 
    ? { 
        title: localFile.name.replace(/\.[^/.]+$/, ''), 
        artist: '本地音乐', 
        cover: '📁' 
      }
    : currentMusic;

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        id="local-music-input"
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 展开状态：完整播放器 - 固定宽度，居中显示 */}
      {isExpanded ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-80 overflow-hidden animate-scale-in border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col">
          {/* 顶部栏 */}
          <div className="bg-gradient-to-r from-primary-400 to-primary-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-white">
              <Disc3 className="w-5 h-5 animate-spin" style={{ animationDuration: '3s', animationPlayState: isPlaying ? 'running' : 'paused' }} />
              <span className="font-medium text-sm">背景音乐</span>
            </div>
            <button
              onClick={toggleExpand}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronDown className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* 唱片区域 */}
          <div className="flex flex-col items-center py-6 px-4 flex-shrink-0">
            {/* 旋转唱片 */}
            <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center shadow-lg mb-4 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
              <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center">
                  <span className="text-4xl">{displayMusic?.cover || '🎵'}</span>
                </div>
              </div>
            </div>

            {/* 曲目信息 */}
            <h3 className="font-bold text-gray-800 dark:text-white text-center">{displayMusic?.title || '未知曲目'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{displayMusic?.artist || '未知艺术家'}</p>
          </div>

          {/* 进度条 */}
          <div className="px-4 mb-2 flex-shrink-0">
            <div 
              className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-primary-400 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 控制按钮 - 只保留播放按钮，移除上下曲 */}
          <div className="flex items-center justify-center gap-6 px-4 pb-4 flex-shrink-0">
            <button
              onClick={handlePrevious}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors"
            >
              <SkipBack className="w-6 h-6" />
            </button>
            
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </button>
            
            <button
              onClick={handleNext}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* 音量控制 */}
          <div className="px-4 pb-4 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={toggleMute}
              className="p-1 text-gray-500 dark:text-gray-400"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500"
            />
          </div>

          {/* 播放列表 - 可滚动 */}
          <div className="border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div 
              className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => setShowPlaylist(!showPlaylist)}
            >
              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Music className="w-4 h-4" />
                播放列表 ({playlist.length})
              </span>
              <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${showPlaylist ? '' : 'rotate-180'}`} />
            </div>
            
            {showPlaylist && (
              <div className="max-h-48 overflow-y-auto">
                {playlist.map((music, index) => (
                  <div
                    key={music.id}
                    onClick={() => handlePlaylistItemClick(index)}
                    className={`px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      index === currentIndex ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                    }`}
                  >
                    <span className="text-lg">{music.cover}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{music.title}</p>
                      <p className="text-xs text-gray-400 truncate">{music.artist}</p>
                    </div>
                    {index === currentIndex && isPlaying && (
                      <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 添加本地音乐按钮 */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-2 hover:border-primary-400 hover:text-primary-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加本地音乐
            </button>
          </div>
        </div>
      ) : (
        /* 收起状态：迷你播放器 - 简化版，只保留唱片+播放按钮+展开按钮 */
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full shadow-2xl pl-1 pr-2 py-1 border border-gray-100 dark:border-gray-700">
          {/* 旋转唱片 - 点击可展开 */}
          <button
            onClick={toggleExpand}
            className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-500 flex items-center justify-center shadow-md ${
              isPlaying ? 'animate-spin' : ''
            }`}
            style={{ animationDuration: '8s' }}
          >
            <span className="text-xl">{displayMusic?.cover || '🎵'}</span>
          </button>

          {/* 播放/暂停按钮 */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-md hover:bg-primary-600 transition-colors active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* 曲目名称 */}
          <div className="max-w-[80px]">
            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{displayMusic?.title || '未知'}</p>
          </div>

          {/* 展开按钮 */}
          <button
            onClick={toggleExpand}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default MusicPlayer;
