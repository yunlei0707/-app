/**
 * 给宝宝的信页面
 */

import { useState, useMemo } from 'react';
import { useApp } from '@state/store/AppContext';
import { CapsuleCard } from '@ui/components/CapsuleCard';
import { getMonthDays, formatMonth, getYear, getDate } from '@utils/dateUtils';
import { X, ChevronLeft, ChevronRight, Plus, Gift, Calendar } from 'lucide-react';
import { deleteCapsule } from '@utils/db';

export function CapsulesPage({ onClose, onAddCapsule, onEditCapsule }) {
  const { capsules, showToast, refreshCapsules } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  
  // 获取当前月的日期
  const monthDays = useMemo(() => {
    return getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth]);
  
  // 按月份筛选胶囊
  const filteredCapsules = useMemo(() => {
    if (!selectedDate) return capsules;
    
    return capsules.filter(capsule => {
      const unlockDate = new Date(capsule.unlockDate);
      return (
        unlockDate.getFullYear() === selectedDate.getFullYear() &&
        unlockDate.getMonth() === selectedDate.getMonth() &&
        unlockDate.getDate() === selectedDate.getDate()
      );
    });
  }, [capsules, selectedDate]);
  
  // 查找有胶囊的日期
  const capsuleDates = useMemo(() => {
    const dates = new Set();
    capsules.forEach(capsule => {
      const date = new Date(capsule.unlockDate);
      dates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });
    return dates;
  }, [capsules]);
  
  // 上个月
  const goToPrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };
  
  // 下个月
  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };
  
  // 选择日期
  const handleDateClick = (date) => {
    if (selectedDate && 
        selectedDate.getFullYear() === date.getFullYear() &&
        selectedDate.getMonth() === date.getMonth() &&
        selectedDate.getDate() === date.getDate()) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };
  
  // 删除胶囊
  const handleDeleteCapsule = async (id) => {

    await deleteCapsule(id);
    await refreshCapsules();
    showToast('已删除');
  };
  
  // 检查日期是否有胶囊
  const hasCapsule = (date) => {
    return capsuleDates.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
  };
  
  // 获取日期状态
  const getDateStatus = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    if (compareDate < today) return 'past';
    if (compareDate.getTime() === today.getTime()) return 'today';
    return 'future';
  };
  
  // 统计
  const stats = {
    total: capsules.length,
    unlocked: capsules.filter(c => new Date(c.unlockDate) <= new Date()).length,
    locked: capsules.filter(c => new Date(c.unlockDate) > new Date()).length,
  };
  
  return (
    <div className="fixed inset-0 bg-cream-50 dark:bg-gray-900 z-50 overflow-y-auto">
      {/* 顶部导航 */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-cream-200 dark:border-gray-700 z-10 safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={onClose} className="p-2 -ml-2">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary-500" />
            给宝宝的信
          </h2>
          <button 
            onClick={onAddCapsule}
            className="p-2 -mr-2"
          >
            <Plus className="w-6 h-6 text-primary-500" />
          </button>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto p-4">
        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-primary-600">{stats.total}</p>
            <p className="text-xs text-gray-500">全部胶囊</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-primary-500">{stats.unlocked}</p>
            <p className="text-xs text-gray-500">已解锁</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-amber-500">{stats.locked}</p>
            <p className="text-xs text-gray-500">待开封</p>
          </div>
        </div>
        
        {/* 日历 */}
        <div className="card mb-4">
          {/* 月份导航 */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={goToPrevMonth} className="p-2 -ml-2">
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h3 className="font-bold text-gray-800 dark:text-white">
              {getYear(currentMonth)}年{formatMonth(currentMonth)}
            </h3>
            <button onClick={goToNextMonth} className="p-2 -mr-2">
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          {/* 星期标题 */}
          <div className="grid grid-cols-7 mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
              <div key={day} className="text-center text-xs text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>
          
          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-1">
            {/* 填充月初空白 */}
            {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* 日期 */}
            {monthDays.map(date => {
              const status = getDateStatus(date);
              const hasCap = hasCapsule(date);
              const isSelected = selectedDate && 
                selectedDate.getFullYear() === date.getFullYear() &&
                selectedDate.getMonth() === date.getMonth() &&
                selectedDate.getDate() === date.getDate();
              
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => hasCap && handleDateClick(date)}
                  disabled={!hasCap}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all ${
                    isSelected 
                      ? 'bg-primary-500 text-white' 
                      : status === 'past'
                      ? 'text-gray-300 dark:text-gray-600'
                      : status === 'today'
                      ? 'text-primary-600 dark:text-primary-400 font-bold'
                      : 'text-gray-700 dark:text-gray-300'
                  } ${hasCap ? 'hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="text-sm">{getDate(date)}</span>
                  {hasCap && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-primary-500'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* 图例 */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary-500" />
              <span>有胶囊</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded border-2 border-primary-500" />
              <span>已选择</span>
            </div>
          </div>
        </div>
        
        {/* 胶囊列表 */}
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            {selectedDate 
              ? `${getYear(selectedDate)}年${formatMonth(selectedDate)}${getDate(selectedDate)}日的胶囊`
              : '所有胶囊'
            }
          </h3>
          
          {filteredCapsules.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-cream-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <Gift className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                {selectedDate ? '该日期暂无胶囊' : '还没有给宝宝的信'}
              </p>
              <button
                onClick={onAddCapsule}
                className="text-primary-500 font-medium"
              >
                创建第一个胶囊 →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCapsules.map(capsule => (
                <CapsuleCard
                  key={capsule.id}
                  capsule={capsule}
                  onEdit={onEditCapsule}
                  onDelete={handleDeleteCapsule}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
