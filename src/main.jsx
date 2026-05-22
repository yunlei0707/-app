/** * 宝贝时光 - 应用入口 * 记录宝宝成长点滴的移动端单页应用 */
import React from 'react';
import { setupErrorGuard } from '@core/safe';

// 🛡️ 第一个执行：启动全局错误防护
// 任何后续代码出错，都会被安全捕获，不会让整个应用白屏
setupErrorGuard();
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@ui/components/ErrorBoundary';
import './index.css';
import './utils/backButton.js';

// ===== 版本自动检测机制 =====
// 每次 Vercel 部署后，version.json 会更新
// 网页定时检查，发现新版本自动刷新
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次
const VERSION_KEY = 'app_version';

async function checkForUpdate() {
  try {
    // 加时间戳避免缓存
    const response = await fetch(`/version.json?t=${Date.now()}`);
    if (!response.ok) return;
    const data = await response.json();
    const serverVersion = data.version;
    if (!serverVersion) return;

    const localVersion = localStorage.getItem(VERSION_KEY);
    if (!localVersion) {
      // 首次访问，记录版本号
      localStorage.setItem(VERSION_KEY, serverVersion);
      return;
    }

    if (localVersion !== serverVersion) {
      // 发现新版本，自动刷新
      console.log(`[版本更新] ${localVersion} → ${serverVersion}，正在刷新...`);
      localStorage.setItem(VERSION_KEY, serverVersion);
      
      // 清除旧缓存后刷新
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      window.location.reload();
    }
  } catch (error) {
    // 检查失败静默忽略，不影响使用
    console.log('[版本检查] 跳过:', error.message);
  }
}

// 启动定时检查
setInterval(checkForUpdate, VERSION_CHECK_INTERVAL);

// 首次加载也检查一次（延迟30秒，避免影响首次加载速度）
setTimeout(checkForUpdate, 30 * 1000);

// ===== 应用渲染 =====
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  console.error('找不到根元素 #root');
}

// 注册 Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker 注册成功:', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker 注册失败:', error);
      });
  });
}

// 标记APP环境
if (window.Capacitor?.isNativePlatform?.()) {
  document.documentElement.classList.add('capacitor-app');
}
