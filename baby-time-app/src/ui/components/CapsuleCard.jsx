/**
 * 给宝宝的信卡片组件
 */

import { useState, useEffect } from 'react';
import { getCountdown, formatDateFull } from '@utils/dateUtils';
import { Gift, Lock, Unlock, Calendar, Trash2 } from 'lucide-react';

export function CapsuleCard({ capsule, onUnlock, onDelete }) {
  const [countdown, setCountdown] = useState(getCountdown(capsule.unlockDate));
  const [showContent, setShowContent] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // 检查是否已解锁
  useEffect(() => {
    const checkUnlock = () => {
      const now = new Date();
      const unlockDate = new Date(capsule.unlockDate);
      if (now >= unlockDate) {
        setIsUnlocked(true);
        setCountdown({ expired: true, display: '已解锁' });
      }
    };
    checkUnlock();
    
    // 每分钟更新倒计时
    const interval = setInterval(checkUnlock, 60000);
    return () => clearInterval(interval);
  }, [capsule.unlockDate]);
  
  const handleUnlock = () => {
    if (!isUnlocked) {
      alert('还没到开启时间哦，请耐心等待~');
      return;
    }
    setShowContent(true);
    onUnlock?.(capsule);
  };
  
  const handleDelete = () => {
    if (confirm('确定要删除这个给宝宝的信吗？')) {
      onDelete(capsule.id);
    }
  };
  
  return (
    <>
      <div 
        className={`card relative overflow-hidden transition-all duration-300 ${
          isUnlocked ? 'border-2 border-primary-300' : ''
        }`}
      >
        {/* 解锁动画背景 */}
        {isUnlocked && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-warm-50 dark:from-primary-900/10 dark:to-warm-900/10 animate-pulse" />
        )}
        
        <div className="relative">
          {/* 头部 */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isUnlocked ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-cream-100 dark:bg-gray-700'
              }`}>
                {isUnlocked ? (
                  <Unlock className="w-5 h-5 text-primary-500" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white">
                  {capsule.title || '给宝宝的信'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateFull(capsule.unlockDate)}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDelete}
              className="p-2 -mr-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {/* 预览内容 */}
          {capsule.content && (
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-2">
              {capsule.content}
            </p>
          )}
          
          {/* 媒体预览 */}
          {capsule.photos && capsule.photos.length > 0 && (
            <div className="flex gap-2 mb-3">
              {capsule.photos.slice(0, 3).map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ))}
              {capsule.photos.length > 3 && (
                <div className="w-16 h-16 rounded-lg bg-cream-100 dark:bg-gray-700 flex items-center justify-center text-sm text-gray-500">
                  +{capsule.photos.length - 3}
                </div>
              )}
            </div>
          )}
          
          {/* 倒计时/状态 */}
          <div className="flex items-center justify-between pt-3 border-t border-cream-100 dark:border-gray-700">
            <div className={`flex items-center gap-2 ${isUnlocked ? 'text-primary-500' : 'text-gray-500'}`}>
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">
                {countdown.display}
              </span>
            </div>
            
            <button
              onClick={handleUnlock}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isUnlocked
                  ? 'bg-primary-500 text-white hover:bg-primary-600 active:scale-95'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isUnlocked}
            >
              <Gift className="w-4 h-4" />
              {isUnlocked ? '开启胶囊' : '待开封'}
            </button>
          </div>
          
          {/* 未解锁时的装饰锁链 */}
          {!isUnlocked && (
            <div className="absolute -right-4 -top-4 opacity-20">
              <Lock className="w-20 h-20 text-gray-400" />
            </div>
          )}
        </div>
      </div>
      
      {/* 解锁内容弹窗 */}
      {showContent && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowContent(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-6 animate-bounce-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-400 to-warm-400 rounded-full flex items-center justify-center animate-wiggle">
                <Gift className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                🎉 胶囊已开启！
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {formatDateFull(capsule.unlockDate)}
              </p>
            </div>
            
            {capsule.content && (
              <div className="bg-cream-50 dark:bg-gray-700 rounded-2xl p-4 mb-4">
                <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                  {capsule.content}
                </p>
              </div>
            )}
            
            {capsule.photos && capsule.photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {capsule.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt=""
                    className="w-full aspect-square rounded-xl object-cover"
                  />
                ))}
              </div>
            )}
            
            <button
              onClick={() => setShowContent(false)}
              className="w-full btn-primary"
            >
              太棒了！
            </button>
          </div>
        </div>
      )}
    </>
  );
}
