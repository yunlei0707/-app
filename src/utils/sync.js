/**
 * P4阶段：数据同步工具
 * 功能：自动同步、增量同步、冲突检测
 */

import { getAllBabies, getAllMomentsByBabyForSync, addMoment, updateMoment, deleteMoment } from './db';
import { getCurrentV2Account, getCurrentBabyInfo, addMomentToCurrentAccount } from './dbV2';
import { detectConflicts, addConflict, getUnresolvedConflictCount } from './conflictResolver';

// ========== 同步状态常量 ==========
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  WARNING: 'warning', // 有冲突需要处理
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

// 防抖同步（避免频繁触发）
let debounceTimeoutId = null;
const DEBOUNCE_DELAY = 5000; // 5秒防抖

/**
 * 防抖同步（用于自动触发场景）
 */
export function debounceSync(options = {}) {
  if (debounceTimeoutId) {
    clearTimeout(debounceTimeoutId);
  }
  
  debounceTimeoutId = setTimeout(async () => {
    try {
      await executeSync(options);
    } catch (e) {
      console.error('[Sync] 防抖同步失败:', e);
    }
  }, DEBOUNCE_DELAY);
}

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
 * 获取上次同步时间点
 * @returns {Date|null}
 */
function getSyncPoint() {
  const timeStr = localStorage.getItem('syncPoint');
  return timeStr ? new Date(timeStr) : null;
}

/**
 * 更新同步时间点
 */
function updateSyncPoint(timestamp = new Date().toISOString()) {
  localStorage.setItem('syncPoint', timestamp);
}

/**
 * 检查记录是否在同步时间点之后
 */
function isAfterSyncPoint(record, syncPoint) {
  if (!syncPoint) return true;
  
  const recordTime = record.updatedAt || record.createdAt || record.date;
  if (!recordTime) return true;
  
  return new Date(recordTime) > syncPoint;
}

/**
 * 收集本地变更数据
 * @param {boolean} incremental - 是否增量同步
 */
