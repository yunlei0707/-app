/**
 * P4阶段：媒体懒加载工具
 * 功能：时光轴滚动时，只加载可视区域内的媒体资源
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ========== 配置 ==========
const CONFIG = {
  // 预加载的前后条数
  PRELOAD_BEFORE: 2,
  PRELOAD_AFTER: 2,
  // 可见性检测的根边距
  ROOT_MARGIN: '100px 0px',
  // 低质量占位符的质量
  PLACEHOLDER_QUALITY: 0.1,
};

// ========== 可见性检测管理器 ==========
let intersectionObserver = null;
const observeCallbacks = new Map();

/**
 * 获取或创建IntersectionObserver
 */
function getObserver() {
  if (typeof window === 'undefined') return null;
  
  if (!intersectionObserver) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = observeCallbacks.get(entry.target);
          if (callback) {
            callback(entry.isIntersecting, entry);
          }
        });
      },
      {
        rootMargin: CONFIG.ROOT_MARGIN,
        threshold: 0.1,
      }
    );
  }
  
  return intersectionObserver;
}

/**
 * 开始观察元素可见性
 */
export function observeLazyLoad(element, callback) {
  const observer = getObserver();
  if (!observer || !element) return;
  
  observeCallbacks.set(element, callback);
  observer.observe(element);
}

/**
 * 停止观察元素
 */
export function unobserveLazyLoad(element) {
  const observer = getObserver();
  if (!observer || !element) return;
  
  observeCallbacks.delete(element);
  observer.unobserve(element);
}

/**
 * 清理观察器
 */
export function cleanupObserver() {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  observeCallbacks.clear();
}

// ========== React Hooks ==========

/**
 * 使用懒加载的Hook
 * @returns {Object} { isVisible, elementRef, shouldLoad }
 */
export function useLazyLoad() {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    observeLazyLoad(element, (visible) => {
      if (visible && !hasLoaded) {
        setIsVisible(true);
        setHasLoaded(true);
        // 加载完成后停止观察
        unobserveLazyLoad(element);
      }
    });
    
    return () => unobserveLazyLoad(element);
  }, [hasLoaded]);
  
  return {
    isVisible: isVisible || hasLoaded,
    elementRef,
    shouldLoad: isVisible || hasLoaded,
  };
}

/**
 * 媒体懒加载的Hook（包含加载状态）
 * @param {string} src - 媒体源地址
 * @param {Object} options - 选项
 * @returns {Object} { src, isLoading, isLoaded, error, elementRef }
 */
export function useLazyMedia(src, options = {}) {
  const { placeholder = null, type = 'image' } = options;
  const { shouldLoad, elementRef } = useLazyLoad();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [loadedSrc, setLoadedSrc] = useState(placeholder);
  
  useEffect(() => {
    if (!shouldLoad || !src || isLoaded) return;
    
    setIsLoading(true);
    setError(null);
    
    // 预加载媒体
    const preloadElement = type === 'video' 
      ? document.createElement('video')
      : new Image();
    
    preloadElement.src = src;
    
    if (type === 'video') {
      preloadElement.preload = 'metadata';
    }
    
    const handleLoad = () => {
      setIsLoading(false);
      setIsLoaded(true);
      setLoadedSrc(src);
    };
    
    const handleError = (err) => {
      setIsLoading(false);
      setError(err || new Error('媒体加载失败'));
    };
    
    if (type === 'video') {
      preloadElement.onloadedmetadata = handleLoad;
    } else {
      preloadElement.onload = handleLoad;
    }
    
    preloadElement.onerror = handleError;
    
    return () => {
      preloadElement.onload = null;
      preloadElement.onerror = null;
    };
  }, [shouldLoad, src, type, isLoaded]);
  
  return {
    src: loadedSrc,
    originalSrc: src,
    isLoading,
    isLoaded,
    error,
    elementRef,
    shouldLoad,
  };
}

// ========== 时光轴懒加载管理器 ==========

/**
 * 时光轴懒加载管理器
 * 用于优化长列表滚动性能
 */
export class TimelineLazyManager {
  constructor(options = {}) {
    this.options = {
      renderAhead: 5,
      ...options,
    };
    this.visibleRange = { start: 0, end: 20 };
    this.scrollContainer = null;
    this.itemElements = new Map();
    this.callback = null;
  }
  
  /**
   * 设置滚动容器
   */
  setContainer(container) {
    this.scrollContainer = container;
  }
  
  /**
   * 注册列表项元素
   */
  registerItem(index, element) {
    if (element) {
      this.itemElements.set(index, element);
    } else {
      this.itemElements.delete(index);
    }
  }
  
  /**
   * 更新可见范围
   */
  updateVisibleRange(scrollTop, containerHeight) {
    if (!this.scrollContainer) return;
    
    // 找到当前可见的第一个和最后一个元素的索引
    let firstVisibleIndex = 0;
    let lastVisibleIndex = 0;
    
    // 简单估算（假设每个item约200px高度）
    const estimatedItemHeight = 200;
    firstVisibleIndex = Math.floor(scrollTop / estimatedItemHeight);
    lastVisibleIndex = Math.ceil((scrollTop + containerHeight) / estimatedItemHeight);
    
    // 扩展渲染范围（预加载）
    const start = Math.max(0, firstVisibleIndex - this.options.renderAhead);
    const end = lastVisibleIndex + this.options.renderAhead;
    
    if (start !== this.visibleRange.start || end !== this.visibleRange.end) {
      this.visibleRange = { start, end };
      if (this.callback) {
        this.callback(this.visibleRange);
      }
    }
  }
  
  /**
   * 检查索引是否在可见范围内
   */
  isInRange(index) {
    return index >= this.visibleRange.start && index <= this.visibleRange.end;
  }
  
  /**
   * 设置范围变化回调
   */
  onRangeChange(callback) {
    this.callback = callback;
  }
  
  /**
   * 销毁
   */
  destroy() {
    this.itemElements.clear();
    this.callback = null;
  }
}

/**
 * 使用时光轴懒加载的Hook
 */
export function useTimelineLazy(totalCount, options = {}) {
  const managerRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const containerRef = useRef(null);
  
  useEffect(() => {
    managerRef.current = new TimelineLazyManager(options);
    managerRef.current.onRangeChange(setVisibleRange);
    
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, [JSON.stringify(options)]);
  
  // 处理滚动
  const handleScroll = useCallback((event) => {
    if (!managerRef.current || !containerRef.current) return;
    
    const { scrollTop, clientHeight } = containerRef.current;
    managerRef.current.updateVisibleRange(scrollTop, clientHeight);
  }, []);
  
  // 设置容器引用
  const setContainerRef = useCallback((node) => {
    containerRef.current = node;
    if (managerRef.current) {
      managerRef.current.setContainer(node);
    }
  }, []);
  
  // 检查索引是否应该渲染
  const shouldRenderItem = useCallback((index) => {
    if (!managerRef.current) return true;
    return managerRef.current.isInRange(index);
  }, []);
  
  return {
    visibleRange,
    shouldRenderItem,
    containerRef: setContainerRef,
    onScroll: handleScroll,
    manager: managerRef.current,
  };
}

// ========== 导出 ==========
export default {
  CONFIG,
  observeLazyLoad,
  unobserveLazyLoad,
  cleanupObserver,
  useLazyLoad,
  useLazyMedia,
  TimelineLazyManager,
  useTimelineLazy,
};
