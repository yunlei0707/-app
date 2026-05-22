/**
 * React Context - 应用状态管理
 * ✅ 生产级优化：移除应用启动时的 getMomentsByBaby 调用，避免卡死
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getPerformanceConfig, getDeviceLevel, setCache, getCache } from '../utils/performance';
import {
  getAllBabies,
  getBabiesByUser,
  getCurrentBaby,
  updateSettings,
  checkAndInitSampleData,
  getCapsulesByBaby,
  getSettings,
  getCustomMilestones,
  getCustomMoods,
  applyThemePreset,
  applyCustomTheme,
  addCustomMilestone,
  updateCustomMilestone,
  deleteCustomMilestone,
  addCustomMood,
  updateCustomMood,
  deleteCustomMood,
  updateUser,
  deleteBaby,
  addMoment,
  getGrowthRecordsByBaby,
} from '../repositories/stateRepository';

// 别名兼容（避免重命名）
const getSettingsFromDB = getSettings;

const AppContext = createContext(null);

// 预设名场面（不可删除）
const DEFAULT_MOODS = [
  { id: 'happy', label: '开心', emoji: '😊' },
  { id: 'excited', label: '兴奋', emoji: '🎉' },
  { id: 'touched', label: '感动', emoji: '🥰' },
  { id: 'sleepy', label: '困倦', emoji: '😴' },
  { id: 'crying', label: '哭泣', emoji: '😢' },
  { id: 'angry', label: '生气', emoji: '😠' },
];

// 预设名场面（不可删除）
const DEFAULT_MILESTONES = [
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

/**
 * 应用状态Provider
 */
export function AppProvider({ children }) {
  // 状态
  const [isLoading, setIsLoading] = useState(true);
  const [babies, setBabies] = useState([]);
  const [currentBaby, setCurrentBaby] = useState(null);
  // ✅ 生产级优化：moments 状态移至 TimelinePage 组件内或使用 Zustand
  // 避免应用启动时阻塞加载
  const [capsules, setCapsules] = useState([]);
  const [theme, setThemeState] = useState('light');
  const [themePreset, setThemePreset] = useState('pink');
  const [customThemeColor, setCustomThemeColor] = useState(null);
  const [customMilestones, setCustomMilestones] = useState([]);
  const [hiddenMilestones, setHiddenMilestones] = useState([]);
  const [customMoods, setCustomMoods] = useState([]);
  const [toast, setToast] = useState(null);
  const [growthRecords, setGrowthRecords] = useState([]);
  
  // 认证状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // ✅ 性能配置：根据设备等级自动降级
  const perfConfig = useMemo(() => getPerformanceConfig(), []);

  // 显示Toast
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // 获取所有可用的名场面（预设 + 自定义）
  const getAllMilestones = useCallback(() => {
    const hidden = Array.isArray(hiddenMilestones) ? hiddenMilestones : [];
    const custom = Array.isArray(customMilestones) ? customMilestones : [];
    return DEFAULT_MILESTONES.filter(m => !hidden.includes(m.id))
      .concat(custom);
  }, [customMilestones, hiddenMilestones]);

  // 获取所有可用的心情（预设 + 自定义）
  const getAllMoods = useCallback(() => {
    const custom = Array.isArray(customMoods) ? customMoods : [];
    return DEFAULT_MOODS.concat(custom);
  }, [customMoods]);

  // 刷新胶囊列表
  const refreshCapsules = useCallback(async (babyId) => {
    if (!babyId) return;
    try {
      const babyCapsules = await getCapsulesByBaby(babyId);
      setCapsules(babyCapsules);
    } catch (e) {
      console.error('加载胶囊失败:', e);
    }
  }, []);

  // 刷新成长记录
  const refreshGrowthRecords = useCallback(async (babyId) => {
    if (!babyId) return;
    try {
      const records = await getGrowthRecordsByBaby(babyId);
      setGrowthRecords(records);
    } catch (e) {
      console.error('加载成长记录失败:', e);
    }
  }, []);

  // ✅ 生产级优化：应用初始化
  // 移除启动时的 getMomentsByBaby 调用，改为在 TimelinePage 组件内按需加载
  useEffect(() => {
    async function init() {
      try {
        // 检查登录状态
        let loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        let userStr = localStorage.getItem('currentUser');
        
        // 未登录但有记住的用户 → 自动登录
        if (!loggedIn || !userStr) {
          const rememberedStr = localStorage.getItem('rememberedUser');
          if (rememberedStr) {
            try {
              const rememberedUser = JSON.parse(rememberedStr);
              // 恢复登录状态
              localStorage.setItem('isLoggedIn', 'true');
              localStorage.setItem('currentUser', rememberedStr);
              loggedIn = true;
              userStr = rememberedStr;
            } catch (e) {
              localStorage.removeItem('rememberedUser');
            }
          }
        }
        
        let currentUserId = null;
        if (loggedIn && userStr) {
          try {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            setIsLoggedIn(true);
            currentUserId = user.id;
          } catch (e) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('currentUser');
          }
        }
        
        // 检查并初始化示例数据（带超时保护）
        if (currentUserId) {
          try {
            await Promise.race([
              checkAndInitSampleData(currentUserId),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
          } catch (e) {
            console.log('示例数据初始化超时或失败，继续加载');
          }
        }
        
        // 加载基础数据（不包含动态数据，动态数据在页面内按需加载）
        const allBabies = currentUserId ? await getBabiesByUser(currentUserId) : await getAllBabies();
        const settings = await getSettingsFromDB();
        const baby = await getCurrentBaby();
        const milestones = await getCustomMilestones();
        const moods = await getCustomMoods();
        
        setBabies(allBabies);
        setCurrentBaby(baby);
        setThemeState(settings.theme || 'light');
        setThemePreset(settings.themePreset || 'pink');
        setCustomThemeColor(settings.customThemeColor || null);
        setCustomMilestones(milestones);
        setCustomMoods(moods);
        setHiddenMilestones(settings.hiddenMilestones || []);
        
        // 应用主题
        if (settings.themePreset === 'custom' && settings.customThemeColor) {
          applyCustomTheme(settings.customThemeColor);
        } else {
          applyThemePreset(settings.themePreset || 'pink');
        }
        
        // ✅ 只加载胶囊数据，不加载动态数据（动态在页面内按需加载）
        if (baby) {
          try {
            const babyCapsules = await getCapsulesByBaby(baby.id);
            setCapsules(babyCapsules);
          } catch (e) {
            console.error('加载胶囊失败:', e);
          }
        }
        
      } catch (error) {
        console.error('初始化失败:', error);
        showToast('部分数据加载失败，请刷新重试', 'error');
      } finally {
        // 确保无论成功失败，都要结束加载状态
        setIsLoading(false);
      }
    }
    init();
  }, [showToast, refreshCapsules]);

  // Context value
  const value = {
    // 状态
    isLoading,
    babies,
    currentBaby,
    setCurrentBaby,
    capsules,
    setCapsules,
    theme,
    themePreset,
    customThemeColor,
    customMilestones,
    hiddenMilestones,
    customMoods,
    toast,
    growthRecords,
    setGrowthRecords,
    
    // 认证
    isLoggedIn,
    setIsLoggedIn,
    currentUser,
    setCurrentUser,
    login: (user) => {
      setCurrentUser(user);
      setIsLoggedIn(true);
    },
    
    // 方法
    showToast,
    getAllMilestones,
    getAllMoods,
    refreshCapsules,
    refreshGrowthRecords,
    setBabies,
    
    // 性能配置
    perfConfig,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
