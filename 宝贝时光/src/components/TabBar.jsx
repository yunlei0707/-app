/**
 * 底部导航栏组件
 */

import { memo } from 'react';
import { Home, BarChart3, Sparkles } from 'lucide-react';

const tabs = [
  { id: 'timeline', label: '时光轴', icon: Home },
  { id: 'stats', label: '成长数据', icon: BarChart3 },
  { id: 'virtual', label: '虚拟时光', icon: Sparkles },
  { id: 'profile', label: '云磊', icon: null, hasAvatar: true },
];

const TabButton = memo(({ tab, isActive, onTabChange }) => {
  // 云磊标签特殊处理，显示兔子头像
  if (tab.hasAvatar) {
    return (
      <button
        onClick={() => onTabChange(tab.id)}
        className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
          isActive 
            ? 'text-primary-500' 
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden ${isActive ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}>
          <img 
            src="https://pic1.zhimg.com/50/v2-8f60c3a050b2a6a1c44c7a0c0de71a0_r.jpg" 
            alt="兔子" 
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <span className={`text-xs mt-1 font-medium ${isActive ? '' : 'font-normal'}`}>
          {tab.label}
        </span>
      </button>
    );
  }
  
  const Icon = tab.icon;
  return (
    <button
      onClick={() => onTabChange(tab.id)}
      className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
        isActive 
          ? 'text-primary-500' 
          : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      <Icon 
        className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} 
        strokeWidth={isActive ? 2.5 : 2} 
      />
      <span className={`text-xs mt-1 font-medium ${isActive ? '' : 'font-normal'}`}>
        {tab.label}
      </span>
    </button>
  );
});

export const TabBar = memo(function TabBar({ activeTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-cream-200 dark:border-gray-700 safe-bottom z-30">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
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
