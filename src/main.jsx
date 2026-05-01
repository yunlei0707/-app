/**
 * 宝贝时光 - 应用入口
 * 记录宝宝成长点滴的移动端单页应用
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 等待 DOM 加载完成
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('找不到根元素 #root');
}

// 注册 Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker 注册成功:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker 注册失败:', error);
      });
  });
}
