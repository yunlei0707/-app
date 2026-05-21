/**
 * P0上线防护：数据误操作回滚（后悔药）
 * 功能：删除操作后30秒内可撤销，保留最近20条删除记录
 */

// ========== 配置 ==========
const CONFIG = {
  // 撤销窗口时间（30秒）
  UNDO_WINDOW: 30 * 1000,
  // 最大保留删除记录数
  MAX_RECORDS: 20,
  // 存储键
  STORAGE_KEY: 'recent_deleted_records',
};

// ========== 删除记录类型 ==========
export const DELETE_TYPE = {
  MOMENT: 'moment',
  BABY: 'baby',
  CAPSULE: 'capsule',
  MEDIA: 'media',
};

// ========== 状态管理 ==========
let pendingUndo = null; // 当前可撤销的删除操作
let undoTimer = null; // 撤销倒计时定时器
const undoCallbacks = new Set(); // 状态变化回调

/**
 * 删除记录结构
 * @typedef {Object} DeletedRecord
 * @property {string} id - 记录ID
 * @property {string} type - 记录类型
 * @property {Object} data - 完整数据备份
 * @property {number} deletedAt - 删除时间戳
 * @property {number} expireAt - 过期时间戳
 */

/**
 * 注册撤销状态变化回调
 */
export function onUndoStatusChange(callback) {
  undoCallbacks.add(callback);
  return () => undoCallbacks.delete(callback);
}

/**
 * 通知所有回调
 */
function notifyCallbacks() {
  undoCallbacks.forEach(callback => {
    try {
      callback({
        hasPendingUndo: !!pendingUndo,
        pendingType: pendingUndo?.type,
        remainingTime: pendingUndo ? Math.max(0, pendingUndo.expireAt - Date.now()) : 0,
      });
    } catch (e) {
      console.error('[Undo] 回调执行失败:', e);
    }
  });
}

/**
 * 清除撤销定时器
 */
function clearUndoTimer() {
  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }
}

/**
 * 撤销窗口过期
 */
function onUndoExpired() {
  console.log('[Undo] 撤销窗口已过期');
  pendingUndo = null;
  notifyCallbacks();
}

/**
 * 保存删除记录到历史
 */
function saveToHistory(record) {
  try {
    const history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    history.unshift({
      ...record,
      canUndo: false, // 已过期不可撤销
    });
    
    // 保留最近N条
    if (history.length > CONFIG.MAX_RECORDS) {
      history.splice(CONFIG.MAX_RECORDS);
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('[Undo] 保存删除历史失败:', e);
  }
}

/**
 * 执行删除前的操作（调用此函数开启撤销窗口）
 * @param {string} type - 删除类型
 * @param {Object|Array} data - 被删除的数据
 * @param {Function} onConfirm - 确认执行删除的回调
 * @returns {boolean} 是否成功开启撤销窗口
 */
export function performDeleteWithUndo(type, data, onConfirm) {
  // 清除之前的撤销状态
  clearUndoTimer();
  
  // 创建撤销记录
  const now = Date.now();
  pendingUndo = {
    id: `delete_${now}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    data,
    deletedAt: now,
    expireAt: now + CONFIG.UNDO_WINDOW,
    onConfirm, // 实际执行删除的函数
  };
  
  console.log(`[Undo] 开启撤销窗口，类型: ${type}, 30秒内可撤销`);
  
  // 启动过期定时器
  undoTimer = setTimeout(onUndoExpired, CONFIG.UNDO_WINDOW);
  
  // 通知状态变化
  notifyCallbacks();
  
  // 执行实际删除（延迟100ms确保UI有机会显示撤销按钮）
  setTimeout(() => {
    if (pendingUndo) { // 用户没有手动撤销
      try {
        if (onConfirm) onConfirm(data);
        console.log('[Undo] 删除操作已执行');
      } catch (e) {
        console.error('[Undo] 执行删除失败:', e);
      }
    }
  }, 100);
  
  return true;
}

/**
 * 撤销删除
 * @returns {Object|null} 恢复的数据
 */
export async function undoDelete() {
  if (!pendingUndo) {
    console.warn('[Undo] 没有可撤销的删除操作');
    return null;
  }
  
  const recordToRestore = { ...pendingUndo };
  
  // 清除撤销状态
  clearUndoTimer();
  pendingUndo = null;
  notifyCallbacks();
  
  console.log(`[Undo] 撤销删除，类型: ${recordToRestore.type}`);
  
  // 返回被删除的数据，由调用者负责恢复
  return recordToRestore.data;
}

/**
 * 立即确认删除（跳过撤销等待）
 */
export function confirmDeleteImmediately() {
  if (pendingUndo) {
    const { onConfirm, data } = pendingUndo;
    try {
      if (onConfirm) onConfirm(data);
    } catch (e) {
      console.error('[Undo] 执行删除失败:', e);
    }
    
    // 保存到历史但不保留撤销
    saveToHistory(pendingUndo);
    clearUndoTimer();
    pendingUndo = null;
    notifyCallbacks();
  }
}

/**
 * 获取当前可撤销的删除操作
 */
export function getPendingUndo() {
  if (!pendingUndo) return null;
  
  return {
    ...pendingUndo,
    remainingTime: Math.max(0, pendingUndo.expireAt - Date.now()),
  };
}

/**
 * 获取删除历史记录
 */
export function getDeleteHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    return history.map(record => ({
      ...record,
      age: Date.now() - record.deletedAt,
    }));
  } catch (e) {
    console.error('[Undo] 获取删除历史失败:', e);
    return [];
  }
}

/**
 * 清空删除历史
 */
export function clearDeleteHistory() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

/**
 * 从历史记录中恢复（超过撤销窗口后的手动恢复）
 * @param {string} recordId - 历史记录ID
 * @returns {Object|null} 恢复的数据
 */
export function restoreFromHistory(recordId) {
  try {
    const history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    const record = history.find(r => r.id === recordId);
    
    if (!record) {
      console.warn('[Undo] 历史记录不存在:', recordId);
      return null;
    }
    
    console.log(`[Undo] 从历史恢复，类型: ${record.type}`);
    return record.data;
    
  } catch (e) {
    console.error('[Undo] 从历史恢复失败:', e);
    return null;
  }
}

/**
 * 检查是否有可撤销的操作
 */
export function hasPendingUndo() {
  return !!pendingUndo;
}

/**
 * 获取剩余可撤销时间（毫秒）
 */
export function getRemainingUndoTime() {
  if (!pendingUndo) return 0;
  return Math.max(0, pendingUndo.expireAt - Date.now());
}

/**
 * 清理所有状态（用于登出）
 */
export function cleanupUndoSystem() {
  clearUndoTimer();
  pendingUndo = null;
  undoCallbacks.clear();
  console.log('[Undo] 撤销系统已清理');
}

// 默认导出
export default {
  CONFIG,
  DELETE_TYPE,
  performDeleteWithUndo,
  undoDelete,
  confirmDeleteImmediately,
  getPendingUndo,
  getDeleteHistory,
  clearDeleteHistory,
  restoreFromHistory,
  hasPendingUndo,
  getRemainingUndoTime,
  onUndoStatusChange,
  cleanupUndoSystem,
};
