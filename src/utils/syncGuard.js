/**
 * P1上线防护：同步"静默失败"守护
 * 功能：超过24小时未同步成功则提醒用户，防止数据丢失而不自知
 */

import { safeStorage } from './dataRecovery';
import { getCurrentUTC, formatRelativeTime, getTimeDiff } from './timeSync';

// ========== 配置 ==========
const CONFIG = {
  // 警告阈值（24小时）
  WARNING_THRESHOLD: 24 * 60 * 60 * 1000,
  // 危险阈值（72小时）
  DANGER_THRESHOLD: 72 * 60 * 60 * 1000,
  // 存储键
  LAST_SUCCESS_KEY: 'last_sync_success',
  FAILURE_COUNT_KEY: 'sync_failure_count',
  SYNC_HISTORY_KEY: 'sync_history',
};

// ========== 状态 ==========
let warningShown = false;
const statusCallbacks = new Set();

/**
 * 注册状态变化回调
 */
export function onSyncGuardStatusChange(callback) {
  statusCallbacks.add(callback);
  return () => statusCallbacks.delete(callback);
}

/**
 * 通知状态变化
 */
function notifyStatusChange(status) {
  statusCallbacks.forEach(cb => {
    try { cb(status); } catch (e) {
      console.error('[SyncGuard] 回调失败:', e);
    }
  });
}

/**
 * 记录同步成功
 */
export function recordSyncSuccess(syncResult = {}) {
  const now = getCurrentUTC();
  
  // 更新最后成功时间
  safeStorage.setItem(CONFIG.LAST_SUCCESS_KEY, now);
  
  // 重置失败计数
  safeStorage.setItem(CONFIG.FAILURE_COUNT_KEY, 0);
  
  // 记录到历史
  addSyncHistory({
    type: 'success',
    timestamp: now,
    changedMoments: syncResult.changedCount || 0,
    hasConflicts: syncResult.hasConflicts || false,
  });
  
  // 重置警告状态
  warningShown = false;
  
  console.log('[SyncGuard] ✅ 同步成功已记录');
  notifyStatusChange(getSyncGuardStatus());
}

/**
 * 记录同步失败
 */
export function recordSyncFailure(error = {}) {
  const now = getCurrentUTC();
  const failureCount = safeStorage.getItem(CONFIG.FAILURE_COUNT_KEY, 0) + 1;
  
  safeStorage.setItem(CONFIG.FAILURE_COUNT_KEY, failureCount);
  
  // 记录到历史
  addSyncHistory({
    type: 'failure',
    timestamp: now,
    errorMessage: error.message || '未知错误',
    failureCount,
  });
  
  console.log(`[SyncGuard] ❌ 同步失败已记录，连续失败 ${failureCount} 次`);
  notifyStatusChange(getSyncGuardStatus());
}

/**
 * 添加同步历史记录
 */
function addSyncHistory(record) {
  const history = safeStorage.getItem(CONFIG.SYNC_HISTORY_KEY, []);
  history.unshift({
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...record,
  });
  
  // 只保留最近50条
  if (history.length > 50) {
    history.splice(50);
  }
  
  safeStorage.setItem(CONFIG.SYNC_HISTORY_KEY, history);
}

/**
 * 获取最后同步成功时间
 */
export function getLastSyncSuccessTime() {
  return safeStorage.getItem(CONFIG.LAST_SUCCESS_KEY, null);
}

/**
 * 获取距离上次成功同步的时间（毫秒）
 */
export function getTimeSinceLastSuccess() {
  const lastSuccess = getLastSyncSuccessTime();
  if (!lastSuccess) {
    // 从未同步成功过，认为是无穷大
    return Infinity;
  }
  return Math.abs(getTimeDiff(getCurrentUTC(), lastSuccess));
}

/**
 * 获取连续失败次数
 */
export function getConsecutiveFailureCount() {
  return safeStorage.getItem(CONFIG.FAILURE_COUNT_KEY, 0);
}

/**
 * 获取同步守护状态
 */
export function getSyncGuardStatus() {
  const timeSinceLastSuccess = getTimeSinceLastSuccess();
  const failureCount = getConsecutiveFailureCount();
  const lastSuccess = getLastSyncSuccessTime();
  
  let level = 'ok';
  let message = '数据同步正常';
  
  if (!lastSuccess) {
    level = 'warning';
    message = '从未同步成功过，请检查网络连接';
  } else if (timeSinceLastSuccess > CONFIG.DANGER_THRESHOLD) {
    level = 'danger';
    const days = Math.round(timeSinceLastSuccess / (24 * 60 * 60 * 1000));
    message = `已超过 ${days} 天未同步成功，数据有丢失风险！`;
  } else if (timeSinceLastSuccess > CONFIG.WARNING_THRESHOLD) {
    level = 'warning';
    const hours = Math.round(timeSinceLastSuccess / (60 * 60 * 1000));
    message = `已超过 ${hours} 小时未同步成功，建议检查网络`;
  } else if (failureCount >= 3) {
    level = 'warning';
    message = `连续 ${failureCount} 次同步失败，请检查网络`;
  }
  
  return {
    level, // ok | warning | danger
    message,
    lastSuccessTime: lastSuccess,
    lastSuccessRelative: lastSuccess ? formatRelativeTime(lastSuccess) : '从未',
    timeSinceLastSuccessMs: timeSinceLastSuccess,
    consecutiveFailures: failureCount,
    shouldWarnUser: level !== 'ok',
    shouldBlockAction: level === 'danger',
  };
}

