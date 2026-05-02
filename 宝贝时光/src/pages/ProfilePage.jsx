/**
 * 个人中心页面
 */

import { useState, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { Moon, Sun, Download, Trash2, ChevronRight, Heart } from 'lucide-react';
import { exportAllData, deleteBaby, getAllBabies, getMomentsByBaby, getCapsulesByBaby } from '../utils/db';

export function ProfilePage({ onEditBaby }) {
  const { 
    currentBaby, 
    babies,
    setBabies,
    setMoments,
    setCapsules,
    theme, 
    toggleTheme, 
    showToast
  } = useApp();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);
  const containerRef = useRef(null);
  
  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const allBabies = await getAllBabies();
      setBabies(allBabies);
      
      if (currentBaby?.id) {
        const [updatedMoments, updatedCapsules] = await Promise.all([
          getMomentsByBaby(currentBaby.id),
          getCapsulesByBaby(currentBaby.id)
        ]);
        setMoments(updatedMoments);
        setCapsules(updatedCapsules);
      }
      
      showToast('已刷新');
    } catch (error) {
      showToast('刷新失败', 'error');
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [currentBaby, isRefreshing, setBabies, setMoments, setCapsules, showToast]);
  
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
  
  // 导出数据
  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `宝贝时光备份_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('数据导出成功！');
    } catch (error) {
      showToast('导出失败，请重试', 'error');
    }
  };
  
  // 删除宝宝
  const handleDeleteBaby = async () => {
    if (!currentBaby) return;
    
    try {
      await deleteBaby(currentBaby.id);
      const allBabies = await getAllBabies();
      setBabies(allBabies);
      setShowDeleteConfirm(false);
      showToast('已删除');
      window.location.reload();
    } catch (error) {
      showToast('删除失败', 'error');
    }
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
          <h1 className="text-xl font-bold mb-4">👤 我的</h1>
          
          {/* 宝宝信息 */}
          {currentBaby && (
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <img
                  src={currentBaby.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=200'}
                  alt={currentBaby.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white"
                />
                <div className="flex-1">
                  <h2 className="text-lg font-bold">{currentBaby.nickname || currentBaby.name}</h2>
                  <p className="text-white/80 text-sm">{currentBaby.name}</p>
                </div>
                <button
                  onClick={() => onEditBaby(currentBaby)}
                  className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                >
                  编辑
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      
      {/* 功能列表 */}
      <main className="px-4 -mt-4 max-w-lg mx-auto">
        {/* 其他宝宝 */}
        {babies.length > 1 && (
          <div className="card mb-4 animate-fade-in">
            <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">其他宝宝档案</h3>
            {babies
              .filter(b => b.id !== currentBaby?.id)
              .map(baby => (
                <div key={baby.id} className="flex items-center gap-3 py-2">
                  <img
                    src={baby.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=100'}
                    alt={baby.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <span className="text-gray-700 dark:text-gray-200">{baby.nickname || baby.name}</span>
                </div>
              ))
            }
          </div>
        )}
        
        {/* 设置 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">设置</h3>
          
          {/* 主题切换 */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-primary-500" />
              ) : (
                <Sun className="w-5 h-5 text-warm-500" />
              )}
              <span className="text-gray-700 dark:text-gray-200">
                {theme === 'dark' ? '深色模式' : '浅色模式'}
              </span>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
              theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300'
            }`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </button>
        </div>
        
        {/* 数据管理 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">数据管理</h3>
          
          {/* 导出数据 */}
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-green-500" />
              <span className="text-gray-700 dark:text-gray-200">导出全部数据</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          
          {/* 删除档案 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between py-3 hover:bg-red-50 dark:hover:bg-red-900/20 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span className="text-red-500">删除宝宝档案</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* 关于 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">关于</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700 dark:text-gray-200">版本</span>
              <span className="text-gray-500">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700 dark:text-gray-200">存储方式</span>
              <span className="text-gray-500">本地 IndexedDB</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-cream-50 dark:bg-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
              <Heart className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>
                宝贝时光是一款纯本地存储的应用，所有数据仅保存在您的设备中，
                不上传至任何服务器，充分保护您的隐私。
              </span>
            </p>
          </div>
        </div>
        
        {/* 底部信息 */}
        <div className="text-center py-8 text-gray-400 text-sm">
          <p>Made with ❤️ for families</p>
          <p className="mt-1">© 2024 宝贝时光</p>
        </div>
      </main>
      
      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-6 animate-bounce-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white text-center mb-2">
              确定要删除吗？
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
              删除"{currentBaby?.name}"的档案将同时删除所有相关记录，此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleDeleteBaby}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
