/**
 * P0上线防护：版本升级数据兼容
 * 功能：schema版本管理 + 自动数据迁移，防止版本升级炸数据
 */

import { safeJSONParse, safeJSONStringify, safeStorage } from './dataRecovery';

// ========== 配置 ==========
const CONFIG = {
  // 当前schema版本
  CURRENT_VERSION: 2,
  // 版本存储键
  VERSION_KEY: 'schema_version',
  // 迁移日志键
  MIGRATION_LOG_KEY: 'migration_log',
};

// ========== 迁移函数注册表 ==========
const migrations = {};

/**
 * 注册迁移函数
 * @param {number} fromVersion - 从哪个版本迁移
 * @param {Function} migrateFn - 迁移函数
 */
export function registerMigration(fromVersion, migrateFn) {
  migrations[fromVersion] = migrateFn;
  console.log(`[Migration] 已注册版本 ${fromVersion} -> ${fromVersion + 1} 的迁移`);
}

/**
 * 获取当前本地schema版本
 */
export function getCurrentSchemaVersion() {
  const version = safeStorage.getItem(CONFIG.VERSION_KEY, 1);
  return parseInt(version, 10) || 1;
}

/**
 * 设置schema版本
 */
export function setSchemaVersion(version) {
  safeStorage.setItem(CONFIG.VERSION_KEY, version);
  console.log(`[Migration] Schema版本已设置为: ${version}`);
}

/**
 * 检查是否需要迁移
 */
export function needsMigration() {
  const currentVersion = getCurrentSchemaVersion();
  return currentVersion < CONFIG.CURRENT_VERSION;
}

/**
 * 执行数据迁移
 * @returns {Object} 迁移结果
 */
export async function performMigration() {
  const startVersion = getCurrentSchemaVersion();
  let currentVersion = startVersion;
  
  console.log(`[Migration] 开始数据迁移，当前版本: ${startVersion}，目标版本: ${CONFIG.CURRENT_VERSION}`);
  
  const migrationLog = {
    startedAt: new Date().toISOString(),
    startVersion,
    targetVersion: CONFIG.CURRENT_VERSION,
    steps: [],
    success: false,
    error: null,
  };
  
  try {
    // 备份当前版本数据（迁移前先备份）
    createMigrationBackup(currentVersion);
    
    // 依次执行每个版本的迁移
    while (currentVersion < CONFIG.CURRENT_VERSION) {
      const migrateFn = migrations[currentVersion];
      
      if (migrateFn) {
        console.log(`[Migration] 执行版本 ${currentVersion} -> ${currentVersion + 1} 的迁移...`);
        
        try {
          const result = await migrateFn();
          
          migrationLog.steps.push({
            fromVersion: currentVersion,
            toVersion: currentVersion + 1,
            success: true,
            result,
          });
          
          currentVersion++;
          setSchemaVersion(currentVersion);
          
          console.log(`[Migration] 版本 ${currentVersion} 迁移完成`);
          
        } catch (stepError) {
          console.error(`[Migration] 版本 ${currentVersion} 迁移失败:`, stepError);
          
          migrationLog.steps.push({
            fromVersion: currentVersion,
            toVersion: currentVersion + 1,
            success: false,
            error: stepError.message,
          });
          
          // 迁移失败，尝试回滚
          console.warn(`[Migration] 尝试回滚到版本 ${startVersion}`);
          await rollbackToVersion(startVersion);
          
          throw stepError;
        }
      } else {
        // 没有找到迁移函数，跳过此版本
        console.warn(`[Migration] 未找到版本 ${currentVersion} 的迁移函数，跳过`);
        currentVersion++;
        setSchemaVersion(currentVersion);
      }
    }
    
    migrationLog.success = true;
    migrationLog.finalVersion = currentVersion;
    migrationLog.completedAt = new Date().toISOString();
    
    console.log(`[Migration] 数据迁移完成，最终版本: ${currentVersion}`);
    
    // 保存迁移日志
    saveMigrationLog(migrationLog);
    
    return migrationLog;
    
  } catch (e) {
    migrationLog.success = false;
    migrationLog.error = e.message;
    migrationLog.failedAt = new Date().toISOString();
    
    saveMigrationLog(migrationLog);
    
    console.error('[Migration] 数据迁移失败:', e);
    throw e;
  }
}

/**
 * 创建迁移前的备份
 */
function createMigrationBackup(version) {
  try {
    const backupKey = `migration_backup_v${version}_${Date.now()}`;
    const allData = {};
    
    // 备份所有宝贝时光相关的数据
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('baby') ||
        key.includes('moment') ||
        key.includes('v2') ||
        key.includes('timeline') ||
        key.includes('capsule')
      )) {
        allData[key] = localStorage.getItem(key);
      }
    }
    
    localStorage.setItem(backupKey, safeJSONStringify(allData));
    console.log(`[Migration] 已创建版本 ${version} 的迁移备份: ${backupKey}`);
    
    return backupKey;
  } catch (e) {
    console.error('[Migration] 创建迁移备份失败:', e);
    return null;
  }
}

