/**
 * P0上线防护：本地数据损坏恢复
 * 功能：JSON解析失败时自动回滚到备份，防止白屏
 */

// ========== 配置 ==========
const CONFIG = {
  // 备份文件数量
  MAX_BACKUPS: 5,
  // 备份间隔（1小时）
  BACKUP_INTERVAL: 60 * 60 * 1000,
  // 备份键前缀
  BACKUP_PREFIX: 'data_backup_',
  // 元数据键
  META_KEY: 'backup_meta',
};

// ========== 状态 ==========
let backupTimer = null;
const recoveryCallbacks = new Set();

/**
 * 注册恢复事件回调
 */
export function onRecoveryEvent(callback) {
  recoveryCallbacks.add(callback);
  return () => recoveryCallbacks.delete(callback);
}

/**
 * 通知恢复事件
 */
function notifyRecovery(event, data) {
  recoveryCallbacks.forEach(cb => {
    try { cb(event, data); } catch (e) {
      console.error('[Recovery] 回调执行失败:', e);
    }
  });
}

/**
 * 安全的JSON解析（带错误处理和恢复）
 * @param {string} jsonString - 要解析的JSON字符串
 * @param {*} fallback - 解析失败时的默认值
 * @param {string} key - 数据键（用于备份恢复）
 * @returns {*} 解析结果
 */
export function safeJSONParse(jsonString, fallback = null, key = null) {
  if (!jsonString || jsonString.trim() === '') {
    return fallback;
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error(`[Recovery] JSON解析失败${key ? `，键: ${key}` : ''}:`, e);
    
    notifyRecovery('parse_error', { key, error: e.message });
    
    // 尝试从备份恢复
    if (key) {
      const recoveredData = tryRecoverFromBackup(key);
      if (recoveredData !== null) {
        console.log(`[Recovery] 已从备份恢复数据: ${key}`);
        notifyRecovery('recovered_from_backup', { key });
        return recoveredData;
      }
    }
    
    return fallback;
  }
}

/**
 * 安全的JSON字符串化
 */
export function safeJSONStringify(data, space = null) {
  try {
    return JSON.stringify(data, (k, v) => {
      // 过滤循环引用
      if (typeof v === 'object' && v !== null && k !== '') {
        // 简单的循环引用检测
        try {
          JSON.stringify(v);
        } catch (e) {
          console.warn('[Recovery] 检测到循环引用，已过滤');
          return '[Circular]';
        }
      }
      return v;
    }, space);
  } catch (e) {
    console.error('[Recovery] JSON序列化失败:', e);
    notifyRecovery('serialize_error', { error: e.message });
    return null;
  }
}

/**
 * 安全包装localStorage操作
 */
export const safeStorage = {
  getItem: (key, fallback = null) => {
    try {
      const value = localStorage.getItem(key);
      return safeJSONParse(value, fallback, key);
    } catch (e) {
      console.error(`[Recovery] localStorage读取失败: ${key}`, e);
      notifyRecovery('storage_read_error', { key, error: e.message });
      
      // 尝试从备份恢复
      const recoveredData = tryRecoverFromBackup(key);
      if (recoveredData !== null) {
        return recoveredData;
      }
      
      return fallback;
    }
  },
  
  setItem: (key, value) => {
    try {
      // 先备份旧数据
      const oldValue = localStorage.getItem(key);
      if (oldValue) {
        createBackup(key, oldValue);
      }
      
      const jsonString = safeJSONStringify(value);
      if (jsonString !== null) {
        localStorage.setItem(key, jsonString);
        return true;
      }
      return false;
    } catch (e) {
      console.error(`[Recovery] localStorage写入失败: ${key}`, e);
      notifyRecovery('storage_write_error', { key, error: e.message });
      return false;
    }
  },
  
  removeItem: (key) => {
    try {
      // 删除前先备份一次
      const oldValue = localStorage.getItem(key);
      if (oldValue) {
        createBackup(key, oldValue);
      }
      
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`[Recovery] localStorage删除失败: ${key}`, e);
      return false;
    }
  },
};

/**
 * 创建数据备份
 */
function createBackup(key, value) {
  try {
    const timestamp = Date.now();
    const backupKey = `${CONFIG.BACKUP_PREFIX}${key}_${timestamp}`;
    
    localStorage.setItem(backupKey, value);
    
    // 更新元数据
    const meta = safeJSONParse(localStorage.getItem(CONFIG.META_KEY), {});
    if (!meta[key]) {
      meta[key] = [];
    }
    
    meta[key].push({
      key: backupKey,
      timestamp,
      size: value.length,
    });
    
    // 只保留最近N个备份
    if (meta[key].length > CONFIG.MAX_BACKUPS) {
      const removed = meta[key].shift();
      localStorage.removeItem(removed.key);
    }
    
    localStorage.setItem(CONFIG.META_KEY, safeJSONStringify(meta));
    
  } catch (e) {
    console.error(`[Recovery] 创建备份失败: ${key}`, e);
  }
}

/**
 * 尝试从备份恢复数据
 */
function tryRecoverFromBackup(key) {
  try {
    const meta = safeJSONParse(localStorage.getItem(CONFIG.META_KEY), {});
    const backups = meta[key] || [];
    
    if (backups.length === 0) {
      return null;
    }
    
    // 从最新的备份开始尝试
    for (let i = backups.length - 1; i >= 0; i--) {
      const backup = backups[i];
      try {
        const value = localStorage.getItem(backup.key);
        if (value) {
          // 验证数据完整性
          const parsed = JSON.parse(value);
          // 恢复到主存储
          localStorage.setItem(key, value);
          return parsed;
        }
      } catch (e) {
        console.warn(`[Recovery] 备份 ${backup.key} 也损坏，尝试下一个`);
      }
    }
    
    return null;
  } catch (e) {
    console.error('[Recovery] 从备份恢复失败:', e);
    return null;
  }
}

