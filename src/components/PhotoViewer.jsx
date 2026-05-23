/**
 * 照片查看器组件
 * 支持双指缩放、双击缩放、拖动平移
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

/**
 * 获取照片显示URL（兼容新旧格式）
 */
function getPhotoUrl(photo) {
  if (!photo) return '';
  
  // 情况1：纯字符串（旧格式DataURL）
  if (typeof photo === 'string') {
    return photo;
  }
  
  // 情况2：新格式，有持久化path
  if (photo.path) {
    if (photo.path.startsWith('http') || photo.path.startsWith('data:') || photo.path.startsWith('blob:')) {
      return photo.path;
    }
    console.warn('[PhotoViewer] 媒体path需要异步获取显示URL:', photo.path);
  }
  
  // 情况3：预览URL
  if (photo.previewUrl) return photo.previewUrl;
  
  // 情况4：旧格式对象的url字段
  if (photo.url) return photo.url;
  
  console.warn('[PhotoViewer] 无法识别的媒体格式:', photo);
  return '';
}

export function PhotoViewer({ photos, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // 缩放相关状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  // 双指触控相关
  const touchStartRef = useRef(null);
  const initialDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);
  const lastTouchRef = useRef(null);
  const lastTapRef = useRef(0);
  
  // 最小和最大缩放比例
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 5;
  const DOUBLE_TAP_DELAY = 300;
  
  // 重置缩放
  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // 计算两点之间的距离
  const getDistance = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 计算两点之间的中点
  const getMidpoint = (touches) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  // 限制平移范围
  const limitTranslate = useCallback((x, y, currentScale) => {
    if (currentScale <= 1) {
      // 缩放小于等于1时不允许平移
      return { x: 0, y: 0 };
    }
    
    const maxX = (currentScale - 1) * window.innerWidth / 2;
    const maxY = (currentScale - 1) * window.innerHeight / 2;
    
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  }, []);

  // 切换图片时重置缩放
  useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

  // 键盘和初始化
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') resetZoom();
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [currentIndex]);

  const goPrev = () => {
    resetZoom();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };
  
  const goNext = () => {
    resetZoom();
    setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  // 放大
  const handleZoomIn = useCallback(() => {
    setScale(prev => {
      const newScale = Math.min(MAX_SCALE, prev + 0.5);
      return newScale;
    });
  }, []);

  // 缩小
  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(MIN_SCALE, prev - 0.5);
      if (newScale <= 1) {
        setTranslateX(0);
        setTranslateY(0);
      }
      return newScale;
    });
  }, []);

  // 触摸事件处理
  const handleTouchStart = useCallback((e) => {
    const touches = e.touches;
    
    if (touches.length === 1) {
      const now = Date.now();
      // 检测双击
      if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        // 双击：切换缩放
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(2);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      
      lastTouchRef.current = { x: touches[0].clientX, y: touches[0].clientY };
    } else if (touches.length === 2) {
      // 双指触控开始
      initialDistanceRef.current = getDistance(touches);
      initialScaleRef.current = scale;
      
      const midpoint = getMidpoint(touches);
      touchStartRef.current = {
        x: midpoint.x,
        y: midpoint.y,
        translateX,
        translateY
      };
    }
  }, [scale, translateX, translateY, resetZoom]);

  const handleTouchMove = useCallback((e) => {
    const touches = e.touches;
    e.preventDefault();
    
    if (touches.length === 1 && scale > 1) {
      // 单指拖动平移
      if (lastTouchRef.current && scale > 1) {
        const dx = touches[0].clientX - lastTouchRef.current.x;
        const dy = touches[0].clientY - lastTouchRef.current.y;
        
        const newX = translateX + dx;
        const newY = translateY + dy;
        
        const limited = limitTranslate(newX, newY, scale);
        setTranslateX(limited.x);
        setTranslateY(limited.y);
      }
      lastTouchRef.current = { x: touches[0].clientX, y: touches[0].clientY };
    } else if (touches.length === 2 && touchStartRef.current) {
      // 双指缩放
      const currentDistance = getDistance(touches);
      const scaleChange = currentDistance / initialDistanceRef.current;
      let newScale = initialScaleRef.current * scaleChange;
      
      // 限制缩放范围
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      
      // 缩放时调整平移
      const midpoint = getMidpoint(touches);
      const dx = midpoint.x - touchStartRef.current.x;
      const dy = midpoint.y - touchStartRef.current.y;
      
      const newTranslateX = touchStartRef.current.translateX + dx;
      const newTranslateY = touchStartRef.current.translateY + dy;
      
      setScale(newScale);
      
      if (newScale > 1) {
        const limited = limitTranslate(newTranslateX, newTranslateY, newScale);
        setTranslateX(limited.x);
        setTranslateY(limited.y);
      } else {
        setTranslateX(0);
        setTranslateY(0);
      }
    }
  }, [scale, translateX, translateY, limitTranslate]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      touchStartRef.current = null;
      initialDistanceRef.current = 0;
      initialScaleRef.current = 1;
    }
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale(prev => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
      if (newScale <= 1) {
        setTranslateX(0);
        setTranslateY(0);
      }
      return newScale;
    });
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(getPhotoUrl(photos[currentIndex]));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photo-${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // 下载失败静默处理
    }
  };

  return (
    <div 
      className="photo-viewer-backdrop animate-fade-in" 
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 顶部工具栏 */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        
        {/* 缩放控制 */}
        <div className="flex items-center gap-2 bg-black/30 rounded-full px-3 py-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <span className="text-white text-sm min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); resetZoom(); }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors ml-1"
          >
            <RotateCcw className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* 下载按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        >
          <Download className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* 照片 */}
      <div 
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={getPhotoUrl(photos[currentIndex])}
          alt={`照片 ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
            transition: touchStartRef.current ? 'none' : 'transform 0.2s ease-out',
            cursor: scale > 1 ? 'grab' : 'default'
          }}
          draggable={false}
        />
      </div>
      
      {/* 导航箭头 */}
      {photos.length > 1 && scale <= 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </>
      )}
      
      {/* 指示器 */}
      {photos.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-50">
          {photos.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-4' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* 页码 */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white text-sm z-50">
        {currentIndex + 1} / {photos.length}
      </div>
      
      {/* 缩放提示 */}
      {scale !== 1 && (
        <div className="zoom-indicator">
          {scale > 1 ? '双指捏合缩放' : '双击放大'}
        </div>
      )}
    </div>
  );
}
