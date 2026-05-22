/**
 * 📋 Schema Version Manager - 数据格式版本管理器
 *
 * 解决："数据格式变了只能硬猜兼容"的问题
 *
 * 核心原则：
 * 1. 所有写入的数据都带 version
 * 2. 读取时自动检测版本并升级
 * 3. 版本升级有明确的 migration 路径
 */

// 当前最新版本
export const CURRENT_SCHEMA_VERSION = '2.0.0';

// 版本历史
const VERSION_HISTORY = [
  { version: '1.0.0', description: '初始版本 - 无 schema', date: '2026-01-01' },
  { version: '2.0.0', description: '分层架构重构 - media/state 分离', date: '2026-05-22' }
];

// ===== 版本检测 =====

/**
 * 检测数据版本
 */
export function detectDataVersion(data) {
  // 有明确的 version 字段
  if (data && data.schemaVersion) {
    return data.schemaVersion;
  }

  // 启发式检测
  if (data && typeof data === 'object') {
    // v2 特征：有 mediaIndex / state 分离
    if (data.mediaIndex || data.state) {
      return '2.0.0';
    }

    // v1 特征：babies/moments/capsules 直接在根
    if (data.babies || data.moments || data.capsules) {
      return '1.0.0';
    }
  }

  // 未知版本，返回 null
  return null;
}

/**
 * 检查是否需要升级
 */
export function needsUpgrade(data) {
  const version = detectDataVersion(data);
  if (!version) return false;
  return version !== CURRENT_SCHEMA_VERSION;
}

// ===== 版本升级 =====

/**
 * v1 → v2 升级
 */
function upgradeV1toV2(data) {
  console.log('[Schema] 升级数据格式: v1 → v2');

  return {
    schemaVersion: '2.0.0',
    upgradedAt: Date.now(),
    state: {
      babies: data.babies || [],
      moments: data.moments || [],
      capsules: data.capsules || [],
      settings: data.settings || {},
      currentBabyId: data.currentBabyId
    },
    mediaIndex: {},
    legacy: {
      originalVersion: '1.0.0'
    }
  };
}

/**
 * 自动升级到最新版本
 */
export function upgradeToLatest(data) {
  const version = detectDataVersion(data);

  if (!version) {
    console.warn('[Schema] 无法检测数据版本，假设为 v1');
    return upgradeV1toV2({});
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return data;
  }

  let upgraded = { ...data };

  // v1 → v2
  if (version === '1.0.0') {
    upgraded = upgradeV1toV2(upgraded);
  }

  console.log(`[Schema] ✅ 升级完成: ${version} → ${CURRENT_SCHEMA_VERSION}`);
  return upgraded;
}

// ===== 写入时自动加版本 =====

/**
 * 包装数据，加上版本信息
 */
export function wrapWithVersion(data, type = 'state') {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: Date.now(),
    [type]: data
  };
}

/**
 * 解包数据，自动升级
 */
export function unwrapWithVersion(wrappedData, type = 'state') {
  const upgraded = upgradeToLatest(wrappedData);

  // 提取数据
  if (type === 'state') {
    return upgraded.state || upgraded;
  }

  return upgraded[type] || upgraded;
}

// ===== 导出 =====

export const schemaVersionManager = {
  currentVersion: CURRENT_SCHEMA_VERSION,
  detect: detectDataVersion,
  needsUpgrade,
  upgrade: upgradeToLatest,
  wrap: wrapWithVersion,
  unwrap: unwrapWithVersion,
  history: VERSION_HISTORY
};

export default schemaVersionManager;