/**
 * 获取可用备份列表
 */
export function getAvailableBackups(key = null) {
  try {
    const meta = safeJSONParse(localStorage.getItem(CONFIG.META_KEY), {});
    
    if (key) {
      return meta[key] || [];
    }
    
    // 返回所有备份
    const allBackups = {};
    Object.keys(meta).forEach(k => {
      if (k !== CONFIG.META_KEY) {
        allBackups[k] = meta[k];
      }
    });
    
    return allBackups;
  } catch (e) {
    console.error('[Recovery] 获取备份列表失败:', e);
    return key ? [] : {};
  }
}

/**
 * 手动恢复到指定备份
 */
export function restoreFromBackup(key, backupKey) {
  try {
    const value = localStorage.getItem(backupKey);
    if (!value) {
      throw new Error('备份不存在');
    }
    
    // 验证数据完整性
    JSON.parse(value);
    
    // 恢复
    localStorage.setItem(key, value);
    
    console.log(`[Recovery] 已恢复数据: ${key} -> ${backupKey}`);
    notifyRecovery('manual_recovery', { key, backupKey });
    
    return true;
  } catch (e) {
    console.error('[Recovery] 手动恢复失败:', e);
    return false;
  }
}

/**
 * 清理旧备份
 */
export function cleanupOldBackups(maxAge = 7 * 24 * 60 * 60 * 1000) {
  try {
    const meta = safeJSONParse(localStorage.getItem(CONFIG.META_KEY), {});
    const now = Date.now();
    let cleanedCount = 0;
    
    Object.keys(meta).forEach(key => {
      const backups = meta[key];
      const validBackups = backups.filter(backup => {
        const age = now - backup.timestamp;
        if (age > maxAge) {
          localStorage.removeItem(backup.key);
          cleanedCount++;
          return false;
        }
        return true;
      });
      meta[key] = validBackups;
    });
    
    localStorage.setItem(CONFIG.META_KEY, safeJSONStringify(meta));
    console.log(`[Recovery] 已清理 ${cleanedCount} 个过期备份`);
    
    return cleanedCount;
  } catch (e) {
    console.error('[Recovery] 清理旧备份失败:', e);
    return 0;
  }
}

/**
 * 启动自动备份定时器
 */
export function startAutoBackup(keysToBackup) {
  if (backupTimer) {
    clearInterval(backupTimer);
  }
  
  console.log(`[Recovery] 自动备份已启动，间隔: ${CONFIG.BACKUP_INTERVAL / 1000}秒`);
  
  // 立即备份一次
  performBackup(keysToBackup);
  
  // 定时备份
  backupTimer = setInterval(() => {
    performBackup(keysToBackup);
  }, CONFIG.BACKUP_INTERVAL);
}

/**
 * 执行备份
 */
function performBackup(keys) {
  console.log('[Recovery] 执行自动备份...');
  
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        createBackup(key, value);
      }
    } catch (e) {
      console.warn(`[Recovery] 备份 ${key} 失败:`, e);
    }
  });
  
  // 清理过期备份
  cleanupOldBackups();
}

/**
 * 停止自动备份
 */
export function stopAutoBackup() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
    console.log('[Recovery] 自动备份已停止');
  }
}

/**
 * 检查localStorage可用性
 */
export function checkStorageHealth() {
  try {
    // 测试读写
    const testKey = '__storage_health_check__';
    localStorage.setItem(testKey, 'ok');
    const value = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    if (value !== 'ok') {
      throw new Error('存储读写不一致');
    }
    
    // 检查可用空间（粗略估算）
    let usedSpace = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      usedSpace += (localStorage.getItem(key) || '').length;
    }
    
    return {
      healthy: true,
      usedSpace: usedSpace,
      itemCount: localStorage.length,
      warning: usedSpace > 4 * 1024 * 1024, // 超过4MB警告（浏览器一般5MB限制）
    };
  } catch (e) {
    console.error('[Recovery] 存储健康检查失败:', e);
    return {
      healthy: false,
      error: e.message,
    };
  }
}

/**
 * 紧急数据导出（用于崩溃抢救）
 */
export function emergencyExportData() {
  try {
    const allData = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(CONFIG.BACKUP_PREFIX)) { // 排除备份本身
        allData[key] = localStorage.getItem(key);
      }
    }
    
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: allData,
    };
    
    console.log(`[Recovery] 紧急导出: ${Object.keys(allData).length} 条数据`);
    
    return exportData;
  } catch (e) {
    console.error('[Recovery] 紧急导出失败:', e);
    return null;
  }
}

/**
 * 初始化数据恢复系统
 */
export function initRecoverySystem(keysToBackup = []) {
  console.log('[Recovery] 数据恢复系统初始化...');
  
  // 检查存储健康状态
  const health = checkStorageHealth();
  if (!health.healthy) {
    console.warn('[Recovery] 存储健康检查失败，可能存在数据损坏风险');
    notifyRecovery('storage_unhealthy', health);
  } else {
    console.log(`[Recovery] 存储健康检查通过，已使用: ${Math.round(health.usedSpace / 1024)}KB`);
  }
  
  // 启动自动备份
  if (keysToBackup.length > 0) {
    startAutoBackup(keysToBackup);
  }
  
  return true;
}

// 默认导出
export default {
  CONFIG,
  safeJSONParse,
  safeJSONStringify,
  safeStorage,
  getAvailableBackups,
  restoreFromBackup,
  cleanupOldBackups,
  startAutoBackup,
  stopAutoBackup,
  checkStorageHealth,
  emergencyExportData,
  initRecoverySystem,
  onRecoveryEvent,
};
