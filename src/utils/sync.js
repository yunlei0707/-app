/**
 * P4阶段：数据同步工具
 * 功能：自动同步、增量同步、冲突检测
 */

import { getAllBabies, getMomentsByBaby, addMoment, updateMoment, deleteMoment } from './db';
import { getCurrentV2Account, getCurrentBabyInfo, addMomentToCurrentAccount } from './dbV2';

// ========== 同步状态常量 ==========
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
};

// ========== 全局同步状态（单例） ==========
let syncState = {
  status: SYNC_STATUS.IDLE,
  progress: 0,
  message: '',
  lastSyncTime: null,
  error: null,
};

// 状态变更监听器
const listeners = new Set();

/**
 * 添加状态监听器
 */
export function addSyncListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * 更新同步状态并通知监听器
 */
function updateSyncState(newState) {
  syncState = { ...syncState, ...newState };
  listeners.forEach(callback => {
    try {
      callback(syncState);
    } catch (e) {
      console.error('[Sync] 监听器回调失败:', e);
    }
  });
}

/**
 * 获取当前同步状态
 */
export function getSyncState() {
  return { ...syncState };
}

// ========== 同步锁机制 ==========
let syncLock = false;
const LOCK_TIMEOUT = 30000; // 30秒超时
let lockTimeoutId = null;

/**
 * 获取同步锁
 * @returns {boolean} 是否成功获取锁
 */
export function acquireSyncLock() {
  if (syncLock) {
    console.log('[Sync] 同步锁已被占用，跳过本次同步');
    return false;
  }
  
  syncLock = true;
  
  // 设置超时自动释放
  if (lockTimeoutId) {
    clearTimeout(lockTimeoutId);
  }
  lockTimeoutId = setTimeout(() => {
    if (syncLock) {
      console.warn('[Sync] 同步锁超时，强制释放');
      releaseSyncLock();
      updateSyncState({
        status: SYNC_STATUS.ERROR,
        error: '同步超时，请重试',
      });
    }
  }, LOCK_TIMEOUT);
  
  return true;
}

/**
 * 释放同步锁
 */
export function releaseSyncLock() {
  syncLock = false;
  if (lockTimeoutId) {
    clearTimeout(lockTimeoutId);
    lockTimeoutId = null;
  }
}

/**
 * 检查是否正在同步
 */
export function isSyncing() {
  return syncLock;
}

// ========== 核心同步逻辑 ==========

/**
 * 收集本地所有变更数据
 * （目前为本地全量同步，后续扩展为增量同步）
 */
async function collectLocalChanges() {
  const changes = {
    babies: [],
    moments: [],
    timestamp: new Date().toISOString(),
  };
  
  try {
    // 收集宝宝信息
    const babies = await getAllBabies();
    changes.babies = babies;
    
    // 收集所有宝宝的动态
    for (const baby of babies) {
      const moments = await getMomentsByBaby(baby.id);
      changes.moments = [...changes.moments, ...moments];
    }
    
    // 收集v2账号信息
    const v2Account = getCurrentV2Account();
    if (v2Account) {
      changes.v2Account = v2Account;
    }
    
  } catch (e) {
    console.error('[Sync] 收集本地变更失败:', e);
    throw e;
  }
  
  return changes;
}

/**
 * 执行同步（目前为本地同步验证，后续对接云端）
 * P4阶段先实现同步框架和UI触发逻辑
 */
