/**
 * 宝宝信息卡片组件
 */

import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { calculateAge } from '../utils/dateUtils';
import { ChevronDown, Plus, Check } from 'lucide-react';

export function BabyHeader({ onSwitchBaby, onAddBaby }) {
  const { currentBaby, babies } = useApp();
  const [showDropdown, setShowDropdown] = useState(false);
  
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
    <div className="relative">
      <div 
        className="card mb-4 cursor-pointer active:scale-[0.98] transition-transform"
        onClick={() => setShowDropdown(!showDropdown)}
      >
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
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
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
      
      {/* 宝宝切换下拉菜单 */}
      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-20" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-card z-30 overflow-hidden animate-scale-in">
            {babies.map(baby => (
              <button
                key={baby.id}
                onClick={() => {
                  onSwitchBaby(baby.id);
                  setShowDropdown(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-50 dark:hover:bg-gray-700 transition-colors ${
                  baby.id === currentBaby.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
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
                {baby.id === currentBaby.id && (
                  <Check className="w-5 h-5 text-primary-500" />
                )}
              </button>
            ))}
            <button
              onClick={() => {
                onAddBaby();
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
