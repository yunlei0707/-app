/**
 * 🛡️ errorGuard - 全局错误防护
 * 解决：一个地方炸了，整个应用白屏
 */

// 错误统计
const errorStats = {
  total: 0,
  jsErrors: 0,
  promiseErrors: 0,
  lastError: null
};

// 错误回调列表
const errorCallbacks = [];

/**
 * 注册错误回调
 */
export function onError(callback) {
  if (typeof callback === 'function') {
    errorCallbacks.push(callback);
  }
}

/**
 * 通知所有回调
 */
function notifyCallbacks(type, error) {
  const errorInfo = {
    type,
    message: error?.message || String(error),
    stack: error?.stack,
    time: Date.now()
  };

  errorCallbacks.forEach(cb => {
    try {
      cb(errorInfo);
    } catch (e) {
      // 回调自己也不能炸
      console.error('[errorGuard callback error]', e);
    }
  });
}

/**
 * 安装全局错误防护
 */
export function setupErrorGuard() {
  if (typeof window === 'undefined') return;

  // 1. 全局 JS 错误
  window.addEventListener('error', (e) => {
    errorStats.total++;
    errorStats.jsErrors++;
    errorStats.lastError = { type: 'js', message: e.message, time: Date.now() };

    console.warn('[Global Error Caught]', e.message);
    console.warn('  - File:', e.filename);
    console.warn('  - Line:', e.lineno);

    notifyCallbacks('js', e.error || e);

    // 不阻止默认行为，让错误还是能在控制台看到
    // e.preventDefault();
  });

  // 2. 未捕获的 Promise 异常
  window.addEventListener('unhandledrejection', (e) => {
    errorStats.total++;
    errorStats.promiseErrors++;
    errorStats.lastError = { type: 'promise', message: String(e.reason), time: Date.now() };

    console.warn('[Promise Rejection Caught]', e.reason?.message || String(e.reason));

    notifyCallbacks('promise', e.reason);

    // 阻止 Uncaught 报错，不影响应用继续运行
    e.preventDefault();
  });

  console.log('🛡️ errorGuard installed - global error protection active');
}

/**
 * 获取错误统计
 */
export function getErrorStats() {
  return { ...errorStats };
}

/**
 * 清除错误统计
 */
export function clearErrorStats() {
  errorStats.total = 0;
  errorStats.jsErrors = 0;
  errorStats.promiseErrors = 0;
  errorStats.lastError = null;
}
