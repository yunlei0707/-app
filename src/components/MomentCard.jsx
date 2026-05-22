/**
 * 动态卡片组件
 * ✅ 性能优化：图片懒加载 + 占位符
 */

import { useState, useRef, useEffect } from 'react';
import { formatDateFriendly, formatTime } from '../utils/dateUtils';
import { Smile, CloudSun, MapPin, MoreHorizontal, Trash2, Edit3, Mic, Share2, X } from 'lucide-react';
import { getMediaBlob, getMediaDisplaySrc, normalizeMediaItem, normalizeMomentMedia } from '../repositories/mediaRepository.js';
import { getPodcastPlayUrl } from '../utils/audioStorage';
import { getImageSrc } from '../utils/image';

// 图片组件 - 支持所有媒体格式，自动归一化
function LazyImage({ src, alt, className, onClick }) {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef(null);

  // 异步加载图片URL
  useEffect(() => {
    loadImage();

    // 清理：组件卸载时释放Blob URL
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [src]);

  const loadImage = async () => {
    try {
      setLoading(true);
      setError(false);
      
      // ✅ 使用 Schema 统一工具自动归一化所有格式
      const media = normalizeMediaItem(src, 'photo');
      if (!media) {
        setError(true);
        return;
      }
      
      // 优先使用 getImageSrc 处理 Capacitor 文件路径
      let url = getImageSrc(media.path);
      
      // 如果需要OPFS处理，使用 mediaRepository 统一入口
      if (!url || media.path.startsWith('opfs:')) {
        url = await getMediaDisplaySrc(media.path);
        if (url && url.startsWith('blob:')) {
          objectUrlRef.current = url;
        }
      }
      
      setImageUrl(url);
    } catch (e) {
      console.error('[LazyImage] 图片加载失败:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative w-full h-full ${className || ''}`} onClick={onClick}>
      {/* 加载状态 */}
      {loading && (
        <div className="absolute inset-0 bg-cream-100 dark:bg-gray-700 flex items-center justify-center z-10">
          <div className="animate-pulse rounded-full h-8 w-8 bg-gray-300 dark:bg-gray-600"></div>
        </div>
      )}
      
      {/* 错误状态 */}
      {error && (
        <div className="absolute inset-0 bg-cream-100 dark:bg-gray-700 flex items-center justify-center z-10">
          <span className="text-xl opacity-50">❌</span>
        </div>
      )}
      
      {/* 图片 */}
      {imageUrl && !error && (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            console.error('[LazyImage] 图片加载出错:', alt);
            setError(true);
          }}
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
}

// 格式化时间
const formatTime2 = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 心情表情映射
const moodEmojis = {
  happy: '😊',
  excited: '🎉',
  touched: '🥰',
  sleepy: '😴',
  crying: '😢',
  angry: '😠',
  thinking: '🤔',
};

// 天气图标映射
const weatherIcons = {
  sunny: '☀️',
  cloudy: '⛅',
  rainy: '🌧️',
  snowy: '❄️',
  windy: '💨',
  stormy: '⛈️',
};

// 名场面标签类型
const milestoneTypes = {
  first: { label: '名场面', className: 'first', emoji: '⭐' },
  growth: { label: '成长', className: 'growth', emoji: '🌱' },
  health: { label: '健康', className: 'health', emoji: '💪' },
  learning: { label: '学习', className: 'learning', emoji: '📚' },
  daily: { label: '日常', className: 'daily', emoji: '✨' },
};

// 音频子组件 - 所有格式自动归一化处理
function AudioItem({ audio }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    loadAudio();

    // 清理：组件卸载时释放Blob URL
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [audio]);

  const loadAudio = async () => {
    try {
      setLoading(true);
      
      // ✅ 使用 Schema 统一工具自动归一化所有格式
      const media = normalizeMediaItem(audio, 'audio');
      if (!media) {
        return;
      }
      
      // 1. 优先直接使用Base64 url
      if (media.path && media.path.startsWith('data:')) {
        setAudioUrl(media.path);
        return;
      }
      
      // 2. 其他格式统一使用mediaRepository获取显示URL
      if (media.path) {
        const url = await getMediaDisplaySrc(media.path);
        if (url && url.startsWith('blob:')) {
          objectUrlRef.current = url;
        }
        setAudioUrl(url);
      }
    } catch (e) {
      console.error('[MomentCard] 音频加载失败:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-cream-50 dark:bg-gray-800 rounded-xl p-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                {audio.fileName || audio.name || '语音记录'}
              </span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {audio.duration ? formatTime2(audio.duration) : '--:--'}
            </span>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-10 text-sm text-gray-400">
          加载中...
        </div>
      ) : audioUrl ? (
        <audio
          src={audioUrl}
          controls
          style={{
            width: '100%',
            height: '40px',
            borderRadius: '20px'
          }}
          preload="metadata"
          onError={(e) => console.error('[MomentCard] 语音加载失败:', e)}
        />
      ) : null}
    </div>
  );
}

// 视频子组件 - 支持原生/OPFS/Base64三种模式
function VideoItem({ video }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef(null);

  // 根据视频类型加载
  useEffect(() => {
    loadVideo();

    // 清理：组件卸载时释放Blob URL
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [video.url, video.filename, video.path, video.opfsPath]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      setError(false);
      
      // 兼容所有可能的字段名
      const mediaUrl = video.url || video.path || video.opfsPath || video.filename;
      
      // 1. 优先直接使用Base64 url
      if (mediaUrl && mediaUrl.startsWith('data:')) {
        setVideoUrl(mediaUrl);
        return;
      }
      
      // 2. 其他格式统一使用mediaRepository获取显示URL
      if (mediaUrl) {
        const url = await getMediaDisplaySrc(mediaUrl);
        if (url && url.startsWith('blob:')) {
          objectUrlRef.current = url;
        }
        setVideoUrl(url);
      }
    } catch (e) {
      console.error('[MomentCard] 视频加载失败:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent"></div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
          <span className="text-3xl mb-2">⚠️</span>
          <span className="text-sm">视频加载失败</span>
        </div>
      )}
      {videoUrl && (
        <video
          src={videoUrl}
          poster={video.cover}
          controls
          className="w-full h-full object-cover"
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}

export function MomentCard({ moment, onEdit, onDelete, onClick, onShare, isSystem = false, isV1 = false }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showFullscreenPlayer, setShowFullscreenPlayer] = useState(false);
  const [podcastAudioUrl, setPodcastAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioError, setAudioError] = useState(false);
  const objectUrlsRef = useRef([]); // 追踪所有创建的 Object URL
  
  const typeIcons = {
    photo: '📷',
    video: '🎬',
    audio: '🎤',
    diary: '📝',
    podcast: '🎙️',
  };
  
  const handleDelete = () => {
    // 直接调用onDelete，显示自定义的回收站/永久删除确认框
    onDelete(moment.id);
    setShowMenu(false);
  };

  const handleShare = () => {
    if (onShare) {
      onShare(moment);
    }
    setShowMenu(false);
  };
  
  // 组件卸载时清理所有 Object URL
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
        console.log('[MomentCard] 已释放 Object URL:', url.substring(0, 50) + '...');
      });
      objectUrlsRef.current = [];
    };
  }, []);
  
  // 组件加载时获取播客音频URL
  useEffect(() => {
    console.log('[MomentCard] useEffect 触发，moment.type:', moment.type, 'moment.podcast:', !!moment.podcast);
    if (moment.type === 'podcast' && moment.podcast) {
      loadPodcastAudio();
    }
  }, [moment.type, moment.podcast]);
  
  // 加载播客音频 URL（支持多种格式）
  const loadPodcastAudio = async () => {
    console.log('[MomentCard] ===== loadPodcastAudio 开始 ====');
    
    if (!moment.podcast) {
      console.error('[MomentCard] moment.podcast 为空');
      return;
    }
    
    console.log('[MomentCard] moment.podcast 结构:', JSON.stringify(moment.podcast, (key, value) => {
      if (typeof value === 'string' && value.length > 100) {
        return value.substring(0, 100) + '...';
      }
      return value;
    }, 2));
    
    console.log('[MomentCard] moment.podcast.audio 的 keys:', moment.podcast.audio ? Object.keys(moment.podcast.audio) : 'null');
    
    try {
      setAudioLoading(true);
      setAudioError(false);
      
      // 调用统一的兼容处理函数
      console.log('[MomentCard] 开始调用 getPodcastPlayUrl...');
      // 🔴 APP 环境下用 Base64，因为 Blob URL 在 APP WebView 中不可靠
      const useBase64 = true;
      const playUrl = await getPodcastPlayUrl(moment.podcast.audio, getMediaBlob, useBase64);
      
      console.log('[MomentCard] getPodcastPlayUrl 返回结果:', playUrl ? playUrl.substring(0, 50) + '...' : 'null');
      console.log('[MomentCard] URL 类型:', playUrl ? (playUrl.startsWith('blob:') ? 'Blob URL' : playUrl.startsWith('data:') ? 'Base64 URL' : '其他 URL') : '无');
      
      if (playUrl && playUrl.startsWith('blob:')) {
        // 追踪 Blob URL，稍后清理
        objectUrlsRef.current.push(playUrl);
        console.log('[MomentCard] Blob URL 已加入清理列表，当前数量:', objectUrlsRef.current.length);
      }
      
      if (!playUrl) {
        console.error('[MomentCard] 未获取到播放 URL，设置 audioError 为 true');
        setAudioError(true);
        return;
      }
      
      console.log('[MomentCard] 设置 podcastAudioUrl，准备渲染音频播放器');
      setPodcastAudioUrl(playUrl);
    } catch (e) {
      console.error('[MomentCard] ===== loadPodcastAudio 异常 ====');
      console.error('[MomentCard] 错误类型:', e.name);
      console.error('[MomentCard] 错误消息:', e.message);
      console.error('[MomentCard] 完整错误:', e);
      setAudioError(true);
    } finally {
      setAudioLoading(false);
      console.log('[MomentCard] ===== loadPodcastAudio 结束 ====');
    }
  };
  
  return (
    <div id={`moment-${moment.id}`} className="card mb-4 animate-fade-in transition-all duration-300">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{typeIcons[moment.type]}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDateFriendly(moment.date)} {formatTime(moment.createdAt)}
          </span>
          {/* 记录人信息 */}
          {moment.createdBy && (
            <span className="flex items-center gap-1 text-xs text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">
              <span>{moment.createdBy.avatar}</span>
              <span>{moment.createdBy.name}</span>
            </span>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-full hover:bg-cream-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-card z-20 overflow-hidden animate-scale-in min-w-[120px]">
                {!isSystem && !isV1 && (
                  <button
                    onClick={() => {
                      onEdit(moment);
                      setShowMenu(false);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 hover:bg-cream-100 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>编辑</span>
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 hover:bg-pink-50 dark:hover:bg-pink-900/20 text-sm text-pink-500 border-b border-gray-100 dark:border-gray-700"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>分享</span>
                  </button>
                )}
                {!isSystem && !isV1 && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>删除</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {moment.milestone && moment.milestoneLabel && (
        <div className="mb-3">
          <span className={`milestone-tag ${milestoneTypes[moment.milestone]?.className || 'daily'}`}>
            {milestoneTypes[moment.milestone]?.emoji} {moment.milestoneLabel}
          </span>
        </div>
      )}
      
      {/* 视频 - 使用videos字段，支持OPFS和Base64两种模式 */}
      {moment.type === 'video' && moment.videos && moment.videos.length > 0 && (
        <div className="mb-3 space-y-2">
          {moment.videos.map((video, index) => (
            <VideoItem key={index} video={video} />
          ))}
        </div>
      )}
      
      {/* 语音 */}
      {moment.type === 'audio' && moment.audios && moment.audios.length > 0 && (
        <div className="mb-3 space-y-2">
          {moment.audios.map((audio, index) => (
            <AudioItem key={index} audio={audio} />
          ))}
        </div>
      )}
      
      {/* 播客 - 使用原生HTML5 Audio播放器 */}
      {moment.type === 'podcast' && moment.podcast && (
        <div className="mb-3">
          <div className="bg-cream-50 dark:bg-gray-800 rounded-xl overflow-hidden">
            {/* 播客封面 - 点击进入全屏模式 */}
            {moment.podcast.cover && (
              <div 
                className="relative aspect-video bg-cream-100 dark:bg-gray-700 cursor-pointer"
                onClick={() => setShowFullscreenPlayer(true)}
              >
                <LazyImage
                  src={typeof moment.podcast.cover === 'string' ? moment.podcast.cover : moment.podcast.cover.url}
                  alt={moment.podcast.title || '播客封面'}
                  onClick={() => setShowFullscreenPlayer(true)}
                />
              </div>
            )}
            {/* 播客信息 */}
            <div className="p-3">
              <h4 className="text-base font-medium text-gray-800 dark:text-gray-100 mb-1 truncate">
                {moment.podcast.title || '播客记录'}
              </h4>
              {moment.podcast.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {moment.podcast.description}
                </p>
              )}
              
              {/* 原生Audio播放器 */}
              {audioLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
                </div>
              ) : audioError ? (
                <div className="text-center py-4 text-red-500 text-sm">
                  ⚠️ 音频加载失败
                </div>
              ) : podcastAudioUrl ? (
                <>
                  {console.log('[MomentCard] 渲染音频播放器，src:', podcastAudioUrl.substring(0, 50) + '...')}
                  <audio
                    src={podcastAudioUrl}
                    controls
                    style={{
                      width: '100%',
                      height: '40px',
                      borderRadius: '20px'
                    }}
                    preload="metadata"
                    onLoadStart={() => console.log('[MomentCard] 音频开始加载...')}
                    onLoadedMetadata={(e) => {
                      console.log('[MomentCard] 播客音频元数据已加载');
                      console.log('[MomentCard] 音频时长:', e.target.duration, '秒');
                      console.log('[MomentCard] readyState:', e.target.readyState);
                      console.log('[MomentCard] networkState:', e.target.networkState);
                    }}
                    onCanPlay={() => console.log('[MomentCard] 音频可以开始播放')}
                    onCanPlayThrough={() => console.log('[MomentCard] 音频可以流畅播放')}
                    onError={(e) => {
                      console.error('[MomentCard] ===== 音频加载错误 ====');
                      console.error('[MomentCard] 错误事件:', e);
                      console.error('[MomentCard] error.code:', e.target.error?.code);
                      console.error('[MomentCard] error.message:', e.target.error?.message);
                      console.error('[MomentCard] 当前 src:', e.target.src.substring(0, 100) + '...');
                      console.error('[MomentCard] readyState:', e.target.readyState);
                      console.error('[MomentCard] networkState:', e.target.networkState);
                      setAudioError(true);
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* 照片 */}
      {moment.type !== 'video' && moment.type !== 'audio' && moment.type !== 'podcast' && moment.photos && moment.photos.length > 0 && (
        <div 
          className={`grid gap-2 mb-3 ${moment.photos.length === 1 ? 'grid-cols-1' : moment.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}
          onClick={() => onClick && onClick(moment.photos)}
        >
          {moment.photos.slice(0, 4).map((photo, index) => (
            <div 
              key={index} 
              className={`relative rounded-xl overflow-hidden bg-cream-100 dark:bg-gray-700 ${
                moment.photos.length === 1 ? 'aspect-auto max-h-96' : 'aspect-square'
              } ${moment.photos.length === 3 && index === 0 ? 'row-span-2 aspect-auto' : ''}`}
            >
              <LazyImage
                src={photo}
                alt={`照片 ${index + 1}`}
              />
              {index === 3 && moment.photos.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-2xl font-bold">
                  +{moment.photos.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 文字内容 */}
      {moment.content && (
        <p className="text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
          {moment.content}
        </p>
      )}
      
      {/* 底部元信息 */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-cream-100 dark:border-gray-700">
        {moment.mood && (
          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{moodEmojis[moment.mood]}</span>
          </span>
        )}

        {moment.milestone && moment.milestoneLabel && (
          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{milestoneTypes[moment.milestone]?.emoji || "✨"}</span>
            <span>{moment.milestoneLabel}</span>
          </span>
        )}
        {moment.weather && (
          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{weatherIcons[moment.weather]}</span>
          </span>
        )}
        {moment.location && (
          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-32">{moment.location}</span>
          </span>
        )}
      </div>
      
      {/* ===== 全屏播放器 - 使用原生Audio ===== */}
      {showFullscreenPlayer && moment.podcast && (
        <div className="fixed inset-0 z-[100] bg-black">
          {/* 模糊背景层 */}
          <div 
            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40 scale-110"
            style={{
              backgroundImage: `url(${getImageSrc(typeof moment.podcast.cover === 'string' ? moment.podcast.cover : moment.podcast.cover?.url)})`
            }}
          />
          
          {/* 黑色渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-black/90" />
          
          {/* 关闭按钮 - 提高z-index确保可点击 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullscreenPlayer(false);
            }}
            className="absolute top-4 right-4 z-[200] p-3 text-white/80 hover:text-white transition-colors bg-black/30 rounded-full"
          >
            <X className="w-8 h-8" />
          </button>
          
          {/* 内容区域 */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-8">
            {/* 封面图片 */}
            <div className="w-full max-w-sm aspect-square mb-8 rounded-2xl overflow-hidden shadow-2xl">
              {moment.podcast.cover ? (
                <img
                  src={getImageSrc(typeof moment.podcast.cover === 'string' ? moment.podcast.cover : moment.podcast.cover?.url)}
                  alt={moment.podcast.title || '播客封面'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-6xl">🎙️</span>
                </div>
              )}
            </div>
            
            {/* 标题 */}
            <h3 className="text-white text-xl font-bold mb-2 text-center">
              {moment.podcast.title || '播客记录'}
            </h3>
            {moment.podcast.description && (
              <p className="text-white/60 text-sm text-center mb-8 max-w-sm">
                {moment.podcast.description}
              </p>
            )}
            
            {/* 原生Audio播放器 */}
            {podcastAudioUrl && (
              <div className="w-full max-w-sm">
                <audio
                  src={podcastAudioUrl}
                  controls
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '24px'
                  }}
                  preload="metadata"
                  autoPlay
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