/**
 * 回滚到指定版本
 */
async function rollbackToVersion(version) {
  try {
    // 查找最近的该版本备份
    const backupPrefix = `migration_backup_v${version}_`;
    let backupKey = null;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(backupPrefix)) {
        backupKey = key;
        break;
      }
    }
    
    if (backupKey) {
      const backupData = safeJSONParse(localStorage.getItem(backupKey), {});
      
      // 恢复数据
      Object.keys(backupData).forEach(key => {
        localStorage.setItem(key, backupData[key]);
      });
      
      setSchemaVersion(version);
      console.log(`[Migration] 已回滚到版本 ${version}`);
      return true;
    }
    
    console.warn(`[Migration] 未找到版本 ${version} 的备份，无法回滚`);
    return false;
  } catch (e) {
    console.error('[Migration] 回滚失败:', e);
    return false;
  }
}

/**
 * 保存迁移日志
 */
function saveMigrationLog(log) {
  try {
    const logs = safeJSONParse(localStorage.getItem(CONFIG.MIGRATION_LOG_KEY), []);
    logs.unshift(log);
    // 只保留最近10条
    if (logs.length > 10) {
      logs.splice(10);
    }
    localStorage.setItem(CONFIG.MIGRATION_LOG_KEY, safeJSONStringify(logs));
  } catch (e) {
    console.error('[Migration] 保存迁移日志失败:', e);
  }
}

/**
 * 获取迁移日志
 */
export function getMigrationLogs() {
  return safeJSONParse(localStorage.getItem(CONFIG.MIGRATION_LOG_KEY), []);
}

// ========== 预定义迁移函数 ==========

/**
 * v1 -> v2 迁移：添加user_id字段
 */
registerMigration(1, async function migrateV1toV2() {
  const changes = {
    updatedMoments: 0,
    updatedBabies: 0,
    notes: '为所有记录添加user_id字段，值为anonymous（后续登录时替换）',
  };
  
  // 处理v2账号数据
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('v2_account')) {
      try {
        const data = safeJSONParse(localStorage.getItem(key), null);
        if (data && data.timeline && Array.isArray(data.timeline)) {
          data.timeline = data.timeline.map(moment => ({
            ...moment,
            user_id: 'anonymous',
          }));
          localStorage.setItem(key, safeJSONStringify(data));
          changes.updatedMoments += data.timeline.length;
        }
      } catch (e) {
        console.warn(`[Migration] 处理 ${key} 失败:`, e);
      }
    }
  }
  
  return changes;
});

/**
 * 检查并执行迁移（应用启动时调用）
 */
export async function checkAndMigrate() {
  console.log('[Migration] 检查数据版本...');
  
  if (!needsMigration()) {
    console.log('[Migration] 数据已是最新版本，无需迁移');
    return { success: true, migrated: false, currentVersion: getCurrentSchemaVersion() };
  }
  
  const currentVersion = getCurrentSchemaVersion();
  console.log(`[Migration] 数据需要迁移: v${currentVersion} -> v${CONFIG.CURRENT_VERSION}`);
  
  try {
    const result = await performMigration();
    return {
      success: true,
      migrated: true,
      fromVersion: currentVersion,
      toVersion: CONFIG.CURRENT_VERSION,
      migrationResult: result,
    };
  } catch (e) {
    console.error('[Migration] 迁移失败，尝试继续启动:', e);
    return {
      success: false,
      migrated: false,
      error: e.message,
      currentVersion: getCurrentSchemaVersion(),
    };
  }
}

/**
 * 重置版本（用于测试）
 */
export function resetSchemaVersion() {
  safeStorage.setItem(CONFIG.VERSION_KEY, 1);
  console.log('[Migration] Schema版本已重置为1');
}

/**
 * 初始化迁移系统
 */
export function initMigrationSystem() {
  console.log('[Migration] 数据迁移系统初始化');
  console.log(`[Migration] 当前数据版本: v${getCurrentSchemaVersion()}`);
  console.log(`[Migration] 应用目标版本: v${CONFIG.CURRENT_VERSION}`);
  
  if (needsMigration()) {
    console.log('[Migration] ⚠️  检测到版本差异，启动时将自动迁移');
  } else {
    console.log('[Migration] ✅ 数据版本一致');
  }
  
  return true;
}

/**
 * 获取版本信息
 */
export function getVersionInfo() {
  return {
    currentDataVersion: getCurrentSchemaVersion(),
    appTargetVersion: CONFIG.CURRENT_VERSION,
    needsMigration: needsMigration(),
    availableMigrations: Object.keys(migrations).map(Number),
  };
}

// 默认导出
export default {
  CONFIG,
  registerMigration,
  getCurrentSchemaVersion,
  setSchemaVersion,
  needsMigration,
  performMigration,
  checkAndMigrate,
  getMigrationLogs,
  getVersionInfo,
  initMigrationSystem,
  resetSchemaVersion, // 仅用于测试
};
