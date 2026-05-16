/**
 * 右上角用户头像组件
 * 展示登录用户信息，点击可展开用户菜单
 */

import { useState, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { LogOut, Settings, User } from 'lucide-react';

export function UserAvatar({ compact = false }) {
  const { currentUser, logout } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      logout();
      window.location.href = '/login';
    }
  };

  // 获取显示名称
  const displayName = currentUser.nickname || currentUser.username || '用户';
  const username = currentUser.username || '';

  return (
    <div className="relative" ref={menuRef}>
      {/* 头像按钮 */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/20 transition-colors"
        title={displayName}
      >
        <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center overflow-hidden border border-white/50 shadow-sm">
          {currentUser.avatar ? (
            currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
              <img 
                src={currentUser.avatar} 
                alt="" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <span className="text-lg">{currentUser.avatar}</span>
            )
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </div>
        {!compact && (
          <span className="text-white text-sm font-medium hidden sm:block max-w-[80px] truncate">
            {displayName}
          </span>
        )}
      </button>

      {/* 下拉菜单 */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-fade-in">
          {/* 用户信息头部 */}
          <div className="px-4 py-3 bg-gradient-to-r from-primary-400 to-primary-500">
            <p className="text-white font-medium truncate">{displayName}</p>
            <p className="text-white/70 text-xs truncate">@{username}</p>
          </div>
          
          {/* 菜单项 */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserAvatar;
