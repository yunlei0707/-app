import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/floatingPig.css';

/**
 * 悬浮小猪按钮组件
 * 功能：
 * - 支持自由拖拽（鼠标/触摸）
 * - 边界检测，不拖出屏幕
 * - 松手自动吸附到左右边缘
 * - 位置保存到 localStorage
 * - 点击弹出扇形菜单（5个功能）
 * - 点击外部区域收起菜单
 * - 拖拽时不触发菜单
 */

// 5个菜单项配置
const MENU_ITEMS = [
  { icon: '🔄', label: '刷新', action: 'refresh' },
  { icon: '🏠', label: '首页', action: 'home' },
  { icon: '⬅️', label: '后退', action: 'back' },
  { icon: '➡️', label: '前进', action: 'forward' },
  { icon: '❌', label: '退出', action: 'exit' },
];

export function FloatingPig() {
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 初始化：从 localStorage 恢复位置
  useEffect(() => {
    try {
      const savedPosition = localStorage.getItem('floatingPigPosition');
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      }
    } catch (e) {
      console.warn('Failed to load floating pig position:', e);
    }
    // 触发进场动画
    setTimeout(() => setMounted(true), 100);
  }, []);

  // 保存位置到 localStorage
  const savePosition = useCallback((pos) => {
    try {
      localStorage.setItem('floatingPigPosition', JSON.stringify(pos));
    } catch (e) {
      console.warn('Failed to save floating pig position:', e);
    }
  }, []);

  // 获取屏幕边界
  const getBoundaries = useCallback(() => {
    const buttonWidth = 56; // w-14 = 3.5rem = 56px
    const buttonHeight = 56;
    return {
      minX: 10,
      maxX: window.innerWidth - buttonWidth - 10,
      minY: 60,
      maxY: window.innerHeight - buttonHeight - 80,
    };
  }, []);

  // 自动吸附到左右边缘
  const snapToEdge = useCallback((currentX) => {
    const boundaries = getBoundaries();
    const centerX = (boundaries.minX + boundaries.maxX) / 2;
    return currentX <= centerX ? boundaries.minX : boundaries.maxX;
  }, [getBoundaries]);

  // 开始拖拽
  const handleDragStart = useCallback((clientX, clientY) => {
    setIsDragging(true);
    setHasMoved(false);
    setShowMenu(false);
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y,
    });
  }, [position]);

  // 拖拽中
  const handleDragMove = useCallback((clientX, clientY) => {
    if (!isDragging) return;

    const boundaries = getBoundaries();
    let newX = clientX - dragStart.x;
    let newY = clientY - dragStart.y;

    // 边界检测
    newX = Math.max(boundaries.minX, Math.min(boundaries.maxX, newX));
    newY = Math.max(boundaries.minY, Math.min(boundaries.maxY, newY));

    // 检测是否真的移动了（防止误触）
    if (Math.abs(newX - position.x) > 3 || Math.abs(newY - position.y) > 3) {
      setHasMoved(true);
    }

    setPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, getBoundaries, position]);

  // 结束拖拽
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    setIsAnimating(true);

    // 自动吸附到左右边缘
    const finalX = snapToEdge(position.x);
    const finalPosition = { x: finalX, y: position.y };

    setPosition(finalPosition);
    savePosition(finalPosition);

    setTimeout(() => setIsAnimating(false), 300);

    // 如果没有移动，视为点击
    if (!hasMoved) {
      setShowMenu((prev) => !prev);
    }
  }, [isDragging, position, snapToEdge, savePosition, hasMoved]);

  // 鼠标事件
  const handleMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e) => handleDragMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 触摸事件
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  // 执行菜单动作
  const handleMenuAction = async (action) => {
    setShowMenu(false);

    switch (action) {
      case 'refresh':
        window.location.reload();
        break;
      case 'home':
        navigate('/');
        break;
      case 'back':
        window.history.back();
        break;
      case 'forward':
        window.history.forward();
        break;
      case 'exit':
        try {
          // 尝试使用 Capacitor API 退出
          if (window.Capacitor?.Plugins?.App) {
            await window.Capacitor.Plugins.App.exitApp();
          } else {
            // Web 环境下提示
            alert('APP 退出功能仅在移动端生效');
          }
        } catch (e) {
          console.warn('Exit app failed:', e);
          alert('退出失败，请使用系统返回键');
        }
        break;
      default:
        break;
    }
  };

  // 计算菜单位置（扇形展开）
  const getMenuStyle = (index, total) => {
    const isLeftSide = position.x < window.innerWidth / 2;
    const angleStart = isLeftSide ? -60 : 120;
    const angleEnd = isLeftSide ? 60 : 240;
    const angleRange = angleEnd - angleStart;
    const angleStep = angleRange / (total - 1);
    const angle = angleStart + index * angleStep;
    const radius = 80;

    const rad = (angle * Math.PI) / 180;
    const offsetX = Math.cos(rad) * radius;
    const offsetY = Math.sin(rad) * radius;

    return {
      transform: `translate(${offsetX}px, ${offsetY}px)`,
      transitionDelay: `${index * 50}ms`,
    };
  };

  return (
    <div
      ref={buttonRef}
      className={`floating-pig-container ${
        mounted ? 'mounted' : ''
      } ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* 小猪主按钮 */}
      <button
        className={`floating-pig-button ${showMenu ? 'shake' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <span className="pig-emoji">🐷</span>
      </button>

      {/* 扇形菜单 */}
      <div className={`floating-pig-menu ${showMenu ? 'show' : ''}`}>
        {MENU_ITEMS.map((item, index) => (
          <button
            key={item.action}
            className="floating-pig-menu-item"
            style={getMenuStyle(index, MENU_ITEMS.length)}
            onClick={() => handleMenuAction(item.action)}
            title={item.label}
          >
            <span>{item.icon}</span>
          </button>
        ))}
      </div>

      {/* 点击遮罩（防止点击穿透） */}
      {showMenu && (
        <div
          className="fixed inset-0 z-49"
          onClick={() => setShowMenu(false)}
          style={{ zIndex: 49 }}
        />
      )}
    </div>
  );
}

export default FloatingPig;
