/**
 * 📦 State Repository - 状态数据统一入口
 *
 * 架构原则：所有业务数据访问必须走这里，禁止业务层直接引用 db/dbV2
 *
 * 禁止业务层直接引用：
 * - src/utils/db.js
 * - src/utils/dbV2.js
 * - localStorage
 *
 * 调用方式：
 * import { getCurrentAccount, getCurrentBaby, addMoment, ... } from '@repositories/stateRepository'
 */

// 底层 driver - 只有这里可以引用 dbV2
import * as dbV2 from '../utils/dbV2.js';
// 暂时引用旧版 db 兼容未迁移的函数（V1 数据兼容）
import { 
  // 基础
  getMomentsByBaby, 
  addMoment, 
  deleteMoment, 
  initDB,
  // 宝宝管理
  getAllBabies,
  getBabiesByUser,
  getCurrentBaby,
  addBaby,
  updateBaby,
  deleteBaby,
  // 动态管理
  updateMoment,
  // 胶囊管理
  addCapsule,
  updateCapsule,
  // 成长记录
  addGrowthRecord,
  updateGrowthRecord,
  // 设置/主题
  updateSettings,
  checkAndInitSampleData,
  getSettings,
  getCustomMilestones,
  getCustomMoods,
  applyThemePreset,
  applyCustomTheme,
  addCustomMilestone,
  updateCustomMilestone,
  deleteCustomMilestone,
  addCustomMood,
  updateCustomMood,
  deleteCustomMood,
  // 用户管理
  updateUser,
  // 成长报告 & 成长记录
  getGrowthReportStats,
  getGrowthRecordsByBaby,
  // 回收站
  getDeletedMomentsByBaby,
  restoreMoment,
  deleteMomentPermanently,
  emptyRecycleBin,
  // 时空胶囊
  deleteCapsule,
  getCapsulesByBaby,
  // 用户/注册
  registerUser,
  updateSecurityQuestion,
  PRESET_AVATARS,
  // 数据导出/导入/清理
  exportAllData,
  importAllData,
  importAllDataV2,
  importFromZipStream,
  importMultipleFiles,
  clearAllData,
} from '../utils/db.js';

/**
 * ============================================
 * 账号相关
 * ============================================
 */

export function getCurrentAccount() {
  return dbV2.getCurrentV2Account();
}

export function getCurrentV2Account() {
  return dbV2.getCurrentV2Account();
}

export function isSystemAccount() {
  return dbV2.isSystemAccount();
}

export function isV1Account() {
  return dbV2.isV1Account();
}

export function switchAccount(targetAccountId) {
  return dbV2.switchAccount(targetAccountId);
}

export function getAvailableAccounts() {
  return dbV2.getAvailableAccounts();
}

export function updateV2AccountData(data) {
  return dbV2.updateV2AccountData(data);
}

/**
 * ============================================
 * 宝宝相关
 * ============================================
 */

export function getCurrentBabyInfo() {
  return dbV2.getCurrentBabyInfo();
}

export function updateCurrentBabyInfo(info) {
  return dbV2.updateCurrentBabyInfo(info);
}

/**
 * ============================================
 * 动态（Moment）相关
 * ============================================
 */

/**
 * ============================================
 * V1 兼容层（未迁移到 V2 的函数）
 * ============================================
 */

// 基础
export { getMomentsByBaby, addMoment, deleteMoment, initDB };

// 数据库 V2 函数
export function deleteLinkedContentByRecordId(recordId) {
  return dbV2.deleteLinkedContentByRecordId(recordId);
}

// 媒体索引相关（供 storageAdapter 调用）
export async function findMediaByHash(hash) {
  return await dbV2.findMediaByHash(hash);
}

export async function registerMedia(mediaData) {
  return await dbV2.registerMedia(mediaData);
}

// 宝宝管理
export { getAllBabies, getBabiesByUser, getCurrentBaby, addBaby, updateBaby, deleteBaby };

// 动态管理
export { updateMoment };

// 胶囊管理
export { addCapsule, updateCapsule };

// 成长记录
export { addGrowthRecord, updateGrowthRecord };

// 设置/主题/自定义
export { 
  updateSettings, 
  checkAndInitSampleData, 
  getSettings,
  getCustomMilestones,
  getCustomMoods,
  applyThemePreset,
  applyCustomTheme,
  addCustomMilestone,
  updateCustomMilestone,
  deleteCustomMilestone,
  addCustomMood,
  updateCustomMood,
  deleteCustomMood
};

// 用户管理
export { updateUser };

// 成长报告 & 成长记录
export { getGrowthReportStats, getGrowthRecordsByBaby };

// 回收站
export { getDeletedMomentsByBaby, restoreMoment, deleteMomentPermanently, emptyRecycleBin };

// 时空胶囊
export { deleteCapsule, getCapsulesByBaby };

// 用户/注册相关
export { registerUser, updateSecurityQuestion, PRESET_AVATARS };

