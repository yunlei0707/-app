/**
 * 音乐播放器组件
 * 折叠卡片式，在"我的"页面显示，点击可全屏展开
 */

import { useRef, useState } from 'react';
import { useMusic } from '../store/MusicContext';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Music, Plus, ChevronUp, ChevronDown, Disc3, X, 
  Minimize2, Maximize2 
} from 'lucide-react';

export function MusicPlayer({ compact = false }) {
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
  } = useMusic();

  const fileInputRef = useRef(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 处理本地文件选择
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      addLocalMusic(file);
    }
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 进度条点击
  const handleProgressClick = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const audio = document.querySelector('audio');
    if (audio) {
      audio.currentTime = percent * duration;
    }
  };

  // 播放列表项点击
  const handlePlaylistItemClick = (index) => {
    window.dispatchEvent(new CustomEvent('musicSelect', { detail: { index } }));
  };

  // 如果没有音乐且没有本地文件，在紧凑模式显示提示
  if (!currentMusic && !localFile && compact) {
    return (
      <div 
        className="bg-gradient-to-r from-primary-50 to-warm-50 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <Music className="w-6 h-6 text-primary-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-800">背景音乐</h3>
            <p className="text-sm text-gray-500">点击添加音乐，记录美好时光</p>
          </div>
          <ChevronUp className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }

  const displayMusic = localFile 
    ? { 
        title: localFile.name.replace(/\.[^/.]+$/, ''), 
        artist: '本地音乐', 
        cover: '📁' 
      }
    : currentMusic;

  // ========== 紧凑模式（我的页面折叠卡片） ==========
  if (compact && !isFullscreen) {
    return (
      <div 
        className="bg-gradient-to-r from-primary-50 to-warm-50 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all"
        onClick={toggleFullscreen}
      >
        <div className="flex items-center gap-3">
          {/* 旋转唱片 */}
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-500 flex items-center justify-center shadow ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
            <span className="text-xl">{displayMusic?.cover || '🎵'}</span>
          </div>
          
          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-800 truncate">
              {displayMusic?.title || '选择音乐'}
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {displayMusic?.artist || '点击展开播放器'}
            </p>
          </div>
          
          {/* 播放控制 */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center shadow hover:bg-primary-600 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <Maximize2 className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        {/* 迷你进度条 */}
        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ========== 全屏模式 ==========
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* 背景遮罩 */}
      {isFullscreen && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100 via-white to-warm-100" />
      )}
      
      <div className={`relative ${isFullscreen ? 'h-full flex flex-col' : ''}`}>
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          id="local-music-input"
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* 顶部栏 - 全屏模式显示 */}
        {isFullscreen && (
          <div className="bg-gradient-to-r from-primary-400 to-primary-500 px-4 py-4 flex items-center justify-between safe-top">
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 text-white">
              <Disc3 className="w-6 h-6 animate-spin" style={{ animationDuration: '3s', animationPlayState: isPlaying ? 'running' : 'paused' }} />
              <span className="font-medium text-lg">背景音乐</span>
            </div>
            <div className="w-10" /> {/* 占位，保持居中 */}
          </div>
        )}

        {/* 唱片区域 - 全屏时放大 */}
        <div className={`flex flex-col items-center ${isFullscreen ? 'py-12 flex-1 justify-center' : 'py-6 px-4'}`}>
          {/* 旋转唱片 */}
          <div className={`${isFullscreen ? 'w-56 h-56' : 'w-32 h-32'} rounded-full bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center shadow-lg mb-6 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
            <div className={`${isFullscreen ? 'w-44 h-44' : 'w-24 h-24'} rounded-full bg-white/20 flex items-center justify-center`}>
              <div className={`${isFullscreen ? 'w-32 h-32' : 'w-16 h-16'} rounded-full bg-white/30 flex items-center justify-center`}>
                <span className={isFullscreen ? 'text-6xl' : 'text-4xl'}>{displayMusic?.cover || '🎵'}</span>
              </div>
            </div>
          </div>

          {/* 曲目信息 */}
          <h3 className={`font-bold text-gray-800 text-center ${isFullscreen ? 'text-2xl mb-2' : ''}`}>
            {displayMusic?.title || '未知曲目'}
          </h3>
          <p className={`text-gray-500 ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
            {displayMusic?.artist || '未知艺术家'}
          </p>
        </div>

        {/* 进度条 */}
        <div className={`px-8 mb-4 ${isFullscreen ? '' : 'px-4'}`}>
          <div 
            className="h-2 bg-gray-200 rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-primary-400 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className={`flex items-center justify-center gap-8 px-4 pb-6 ${isFullscreen ? 'pb-12' : ''}`}>
          <button
            onClick={handlePrevious}
            className="p-3 text-gray-600 hover:text-primary-500 transition-colors"
          >
            <SkipBack className="w-8 h-8" />
          </button>
          
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-xl hover:bg-primary-600 transition-colors active:scale-95"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
          
          <button
            onClick={handleNext}
            className="p-3 text-gray-600 hover:text-primary-500 transition-colors"
          >
            <SkipForward className="w-8 h-8" />
          </button>
        </div>

        {/* 音量控制 */}
        <div className="px-8 pb-6 flex items-center gap-4">
          <button
            onClick={toggleMute}
            className="p-2 text-gray-500 hover:text-primary-500 transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500"
          />
        </div>

        {/* 播放列表和添加音乐 */}
        <div className={`px-8 pb-8 border-t border-gray-100 ${isFullscreen ? '' : 'px-4'}`}>
          <div 
            className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-xl"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            <span className="text-gray-600 flex items-center gap-2">
              <Music className="w-5 h-5" />
              播放列表 ({playlist.length})
            </span>
            <ChevronUp className={`w-5 h-5 text-gray-400 transition-transform ${showPlaylist ? '' : 'rotate-180'}`} />
          </div>
          
          {showPlaylist && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {playlist.map((music, index) => (
                <div
                  key={music.id}
                  onClick={() => handlePlaylistItemClick(index)}
                  className={`px-4 py-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${
                    index === currentIndex ? 'bg-primary-50 text-primary-600' : 'text-gray-600'
                  }`}
                >
                  <span className="text-lg">{music.cover || '🎵'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{music.title}</p>
                    <p className="text-xs text-gray-400 truncate">{music.artist}</p>
                  </div>
                  {index === currentIndex && isPlaying && (
                    <div className="flex items-end gap-0.5 h-4">
                      <div className="w-1 bg-primary-400 rounded-full animate-pulse" style={{ height: '60%' }} />
                      <div className="w-1 bg-primary-400 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.2s' }} />
                      <div className="w-1 bg-primary-400 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 添加本地音乐按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full mt-4 py-3 border-2 border-dashed border-primary-200 rounded-xl text-primary-500 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            添加本地音乐
          </button>
        </div>
      </div>
    </div>
  );
}
