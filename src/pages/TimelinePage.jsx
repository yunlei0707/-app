/**
 * 时光轴页面
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { BabyHeader } from '../components/BabyHeader';
import { MomentCard } from '../components/MomentCard';
import { PhotoViewer } from '../components/PhotoViewer';
// UserAvatar 已移除
import { groupByYearAndMonth } from '../utils/dateUtils';
import { getMomentsOnSameDayLastYear, deleteMoment, getMomentsByBaby } from '../utils/db';
import { Plus, Calendar, Clock, X } from 'lucide-react';

// 里程碑选项
const milestoneFilters = [
  { value: '', label: '里程碑' },
  { value: 'first', label: '⭐ 第一次' },
  { value: 'growth', label: '🌱 成长' },
  { value: 'health', label: '💪 健康' },
  { value: 'learning', label: '📚 学习' },
  { value: 'daily', label: '✨ 日常' },
];

// 类型筛选选项
const typeFilters = [
  { value: '', label: '类型' },
  { value: 'photo', label: '📷 照片' },
  { value: 'video', label: '🎬 视频' },
  { value: 'diary', label: '📝 日记' },
  { value: 'audio', label: '🎙️ 语音' },
];

// 心情筛选选项
const moodFilters = [
  { value: '', label: '心情' },
  { value: 'happy', label: '😊 开心' },
  { value: 'excited', label: '🎉 兴奋' },
  { value: 'touched', label: '🥰 感动' },
  { value: 'sleepy', label: '😴 困倦' },
  { value: 'crying', label: '😢 哭泣' },
  { value: 'angry', label: '😠 生气' },
];

export function TimelinePage({ 
  onAddMoment, 
  onEditMoment, 
  onSwitchBaby, 
  onAddBaby, 
  filterType, 
  filterMood, 
  filterMilestone,
  onClearFilters 
}) {
  const { moments, setMoments, currentBaby, showToast } = useApp();
  const [selectedPhotos, setSelectedPhotos] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedMilestone, setSelectedMilestone] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [showSameDay, setShowSameDay] = useState(false);
  const [sameDayMoments, setSameDayMoments] = useState([]);
  
  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);
  const containerRef = useRef(null);
  
  // 目标记录ID（用于从统计页面跳转定位）
  const targetMomentId = useRef(null);
  
  // 监听外部筛选条件变化
  useEffect(() => {
    if (filterType && filterType !== 'specific' && filterType !== '') {
      setSelectedType(filterType);
    }
    if (filterMood) {
      setSelectedMood(filterMood);
    }
    if (filterMilestone) {
      if (filterMilestone === 'all') {
        // 显示所有里程碑
        setSelectedMilestone('first'); // 先设置为第一个，后续可以改进
      } else {
        setSelectedMilestone(filterMilestone);
      }
    }
  }, [filterType, filterMood, filterMilestone]);
  
  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (!currentBaby || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const babyMoments = await getMomentsByBaby(currentBaby.id);
      setMoments(babyMoments);
      showToast('已刷新');
    } catch (error) {
      showToast('刷新失败', 'error');
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [currentBaby, isRefreshing, setMoments, showToast]);
  
  // 下拉刷新手势处理 - 更柔和
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
    
    // 只在顶部且向下拉时才处理
    if (scrollTop.current <= 0 && diff > 0) {
      // 降低灵敏度，使用阻尼效果
      const dampened = Math.min(diff * 0.3, 100);
      setPullDistance(dampened);
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing]);
  
  const handleTouchEnd = useCallback(() => {
    // 需要拉超过60px才触发刷新
    if (pullDistance > 60 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, handleRefresh]);
  
  // 筛选后的动态
  const filteredMoments = useMemo(() => {
    let result = moments;
    
    // 按类型筛选
    if (selectedType) {
      result = result.filter(m => m.type === selectedType);
    }
    
    // 按心情筛选
    if (selectedMood) {
      result = result.filter(m => m.mood === selectedMood);
    }
    
    // 按里程碑筛选
    if (selectedMilestone) {
      result = result.filter(m => m.milestone === selectedMilestone);
    }
    
    return result;
  }, [moments, selectedType, selectedMood, selectedMilestone]);
  
  // 按年月分组
  const groupedMoments = useMemo(() => {
    return groupByYearAndMonth(filteredMoments);
  }, [filteredMoments]);
  
  // 是否有激活的筛选条件
  const hasActiveFilters = useMemo(() => {
    return selectedType || selectedMood || selectedMilestone;
  }, [selectedType, selectedMood, selectedMilestone]);
  
  // 获取当前筛选条件的显示文本
  const getActiveFilterLabel = () => {
    const labels = [];
    if (selectedType) {
      const typeFilter = typeFilters.find(f => f.value === selectedType);
      if (typeFilter) labels.push(typeFilter.label);
    }
    if (selectedMood) {
      const moodFilter = moodFilters.find(f => f.value === selectedMood);
      if (moodFilter) labels.push(moodFilter.label);
    }
    if (selectedMilestone) {
      const milestoneFilter = milestoneFilters.find(f => f.value === selectedMilestone);
      if (milestoneFilter) labels.push(milestoneFilter.label);
    }
    return labels;
  };
  
  // 清除所有筛选
  const handleClearAllFilters = () => {
    setSelectedType('');
    setSelectedMood('');
    setSelectedMilestone('');
    onClearFilters?.();
  };
  
  // 检查往年今日
  const checkSameDayLastYear = async () => {
    if (!currentBaby) {
      showToast('请先创建宝宝档案', 'error');
      return;
    }
    
    const today = new Date();
    const sameDay = await getMomentsOnSameDayLastYear(currentBaby.id, today.toISOString());
    setSameDayMoments(sameDay);
    setShowSameDay(true);
  };
  
  const handlePhotoClick = (photos, index = 0) => {
    setSelectedPhotos(photos);
    setPhotoIndex(index);
  };
  
  // 删除动态
  const handleDeleteMoment = async (id) => {
    try {
      await deleteMoment(id);
      
      if (currentBaby?.id) {
        const updatedMoments = await getMomentsByBaby(currentBaby.id);
        setMoments(updatedMoments);
      }
      
      showToast('已删除');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    }
  };
  
  // 计算筛选后的记录数
  const filteredCount = filteredMoments.length;
  const totalCount = moments.length;
  
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
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg overflow-hidden">
                {currentUser?.avatar ? (
                  currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.avatar}</span>
                  )
                ) : (
                  <span>👶</span>
                )}
              </div>
              <h1 className="text-xl font-bold">宝贝时光</h1>
            </div>
            <div className="flex items-center gap-2">

              <button
                onClick={checkSameDayLastYear}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-sm hover:bg-white/30 transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">往年今日</span>
              </button>
            </div>
          </div>
          
          <BabyHeader onSwitchBaby={onSwitchBaby} onAddBaby={onAddBaby} />
          
          {/* 筛选标签区域 - 仅在有筛选条件时显示 */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4">
              {getActiveFilterLabel().map((label, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-full text-sm"
                >
                  {label}
                  <button 
                    onClick={() => {
                      if (selectedType) setSelectedType('');
                      else if (selectedMood) setSelectedMood('');
                      else if (selectedMilestone) setSelectedMilestone('');
                      // 如果清空后没有其他筛选条件，调用onClearFilters
                      if (!selectedType && !selectedMood && !selectedMilestone) {
                        onClearFilters?.();
                      }
                    }}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button 
                onClick={handleClearAllFilters}
                className="px-3 py-1.5 bg-white/10 rounded-full text-sm hover:bg-white/20 transition-colors"
              >
                清除全部
              </button>
            </div>
          )}
        </div>
      </header>
      
      {/* 筛选器 - 水平滚动 */}
      <div className="px-4 -mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-3 space-y-2">
          {/* 类型筛选 */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {typeFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setSelectedType(filter.value)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  selectedType === filter.value
                    ? 'bg-primary-500 text-white font-medium'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-cream-200 dark:hover:bg-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          {/* 心情筛选 */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {moodFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setSelectedMood(filter.value)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  selectedMood === filter.value
                    ? 'bg-warm-500 text-white font-medium'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-cream-200 dark:hover:bg-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          {/* 里程碑筛选 */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {milestoneFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setSelectedMilestone(filter.value)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  selectedMilestone === filter.value
                    ? 'bg-purple-500 text-white font-medium'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-cream-200 dark:hover:bg-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* 时光轴内容 */}
      <main className="px-4 mt-4">
        {/* 筛选结果统计 */}
        {hasActiveFilters && (
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              共找到 <span className="font-bold text-primary-500">{filteredCount}</span> 条记录
              {filteredCount !== totalCount && `（共 ${totalCount} 条）`}
            </p>
          </div>
        )}
        
        {groupedMoments.length === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-4 bg-cream-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Calendar className="w-12 h-12 text-gray-300" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              {hasActiveFilters ? '暂无符合条件的记录' : '还没有记录哦'}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {hasActiveFilters ? '试试调整筛选条件' : '点击右下角 + 按钮添加第一条记录'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-full text-sm hover:bg-primary-600 transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* 时间轴线 */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-300 via-primary-200 to-transparent" />
            
            {groupedMoments.map((group) => (
              <div key={`${group.year}-${group.month}`} className="relative mb-6">
                {/* 年月标签 */}
                <div className="sticky top-0 z-10 py-2">
                  <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-4 py-1.5 shadow-sm">
                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                      {group.year}年{group.month}月
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {group.moments.length}条记录
                    </span>
                  </div>
                </div>
                
                {/* 动态列表 */}
                <div className="ml-10">
                  {group.moments.map((moment) => (
                    <div key={moment.id} className="relative">
                      <div className="absolute -left-8 top-4 w-3 h-3 rounded-full bg-white border-2 border-primary-400 shadow-sm" />
                      
                      <MomentCard
                        moment={moment}
                        onEdit={onEditMoment}
                        onDelete={handleDeleteMoment}
                        onClick={handlePhotoClick}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* 往年今日弹窗 */}
      {showSameDay && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setShowSameDay(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl max-h-[70vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-cream-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">
                  🕰️ 往年今日
                </h3>
                <button 
                  onClick={() => setShowSameDay(false)}
                  className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4">
              {sameDayMoments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  去年今天没有记录，继续创造回忆吧~
                </p>
              ) : (
                sameDayMoments.map(moment => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    onClick={handlePhotoClick}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 照片查看器 */}
      {selectedPhotos && (
        <PhotoViewer
          photos={selectedPhotos}
          initialIndex={photoIndex}
          onClose={() => setSelectedPhotos(null)}
        />
      )}
      
      {/* 右下角添加按钮 */}
      <button
        onClick={onAddMoment}
        className="fixed right-4 bottom-20 w-14 h-14 bg-gradient-to-br from-primary-500 to-warm-500 rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform hover:shadow-xl"
      >
        <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
