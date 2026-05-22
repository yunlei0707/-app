import { useState } from 'react';
import { Plus } from 'lucide-react';

/**
 * 悬浮添加按钮
 * - 主按钮：点击展开菜单
 * - 同时确保 SDK 按钮正常显示
 */

export function FloatingButton({ onAddMoment, onAddGrowth }) {
  const [showMenu, setShowMenu] = useState(false);

  // 确保 SDK 按钮显示
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const buttons = document.querySelectorAll('[class*="coze-chat"] [class*="float-btn"], [class*="coze-chat"] button[class*="launcher"], [class*="coze-chat-float-btn"]');
      buttons.forEach(btn => {
        if (btn) {
          btn.style.display = 'flex';
          btn.style.visibility = 'visible';
          btn.style.opacity = '1';
        }
      });
    }, 1000);
  }

  return (
    <>
      {/* 悬浮主按钮 - 右下角 */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-gradient-to-br from-primary-500 to-amber-500 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        style={{ marginRight: '70px' }}
      >
        <Plus className={`w-7 h-7 text-white transition-transform ${showMenu ? 'rotate-45' : ''}`} />
      </button>

      {/* 展开菜单 */}
      {showMenu && (
        <div className="fixed bottom-44 right-4 z-40 flex flex-col gap-2">
          {/* 添加动态 */}
          <button
            onClick={() => {
              onAddMoment?.();
              setShowMenu(false);
            }}
            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm font-medium"
          >
            <span className="text-lg">📝</span>
            添加动态
          </button>

          {/* 添加成长记录 */}
          {onAddGrowth && (
            <button
              onClick={() => {
                onAddGrowth?.();
                setShowMenu(false);
              }}
              className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm font-medium"
            >
              <span className="text-lg">📊</span>
              成长记录
            </button>
          )}
        </div>
      )}

      {/* 点击遮罩关闭菜单 */}
      {showMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowMenu(false)}
        />
      )}
    </>
  );
}

export default FloatingButton;
