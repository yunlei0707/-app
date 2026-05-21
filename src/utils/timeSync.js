/**
 * P0上线防护：时区&时间统一
 * 功能：所有时间统一UTC，防止多设备本地时间不同步
 */

// ========== 时间工具 ==========

/**
 * 获取当前UTC时间（ISO格式）
 * 所有时间戳都应该用这个函数生成
 */
export function getCurrentUTC() {
  return new Date().toISOString();
}

/**
 * 获取当前UTC时间戳（毫秒）
 */
export function getCurrentUTCTimestamp() {
  return Date.now();
}

/**
 * 确保时间是UTC格式
 * @param {string|Date|number} time - 时间输入
 * @returns {string} UTC ISO字符串
 */
export function ensureUTC(time) {
  if (!time) {
    return getCurrentUTC();
  }
  
  if (typeof time === 'string') {
    // 已经是ISO格式
    if (time.endsWith('Z')) {
      return time;
    }
    // 尝试解析
    try {
      return new Date(time).toISOString();
    } catch (e) {
      console.warn('[Time] 无法解析时间字符串:', time);
      return getCurrentUTC();
    }
  }
  
  if (typeof time === 'number') {
    return new Date(time).toISOString();
  }
  
  if (time instanceof Date) {
    return time.toISOString();
  }
  
  return getCurrentUTC();
}

/**
 * 比较两个时间的先后（忽略时区，都按UTC比较）
 * @returns {number} -1: time1更早, 0: 相同, 1: time1更晚
 */
export function compareUTC(time1, time2) {
  const t1 = new Date(ensureUTC(time1)).getTime();
  const t2 = new Date(ensureUTC(time2)).getTime();
  
  if (t1 < t2) return -1;
  if (t1 > t2) return 1;
  return 0;
}

/**
 * 获取时间差（毫秒）
 */
export function getTimeDiff(time1, time2) {
  const t1 = new Date(ensureUTC(time1)).getTime();
  const t2 = new Date(ensureUTC(time2)).getTime();
  return t1 - t2;
}

// ========== 带时间戳的数据包装器 ==========

/**
 * 为新建数据添加时间戳
 */
