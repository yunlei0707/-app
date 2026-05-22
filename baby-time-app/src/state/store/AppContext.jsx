/**
 * React Context - 应用状态管理
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getPerformanceConfig, getDeviceLevel, setCache, getCache } from '@utils/performance';
import {
  getAllBabies,
  getBabiesByUser,
  getCurrentBaby,
  updateSettings,
  checkAndInitSampleData,
  getMomentsByBaby,
  getCapsulesByBaby,
  getSettings as getSettingsFromDB,
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
} from '@utils/db';

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
  const [moments, setMoments] = useState([]);
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

  // 初始化应用
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
        
        // 加载数据
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
        
        // 加载动态和胶囊（如果有宝宝）
        // 性能优化：只加载最新的20条动态，后续滚动按需加载
        if (baby) {
          try {
            const [babyMoments, babyCapsules] = await Promise.all([
              getMomentsByBaby(baby.id, 0, 20),  // 只加载最新20条
              getCapsulesByBaby(baby.id)
            ]);
            setMoments(babyMoments);
            setCapsules(babyCapsules);
          } catch (e) {
            console.error('加载动态和胶囊失败:', e);
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
  }, []);

  // 应用主题
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // 切换宝宝
  const switchBaby = useCallback(async (babyId) => {
    try {
      await updateSettings({ currentBabyId: babyId });
      const baby = babies.find(b => b.id === babyId);
      if (baby) {
        setCurrentBaby(baby);
        // 性能优化：只加载最新20条
        const babyMoments = await getMomentsByBaby(babyId, 0, 20);
        const babyCapsules = await getCapsulesByBaby(babyId);
        setMoments(babyMoments);
        setCapsules(babyCapsules);
      }
    } catch (error) {
      console.error('切换宝宝失败:', error);
      showToast('切换失败', 'error');
    }
  }, [babies, showToast]);

  // 刷新宝宝列表
  const refreshBabies = useCallback(async () => {
    const allBabies = await getAllBabies();
    setBabies(allBabies);
  }, []);

  // 刷新动态
  const refreshMoments = useCallback(async () => {
    if (currentBaby) {
      // 性能优化：只加载最新20条
      const babyMoments = await getMomentsByBaby(currentBaby.id, 0, 20);
      setMoments(babyMoments);
    }
  }, [currentBaby]);

  // 刷新胶囊
  const refreshCapsules = useCallback(async () => {
    if (currentBaby) {
      const babyCapsules = await getCapsulesByBaby(currentBaby.id);
      setCapsules(babyCapsules);
    }
  }, [currentBaby]);

  // 刷新成长记录
  const refreshGrowthRecords = useCallback(async (babyId) => {
    let id = babyId || currentBaby?.id;
    if (!id) {
      // v2系统：从getCurrentBabyInfo获取
      try {
        const babyInfo = JSON.parse(localStorage.getItem('baby-timeline-v2') || '{}');
        const identity = localStorage.getItem('currentIdentity');
        if (identity && babyInfo[identity]) {
          const accId = babyInfo[identity].currentAccountId;
          if (accId) id = accId;
        }
      } catch (e) {}
    }
    console.log('[AppContext] refreshGrowthRecords, id:', id);
    if (id) {
      const records = await getGrowthRecordsByBaby(id);
      console.log('[AppContext] growthRecords loaded:', records.length, records);
      setGrowthRecords(records);
    } else {
      console.log('[AppContext] refreshGrowthRecords: no babyId found');
      // 最后尝试直接查所有记录
      try {
        const allRecords = await getGrowthRecordsByBaby('user');
        console.log('[AppContext] fallback user records:', allRecords.length);
        if (allRecords.length > 0) setGrowthRecords(allRecords);
      } catch(e) {}
    }
  }, [currentBaby]);

  // 添加动态
  const addMomentToContext = useCallback(async (momentData) => {
    try {
      const newMoment = await addMoment(momentData);
      setMoments(prev => [newMoment, ...prev]);
      return newMoment;
    } catch (error) {
      console.error('添加动态失败:', error);
      showToast('添加失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 删除宝宝
  const deleteBaby = useCallback(async (babyId) => {
    await deleteBaby(babyId);
    await refreshBabies();
    // 如果删除的是当前宝宝，切换到第一个宝宝
    if (currentBaby?.id === babyId) {
      const allBabies = await getAllBabies();
      if (allBabies.length > 0) {
        await switchBaby(allBabies[0].id);
      } else {
        setCurrentBaby(null);
        setMoments([]);
        setCapsules([]);
      }
    }
  }, [currentBaby, refreshBabies, switchBaby]);

  // 切换主题（深色/浅色）
  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await updateSettings({ theme: newTheme });
    setThemeState(newTheme);
  }, [theme]);

  // 切换主题预设
  const setTheme = useCallback(async (preset, customColor = null) => {
    await updateSettings({ 
      themePreset: preset,
      customThemeColor: customColor,
    });
    setThemePreset(preset);
    setCustomThemeColor(customColor);
    
    if (preset === 'custom' && customColor) {
      applyCustomTheme(customColor);
    } else {
      applyThemePreset(preset);
    }
  }, []);

  // 添加自定义名场面
  const addMilestone = useCallback(async (milestone) => {
    try {
      // db already imported at top
      // addCustomMilestone already imported at top
      const newMilestone = await addCustomMilestone(milestone);
      setCustomMilestones(prev => [...prev, newMilestone]);
      return newMilestone;
    } catch (error) {
      console.error('添加名场面失败:', error);
      showToast('添加失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 更新自定义名场面
  const updateMilestone = useCallback(async (id, updates) => {
    try {
      // updateCustomMilestone already imported at top
      const updated = await updateCustomMilestone(id, updates);
      setCustomMilestones(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (error) {
      console.error('更新名场面失败:', error);
      showToast('更新失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 删除自定义名场面
  const deleteMilestone = useCallback(async (id) => {
    try {
      // deleteCustomMilestone already imported at top
      await deleteCustomMilestone(id);
      setCustomMilestones(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('删除名场面失败:', error);
      showToast('删除失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 添加自定义心情标签
  const addMood = useCallback(async (mood) => {
    try {
      const newMood = await addCustomMood(mood);
      setCustomMoods(prev => [...prev, newMood]);
      return newMood;
    } catch (error) {
      console.error('添加心情标签失败:', error);
      showToast('添加失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 更新自定义心情标签
  const updateMood = useCallback(async (id, updates) => {
    try {
      const updated = await updateCustomMood(id, updates);
      setCustomMoods(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (error) {
      console.error('更新心情标签失败:', error);
      showToast('更新失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 删除自定义心情标签
  const deleteMood = useCallback(async (id) => {
    try {
      await deleteCustomMood(id);
      setCustomMoods(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('删除心情标签失败:', error);
      showToast('删除失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 隐藏/显示预设名场面
  const toggleMilestoneVisibility = useCallback(async (milestoneId, hidden) => {
    const newHidden = hidden 
      ? [...hiddenMilestones, milestoneId]
      : hiddenMilestones.filter(id => id !== milestoneId);
    
    await updateSettings({ hiddenMilestones: newHidden });
    setHiddenMilestones(newHidden);
  }, [hiddenMilestones]);

  // 更新用户资料
  const updateUserProfile = useCallback(async (updates) => {
    if (!currentUser) return;
    
    try {
      // updateUser already imported at top
      const updatedUser = await updateUser(currentUser.id, updates);
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      console.error('更新用户资料失败:', error);
      showToast('更新失败', 'error');
      throw error;
    }
  }, [currentUser, showToast]);

  // 登录处理
  const login = useCallback((user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(user));
    // 更新记住的用户
    localStorage.setItem('rememberedUser', JSON.stringify(user));
  }, []);

  // 登出处理
  const logout = useCallback(() => {
    // 记住当前用户，下次打开自动登录
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      localStorage.setItem('rememberedUser', userStr);
    }
    setCurrentUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
  }, []);

  const value = {
    isLoading,
    babies,
    setBabies,
    currentBaby,
    setCurrentBaby,
    moments,
    setMoments,
    capsules,
    setCapsules,
    theme,
    themePreset,
    customThemeColor,
    toast,
    switchBaby,
    refreshBabies,
    refreshMoments,
    refreshCapsules,
    addMoment: addMomentToContext,
    deleteBaby,
    toggleTheme,
    setTheme,
    showToast,
    // 名场面相关
    customMilestones,
    hiddenMilestones,
    getAllMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneVisibility,
    // 心情标签相关
    customMoods,
    getAllMoods,
    addMood,
    updateMood,
    deleteMood,
    // 用户资料
    updateUserProfile,
    // 认证相关
    isLoggedIn,
    currentUser,
    login,
    logout,
    // ✅ 性能配置
    perfConfig,
    deviceLevel: perfConfig.level,
    // 成长记录
    growthRecords,
    refreshGrowthRecords,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * 使用应用上下文
 */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