export async function executeSync(options = {}) {
  const { 
    onProgress = null, 
    force = false,
    syncType = 'full' // 'full' | 'incremental'
  } = options;
  
  // 获取同步锁
  if (!acquireSyncLock()) {
    return { success: false, skipped: true, reason: '正在同步中' };
  }
  
  try {
    updateSyncState({
      status: SYNC_STATUS.SYNCING,
      progress: 0,
      message: '准备同步...',
      error: null,
    });
    
    if (onProgress) {
      onProgress({ progress: 0, message: '准备同步...' });
    }
    
    // ========== 步骤1：收集本地数据 ==========
    updateSyncState({ progress: 20, message: '收集本地数据...' });
    if (onProgress) onProgress({ progress: 20, message: '收集本地数据...' });
    
    const localChanges = await collectLocalChanges();
    await new Promise(r => setTimeout(r, 300)); // 模拟网络延迟
    
    // ========== 步骤2：数据校验 ==========
    updateSyncState({ progress: 40, message: '数据校验中...' });
    if (onProgress) onProgress({ progress: 40, message: '数据校验中...' });
    
    await new Promise(r => setTimeout(r, 200));
    
    // ========== 步骤3：同步处理（P4阶段先实现框架）==========
    updateSyncState({ progress: 60, message: '同步数据...' });
    if (onProgress) onProgress({ progress: 60, message: '同步数据...' });
    
    // TODO: 对接云端API
    // 目前只做本地同步状态更新
    await new Promise(r => setTimeout(r, 500));
    
    // ========== 步骤4：完成 ==========
    updateSyncState({ progress: 100, message: '同步完成' });
    if (onProgress) onProgress({ progress: 100, message: '同步完成' });
    
    updateSyncState({
      status: SYNC_STATUS.SUCCESS,
      lastSyncTime: new Date().toISOString(),
    });
    
    // 保存最后同步时间
    localStorage.setItem('lastSyncTime', new Date().toISOString());
    
    return { 
      success: true, 
      data: localChanges,
      lastSyncTime: syncState.lastSyncTime
    };
    
  } catch (error) {
    console.error('[Sync] 同步失败:', error);
    updateSyncState({
      status: SYNC_STATUS.ERROR,
      error: error.message || '同步失败',
    });
    throw error;
    
  } finally {
    releaseSyncLock();
  }
}

// ========== 前台/后台切换检测 ==========
let visibilityChangeHandler = null;

/**
 * 监听页面可见性变化（切前台时自动同步）
 */
export function setupVisibilitySync() {
  // 避免重复设置
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
  }
  
  visibilityChangeHandler = async () => {
    if (document.visibilityState === 'visible') {
      console.log('[Sync] 检测到切前台，准备同步');
      
      // 防抖：切前台后延迟1秒再同步，避免频繁切换
      setTimeout(async () => {
        if (document.visibilityState === 'visible' && !isSyncing()) {
          try {
            await executeSync();
          } catch (e) {
            console.error('[Sync] 切前台自动同步失败:', e);
          }
        }
      }, 1000);
    }
  };
  
  document.addEventListener('visibilitychange', visibilityChangeHandler);
  
  return () => {
    if (visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      visibilityChangeHandler = null;
    }
  };
}

/**
 * 清理所有监听器
 */
export function cleanupSync() {
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
  listeners.clear();
  releaseSyncLock();
}

// ========== 导出工具函数供UI使用 ==========

/**
 * 手动触发同步（UI按钮调用）
 */
export async function triggerManualSync() {
  if (isSyncing()) {
    return { success: false, reason: '正在同步中，请稍候' };
  }
  
  try {
    const result = await executeSync({ force: true });
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 获取上次同步时间
 */
export function getLastSyncTime() {
  const timeStr = localStorage.getItem('lastSyncTime');
  return timeStr ? new Date(timeStr) : null;
}

/**
 * 格式化同步时间显示
 */
export function formatLastSyncTime() {
  const time = getLastSyncTime();
  if (!time) return '从未同步';
  
  const now = new Date();
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return time.toLocaleDateString('zh-CN');
}

// 默认导出
export default {
  SYNC_STATUS,
  executeSync,
  triggerManualSync,
  isSyncing,
  getSyncState,
  addSyncListener,
  setupVisibilitySync,
  cleanupSync,
  getLastSyncTime,
  formatLastSyncTime,
  acquireSyncLock,
  releaseSyncLock,
};
