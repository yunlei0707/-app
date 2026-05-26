/**
 * 分享卡片组件
 * 接收动态数据，渲染成漂亮的卡片，然后用html2canvas转成图片
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, Image as ImageIcon, Music, Video, Camera, BookOpen } from 'lucide-react';
import { getMediaDisplaySrc, normalizeMomentMedia } from '../repositories/mediaRepository.js';

// 心情图标映射
const moodIcons = {
  happy: '😊',
  excited: '🎉',
  touched: '🥹',
  calm: '😌',
  sad: '😢',
  angry: '😠',
  surprised: '😲',
  love: '❤️',
};

// 名场面图标映射
const milestoneIcons = {
  first: '⭐',
  growth: '🌱',
  daily: '📅',
  special: '✨',
};

export function ShareCard({ 
  visible, 
  onClose, 
  moment = null,
  babyName = '宝宝',
  date = '',
  content = '',
  type = 'photo',
  thumbnail = '',
  mood = 'happy',
  milestone = 'daily',
  milestoneLabel = '',
}) {
  const [generating, setGenerating] = useState(false);
  const [shareImage, setShareImage] = useState(null);
  const [resolvedThumbnail, setResolvedThumbnail] = useState('');
  const cardRef = useRef(null);
  const media = useMemo(() => moment ? normalizeMomentMedia(moment) : null, [moment]);
  const displayType = moment?.type || (media?.videos?.length ? 'video' : media?.photos?.length ? 'photo' : media?.audios?.length ? 'audio' : type);
  const displayContent = moment?.content || moment?.podcast?.description || content;
  const displayDate = moment?.date || date;
  const displayMood = moment?.mood || mood;
  const displayMilestone = moment?.milestone || milestone;
  const displayMilestoneLabel = moment?.milestoneLabel || milestoneLabel;
  const isVisible = visible ?? !!moment;

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    async function loadThumbnail() {
      const candidate = thumbnail ||
        media?.photos?.[0]?.path ||
        media?.photos?.[0]?.url ||
        media?.videos?.[0]?.cover ||
        media?.videos?.[0]?.coverPath ||
        moment?.podcast?.cover?.path ||
        moment?.podcast?.cover?.url ||
        moment?.podcast?.cover;

      if (!candidate) {
        setResolvedThumbnail('');
        return;
      }

      try {
        const rawPath = typeof candidate === 'string' ? candidate : candidate.path || candidate.url || candidate.filename;
        const src = rawPath?.startsWith('data:') ? rawPath : await getMediaDisplaySrc(rawPath);
        if (!cancelled) {
          setResolvedThumbnail(src || '');
          if (src?.startsWith('blob:')) objectUrl = src;
        }
      } catch (error) {
        console.warn('[ShareCard] thumbnail load failed:', error);
        if (!cancelled) setResolvedThumbnail('');
      }
    }

    loadThumbnail();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media, moment, thumbnail]);

  // 获取类型图标
  const getTypeIcon = () => {
    switch (displayType) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'diary': return <BookOpen className="w-4 h-4" />;
      default: return <Camera className="w-4 h-4" />;
    }
  };

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 生成分享图片
  const generateShareImage = async () => {
    if (!cardRef?.current) return;
    
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2, // 提高清晰度
        logging: false
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      setShareImage(dataUrl);
    } catch (error) {
      console.error('生成分享图片失败:', error);
    } finally {
      setGenerating(false);
    }
  };

  // 关闭时重置状态
  const handleClose = () => {
    setShareImage(null);
    onClose();
  };

  // 下载图片
  const downloadImage = () => {
    if (!shareImage) return;
    
    const link = document.createElement('a');
    link.download = `宝贝时光分享_${Date.now()}.png`;
    link.href = shareImage;
    link.click();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary-500" />
            生成分享图片
          </h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-4">
          {!shareImage ? (
            <div className="space-y-4">
              {/* 预览卡片 - 这是真正要截图的部分 */}
              <div 
                ref={cardRef}
                className="relative bg-gradient-to-br from-primary-50 via-primary-50 to-amber-50 rounded-2xl overflow-hidden shadow-lg"
              >
                {/* 装饰背景 */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-200/30 to-amber-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-amber-200/30 to-primary-200/30 rounded-full translate-y-1/2 -translate-x-1/2" />
                
                {/* 卡片内容 */}
                <div className="relative p-6">
                  {/* 顶部标题 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👶</span>
                      <span className="font-bold text-gray-800">{babyName}</span>
                    </div>
                    {displayMilestoneLabel && (
                      <span className="px-3 py-1 bg-pink-100 text-pink-600 rounded-full text-xs font-medium flex items-center gap-1">
                        <span>{milestoneIcons[displayMilestone] || '📅'}</span>
                        {displayMilestoneLabel}
                      </span>
                    )}
                  </div>

                  {/* 媒体内容（图片/视频封面） */}
                  {resolvedThumbnail && displayType !== 'diary' && (
                    <div className="mb-4 rounded-xl overflow-hidden shadow-md">
                      <img 
                        src={resolvedThumbnail} 
                        alt="分享图片" 
                        className="w-full aspect-square object-cover"
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}

                  {/* 内容文字 */}
                  <p className="text-gray-700 leading-relaxed mb-4 text-sm">
                    {displayContent}
                  </p>

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>{moodIcons[displayMood] || '😊'}</span>
                      <span className="flex items-center gap-1">
                        {getTypeIcon()}
                        {displayType === 'photo' ? '照片' : displayType === 'video' ? '视频' : displayType === 'audio' ? '语音' : '文字'}
                      </span>
                    </div>
                    <span>{formatDate(displayDate)}</span>
                  </div>

                  {/* 水印 */}
                  <div className="mt-4 pt-4 border-t border-gray-200/50 text-center">
                    <span className="text-xs text-gray-400">✨ 宝贝时光 - 用心记录每一个成长瞬间</span>
                  </div>
                </div>
              </div>

              {/* 生成按钮 */}
              <button
                onClick={generateShareImage}
                disabled={generating}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    生成中...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    生成分享图片
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 生成后的图片预览 */}
              <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img 
                  src={shareImage} 
                  alt="分享图片预览" 
                  className="w-full h-auto"
                />
              </div>
              <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                长按图片保存，或点击下方按钮下载
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShareImage(null)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  重新生成
                </button>
                <button
                  onClick={downloadImage}
                  className="flex-1 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:from-primary-600 hover:to-primary-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  下载图片
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareCard;