// 数据导出/导入/清理
export { exportAllData, importAllData, importAllDataV2, importFromZipStream, importMultipleFiles, clearAllData };

export function getCurrentTimeline() {
  return dbV2.getCurrentTimeline();
}

export async function addMomentToCurrentAccount(momentData) {
  return await dbV2.addMomentToCurrentAccount(momentData);
}

export async function updateMomentInCurrentAccount(momentId, updates) {
  return await dbV2.updateMomentInCurrentAccount(momentId, updates);
}

export async function deleteMomentFromCurrentAccount(momentId) {
  return await dbV2.deleteMomentFromCurrentAccount(momentId);
}

/**
 * ============================================
 * 成长数据相关
 * ============================================
 */

export function getCurrentGrowth() {
  return dbV2.getCurrentGrowth();
}

export function updateCurrentGrowth(growthData) {
  return dbV2.updateCurrentGrowth(growthData);
}

/**
 * ============================================
 * 虚拟时间相关
 * ============================================
 */

export function addVirtualTimeToCurrentAccount(virtualTimeData) {
  return dbV2.addVirtualTimeToCurrentAccount(virtualTimeData);
}

export function updateVirtualTimeInCurrentAccount(itemId, updates) {
  return dbV2.updateVirtualTimeInCurrentAccount(itemId, updates);
}

export function deleteVirtualTimeFromCurrentAccount(itemId) {
  return dbV2.deleteVirtualTimeFromCurrentAccount(itemId);
}

export function getCurrentVirtualTime() {
  return dbV2.getCurrentVirtualTime();
}

export function getVirtualTimeCategories() {
  return dbV2.getVirtualTimeCategories();
}

export function addVirtualTimeCategory(categoryData) {
  return dbV2.addVirtualTimeCategory(categoryData);
}

export function updateVirtualTimeCategory(categoryId, updates) {
  return dbV2.updateVirtualTimeCategory(categoryId, updates);
}

export function deleteVirtualTimeCategory(categoryId) {
  return dbV2.deleteVirtualTimeCategory(categoryId);
}

export function addVirtualTimeCategoryItem(categoryId, itemData) {
  return dbV2.addVirtualTimeCategoryItem(categoryId, itemData);
}

export function updateVirtualTimeCategoryItem(categoryId, itemId, updates) {
  return dbV2.updateVirtualTimeCategoryItem(categoryId, itemId, updates);
}

export function deleteVirtualTimeCategoryItem(categoryId, itemId) {
  return dbV2.deleteVirtualTimeCategoryItem(categoryId, itemId);
}

export function getVirtualTimeContents(topicId, itemId) {
  return dbV2.getVirtualTimeContents(topicId, itemId);
}

export function addVirtualTimeContent(topicId, itemId, contentData) {
  return dbV2.addVirtualTimeContent(topicId, itemId, contentData);
}

export function deleteVirtualTimeContent(contentId) {
  return dbV2.deleteVirtualTimeContent(contentId);
}

/**
 * ============================================
 * 导入导出相关
 * ============================================
 */

export function exportV2AccountData() {
  return dbV2.exportV2AccountData();
}

export async function importV2AccountData(data, mode = 'merge') {
  return await dbV2.importV2AccountData(data, mode);
}

export function getCurrentMediaIndex() {
  return dbV2.getCurrentMediaIndex();
}

/**
 * ============================================
 * 初始化
 * ============================================
 */

export function initializeApp() {
  return dbV2.initializeApp();
}

/**
 * ============================================
 * 默认导出（兼容需要）
 * ============================================
 */

export default {
  // 账号
  getCurrentAccount,
  getCurrentV2Account,
  isSystemAccount,
  isV1Account,
  switchAccount,
  getAvailableAccounts,
  updateV2AccountData,

  // 宝宝
  getCurrentBabyInfo,
  updateCurrentBabyInfo,

  // 动态
  getMomentsByBaby,
  getCurrentTimeline,
  addMomentToCurrentAccount,
  updateMomentInCurrentAccount,
  deleteMomentFromCurrentAccount,
  deleteLinkedContentByRecordId,

  // 成长
  getCurrentGrowth,
  updateCurrentGrowth,

  // 虚拟时间
  addVirtualTimeToCurrentAccount,
  updateVirtualTimeInCurrentAccount,
  deleteVirtualTimeFromCurrentAccount,
  getCurrentVirtualTime,
  getVirtualTimeCategories,
  addVirtualTimeCategory,
  updateVirtualTimeCategory,
  deleteVirtualTimeCategory,
  addVirtualTimeCategoryItem,
  updateVirtualTimeCategoryItem,
  deleteVirtualTimeCategoryItem,
  getVirtualTimeContents,
  addVirtualTimeContent,

  // 导入导出
  exportV2AccountData,
  importV2AccountData,
  getCurrentMediaIndex,

  // 初始化
  initializeApp,
};
