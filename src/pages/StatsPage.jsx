/**
 * 成长数据页面
 * 优化版本：左上角显示头像，月度报告入口，双账号支持
 */

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { BabyHeader } from '../components/BabyHeader';
import { calculateAge } from '../utils/dateUtils';
import { getMomentsByBaby, getCapsulesByBaby } from '../repositories/stateRepository';
import { Gift, TrendingUp, Camera, Star, BookOpen, ChevronDown, ChevronRight, Plus, Trash2, Edit3, BarChart2 } from 'lucide-react'
import { getCurrentV2Account, getCurrentTimeline, getCurrentGrowth, updateCurrentGrowth, isSystemAccount as checkIsSystemAccount, isV1Account as checkIsV1Account, getCurrentBabyInfo } from "../repositories/stateRepository.js";
import { mergeGrowthRecords, shouldMergeDisplay, isV1GrowthRecord, createV2GrowthCopyFromV1 } from '../utils/dataMerger';
import { TimeBlindBox } from '../components/TimeBlindBox';
import { GROWTH_LABELS, GROWTH_UNITS, GROWTH_ICONS } from '../utils/growthMilestones';
import { moodScoreMap as importedMoodScoreMap } from '../components/MomentForm';

// 心情选项配置
const moodOptions = [
  { value: 'happy', emoji: '😊', label: '开心', score: 2 },
  { value: 'excited', emoji: '🎉', label: '兴奋', score: 3 },
  { value: 'touched', emoji: '🥰', label: '感动', score: 2 },
  { value: 'calm', emoji: '😌', label: '平静', score: 1 },
  { value: 'sleepy', emoji: '😴', label: '困倦', score: 0 },
  { value: 'sad', emoji: '😢', label: '难过', score: -2 },
  { value: 'angry', emoji: '😠', label: '生气', score: -3 },
  { value: 'sick', emoji: '🤒', label: '不舒服', score: -2 },
];

