/**
 * 宝宝信息卡片组件（v2 双账号版本）
 * 支持账号切换和系统账号标记
 * 支持未出生宝宝（预产期）
 */

import { memo, useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { calculateAge, getCountdown, getZodiacFromBirthOrDue, getConstellationFromBirthOrDue } from '../utils/dateUtils';
import { getCurrentBabyInfo, getAvailableAccounts, switchAccount, isSystemAccount as checkIsSystemAccount, isV1Account as checkIsV1Account } from '../utils/dbV2';

export const BabyHeader = memo(function BabyHeader({ onEditBaby, isSystemAccount, showToast }) {
  const { currentBaby, setCurrentBaby } = useApp();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [currentAccountInfo, setCurrentAccountInfo] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);

  // 监听 localStorage 变化来更新账号信息
  useEffect(() => {
    const updateAccountInfo = () => {
      const info = getCurrentBabyInfo();
      setCurrentAccountInfo(info);
      const accounts = getAvailableAccounts();
      setAvailableAccounts(accounts);
    };

    // 初始加载
    updateAccountInfo();

    // 监听 storage 事件（跨标签页同步）
    window.addEventListener('storage', updateAccountInfo);

    // 轮询更新（账号切换后）
    const interval = setInterval(updateAccountInfo, 500);

    return () => {
      window.removeEventListener('storage', updateAccountInfo);
      clearInterval(interval);
    };
  }, []);

  // 处理账号切换
  const handleSwitchAccount = (accountId) => {
    const success = switchAccount(accountId);
    if (success) {
      setShowAccountSwitcher(false);
      // 触发页面刷新账号信息
      const info = getCurrentBabyInfo();
      setCurrentAccountInfo(info);
      const accounts = getAvailableAccounts();
      setAvailableAccounts(accounts);
    }
  };

  // 显示加载状态
  if (!currentBaby && !currentAccountInfo) {
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

  // 检查是否是v1账号
  const isV1 = checkIsV1Account();
  
  // 使用 v2 账号信息或降级到 currentBaby，或显示v1账号
  const displayInfo = isV1 ? {
    name: 'v1历史数据',
    nickname: 'v1历史数据',
    avatar: '📦',
    birthDate: null,
    dueDate: null,
    gender: null,
    isSystem: false,
    isV1: true
  } : currentAccountInfo || {
    name: currentBaby?.name || '我的宝宝',
    nickname: currentBaby?.nickname || currentBaby?.name || '我的宝宝',
    avatar: currentBaby?.avatar,
    birthDate: currentBaby?.birthDate,
    dueDate: currentBaby?.dueDate || '',
    gender: currentBaby?.gender || 'girl',
    isSystem: false
  };

  // 判断是否未出生宝宝
  const isUnborn = !displayInfo.birthDate && displayInfo.dueDate;
  
  // 计算年龄或预产期倒计时
  const age = displayInfo.birthDate ? calculateAge(displayInfo.birthDate) : null;
  const countdown = isUnborn && displayInfo.dueDate ? getCountdown(displayInfo.dueDate) : null;
  
  // 计算属相和星座
  const zodiac = getZodiacFromBirthOrDue(displayInfo.birthDate, displayInfo.dueDate);
  const constellation = getConstellationFromBirthOrDue(displayInfo.birthDate, displayInfo.dueDate);
  
  const avatarUrl = displayInfo.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=200';
  const isSysAccount = displayInfo.isSystem;

  return (
    <div 
      className={`card mb-4 ${onEditBaby ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={() => {
        if (!onEditBaby) return;
        if (isSystemAccount) {
          showToast?.('系统账号不可编辑', 'error');
          return;
        }
        const babyInfo = currentAccountInfo || currentBaby;
        if (babyInfo) {
          onEditBaby(babyInfo);
        }
      }}
    >
      <div className="flex items-center gap-4">
        {/* 头像区域 */}
        <div className="relative">
          {displayInfo.isV1 ? (
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-3 border-gray-200 shadow-sm text-3xl">
              📦
            </div>
          ) : (
            <img
              src={avatarUrl}
              alt={displayInfo.nickname || displayInfo.name}
              className="w-16 h-16 rounded-full object-cover border-3 border-primary-200 shadow-sm"
            />
          )}
          {displayInfo.gender === 'girl' && (
            <span className="absolute -bottom-1 -right-1 text-lg">👧</span>
          )}
          {displayInfo.gender === 'boy' && (
            <span className="absolute -bottom-1 -right-1 text-lg">👦</span>
          )}
          {isUnborn && (
            <span className="absolute -bottom-1 -right-1 text-lg">🤰</span>
          )}
        </div>
        
        {/* 宝宝信息区域 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-white flex items-center gap-1">
              {displayInfo.nickname || displayInfo.name}
              {displayInfo.nickname && displayInfo.name && displayInfo.nickname !== displayInfo.name && (
                <span className="text-xs text-gray-400 font-normal">· {displayInfo.name}</span>
              )}
              {onEditBaby && <span className="text-xs text-primary-400">✏️</span>}
            </h2>
            {/* 系统账号标记 */}
            {isSysAccount && (
              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 text-xs rounded-full flex items-center gap-0.5">
                📌 系统示例
              </span>
            )}

          </div>
          
          {/* 年龄或预产期倒计时 */}
          {isUnborn && countdown ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              🤰 预产期倒计时 {countdown.display}
            </p>
          ) : age ? (
            <p className="text-primary-600 dark:text-primary-400 font-medium text-sm">
              {age.display}
            </p>
          ) : null}
          
          {availableAccounts.length > 1 && (
            <button
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              className="text-xs text-primary-500 hover:text-primary-600 dark:text-primary-400 flex items-center gap-1 mt-0.5"
            >
              <span>切换</span>
              <svg className={`w-3 h-3 transition-transform ${showAccountSwitcher ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 账号切换面板 */}
      {showAccountSwitcher && availableAccounts.length > 1 && (
        <div className="mt-3 pt-3 border-t border-cream-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">切换账号：</p>
          <div className="flex flex-wrap gap-2">
            {/* ✅ 简化为2个选项：系统预设 和 我的账号 */}
            
            {/* 系统预设（default） */}
            {availableAccounts.filter(a => a.isSystem).map(account => {
              const isCurrent = account.id === (currentAccountInfo?.accountId || currentBaby?.id);
              return (
                <button
                  key={account.id}
                  onClick={() => handleSwitchAccount(account.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    isCurrent
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                      : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-600'
                  }`}
                >
                  系统预设 📌
                </button>
              );
            })}
            
            {/* 我的账号（user，背后合并v1+v2） */}
            {availableAccounts.filter(a => !a.isSystem && !a.isV1).map(account => {
              const isCurrent = !isSystemAccount && !isV1;
              return (
                <button
                  key={account.id}
                  onClick={() => handleSwitchAccount(account.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    isCurrent
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                      : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-600'
                  }`}
                >
                  我的账号 👶
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
