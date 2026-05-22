/**
 * 📦 Import Service - 原子导入系统
 *
 * 核心原则：导入失败必须能完整回滚，绝不留下半损坏数据
 * 三步原子流程：备份 → 尝试写入 → 成功删除备份 / 失败从备份恢复
 */

import { validateImportData, validateV1Moment, validateV2Moment } from '@core/validator/contractValidator';

// ===== 备份系统 =====
const BACKUP_KEY = '__import_backup__';

/**
 * 创建导入前的完整备份
 */
async function createFullBackup(db) {
  try {
    const backup = {
      timestamp: Date.now(),
      babies: [],
      moments: [],
      capsules: [],
      v2Account: null
    };

    // 备份宝宝数据
    const babies = await db.getAllBabies();
    backup.babies = babies;

    // 备份动态数据
    const moments = await db.getAllMoments();
    backup.moments = moments;

    // 备份胶囊数据
    const capsules = await db.getAllCapsules();
    backup.capsules = capsules;

    // 备份 V2 账号
    try {
      const v2Account = await db.getV2Account();
      backup.v2Account = v2Account;
    } catch (e) {
      // 可能还没有 V2 数据，正常
    }

    // 保存备份到 localStorage
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    console.log('[ImportService] ✅ 备份创建成功，数据量:', {
      babies: backup.babies.length,
      moments: backup.moments.length,
      capsules: backup.capsules.length
    });

    return backup;
  } catch (error) {
    console.error('[ImportService] ❌ 创建备份失败:', error);
    throw new Error('创建备份失败，请稍后重试');
  }
}

/**
 * 从备份恢复数据
 */
async function restoreFromBackup(db) {
  try {
    const backupStr = localStorage.getItem(BACKUP_KEY);
    if (!backupStr) {
      throw new Error('没有找到备份数据');
    }

    const backup = JSON.parse(backupStr);

    console.log('[ImportService] 🔄 开始从备份恢复...');

    // 清空现有数据
    await db.clearAllData();

    // 恢复宝宝
    for (const baby of backup.babies) {
      await db.addBaby(baby);
    }

    // 恢复动态
    for (const moment of backup.moments) {
      await db.addMoment(moment);
    }

    // 恢复胶囊
    for (const capsule of backup.capsules) {
      await db.addCapsule(capsule);
    }

    // 恢复 V2 账号
    if (backup.v2Account) {
      await db.saveV2Account(backup.v2Account);
    }

    console.log('[ImportService] ✅ 数据恢复完成:', {
      babies: backup.babies.length,
      moments: backup.moments.length,
      capsules: backup.capsules.length
    });

    return true;
  } catch (error) {
    console.error('[ImportService] ❌ 恢复备份失败:', error);
    throw error;
  }
}

/**
 * 删除临时备份
 */
function clearBackup() {
  localStorage.removeItem(BACKUP_KEY);
  console.log('[ImportService] 🧹 备份已清理');
}

/**
 * 检查是否存在未完成的导入备份
 */
function hasPendingBackup() {
  return !!localStorage.getItem(BACKUP_KEY);
}

// ===== 导入核心逻辑 =====

/**
 * 原子导入 V1 数据（全量覆盖）
 * 失败自动回滚
 */
async function importV1DataAtomic(db, data, options = {}) {
  const { onProgress } = options;
  let backup = null;

  try {
    // Step 1: 数据校验
    console.log('[ImportService] 🔍 校验导入数据...');
    const validation = validateImportData(data);
    if (!validation.valid) {
      throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
    }

    // Step 2: 创建备份
    onProgress?.({ step: 'backup', message: '创建数据备份...' });
    backup = await createFullBackup(db);

    // Step 3: 清空现有数据
    onProgress?.({ step: 'clear', message: '清理现有数据...' });
    await db.clearAllData();

    // Step 4: 导入宝宝
    onProgress?.({ step: 'babies', message: `导入宝宝数据...` });
    const babies = data.babies || [];
    for (let i = 0; i < babies.length; i++) {
      await db.addBaby(babies[i]);
    }

    // Step 5: 导入动态
    onProgress?.({ step: 'moments', message: `导入动态数据...` });
    const moments = data.moments || [];
    for (let i = 0; i < moments.length; i++) {
      const momentData = validateV1Moment(moments[i]) ? moments[i] : convertToV1Moment(moments[i]);
      await db.addMoment(momentData);
    }

    // Step 6: 导入胶囊
    onProgress?.({ step: 'capsules', message: `导入胶囊数据...` });
    const capsules = data.capsules || [];
    for (let i = 0; i < capsules.length; i++) {
      await db.addCapsule(capsules[i]);
    }

    // Step 7: 导入 V2 数据（如果有）
    if (data.v2Account) {
      onProgress?.({ step: 'v2', message: '导入账号数据...' });
      await db.saveV2Account(data.v2Account);
    }

    // Step 8: 成功 - 清理备份
    clearBackup();

    console.log('[ImportService] ✅ 导入成功!');
    return {
      success: true,
      stats: {
        babies: babies.length,
        moments: moments.length,
        capsules: capsules.length
      }
    };

  } catch (error) {
    console.error('[ImportService] ❌ 导入失败，准备回滚:', error);

    // 失败 - 从备份恢复
    if (backup) {
      try {
        onProgress?.({ step: 'rollback', message: '导入失败，正在恢复数据...' });
        await restoreFromBackup(db);
        console.log('[ImportService] ✅ 数据已回滚到导入前状态');
      } catch (rollbackError) {
        console.error('[ImportService] ❌ 回滚失败!!!', rollbackError);
        throw new Error(`导入失败且回滚失败: ${error.message} / ${rollbackError.message}`);
      }
    }

    throw error;
  }
}

