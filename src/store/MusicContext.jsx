/**
 * 音乐上下文 - 全局音乐状态管理
 * 支持预设音乐和本地音乐文件，状态全局共享
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// 预设免费背景音乐列表（使用无版权音乐CDN）
const PRESET_MUSIC = [
  {
    id: 'preset_1',
    title: '温暖摇篮曲',
    artist: 'Sweet Dreams',
    url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_946bc3eb4c.mp3',
    cover: '🎵'
  },
  {
    id: 'preset_2',
    title: '童趣时光',
    artist: 'Happy Children',
    url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_2dde668d05.mp3',
    cover: '🎶'
  },
  {
    id: 'preset_3',
    title: '宁静午后',
    artist: 'Peaceful Afternoon',
    url: 'https://cdn.pixabay.com/audio/2023/07/30/audio_e5b6e7e054.mp3',
    cover: '🌸'
  },
  {
    id: 'preset_4',
    title: '温馨时刻',
    artist: 'Cozy Moments',
    url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
    cover: '💝'
  },
  {
    id: 'preset_5',
    title: '快乐成长',
    artist: 'Growing Up',
    url: 'https://cdn.pixabay.com/audio/2022/12/07/audio_3b3f760e9b.mp3',
    cover: '✨'
  },
];

const MusicContext = createContext(null);

// localStorage keys
const STORAGE_KEYS = {
  PLAYLIST: 'babytime_playlist',
  CURRENT_INDEX: 'babytime_current_index',
  VOLUME: 'babytime_volume',
  IS_PLAYING: 'babytime_is_playing',
  IS_MUTED: 'babytime_is_muted',
};

export function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const [playlist, setPlaylist] = useState(PRESET_MUSIC);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFile, setLocalFile] = useState(null);
  const [localFileUrl, setLocalFileUrl] = useState(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // 当前音乐
  const currentMusic = playlist[currentIndex] || null;

  // 初始化音频元素
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    audioRef.current.muted = isMuted;

    // 音频事件监听
    audioRef.current.addEventListener('timeupdate', () => {
      setCurrentTime(audioRef.current?.currentTime || 0);
    });

    audioRef.current.addEventListener('loadedmetadata', () => {
      setDuration(audioRef.current?.duration || 0);
    });

    audioRef.current.addEventListener('ended', () => {
      // 自动播放下一首
      handleNext();
    });

    audioRef.current.addEventListener('play', () => {
      setIsPlaying(true);
    });

    audioRef.current.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // 从localStorage恢复状态
  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
      const savedMuted = localStorage.getItem(STORAGE_KEYS.IS_MUTED);
      const savedCurrentIndex = localStorage.getItem(STORAGE_KEYS.CURRENT_INDEX);
      const savedPlaylist = localStorage.getItem(STORAGE_KEYS.PLAYLIST);

      if (savedVolume !== null) {
        const vol = parseFloat(savedVolume);
        setVolumeState(vol);
        if (audioRef.current) audioRef.current.volume = vol;
      }

      if (savedMuted !== null) {
        const muted = savedMuted === 'true';
        setIsMuted(muted);
        if (audioRef.current) audioRef.current.muted = muted;
      }

      if (savedCurrentIndex !== null) {
        setCurrentIndex(parseInt(savedCurrentIndex, 10));
      }

      if (savedPlaylist) {
        const parsed = JSON.parse(savedPlaylist);
        // 合并预设音乐和用户添加的音乐
        setPlaylist([...PRESET_MUSIC, ...parsed.filter(p => p.isLocal)]);
      }
    } catch (e) {
      console.error('Failed to restore music state:', e);
    }
  }, []);

  // 监听用户交互（处理自动播放策略）
  useEffect(() => {
    const handleUserInteraction = () => {
      setHasUserInteracted(true);
    };
    
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // 加载当前音乐
  useEffect(() => {
    if (audioRef.current && currentMusic) {
      audioRef.current.src = localFileUrl || currentMusic.url;
      audioRef.current.load();
      
      if (hasUserInteracted && isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentMusic, localFileUrl]);

  // 保存状态到localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IS_MUTED, isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_INDEX, currentIndex.toString());
  }, [currentIndex]);

  // 播放
  const play = useCallback(async () => {
    if (!currentMusic && !localFile) return;
    
    try {
      if (audioRef.current) {
        await audioRef.current.play();
        setIsPlaying(true);
        if (!localFileUrl && !localFile) {
          setIsExpanded(true);
        }
      }
    } catch (error) {
      console.error('Play failed:', error);
    }
  }, [currentMusic, localFile, localFileUrl]);

  // 暂停
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // 播放/暂停切换
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // 上一首
  const handlePrevious = useCallback(() => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    setCurrentIndex(newIndex);
    setLocalFile(null);
    setLocalFileUrl(null);
    
    // 清除本地文件选择
    const fileInput = document.getElementById('local-music-input');
    if (fileInput) fileInput.value = '';
  }, [currentIndex, playlist.length]);

  // 下一首
  const handleNext = useCallback(() => {
    const newIndex = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    setLocalFile(null);
    setLocalFileUrl(null);
    
    // 清除本地文件选择
    const fileInput = document.getElementById('local-music-input');
    if (fileInput) fileInput.value = '';
  }, [currentIndex, playlist.length]);

  // 选择特定音乐
  const selectMusic = useCallback((index) => {
    setCurrentIndex(index);
    setLocalFile(null);
    setLocalFileUrl(null);
    
    const fileInput = document.getElementById('local-music-input');
    if (fileInput) fileInput.value = '';
  }, []);

  // 添加本地音乐
  const addLocalMusic = useCallback((file) => {
    if (!file) return;
    
    // 清理之前的ObjectURL
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
    }
    
    const url = URL.createObjectURL(file);
    setLocalFile(file);
    setLocalFileUrl(url);
    
    // 添加到播放列表
    const localMusic = {
      id: `local_${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: '本地音乐',
      url: url,
      cover: '📁',
      isLocal: true,
    };
    
    setPlaylist(prev => [...prev, localMusic]);
    setCurrentIndex(playlist.length); // 切换到新添加的音乐
    
    // 保存本地音乐列表到localStorage
    const localMusicList = playlist.filter(p => p.isLocal);
    localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify([...localMusicList, localMusic]));
  }, [localFileUrl, playlist]);

  // 设置音量
  const setVolume = useCallback((vol) => {
    const newVolume = Math.max(0, Math.min(1, vol));
    setVolumeState(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  // 静音切换
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (audioRef.current) {
        audioRef.current.muted = newMuted;
      }
      return newMuted;
    });
  }, []);

  // 格式化时间
  const formatTime = (time) => {
    if (!time || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 进度
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const value = {
    // 状态
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
    
    // 方法
    play,
    pause,
    togglePlay,
    handlePrevious,
    handleNext,
    selectMusic,
    addLocalMusic,
    setVolume,
    toggleMute,
    setIsExpanded,
    formatTime,
    progress,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
}

export { PRESET_MUSIC };
