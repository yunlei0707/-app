/**
 * 🧠 Restore Service - 数据库恢复服务
 * 
 * 职责：批量恢复数据到数据库、支持合并/覆盖模式、冲突检测
 */

// ========== 与现有 DB 对接函数 ==========
// 注意：以下函数需要根据实际 db.js / dbV2.js 实现适配

/**
 * 检查 moment 是否已存在
 */
async function checkMomentExists(id) {
  try {
    // 从 IDB 读取，这里用 import 的方式
    const { get } = await import('../utils/db.js');
    const existing = await get('moments', id);
    return !!existing;
  } catch (e) {
    console.warn('[restoreService] 检查 moment 失败:', e.message);
    return false;
  }
}

/**
 * 插入新 moment
 */
async function insertMoment(data) {
  try {
    const { set } = await import('../utils/db.js');
    await set('moments', data.id, data);
    return true;
  } catch (e) {
    console.error('[restoreService] 插入失败:', e.message);
    throw e;
  }
}

/**
 * 更新或插入 moment
 */
async function upsertMoment(data) {
  try {
    const { set } = await import('../utils/db.js');
    await set('moments', data.id, data);
    return true;
  } catch (e) {
    console.error('[restoreService] upsert 失败:', e.message);
    throw e;
  }
}

/**
 * 恢复 v2 account 数据
 */
async function restoreV2Account(v2Data) {
  if (!v2Data || !v2Data.timeline) return 0;

  let restored = 0;
  try {
    // 尝试导入到 v2 account 存储
    const { importV2AccountData } = await import('../utils/dbV2.js');
    if (importV2AccountData) {
      await importV2AccountData(v2Data);
      restored = v2Data.timeline.length;
    }
  } catch (e) {
    console.warn('[restoreService] v2 account 恢复失败:', e.message);
  }
  return restored;
}

// ========== 核心恢复函数 ==========

/**
 * 批量恢复 moments 数据
 * @param {Array} moments - 要恢复的 moment 列表
 * @param {Object} options
 * @param {string} options.mode - 'merge' | 'overwrite' 合并/覆盖模式
 * @param {Function} options.onProgress - 进度回调
 * @param {AbortSignal} options.signal - 取消信号
 * @returns {Object} { restored, skipped, total }
 */
export async function restoreMoments(moments, options = {}) {
  const {
    mode = 'merge',  // merge: 不覆盖已有, overwrite: 覆盖已有
    onProgress = null,
    signal = null
  } = options;

  if (!Array.isArray(moments)) {
    throw new Error('[restoreService] moments 必须是数组');
  }

  console.log(`[restoreService] 开始恢复 ${moments.length} 条数据，模式: ${mode}`);

  let restored = 0;
  let skipped = 0;
  let processed = 0;

  for (const moment of moments) {
    // 检查取消信号
    if (signal?.aborted) {
      console.log('[restoreService] 恢复已取消');
      throw new Error('恢复已取消');
    }

    try {
      if (!moment.id) {
        console.warn('[restoreService] 跳过无 id 的数据');
        skipped++;
        continue;
      }

      if (mode === 'overwrite') {
        // 覆盖模式：直接 upsert
        await upsertMoment(moment);
        restored++;
      } else {
        // 合并模式：先检查是否已存在
        const exists = await checkMomentExists(moment.id);
        if (exists) {
          skipped++;
        } else {
          await insertMoment(moment);
          restored++;
        }
      }
    } catch (e) {
      console.error(`[restoreService] 恢复失败 id=${moment.id}:`, e.message);
      skipped++;
    }

    // 更新进度
    processed++;
    if (onProgress) {
      onProgress({ current: processed, total: moments.length });
    }

    // 每处理 10 条让出主线程
    if (processed % 10 === 0 && processed < moments.length) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  console.log(`[restoreService] 恢复完成: 成功 ${restored}, 跳过 ${skipped}`);
  return {
    restored,
    skipped,
    total: moments.length,
    mode
  };
}

/**
 * 完整恢复所有数据
 * 包含：moments + v2 account 数据
 */
export async function restoreAllData(data, options = {}) {
  const results = {
    moments: { restored: 0, skipped: 0, total: 0 },
    v2Account: { restored: 0, skipped: 0, total: 0 }
  };

  // 恢复 moments
  const moments = data.moments || data.data?.moments || [];
  if (moments.length > 0) {
    const r = await restoreMoments(moments, options);
    results.moments = r;
  }

  // 恢复 v2 account 数据
  if (data.v2AccountData) {
    const restored = await restoreV2Account(data.v2AccountData);
    results.v2Account = { restored, total: data.v2AccountData.timeline?.length || 0 };
  }

  return results;
}

export default {
  restoreMoments,
  restoreAllData,
  checkMomentExists,
  insertMoment,
  upsertMoment
};
