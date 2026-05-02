/**
 * 宝宝信息卡片组件
 */

import { useApp } from '../store/AppContext';
import { calculateAge } from '../utils/dateUtils';

export function BabyHeader({ onSwitchBaby, onAddBaby }) {
  const { currentBaby, babies } = useApp();
  
  if (!currentBaby) {
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
  
  const age = calculateAge(currentBaby.birthDate);
  
  const avatarUrl = currentBaby.avatar || 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=200';
  
  return (
    <div>
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={currentBaby.name}
              className="w-16 h-16 rounded-full object-cover border-3 border-primary-200 shadow-sm"
            />
            {currentBaby.gender === 'girl' && (
              <span className="absolute -bottom-1 -right-1 text-lg">👧</span>
            )}
            {currentBaby.gender === 'boy' && (
              <span className="absolute -bottom-1 -right-1 text-lg">👦</span>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {currentBaby.nickname || currentBaby.name}
              </h2>
            </div>
            <p className="text-primary-600 dark:text-primary-400 font-medium text-sm">
              {age.display}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {currentBaby.name} · 生日 {new Date(currentBaby.birthDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
