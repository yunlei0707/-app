/**
 * 账号切换器组件
 * 在时光轴页面顶部显示，切换系统宝宝和我的宝宝
 */

import { useState, useEffect, useRef } from 'react';
import { Users, ChevronDown, Pin } from 'lucide-react';
import { safeGetItem } from '../utils/migration';
import { getIdentityData, switchAccount, getCurrentAccount } from '../utils/dbV2';

export function AccountSwitcher({ onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [accounts, setAccounts] = useState({});
  const dropdownRef = useRef(null);

  // 获取当前身份
  const userRole = safeGetItem('user_role', { name: '访客参观' });
  const identityName = userRole.name;

  // 加载数据
  useEffect(() => {
    const identityData = getIdentityData(identityName);
    setAccounts(identityData.accounts);
    setCurrentAccount(identityData.accounts[identityData.currentAccountId]);
  }, [identityName]);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 切换账号
  const handleSwitch = (accountId) => {
    switchAccount(identityName, accountId);
    const identityData = getIdentityData(identityName);
    setCurrentAccount(identityData.accounts[accountId]);
    setIsOpen(false);
    
    if (onChange) {
      onChange(identityData.accounts[accountId]);
    }
  };

  if (!currentAccount) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-all duration-200 active:scale-95"
      >
        <Users className="w-4 h-4 text-pink-500" />
        <span className="font-medium text-gray-700 text-sm">
          {currentAccount.avatar} {currentAccount.name}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* 下拉选择框 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {Object.values(accounts).map((account) => (
            <button
              key={account.id}
              onClick={() => handleSwitch(account.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                currentAccount.id === account.id ? 'bg-pink-50' : ''
              }`}
            >
              <span className="text-xl">{account.avatar}</span>
              <div className="flex-1">
                <div className="font-medium text-gray-800 flex items-center gap-1">
                  {account.name}
                  {account.isSystem && (
                    <Pin className="w-3 h-3 text-pink-500" />
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {account.isSystem ? '系统示例账号' : '我的宝宝'}
                </div>
              </div>
              {currentAccount.id === account.id && (
                <div className="w-2 h-2 rounded-full bg-pink-500"></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountSwitcher;
