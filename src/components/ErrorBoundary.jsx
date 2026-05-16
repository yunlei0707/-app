/**
 * 全局错误边界组件
 * 捕获 React 组件渲染时的错误，显示友好提示而不是白屏
 */

import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // 更新 state，下次渲染显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 可以在这里上报错误到监控服务
    console.error('❌ React 组件渲染错误:', error);
    console.error('❌ 错误详情:', errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // 可选：清除 localStorage 缓存后刷新
    // localStorage.clear();
    // window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 渲染降级 UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
          <div className="card max-w-md w-full text-center p-8">
            <div className="text-6xl mb-4">😢</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              哎呀，出了点小问题
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              应用遇到了一个意外错误，不过别担心，数据应该都还在。
            </p>
            
            {/* 错误详情（开发环境显示） */}
            {this.state.error && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">
                <p className="font-mono">{this.state.error.toString()}</p>
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                尝试恢复
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                刷新页面
              </button>
            </div>
            
            <p className="mt-6 text-xs text-gray-400">
              如果问题持续出现，可以尝试清除浏览器缓存
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