/**
 * 导入 V2 数据（增量/全量）
 */
async function importV2DataAtomic(db, data, options = {}) {
  // V2 导入逻辑和 V1 类似，但支持增量导入
  // 先复用 V1 的原子框架
  return importV1DataAtomic(db, data, options);
}

/**
 * 安全合并导入（不覆盖，只新增）
 */
async function importMergeSafe(db, data, options = {}) {
  const { onProgress } = options;
  let backup = null;

  try {
    // Step 1: 数据校验
    const validation = validateImportData(data);
    if (!validation.valid) {
      throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
    }

    // Step 2: 创建备份
    onProgress?.({ step: 'backup', message: '创建数据备份...' });
    backup = await createFullBackup(db);

    // Step 3: 安全合并 - 只新增，不覆盖已有数据
    const existingIds = new Set();

    // 获取现有 ID
    const existingBabies = await db.getAllBabies();
    existingBabies.forEach(b => existingIds.add(b.id));

    const existingMoments = await db.getAllMoments();
    existingMoments.forEach(m => existingIds.add(m.id));

    const existingCapsules = await db.getAllCapsules();
    existingCapsules.forEach(c => existingIds.add(c.id));

    // 只导入不重复的
    const babiesToAdd = (data.babies || []).filter(b => !existingIds.has(b.id));
    const momentsToAdd = (data.moments || []).filter(m => !existingIds.has(m.id));
    const capsulesToAdd = (data.capsules || []).filter(c => !existingIds.has(c.id));

    onProgress?.({ step: 'merge', message: `安全合并中...` });

    // 写入
    for (const baby of babiesToAdd) await db.addBaby(baby);
    for (const moment of momentsToAdd) await db.addMoment(moment);
    for (const capsule of capsulesToAdd) await db.addCapsule(capsule);

    // 成功 - 清理备份
    clearBackup();

    console.log('[ImportService] ✅ 合并导入成功!');
    return {
      success: true,
      stats: {
        babies: babiesToAdd.length,
        moments: momentsToAdd.length,
        capsules: capsulesToAdd.length,
        skipped: {
          babies: data.babies?.length - babiesToAdd.length || 0,
          moments: data.moments?.length - momentsToAdd.length || 0,
          capsules: data.capsules?.length - capsulesToAdd.length || 0
        }
      }
    };

  } catch (error) {
    console.error('[ImportService] ❌ 合并导入失败，准备回滚:', error);

    if (backup) {
      try {
        onProgress?.({ step: 'rollback', message: '导入失败，正在恢复数据...' });
        await restoreFromBackup(db);
      } catch (rollbackError) {
        console.error('[ImportService] ❌ 回滚失败!!!', rollbackError);
        throw new Error(`导入失败且回滚失败: ${error.message} / ${rollbackError.message}`);
      }
    }

    throw error;
  }
}

// ===== 辅助函数 =====

function convertToV1Moment(data) {
  // 简单兼容转换
  return {
    id: data.id || Date.now().toString(),
    babyId: data.babyId,
    content: data.content || '',
    date: data.date || new Date().toISOString(),
    mood: data.mood || 'neutral',
    photos: data.photos || [],
    videos: data.videos || [],
    audios: data.audios || [],
    type: data.type || 'normal',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

// ===== 导出 =====
export const importService = {
  // 原子导入
  importV1DataAtomic,
  importV2DataAtomic,
  importMergeSafe,

  // 备份管理
  createFullBackup,
  restoreFromBackup,
  clearBackup,
  hasPendingBackup
};

export default importService;
