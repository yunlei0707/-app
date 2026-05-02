/**
 * 动态卡片组件
 */

import { useState, useRef } from 'react';
import { formatDateFriendly, formatTime } from '../utils/dateUtils';
import { Smile, CloudSun, MapPin, MoreHorizontal, Trash2, Edit3, Play, Pause, Mic } from 'lucide-react';

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

// 里程碑标签类型
const milestoneTypes = {
  first: { label: '里程碑', className: 'first', emoji: '⭐' },
  growth: { label: '成长', className: 'growth', emoji: '🌱' },
  health: { label: '健康', className: 'health', emoji: '💪' },
  learning: { label: '学习', className: 'learning', emoji: '📚' },
  daily: { label: '日常', className: 'daily', emoji: '✨' },
};

export function MomentCard({ moment, onEdit, onDelete, onClick }) {
  const [showMenu, setShowMenu] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRef = useRef(null);
  
  const typeIcons = {
    photo: '📷',
    video: '🎬',
    audio: '🎤',
    diary: '📝',
  };
  
  const handleDelete = () => {
    if (confirm('确定要删除这条记录吗？')) {
      onDelete(moment.id);
    }
    setShowMenu(false);
  };
  
  // 播放/暂停音频
  const togglePlayAudio = (index) => {
    if (playingIndex === index) {
      audioRef.current?.pause();
      setPlayingIndex(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(moment.audios[index].url);
      audioRef.current.onended = () => setPlayingIndex(null);
      audioRef.current.play();
      setPlayingIndex(index);
    }
  };
  
  return (
    <div className="card mb-4 animate-fade-in">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcons[moment.type]}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDateFriendly(moment.date)} {formatTime(moment.createdAt)}
          </span>
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
              <div className="absolute right-0 top-full mt-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-card z-20 overflow-hidden animate-scale-in min-w-[90px]">
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
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>删除</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 里程碑标签 */}
      {moment.milestone && moment.milestoneLabel && (
        <div className="mb-3">
          <span className={`milestone-tag ${milestoneTypes[moment.milestone]?.className || 'daily'}`}>
            {milestoneTypes[moment.milestone]?.emoji} {moment.milestoneLabel}
          </span>
        </div>
      )}
      
      {/* 视频 - 使用videos字段 */}
      {moment.type === 'video' && moment.videos && moment.videos.length > 0 && (
        <div className="mb-3 space-y-2">
          {moment.videos.map((video, index) => (
            <div 
              key={index} 
              className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video"
            >
              <video
                src={video.url}
                poster={video.cover}
                controls
                className="w-full h-full object-cover"
                playsInline
                preload="metadata"
              />
            </div>
          ))}
        </div>
      )}
      
      {/* 语音 */}
      {moment.type === 'audio' && moment.audios && moment.audios.length > 0 && (
        <div className="mb-3 space-y-2">
          {moment.audios.map((audio, index) => (
            <div 
              key={index} 
              className="bg-cream-50 dark:bg-gray-800 rounded-xl p-3"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePlayAudio(index)}
                  className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-primary-600 transition-colors"
                >
                  {playingIndex === index ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        语音日记
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTime2(audio.duration)}
                    </span>
                  </div>
                  {/* 波形显示 */}
                  <div className="h-6 flex items-center gap-0.5 overflow-hidden">
                    {audio.waveform?.length > 0 ? (
                      audio.waveform.slice(-40).map((frame, i) => (
                        <div key={i} className="flex items-center gap-px h-full">
                          {frame?.slice(0, 6).map((v, j) => (
                            <div
                              key={j}
                              className="w-1 bg-primary-300 dark:bg-primary-600 rounded-full"
                              style={{ height: `${Math.max(10, (v / 255) * 100)}%` }}
                            />
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="w-full h-2 bg-primary-200 dark:bg-primary-700 rounded" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* 照片 */}
      {moment.type !== 'video' && moment.type !== 'audio' && moment.photos && moment.photos.length > 0 && (
        <div 
          className={`grid gap-2 mb-3 ${moment.photos.length === 1 ? 'grid-cols-1' : moment.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}
          onClick={() => onClick && onClick(moment.photos)}
        >
          {moment.photos.slice(0, 4).map((photo, index) => (
            <div 
              key={index} 
              className={`relative rounded-xl overflow-hidden bg-cream-100 dark:bg-gray-700 ${
                moment.photos.length === 1 ? 'aspect-video' : 'aspect-square'
              } ${moment.photos.length === 3 && index === 0 ? 'row-span-2 aspect-auto' : ''}`}
            >
              <img
                src={photo}
                alt={`照片 ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
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
    </div>
  );
}
