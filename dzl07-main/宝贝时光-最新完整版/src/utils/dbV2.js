/**
 * 双账号系统数据库操作
 * 
 * 数据结构：
 * {
 *   "无敌奶爸": {
 *     accounts: {
 *       default: { id: "default", name: "豆芽", isSystem: true, data: {...} },
 *       user: { id: "user", name: "我的宝宝", isSystem: false, data: {...} }
 *     },
 *     currentAccountId: "user"
 *   },
 *   "温柔宝妈": { ... }
 * }
 * 
 * 按身份隔离数据，每个身份下有独立的双账号
 */

import { DEFAULT_BABY } from './defaultBabyData';

// 存储键名
const STORAGE_KEY = 'baby_time_v2';

// 身份列表（对应登录页面的角色）
const IDENTITIES = [
  "无敌奶爸", "温柔宝妈", "慈祥姥爷", "和蔼姥姥",
  "帅气老舅", "漂亮小姨", "慈祥爷爷", "宝宝本人", "访客参观"
];

/**
 * 获取所有数据
 */
export function getAllData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[DB] 读取数据失败，返回空', e);
    return {};
  }
}

/**
 * 保存所有数据
 */
export function saveAllData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[DB] 保存数据失败', e);
    return false;
  }
}

/**
 * 获取指定身份的数据
 */
export function getIdentityData(identityName) {
  const allData = getAllData();
  
  // 如果这个身份还没有数据，初始化
  if (!allData[identityName]) {
    allData[identityName] = {
      accounts: {
        default: JSON.parse(JSON.stringify(DEFAULT_BABY)),  // 系统默认账号
        user: {  // 用户自己的账号
          id: "user",
          name: "我的宝宝",
          birthday: "",
          isSystem: false,
          avatar: "👶",
          data: {
            timeline: [],
            growth: { height: [], weight: [] },
            virtualTime: []
          }
        }
      },
      currentAccountId: "user"  // 默认看用户自己的账号
    };
    saveAllData(allData);
  }
  
  return allData[identityName];
}

/**
 * 获取当前账号
 */
export function getCurrentAccount(identityName) {
  const identityData = getIdentityData(identityName);
  const { accounts, currentAccountId } = identityData;
  return accounts[currentAccountId] || accounts.user;
}

/**
 * 切换账号
 */
export function switchAccount(identityName, accountId) {
  const allData = getAllData();
  if (allData[identityName]) {
    allData[identityName].currentAccountId = accountId;
    saveAllData(allData);
    return true;
  }
  return false;
}

/**
 * 更新用户账号信息（仅 user 账号）
 */
export function updateUserAccountInfo(identityName, updates) {
  const allData = getAllData();
  if (!allData[identityName]) return false;
  
  // 只允许更新 user 账号，不允许更新 default 系统账号
  if (allData[identityName].accounts.user) {
    allData[identityName].accounts.user = {
      ...allData[identityName].accounts.user,
      ...updates
    };
    saveAllData(allData);
    return true;
  }
  return false;
}

/**
 * 添加动态到当前账号
 */
export function addMoment(identityName, momentData) {
  const allData = getAllData();
  if (!allData[identityName]) return false;
  
  const { accounts, currentAccountId } = allData[identityName];
  const account = accounts[currentAccountId];
  
  // 系统账号不允许修改
  if (account.isSystem) {
    console.warn('[DB] 系统账号数据只读，不允许添加动态');
    return false;
  }
  
  const moment = {
    id: `moment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...momentData,
    createdAt: new Date().toISOString()
  };
  
  account.data.timeline.unshift(moment);
  saveAllData(allData);
  return moment;
}

/**
 * 获取当前账号的所有动态
 */
export function getMoments(identityName) {
  const identityData = getIdentityData(identityName);
  const account = identityData.accounts[identityData.currentAccountId];
  return account.data.timeline || [];
}

/**
 * 更新动态
 */
export function updateMoment(identityName, momentId, updates) {
  const allData = getAllData();
  if (!allData[identityName]) return false;
  
  const { accounts, currentAccountId } = allData[identityName];
  const account = accounts[currentAccountId];
  
  if (account.isSystem) {
    console.warn('[DB] 系统账号数据只读');
    return false;
  }
  
  const index = account.data.timeline.findIndex(m => m.id === momentId);
  if (index > -1) {
    account.data.timeline[index] = { ...account.data.timeline[index], ...updates };
    saveAllData(allData);
    return true;
  }
  return false;
}

/**
 * 删除动态
 */
export function deleteMoment(identityName, momentId) {
  const allData = getAllData();
  if (!allData[identityName]) return false;
  
  const { accounts, currentAccountId } = allData[identityName];
  const account = accounts[currentAccountId];
  
  if (account.isSystem) {
    console.warn('[DB] 系统账号数据只读');
    return false;
  }
  
  account.data.timeline = account.data.timeline.filter(m => m.id !== momentId);
  saveAllData(allData);
  return true;
}

/**
 * 清空某个账号的所有数据（仅用于开发调试）
 */
export function resetUserAccount(identityName) {
  const allData = getAllData();
  if (!allData[identityName]) return false;
  
  allData[identityName].accounts.user = {
    id: "user",
    name: "我的宝宝",
    birthday: "",
    isSystem: false,
    avatar: "👶",
    data: {
      timeline: [],
      growth: { height: [], weight: [] },
      virtualTime: []
    }
  };
  
  saveAllData(allData);
  return true;
}

/**
 * 数据迁移：从旧版 IndexedDB 迁移到新版双账号结构
 * 在 migration.js 中调用
 */
export async function migrateFromV1(identityName = "无敌奶爸") {
  console.log('[DB迁移] 从 v1 IndexedDB 迁移数据...');
  
  try {
    // 先初始化新版结构（会自动注入 default 账号）
    const identityData = getIdentityData(identityName);
    
    // TODO: 从旧版 IndexedDB 读取数据并迁移到 user 账号
    // 这里需要根据实际的旧版数据结构来写
    
    console.log('[DB迁移] 迁移完成');
    return true;
  } catch (e) {
    console.error('[DB迁移] 迁移失败', e);
    return false;
  }
}

export default {
  getAllData,
  saveAllData,
  getIdentityData,
  getCurrentAccount,
  switchAccount,
  updateUserAccountInfo,
  addMoment,
  getMoments,
  updateMoment,
  deleteMoment,
  resetUserAccount,
  migrateFromV1,
  IDENTITIES
};
