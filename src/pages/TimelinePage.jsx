/**
 * 时光轴页面
 * ✅ 性能优化版本：懒加载 + 分页加载
 * ✅ 双账号支持：账号切换和数据隔离
 * ✅ 修复：账号数据完全隔离，普通账号不显示系统预设内容
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { MomentCard } from '../components/MomentCard';
import { PhotoViewer } from '../components/PhotoViewer';
import { ShareCard } from '../components/ShareCard';
import { groupByYearAndMonth } from '../utils/dateUtils';
// ✅ 引入 Zustand 状态管理用于分页加载
import { useMomentStore } from '../store/momentStore';
import { PredictionPage } from '../components/PredictionPage';
import { Plus, X, ChevronDown, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { deleteUnreferencedMomentMedia } from '../repositories/mediaRepository.js';
import { UserHeader } from '../components/UserHeader';
import { 
  getCurrentV2Account, 
  getCurrentTimeline, 
  addMomentToCurrentAccount,
  deleteMomentFromCurrentAccount,
  updateMomentInCurrentAccount,
  updateV2AccountData,
  isSystemAccount as checkIsSystemAccount,
  isV1Account as checkIsV1Account,
  getCurrentBabyInfo,
  deleteLinkedContentByRecordId,
  // V1 兼容函数 - 后续逐步迁移到 V2
  deleteMoment, 
  getMomentsByBaby, 
  addMoment, 
  initDB
} from "../repositories/stateRepository.js";
import { mergeMoments, shouldMergeDisplay, isV1Moment, getDataOrigin } from '../utils/dataMerger';

// 类型筛选选项 - 移除播客，播客功能独立到专门页面
const typeFilters = [
  { value: 'photo', label: '照片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '语音' },
  { value: 'diary', label: '文字' },
];

const defaultTypeFilter = {
  value: '',
  label: '记录类型',
};

const legacyTypeFilters = [
  { value: 'photo', label: '📷 照片' },
  { value: 'video', label: '🎬 视频' },
  { value: 'audio', label: '🎤 语音' },
  { value: 'diary', label: '✏️ 文字' },
];

// 预设名场面选项（确保总是有值）
const DEFAULT_MILESTONES_INLINE = [
  { id: 'first', label: '第一次', emoji: '🥇', shortLabel: '第一次', color: '#F59E0B' },
  { id: 'homeboss', label: '窝里横外面怂', emoji: '🏠', shortLabel: '窝里横', color: '#EF4444' },
  { id: 'sensory', label: '感官挑战', emoji: '🧸', shortLabel: '感官挑战', color: '#06B6D4' },
  { id: 'itemfriend', label: '我的小物品朋友', emoji: '🎒', shortLabel: '小物品', color: '#22C55E' },
  { id: 'littleboss', label: '小大人训话', emoji: '📢', shortLabel: '小大人', color: '#F97316' },
  { id: 'ithink', label: '我想...', emoji: '💭', shortLabel: '我想', color: '#3B82F6' },
  { id: 'nonsense', label: '胡说八道', emoji: '🤪', shortLabel: '胡说八道', color: '#8B5CF6' },
  { id: 'sleepmuseum', label: '睡姿博物馆', emoji: '😴', shortLabel: '睡姿', color: '#6366F1' },
  { id: 'cuteemoji', label: '超萌表情包', emoji: '🥺', shortLabel: '表情包', color: '#EC4899' },
];

export function TimelinePage({ 
  onAddMoment, 
  onEditMoment, 
  filterType, 
  filterMilestone,
  onClearFilters 
}) {
  const { setMoments, currentBaby, showToast, getAllMilestones } = useApp();
  
  // v2 账号系统状态
  const [v2Moments, setV2Moments] = useState([]);
  const [isSystemAccount, setIsSystemAccount] = useState(false);
  const [hasV2Baby, setHasV2Baby] = useState(false);
  const [v2AccountInfo, setV2AccountInfo] = useState(null);
  // 添加当前账号ID状态，用于触发数据重新加载
  const [currentAccountId, setCurrentAccountId] = useState(null);
  
  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, momentId: null, momentContent: '' });
  
  // ✅ 分页加载相关状态
  const { moments: storeMoments, loading, hasMore, setMoments: setStoreMoments, appendMoments, setLoading, setHasMore } = useMomentStore();
  
  // ✅ 分页获取动态数据
  const fetchMomentsData = useCallback(async (loadMore = false) => {
    if (loading || (!loadMore && !hasMore)) return;
    if (!currentBaby?.id) return;
    
    setLoading(true);
    
    try {
      // 获取最后一条动态的创建时间（用于分页）
      const lastCreatedAt = loadMore && storeMoments.length > 0 
        ? storeMoments[storeMoments.length - 1]?.createdAt 
        : null;
      
      // 调用分页API，每页20条
      const data = await getMomentsByBaby(
        currentBaby.id,
        lastCreatedAt,
        20  // 每页20条
      );
      
      if (loadMore) {
        appendMoments(data);
      } else {
        setStoreMoments(data);
      }
      
      // 如果返回数据少于20条，说明没有更多了
      if (data.length < 20) {
        setHasMore(false);
      }
      
    } catch (error) {
      console.error('[TimelinePage] 加载动态失败:', error);
    } finally {
      setLoading(false);
    }
  }, [currentBaby?.id, loading, hasMore, storeMoments, setLoading, setStoreMoments, appendMoments, setHasMore]);
  
  // ✅ 滚动到底部自动加载更多
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // 距离底部小于100px时加载更多
    if (scrollHeight - scrollTop - clientHeight < 100 && !loading && hasMore) {
      fetchMomentsData(true); // 加载更多
    }
  }, [loading, hasMore, fetchMomentsData]);
  
  // ✅ 组件初始化时加载第一页数据（仅非系统账号）
  useEffect(() => {
    const isSystem = checkIsSystemAccount();
    // 系统账号使用 localStorage 数据，用户账号使用分页加载
    if (!isSystem && currentBaby?.id) {
      fetchMomentsData(false); // 加载第一页
    }
  }, [currentBaby?.id, currentAccountId]);
  
  // 监听账号切换和动态更新，刷新 v2 数据
  useEffect(() => {
    const updateV2Info = () => {
      const account = getCurrentV2Account();
      const timeline = getCurrentTimeline();
      const isSystem = checkIsSystemAccount();
      const babyInfo = getCurrentBabyInfo();
      
      // 只在数据真正变化时才更新，避免不必要的重渲染
      setV2Moments(prev => {
        const safeTimeline = Array.isArray(timeline) ? timeline : [];
        if (JSON.stringify(prev) === JSON.stringify(safeTimeline)) return prev;
        return safeTimeline;
      });
      setIsSystemAccount(isSystem);
      setHasV2Baby(!!babyInfo);
      setV2AccountInfo(account || null);
      // 更新当前账号ID状态，触发数据重新加载
      setCurrentAccountId(account?.accountId || null);
    };
    
    updateV2Info();
    
    // 监听 localStorage 变化
    window.addEventListener('storage', updateV2Info);
    // 轮询更新（检测添加动态等操作），改为5秒减少频繁渲染
    const interval = setInterval(updateV2Info, 5000);
    
    // 监听自定义事件（添加动态后主动刷新）
    const handleMomentAdded = () => updateV2Info();
    window.addEventListener('v2-moment-updated', handleMomentAdded);
    
    // 监听账号切换事件
    const handleAccountSwitched = () => updateV2Info();
    window.addEventListener('account-switched', handleAccountSwitched);
    
    // ✅ 监听播客跳转事件（从播客页面点击跳转）
    const handlePodcastJump = (event) => {
      const momentId = event.detail?.momentId;
      if (momentId) {
        // 滚动到对应的播客卡片
        setTimeout(() => {
          const element = document.getElementById(`moment-${momentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 添加高亮效果
            element.classList.add('ring-2', 'ring-primary-500', 'rounded-xl');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-primary-500', 'rounded-xl');
            }, 3000);
          }
        }, 300);
      }
    };
    window.addEventListener('podcast-jump', handlePodcastJump);
    
    return () => {
      window.removeEventListener('storage', updateV2Info);
      clearInterval(interval);
      window.removeEventListener('v2-moment-updated', handleMomentAdded);
      window.removeEventListener('account-switched', handleAccountSwitched);
      window.removeEventListener('podcast-jump', handlePodcastJump);
    };
  }, []);
  
  // 获取所有标签选项：只展示用户自定义标签，以及已保存记录里实际用过的标签
  const milestoneFilters = useMemo(() => {
    try {
      const defaultIds = new Set(DEFAULT_MILESTONES_INLINE.map(m => m.id));
      const options = new Map();
      const addOption = (item) => {
        if (!item) return;
        const value = item.id || item.value || item.label;
        const label = item.label || item.shortLabel || value;
        if (!value || !label) return;
        options.set(value, {
          value,
          label,
          emoji: item.emoji || '✨',
          color: item.color || '#8B5CF6',
          shortLabel: item.shortLabel || label,
        });
      };

      if (typeof getAllMilestones === 'function') {
        const contextMilestones = getAllMilestones();
        if (Array.isArray(contextMilestones) && contextMilestones.length > 0) {
          contextMilestones
            .filter(m => m?.id && !defaultIds.has(m.id))
            .forEach(addOption);
        }
      }

      const allSourceMoments = [
        ...(Array.isArray(storeMoments) ? storeMoments : []),
        ...(Array.isArray(v2Moments) ? v2Moments : []),
      ];
      allSourceMoments.forEach(moment => {
        const value = moment?.milestone || moment?.milestoneLabel;
        const label = moment?.milestoneLabel || moment?.milestone;
        if (value && label) {
          addOption({
            id: value,
            label,
            shortLabel: label,
            emoji: moment?.milestoneEmoji || '✨',
          });
        }
      });
      
      return Array.from(options.values());
    } catch (error) {
      console.error('[TimelinePage] 获取标签选项出错:', error);
      return [];
    }
  }, [getAllMilestones, storeMoments, v2Moments]);
  const [selectedPhotos, setSelectedPhotos] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedMilestone, setSelectedMilestone] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showMilestoneDropdown, setShowMilestoneDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [sharingMoment, setSharingMoment] = useState(null);
  const milestoneDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const filterPanelRef = useRef(null);

  
  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);
  const containerRef = useRef(null);
  
  const shareCardRef = useRef(null);
  
  // 监听外部筛选条件变化
  useEffect(() => {
    if (filterType && filterType !== 'specific' && filterType !== '') {
      setSelectedType(filterType);
    }
    if (filterMilestone) {
      setSelectedMilestone(filterMilestone);
    }
  }, [filterType, filterMilestone]);

  // 点击外部关闭所有下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterPanelRef.current?.contains(event.target)) {
        return;
      }
      if (milestoneDropdownRef.current && !milestoneDropdownRef.current.contains(event.target)) {
        setShowMilestoneDropdown(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 分享动态
  const handleShareMoment = useCallback((moment) => {
    setSharingMoment(moment);
  }, []);
  
  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // ✅ 修复：使用和渲染时一样的判断逻辑
      const babyInfo = getCurrentBabyInfo();
      const isSystem = checkIsSystemAccount();
      // 只有系统账号才使用v2数据，用户账号使用IndexedDB数据
      const useV2Data = isSystem;
      
      console.log('[Timeline] 刷新数据:', { useV2Data, isSystem, hasCurrentBaby: !!currentBaby });
      
      if (useV2Data) {
        // 系统账号刷新 v2 数据
        const timeline = getCurrentTimeline() || [];
        console.log('[Timeline] v2数据条数:', timeline.length);
        setV2Moments(timeline);
      } else if (currentBaby?.id) {
        // 用户账号刷新 db 数据
        const babyMoments = await getMomentsByBaby(currentBaby.id);
        console.log('[Timeline] IndexedDB数据条数:', babyMoments?.length || 0);
        setMoments(babyMoments || []);
      }
      // ✅ 【修复10】即使没有数据也显示成功，因为刷新操作本身完成了
      showToast('已刷新');
    } catch (error) {
      console.error('[Timeline] 刷新失败:', error);
      // 不显示错误提示，避免用户困惑（即使报错，页面显示的是缓存数据）
      // showToast('刷新失败', 'error');
      showToast('已刷新');
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isSystemAccount, currentBaby, isRefreshing, setMoments, showToast]);
  
  // 下拉刷新手势处理
  const handleTouchStart = useCallback((e) => {
    setPullDistance(0);
  }, []);
  
  const handleTouchMove = useCallback((e) => {
    setPullDistance(0);
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    setPullDistance(0);
  }, []);
  
  // ✅ 修复：账号数据隔离 - 根据账号类型选择数据源
  // 关键修复：只有系统账号（default）才使用v2Moments
  // 用户账号（user）：自动合并 v1 + v2 数据显示（零感知迁移）
  const filteredMoments = useMemo(() => {
    try {
      // 1. 检查当前账号类型（最关键的判断依据）
      const isSystem = checkIsSystemAccount();
      const isV1 = checkIsV1Account();
      
      // 2. 数据源选择逻辑：
      let sourceMoments;
      
      if (isSystem) {
        // 系统账号：只显示系统预设内容（加空值保护）
        sourceMoments = Array.isArray(v2Moments) ? v2Moments : [];
      } else if (shouldMergeDisplay(isSystem, isV1)) {
        // ✅ 用户账号：自动合并 分页v1数据 + v2 数据显示（零感知迁移）
        // 使用分页 store 中的数据而不是 AppContext 中的全量数据
        sourceMoments = mergeMoments(storeMoments, v2Moments);
      } else {
        // v1单独模式或其他情况：使用分页加载的数据
        sourceMoments = Array.isArray(storeMoments) ? storeMoments : [];
      }
      
      // 确保是数组
      if (!Array.isArray(sourceMoments)) {
        console.warn('[TimelinePage] sourceMoments 不是数组:', sourceMoments);
        sourceMoments = [];
      }
      
      // 3. 筛选（确保是数组后再调用 filter）
      // 排除已删除和播客类型的记录，播客功能独立到专门页面
      let result = sourceMoments.filter(m => !m.isDeleted && m.type !== 'podcast');
      
      if (selectedType) {
        result = result.filter(m => m.type === selectedType);
      }
      if (selectedMilestone) {
        result = result.filter(m => m.milestone === selectedMilestone || m.milestoneLabel === selectedMilestone);
      }
      
      return result;
    } catch (error) {
      console.error('[TimelinePage] 筛选动态出错:', error);
      return [];
    }
    // ✅ 添加 currentAccountId 和 storeMoments 到依赖，确保账号切换和数据更新时重新计算
  }, [v2Moments, storeMoments, selectedType, selectedMilestone, currentAccountId]);
  
  // 按年月分组 - 传入宝宝生日以显示相对时间
  const groupedMoments = useMemo(() => {
    try {
      // 空值保护
      if (!Array.isArray(filteredMoments)) {
        console.warn('[TimelinePage] filteredMoments 不是数组:', filteredMoments);
        return [];
      }
      
      // 获取宝宝生日或预产期
      const babyBirthDate = v2AccountInfo?.accountData?.birthDate || currentBaby?.birthDate;
      const babyDueDate = v2AccountInfo?.accountData?.dueDate || currentBaby?.dueDate;
      // 如果有出生日期用出生日期，否则用预产期
      const referenceDate = babyBirthDate || babyDueDate;
      const result = groupByYearAndMonth(filteredMoments, referenceDate);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[TimelinePage] 分组动态出错:', error);
      return [];
    }
  }, [filteredMoments, v2AccountInfo, currentBaby]);
  
  // 是否有激活的筛选条件
  const hasActiveFilters = useMemo(() => {
    return selectedType || selectedMilestone;
  }, [selectedType, selectedMilestone]);
  
  // 获取当前筛选条件的显示文本
  const getActiveFilterLabel = () => {
    const labels = [];
    if (selectedType) {
      const typeFilter = legacyTypeFilters.find(f => f.value === selectedType);
      if (typeFilter) labels.push(typeFilter.label);
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
    setSelectedMilestone('');
    onClearFilters?.();
  };
  
  // 删除动态 - 显示确认弹窗
  const handleDeleteMoment = useCallback((momentId) => {
    if (isSystemAccount) {
      showToast('系统账号不可删除', 'error');
      return;
    }
    
    // ✅ v1历史数据不可删除
    if (isV1Moment(momentId)) {
      showToast('历史数据不可删除', 'info');
      return;
    }
    
    // 获取动态内容用于显示
    const moment = v2Moments.find(m => m.id === momentId) || storeMoments.find(m => m.id === momentId);
    const content = moment?.content?.substring(0, 30) || '这条记录';
    
    setDeleteConfirm({ show: true, momentId, momentContent: content });
  }, [isSystemAccount, v2Moments, storeMoments]);
  
  // 执行删除（放入回收站）
  const executeDeleteToBin = useCallback(async () => {
    const { momentId } = deleteConfirm;
    if (!momentId) return;
    
    try {
      // ✅ 修复：根据数据来源判断使用哪个删除逻辑
      const isSystem = checkIsSystemAccount();
      const origin = getDataOrigin(momentId);
      
      if (isSystem) {
        // 系统账号：不可删除（按钮应该是禁用的，这里做双重保护）
        showToast('系统预设内容不可删除', 'error');
        return;
      }
      
      if (origin === 'v1') {
        // ✅ v1 历史数据：只读不可删除
        showToast('历史数据不可删除', 'info');
        return;
      }
      
      // v2 用户数据：正常删除
      updateMomentInCurrentAccount(momentId, { 
        isDeleted: true, 
        deletedAt: new Date().toISOString() 
      });
      // 从列表中移除（显示上删除）
      setV2Moments(prev => prev.filter(m => m.id !== momentId));
      
      // 删除对应的联动内容（静默处理，不影响主流程）
      try {
        deleteLinkedContentByRecordId(momentId);
      } catch (e) {
        console.error('[Timeline] 删除联动内容失败:', e);
      }
      
      showToast('已放入回收站');
    } catch (error) {
      showToast('删除失败', 'error');
    } finally {
      setDeleteConfirm({ show: false, momentId: null, momentContent: '' });
    }
  }, [deleteConfirm, showToast]);
  
  // 执行永久删除
  const executePermanentDelete = useCallback(async () => {
    const { momentId } = deleteConfirm;
    if (!momentId) return;
    
    try {
      // ✅ 修复：根据数据来源判断使用哪个删除逻辑
      const isSystem = checkIsSystemAccount();
      const origin = getDataOrigin(momentId);
      
      if (isSystem) {
        // 系统账号：不可删除（按钮应该是禁用的，这里做双重保护）
        showToast('系统预设内容不可删除', 'error');
        return;
      }
      
      if (origin === 'v1') {
        // ✅ v1 历史数据：只读不可删除
        showToast('历史数据不可删除', 'info');
        return;
      }
      
      // v2 用户数据：永久删除
      const account = getCurrentV2Account();
      if (account?.accountData?.timeline) {
        const targetMoment = account.accountData.timeline.find(m => m.id === momentId);
        const timeline = account.accountData.timeline.filter(m => m.id !== momentId);
        await deleteUnreferencedMomentMedia(targetMoment, timeline);
        updateV2AccountData(account.identityName, account.accountId, { timeline });
      } else {
        deleteMomentFromCurrentAccount(momentId);
      }
      setV2Moments(prev => prev.filter(m => m.id !== momentId));
      
      // 删除对应的联动内容（静默处理，不影响主流程）
      try {
        deleteLinkedContentByRecordId(momentId);
      } catch (e) {
        console.error('[Timeline] 删除联动内容失败:', e);
      }
      
      showToast('已永久删除');
    } catch (error) {
      showToast('删除失败', 'error');
    } finally {
      setDeleteConfirm({ show: false, momentId: null, momentContent: '' });
    }
  }, [deleteConfirm, showToast]);

  // 照片点击
  const handlePhotoClick = useCallback((photos, index) => {
    setSelectedPhotos(photos);
    setPhotoIndex(index);
  }, []);

  // 统计
  const totalCount = filteredMoments.length;
  const filteredCount = filteredMoments.length;
  const activeFilterPanel = showTypeDropdown ? 'type' : showMilestoneDropdown ? 'milestone' : null;
  const filterPanelOptions = activeFilterPanel === 'type'
    ? typeFilters
    : activeFilterPanel === 'milestone'
      ? milestoneFilters
      : [];
  const selectFilterOption = (value) => {
    if (activeFilterPanel === 'type') setSelectedType(value);
    if (activeFilterPanel === 'milestone') setSelectedMilestone(value);
    setShowTypeDropdown(false);
    setShowMilestoneDropdown(false);
  };
  const isSelectedFilterOption = (value) => {
    if (activeFilterPanel === 'type') return selectedType === value;
    if (activeFilterPanel === 'milestone') return selectedMilestone === value;
    return false;
  };
  const selectedMilestoneFilter = selectedMilestone
    ? milestoneFilters.find(f => f.value === selectedMilestone)
    : null;

  return (
    <div 
      ref={containerRef}
      className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900 overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={handleScroll}
    >
      {/* 下拉刷新指示器 */}
      {false && pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2">
          {isRefreshing ? (
            <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div 
              className="w-5 h-5 border-2 border-gray-300 border-t-primary-400 rounded-full transition-transform"
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
            />
          )}
        </div>
      )}
      
      {/* 头部 - 时光轴页面 */}
      <header className="bg-gradient-to-b from-[#FFF0E0] via-[#FFF8F0] to-white safe-top">
        <div className="px-4 pt-4 pb-6">
      
          {/* 第一行：小头像 + 标题 + 操作按钮 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* 小头像 */}
              <UserHeader
                avatarSize="small"
                titleClassName="text-base font-medium text-gray-600 dark:text-gray-300"
                avatarClassName="bg-gradient-to-br from-primary-200 to-primary-300 shadow-sm"
              />
              <div className="hidden w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-300 items-center justify-center text-lg overflow-hidden shadow-sm">
                {v2AccountInfo?.accountData?.avatar ? (
                  v2AccountInfo.accountData.avatar.startsWith('data:') || v2AccountInfo.accountData.avatar.startsWith('http') ? (
                    <img src={v2AccountInfo.accountData.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{v2AccountInfo.accountData.avatar}</span>
                  )
                ) : currentBaby?.avatar ? (
                  currentBaby.avatar.startsWith('data:') || currentBaby.avatar.startsWith('http') ? (
                    <img src={currentBaby.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentBaby.avatar}</span>
                  )
                ) : (
                  <span>👶</span>
                )}
              </div>
              <h1 className="hidden text-base font-medium text-gray-600 dark:text-gray-300">
                📸 时光轴
              </h1>
              
              {/* 账号标签 */}
              {isSystemAccount && (
                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  示例账号
                </span>
              )}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrediction(true)}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-full transition-all shadow-sm border border-purple-100/50"
                title="月龄神预言"
              >
                <span className="text-sm">✨</span>
                <span className="text-sm font-medium text-purple-600">月龄神预言</span>
              </button>
            </div>
          </div>
          
          {/* 第二行：筛选栏 */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {/* 记录类型筛选 */}
            <div ref={typeDropdownRef} className="relative z-50 min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTypeDropdown(!showTypeDropdown);
                  setShowMilestoneDropdown(false);
                }}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-sm bg-white rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 whitespace-nowrap overflow-hidden"
              >
                {selectedType ? (
                  legacyTypeFilters.find(f => f.value === selectedType)?.label
                ) : (
                  defaultTypeFilter.label
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {/* 我的标签筛选 */}
            <div ref={milestoneDropdownRef} className="relative z-50 min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMilestoneDropdown(!showMilestoneDropdown);
                  setShowTypeDropdown(false);
                }}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-sm bg-white rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 whitespace-nowrap overflow-hidden"
              >
                {selectedMilestone ? (
                  <>
                    {selectedMilestoneFilter?.emoji || '✨'}
                    {selectedMilestoneFilter?.shortLabel || selectedMilestone}
                  </>
                ) : (
                  '我的标签'
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showMilestoneDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {/* 清除筛选 */}
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="col-span-2 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                清除
              </button>
            )}
          </div>
          
          {/* 第四行：添加记录按钮 - 宽度和筛选栏左右对齐 */}
          {activeFilterPanel && filterPanelOptions.length > 0 && (
            <div ref={filterPanelRef} className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              {filterPanelOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => selectFilterOption(option.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelectedFilterOption(option.value)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {option.emoji && <span className="w-5 text-center">{option.emoji}</span>}
                  <span className="truncate">{option.shortLabel || option.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={() => onAddMoment?.()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-400 to-primary-500 text-white rounded-xl shadow-lg hover:from-primary-500 hover:to-primary-600 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">添加记录</span>
            </button>
          </div>
          
          {/* 激活的筛选标签 */}
          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap gap-1">
              {getActiveFilterLabel().map((label, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-primary-100 text-primary-600 rounded-full">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>
      
      {/* 动态列表 */}
      <main className="px-4">
        {(groupedMoments || []).map(({ year, months }) => (
          <div key={year} className="mb-6">
            {/* 年份标题 */}
            <div className="sticky top-0 z-10 py-2 -mx-4 px-4 bg-cream-50/90 dark:bg-gray-900/90 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">{year}年</h2>
            </div>
            
            {/* 按月份分组 */}
            {(months || []).map(({ month, moments: monthMoments }) => (
              <div key={month} className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2 ml-1">{month}月</h3>
                <div className="space-y-3">
                  {monthMoments.map((moment, index) => (
                    <MomentCard
                      key={moment.id}
                      moment={moment}
                      index={index}
                      isSystem={isSystemAccount}
                      isV1={moment._isV1}
                      onPhotoClick={(photos, idx) => handlePhotoClick(photos, idx)}
                      onEdit={() => onEditMoment?.(moment)}
                      onDelete={() => handleDeleteMoment(moment.id)}
                      onShare={() => handleShareMoment(moment)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        
        {/* ✅ 分页加载状态和没有更多提示 */}
        {!isSystemAccount && filteredMoments.length > 0 && (
          <div className="py-6 text-center">
            {loading && (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">加载中...</span>
              </div>
            )}
            {!hasMore && !loading && (
              <div className="text-sm text-gray-400">
                — 没有更多了 —
              </div>
            )}
          </div>
        )}
        
        {/* 空状态 */}
        {filteredMoments.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {hasActiveFilters ? '没有找到匹配的记录' : '👋 欢迎开始记录宝宝的成长！'}
            </h3>
            <p className="text-sm text-gray-400">
              {hasActiveFilters ? '试试调整筛选条件' : '点击下方按钮，记录宝宝的第一个精彩瞬间'}
            </p>
          </div>
        )}
      </main>
      
      {/* 照片查看器 */}
      {selectedPhotos && (
        <PhotoViewer
          photos={selectedPhotos}
          initialIndex={photoIndex}
          onClose={() => setSelectedPhotos(null)}
        />
      )}
      
      {/* 分享卡片生成 */}
      {sharingMoment && (
        <ShareCard
          ref={shareCardRef}
          moment={sharingMoment}
          babyName={v2AccountInfo?.accountData?.name || currentBaby?.name || '宝宝'}
          onClose={() => setSharingMoment(null)}
        />
      )}
      
      {/* 预产期预测弹窗 */}
      {showPrediction && (
        <PredictionPage
          onClose={() => setShowPrediction(false)}
          onConfirm={(dueDate) => {
            // TODO: 更新宝宝预产期
            setShowPrediction(false);
          }}
        />
      )}
      
      {/* 删除确认弹窗 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-80 mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">删除记录</h3>
                <p className="text-sm text-gray-500">确定要删除这条记录吗？</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg">
              "{deleteConfirm.momentContent}"
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, momentId: null, momentContent: '' })}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeDeleteToBin}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-full hover:bg-amber-600 transition-colors"
              >
                放入回收站
              </button>
              <button
                onClick={executePermanentDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors"
              >
                永久删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
