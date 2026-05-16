// 完全禁用Service Worker的缓存功能
// 只保留基本框架，不做任何缓存操作
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 删除所有旧缓存
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('删除缓存:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// 所有请求直接走网络，不做任何缓存
self.addEventListener('fetch', (event) => {
  return;
});
