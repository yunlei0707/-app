/**
 * 成长数据页面
 */

import { useMemo, useState, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { UserAvatar } from '../components/UserAvatar';
import { calculateAge } from '../utils/dateUtils';
import { getMomentsByBaby, getCapsulesByBaby } from '../utils/db';
import { Gift, TrendingUp, Camera, Calendar, Star } from 'lucide-react';

export function StatsPage({ onOpenCapsules, onStatClick }) {
  const { currentBaby, moments, capsules, setMoments, setCapsules, showToast } = useApp();
  
  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);
  const containerRef = useRef(null);
  
  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (!currentBaby || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const [updatedMoments, updatedCapsules] = await Promise.all([
        getMomentsByBaby(currentBaby.id),
        getCapsulesByBaby(currentBaby.id)
      ]);
      setMoments(updatedMoments);
      setCapsules(updatedCapsules);
      showToast('已刷新');
    } catch (error) {
      showToast('刷新失败', 'error');
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [currentBaby, isRefreshing, setMoments, setCapsules, showToast]);
  
  // 下拉刷新手势处理
  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    if (containerRef.current) {
      scrollTop.current = containerRef.current.scrollTop;
    }
  }, []);
  
  const handleTouchMove = useCallback((e) => {
    if (isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    
    if (scrollTop.current <= 0 && diff > 0) {
      const dampened = Math.min(diff * 0.3, 100);
      setPullDistance(dampened);
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing]);
  
  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, handleRefresh]);
  
  // 计算统计数据
  const stats = useMemo(() => {
    if (!currentBaby) return null;
    
    const age = calculateAge(currentBaby.birthDate);
    
    // 照片数量
    const photoCount = moments.filter(m => m.photos && m.photos.length > 0)
      .reduce((acc, m) => acc + m.photos.length, 0);
    
    // 里程碑数量
    const milestoneCount = moments.filter(m => m.milestone).length;
    
    // 胶囊数量
    const unlockedCapsules = capsules.filter(c => 
      new Date(c.unlockDate) <= new Date()
    ).length;
    const lockedCapsules = capsules.length - unlockedCapsules;
    
    // 按类型统计
    const photoMoments = moments.filter(m => m.type === 'photo').length;
    const videoMoments = moments.filter(m => m.type === 'video').length;
    const diaryMoments = moments.filter(m => m.type === 'diary').length;
    const audioMoments = moments.filter(m => m.type === 'audio').length;
    
    // 按心情统计
    const moodStats = {};
    moments.forEach(m => {
      if (m.mood) {
        moodStats[m.mood] = (moodStats[m.mood] || 0) + 1;
      }
    });
    
    // 最常见心情
    const topMood = Object.entries(moodStats)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    return {
      age,
      photoCount,
      totalMoments: moments.length,
      milestoneCount,
      unlockedCapsules,
      lockedCapsules,
      photoMoments,
      videoMoments,
      diaryMoments,
      audioMoments,
      topMood,
      moodStats,
    };
  }, [currentBaby, moments, capsules]);
  
  // 里程碑列表（用于点击跳转）
  const milestones = useMemo(() => {
    return moments.filter(m => m.milestone).slice(0, 5);
  }, [moments]);
  
  if (!currentBaby || !stats) {
    return (
      <div className="min-h-screen pb-20 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }
  
  const moodEmojis = {
    happy: '😊 开心',
    excited: '🎉 兴奋',
    touched: '🥰 感动',
    sleepy: '😴 困倦',
    crying: '😢 哭泣',
    angry: '😠 生气',
  };
  
  const moodFilterLabels = {
    happy: '😊',
    excited: '🎉',
    touched: '🥰',
    sleepy: '😴',
    crying: '😢',
    angry: '😠',
  };
  
  return (
    <div 
      ref={containerRef}
      className="min-h-screen pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉刷新指示器 */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="flex items-center justify-center py-3 text-gray-400 transition-transform"
          style={{ transform: `translateY(${pullDistance}px)` }}
        >
          {isRefreshing ? (
            <div className="animate-spin w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full" />
          ) : (
            <div 
              className="w-5 h-5 border-2 border-gray-300 border-t-primary-400 rounded-full transition-transform"
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
            />
          )}
        </div>
      )}
      
      {/* 头部 */}
      <header className="bg-gradient-to-b from-primary-400 to-primary-500 text-white safe-top">
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">📊 成长数据</h1>
            <UserAvatar />
          </div>
          
          {/* 年龄卡片 */}
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <img
                src={currentBaby.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=200'}
                alt={currentBaby.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white"
              />
              <div>
                <h2 className="text-lg font-bold">{currentBaby.nickname || currentBaby.name}</h2>
                <p className="text-white/80 text-sm">{currentBaby.name}</p>
                <p className="text-2xl font-bold mt-1">{stats.age.display}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* 统计内容 */}
      <main className="px-4 -mt-4 space-y-4 max-w-lg mx-auto">
        {/* 概览卡片 */}
        <div className="card animate-fade-in">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            成长概览
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* 成长记录 - 跳转到时光轴，显示所有记录 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'timeline' })}
            >
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {stats.totalMoments}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">成长记录</p>
            </div>
            
            {/* 珍贵照片 - 跳转到时光轴，筛选照片类型 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'filter', filterType: 'photo' })}
            >
              <p className="text-3xl font-bold text-warm-600 dark:text-warm-400">
                {stats.photoCount}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">珍贵照片</p>
            </div>
            
            {/* 重要里程碑 - 跳转到时光轴，筛选里程碑记录 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'filter', filterMilestone: 'all' })}
            >
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {stats.milestoneCount}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">重要里程碑</p>
            </div>
            
            {/* 成长天数 - 跳转到宝宝信息编辑页 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'profile', baby: currentBaby })}
            >
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.age.totalDays}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">成长天数</p>
            </div>
          </div>
        </div>
        
        {/* 记录类型分布 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary-500" />
            记录类型
          </h3>
          
          <div className="space-y-3">
            {/* 照片记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'photo' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
                <span className="text-gray-700 dark:text-gray-300">照片记录</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-400 rounded-full"
                    style={{ width: `${(stats.photoMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-8 font-medium">{stats.photoMoments}</span>
              </div>
            </div>
            
            {/* 视频记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'video' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎬</span>
                <span className="text-gray-700 dark:text-gray-300">视频记录</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-warm-400 rounded-full"
                    style={{ width: `${(stats.videoMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-8 font-medium">{stats.videoMoments}</span>
              </div>
            </div>
            
            {/* 文字日记 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'diary' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <span className="text-gray-700 dark:text-gray-300">文字日记</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-400 rounded-full"
                    style={{ width: `${(stats.diaryMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-8 font-medium">{stats.diaryMoments}</span>
              </div>
            </div>
            
            {/* 语音日记 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'audio' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎙️</span>
                <span className="text-gray-700 dark:text-gray-300">语音日记</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-400 rounded-full"
                    style={{ width: `${(stats.audioMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-8 font-medium">{stats.audioMoments}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 时空胶囊入口 */}
        <div 
          className="card cursor-pointer active:scale-[0.98] transition-transform animate-fade-in"
          style={{ animationDelay: '0.2s' }}
          onClick={onOpenCapsules}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-warm-400 rounded-2xl flex items-center justify-center">
                <Gift className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary-500" />
                  时空胶囊
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stats.lockedCapsules}个待开封 · {stats.unlockedCapsules}个已解锁
                </p>
              </div>
            </div>
            <span className="text-primary-500">›</span>
          </div>
          
          {/* 胶囊统计数字可点击 */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-cream-200 dark:border-gray-700">
            <div 
              className="flex-1 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onStatClick({ type: 'capsules' });
              }}
            >
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {stats.lockedCapsules}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">待开封</p>
            </div>
            <div 
              className="flex-1 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onStatClick({ type: 'capsules' });
              }}
            >
              <p className="text-2xl font-bold text-warm-600 dark:text-warm-400">
                {stats.unlockedCapsules}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">已解锁</p>
            </div>
          </div>
        </div>
        
        {/* 心情统计 */}
        {stats.topMood && (
          <div className="card animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary-500" />
              最常见心情
            </h3>
            
            <div 
              className="flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterMood: stats.topMood })}
            >
              <div className="text-4xl">
                {stats.topMood === 'happy' && '😊'}
                {stats.topMood === 'excited' && '🎉'}
                {stats.topMood === 'touched' && '🥰'}
                {stats.topMood === 'sleepy' && '😴'}
                {stats.topMood === 'crying' && '😢'}
                {stats.topMood === 'angry' && '😠'}
              </div>
              <div>
                <p className="font-bold text-gray-800 dark:text-white">
                  {moodEmojis[stats.topMood]}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  共记录 {stats.moodStats?.[stats.topMood] || 0} 次
                </p>
              </div>
              <div className="ml-auto text-primary-500">
                查看全部 ›
              </div>
            </div>
          </div>
        )}
        
        {/* 里程碑时间线 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            重要里程碑
          </h3>
          
          {moments.filter(m => m.milestone).length === 0 ? (
            <p className="text-center text-gray-400 py-4">暂无里程碑记录</p>
          ) : (
            <div className="space-y-3">
              {milestones.map(moment => (
                <div 
                  key={moment.id} 
                  className="flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => onStatClick({ type: 'moment', momentId: moment.id })}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    moment.milestone === 'first' ? 'bg-purple-400' :
                    moment.milestone === 'growth' ? 'bg-green-400' :
                    moment.milestone === 'health' ? 'bg-red-400' :
                    moment.milestone === 'learning' ? 'bg-blue-400' : 'bg-yellow-400'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-white">
                      {moment.milestoneLabel || '里程碑'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(moment.date).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <span className="text-gray-400">›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
