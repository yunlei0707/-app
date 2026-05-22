/**
 * 月龄神预言全屏页面
 * 基于宝宝月龄展示趣味预言
 */

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { X, Sparkles, RefreshCw } from 'lucide-react';
import { 
  getPredictionsByMonthAge,
  predictionTypes 
} from '@data/babyPredictions';
import { getCurrentBabyInfo } from '@utils/dbV2';
import { useApp } from '@state/store/AppContext';

// 根据月龄和种子随机选择
function seededRandom(seed, max) {
  const x = Math.sin(seed) * 10000;
  return Math.floor((x - Math.floor(x)) * max);
}

// 计算宝宝月龄
function calculateBabyMonthAge() {
  try {
    const babyInfo = getCurrentBabyInfo();
    if (!babyInfo?.birthDate) return 12;
    const birthDate = new Date(babyInfo.birthDate);
    const today = new Date();
    const monthsDiff = (today.getFullYear() - birthDate.getFullYear()) * 12 
      + (today.getMonth() - birthDate.getMonth());
    const dayDiff = today.getDate() - birthDate.getDate();
    return dayDiff < 0 ? Math.max(0, monthsDiff - 1) : monthsDiff;
  } catch {
    return 12;
  }
}

// 生成指定月龄的预言（随机抽取3条）
function generatePredictionsForMonth(monthAge, babyId) {
  const monthPredictions = getPredictionsByMonthAge(monthAge);
  if (monthPredictions.length === 0) return [];
  
  const seed = parseInt(babyId?.replace(/\D/g, '') || '1') + monthAge;
  const selected = [];
  const usedIndices = new Set();
  
  for (let i = 0; i < Math.min(3, monthPredictions.length); i++) {
    let index;
    let attempts = 0;
    do {
      index = seededRandom(seed + i * 7 + attempts, monthPredictions.length);
      attempts++;
    } while (usedIndices.has(index) && attempts < 20);
    
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      selected.push({
        ...monthPredictions[index],
        id: `pred_${babyId}_${monthAge}_${i}`,
        generatedAt: new Date().toISOString().split('T')[0],
        status: 'pending',
      });
    }
  }
  
  return selected;
}

// 预言卡片组件 - memo优化
const PredictionCard = memo(function PredictionCard({ prediction, babyName, monthAge, onToggleStatus }) {
  const typeConfig = predictionTypes[prediction.type] || predictionTypes.behavior;
  const statusConfig = {
    pending: { icon: '⏳', label: '等待中', color: 'text-gray-500' },
    fulfilled: { icon: '✅', label: '已应验', color: 'text-green-600' },
    failed: { icon: '❌', label: '没应验', color: 'text-red-400' },
  };
  const status = statusConfig[prediction.status] || statusConfig.pending;
  
  const handleClick = useCallback(() => {
    const order = ['pending', 'fulfilled', 'failed'];
    const next = order[(order.indexOf(prediction.status) + 1) % 3];
    onToggleStatus(prediction.id, next);
  }, [prediction.id, prediction.status, onToggleStatus]);
  
  return (
    <div 
      className={`relative p-4 rounded-2xl bg-gradient-to-r ${typeConfig.gradient} border-2 ${typeConfig.borderColor} cursor-pointer transition-colors ${
        prediction.status === 'fulfilled' ? 'ring-2 ring-green-400' : ''
      }${prediction.status === 'failed' ? ' opacity-60' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{prediction.emoji}</span>
        <span className={`text-sm font-medium ${typeConfig.iconColor} bg-white/50 px-2 py-0.5 rounded-full`}>
          {typeConfig.label}
        </span>
      </div>
      <p className="text-gray-700 text-base leading-relaxed mb-3">{prediction.content}</p>
      <div className="text-xs text-gray-400 mb-3">{babyName} · {monthAge}个月专属</div>
      <div className={`flex items-center gap-1.5 text-sm ${status.color}`}>
        <span className="text-lg">{status.icon}</span>
        <span>{status.label}</span>
      </div>
    </div>
  );
});

// 月龄按钮 - memo优化
const MonthButton = memo(function MonthButton({ month, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-colors ${
        isSelected 
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md' 
          : 'bg-white text-gray-600 hover:bg-purple-50'
      }`}
    >
      {month}月
    </button>
  );
});

