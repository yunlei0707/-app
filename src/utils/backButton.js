export function setupBackButton() {
  // 只在APP环境生效
  if (!(window.Capacitor?.isNativePlatform?.())) return;

  const App = window.Capacitor.Plugins?.App;
  if (!App) return;

  App.addListener('backButton', () => {
    // 1. 优先关闭弹窗
    const modalClose = document.querySelector('[data-modal-close], .modal-close');
    if (modalClose && modalClose.offsetParent) {
      modalClose.click();
      return;
    }

    // 2. 不在首页就返回上一页
    if (window.location.pathname !== '/' && window.history.length > 1) {
      window.history.back();
      return;
    }

    // 3. 首页确认退出
    if (confirm('确定要退出宝贝时光吗？')) {
      App.exitApp();
    }
  });
}

// 页面加载完成后初始化
if (document.readyState === 'complete') {
  setTimeout(setupBackButton, 1000);
} else {
  window.addEventListener('load', () => setTimeout(setupBackButton, 1000));
}