async function collectLocalChanges(incremental = false) {
  const changes = {
    babies: [],
    moments: [],
    timestamp: new Date().toISOString(),
    isIncremental: incremental,
  };
  
  try {
    const syncPoint = incremental ? getSyncPoint() : null;
    
    if (incremental && syncPoint) {
      console.log(`[Sync] 增量同步，同步点: ${syncPoint.toISOString()}`);
    } else {
      console.log('[Sync] 全量同步');
    }
    
    // 收集宝宝信息
    const babies = await getAllBabies();
    changes.babies = incremental 
      ? babies.filter(b => isAfterSyncPoint(b, syncPoint))
      : babies;
    
    // 收集所有宝宝的动态（包括已删除的，用于同步）
    for (const baby of babies) {
      const moments = await getAllMomentsByBabyForSync(baby.id);
      const filteredMoments = incremental
        ? moments.filter(m => isAfterSyncPoint(m, syncPoint))
        : moments;
      changes.moments = [...changes.moments, ...filteredMoments];
    }
    
    // 收集v2账号信息
    const v2Account = getCurrentV2Account();
    if (v2Account && v2Account.accountData?.timeline) {
      const v2Timeline = incremental
        ? v2Account.accountData.timeline.filter(m => isAfterSyncPoint(m, syncPoint))
        : v2Account.accountData.timeline;
      changes.v2Timeline = v2Timeline;
    }
    
    console.log(`[Sync] 收集到 ${changes.babies.length} 个宝宝, ${changes.moments.length} 条动态变更`);
    
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
    ignoreLock = false,
    syncType = 'full' // 'full' | 'incremental'
  } = options;
  
  // 获取同步锁（忽略锁模式跳过）
  if (!ignoreLock && !acquireSyncLock()) {
    return { success: false, skipped: true, reason: '正在同步中' };
  }
  
  // 强制模式下获取锁，失败则强制释放后再获取
  if (ignoreLock) {
    acquireSyncLock();
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
    
    const isIncremental = syncType === 'incremental';
    const localChanges = await collectLocalChanges(isIncremental);
    await new Promise(r => setTimeout(r, 300)); // 模拟网络延迟
    
    // ========== 步骤2：数据校验 ==========
    updateSyncState({ progress: 40, message: '数据校验中...' });
    if (onProgress) onProgress({ progress: 40, message: '数据校验中...' });
    
    await new Promise(r => setTimeout(r, 200));
    
    // ========== 步骤3：同步处理（P4阶段先实现框架）==========
    updateSyncState({ progress: 60, message: '同步数据...' });
    if (onProgress) onProgress({ progress: 60, message: '同步数据...' });
    
    // TODO: 对接云端API（上传本地变更 + 拉取云端变更）
    // 目前只做本地同步状态更新和冲突检测模拟
    await new Promise(r => setTimeout(r, 500));
    
    // ========== 步骤3.5：冲突检测 ==========
    updateSyncState({ progress: 70, message: '检查数据冲突...' });
    if (onProgress) onProgress({ progress: 70, message: '检查数据冲突...' });
    
    // 模拟：从云端拉取数据并检测冲突
    // 实际对接时替换为真实的云端数据拉取
    const remoteChanges = {
      moments: [], // TODO: 从云端获取
      babies: [],  // TODO: 从云端获取
    };
    
    // 检测冲突
    const momentConflicts = detectConflicts(localChanges.moments, remoteChanges.moments || []);
    const babyConflicts = detectConflicts(localChanges.babies, remoteChanges.babies || []);
    const allConflicts = [...momentConflicts, ...babyConflicts];
    
    // 记录冲突（UI会自动更新）
    allConflicts.forEach(conflict => addConflict(conflict));
    
    await new Promise(r => setTimeout(r, 200));
    
    // ========== 步骤4：合并云端变更（TODO）==========
    updateSyncState({ progress: 80, message: '合并数据...' });
    if (onProgress) onProgress({ progress: 80, message: '合并数据...' });
    
    await new Promise(r => setTimeout(r, 200));
    
    // ========== 步骤5：完成 ==========
    const conflictCount = getUnresolvedConflictCount();
    const hasConflicts = conflictCount > 0;
    
    updateSyncState({ 
      progress: 100, 
      message: hasConflicts ? `同步完成，发现${conflictCount}个冲突` : '同步完成'
    });
    if (onProgress) onProgress({ progress: 100, message: hasConflicts ? `同步完成，发现${conflictCount}个冲突` : '同步完成' });
    
    updateSyncState({
      status: hasConflicts ? SYNC_STATUS.WARNING : SYNC_STATUS.SUCCESS,
      lastSyncTime: new Date().toISOString(),
      conflictCount,
    });
    
    // 保存最后同步时间
    localStorage.setItem('lastSyncTime', new Date().toISOString());
    
    // 增量同步成功后，更新同步点（无冲突时才更新）
    if (isIncremental && !hasConflicts) {
      updateSyncPoint(localChanges.timestamp);
    }
    
    return { 
      success: true, 
      data: localChanges,
      isIncremental,
      hasConflicts,
      conflictCount,
      lastSyncTime: syncState.lastSyncTime,
      changedCount: localChanges.moments.length + localChanges.babies.length
    };
    
  } catch (error) {
    console.error('[Sync] 同步失败:', error);
    
    // Token过期处理（401错误）
    if (error.code === 401 || error.status === 401 || error.message?.includes('401')) {
      console.warn('[Sync] 检测到Token过期，尝试刷新');
      try {
        // TODO: 调用刷新Token的API
        // await refreshSession();
        updateSyncState({
          status: SYNC_STATUS.ERROR,
          error: '登录已过期，请重新登录',
        });
      } catch (refreshError) {
        console.error('[Sync] Token刷新失败:', refreshError);
      }
    } else {
      updateSyncState({
        status: SYNC_STATUS.ERROR,
        error: error.message || '同步失败',
      });
    }
    
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
      
      // 使用防抖同步（5秒内多次触发只执行一次）
      debounceSync();
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
 * 强制同步（忽略锁，用于用户手动触发）
 */
export async function forceSync(options = {}) {
  // 强制释放现有锁
  if (syncLock) {
    console.warn('[Sync] 强制释放同步锁');
    releaseSyncLock();
  }
  
  // 取消防抖等待
  if (debounceTimeoutId) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = null;
  }
  
  try {
    return await executeSync({ ...options, force: true });
  } catch (e) {
    return { success: false, error: e.message };
  }
}

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
  forceSync,
  debounceSync,
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
