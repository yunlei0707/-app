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
} from '../utils/db';

const AppContext = createContext(null);

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
  const [toast, setToast] = useState(null);

  // 显示Toast
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // 初始化应用
  useEffect(() => {
    async function init() {
      try {
        // 检查并初始化示例数据
        await checkAndInitSampleData();
        
        // 加载数据
        const allBabies = await getAllBabies();
        const settings = await getSettingsFromDB();
        const baby = await getCurrentBaby();
        
        setBabies(allBabies);
        setCurrentBaby(baby);
        setThemeState(settings.theme || 'light');
        
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

  // 切换主题
  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await updateSettings({ theme: newTheme });
    setThemeState(newTheme);
  }, [theme]);

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
    toast,
    switchBaby,
    refreshBabies,
    refreshMoments,
    refreshCapsules,
    toggleTheme,
    showToast,
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