/**
 * 检查是否需要显示警告
 * @returns {Object} 警告信息（如果需要）
 */
export function checkSyncWarning() {
  const status = getSyncGuardStatus();
  
  // 如果已经显示过警告且状态没有恶化，不重复显示
  if (warningShown && status.level === 'warning') {
    return { ...status, shouldShow: false };
  }
  
  if (status.shouldWarnUser) {
    warningShown = true;
    return { ...status, shouldShow: true };
  }
  
  return { ...status, shouldShow: false };
}

/**
 * 执行关键操作前的保护检查
 * 比如：删除数据、清除缓存前，确认最近同步过
 */
export function guardCriticalAction(actionType = 'unknown') {
  const status = getSyncGuardStatus();
  
  if (status.shouldBlockAction) {
    console.warn(`[SyncGuard] ⛔ 阻止关键操作: ${actionType}，原因: ${status.message}`);
    return {
      allowed: false,
      reason: 'sync_failure_danger',
      message: `为保护数据安全，${actionType}操作已被临时阻止。${status.message}`,
      suggestion: '请先连接网络完成数据同步后再执行此操作',
    };
  }
  
  if (status.shouldWarnUser) {
    console.warn(`[SyncGuard] ⚠️  关键操作警告: ${actionType}，${status.message}`);
    return {
      allowed: true,
      warning: true,
      reason: 'sync_failure_warning',
      message: status.message,
      suggestion: '建议确认数据已备份后再执行此操作',
    };
  }
  
  console.log(`[SyncGuard] ✅ 关键操作检查通过: ${actionType}`);
  return {
    allowed: true,
    warning: false,
  };
}

/**
 * 获取同步历史
 */
export function getSyncHistory(limit = 20) {
  const history = safeStorage.getItem(CONFIG.SYNC_HISTORY_KEY, []);
  return history.slice(0, limit);
}

/**
 * 获取同步统计信息
 */
export function getSyncStats() {
  const history = getSyncHistory(100);
  const total = history.length;
  const successCount = history.filter(h => h.type === 'success').length;
  const failureCount = history.filter(h => h.type === 'failure').length;
  
  return {
    totalSyncs: total,
    successCount,
    failureCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    lastSuccess: getLastSyncSuccessTime(),
    consecutiveFailures: getConsecutiveFailureCount(),
  };
}

/**
 * 用户手动确认警告后清除警告状态
 */
export function acknowledgeWarning() {
  warningShown = true;
  console.log('[SyncGuard] 用户已确认警告');
}

/**
 * 强制重置守护状态（仅用于测试或用户手动操作）
 */
export function resetSyncGuard() {
  safeStorage.setItem(CONFIG.LAST_SUCCESS_KEY, getCurrentUTC());
  safeStorage.setItem(CONFIG.FAILURE_COUNT_KEY, 0);
  warningShown = false;
  console.log('[SyncGuard] 同步守护状态已重置');
  notifyStatusChange(getSyncGuardStatus());
}

/**
 * 初始化同步守护
 */
export function initSyncGuard() {
  console.log('[SyncGuard] 同步守护系统初始化');
  
  const status = getSyncGuardStatus();
  console.log(`[SyncGuard] 当前状态: ${status.level}`);
  console.log(`[SyncGuard] 上次成功: ${status.lastSuccessRelative}`);
  console.log(`[SyncGuard] 连续失败: ${status.consecutiveFailures} 次`);
  
  if (status.shouldWarnUser) {
    console.warn(`[SyncGuard] ⚠️  ${status.message}`);
  }
  
  // 定时检查（每小时）
  setInterval(() => {
    const currentStatus = checkSyncWarning();
    if (currentStatus.shouldShow) {
      console.warn(`[SyncGuard] ⚠️  定时检查触发警告: ${currentStatus.message}`);
      notifyStatusChange(currentStatus);
    }
  }, 60 * 60 * 1000);
  
  return true;
}

// 默认导出
export default {
  initSyncGuard,
  recordSyncSuccess,
  recordSyncFailure,
  getSyncGuardStatus,
  checkSyncWarning,
  guardCriticalAction,
  getSyncHistory,
  getSyncStats,
  acknowledgeWarning,
  resetSyncGuard,
  getLastSyncSuccessTime,
  getTimeSinceLastSuccess,
  getConsecutiveFailureCount,
  onSyncGuardStatusChange,
};