export function PredictionPage({ onClose }) {
  const { showToast } = useApp();
  const [currentMonthAge] = useState(() => calculateBabyMonthAge());
  const [predictions, setPredictions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthAge);
  const [isLoading, setIsLoading] = useState(false);
  
  // 用ref缓存localStorage全量数据，避免重复parse
  const allPredictionsRef = useRef(null);
  const storageKeyRef = useRef(null);
  
  const babyInfo = useMemo(() => {
    try { return getCurrentBabyInfo(); } catch { return null; }
  }, []);
  
  const babyName = babyInfo?.name || '宝宝';
  const babyId = babyInfo?.id || 'default';
  
  // 获取/刷新缓存的全量数据
  const getAllPredictions = useCallback((forceRefresh = false) => {
    const key = `babyPredictions_${babyId}`;
    if (!forceRefresh && allPredictionsRef.current && storageKeyRef.current === key) {
      return allPredictionsRef.current;
    }
    try {
      const stored = localStorage.getItem(key);
      const data = stored ? JSON.parse(stored) : [];
      allPredictionsRef.current = data;
      storageKeyRef.current = key;
      return data;
    } catch {
      allPredictionsRef.current = [];
      storageKeyRef.current = key;
      return [];
    }
  }, [babyId]);
  
  // 保存全量数据到localStorage
  const saveAllPredictions = useCallback((data) => {
    const key = `babyPredictions_${babyId}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
      allPredictionsRef.current = data;
      storageKeyRef.current = key;
    } catch (e) {
      console.error('保存预言失败:', e);
    }
  }, [babyId]);
  
  // 切换月龄时加载（从缓存中筛选，不再重新parse）
  useEffect(() => {
    const all = getAllPredictions();
    const monthData = all.filter(p => p.monthAge === selectedMonth);
    setPredictions(monthData);
  }, [selectedMonth, getAllPredictions]);
  
  // 生成新预言
  const handleGenerate = useCallback(() => {
    const newPredictions = generatePredictionsForMonth(selectedMonth, babyId);
    
    if (newPredictions.length === 0) {
      showToast('该月龄暂无可用预言', 'error');
      return;
    }
    
    const all = getAllPredictions(true);
    const filtered = all.filter(p => p.monthAge !== selectedMonth);
    const updated = [...filtered, ...newPredictions];
    saveAllPredictions(updated);
    setPredictions(newPredictions);
    showToast('✨ 预言已生成，看看准不准！');
  }, [selectedMonth, babyId, showToast, getAllPredictions, saveAllPredictions]);
  
  // 切换预言状态
  const handleToggleStatus = useCallback((predictionId, newStatus) => {
    const all = getAllPredictions();
    const updated = all.map(p => p.id === predictionId ? { ...p, status: newStatus } : p);
    saveAllPredictions(updated);
    setPredictions(prev => prev.map(p => p.id === predictionId ? { ...p, status: newStatus } : p));
  }, [getAllPredictions, saveAllPredictions]);
  
  // 统计数据
  const stats = useMemo(() => {
    const total = predictions.length;
    const fulfilled = predictions.filter(p => p.status === 'fulfilled').length;
    const rate = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
    return { total, fulfilled, rate };
  }, [predictions]);
  
  // 月龄选择范围
  const monthOptions = useMemo(() => {
    const options = new Set();
    for (let i = 0; i <= 12; i++) options.add(i);
    for (let i = 15; i <= 24; i += 3) options.add(i);
    for (let i = 30; i <= 36; i += 6) options.add(i);
    options.add(currentMonthAge);
    return [...options].sort((a, b) => a - b);
  }, [currentMonthAge]);
  
  const handleMonthSelect = useCallback((month) => {
    setSelectedMonth(month);
  }, []);
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-indigo-50 via-purple-50 to-pink-50 z-[70] flex flex-col animate-fade-in">
      {/* 顶部导航栏 */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-lg font-bold text-gray-800">月龄神预言</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-purple-100 transition-colors">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* 月龄选择器 */}
      <div className="px-4 py-3 bg-white/50">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-sm text-gray-500 flex-shrink-0">月龄：</span>
          {monthOptions.map(month => (
            <MonthButton 
              key={month} 
              month={month} 
              isSelected={selectedMonth === month}
              onClick={() => handleMonthSelect(month)}
            />
          ))}
        </div>
      </div>
      
      {/* 当前月龄展示 */}
      <div className="px-4 py-4 text-center">
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg">
          <span className="text-3xl">👶</span>
          <div className="text-left">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {selectedMonth}个月
            </div>
            <div className="text-xs text-gray-500">{babyName}的成长预言</div>
          </div>
        </div>
      </div>
      
      {/* 预言列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">🔮</span>
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              还没有关于{selectedMonth}个月的预言
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              点击下方按钮，看看{selectedMonth}个月的宝宝会有什么神奇表现！
            </p>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              <Sparkles className="w-5 h-5" />
              生成月龄神预言
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white/80 hover:bg-white rounded-xl text-purple-600 text-sm font-medium transition-colors border border-purple-200"
            >
              <RefreshCw className="w-4 h-4" />
              换一组预言
            </button>
            {predictions.map(prediction => (
              <PredictionCard
                key={prediction.id}
                prediction={prediction}
                babyName={babyName}
                monthAge={selectedMonth}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 底部统计 */}
      {predictions.length > 0 && (
        <div className="px-4 py-3 bg-white/80 backdrop-blur-md border-t border-purple-100 safe-bottom">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">{stats.total}</div>
                <div className="text-xs text-gray-500">总预言</div>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">{stats.fulfilled}</div>
                <div className="text-xs text-gray-500">已应验</div>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600">{stats.rate}%</div>
                <div className="text-xs text-gray-500">命中率</div>
              </div>
            </div>
            {stats.fulfilled > 0 && (
              <div className="text-sm text-green-600 font-medium">🎉 太准了！</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
