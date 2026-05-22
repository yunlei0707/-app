/**
 * v1/v2 数据合并工具
 * 
 * 设计原则：
 * - v1 数据绝对安全：只读不写，永不修改任何 v1 历史数据
 * - v2 数据读写：所有新增/编辑/删除都在 v2-user 进行
 * - 零感知迁移：用户不需要知道背后有两个系统
 */

// v1 数据ID前缀（用于判断数据来源）
const V1_ID_PREFIX = 'moment_';
const V2_ID_PREFIX = 'v2_moment_';

/**
 * 判断数据来源
 * @param {string} momentId - 动态ID
 * @returns {string} 'v1' | 'v2'
 */
export function getDataOrigin(momentId) {
  if (!momentId) return 'v2';
  
  // v1 数据ID格式：moment_xxx
  if (momentId.startsWith(V1_ID_PREFIX)) {
    return 'v1';
  }
  
  // v2 数据ID格式：v2_moment_xxx 或其他格式
  return 'v2';
}

/**
 * 检查是否为v1数据
 * @param {string} momentId - 动态ID
 * @returns {boolean}
 */
export function isV1Moment(momentId) {
  return getDataOrigin(momentId) === 'v1';
}

/**
 * 检查是否为v2数据
 * @param {string} momentId - 动态ID
 * @returns {boolean}
 */
export function isV2Moment(momentId) {
  return getDataOrigin(momentId) === 'v2';
}

/**
 * 合并时光轴数据
 * 按时间倒序排列，v2数据优先（相同时间时）
 * 
 * @param {Array} v1Moments - v1数据列表
 * @param {Array} v2Moments - v2数据列表
 * @returns {Array} 合并后的列表
 */
export function mergeMoments(v1Moments = [], v2Moments = []) {
  // 空值保护：确保是数组
  const safeV1 = Array.isArray(v1Moments) ? v1Moments : [];
  const safeV2 = Array.isArray(v2Moments) ? v2Moments : [];

  // 标记来源
  const markedV1 = safeV1.map(m => ({
    ...m,
    _origin: 'v1',
    _isV1: true
  }));
  
  const markedV2 = safeV2.map(m => ({
    ...m,
    _origin: 'v2',
    _isV1: false
  }));
  
  // 合并
  const merged = [...markedV1, ...markedV2];
  
  // 按时间倒序排列
  merged.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date || 0).getTime();
    const timeB = new Date(b.createdAt || b.date || 0).getTime();
    
    // 时间相同的情况，v2数据优先显示
    if (timeA === timeB) {
      return a._origin === 'v2' ? -1 : 1;
    }
    
    return timeB - timeA;
  });
  
  return merged;
}

/**
 * 为v1数据创建v2副本（用于编辑）
 * 不修改原v1数据，在v2中创建一个新的副本
 * 
 * @param {Object} v1Moment - v1原始数据
 * @param {Object} updates - 更新内容
 * @returns {Object} v2副本数据
 */
export function createV2CopyFromV1(v1Moment, updates = {}) {
  const now = new Date().toISOString();
  
  // 生成新的v2格式ID
  const newId = `v2_moment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    // 复制原数据
    ...v1Moment,
    
    // 更新字段
    ...updates,
    
    // v2特有字段
    id: newId,
    createdAt: now,
    updatedAt: now,
    
    // 标记来源
    _origin: 'v2',
    _isV1: false,
    _copiedFromV1: true,
    _originalV1Id: v1Moment.id
  };
}

/**
 * 检查是否需要合并显示
 * 当切换到"我的账号"（user）时，自动合并显示
 * 
 * @param {boolean} isSystem - 是否系统账号
 * @param {boolean} isV1 - 是否v1账号
 * @returns {boolean}
 */
export function shouldMergeDisplay(isSystem, isV1) {
  // 只有用户账号（非系统，非v1单独模式）才需要合并显示
  return !isSystem && !isV1;
}

// ==================== 成长记录合并 ====================

// v1成长记录ID前缀
const V1_GROWTH_PREFIX = 'growth_';

/**
 * 判断成长记录来源
 * @param {string} recordId - 记录ID
 * @returns {string} 'v1' | 'v2'
 */
export function getGrowthRecordOrigin(recordId) {
  if (!recordId) return 'v2';
  if (recordId.startsWith(V1_GROWTH_PREFIX)) {
    return 'v1';
  }
  return 'v2';
}

/**
 * 检查是否为v1成长记录
 * @param {string} recordId - 记录ID
 * @returns {boolean}
 */
export function isV1GrowthRecord(recordId) {
  return getGrowthRecordOrigin(recordId) === 'v1';
}

/**
 * 合并成长记录数据
 * 按日期升序排列
 * 
 * @param {Array} v1Records - v1成长记录列表
 * @param {Array} v2Records - v2成长记录列表
 * @returns {Array} 合并后的列表
 */
export function mergeGrowthRecords(v1Records = [], v2Records = []) {
  // 空值保护：确保是数组
  const safeV1 = Array.isArray(v1Records) ? v1Records : [];
  const safeV2 = Array.isArray(v2Records) ? v2Records : [];

  // 标记来源
  const markedV1 = safeV1.map(r => ({
    ...r,
    _origin: 'v1',
    _isV1: true
  }));
  
  const markedV2 = safeV2.map(r => ({
    ...r,
    _origin: 'v2',
    _isV1: false
  }));
  
  // 合并
  const merged = [...markedV1, ...markedV2];
  
  // 按日期升序排列
  merged.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  return merged;
}

/**
 * 为v1成长记录创建v2副本（用于编辑）
 * 不修改原v1数据，在v2中创建一个新的副本
 * 
 * @param {Object} v1Record - v1原始记录
 * @param {Object} updates - 更新内容
 * @returns {Object} v2副本数据
 */
export function createV2GrowthCopyFromV1(v1Record, updates = {}) {
  const now = new Date().toISOString();
  
  // 生成新的v2格式ID
  const newId = `v2_growth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    // 复制原数据
    ...v1Record,
    
    // 更新字段
    ...updates,
    
    // v2特有字段
    id: newId,
    createdAt: now,
    updatedAt: now,
    
    // 标记来源
    _origin: 'v2',
    _isV1: false,
    _copiedFromV1: true,
    _originalV1Id: v1Record.id
  };
}

export default {
  mergeMoments,
  getDataOrigin,
  isV1Moment,
  isV2Moment,
  createV2CopyFromV1,
  shouldMergeDisplay,
  // 成长记录
  mergeGrowthRecords,
  getGrowthRecordOrigin,
  isV1GrowthRecord,
  createV2GrowthCopyFromV1
};
