/**
 * 来自宝宝的信组件
 * 从未来宝宝记录中随机抽取，以宝宝第一人称口吻写给妈妈/爸爸的信
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { X, RefreshCw, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

// 随机选择一个未来年份（15-35年后）
const getRandomFutureYear = () => {
  const currentYear = new Date().getFullYear();
  return currentYear + 15 + Math.floor(Math.random() * 21);
};

// 将未来宝宝记录改写为第一人称信件
const rewriteAsLetter = (item, babyName, parentName) => {
  if (!item) return '';
  
  const title = item.title || '';
  const content = item.content || '';
  
  // 合并标题和内容
  const fullText = title + (content ? ' ' + content : '');
  
  // 替换规则
  let letterText = fullText
    // 替换宝宝名称为"我"
    .replace(new RegExp(babyName, 'g'), '我')
    .replace(/小豆芽/g, '我')
    .replace(/宝宝/g, '我')
    // 替换描述性动词为更亲密的语气
    .replace(/，考上了/g, '，我努力考上了')
    .replace(/，成为了/g, '，我终于成为了')
    .replace(/，从事/g, '，我开始从事')
    .replace(/，开始/g, '，我开始')
    .replace(/，获得/g, '，我获得了')
    .replace(/，收到/g, '，我收到了')
    .replace(/，结了/g, '，我结了')
    .replace(/，有了/g, '，我有了')
    .replace(/，生了/g, '，我生了')
    .replace(/出生了/g, '来到这个世界')
    .replace(/长大了/g, '慢慢长大了')
    .replace(/毕业了/g, '毕业了')
    .replace(/工作了/g, '工作了')
    // 去掉结尾的句号或添加温暖结尾
    .replace(/。$/, '');
  
  // 确保有结尾标点
  if (!letterText.endsWith('。') && !letterText.endsWith('！') && !letterText.endsWith('？')) {
    letterText += '。';
  }
  
  // 去掉开头的"妈妈/爸爸，"如果已经有了
  letterText = letterText.replace(/^(妈妈，爸爸)，?/, '');
  
  return letterText;
};

// 默认信件（当没有记录时）
const getDefaultLetter = (babyName) => ({
  paragraphs: [`亲爱的妈妈，我在未来的某一天等你。现在你记录的每一刻，都是我成长的养分。`],
  year: getRandomFutureYear(),
  isDefault: true
});

// 从记录生成信件
const generateLetterFromRecords = (records, babyName, parentName) => {
  if (!records || records.length === 0) {
    return getDefaultLetter(babyName);
  }
  
  // 随机抽取1-3条记录
  const count = Math.min(Math.ceil(Math.random() * 3), records.length);
  const shuffled = [...records].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  
  // 生成称呼
  const greeting = Math.random() > 0.5 ? '妈妈' : '爸爸';
  
  // 生成段落
  const paragraphs = selected.map((item, index) => {
    const text = rewriteAsLetter(item, babyName, parentName);
    
    // 第一段加称呼
    if (index === 0) {
      return `${greeting}，${text}`;
    }
    return text;
  });
  
  // 添加结尾段落
  const closingTexts = [
    '这些都是你为我播下的种子，慢慢生根发芽。',
    '我想告诉你，我一切都好，就像你当初期盼的那样。',
    '谢谢你一直爱我，我现在很幸福。',
    '每一年的今天，我都想对你说声谢谢。',
    '未来的我，会继续努力，让你骄傲。'
  ];
  
  if (paragraphs.length < 3) {
    const closingText = closingTexts[Math.floor(Math.random() * closingTexts.length)];
    paragraphs.push(closingText);
  }
  
  return {
    paragraphs,
    year: getRandomFutureYear(),
    isDefault: false
  };
};

export function BabyLetter({ 
  visible, 
  onClose, 
  virtualTimeRecords = [], 
  babyName = '宝宝',
  parentName = '妈妈'
}) {
  const [letter, setLetter] = useState(() => generateLetterFromRecords(virtualTimeRecords, babyName, parentName));
  const [isOpened, setIsOpened] = useState(false);
  const [shareImage, setShareImage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const letterRef = useRef(null);
  const cardRef = useRef(null);

  // 加载静音偏好
  useEffect(() => {
    if (visible) {
    }
  }, [visible]);

  // 打开信封动画并播放BGM
  const handleOpen = useCallback(() => {
    setIsOpened(true);
  }, []);

  // 关闭时重置状态并停止BGM
  const handleClose = useCallback(() => {
    setIsOpened(false);
    setShareImage(null);
    onClose();
  }, [onClose]);

  // 静音切换, []);

  // 再来一封
  const handleRefresh = useCallback(() => {
    setIsOpened(false);
    setShareImage(null);
    setTimeout(() => {
      setLetter(generateLetterFromRecords(virtualTimeRecords, babyName, parentName));
    }, 300);
  }, [virtualTimeRecords, babyName, parentName]);

  // 生成分享图片
  const generateShareImage = async () => {
    if (!cardRef?.current) return;
    
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFF8F0',
        scale: 2,
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

  // 下载图片
  const downloadImage = () => {
    if (!shareImage) return;
    const link = document.createElement('a');
    link.download = `来自宝宝的信_${letter.year}.png`;
    link.href = shareImage;
    link.click();
  };

  if (!visible) return null;

  const hasRecords = virtualTimeRecords && virtualTimeRecords.length > 0;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-md bg-gradient-to-b from-amber-50 to-orange-50 rounded-2xl shadow-2xl overflow-hidden animate-scale-in relative"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 - 暖粉色调 */}
        <div className="bg-gradient-to-r from-primary-200 to-primary-300 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💌</span>
            <span className="text-gray-700 text-sm">来自宝宝的信</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClose}
              className="p-2 -mr-2 text-gray-600 hover:text-gray-800 hover:bg-white/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isOpened ? (
          /* ===== 未打开的信封 ===== */
          <div 
            className="cursor-pointer select-none"
            onClick={handleOpen}
          >
            {/* 信封顶部 - 深红褐色信封盖 */}
            <div className="relative bg-gradient-to-b from-[#8B4513] to-[#A0522D] pt-8 pb-4 px-6 text-center">
              {/* 信封封口装饰 */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-8 bg-[#6B3410] rounded-b-full" />
              
              <div className="text-5xl mb-3 animate-bounce">💌</div>
              <p className="text-white/90 text-lg font-medium">来自未来的信</p>
              <p className="text-white/60 text-sm mt-1">点击打开信封</p>
              
              {/* 信封折痕 */}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#6B3410] to-transparent" />
            </div>
            
            {/* 信封主体 */}
            <div className="bg-gradient-to-b from-primary-300 to-amber-300 px-6 py-8">
              <div className="bg-[#FFF8DC] rounded-lg p-4 shadow-inner">
                <p className="text-primary-700 text-center text-sm leading-relaxed">
                  {hasRecords 
                    ? '这封信装载着未来的美好祝愿，请查收~'
                    : '虽然还没有未来的记录，但这封信会带着宝宝的爱先寄出~'
                  }
                </p>
              </div>
            </div>
            
            {/* 信封底部 */}
            <div className="bg-gradient-to-b from-amber-300 to-primary-400 h-4 -mt-2" />
          </div>
        ) : (
          /* ===== 已打开的信纸 ===== */
          <div ref={cardRef} className="bg-[#FFF8F0]">
            {/* 信纸头部装饰 */}
            <div className="bg-gradient-to-r from-primary-500 to-amber-400 px-6 py-4 text-center">
              <p className="text-white/80 text-xs">✉️ 来自未来的信</p>
              <p className="text-white font-medium mt-1">{letter.year}年某一天</p>
            </div>
            
            {/* 信纸内容 */}
            <div ref={letterRef} className="px-6 py-5">
              {/* 信纸背景装饰 */}
              <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="w-full h-full" style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 28px, #DC143C 28px, #DC143C 29px)'
                }} />
              </div>
              
              {/* 称呼 */}
              <p className="text-[#8B4513] text-base font-medium mb-3">
                {letter.paragraphs[0]?.startsWith('妈妈') ? '亲爱的妈妈，' : 
                 letter.paragraphs[0]?.startsWith('爸爸') ? '亲爱的爸爸，' : 
                 '亲爱的家人，'}
              </p>
              
              {/* 正文段落 */}
              <div className="space-y-3 text-[#5D4037] text-sm leading-relaxed">
                {(letter.paragraphs || []).map((paragraph, index) => (
                  <p key={index} className="relative z-10">
                    {index === 0 ? paragraph : paragraph}
                  </p>
                ))}
              </div>
              
              {/* 署名 */}
              <div className="mt-6 text-right">
                <p className="text-[#8B4513] text-sm">
                  {letter.isDefault ? (
                    <>爱你的<br/><span className="text-base font-medium">{babyName}</span></>
                  ) : (
                    <>爱你的<br/><span className="text-base font-medium">{babyName}</span></>
                  )}
                </p>
                <p className="text-[#A0522D] text-xs mt-1">{letter.year}年</p>
              </div>
              
              {/* 装饰线条 */}
              <div className="mt-4 border-t border-dashed border-[#DEB887] pt-4">
                <p className="text-[#BC8F8F] text-xs text-center">
                  ✨ {babyName}从未来寄来的信 ✨
                </p>
              </div>
            </div>
            
            {/* 操作按钮 */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={!hasRecords}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  hasRecords
                    ? 'bg-white text-primary-600 hover:bg-primary-50 active:scale-[0.98] border border-primary-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${hasRecords ? '' : 'opacity-50'}`} />
                <span>{hasRecords ? '再来一封' : '暂无记录'}</span>
              </button>
              
              {shareImage ? (
                <button
                  onClick={downloadImage}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-amber-400 text-white flex items-center justify-center gap-2 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>保存图片</span>
                </button>
              ) : (
                <button
                  onClick={generateShareImage}
                  disabled={generating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-amber-400 text-white flex items-center justify-center gap-2 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70"
                >
                  <span className={generating ? 'animate-spin' : ''}>
                    {generating ? '✨' : '🖼️'}
                  </span>
                  <span>{generating ? '生成中...' : '生成图片'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BabyLetter;
