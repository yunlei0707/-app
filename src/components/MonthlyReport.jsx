/**
 * 宝宝成长档案组件
 * 支持多时间范围选择，展示数据+故事双线报告
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Camera, Video, FileText, Mic, Star, Share2, Download, Sparkles, Heart, TrendingUp, BookOpen } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getGrowthReportStats } from '../utils/db';
import { 
  getCurrentV2Account, 
  getCurrentBabyInfo,
  getCurrentTimeline,
  isSystemAccount as checkIsSystemAccount 
} from '../utils/dbV2';
import html2canvas from 'html2canvas';

export function GrowthReport({ onClose }) {
  const { currentBaby, showToast } = useApp();
  
  // 时间范围选择
  const [range, setRange] = useState('1month');
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // v2 账号数据
  const [isV2Account, setIsV2Account] = useState(false);
  const [v2BabyInfo, setV2BabyInfo] = useState(null);
  
  // 分享功能
  const [shareImage, setShareImage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const shareCardRef = useRef(null);
  
  // 时间范围选项
  const rangeOptions = [
    { value: '1month', label: '近1月' },
    { value: '3months', label: '近3月' },
    { value: '1year', label: '近1年' },
    { value: 'all', label: '全部' },
  ];
  
  // 时间范围对应的文案
  const rangeLabels = {
    '1month': '近一个月',
    '3months': '近三个月',
    '1year': '近一年',
    'all': '全部时光'
  };
  
  // 范围文本（用于寄语）
  const rangeTextMap = {
    '1month': '一个月',
    '3months': '三个月',
    '1year': '一年',
    'all': '这段时间'
  };
  
  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      // 获取 v2 账号状态
      const account = getCurrentV2Account();
      const isV2 = checkIsSystemAccount();
      const babyInfo = getCurrentBabyInfo();
      setIsV2Account(isV2);
      setV2BabyInfo(babyInfo);
      
      if (!currentBaby?.id && !babyInfo?.id) return;
      
      setIsLoading(true);
      try {
        const babyId = babyInfo?.id || currentBaby.id;
        const birthDate = babyInfo?.birthDate || currentBaby.birthDate;
        const data = await getGrowthReportStats(babyId, range, birthDate);
        setStats(data);
        // 数据加载完成后播放BGM
        if (data && data.totalMoments > 0) {
        }
      } catch (error) {
        console.error('加载成长档案失败:', error);
        showToast('加载失败', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [currentBaby, range]);
  
  // 静音切换, []);
  
  // 宝宝名字
  const babyName = v2BabyInfo?.nickname || v2BabyInfo?.name || currentBaby?.nickname || currentBaby?.name || '宝宝';
  
  // 心情Emoji
  const moodEmojis = {
    happy: '😊',
    excited: '🎉',
    touched: '🥰',
    sleepy: '😴',
    crying: '😢',
    angry: '😠',
  };
  
  // 名场面emoji
  const milestoneEmojis = {
    first: '👶',
    growth: '🌱',
    health: '💪',
    achievement: '🏆',
    memory: '📸',
  };
  
  // 生成时光寄语
  const timeMessage = useMemo(() => {
    if (!stats) return '';
    
    const { totalMoments, milestoneCount, firstMilestones } = stats;
    const rangeText = rangeTextMap[range] || '这段时间';
    
    // 优先规则：第一次名场面
    if (firstMilestones && firstMilestones.length > 0) {
      return `这${rangeText}，${babyName}又解锁了${firstMilestones.length}个第一次，每一步都值得被记住。`;
    }
    
    // 名场面数>=3
    if (milestoneCount >= 3) {
      return `这${rangeText}，${babyName}达成了${milestoneCount}个名场面，成长的速度让人惊叹！`;
    }
    
    // 记录数>=10
    if (totalMoments >= 10) {
      return `这${rangeText}一共记录了${totalMoments}条时光，每一刻都是爱的印记。`;
    }
    
    // 记录数>0
    if (totalMoments > 0) {
      return `虽然记录不多，但每一刻都珍贵。继续陪伴，继续记录❤️`;
    }
    
    // 没有记录
    return `还没有记录，但爱一直在。现在就开始记录吧✨`;
  }, [stats, range, babyName]);
  
  // 生成分享图片
  const generateShareImage = useCallback(async () => {
    if (!shareCardRef?.current) return;
    
    setGenerating(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fef7f5',
        scale: 2,
        logging: false
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      setShareImage(dataUrl);
    } catch (error) {
      console.error('生成分享图片失败:', error);
      showToast('生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  }, []);
  
  // 下载图片
  const downloadImage = useCallback(() => {
    if (!shareImage) return;
    
    const link = document.createElement('a');
    link.download = `${babyName}_成长档案_${Date.now()}.png`;
    link.href = shareImage;
    link.click();
  }, [shareImage, babyName]);
  
  // 关闭弹窗
  const handleClose = useCallback(() => {
    setShareImage(null);
    onClose();
  }, [onClose]);
  
  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };
  
  // 获取代表时刻的缩略图
  const getRepresentativeThumb = () => {
    if (!stats?.representativeMoment) return null;
    const m = stats.representativeMoment;
    if (m.photos && m.photos.length > 0) {
      return m.photos[0];
    }
    if (m.type === 'photo' && m.photoUrl) {
      return m.photoUrl;
    }
    return null;
  };
  
  // 计算关键词字体大小
  const getKeywordSize = (count, maxCount) => {
    const minSize = 12;
    const maxSize = 24;
    const ratio = maxCount > 1 ? (count - 2) / (maxCount - 2) : 0;
    return minSize + (maxSize - minSize) * ratio;
  };
  
  const maxKeywordCount = stats?.keywords?.[0]?.count || 1;

  return (
    <div 
      className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col"
      onClick={handleClose}
    >
      <div 
        className="flex-1 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 - 主色深浅渐变 */}
        <div className="bg-gradient-to-r from-primary-200 to-primary-300 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            宝宝成长档案
          </h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleClose}
              className="p-2 -mr-2 text-gray-600 hover:text-gray-800 hover:bg-white/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 时间范围选择 */}
        <div className="px-4 py-3 bg-white/50 dark:bg-gray-800/50">
          <div className="flex gap-2">
            {rangeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  range === option.value
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-cream-200 dark:hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* 分享卡片预览（用于截图） */}
              <div ref={shareCardRef} className="bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50 p-4">
                {/* 时光寄语 */}
                <div className="text-center mb-4">
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-200 italic px-4">
                    "{timeMessage}"
                  </p>
                </div>
                
                {/* 标题 */}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                    {babyName}的成长档案
                  </h3>
                  <p className="text-sm text-gray-500">{rangeLabels[range]}</p>
                </div>

                {/* 统计卡片 */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-sm">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl p-3 text-center">
                      <Camera className="w-5 h-5 mx-auto mb-1 text-primary-600" />
                      <p className="text-xl font-bold text-gray-800">{stats.photoCount}</p>
                      <p className="text-xs text-gray-600">照片</p>
                    </div>
                    <div className="bg-gradient-to-br from-primary-200 to-amber-200 rounded-xl p-3 text-center">
                      <Video className="w-5 h-5 mx-auto mb-1 text-primary-600" />
                      <p className="text-xl font-bold text-gray-800">{stats.videoCount}</p>
                      <p className="text-xs text-gray-600">视频</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl p-3 text-center">
                      <FileText className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                      <p className="text-xl font-bold text-gray-800">{stats.diaryCount}</p>
                      <p className="text-xs text-gray-600">文字</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-200 to-warm-200 rounded-xl p-3 text-center">
                      <Mic className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                      <p className="text-xl font-bold text-gray-800">{stats.audioCount}</p>
                      <p className="text-xs text-gray-600">语音</p>
                    </div>
                  </div>
                  {/* 成长天数 */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary-500" />
                    <span className="text-sm text-gray-600">
                      共记录 <span className="font-bold text-primary-600">{stats.rangeDays}</span> 天
                    </span>
                  </div>
                </div>

                {/* 第一次的感动 */}
                {stats.firstMilestones && stats.firstMilestones.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-sm">
                    <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      第一次的感动
                    </h4>
                    <div className="space-y-2">
                      {stats.firstMilestones.slice(0, 3).map((m, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                          <span className="text-xl">
                            {m.milestoneEmoji || '👶'}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 dark:text-white text-sm">
                              {m.milestoneLabel || '新的第一次'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(m.date)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 代表时刻 */}
                {stats.representativeMoment && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-sm">
                    <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-primary-500" />
                      代表时刻
                    </h4>
                    <div className="bg-gradient-to-br from-primary-50 to-amber-50 rounded-xl p-3">
                      <div className="flex gap-3">
                        {getRepresentativeThumb() && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                              src={getRepresentativeThumb()} 
                              alt="代表时刻"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3">
                            {stats.representativeMoment.content || '这一刻值得被记住...'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(stats.representativeMoment.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 成长关键词 */}
                {stats.keywords && stats.keywords.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-sm">
                    <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-primary-500" />
                      成长关键词
                    </h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {stats.keywords.map((kw, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full"
                          style={{ fontSize: getKeywordSize(kw.count, maxKeywordCount) }}
                        >
                          {kw.word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 名场面事件 */}
                {stats.milestones && stats.milestones.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-sm">
                    <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      名场面达成
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {stats.milestones.slice(0, 5).map((m, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm flex items-center gap-1"
                        >
                          {m.milestoneEmoji || '⭐'} {m.milestoneLabel || '名场面'}
                        </span>
                      ))}
                      {stats.milestones.length > 5 && (
                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full text-sm">
                          +{stats.milestones.length - 5}个
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 心情分布 */}
                {Object.keys(stats.moodStats || {}).length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-sm">
                    <h4 className="font-bold text-gray-800 dark:text-white mb-3">心情分布</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.moodStats).map(([mood, count]) => (
                        <span 
                          key={mood}
                          className="px-3 py-1.5 bg-cream-100 dark:bg-gray-700 rounded-full text-sm flex items-center gap-1"
                        >
                          {moodEmojis[mood] || '😊'} {count}次
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 空状态 */}
                {stats.totalMoments === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-lg">🌱</p>
                    <p className="text-gray-500 mt-2">还没有记录哦~</p>
                    <p className="text-sm text-gray-400 mt-1">快去创造美好的回忆吧！</p>
                  </div>
                )}

                {/* 水印 */}
                <div className="text-center mt-4 text-xs text-gray-400">
                  记录于 #宝贝时光
                </div>
              </div>
              
              {/* 操作区 */}
              <div className="p-4 space-y-3">
                {/* 分享图片按钮 */}
                {stats.totalMoments > 0 && !shareImage && (
                  <button
                    onClick={generateShareImage}
                    disabled={generating}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    生成图片
                  </button>
                )}
                
                {/* 下载/复制按钮 */}
                {shareImage && (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadImage}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      保存图片
                    </button>
                    <button
                      onClick={() => setShareImage(null)}
                      className="px-4 btn-secondary"
                    >
                      关闭
                    </button>
                  </div>
                )}
                
                {/* 返回按钮 */}
                <button
                  onClick={handleClose}
                  className="w-full py-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  返回
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 导出别名，保持向后兼容
export const MonthlyReport = GrowthReport;
