/**
 * 用户头部组件 - 统一展示登录身份的头像和名称
 * 用于四个主页面（时光轴、虚拟时光、成长数据、我的）
 */

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { getCurrentV2Account } from "../repositories/stateRepository.js";

// 获取当前用户的头像和名称
function useCurrentUser() {
  const [userInfo, setUserInfo] = useState({
    avatar: null,
    name: null,
  });

  useEffect(() => {
    const updateUserInfo = () => {
      // 优先使用登录页保存的身份信息，回退到 v2 账号。
      const v2Account = getCurrentV2Account();
      
      try {
        const userStr = localStorage.getItem('currentUser');
        const user = userStr ? JSON.parse(userStr) : null;
        const avatar = user?.avatar || v2Account?.accountData?.avatar || null;
        const name = user?.name || user?.nickname || user?.username || v2Account?.identityName || null;

        setUserInfo({ avatar, name });
      } catch (e) {
        console.error('解析 currentUser 失败:', e);
        setUserInfo({
          avatar: v2Account?.accountData?.avatar || null,
          name: v2Account?.identityName || null,
        });
      }
    };

    // 初始加载
    updateUserInfo();

    // 监听变化
    window.addEventListener('storage', updateUserInfo);
    const interval = setInterval(updateUserInfo, 300);

    return () => {
      window.removeEventListener('storage', updateUserInfo);
      clearInterval(interval);
    };
  }, []);

  return userInfo;
}

// 渲染头像
function renderAvatar(avatar, size = 'normal', className = '') {
  const sizeClasses = {
    small: 'w-8 h-8 text-sm',
    normal: 'w-10 h-10 text-lg',
    large: 'w-12 h-12 text-xl',
  };

  const containerClass = `${sizeClasses[size]} rounded-full bg-white/20 flex items-center justify-center overflow-hidden ${className}`;

  if (!avatar) {
    return (
      <div className={containerClass}>
        <User className="w-5 h-5" />
      </div>
    );
  }

  // 如果是 emoji 或普通文本
  if (!avatar.startsWith('data:') && !avatar.startsWith('http')) {
    return (
      <div className={containerClass}>
        <span>{avatar}</span>
      </div>
    );
  }

  // 如果是图片 URL 或 base64
  return (
    <div className={containerClass}>
      <img src={avatar} alt="" className="w-full h-full object-cover" />
    </div>
  );
}

// 用户头部组件
export function UserHeader({ 
  title, 
  showTitle = true,
  showSettingsButton = false,
  onSettingsClick,
  showThemeToggle = false,
  theme,
  onThemeToggle,
  avatarSize = 'normal',
  avatarClassName = '',
  titleClassName = 'text-xl font-bold text-white',
  className = ''
}) {
  const { avatar, name } = useCurrentUser();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 头像 */}
      {renderAvatar(avatar, avatarSize, avatarClassName)}
      
      {/* 标题 */}
      {showTitle && (
        <h1 className={titleClassName}>
          {title || name || '用户'}
        </h1>
      )}

      {/* 默认内容填充 */}
      <div className="flex-1" />

      {/* 设置按钮 */}
      {showSettingsButton && onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

      {/* 主题切换按钮 */}
      {showThemeToggle && onThemeToggle && (
        <button
          onClick={onThemeToggle}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// 导出渲染头像的函数供其他组件使用
export { renderAvatar };
