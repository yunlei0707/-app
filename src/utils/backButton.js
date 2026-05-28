import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let activeHandler = null;
let isInitialized = false;
let lastExitAttemptAt = 0;

export function setBackButtonHandler(handler) {
  activeHandler = typeof handler === 'function' ? handler : null;

  return () => {
    if (activeHandler === handler) {
      activeHandler = null;
    }
  };
}

export function setupBackButton() {
  if (isInitialized || !Capacitor.isNativePlatform()) return;
  isInitialized = true;

  CapacitorApp.addListener('backButton', async (event) => {
    try {
      if (activeHandler) {
        const handled = await activeHandler(event);
        if (handled) return;
      }

      if (event?.canGoBack && window.history.length > 1) {
        window.history.back();
        return;
      }

      const now = Date.now();
      if (now - lastExitAttemptAt < 2000) {
        CapacitorApp.exitApp();
        return;
      }

      lastExitAttemptAt = now;
      window.dispatchEvent(new CustomEvent('babytime:back-exit-prompt'));
    } catch (error) {
      console.warn('[BackButton] 返回事件处理失败:', error);
    }
  });
}

setupBackButton();
