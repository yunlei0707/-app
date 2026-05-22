/**
 * 导入进度弹窗组件
 * 纯展示组件，由父组件控制进度和状态
 */

import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

export function ImportProgressModal({ 
  isOpen, 
  onClose, 
  progress = 0,
  message = '准备中...',
  status = 'running', // running | success | error
  error = null,
  onCancel,
  title = '导入数据'
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6">
          {/* 状态图标 */}
          <div className="flex justify-center mb-4">
            {status === 'running' && (
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Loader className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>

          {/* 进度条 */}
          {status === 'running' && (
            <div className="mb-4">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{message}</span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          {/* 消息 */}
          <div className="text-center">
            <p className={`text-base font-medium ${
              status === 'success' ? 'text-green-600 dark:text-green-400' :
              status === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-gray-700 dark:text-gray-300'
            }`}>
              {message}
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-500 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {status === 'running' ? (
            <button
              onClick={onCancel}
              className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              取消导入
            </button>
          ) : (
            <button
              onClick={onClose}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                status === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              确定
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportProgressModal;
