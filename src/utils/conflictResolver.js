/**
 * P4阶段：冲突检测与解决工具
 * 功能：检测多设备修改同一记录的冲突，提供UI供用户选择
 */

// ========== 冲突类型 ==========
export const CONFLICT_TYPE = {
  BOTH_MODIFIED: 'both_modified',      // 两端都修改了同一条记录
  LOCAL_DELETED: 'local_deleted',      // 本地已删除，但云端有更新
  REMOTE_DELETED: 'remote_deleted',    // 云端已删除，但本地有更新
};

// ========== 解决策略 ==========
export const RESOLVE_STRATEGY = {
  KEEP_LOCAL: 'keep_local',     // 保留本地版本
  KEEP_REMOTE: 'keep_remote',   // 保留云端版本
  KEEP_BOTH: 'keep_both',       // 两者都保留（创建新记录）
};

// 冲突存储Key
const CONFLICTS_STORAGE_KEY = 'syncConflicts';

/**
 * 获取所有冲突
 * @returns {Array} 冲突列表
 */
export function getConflicts() {
  try {
    const conflictsStr = localStorage.getItem(CONFLICTS_STORAGE_KEY);
    return conflictsStr ? JSON.parse(conflictsStr) : [];
  } catch (e) {
    console.error('[Conflict] 获取冲突列表失败:', e);
    return [];
  }
}

/**
 * 保存冲突列表
 * @param {Array} conflicts - 冲突列表
 */
function saveConflicts(conflicts) {
  try {
    localStorage.setItem(CONFLICTS_STORAGE_KEY, JSON.stringify(conflicts));
    // 触发冲突变更事件
    window.dispatchEvent(new CustomEvent('conflictsUpdated', { 
      detail: { conflicts, count: conflicts.length } 
    }));
  } catch (e) {
    console.error('[Conflict] 保存冲突列表失败:', e);
  }
}

/**
 * 添加新冲突
 * @param {Object} conflict - 冲突对象
 */
export function addConflict(conflict) {
  const conflicts = getConflicts();
  
  // 检查是否已存在相同的冲突
  const exists = conflicts.some(c => 
    c.recordType === conflict.recordType && 
    c.recordId === conflict.recordId
  );
  
  if (exists) {
    console.warn('[Conflict] 冲突已存在，跳过:', conflict.recordId);
    return;
  }
  
  const newConflict = {
    id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    detectedAt: new Date().toISOString(),
    resolved: false,
    ...conflict,
  };
  
  conflicts.push(newConflict);
  saveConflicts(conflicts);
  
  console.log('[Conflict] 检测到新冲突:', newConflict);
  return newConflict;
}

/**
 * 解决冲突
 * @param {string} conflictId - 冲突ID
 * @param {string} strategy - 解决策略
 * @param {Object} options - 额外选项
 */
export async function resolveConflict(conflictId, strategy, options = {}) {
  const conflicts = getConflicts();
  const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
  
  if (conflictIndex === -1) {
    throw new Error('冲突不存在');
  }
  
  const conflict = conflicts[conflictIndex];
  
  try {
    console.log(`[Conflict] 解决冲突 ${conflictId}, 策略: ${strategy}`);
    
    // 根据策略执行不同的解决逻辑
    switch (strategy) {
      case RESOLVE_STRATEGY.KEEP_LOCAL:
        // TODO: 保留本地，覆盖云端
        break;
        
      case RESOLVE_STRATEGY.KEEP_REMOTE:
        // TODO: 保留云端，覆盖本地
        break;
        
      case RESOLVE_STRATEGY.KEEP_BOTH:
        // TODO: 两者都保留，创建新记录
        break;
    }
    
    // 标记为已解决
    conflicts[conflictIndex] = {
      ...conflict,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedStrategy: strategy,
    };
    
    saveConflicts(conflicts);
    
    return { success: true, conflict: conflicts[conflictIndex] };
    
  } catch (e) {
    console.error('[Conflict] 解决冲突失败:', e);
    throw e;
  }
}

/**
 * 批量解决冲突
 * @param {string} strategy - 解决策略
 */
export async function resolveAllConflicts(strategy) {
  const conflicts = getConflicts();
  const unresolved = conflicts.filter(c => !c.resolved);
  
  const results = [];
  for (const conflict of unresolved) {
    try {
      const result = await resolveConflict(conflict.id, strategy);
      results.push(result);
    } catch (e) {
      console.error(`[Conflict] 解决冲突 ${conflict.id} 失败:`, e);
    }
  }
  
  return {
    success: true,
    total: unresolved.length,
    resolved: results.length,
  };
}

/**
 * 删除已解决的冲突（清理）
 */
export function clearResolvedConflicts() {
  const conflicts = getConflicts();
  const unresolved = conflicts.filter(c => !c.resolved);
  saveConflicts(unresolved);
  return { cleared: conflicts.length - unresolved.length };
}

