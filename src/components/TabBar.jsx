/**
 * 底部导航栏组件 v2.5.4
 * 
 * 底部导航栏组件
 */

import { memo } from 'react';
import { Home, BarChart3, Mic, Sparkles, User } from 'lucide-react';

const tabs = [
  { id: 'timeline', label: '时光轴', icon: Home },
  { id: 'stats', label: '成长数据', icon: BarChart3 },
  { id: 'podcast', label: '宝宝播客', icon: Mic },
  { id: 'virtual', label: '未来宝宝', icon: Sparkles },
  { id: 'profile', label: '我的', icon: User },
];

const TabButton = memo(({ tab, isActive, onTabChange }) => {
  const isEmoji = typeof tab.icon === 'string';
  return (
    <button
      onClick={() => onTabChange(tab.id)}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${isActive ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'}`}
    >
      {/* 圆形图标容器 */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
        isActive ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700'
      }`}>
        {isEmoji ? (
          <span className={`text-sm transition-transform ${isActive ? 'scale-110' : ''}`}>
            {tab.icon}
          </span>
        ) : (
          <tab.icon 
            className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} 
            strokeWidth={isActive ? 2.5 : 2} 
          />
        )}
      </div>
      {/* 文字在最底部 */}
      <span className={`text-xs font-medium ${isActive ? '' : 'font-normal'}`}>
        {tab.label}
      </span>
    </button>
  );
});

export const TabBar = memo(function TabBar({ activeTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-cream-200 dark:border-gray-700 z-40">
      <div className="flex items-stretch h-16 max-w-lg mx-auto relative">
        {tabs.map(tab => (
          <TabButton 
            key={tab.id} 
            tab={tab} 
            isActive={activeTab === tab.id} 
            onTabChange={onTabChange} 
          />
        ))}
      </div>
    </nav>
  );
});
