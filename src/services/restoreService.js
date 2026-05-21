/**
 * 🧠 Restore Service - 数据库恢复服务
 * 
 * 职责：处理数据恢复、冲突检测、合并策略
 * 支持 v2 账号数据和 IndexedDB 数据恢复
 */

import { addMoment, updateMoment, getMomentById } from '../utils/db.js';

/**
 * 批量恢复动态数据
 * @param {Array} moments - 动态列表
 * @param {Object} options
 * @param {string} [options.mode='merge'] - 恢复模式：merge / overwrite
 * @returns {Promise<Object>} { restored:number, skipped:number, conflicts:Array }
 */
export async function restoreMoments(moments, options = {}) {
  const { mode = 'merge' } = options;

  if (!Array.isArray(moments) || moments.length === 0) {
    return { restored: 0, skipped: 0, conflicts: [] };
  }

  console.log(`[restoreService] 开始恢复 ${moments.length} 条数据，模式: ${mode}，无数量限制`);

  let restored = 0;
  let skipped = 0;
  let conflicts = [];

  // 无数量限制，逐条处理
  for (const moment of moments) {
    try {
      // 检查是否已存在
      const existing = await getMomentById(moment.id);
      
      if (existing) {
        if (mode === 'overwrite') {
          // 覆盖模式：直接更新
          await updateMoment(moment.id, moment);
          restored++;
        } else {
          // 合并模式：跳过，记录冲突
          skipped++;
          conflicts.push({
            id: moment.id,
            type: 'duplicate',
            existing,
            incoming: moment
          });
        }
      } else {
        // 不存在：直接插入
        await addMoment(moment);
        restored++;
      }

    } catch (err) {
      console.error(`[restoreService] 数据恢复失败: ${moment.id}`, err);
      // 记录错误冲突，不中断整体流程
      conflicts.push({
        id: moment.id,
        type: 'error',
        error: err.message
      });
    }
  }

  console.log(`[restoreService] 恢复完成: 成功 ${restored}, 跳过 ${skipped}, 冲突 ${conflicts.length}`);
  return { restored, skipped, conflicts };
}

export default {
  restoreMoments
};
