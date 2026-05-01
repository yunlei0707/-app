/**
 * React Context - 应用状态管理
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getAllBabies,
  getCurrentBaby,
  updateSettings,
  checkAndInitSampleData,
  getMomentsByBaby,
  getCapsulesByBaby,
  getSettings as getSettingsFromDB,
  getCustomMilestones,
  applyThemePreset,
  applyCustomTheme,
} from '../utils/db';

const AppContext = createContext(null);

// 预设里程碑（不可删除）
const DEFAULT_MILESTONES = [
  { id: 'first', label: '第一次', emoji: '⭐' },
  { id: 'growth', label: '成长', emoji: '🌱' },
  { id: 'health', label: '健康', emoji: '💪' },
  { id: 'learning', label: '学习', emoji: '📚' },
  { id: 'daily', label: '日常', emoji: '✨' },
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
  const [toast, setToast] = useState(null);
  
  // 认证状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // 显示Toast
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // 获取所有可用的里程碑（预设 + 自定义）
  const getAllMilestones = useCallback(() => {
    return DEFAULT_MILESTONES.filter(m => !hiddenMilestones.includes(m.id))
      .concat(customMilestones);
  }, [customMilestones, hiddenMilestones]);

  // 初始化应用
  useEffect(() => {
    async function init() {
      try {
        // 检查登录状态
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userStr = localStorage.getItem('currentUser');
        if (loggedIn && userStr) {
          try {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            setIsLoggedIn(true);
          } catch (e) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('currentUser');
          }
        }
        
        // 检查并初始化示例数据
        await checkAndInitSampleData();
        
        // 加载数据
        const allBabies = await getAllBabies();
        const settings = await getSettingsFromDB();
        const baby = await getCurrentBaby();
        const milestones = await getCustomMilestones();
        
        setBabies(allBabies);
        setCurrentBaby(baby);
        setThemeState(settings.theme || 'light');
        setThemePreset(settings.themePreset || 'pink');
        setCustomThemeColor(settings.customThemeColor || null);
        setCustomMilestones(milestones);
        setHiddenMilestones(settings.hiddenMilestones || []);
        
        // 应用主题
        if (settings.themePreset === 'custom' && settings.customThemeColor) {
          applyCustomTheme(settings.customThemeColor);
        } else {
          applyThemePreset(settings.themePreset || 'pink');
        }
        
        // 加载动态和胶囊
        if (baby) {
          const babyMoments = await getMomentsByBaby(baby.id);
          const babyCapsules = await getCapsulesByBaby(baby.id);
          setMoments(babyMoments);
          setCapsules(babyCapsules);
        }
      } catch (error) {
        console.error('初始化失败:', error);
        showToast('初始化失败，请刷新重试', 'error');
      } finally {
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
        const babyMoments = await getMomentsByBaby(babyId);
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
      const babyMoments = await getMomentsByBaby(currentBaby.id);
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

  // 添加自定义里程碑
  const addMilestone = useCallback(async (milestone) => {
    try {
      const db = await import('../utils/db');
      const { addCustomMilestone: addMile } = await import('../utils/db');
      const newMilestone = await addMile(milestone);
      setCustomMilestones(prev => [...prev, newMilestone]);
      return newMilestone;
    } catch (error) {
      console.error('添加里程碑失败:', error);
      showToast('添加失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 更新自定义里程碑
  const updateMilestone = useCallback(async (id, updates) => {
    try {
      const { updateCustomMilestone: updateMile } = await import('../utils/db');
      const updated = await updateMile(id, updates);
      setCustomMilestones(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (error) {
      console.error('更新里程碑失败:', error);
      showToast('更新失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 删除自定义里程碑
  const deleteMilestone = useCallback(async (id) => {
    try {
      const { deleteCustomMilestone: deleteMile } = await import('../utils/db');
      await deleteMile(id);
      setCustomMilestones(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('删除里程碑失败:', error);
      showToast('删除失败', 'error');
      throw error;
    }
  }, [showToast]);

  // 隐藏/显示预设里程碑
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
      const { updateUser } = await import('../utils/db');
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
  }, []);

  // 登出处理
  const logout = useCallback(() => {
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
    toggleTheme,
    setTheme,
    showToast,
    // 里程碑相关
    customMilestones,
    hiddenMilestones,
    getAllMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneVisibility,
    // 用户资料
    updateUserProfile,
    // 认证相关
    isLoggedIn,
    currentUser,
    login,
    logout,
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
