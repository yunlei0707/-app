/**
 * AI 创作提示弹窗组件 v2.5.1
 * 
 * 最简单可靠的方案：只做提示，不做任何JS点击
 * 用户直接点击右下角的SDK按钮，100%有效
 */

import { Sparkles, MessageCircle, X } from 'lucide-react';

export function AIChoiceModal({ show, onCancel }) {
  if (!show) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[85%] max-w-xs overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-primary-50 to-amber-50 dark:from-gray-700 dark:to-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">AI 智能创作</span>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
            记录已保存！
          </p>
          <p className="text-sm text-primary-500 font-medium mb-4">
            👉 点击右下角的
            <br />
            <MessageCircle className="w-5 h-5 inline mx-1" />
            AI 助手按钮开始创作
          </p>

          <button
            onClick={onCancel}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChoiceModal;