/**
 * 获取未解决的冲突数量
 * @returns {number} 冲突数量
 */
export function getUnresolvedConflictCount() {
  const conflicts = getConflicts();
  return conflicts.filter(c => !c.resolved).length;
}

/**
 * 检测本地记录与云端记录的冲突
 * @param {Array} localRecords - 本地记录列表
 * @param {Array} remoteRecords - 云端记录列表
 * @returns {Array} 检测到的冲突列表
 */
export function detectConflicts(localRecords, remoteRecords) {
  const conflicts = [];
  const remoteMap = new Map(remoteRecords.map(r => [r.id, r]));
  
  for (const local of localRecords) {
    const remote = remoteMap.get(local.id);
    
    if (!remote) {
      // 本地有记录，云端没有（可能是云端删除了）
      if (!local.isDeleted) {
        conflicts.push({
          recordType: getRecordType(local),
          recordId: local.id,
          type: CONFLICT_TYPE.REMOTE_DELETED,
          localVersion: local,
          remoteVersion: null,
        });
      }
      continue;
    }
    
    if (local.isDeleted && remote.isDeleted) {
      // 两端都已删除，无冲突
      continue;
    }
    
    if (local.isDeleted) {
      // 本地已删除，但云端有更新
      conflicts.push({
        recordType: getRecordType(local),
        recordId: local.id,
        type: CONFLICT_TYPE.LOCAL_DELETED,
        localVersion: local,
        remoteVersion: remote,
      });
      continue;
    }
    
    if (remote.isDeleted) {
      // 云端已删除，但本地有更新
      conflicts.push({
        recordType: getRecordType(local),
        recordId: local.id,
        type: CONFLICT_TYPE.REMOTE_DELETED,
        localVersion: local,
        remoteVersion: remote,
      });
      continue;
    }
    
    // 比较更新时间，判断是否都被修改
    const localUpdated = new Date(local.updatedAt || local.createdAt || 0);
    const remoteUpdated = new Date(remote.updatedAt || remote.createdAt || 0);
    const syncPoint = new Date(localStorage.getItem('syncPoint') || 0);
    
    // 如果本地和云端都比同步点新，说明发生了冲突
    if (localUpdated > syncPoint && remoteUpdated > syncPoint) {
      conflicts.push({
        recordType: getRecordType(local),
        recordId: local.id,
        type: CONFLICT_TYPE.BOTH_MODIFIED,
        localVersion: local,
        remoteVersion: remote,
      });
    }
  }
  
  return conflicts;
}

/**
 * 获取记录类型
 */
function getRecordType(record) {
  if (record.babyId !== undefined) return 'moment';
  if (record.name !== undefined && record.birthday !== undefined) return 'baby';
  return 'unknown';
}

/**
 * 计算两条记录的差异（用于UI展示）
 * @param {Object} local - 本地版本
 * @param {Object} remote - 云端版本
 * @returns {Object} 差异对象
 */
export function computeDiff(local, remote) {
  if (!local || !remote) return { fields: [], count: 0 };
  
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const diffFields = [];
  
  for (const key of allKeys) {
    // 忽略元数据字段
    if (['id', 'createdAt', 'updatedAt', 'isDeleted', 'deletedAt'].includes(key)) {
      continue;
    }
    
    const localValue = local[key];
    const remoteValue = remote[key];
    
    // 简单值比较
    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      diffFields.push({
        field: key,
        local: localValue,
        remote: remoteValue,
      });
    }
  }
  
  return {
    fields: diffFields,
    count: diffFields.length,
  };
}

/**
 * 格式化冲突类型展示
 */
export function formatConflictType(type) {
  const labels = {
    [CONFLICT_TYPE.BOTH_MODIFIED]: '两端同时修改',
    [CONFLICT_TYPE.LOCAL_DELETED]: '本地已删除，云端有更新',
    [CONFLICT_TYPE.REMOTE_DELETED]: '云端已删除，本地有更新',
  };
  return labels[type] || type;
}

/**
 * 监听冲突数量变化
 */
export function onConflictsChanged(callback) {
  const handler = (event) => callback(event.detail);
  window.addEventListener('conflictsUpdated', handler);
  
  // 立即返回当前状态
  callback({
    conflicts: getConflicts(),
    count: getUnresolvedConflictCount(),
  });
  
  return () => window.removeEventListener('conflictsUpdated', handler);
}

// 默认导出
export default {
  CONFLICT_TYPE,
  RESOLVE_STRATEGY,
  getConflicts,
  addConflict,
  resolveConflict,
  resolveAllConflicts,
  clearResolvedConflicts,
  getUnresolvedConflictCount,
  detectConflicts,
  computeDiff,
  formatConflictType,
  onConflictsChanged,
};
