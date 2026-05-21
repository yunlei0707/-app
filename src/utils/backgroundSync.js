/**
 * P4阶段：后台同步工具
 * 功能：APP在后台时静默同步，充电+WiFi时自动触发
 */

import { executeSync, isSyncing } from './sync';

// ========== 配置 ==========
const CONFIG = {
  // 同步间隔（毫秒），默认30分钟
  SYNC_INTERVAL: 30 * 60 * 1000,
  // 充电时的同步间隔（15分钟）
  CHARGING_SYNC_INTERVAL: 15 * 60 * 1000,
  // 最小电池电量（低于20%不自动同步）
  MIN_BATTERY_LEVEL: 0.2,
  // 网络变化防抖
  NETWORK_DEBOUNCE: 5000,
};

// ========== 状态 ==========
let syncTimer = null;
let isInitialized = false;
let networkStatus = {
  online: true,
  effectiveType: '4g',
  downlink: 10,
  saveData: false,
};
let batteryStatus = {
  charging: false,
  level: 1,
};

// 事件回调
const callbacks = new Set();

// ========== 网络状态检测 ==========

/**
 * 更新网络状态
 */
function updateNetworkStatus() {
  if (typeof navigator === 'undefined') return;
  
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  networkStatus = {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType || '4g',
    downlink: connection?.downlink || 10,
    saveData: connection?.saveData || false,
    rtt: connection?.rtt || 0,
  };
  
  console.log('[BackgroundSync] 网络状态更新:', networkStatus);
}

/**
 * 检查是否满足同步的网络条件
 */
function checkNetworkConditions() {
  // 必须在线
  if (!networkStatus.online) return false;
  
  // 节省数据模式下不同步
  if (networkStatus.saveData) return false;
  
  // 网络太差时不同步（慢于3G）
  const slowTypes = ['slow-2g', '2g'];
  if (slowTypes.includes(networkStatus.effectiveType)) return false;
  
  return true;
}

// ========== 电池状态检测 ==========

/**
 * 更新电池状态
 */
async function updateBatteryStatus() {
  if (typeof navigator === 'undefined' || !navigator.getBattery) return;
  
  try {
    const battery = await navigator.getBattery();
    
    batteryStatus = {
      charging: battery.charging,
      level: battery.level,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
    };
    
    console.log('[BackgroundSync] 电池状态更新:', batteryStatus);
  } catch (e) {
    console.warn('[BackgroundSync] 获取电池状态失败:', e);
    // 获取失败时使用默认值（假设可以同步）
    batteryStatus = { charging: false, level: 1 };
  }
}

/**
 * 检查是否满足同步的电池条件
 */
function checkBatteryConditions() {
  // 充电中可以同步
  if (batteryStatus.charging) return true;
  
  // 电池电量充足（>=20%）
  if (batteryStatus.level >= CONFIG.MIN_BATTERY_LEVEL) return true;
  
  return false;
}

// ========== 同步逻辑 ==========

/**
 * 检查是否应该执行自动同步
 */
function shouldAutoSync() {
  // 正在同步中，不重复执行
  if (isSyncing()) {
    console.log('[BackgroundSync] 已有同步正在进行，跳过');
    return false;
  }
  
  // 检查网络条件
  if (!checkNetworkConditions()) {
    console.log('[BackgroundSync] 网络条件不满足，跳过同步');
    return false;
  }
  
  // 检查电池条件
  if (!checkBatteryConditions()) {
    console.log('[BackgroundSync] 电池条件不满足，跳过同步');
    return false;
  }
  
  return true;
}

/**
 * 执行后台同步
 */
async function performBackgroundSync() {
  if (!shouldAutoSync()) return;
  
  try {
    console.log('[BackgroundSync] 开始后台同步...');
    
    notifyCallbacks('syncStart', {
      type: 'background',
      timestamp: new Date().toISOString(),
    });
    
    const result = await executeSync({
      syncType: 'incremental', // 后台同步使用增量模式
      onProgress: ({ progress, message }) => {
        notifyCallbacks('syncProgress', { progress, message });
      },
    });
    
    console.log('[BackgroundSync] 后台同步完成:', result);
    
    notifyCallbacks('syncComplete', {
      success: result.success,
      hasConflicts: result.hasConflicts,
      conflictCount: result.conflictCount,
      changedCount: result.changedCount,
      timestamp: new Date().toISOString(),
    });
    
  } catch (e) {
    console.error('[BackgroundSync] 后台同步失败:', e);
    notifyCallbacks('syncError', {
      error: e.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 计算下一次同步的间隔
 */
function getNextSyncInterval() {
  // 充电时同步更频繁
  if (batteryStatus.charging) {
    return CONFIG.CHARGING_SYNC_INTERVAL;
  }
  return CONFIG.SYNC_INTERVAL;
}

/**
 * （重新）启动同步计时器
 */
function startSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  
  const interval = getNextSyncInterval();
  syncTimer = setInterval(performBackgroundSync, interval);
  
  console.log(`[BackgroundSync] 后台同步计时器已启动，间隔: ${interval / 1000 / 60} 分钟`);
}

/**
 * 停止同步计时器
 */
function stopSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[BackgroundSync] 后台同步计时器已停止');
  }
}

// ========== 事件监听 ==========

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  if (typeof window === 'undefined') return;
  
  // 网络状态变化
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);
  
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection) {
    connection.addEventListener('change', handleNetworkChange);
  }
  
  // 电池状态变化
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      battery.addEventListener('chargingchange', handleBatteryChange);
      battery.addEventListener('levelchange', handleBatteryChange);
    });
  }
  
  // 页面可见性变化（切到后台/前台）
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * 移除事件监听器
 */
