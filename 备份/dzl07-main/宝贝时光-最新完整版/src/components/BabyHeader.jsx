/**
 * 宝宝信息卡片组件（v2 双账号版本）
 * 支持账号切换和系统账号标记
 */

import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { calculateAge } from '../utils/dateUtils';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { getIdentityData, switchAccount } from '../utils/dbV2';
import { safeGetItem } from '../utils/migration';

export function BabyHeader({ onSwitchBaby, onAddBaby }) {
  const { currentBaby, babies } = useApp();
  const [showDropdown, setShowDropdown] = useState(false);
  const [v2AccountInfo, setV2AccountInfo] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  
  // 监听 localStorage 变化来更新账号信息
  useEffect(() => {
    const updateV2Info = () => {
      try {
        const userRole = safeGetItem('user_role', { name: '访客参观' });
        if (userRole && userRole.name) {
          const identityData = getIdentityData(userRole.name);
          if (identityData && identityData.accounts) {
            const accounts = Object.values(identityData.accounts).map(acc => ({
              id: acc.id,
              name: acc.name,
              isSystem: acc.isSystem || false
            }));
            setAvailableAccounts(accounts);
            
            // 获取当前账号信息
            const currentAccountId = identityData.currentAccountId || 'user';
            const currentAccount = identityData.accounts[currentAccountId];
            if (currentAccount) {
              setV2AccountInfo({
                ...currentAccount,
                currentAccountId
              });
            }
          }
        }
      } catch (e) {
        console.warn('[BabyHeader] 更新账号信息失败:', e);
      }
    };
    
    // 初始加载
    updateV2Info();
    
    // 监听 storage 事件（跨标签页同步）
    window.addEventListener('storage', updateV2Info);
    
    // 轮询更新
    const interval = setInterval(updateV2Info, 1000);
    
    return () => {
      window.removeEventListener('storage', updateV2Info);
      clearInterval(interval);
    };
  }, []);
  
  // 处理账号切换
  const handleAccountSwitch = (accountId) => {
    try {
      const userRole = safeGetItem('user_role', { name: '访客参观' });
      if (userRole && userRole.name) {
        switchAccount(userRole.name, accountId);
        setShowDropdown(false);
        // 触发更新
        setTimeout(() => {
          const identityData = getIdentityData(userRole.name);
          const currentAccount = identityData.accounts[accountId];
          setV2AccountInfo({ ...currentAccount, currentAccountId: accountId });
        }, 100);
      }
    } catch (e) {
      console.warn('[BabyHeader] 账号切换失败:', e);
    }
  };
  
  if (!currentBaby && !v2AccountInfo) {
    return (
      <div className="card mb-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-cream-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-cream-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-4 bg-cream-200 dark:bg-gray-700 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }
  
  // 使用 v2 账号信息或降级到 currentBaby
  const displayInfo = v2AccountInfo || {
    name: currentBaby?.name || '我的宝宝',
    birthday: currentBaby?.birthDate,
    isSystem: false
  };
  
  const age = displayInfo.birthday ? calculateAge(displayInfo.birthday) : null;
  const avatarUrl = currentBaby?.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=200';
  const isSystemAccount = displayInfo.isSystem;
  
  return (
    <div className="relative">
      <div
        className="card mb-4 cursor-pointer active:scale-[0.98] transition-transform"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={currentBaby?.name || displayInfo.name}
              className="w-16 h-16 rounded-full object-cover border-3 border-primary-200 shadow-sm"
            />
            {currentBaby?.gender === 'girl' && (
              <span className="absolute -bottom-1 -right-1 text-lg">👧</span>
            )}
            {currentBaby?.gender === 'boy' && (
              <span className="absolute -bottom-1 -right-1 text-lg">👦</span>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {currentBaby?.nickname || currentBaby?.name || displayInfo.name}
              </h2>
              {/* 系统账号标记 */}
              {isSystemAccount && (
                <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 text-xs rounded-full flex items-center gap-0.5">
                  📌 示例
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </div>
            
            {age && (
              <p className="text-primary-600 dark:text-primary-400 font-medium text-sm">
                {age.display}
              </p>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {currentBaby?.name || displayInfo.name}
              {displayInfo.birthday && (
                <> · 生日 {new Date(displayInfo.birthday).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</>
              )}
            </p>
          </div>
        </div>
      </div>
      
      {/* 系统账号提示 */}
      {isSystemAccount && (
        <div className="mx-4 mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            📌 这是系统示例账号，记录了"豆芽"的成长故事。您可以切换到自己的账号或创建新的宝宝档案。
          </p>
        </div>
      )}
      
      {/* 账号切换下拉菜单 */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-card z-30 overflow-hidden animate-scale-in">
            {/* v2 双账号切换 */}
            {availableAccounts.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-cream-50 dark:bg-gray-700/50">
                  切换账号
                </div>
                {availableAccounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => handleAccountSwitch(account.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-50 dark:hover:bg-gray-700 transition-colors ${
                      v2AccountInfo?.currentAccountId === account.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-lg">
                      {account.isSystem ? '🌱' : '👶'}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-800 dark:text-white flex items-center gap-1.5">
                        {account.name}
                        {account.isSystem && <span className="text-amber-500">📌</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {account.isSystem ? '系统示例账号' : '我的账号'}
                      </p>
                    </div>
                    {v2AccountInfo?.currentAccountId === account.id && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </button>
                ))}
              </>
            )}
            
            {/* 原有的宝宝切换（如果有多个宝宝） */}
            {babies && babies.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-cream-50 dark:bg-gray-700/50 border-t border-cream-100 dark:border-gray-700">
                  切换宝宝（IndexedDB）
                </div>
                {babies.map(baby => (
                  <button
                    key={baby.id}
                    onClick={() => {
                      onSwitchBaby?.(baby.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-50 dark:hover:bg-gray-700 transition-colors ${
                      baby.id === currentBaby?.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <img
                      src={baby.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=100'}
                      alt={baby.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-800 dark:text-white">
                        {baby.nickname || baby.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {baby.name}
                      </p>
                    </div>
                    {baby.id === currentBaby?.id && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </button>
                ))}
              </>
            )}
            
            <button
              onClick={() => {
                onAddBaby?.();
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 border-t border-cream-100 dark:border-gray-700 hover:bg-cream-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center">
                <Plus className="w-5 h-5 text-gray-500" />
              </div>
              <span className="font-medium text-gray-600 dark:text-gray-300">
                添加宝宝
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