export function withTimestamps(data, options = {}) {
  const now = getCurrentUTC();
  const { updateOnly = false } = options;
  
  if (updateOnly) {
    return {
      ...data,
      updatedAt: now,
    };
  }
  
  return {
    ...data,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

/**
 * 为更新的数据添加更新时间戳
 */
export function withUpdateTimestamp(data) {
  return {
    ...data,
    updatedAt: getCurrentUTC(),
  };
}

/**
 * 为软删除添加删除时间戳
 */
export function withDeleteTimestamp(data) {
  return {
    ...data,
    isDeleted: true,
    deletedAt: getCurrentUTC(),
    updatedAt: getCurrentUTC(),
  };
}

// ========== 本地时间显示（仅供UI显示用） ==========

/**
 * 格式化UTC时间为本地显示时间
 * 注意：只用于UI显示，绝不用于业务逻辑比较
 */
export function formatLocalTime(utcTime, options = {}) {
  try {
    const date = new Date(ensureUTC(utcTime));
    
    const defaultOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    };
    
    return date.toLocaleString('zh-CN', {
      ...defaultOptions,
      ...options,
    });
  } catch (e) {
    console.warn('[Time] 格式化时间失败:', e);
    return utcTime || '';
  }
}

/**
 * 格式化相对时间（如"5分钟前"）
 * 注意：只用于UI显示
 */
export function formatRelativeTime(utcTime) {
  try {
    const date = new Date(ensureUTC(utcTime));
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;
    if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
    return `${Math.floor(diffDay / 365)}年前`;
  } catch (e) {
    console.warn('[Time] 格式化相对时间失败:', e);
    return '未知时间';
  }
}

// ========== 时间同步检查 ==========

let serverTimeOffset = 0; // 本地时间与服务器时间的偏差（毫秒）

/**
 * 设置服务器时间偏移（用于校准）
 */
export function setServerTimeOffset(ms) {
  serverTimeOffset = ms;
  console.log(`[Time] 服务器时间偏移已设置: ${ms}ms`);
}

/**
 * 获取校准后的当前时间（考虑服务器偏移）
 */
export function getCalibratedTime() {
  return new Date(Date.now() + serverTimeOffset).toISOString();
}

/**
 * 检查本地时间偏差是否过大
 * @returns {boolean} 是否需要同步时间
 */
export function checkTimeDrift() {
  // 如果偏差超过1小时，应该提醒用户检查系统时间
  const driftTooLarge = Math.abs(serverTimeOffset) > 60 * 60 * 1000;
  
  if (driftTooLarge) {
    console.warn(`[Time] 本地时间与服务器时间偏差过大: ${serverTimeOffset}ms`);
  }
  
  return {
    driftMs: serverTimeOffset,
    driftTooLarge,
    shouldSync: driftTooLarge,
  };
}

// ========== 同步专用时间工具 ==========

/**
 * 判断数据是否需要同步（基于更新时间）
 * @param {string} localUpdatedAt - 本地更新时间
 * @param {string} remoteUpdatedAt - 云端更新时间
 * @returns {Object} 同步策略
 */
export function getSyncStrategy(localUpdatedAt, remoteUpdatedAt) {
  // 如果任一方没有时间戳，以云端为准
  if (!localUpdatedAt) return { shouldPull: true, shouldPush: false };
  if (!remoteUpdatedAt) return { shouldPull: false, shouldPush: true };
  
  const diff = compareUTC(localUpdatedAt, remoteUpdatedAt);
  
  if (diff > 0) {
    // 本地更新时间更晚，推送到云端
    return { shouldPull: false, shouldPush: true, reason: 'local_newer' };
  } else if (diff < 0) {
    // 云端更新时间更晚，拉取到本地
    return { shouldPull: true, shouldPush: false, reason: 'remote_newer' };
  } else {
    // 时间相同，无需同步
    return { shouldPull: false, shouldPush: false, reason: 'same_time' };
  }
}

/**
 * 判断是否存在冲突（两端都有更新且时间接近）
 */
export function checkTimeConflict(localUpdatedAt, remoteUpdatedAt, thresholdMs = 5000) {
  if (!localUpdatedAt || !remoteUpdatedAt) return false;
  
  const diffMs = Math.abs(getTimeDiff(localUpdatedAt, remoteUpdatedAt));
  // 如果两端更新时间差小于阈值，可能存在冲突
  return diffMs < thresholdMs;
}

// ========== 数据迁移时的时间统一 ==========

/**
 * 统一数据中所有时间字段为UTC格式
 * 用于修复历史数据中的本地时间问题
 */
export function normalizeDataTimestamps(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const result = { ...data };
  
  // 需要统一的时间字段
  const timeFields = [
    'createdAt',
    'updatedAt',
    'deletedAt',
    'date',
    'timestamp',
    'syncedAt',
    'uploadedAt',
  ];
  
  timeFields.forEach(field => {
    if (result[field]) {
      result[field] = ensureUTC(result[field]);
    }
  });
  
  // 递归处理嵌套对象
  Object.keys(result).forEach(key => {
    if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = normalizeDataTimestamps(result[key]);
    }
    if (Array.isArray(result[key])) {
      result[key] = result[key].map(item => normalizeDataTimestamps(item));
    }
  });
  
  return result;
}

// ========== 初始化 & 验证 ==========

/**
 * 验证数据时间格式是否正确
 */
export function validateTimestamps(data) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [] };
  }
  
  const timeFields = ['createdAt', 'updatedAt', 'deletedAt'];
  
  timeFields.forEach(field => {
    if (data[field]) {
      const value = data[field];
      if (typeof value !== 'string' || !value.endsWith('Z')) {
        errors.push({
          field,
          value,
          message: `时间字段 ${field} 格式不正确，应为 UTC ISO 格式`,
        });
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 初始化时间系统
 */
export function initTimeSystem() {
  console.log('[Time] 时间统一系统初始化');
  console.log(`[Time] 当前UTC时间: ${getCurrentUTC()}`);
  console.log(`[Time] 所有时间戳将使用UTC格式`);
  
  // 检查本地时间偏差
  const driftCheck = checkTimeDrift();
  if (driftCheck.shouldSync) {
    console.warn(`[Time] ⚠️  本地时间与服务器时间偏差过大，建议用户检查系统时间`);
  }
  
  return true;
}

/**
 * 给同步数据添加同步时间戳
 */
export function withSyncTimestamp(data) {
  return {
    ...data,
    lastSyncedAt: getCurrentUTC(),
  };
}

// 默认导出
export default {
  getCurrentUTC,
  getCurrentUTCTimestamp,
  ensureUTC,
  compareUTC,
  getTimeDiff,
  withTimestamps,
  withUpdateTimestamp,
  withDeleteTimestamp,
  formatLocalTime,
  formatRelativeTime,
  setServerTimeOffset,
  getCalibratedTime,
  checkTimeDrift,
  getSyncStrategy,
  checkTimeConflict,
  normalizeDataTimestamps,
  validateTimestamps,
  initTimeSystem,
  withSyncTimestamp,
};