function removeEventListeners() {
  if (typeof window === 'undefined') return;
  
  window.removeEventListener('online', handleNetworkChange);
  window.removeEventListener('offline', handleNetworkChange);
  
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection) {
    connection.removeEventListener('change', handleNetworkChange);
  }
  
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      battery.removeEventListener('chargingchange', handleBatteryChange);
      battery.removeEventListener('levelchange', handleBatteryChange);
    });
  }
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

// 网络变化防抖
let networkDebounceTimer = null;

function handleNetworkChange() {
  if (networkDebounceTimer) {
    clearTimeout(networkDebounceTimer);
  }
  
  networkDebounceTimer = setTimeout(() => {
    updateNetworkStatus();
    
    // 网络恢复时立即尝试同步
    if (networkStatus.online) {
      performBackgroundSync();
    }
    
    // 根据网络状态调整同步间隔
    startSyncTimer();
  }, CONFIG.NETWORK_DEBOUNCE);
}

function handleBatteryChange() {
  updateBatteryStatus().then(() => {
    // 根据电池状态调整同步间隔
    startSyncTimer();
  });
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // 切到后台，确保计时器运行
    console.log('[BackgroundSync] 应用切到后台');
    startSyncTimer();
  } else {
    // 切到前台，立即同步一次
    console.log('[BackgroundSync] 应用切到前台');
    performBackgroundSync();
  }
  
  notifyCallbacks('visibilityChange', {
    visible: document.visibilityState === 'visible',
  });
}

// ========== 回调管理 ==========

/**
 * 注册回调
 */
export function onBackgroundSyncEvent(callback) {
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

/**
 * 通知所有回调
 */
function notifyCallbacks(eventType, data) {
  callbacks.forEach(callback => {
    try {
      callback(eventType, data);
    } catch (e) {
      console.error('[BackgroundSync] 回调执行失败:', e);
    }
  });
}

// ========== 初始化/销毁 ==========

/**
 * 初始化后台同步
 */
export async function initBackgroundSync() {
  if (isInitialized) {
    console.warn('[BackgroundSync] 已初始化');
    return;
  }
  
  console.log('[BackgroundSync] 初始化后台同步...');
  
  // 获取初始状态
  updateNetworkStatus();
  await updateBatteryStatus();
  
  // 设置事件监听
  setupEventListeners();
  
  // 启动同步计时器
  startSyncTimer();
  
  // 立即执行一次同步
  performBackgroundSync();
  
  isInitialized = true;
  console.log('[BackgroundSync] 初始化完成');
}

/**
 * 停止后台同步
 */
export function stopBackgroundSync() {
  stopSyncTimer();
  removeEventListeners();
  isInitialized = false;
  
  if (networkDebounceTimer) {
    clearTimeout(networkDebounceTimer);
    networkDebounceTimer = null;
  }
  
  console.log('[BackgroundSync] 已停止');
}

/**
 * 手动触发后台同步
 */
export async function triggerBackgroundSync(options = {}) {
  const { force = false } = options;
  
  if (force) {
    console.log('[BackgroundSync] 强制触发同步');
    try {
      return await executeSync(options);
    } catch (e) {
      console.error('[BackgroundSync] 强制同步失败:', e);
      throw e;
    }
  }
  
  return await performBackgroundSync();
}

/**
 * 获取当前状态
 */
export function getBackgroundSyncStatus() {
  return {
    isInitialized,
    isSyncing: isSyncing(),
    networkStatus,
    batteryStatus,
    syncInterval: getNextSyncInterval(),
    pendingCallbacks: callbacks.size,
  };
}

// 默认导出
export default {
  CONFIG,
  initBackgroundSync,
  stopBackgroundSync,
  triggerBackgroundSync,
  getBackgroundSyncStatus,
  onBackgroundSyncEvent,
  checkNetworkConditions,
  checkBatteryConditions,
};