// 成长曲线图组件
export function StatsPage({ onOpenCapsules, onStatClick, onOpenMonthlyReport, onAddGrowthRecord, onEditGrowthRecord }) {
  const { currentBaby, currentUser, moments, capsules, setMoments, setCapsules, showToast, getAllMilestones, growthRecords, refreshGrowthRecords } = useApp();
  
  // v2 账号系统：获取当前账号信息
  const [v2Moments, setV2Moments] = useState([]);
  const [v2Growth, setV2Growth] = useState(null);
  const [v2BabyInfo, setV2BabyInfo] = useState(null);
  const [isSystemAccount, setIsSystemAccount] = useState(false);
  const [hasV2Baby, setHasV2Baby] = useState(false);
  const [v2AccountInfo, setV2AccountInfo] = useState(null);
  
  // 监听账号切换，刷新 v2 数据（和 TimelinePage 完全一致）
  useEffect(() => {
    const updateV2Info = () => {
      const account = getCurrentV2Account();
      const timeline = getCurrentTimeline();
      const isSystem = checkIsSystemAccount();
      const growth = getCurrentGrowth();
      const babyInfo = getCurrentBabyInfo();
      
      setV2Moments(Array.isArray(timeline) ? timeline : []);
      setIsSystemAccount(isSystem);
      setHasV2Baby(!!babyInfo);
      setV2AccountInfo(account || null);
      setV2Growth(growth);
      setV2BabyInfo(babyInfo);
    };
    
    // 数据更新时：刷新 v2 数据
    const handleDataUpdate = () => {
      updateV2Info();
      // 如果没有 v2 宝宝，则从 IndexedDB 重新加载
      if (currentBaby && !getCurrentBabyInfo()) {
        getMomentsByBaby(currentBaby.id).then(babyMoments => {
          setMoments(babyMoments);
        });
        getCapsulesByBaby(currentBaby.id).then(babyCapsules => {
          setCapsules(babyCapsules);
        });
      }
    };
    
    updateV2Info();
    
    // 监听 localStorage 变化（跨标签页同步）
    window.addEventListener('storage', updateV2Info);
    // 监听数据更新事件（添加/导入动态后触发）
    window.addEventListener('v2-moment-updated', handleDataUpdate);
    // 轮询更新（和 TimelinePage 一致，300ms）
    const interval = setInterval(updateV2Info, 300);
    
    return () => {
      window.removeEventListener('storage', updateV2Info);
      window.removeEventListener('v2-moment-updated', handleDataUpdate);
      clearInterval(interval);
    };
  }, [currentBaby, setMoments, setCapsules]);
  
  // 刷新成长记录
  useEffect(() => {
    const babyId = currentBaby?.id || v2BabyInfo?.id;
    if (babyId) {
      refreshGrowthRecords(babyId);
    }
  }, [currentBaby, v2BabyInfo, refreshGrowthRecords]);
  
  // 优先使用 v2 账号信息，兼容旧的 currentBaby
  const displayBaby = v2BabyInfo || currentBaby;
  
  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  // 折叠状态 - 成长概览默认展开，其他折叠
  const [showGrowthOverview, setShowGrowthOverview] = useState(true);
  const [showMilestoneStats, setShowMilestoneStats] = useState(false);
  const [showPredictionStats, setShowPredictionStats] = useState(false);
  const [showRecordTypes, setShowRecordTypes] = useState(false);
  const [showGrowthRecords, setShowGrowthRecords] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
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
    if (!displayBaby) return null;
    
    const age = calculateAge(displayBaby.birthDate);
    
    // 和 TimelinePage 一致：有 v2 宝宝用 v2Moments，否则用 moments
    const activeMoments = hasV2Baby
      ? v2Moments.filter(m => !m.isDeleted)
      : (moments && moments.length > 0
        ? moments.filter(m => !m.isDeleted)
        : []);
    
    // 照片数量
    const photoCount = activeMoments.filter(m => m.photos && m.photos.length > 0)
      .reduce((acc, m) => acc + m.photos.length, 0);
    
    // 名场面数量
    const milestoneCount = activeMoments.filter(m => m.milestone).length;
    
    // 按类型统计
    const photoMoments = activeMoments.filter(m => m.type === 'photo').length;
    const videoMoments = activeMoments.filter(m => m.type === 'video').length;
    const diaryMoments = activeMoments.filter(m => m.type === 'diary').length;
    const audioMoments = activeMoments.filter(m => m.type === 'audio').length;
    const podcastMoments = activeMoments.filter(m => m.type === 'podcast').length;
    
    // 按心情统计
    const moodStats = {};
    activeMoments.forEach(m => {
      if (m.mood) {
        moodStats[m.mood] = (moodStats[m.mood] || 0) + 1;
      }
    });
    
    // 最常见心情
    const topMood = Object.entries(moodStats)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    // 胶囊数量（非 v2 账号）
    const unlockedCapsules = capsules.filter(c => 
      new Date(c.unlockDate) <= new Date()
    ).length;
    const lockedCapsules = capsules.length - unlockedCapsules;
    
    return {
      age,
      photoCount,
      totalMoments: activeMoments.length,
      milestoneCount,
      unlockedCapsules,
      lockedCapsules,
      photoMoments,
      videoMoments,
      diaryMoments,
      audioMoments,
      podcastMoments,
      topMood,
      moodStats,
    };
  }, [currentBaby, moments, capsules, v2Moments, hasV2Baby]);
  
  // 名场面列表
  const milestones = useMemo(() => {
    const sourceMoments = hasV2Baby
      ? v2Moments
      : (moments && moments.length > 0 ? moments : []);
    return sourceMoments.filter(m => m.milestone && !m.isDeleted).slice(0, 5);
  }, [moments, v2Moments, hasV2Baby]);

  // 名场面类型统计
  const milestoneStats = useMemo(() => {
    const sourceMoments = hasV2Baby
      ? v2Moments
      : (moments && moments.length > 0 ? moments : []);
    const milestoneMoments = sourceMoments.filter(m => m.milestone && !m.isDeleted);
    
    // 获取所有名场面选项
    const allOptions = getAllMilestones();
    
    // 按milestone id分组计数
    const countMap = {};
    milestoneMoments.forEach(m => {
      const key = m.milestone;
      if (key) {
        countMap[key] = (countMap[key] || 0) + 1;
      }
    });
    
    // 构建结果：只显示有记录的类型
    const result = allOptions
      .filter(opt => countMap[opt.id])
      .map(opt => ({
        id: opt.id,
        label: opt.label,
        emoji: opt.emoji,
        count: countMap[opt.id],
      }));
    
    // 也加上没有匹配到选项的名场面（自定义被删除的）
    Object.keys(countMap).forEach(key => {
      if (!result.find(r => r.id === key)) {
        const sample = milestoneMoments.find(m => m.milestone === key);
        result.push({
          id: key,
          label: sample?.milestoneLabel || key,
          emoji: sample?.milestoneEmoji || '⭐',
          count: countMap[key],
        });
      }
    });
    
    // 按数量降序
    return result.sort((a, b) => b.count - a.count);
  }, [moments, v2Moments, hasV2Baby, getAllMilestones]);

  // 月龄神预言统计
  const predictionStats = useMemo(() => {
    const babyId = v2BabyInfo?.id || displayBaby?.id || 'default';
    try {
      const stored = localStorage.getItem(`babyPredictions_${babyId}`);
      const all = stored ? JSON.parse(stored) : [];
      const total = all.length;
      const fulfilled = all.filter(p => p.status === 'fulfilled').length;
      const rate = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
      return { total, fulfilled, rate };
    } catch {
      return { total: 0, fulfilled: 0, rate: 0 };
    }
  }, [v2BabyInfo, displayBaby]);

  // 心情轨迹状态 - 必须在条件返回之前声明
  const [moodTimeRange, setMoodTimeRange] = useState(30); // 7/30/90/180/all
  const [showMoodTrack, setShowMoodTrack] = useState(true);
  const moodScoreMap = importedMoodScoreMap;

  // 成长趋势图状态
  const [selectedGrowthMetric, setSelectedGrowthMetric] = useState('height'); // height/weight/headCircumference/footLength
  const [showGrowthTrack, setShowGrowthTrack] = useState(true);

  // 成长趋势数据处理
  const growthTrackData = useMemo(() => {
    try {
      const isSystem = checkIsSystemAccount();
      const isV1 = checkIsV1Account();
      
      let records;
      
      if (isSystem) {
        // 系统账号：只使用v2数据
        records = [...(v2Growth?.records || [])].sort((a, b) => a.date.localeCompare(b.date));
      } else if (shouldMergeDisplay(isSystem, isV1)) {
        // ✅ 用户账号：自动合并 v1 + v2 成长数据
        const v1Records = Array.isArray(growthRecords) ? [...growthRecords] : [];
        const v2Records = [...(v2Growth?.records || [])];
        records = mergeGrowthRecords(v1Records, v2Records);
      } else {
        // v1单独模式：只使用v1数据
        records = (Array.isArray(growthRecords) ? [...growthRecords] : []).sort((a, b) => a.date.localeCompare(b.date));
      }

      if (!Array.isArray(records) || records.length === 0) return { points: [] };

      // 提取选中指标的数据
      const points = records
        .filter(record => record[selectedGrowthMetric] != null)
        .map(record => ({
          date: record.date,
          label: record.date.substring(5), // 显示 MM-DD
          value: record[selectedGrowthMetric],
          _isV1: record._isV1 || false,
        }));

      return { points };
    } catch (error) {
      console.error('[StatsPage] 处理成长趋势数据出错:', error);
      return { points: [] };
    }
  }, [growthRecords, v2Growth, selectedGrowthMetric]);
  const getAggregationConfig = (range) => {
    switch (range) {
      case 7:
        return { groupDays: 1, labelFormat: (d) => d.substring(5) }; // 按天展示 5/1
      case 30:
        return { groupDays: 3, labelFormat: (d) => d.substring(5) }; // 每3天 5/1
      case 90:
        return { groupDays: 7, labelFormat: (d) => d.substring(5) }; // 每周 5/5
      case 180:
        return { groupDays: 15, labelFormat: (d) => d.substring(5) }; // 半个月 5/1
      case 'all':
      default:
        return { groupDays: 30, labelFormat: (d) => d.substring(0, 7).replace('-', '.') }; // 每月 2025.3
    }
  };
  
  // 心情emoji映射（根据score找最近的）
  const scoreToMood = (score) => {
    const moodScores = [
      { mood: 'excited', emoji: '🎉', score: 3 },
      { mood: 'happy', emoji: '😊', score: 2 },
      { mood: 'touched', emoji: '🥰', score: 2 },
      { mood: 'calm', emoji: '😌', score: 1 },
      { mood: 'sleepy', emoji: '😴', score: 0 },
      { mood: 'sad', emoji: '😢', score: -2 },
      { mood: 'angry', emoji: '😠', score: -3 },
      { mood: 'sick', emoji: '🤒', score: -2 },
    ];
    let closest = moodScores[0];
    let minDiff = Math.abs(score - closest.score);
    for (const m of moodScores) {
      const diff = Math.abs(score - m.score);
      if (diff < minDiff) {
        minDiff = diff;
        closest = m;
      }
    }
    return closest;
  };
  
  const moodTrackData = useMemo(() => {
    const activeMoments = hasV2Baby
      ? v2Moments.filter(m => !m.isDeleted && m.mood)
      : (moments && moments.length > 0 ? moments.filter(m => !m.isDeleted && m.mood) : []);
    
    if (activeMoments.length === 0) return { points: [], distribution: {} };
    
    const now = new Date();
    const cutoffDays = moodTimeRange === 'all' ? 365 * 10 : moodTimeRange;
    const cutoffDate = new Date(now.getTime() - cutoffDays * 24 * 60 * 60 * 1000);
    
    // 过滤时间范围内的数据
    const filtered = activeMoments.filter(m => new Date(m.date) >= cutoffDate);
    
    if (filtered.length === 0) return { points: [], distribution: {} };
    
    // 获取聚合配置
    const { groupDays, labelFormat } = getAggregationConfig(moodTimeRange);
    
    // 按粒度分组
    const groupMap = {};
    filtered.forEach(m => {
      const dateObj = new Date(m.date);
      // 计算组起始日期
      const dayOfMonth = dateObj.getDate();
      const groupStartDay = Math.floor((dayOfMonth - 1) / groupDays) * groupDays + 1;
      const groupDate = new Date(dateObj);
      groupDate.setDate(groupStartDay);
      const groupKey = groupDate.toISOString().substring(0, 10);
      
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = { scores: [], moods: [], count: 0 };
      }
      const score = moodScoreMap[m.mood] || 0;
      groupMap[groupKey].scores.push(score);
      groupMap[groupKey].moods.push(m.mood);
      groupMap[groupKey].count++;
    });
    
    // 计算每组的平均score和映射的emoji
    const points = Object.entries(groupMap)
      .map(([date, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const moodInfo = scoreToMood(avgScore);
        // 统计该组内各心情出现次数，找最常见的
        const moodCount = {};
        data.moods.forEach(m => { moodCount[m] = (moodCount[m] || 0) + 1; });
        const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0][0];
        const dominantOption = moodOptions.find(o => o.value === dominantMood) || { emoji: '😊', label: '开心' };
        
        return {
          date,
          label: labelFormat(date),
          avgScore,
          emoji: dominantOption.emoji,
          moodLabel: dominantOption.label,
          count: data.count,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // 心情分布统计（基于原始数据）
    const distribution = {};
    filtered.forEach(m => {
      distribution[m.mood] = (distribution[m.mood] || 0) + 1;
    });
    
    return { points, distribution, groupDays };
  }, [moments, v2Moments, hasV2Baby, moodTimeRange, moodScoreMap]);

  if (!displayBaby || !stats) {
    return (
      <div className="min-h-screen pb-20 flex flex-col items-center justify-center px-4">
        <div className="w-24 h-24 mx-auto mb-4 bg-cream-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <BarChart2 className="w-12 h-12 text-gray-300" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-2 text-center">
          {isSystemAccount 
            ? '系统账号暂无成长数据' 
            : '还没有成长数据哦'
          }
        </p>
        {!isSystemAccount && (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center">
            在时光轴添加记录，或切换到其他账号查看
          </p>
        )}
        {isSystemAccount && (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center">
            切换到自己的账号开始记录
          </p>
        )}
      </div>
    );
  }
  
  const moodEmojis = {
    happy: '😊 开心',
    excited: '🎉 兴奋',
    touched: '🥰 感动',
    calm: '😌 平静',
    sleepy: '😴 困倦',
    sad: '😢 难过',
    angry: '😠 生气',
    sick: '🤒 不舒服',
  };
  
  const moodFilterLabels = {
    happy: '😊',
    excited: '🎉',
    touched: '🥰',
    calm: '😌',
    sleepy: '😴',
    sad: '😢',
    angry: '😠',
    sick: '🤒',
  };
  
  // 心情轨迹状态 - 必须在条件返回之前声明

  
  // 根据时间范围确定聚合粒度
  
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
      
      {/* 头部 - 优化：左上角显示头像 */}
      <header className="bg-gradient-to-b from-[#FFF0E0] via-[#FFF8F0] to-white safe-top">
        <div className="px-4 pt-4 pb-6">
      
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* 头像显示在左上角（使用v2账号身份信息） */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-300 flex items-center justify-center text-lg overflow-hidden shadow-sm">
                {v2AccountInfo?.accountData?.avatar ? (
                  v2AccountInfo.accountData.avatar.startsWith('data:') || v2AccountInfo.accountData.avatar.startsWith('http') ? (
                    <img src={v2AccountInfo.accountData.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{v2AccountInfo.accountData.avatar}</span>
                  )
                ) : currentUser?.avatar ? (
                  currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.avatar}</span>
                  )
                ) : (
                  <span>👶</span>
                )}
              </div>
              <h1 className="text-base font-medium text-gray-600 dark:text-gray-300">
                {v2AccountInfo?.identityName || currentUser?.name || "📊 成长数据"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <TimeBlindBox moments={hasV2Baby ? v2Moments.filter(m => !m.isDeleted) : (moments || [])} babyName={v2BabyInfo?.nickname || v2BabyInfo?.name || displayBaby?.name || '宝宝'} />
            </div>
          </div>
          
          <BabyHeader />
          
          {/* 系统账号提示 */}
          {isSystemAccount && (
            <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                📌 系统示例账号，成长数据仅供参考
              </p>
            </div>
          )}
        </div>
          
      </header>
      
      {/* 统计内容 */}
      <main className="px-4 -mt-4 space-y-4 max-w-lg mx-auto">
        {/* 概览卡片 */}
        <div className="card animate-fade-in">
          <h3 
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowGrowthOverview(!showGrowthOverview)}
          >
            <TrendingUp className="w-5 h-5 text-primary-500" />
            成长概览
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showGrowthOverview ? 'rotate-180' : ''}`} />
          </h3>
          
          {showGrowthOverview && (
            <div className="grid grid-cols-2 gap-3">
            {/* 成长记录 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'timeline' })}
            >
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {stats.totalMoments}
              </p>
              <p className="text-xs text-gray-400 mt-1">成长记录</p>
            </div>
            
            {/* 珍贵照片 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'filter', filterType: 'photo' })}
            >
              <p className="text-3xl font-bold text-warm-600 dark:text-warm-400">
                {stats.photoCount}
              </p>
              <p className="text-xs text-gray-400 mt-1">珍贵照片</p>
            </div>
            
            {/* 名场面 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'filter', filterMilestone: 'all' })}
            >
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {stats.milestoneCount}
              </p>
              <p className="text-xs text-gray-400 mt-1">名场面</p>
            </div>
            
            {/* 成长天数 */}
            <div 
              className="bg-cream-50 dark:bg-gray-700 rounded-xl p-4 text-center cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onStatClick({ type: 'profile', baby: displayBaby })}
            >
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.age.totalDays}
              </p>
              <p className="text-xs text-gray-400 mt-1">成长天数</p>
            </div>
          </div>
          )}
        </div>
        
        {/* 记录类型分布 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowRecordTypes(!showRecordTypes)}
          >
            <Camera className="w-5 h-5 text-primary-500" />
            记录类型
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showRecordTypes ? 'rotate-180' : ''}`} />
          </h3>
          
          {showRecordTypes && (
            <div className="space-y-3">
            {/* 照片记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'photo' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">照片记录</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                  <div 
                    className="h-full bg-primary-400 rounded-full"
                    style={{ width: `${(stats.photoMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{stats.photoMoments}</span>
              </div>
            </div>
            
            {/* 视频记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'video' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎬</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">视频记录</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                  <div 
                    className="h-full bg-purple-400 rounded-full"
                    style={{ width: `${(stats.videoMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{stats.videoMoments}</span>
              </div>
            </div>
            
            {/* 文字记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'diary' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">文字记录</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                  <div 
                    className="h-full bg-warm-400 rounded-full"
                    style={{ width: `${(stats.diaryMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{stats.diaryMoments}</span>
              </div>
            </div>
            
            {/* 语音记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'audio' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎙️</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">语音记录</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                  <div 
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${(stats.audioMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{stats.audioMoments}</span>
              </div>
            </div>
            
            {/* 播客记录 */}
            <div 
              className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => onStatClick({ type: 'filter', filterType: 'podcast' })}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎧</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">播客记录</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                  <div 
                    className="h-full bg-purple-400 rounded-full"
                    style={{ width: `${(stats.podcastMoments / Math.max(stats.totalMoments, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{stats.podcastMoments}</span>
              </div>
            </div>
          </div>
          )}
        </div>
        
        {/* 心情轨迹区块 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowMoodTrack(!showMoodTrack)}
          >
            <span className="text-xl">📈</span>
            心情轨迹
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showMoodTrack ? 'rotate-180' : ''}`} />
          </h3>
          
          {showMoodTrack && (
            <div className="space-y-4">
              {/* 时间范围切换 */}
              <div className="flex gap-2 justify-center">
                {[7, 30, 90, 180, 'all'].map(range => (
                  <button
                    key={range}
                    onClick={() => setMoodTimeRange(range)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      moodTimeRange === range
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {range === 'all' ? '全部' : `${range}天`}
                  </button>
                ))}
              </div>
              
              {moodTrackData.points.length > 0 ? (
                <>
                  {/* SVG折线图 */}
                  <MoodCurveChart points={moodTrackData.points} moodOptions={moodOptions} />
                  
                  {/* 心情分布条 */}
                  {(() => {
                    const totalCount = Object.values(moodTrackData.distribution).reduce((a, b) => a + b, 0);
                    return (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">心情分布</p>
                        <p className="text-xs text-gray-400">共{totalCount}条记录</p>
                      </div>
                      {/* 比例进度条 */}
                      <div className="h-3 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700">
                        {Object.entries(moodTrackData.distribution)
                          .sort((a, b) => b[1] - a[1])
                          .map(([mood, count]) => {
                            const option = moodOptions.find(o => o.value === mood);
                            if (!option) return null;
                            const width = (count / totalCount) * 100;
                            const color = option.score > 0 
                              ? `rgba(34, 197, 94, ${0.4 + (option.score / 6) * 0.6})` // 绿色系
                              : `rgba(251, 146, 60, ${0.4 + (Math.abs(option.score) / 6) * 0.6})`; // 橙色系
                            return (
                              <div
                                key={mood}
                                className="relative group"
                                style={{ width: `${width}%`, minWidth: width > 0 ? '8px' : '0' }}
                              >
                                <div 
                                  className="w-full h-full transition-all"
                                  style={{ backgroundColor: color }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                    {option.emoji} {option.label}: {count}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {/* 心情标签列表 */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Object.entries(moodTrackData.distribution)
                          .sort((a, b) => b[1] - a[1])
                          .map(([mood, count]) => {
                            const option = moodOptions.find(o => o.value === mood);
                            if (!option) return null;
                            return (
                              <div 
                                key={mood}
                                className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-full"
                              >
                                <span className="text-sm">{option.emoji}</span>
                                <span className="text-xs text-gray-600 dark:text-gray-300">{count}</span>
                                <span className="text-[10px] text-gray-400">
                                  ({((count / totalCount) * 100).toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">还没有心情记录哦</p>
                  <p className="text-xs mt-1">在记录时选择心情来追踪</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 成长趋势图区块 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <h3 
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowGrowthTrack(!showGrowthTrack)}
          >
            <span className="text-xl">📊</span>
            成长趋势
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showGrowthTrack ? 'rotate-180' : ''}`} />
          </h3>
          
          {showGrowthTrack && (
            <div className="space-y-4">
              {/* 指标切换按钮 */}
              <div className="flex gap-2 justify-center flex-wrap">
                {[
                  { key: 'height', label: '身高', icon: '📏', color: 'text-rose-500' },
                  { key: 'weight', label: '体重', icon: '⚖️', color: 'text-amber-500' },
                  { key: 'headCircumference', label: '头围', icon: '🧠', color: 'text-purple-500' },
                  { key: 'footLength', label: '脚长', icon: '👣', color: 'text-emerald-500' },
                ].map(metric => (
                  <button
                    key={metric.key}
                    onClick={() => setSelectedGrowthMetric(metric.key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      selectedGrowthMetric === metric.key
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <span>{metric.icon}</span>
                    <span>{metric.label}</span>
                  </button>
                ))}
              </div>
              
              {growthTrackData.points.length > 0 ? (
                <>
                  {/* SVG折线图 */}
                  <GrowthCurveChart 
                    points={growthTrackData.points} 
                    metric={selectedGrowthMetric}
                  />
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">还没有成长记录哦</p>
                  <p className="text-xs mt-1">点击"记录成长数据"开始追踪</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* 名场面类型统计 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <h3 
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowMilestoneStats(!showMilestoneStats)}
          >
            <Star className="w-5 h-5 text-amber-500" />
            名场面统计
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showMilestoneStats ? 'rotate-180' : ''}`} />
          </h3>
          
          {showMilestoneStats && (
            <div className="space-y-3">
            {milestoneStats.length > 0 ? milestoneStats.map((ms) => (
              <div 
                key={ms.id}
                className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform rounded-lg p-1 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onStatClick({ type: 'filter', filterMilestone: ms.id })}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ms.emoji}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{ms.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div 
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(ms.count / Math.max(stats.milestoneCount, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8 font-medium text-right">{ms.count}</span>
                </div>
              </div>
            )) : (
              <div className="space-y-3">
                {getAllMilestones().map((opt) => (
                  <div key={opt.id} className="flex items-center justify-between rounded-lg p-1 -m-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-sm text-gray-400">{opt.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '0%' }} />
                      </div>
                      <span className="text-sm text-gray-400 w-8 font-medium text-right">0</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}
        </div>

        {/* 月龄神预言统计 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h3
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowPredictionStats(!showPredictionStats)}
          >
            <span className="text-xl">✨</span>
            月龄神预言
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showPredictionStats ? 'rotate-180' : ''}`} />
          </h3>

          {showPredictionStats && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg p-1 -m-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔮</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">总预言</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-purple-400 rounded-full"
                      style={{ width: predictionStats.total > 0 ? '100%' : '0%' }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8 font-medium text-right">{predictionStats.total}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg p-1 -m-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">已命中</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-green-400 rounded-full"
                      style={{ width: predictionStats.total > 0 ? `${(predictionStats.fulfilled / predictionStats.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8 font-medium text-right">{predictionStats.fulfilled}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg p-1 -m-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">命中率</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-cream-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-rose-400 rounded-full"
                      style={{ width: `${predictionStats.rate}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8 font-medium text-right">{predictionStats.rate}%</span>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* 身体成长区块 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <h3 
            className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-gray-600"
            onClick={() => setShowGrowthRecords(!showGrowthRecords)}
          >
            <span className="text-xl">📐</span>
            身体成长
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${showGrowthRecords ? 'rotate-180' : ''}`} />
          </h3>
          
          {showGrowthRecords && (
            <div className="space-y-4">
              {/* 最新数据卡片 */}
              {growthRecords.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {['height', 'weight', 'headCircumference', 'footLength'].map((field) => {
                      const latest = growthRecords[0];
                      const previous = growthRecords[1];
                      const value = latest?.[field];
                      const oldValue = previous?.[field];
                      const change = value && oldValue ? (value - oldValue).toFixed(1) : null;
                      const color = field === 'height' ? 'text-rose-400' : field === 'weight' ? 'text-amber-400' : field === 'headCircumference' ? 'text-purple-400' : 'text-emerald-400';
                      
                      return (
                        <div key={field} className="bg-cream-50 dark:bg-gray-700 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <span>{GROWTH_ICONS[field]}</span>
                            <span>{GROWTH_LABELS[field]}</span>
                          </div>
                          <p className={`text-xl font-bold text-gray-800 dark:text-white mt-1 ${color}`}>
                            {value != null ? `${value} ${GROWTH_UNITS[field]}` : '--'}
                          </p>
                          {change && (
                            <p className={`text-xs mt-0.5 ${parseFloat(change) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                              {parseFloat(change) >= 0 ? '↑' : '↓'}{Math.abs(parseFloat(change))} {GROWTH_UNITS[field]}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  
                  
                  {/* 添加记录按钮 - 系统账号禁用 */}
                  {!isSystemAccount ? (
                    <button
                      onClick={() => onAddGrowthRecord?.()}
                      className="w-full py-3 border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-xl text-primary-500 font-medium flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      记录成长数据
                    </button>
                  ) : (
                    <div className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-400 font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                      <Plus className="w-5 h-5" />
                      系统账号不可添加记录
                    </div>
                  )}
                  
                  {/* 历史记录列表 */}
                  <div className="space-y-2">
                    {(growthRecords || []).map((record, index) => (
                      <div key={record.id} className="bg-cream-50 dark:bg-gray-800 rounded-xl p-3">
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <span className="text-gray-400">📅</span>
                              {record.date}
                              {index === 0 && (
                                <span className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-xs rounded">最新</span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                              {record.height != null && (
                                <span className="flex items-center gap-0.5">{GROWTH_ICONS.height} {record.height}cm</span>
                              )}
                              {record.weight != null && (
                                <span className="flex items-center gap-0.5">{GROWTH_ICONS.weight} {record.weight}kg</span>
                              )}
                              {record.headCircumference != null && (
                                <span className="flex items-center gap-0.5">{GROWTH_ICONS.headCircumference} {record.headCircumference}cm</span>
                              )}
                              {record.footLength != null && (
                                <span className="flex items-center gap-0.5">{GROWTH_ICONS.footLength} {record.footLength}cm</span>
                              )}
                              {record.photos?.length > 0 && (
                                <span className="flex items-center gap-0.5">📷 {record.photos.length}张照片</span>
                              )}
                              {record.note && (
                                <span className="flex items-center gap-0.5">📝 {record.note}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditGrowthRecord?.(record); }}
                              className="p-2 text-gray-400 hover:text-primary-500"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(record.id); }}
                              className="p-2 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedRecordId === record.id ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        
                        {/* 展开的照片 */}
                        {expandedRecordId === record.id && record.photos?.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {record.photos.map((photo, i) => (
                              <img 
                                key={i}
                                src={photo}
                                alt=""
                                className="w-full aspect-square object-cover rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 dark:text-gray-500 mb-4">还没有成长记录哦</p>
                  <button
                    onClick={() => !isSystemAccount && onAddGrowthRecord?.()}
                    disabled={isSystemAccount}
                    className={`px-6 py-3 bg-primary-500 text-white rounded-full font-medium inline-flex items-center gap-2 ${isSystemAccount ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Plus className="w-5 h-5" />
                    记录成长数据
                  </button>
                </div>
              )}
              
              {/* 删除确认弹窗 */}
              {deleteConfirmId && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-xs w-full">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">确认删除</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">删除后将无法恢复，确定要删除这条成长记录吗？</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 font-medium"
                      >
                        取消
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { deleteGrowthRecord } = await import('../utils/db');
                            await deleteGrowthRecord(deleteConfirmId);
                            await refreshGrowthRecords();
                            showToast('已删除');
                          } catch (e) {
                            showToast('删除失败', 'error');
                          }
                          setDeleteConfirmId(null);
                        }}
                        className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* 宝宝成长档案入口 */}
        <div 
          className="card cursor-pointer active:scale-[0.98] transition-transform animate-fade-in"
          style={{ animationDelay: '0.4s' }}
          onClick={() => onOpenMonthlyReport?.()}
        >
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 cursor-pointer hover:text-gray-600">
            <BookOpen className="w-5 h-5 text-primary-500" />
            宝宝成长档案
            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
          </h3>
          <p className="text-xs text-gray-400 mt-1">查看成长档案</p>
        </div>


      </main>
    </div>
  );
}

// 心情曲线图组件（纯SVG实现 - 贝塞尔曲线版本）
function MoodCurveChart({ points, moodOptions }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  if (!points || points.length === 0) return null;
  
  // SVG配置
  const width = 320;
  const height = 200;
  const padding = { top: 25, right: 50, bottom: 40, left: 15 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Y轴范围：-3到+3
  const yMin = -3;
  const yMax = 3;
  
  // 转换为坐标
  const xScale = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * chartWidth;
  const yScale = (value) => padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
  
  // Y轴心情刻度（右侧标注）
  const moodTicks = [
    { score: 3, label: '🎉兴奋', color: '#22c55e' },
    { score: 2, label: '😊开心', color: '#4ade80' },
    { score: 0, label: '😌平静', color: '#94a3b8' },
    { score: -2, label: '😢难过', color: '#fb923c' },
    { score: -3, label: '😠生气', color: '#f97316' },
  ];
  
  // 生成贝塞尔曲线路径
  const generateBezierPath = (pts) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) {
      return `M ${xScale(0)} ${yScale(pts[0].avgScore)}`;
    }
    
    let path = `M ${xScale(0)} ${yScale(pts[0].avgScore)}`;
    
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = xScale(i);
      const y0 = yScale(pts[i].avgScore);
      const x1 = xScale(i + 1);
      const y1 = yScale(pts[i + 1].avgScore);
      
      // 控制点偏移量（曲线平滑度）
      const cpOffset = Math.min(40, Math.abs(x1 - x0) / 2);
      
      // 控制点1：前一点向右偏移
      const cp1x = x0 + cpOffset;
      const cp1y = y0;
      
      // 控制点2：后一点向左偏移
      const cp2x = x1 - cpOffset;
      const cp2y = y1;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`;
    }
    
    return path;
  };
  
  // 生成正向填充区域
  const generateAreaPath = (pts, threshold = 0) => {
    if (pts.length === 0) return '';
    const areaPoints = pts.map((p, i) => ({
      x: xScale(i),
      y: yScale(Math.max(p.avgScore, threshold))
    }));
    
    let path = `M ${areaPoints[0].x} ${areaPoints[0].y}`;
    for (let i = 0; i < areaPoints.length - 1; i++) {
      const cpOffset = Math.min(40, Math.abs(areaPoints[i + 1].x - areaPoints[i].x) / 2);
      path += ` C ${areaPoints[i].x + cpOffset} ${areaPoints[i].y}, ${areaPoints[i + 1].x - cpOffset} ${areaPoints[i + 1].y}, ${areaPoints[i + 1].x} ${areaPoints[i + 1].y}`;
    }
    
    // 封闭区域
    path += ` L ${areaPoints[areaPoints.length - 1].x} ${yScale(threshold)}`;
    path += ` L ${areaPoints[0].x} ${yScale(threshold)} Z`;
    
    return path;
  };
  
  const linePath = generateBezierPath(points);
  const positiveArea = generateAreaPath(points, 0);
  
  // 中性线位置
  const neutralY = yScale(0);
  
  // 获取线条颜色（根据趋势）
  const getLineColor = () => {
    const lastScore = points[points.length - 1]?.avgScore || 0;
    if (lastScore > 0.5) return '#22c55e'; // 绿色
    if (lastScore < -0.5) return '#f97316'; // 橙色
    return 'url(#lineGradient)'; // 渐变色
  };
  
  // 获取数据点颜色
  const getPointColor = (score) => {
    if (score > 0.5) return '#22c55e';
    if (score < -0.5) return '#f97316';
    return '#94a3b8';
  };
  
  // X轴标签（均匀分布）
  const labelCount = Math.min(points.length, 5);
  const labelIndices = [];
  if (labelCount > 1) {
    for (let i = 0; i < labelCount; i++) {
      labelIndices.push(Math.round((i * (points.length - 1)) / (labelCount - 1)));
    }
  } else if (points.length === 1) {
    labelIndices.push(0);
  }





  
  return (
    <div className="relative">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto"
        style={{ minHeight: '200px' }}
      >
        <defs>
          {/* 渐变色定义 */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="positiveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#86efac" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#86efac" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="negativeGradient" x1="0%" y1="100%" y2="0%">
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fed7aa" stopOpacity="0.1" />
          </linearGradient>
          {/* 高亮效果 */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 背景网格 */}
        <defs>
          <pattern id="moodGrid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="url(#moodGrid)" />
        
        {/* 中性线 */}
        <line 
          x1={padding.left} 
          y1={neutralY} 
          x2={width - padding.right} 
          y2={neutralY} 
          stroke="#e5e7eb" 
          strokeWidth="1.5" 
          strokeDasharray="4,4" 
        />
        
        {/* 正值区域（浅绿色填充） */}
        <path d={positiveArea} fill="url(#positiveGradient)" />
        
        {/* Y轴右侧心情刻度标注 */}
        {moodTicks.map((tick, i) => (
          <g key={i}>
            <text 
              x={width - padding.right + 3} 
              y={yScale(tick.score) + 4} 
              fontSize="9" 
              fill={tick.color}
              fontWeight="500"
            >
              {tick.label}
            </text>
          </g>
        ))}
        
        {/* 折线（贝塞尔曲线） */}
        <path 
          d={linePath} 
          fill="none" 
          stroke={getLineColor()} 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          filter={hoveredIndex !== null ? "url(#glow)" : undefined}
        />
        
        {/* 数据点 */}
        {points.map((point, i) => {
          const cx = xScale(i);
          const cy = yScale(point.avgScore);
          const isHovered = hoveredIndex === i;
          const pointColor = getPointColor(point.avgScore);
          
          return (
            <g 
              key={i}
              onMouseEnter={(e) => {
                setHoveredIndex(i);
                const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                const svgWidth = rect.width;
                const svgHeight = rect.height;
                const scaleX = svgWidth / width;
                const scaleY = svgHeight / height;
                setTooltipPos({
                  x: cx * scaleX,
                  y: cy * scaleY,
                  svgX: cx,
                  svgY: cy
                });
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* 外圈高亮 */}
              {isHovered && (
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r="10" 
                  fill={pointColor}
                  fillOpacity="0.2"
                />
              )}
              {/* 数据点 */}
              <circle 
                cx={cx} 
                cy={cy} 
                r={isHovered ? 7 : 4} 
                fill="white" 
                stroke={pointColor} 
                strokeWidth="2"
              />
            </g>
          );
        })}
        
        {/* X轴日期标签 */}
        {labelIndices.map((i) => (
          <text 
            key={i}
            x={xScale(i)} 
            y={height - 8} 
            textAnchor="middle" 
            fontSize="9" 
            fill="#6b7280"
          >
            {points[i].label}
          </text>
        ))}
      </svg>
      
      {/* Hover浮层详情 */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div 
          className="absolute z-20 bg-gray-800 text-white px-3 py-2 rounded-xl shadow-xl text-xs whitespace-nowrap transform -translate-x-1/2"
          style={{
            left: `${(tooltipPos.x / 320) * 100}%`,
            top: `${Math.max(5, (tooltipPos.y / 200) * 100 - 15)}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{points[hoveredIndex].emoji}</span>
            <div className="flex flex-col">
              <span className="text-gray-300 text-[10px]">{points[hoveredIndex].label}</span>
              <span className="font-medium">
                {points[hoveredIndex].moodLabel} 
                <span className="text-gray-400 ml-1">
                  ({points[hoveredIndex].avgScore > 0 ? '+' : ''}{points[hoveredIndex].avgScore.toFixed(1)})
                </span>
              </span>
              <span className="text-gray-400 text-[10px]">{points[hoveredIndex].count}条记录</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 成长趋势图组件
function GrowthCurveChart({ points, metric }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  if (!points || points.length === 0) return null;
  
  // SVG配置
  const width = 320;
  const height = 200;
  const padding = { top: 25, right: 50, bottom: 40, left: 15 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Y轴自动适配数据范围
  const values = points.map(p => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue;
  // 添加一些边距，避免线条贴边
  const yPadding = valueRange > 0 ? valueRange * 0.1 : 1;
  const yMin = Math.floor((minValue - yPadding) * 10) / 10;
  const yMax = Math.ceil((maxValue + yPadding) * 10) / 10;
  
  // 转换为坐标
  const xScale = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * chartWidth;
  const yScale = (value) => padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
  
  // 根据指标获取颜色和单位
  const getMetricConfig = () => {
    switch (metric) {
      case 'height':
        return { color: '#f43f5e', gradientFrom: 'rgba(244, 63, 94, 0.4)', gradientTo: 'rgba(244, 63, 94, 0.1)', unit: 'cm', label: '身高' };
      case 'weight':
        return { color: '#f59e0b', gradientFrom: 'rgba(245, 158, 11, 0.4)', gradientTo: 'rgba(245, 158, 11, 0.1)', unit: 'kg', label: '体重' };
      case 'headCircumference':
        return { color: '#a855f7', gradientFrom: 'rgba(168, 85, 247, 0.4)', gradientTo: 'rgba(168, 85, 247, 0.1)', unit: 'cm', label: '头围' };
      case 'footLength':
        return { color: '#10b981', gradientFrom: 'rgba(16, 185, 129, 0.4)', gradientTo: 'rgba(16, 185, 129, 0.1)', unit: 'cm', label: '脚长' };
      default:
        return { color: '#3b82f6', gradientFrom: 'rgba(59, 130, 246, 0.4)', gradientTo: 'rgba(59, 130, 246, 0.1)', unit: '', label: '' };
    }
  };
  
  const config = getMetricConfig();
  
  // 生成贝塞尔曲线路径
  const generateBezierPath = (pts) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) {
      return `M ${xScale(0)} ${yScale(pts[0].value)}`;
    }
    
    let path = `M ${xScale(0)} ${yScale(pts[0].value)}`;
    
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = xScale(i);
      const y0 = yScale(pts[i].value);
      const x1 = xScale(i + 1);
      const y1 = yScale(pts[i + 1].value);
      
      // 控制点偏移量（曲线平滑度）
      const cpOffset = Math.min(40, Math.abs(x1 - x0) / 2);
      
      // 控制点1：前一点向右偏移
      const cp1x = x0 + cpOffset;
      const cp1y = y0;
      
      // 控制点2：后一点向左偏移
      const cp2x = x1 - cpOffset;
      const cp2y = y1;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`;
    }
    
    return path;
  };
  
  // 生成填充区域
  const generateAreaPath = (pts) => {
    if (pts.length === 0) return '';
    const areaPoints = pts.map((p, i) => ({
      x: xScale(i),
      y: yScale(p.value)
    }));
    
    let path = `M ${areaPoints[0].x} ${areaPoints[0].y}`;
    for (let i = 0; i < areaPoints.length - 1; i++) {
      const cpOffset = Math.min(40, Math.abs(areaPoints[i + 1].x - areaPoints[i].x) / 2);
      path += ` C ${areaPoints[i].x + cpOffset} ${areaPoints[i].y}, ${areaPoints[i + 1].x - cpOffset} ${areaPoints[i + 1].y}, ${areaPoints[i + 1].x} ${areaPoints[i + 1].y}`;
    }
    
    // 封闭区域：到最后一点的底部，再回到第一点的底部
    path += ` L ${areaPoints[areaPoints.length - 1].x} ${height - padding.bottom}`;
    path += ` L ${areaPoints[0].x} ${height - padding.bottom} Z`;
    
    return path;
  };
  
  const linePath = generateBezierPath(points);
  const areaPath = generateAreaPath(points);
  
  // X轴标签（均匀分布，最多显示5个）
  const labelCount = Math.min(points.length, 5);
  const labelIndices = [];
  if (labelCount > 1) {
    for (let i = 0; i < labelCount; i++) {
      labelIndices.push(Math.round((i * (points.length - 1)) / (labelCount - 1)));
    }
  } else if (points.length === 1) {
    labelIndices.push(0);
  }
  
  // Y轴刻度（均匀分布3个刻度）
  const yTicks = [];
  for (let i = 0; i < 3; i++) {
    const value = yMin + (i * (yMax - yMin)) / 2;
    yTicks.push(value);
  }
  
  return (
    <div className="relative">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto"
        style={{ minHeight: '200px' }}
      >
        <defs>
          {/* 渐变色定义 */}
          <linearGradient id={`growthAreaGradient-${metric}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={config.color} stopOpacity="0.05" />
          </linearGradient>
          <filter id="glowGrowth">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 背景网格 */}
        <defs>
          <pattern id="growthGrid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="url(#growthGrid)" />
        
        {/* 填充区域 */}
        <path d={areaPath} fill={`url(#growthAreaGradient-${metric})`} />
        
        {/* Y轴右侧刻度标注 */}
        {yTicks.map((tick, i) => (
          <text 
            key={i}
            x={width - padding.right + 3} 
            y={yScale(tick) + 3} 
            fontSize="9" 
            fill="#6b7280"
            fontWeight="500"
          >
            {tick.toFixed(1)} {config.unit}
          </text>
        ))}
        
        {/* 折线（贝塞尔曲线） */}
        <path 
          d={linePath} 
          fill="none" 
          stroke={config.color} 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          filter={hoveredIndex !== null ? "url(#glowGrowth)" : undefined}
        />
        
        {/* 数据点 */}
        {points.map((point, i) => {
          const cx = xScale(i);
          const cy = yScale(point.value);
          const isHovered = hoveredIndex === i;
          
          return (
            <g 
              key={i}
              onMouseEnter={(e) => {
                setHoveredIndex(i);
                const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                const svgWidth = rect.width;
                const svgHeight = rect.height;
                const scaleX = svgWidth / width;
                const scaleY = svgHeight / height;
                setTooltipPos({
                  x: cx * scaleX,
                  y: cy * scaleY,
                });
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* 外圈高亮 */}
              {isHovered && (
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r="10" 
                  fill={config.color}
                  fillOpacity="0.2"
                />
              )}
              {/* 数据点 */}
              <circle 
                cx={cx} 
                cy={cy} 
                r={isHovered ? 7 : 4} 
                fill="white" 
                stroke={config.color} 
                strokeWidth="2"
              />
            </g>
          );
        })}
        
        {/* X轴日期标签 */}
        {labelIndices.map((i) => (
          <text 
            key={i}
            x={xScale(i)} 
            y={height - 8} 
            textAnchor="middle" 
            fontSize="9" 
            fill="#6b7280"
          >
            {points[i].label}
          </text>
        ))}
      </svg>
      
      {/* Hover浮层详情 */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div 
          className="absolute z-20 bg-gray-800 text-white px-3 py-2 rounded-xl shadow-xl text-xs whitespace-nowrap transform -translate-x-1/2"
          style={{
            left: `${(tooltipPos.x / 320) * 100}%`,
            top: `${Math.max(5, (tooltipPos.y / 200) * 100 - 15)}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-gray-300 text-[10px]">{points[hoveredIndex].date}</span>
              <span className="font-medium">
                {config.label}: {points[hoveredIndex].value} {config.unit}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
