/**
 * v2 双账号系统数据库操作模块
 * 
 * 功能：
 * 1. 新用户首次登录自动初始化双账号结构
 * 2. 账号切换和数据操作
 * 3. 与原有 IndexedDB 数据交互
 */

import {
  getV2Data,
  saveV2Data,
  getV2AccountData,
  updateV2AccountData,
  switchV2Account,
  getCurrentV2Account,
  getCurrentIdentity,
  isMigrated,
  migrateV1ToV2
} from './migration';

// 导入虚拟时光默认数据
import { virtualTimeTopics } from '../data/virtualTimeData';

// 重新导出，确保可以被其他文件导入
export {
  getCurrentV2Account,
  getCurrentIdentity,
  isMigrated,
  switchV2Account,
  updateV2AccountData
};

// localStorage 键名
const CURRENT_IDENTITY_KEY = 'currentIdentity';
const CURRENT_ACCOUNT_KEY = 'currentAccountId';

/**
 * 获取当前 v2 账号（内部使用）
 * @returns {Object|null}
 */
export function getCurrentV2AccountInternal() {
  return _getCurrentV2Account();
}

/**
 * 初始化 v2 数据结构（新用户首次登录）
 * @param {string} identityName - 身份名称
 * @returns {Object} 初始化结果
 */
export function initializeV2ForNewUser(identityName) {
  const v2Data = getV2Data() || {};
  
  // 如果该身份已有数据，跳过初始化
  if (v2Data[identityName] && v2Data[identityName].accounts) {
    return {
      success: true,
      isNewUser: false,
      message: '该身份已有数据，跳过初始化'
    };
  }
  
  const now = new Date();
  
  // 创建系统账号（豆芽示例数据）
  const defaultAccount = createSystemAccount();
  
  // 创建用户账号（空白）
  const userAccount = createEmptyUserAccount();
  
  // 构建该身份的 v2 数据
  v2Data[identityName] = {
    accounts: {
      'default': defaultAccount,
      'user': userAccount
    },
    currentAccountId: 'user' // 默认显示用户自己的账号
  };
  
  saveV2Data(v2Data);
  
  // 设置当前身份和账号
  localStorage.setItem(CURRENT_IDENTITY_KEY, identityName);
  localStorage.setItem(CURRENT_ACCOUNT_KEY, 'user');
  
  return {
    success: true,
    isNewUser: true,
    message: '新用户初始化完成',
    data: v2Data[identityName]
  };
}

/**
 * 创建系统账号（豆芽示例数据）
 * @returns {Object}
 */
function createSystemAccount() {
  const now = new Date();
  
  // 豆芽的出生日期（假设比当前日期早1年3个月）
  const beanSproutBirth = new Date(now);
  beanSproutBirth.setFullYear(beanSproutBirth.getFullYear() - 1);
  beanSproutBirth.setMonth(beanSproutBirth.getMonth() - 3);
  
  return {
    id: 'default',
    name: '豆芽',
    nickname: '豆芽',
    avatar: null,
    birthDate: beanSproutBirth.toISOString(),
    dueDate: '',
    gender: 'girl',
    birthTime: '辰时',
    birthHeight: 50,
    birthWeight: 3.2,
    birthplace: '北京市海淀区',
    isSystem: true,
    createdAt: now.toISOString(),
    // 5条示例动态
    timeline: [
      {
        id: 'sys-1',
        type: 'photo',
        date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        content: '今天第一次尝试翻身，虽然只翻了一半，但已经超级棒了！',
        photos: ['https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400'],
        mood: 'happy',
        weather: 'sunny',
        milestone: 'first',
        milestoneLabel: '第一次翻身',
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sys-2',
        type: 'video',
        date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        content: '今天学会了爬行，追着球球跑得好开心呀！',
        videos: [{
          url: 'https://www.w3schools.com/html/mov_bbb.mp4',
          cover: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400',
          duration: 10
        }],
        mood: 'excited',
        weather: 'cloudy',
        milestone: 'growth',
        milestoneLabel: '学会爬行',
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sys-3',
        type: 'audio',
        date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        content: '今天第一次叫妈妈，虽然发音还不太标准，但真的好甜~',
        audios: [{
          url: 'https://www.w3schools.com/html/horse.ogg',
          duration: 8
        }],
        mood: 'touched',
        weather: 'sunny',
        milestone: 'growth',
        milestoneLabel: '学会说话',
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sys-4',
        type: 'diary',
        date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        content: '今天带豆芽去公园玩，她对花花草草特别感兴趣，一直在摸小树叶。看见小狗狗就激动得不行，一定要追着跑。希望下周天气好，可以再去一次！',
        mood: 'happy',
        weather: 'windy',
        milestone: 'daily',
        milestoneLabel: '户外活动',
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sys-5',
        type: 'photo',
        date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        content: '今天豆芽学会了用勺子自己吃饭，虽然弄得满脸都是，但是特别有成就感！',
        photos: ['https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=400'],
        mood: 'excited',
        weather: 'sunny',
        milestone: 'learning',
        milestoneLabel: '学会自己吃饭',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "sys-6",
        type: "podcast",
        date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        content: "给豆芽读了《猜猜我有多爱你》，她听得特别认真，还跟着学小兔子的动作~",
        podcast: {
          title: "睡前故事：猜猜我有多爱你",
          description: "经典绘本故事，讲述小兔子和大兔子比爱的温馨故事",
          audio: {
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            duration: 180,
            size: 3 * 1024 * 1024
          },
          cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400"
        },
        mood: "happy",
        weather: "night",
        milestone: "daily",
        milestoneLabel: "睡前故事",
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "sys-7",
        type: "photo",
        date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        content: "今天带豆芽去动物园！看到大熊猫、长颈鹿、小猴子，她一直指着动物咿咿呀呀地叫，兴奋极了！",
        photos: [
          "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400",
          "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400",
          "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400"
        ],
        mood: "excited",
        weather: "sunny",
        milestone: "first",
        milestoneLabel: "第一次去动物园",
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "sys-8",
        type: "diary",
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        content: "豆芽今天学会了分享！把自己的小饼干分给了旁边的小朋友，还很大方地把玩具递给其他宝宝。虽然有时候还是会护着自己的东西，但已经很棒了！",
        mood: "touched",
        weather: "cloudy",
        milestone: "learning",
        milestoneLabel: "学会分享",
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "sys-9",
        type: "photo",
        date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        content: "豆芽第一次独立站起来了！坚持了足足5秒钟，虽然马上就坐下了，但全家人都为她鼓掌！",
        photos: ["https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400"],
        mood: "excited",
        weather: "sunny",
        milestone: "first",
        milestoneLabel: "第一次站立",
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "sys-10",
        type: "video",
        date: now.toISOString(),
        content: "豆芽迈出了人生第一步！虽然只有两步，但这是她走向世界的开始，爸爸妈妈激动得眼泪都快出来了！",
        videos: [{
          url: "https://www.w3schools.com/html/movie.mp4",
          cover: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400",
          duration: 15
        }],
        mood: "touched",
        weather: "sunny",
        milestone: "first",
        milestoneLabel: "迈出第一步",
        createdAt: now.toISOString()
      }
    ],
    // 成长数据
    growth: {
      height: 75,
      weight: 9.5,
      records: []
    },
    // 虚拟时光
    virtualTime: [],
    // ✅ 单源数据：媒体文件索引表（文件哈希 → 元数据）
    // 避免重复上传相同文件，节省存储空间
    mediaIndex: {}
  };
}

/**
 * 创建空白用户账号
 * @returns {Object}
 */
function createEmptyUserAccount() {
  const now = new Date();
  
  return {
    id: 'user',
    name: '我的宝宝',
    nickname: '',
    avatar: null,
    birthDate: '',
    dueDate: '',
    gender: 'girl',
    birthTime: '',
    birthHeight: null,
    birthWeight: null,
    birthplace: '',
    isSystem: false,
    createdAt: now.toISOString(),
    // 空数据
    timeline: [],
    growth: {
      height: null,
      weight: null,
      records: []
    },
    virtualTime: [],
    // ✅ 单源数据：媒体文件索引表
    mediaIndex: {}
  };
}

/**
 * 初始化应用（处理迁移和首次登录）
 * @param {string} identityName - 当前身份名称
 * @returns {Object} 初始化结果
 */
export async function initializeApp(identityName) {
  // 1. 检查并执行 v1 -> v2 迁移（如果有旧数据）
  if (!isMigrated()) {
    const migrateResult = await migrateV1ToV2();
    console.log('迁移结果:', migrateResult);
  }
  
  // 2. 获取当前 v2 数据
  const v2Data = getV2Data();
  
  // 3. 检查该身份是否已有 v2 数据
  if (!v2Data || !v2Data[identityName]) {
    // 新用户，初始化双账号结构
    return initializeV2ForNewUser(identityName);
  }
  
  // 已有数据，设置当前身份
  localStorage.setItem(CURRENT_IDENTITY_KEY, identityName);
  const currentAccountId = v2Data[identityName].currentAccountId || 'user';
  localStorage.setItem(CURRENT_ACCOUNT_KEY, currentAccountId);
  
  return {
    success: true,
    isNewUser: false,
    message: '加载已有数据',
    data: v2Data[identityName]
  };
}

/**
 * 获取当前账号的宝宝信息
 * @returns {Object|null}
 */
export function getCurrentBabyInfo() {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) return null;
  
  const { accountData, accountId } = current;
  
  return {
    id: accountData.id,
    name: accountData.name || '我的宝宝',
    nickname: accountData.nickname || accountData.name || '我的宝宝',
    avatar: accountData.avatar,
    birthDate: accountData.birthDate,
    dueDate: accountData.dueDate || '',
    gender: accountData.gender || 'girl',
    birthTime: accountData.birthTime || '',
    birthHeight: accountData.birthHeight,
    birthWeight: accountData.birthWeight,
    birthplace: accountData.birthplace || '',
    isSystem: accountData.isSystem || false,
    accountId
  };
}

/**
 * 更新当前账号的宝宝信息
 * @param {Object} babyInfo - 宝宝信息
 * @returns {boolean}
 */
export function updateCurrentBabyInfo(babyInfo) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId } = current;
  
  updateV2AccountData(identityName, accountId, {
    ...babyInfo,
    updatedAt: new Date().toISOString()
  });
  
  return true;
}

/**
 * 获取当前账号的时间线（动态）
 * @returns {Array}
 */
export function getCurrentTimeline() {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) return [];
  
  return (current.accountData.timeline || []).filter(m => !m.isDeleted);
}

/**
 * 获取当前账号的所有动态（包括已删除的，用于同步）
 * @returns {Array}
 */
export function getCurrentTimelineForSync() {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) return [];
  
  return current.accountData.timeline || [];
}

// ============================================================
// ✅ 单源数据：媒体索引管理（避免重复上传相同文件）
// ============================================================

/**
 * 获取当前账号的媒体索引表
 * @returns {Object} mediaIndex - { fileHash: { path, size, mimeType, refCount, ... } }
 */
export function getCurrentMediaIndex() {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) return {};
  
  // 确保 mediaIndex 字段存在（兼容旧数据）
  if (!current.accountData.mediaIndex) {
    current.accountData.mediaIndex = {};
  }
  
  return current.accountData.mediaIndex;
}

/**
 * 通过文件哈希查找已存在的媒体
 * @param {string} fileHash - 文件哈希值
 * @returns {Object|null} 媒体元数据或null
 */
export function findMediaByHash(fileHash) {
  const mediaIndex = getCurrentMediaIndex();
  return mediaIndex[fileHash] || null;
}

/**
 * 注册新媒体到索引表
 * @param {string} fileHash - 文件哈希值
 * @param {Object} mediaInfo - 媒体元数据 { path, size, mimeType, fileName }
 * @returns {Object} 注册后的媒体信息
 */
export function registerMedia(fileHash, mediaInfo) {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) return null;
  
  const { identityName, accountId, accountData } = current;
  
  // 确保 mediaIndex 存在
  if (!accountData.mediaIndex) {
    accountData.mediaIndex = {};
  }
  
  // 注册新媒体（如果已存在则增加引用计数）
  const existing = accountData.mediaIndex[fileHash];
  if (existing) {
    existing.refCount = (existing.refCount || 0) + 1;
    existing.lastAccessAt = new Date().toISOString();
    console.log('[MediaIndex] 复用已有媒体，引用计数:', existing.refCount, '哈希:', fileHash);
  } else {
    accountData.mediaIndex[fileHash] = {
      ...mediaInfo,
      fileHash,
      refCount: 1,
      firstUploadAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString()
    };
    console.log('[MediaIndex] 注册新媒体，哈希:', fileHash, '路径:', mediaInfo.path);
  }
  
  // 保存到本地存储
  updateV2AccountData(identityName, accountId, {
    mediaIndex: accountData.mediaIndex
  });
  
  return accountData.mediaIndex[fileHash];
}

/**
 * 增加媒体引用计数
 * @param {string} fileHash - 文件哈希值
 * @returns {boolean} 是否成功
 */
export function incrementMediaRef(fileHash) {
  const current = getCurrentV2Account();
  if (!current || !current.accountData?.mediaIndex?.[fileHash]) {
    return false;
  }
  
  const { identityName, accountId, accountData } = current;
  accountData.mediaIndex[fileHash].refCount += 1;
  accountData.mediaIndex[fileHash].lastAccessAt = new Date().toISOString();
  
  updateV2AccountData(identityName, accountId, {
    mediaIndex: accountData.mediaIndex
  });
  
  return true;
}

/**
 * 减少媒体引用计数（当引用计数为0时可考虑删除文件）
 * @param {string} fileHash - 文件哈希值
 * @returns {boolean} 是否成功
 */
export function decrementMediaRef(fileHash) {
  const current = getCurrentV2Account();
  if (!current || !current.accountData?.mediaIndex?.[fileHash]) {
    return false;
  }
  
  const { identityName, accountId, accountData } = current;
  const media = accountData.mediaIndex[fileHash];
  
  media.refCount = Math.max(0, (media.refCount || 1) - 1);
  media.lastAccessAt = new Date().toISOString();
  
  updateV2AccountData(identityName, accountId, {
    mediaIndex: accountData.mediaIndex
  });
  
  console.log('[MediaIndex] 减少引用，当前计数:', media.refCount, '哈希:', fileHash);
  return true;
}

/**
 * 从索引表中移除媒体（通常在引用计数为0时调用）
 * @param {string} fileHash - 文件哈希值
 * @returns {boolean} 是否成功
 */
export function unregisterMedia(fileHash) {
  const current = getCurrentV2Account();
  if (!current || !current.accountData?.mediaIndex?.[fileHash]) {
    return false;
  }
  
  const { identityName, accountId, accountData } = current;
  delete accountData.mediaIndex[fileHash];
  
  updateV2AccountData(identityName, accountId, {
    mediaIndex: accountData.mediaIndex
  });
  
  console.log('[MediaIndex] 移除媒体，哈希:', fileHash);
  return true;
}

/**
 * 添加动态到当前账号
 * @param {Object} moment - 动态数据
 * @returns {Object} 添加后的动态
 */
export function addMomentToCurrentAccount(moment) {
  const current = getCurrentV2Account();
  if (!current) return null;
  
  const { identityName, accountId, accountData } = current;
  
  // ✅ 类型检查：防止函数被意外存入数据（React setState会执行函数）
  // 这是解决 "n is a function" 错误的关键修复
  function sanitizeValue(value) {
    // 如果是函数，返回空字符串（不应该把函数存入数据）
    if (typeof value === 'function') {
      console.warn('[addMoment] 检测到函数类型值，已清理:', value);
      return '';
    }
    // 如果是对象，递归清理
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          cleaned[key] = sanitizeValue(value[key]);
        }
      }
      return cleaned;
    }
    // 如果是数组，递归清理每个元素
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item));
    }
    return value;
  }
  
  // 清理整个moment对象，确保没有函数被存入
  const sanitizedMoment = sanitizeValue(moment);
  
  const newMoment = {
    ...sanitizedMoment,
    id: sanitizedMoment.id || `moment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString()
  };
  
  const timeline = accountData.timeline || [];
  timeline.unshift(newMoment); // 添加到开头
  
  updateV2AccountData(identityName, accountId, {
    timeline
  });
  
  return newMoment;
}

/**
 * 更新动态
 * @param {string} momentId - 动态ID
 * @param {Object} updates - 更新内容
 * @returns {boolean}
 */
export function updateMomentInCurrentAccount(momentId, updates) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId, accountData } = current;
  
  const timeline = accountData.timeline || [];
  const index = timeline.findIndex(m => m.id === momentId);
  
  if (index === -1) return false;
  
  timeline[index] = { ...timeline[index], ...updates };
  
  updateV2AccountData(identityName, accountId, {
    timeline
  });
  
  return true;
}

/**
 * 删除动态
 * @param {string} momentId - 动态ID
 * @returns {boolean}
 */
export function deleteMomentFromCurrentAccount(momentId) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId, accountData } = current;
  
  const timeline = accountData.timeline || [];
  const updatedTimeline = timeline.map(m => {
    if (m.id === momentId) {
      return {
        ...m,
        isDeleted: true,
        deletedAt: new Date().toISOString()
      };
    }
    return m;
  });
  
  updateV2AccountData(identityName, accountId, {
    timeline: updatedTimeline
  });
  
  return true;
}

/**
 * 获取当前账号的成长数据
 * @returns {Object}
 */
export function getCurrentGrowth() {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) {
    return { height: null, weight: null, records: [] };
  }
  
  return current.accountData.growth || { height: null, weight: null, records: [] };
}

/**
 * 更新成长数据
 * @param {Object} growthData - 成长数据
 * @returns {boolean}
 */
export function updateCurrentGrowth(growthData) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId, accountData } = current;
  
  updateV2AccountData(identityName, accountId, {
    growth: {
      ...accountData.growth,
      ...growthData,
      updatedAt: new Date().toISOString()
    }
  });
  
  return true;
}

/**
 * 获取当前账号的虚拟时光
 * @returns {Array}
 */
export function getCurrentVirtualTime() {
  const current = getCurrentV2Account();
  if (!current || !current.accountData) {
    return [];
  }
  
  return current.accountData.virtualTime || [];
}

/**
 * 添加虚拟时光到当前账号
 * @param {Object} virtualTimeData - 虚拟时光数据
 * @returns {Object|null} 添加后的虚拟时光
 */
export function addVirtualTimeToCurrentAccount(virtualTimeData) {
  const current = getCurrentV2Account();
  if (!current) return null;
  
  const { identityName, accountId, accountData } = current;
  
  const newItem = {
    ...virtualTimeData,
    id: `vt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    // 联动相关字段（新增）
    linked_from_record_id: virtualTimeData.linked_from_record_id || null,
    link_type: virtualTimeData.link_type || null,
    is_linked: virtualTimeData.is_linked || false
  };
  
  const virtualTime = accountData.virtualTime || [];
  virtualTime.unshift(newItem); // 添加到开头
  
  updateV2AccountData(identityName, accountId, {
    virtualTime
  });
  
  return newItem;
}

/**
 * 更新虚拟时光
 * @param {string} itemId - 虚拟时光ID
 * @param {Object} updates - 更新内容
 * @returns {boolean}
 */
export function updateVirtualTimeInCurrentAccount(itemId, updates) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId, accountData } = current;
  
  const virtualTime = accountData.virtualTime || [];
  const index = virtualTime.findIndex(item => item.id === itemId);
  
  if (index === -1) return false;
  
  virtualTime[index] = { ...virtualTime[index], ...updates };
  
  updateV2AccountData(identityName, accountId, {
    virtualTime
  });
  
  return true;
}

/**
 * 从当前账号删除虚拟时光
 * @param {string} itemId - 虚拟时光ID
 * @returns {boolean}
 */
export function deleteVirtualTimeFromCurrentAccount(itemId) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId, accountData } = current;
  
  const virtualTime = accountData.virtualTime || [];
  const filteredVirtualTime = virtualTime.filter(item => item.id !== itemId);
  
  updateV2AccountData(identityName, accountId, {
    virtualTime: filteredVirtualTime
  });
  
  return true;
}

/**
 * 切换账号
 * @param {string} targetAccountId - 目标账号ID (default/user/v1_legacy)
 * @returns {boolean}
 */
export function switchAccount(targetAccountId) {
  const identityName = getCurrentIdentity();
  if (!identityName) return false;
  
  // v1账号也可以直接切换，因为switchV2Account只是设置ID
  return switchV2Account(identityName, targetAccountId);
}

/**
 * 获取可用账号列表
 * @returns {Array} [{ id, name, isSystem, isV1 }]
 */
export function getAvailableAccounts() {
  const v2Data = getV2Data();
  const identityName = getCurrentIdentity();
  
  if (!v2Data || !v2Data[identityName]) return [];
  
  const identityData = v2Data[identityName];
  const accounts = identityData.accounts || {};
  const currentAccountId = identityData.currentAccountId;
  
  // ✅ 只返回v2的两个账号：系统预设(default) 和 我的账号(user)
  // v1历史数据自动合并到"我的账号"中显示，用户无需切换
  const v2Accounts = Object.keys(accounts).map(accountId => ({
    id: accountId,
    name: accounts[accountId].name || (accountId === 'default' ? '系统预设' : '我的账号'),
    nickname: accounts[accountId].nickname || accounts[accountId].name,
    isSystem: accounts[accountId].isSystem || false,
    isV1: false,
    isCurrent: accountId === currentAccountId
  }));
  
  return v2Accounts;
}

/**
 * 检查是否为系统账号
 * @returns {boolean}
 */
export function isSystemAccount() {
  const current = getCurrentV2Account();
  return current?.accountData?.isSystem === true;
}

/**
 * 检查是否为v1历史数据账号
 * @returns {boolean}
 */
export function isV1Account() {
  const v2Data = getV2Data();
  const identityName = getCurrentIdentity();
  
  if (!v2Data || !v2Data[identityName]) return false;
  
  const currentAccountId = v2Data[identityName].currentAccountId;
  return currentAccountId === 'v1_legacy';
}

/**
 * 获取系统账号信息
 * @returns {Object|null}
 */
export function getSystemAccountInfo() {
  const v2Data = getV2Data();
  const identityName = getCurrentIdentity();
  
  if (!v2Data || !v2Data[identityName]) return null;
  
  const defaultAccount = v2Data[identityName].accounts?.default;
  if (!defaultAccount) return null;
  
  return {
    id: defaultAccount.id,
    name: defaultAccount.name,
    nickname: defaultAccount.nickname,
    avatar: defaultAccount.avatar,
    birthDate: defaultAccount.birthDate,
    gender: defaultAccount.gender,
    timelineCount: defaultAccount.timeline?.length || 0
  };
}

/**
 * 获取用户账号信息
 * @returns {Object|null}
 */
export function getUserAccountInfo() {
  const v2Data = getV2Data();
  const identityName = getCurrentIdentity();
  
  if (!v2Data || !v2Data[identityName]) return null;
  
  const userAccount = v2Data[identityName].accounts?.user;
  if (!userAccount) return null;
  
  return {
    id: userAccount.id,
    name: userAccount.name,
    nickname: userAccount.nickname,
    avatar: userAccount.avatar,
    birthDate: userAccount.birthDate,
    gender: userAccount.gender,
    timelineCount: userAccount.timeline?.length || 0,
    hasData: (userAccount.timeline?.length || 0) > 0
  };
}

// ==================== 数据导出导入 ====================

/**
 * 导出当前账号的 v2 数据
 * @returns {Object} 导出的数据
 */
export function exportV2AccountData() {
  const current = getCurrentV2Account();
  if (!current) return null;
  
  // 过滤系统预置内容：timeline中ID以"sys-"开头的是系统示例数据
  const allTimeline = current.accountData?.timeline || [];
  const userTimeline = allTimeline.filter(m => !m.id?.startsWith('sys-'));
  
  return {
    exportTime: new Date().toISOString(),
    version: '2.0.0',
    accountType: current.accountId,
    accountData: {
      id: current.accountData?.id,
      name: current.accountData?.name,
      nickname: current.accountData?.nickname,
      avatar: current.accountData?.avatar,
      birthDate: current.accountData?.birthDate,
      gender: current.accountData?.gender,
      isSystem: current.accountData?.isSystem,
    },
    timeline: userTimeline,
    growth: current.accountData?.growth || { height: null, weight: null, records: [] },
    virtualTime: current.accountData?.virtualTime || [],
    virtualTimeContents: current.accountData?.virtualTimeContents || {},
  };
}

/**
 * 导入 v2 数据到当前账号
 * @param {Object} data - 导出的数据
 * @param {string} mode - 'merge' 合并或 'replace' 覆盖
 * @returns {boolean}
 */
export function importV2AccountData(data, mode = 'merge') {
  console.log('[importV2AccountData] 开始导入，模式:', mode);
  console.log('[importV2AccountData] 导入数据 timeline 长度:', data?.timeline?.length);
  console.log('[importV2AccountData] 导入数据 accountData:', data?.accountData);
  
  const current = getCurrentV2Account();
  console.log('[importV2AccountData] 当前账号:', current);
  
  if (!current) {
    console.error('[importV2AccountData] 当前账号为空，导入失败');
    return false;
  }
  
  const { identityName, accountId } = current;
  
  if (mode === 'replace') {
    // 覆盖模式：直接替换整个账号数据
    updateV2AccountData(identityName, accountId, {
      name: data.accountData?.name || '我的宝宝',
      nickname: data.accountData?.nickname || '',
      avatar: data.accountData?.avatar,
      birthDate: data.accountData?.birthDate || '',
      gender: data.accountData?.gender || 'girl',
      timeline: data.timeline || [],
      growth: data.growth || { height: null, weight: null, records: [] },
      virtualTime: data.virtualTime || [],
      virtualTimeContents: data.virtualTimeContents || {},
    });
  } else {
    // 合并模式：只合并 timeline
    const currentTimeline = current.accountData?.timeline || [];
    const newTimeline = data.timeline || [];
    
    // 合并去重
    const existingIds = new Set(currentTimeline.map(m => m.id));
    const mergedTimeline = [
      ...currentTimeline,
      ...newTimeline.filter(m => !existingIds.has(m.id))
    ];
    
    // 合并虚拟时光内容
    const currentVTContents = current.accountData?.virtualTimeContents || {};
    const importVTContents = data.virtualTimeContents || {};
    const mergedVTContents = { ...currentVTContents };
    
    for (const key of Object.keys(importVTContents)) {
      if (!mergedVTContents[key]) {
        // 本地没有这个key，直接加入
        mergedVTContents[key] = importVTContents[key];
      } else {
        // 本地有这个key，合并内容去重
        const existingContentIds = new Set((mergedVTContents[key].contents || []).map(c => c.id));
        const newContents = (importVTContents[key].contents || []).filter(c => !existingContentIds.has(c.id));
        mergedVTContents[key] = {
          ...mergedVTContents[key],
          contents: [...(mergedVTContents[key].contents || []), ...newContents],
        };
      }
    }
    
    updateV2AccountData(identityName, accountId, {
      timeline: mergedTimeline,
      // 虚拟时光也合并
      virtualTime: [
        ...(current.accountData?.virtualTime || []),
        ...(data.virtualTime || []).filter(v => 
          !(current.accountData?.virtualTime || []).some(cv => cv.id === v.id)
        ),
      ],
      virtualTimeContents: mergedVTContents,
    });
  }
  
  console.log('[importV2AccountData] 导入成功！');
  return true;
}

// ==================== 虚拟时光目录管理 ====================

// 预置的一级目录 ID（不可删除）
const PRESET_CATEGORY_IDS = ['kindergarten', 'middle_school', 'wedding', 'university', 'work'];

// 获取虚拟时光目录（合并预置和用户自定义）
export function getVirtualTimeCategories() {
  const current = getCurrentV2Account();
  if (!current) return [];
  
  const userCategories = current.accountData?.virtualTimeCategories || [];
  
  // 合并预置目录和用户目录
  const presetCategories = virtualTimeTopics.map(topic => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    coverEmoji: topic.coverEmoji,
    coverGradient: topic.coverGradient,
    coverIcon: topic.coverIcon,
    isPreset: true,
    items: topic.items?.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      content: item.content,
      type: item.type,
      emoji: item.emoji,
      tags: item.tags,
      imagePrompt: item.imagePrompt,
      date: item.date,
      isPreset: true
    })) || []
  }));
  
  // 用户自定义一级目录
  const allCategories = [...presetCategories];
  userCategories.forEach(cat => {
    if (!allCategories.find(c => c.id === cat.id)) {
      allCategories.push({ ...cat, isPreset: false, items: cat.items || [] });
    }
  });
  
  return allCategories;
}

// 添加一级目录
export function addVirtualTimeCategory(categoryData) {
  const current = getCurrentV2Account();
  if (!current) return null;
  
  const { identityName, accountId } = current;
  
  const newCategory = {
    id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: categoryData.title || '新分类',
    description: categoryData.description || '',
    coverEmoji: categoryData.coverEmoji || '📁',
    coverGradient: categoryData.coverGradient || 'from-gray-400 to-gray-500',
    coverIcon: categoryData.coverIcon || '📁',
    isPreset: false,
    items: [],
    createdAt: new Date().toISOString()
  };
  
  const userCategories = current.accountData?.virtualTimeCategories || [];
  userCategories.push(newCategory);
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeCategories: userCategories
  });
  
  return newCategory;
}

// 更新一级目录
export function updateVirtualTimeCategory(categoryId, updates) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId } = current;
  const userCategories = current.accountData?.virtualTimeCategories || [];
  const index = userCategories.findIndex(c => c.id === categoryId);
  
  if (index === -1) return false;
  
  userCategories[index] = {
    ...userCategories[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeCategories: userCategories
  });
  
  return true;
}

// 删除一级目录
export function deleteVirtualTimeCategory(categoryId) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  if (PRESET_CATEGORY_IDS.includes(categoryId)) {
    return false;
  }
  
  const { identityName, accountId } = current;
  const userCategories = current.accountData?.virtualTimeCategories || [];
  const filtered = userCategories.filter(c => c.id !== categoryId);
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeCategories: filtered
  });
  
  return true;
}

// 添加二级目录项
export function addVirtualTimeCategoryItem(categoryId, itemData) {
  const current = getCurrentV2Account();
  if (!current) return null;
  
  if (PRESET_CATEGORY_IDS.includes(categoryId)) {
    return null;
  }
  
  const { identityName, accountId } = current;
  const userCategories = current.accountData?.virtualTimeCategories || [];
  const catIndex = userCategories.findIndex(c => c.id === categoryId);
  
  if (catIndex === -1) return null;
  
  const newItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: itemData.title || '新内容',
    description: itemData.description || '',
    content: itemData.content || '',
    type: itemData.type || 'text',
    emoji: itemData.emoji || '📝',
    tags: itemData.tags || [],
    isPreset: false,
    createdAt: new Date().toISOString()
  };
  
  userCategories[catIndex].items = userCategories[catIndex].items || [];
  userCategories[catIndex].items.push(newItem);
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeCategories: userCategories
  });
  
  return newItem;
}

// 更新二级目录项
export function updateVirtualTimeCategoryItem(categoryId, itemId, updates) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId } = current;
  const userCategories = current.accountData?.virtualTimeCategories || [];
  const catIndex = userCategories.findIndex(c => c.id === categoryId);
  
  if (catIndex === -1) return false;
  
  const itemIndex = userCategories[catIndex].items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return false;
  
  userCategories[catIndex].items[itemIndex] = {
    ...userCategories[catIndex].items[itemIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeCategories: userCategories
  });
  
  return true;
}

// 删除二级目录项
export function deleteVirtualTimeCategoryItem(categoryId, itemId) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId } = current;
  const userCategories = current.accountData?.virtualTimeCategories || [];
  const catIndex = userCategories.findIndex(c => c.id === categoryId);
  
  if (catIndex === -1) return false;
  
  userCategories[catIndex].items = userCategories[catIndex].items.filter(i => i.id !== itemId);
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeCategories: userCategories
  });
  
  return true;
}

// 获取虚拟时光内容
export function getVirtualTimeContents(topicId, itemId) {
  const current = getCurrentV2Account();
  if (!current) return [];
  
  const contents = current.accountData?.virtualTimeContents || {};
  return contents[`${topicId}_${itemId}`]?.contents || [];
}

// 添加虚拟时光内容
export function addVirtualTimeContent(topicId, itemId, contentData) {
  const current = getCurrentV2Account();
  if (!current) return null;
  
  const { identityName, accountId } = current;
  
  const key = `${topicId}_${itemId}`;
  const contents = current.accountData?.virtualTimeContents || {};
  const itemContents = contents[key]?.contents || [];
  
  const newContent = {
    id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: contentData.title || '',
    emoji: contentData.emoji || '📝',
    date: contentData.date || new Date().toISOString().split('T')[0],
    content: contentData.content,
    images: contentData.images || [],
    createdAt: new Date().toISOString()
  };
  
  itemContents.unshift(newContent);
  
  contents[key] = {
    id: key,
    topicId,
    itemId,
    contents: itemContents,
    updatedAt: new Date().toISOString()
  };
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeContents: contents
  });
  
  return newContent;
}

// 删除虚拟时光内容
export function deleteVirtualTimeContent(topicId, itemId, contentId) {
  const current = getCurrentV2Account();
  if (!current) return false;
  
  const { identityName, accountId } = current;
  const contents = current.accountData?.virtualTimeContents || {};
  
  if (!contents[`${topicId}_${itemId}`]) return false;
  
  contents[`${topicId}_${itemId}`].contents = contents[`${topicId}_${itemId}`].contents.filter(c => c.id !== contentId);
  
  updateV2AccountData(identityName, accountId, {
    virtualTimeContents: contents
  });
  
  return true;
}


// ==================== 联动内容管理 ====================

/**
 * 删除与某个真实记录关联的所有联动内容
 * 当真实记录被删除时，自动清理对应的虚拟时光联动内容
 * @param {string} recordId - 真实记录的ID
 * @returns {number} 删除的联动内容数量
 */
export function deleteLinkedContentByRecordId(recordId) {
  try {
    const current = getCurrentV2Account();
    if (!current) return 0;
    
    const { identityName, accountId, accountData } = current;
    const virtualTime = accountData.virtualTime || [];
    
    // 过滤掉关联到此 recordId 的内容
    const filteredVirtualTime = virtualTime.filter(
      item => !(item.is_linked && item.linked_from_record_id === recordId)
    );
    
    const deletedCount = virtualTime.length - filteredVirtualTime.length;
    
    if (deletedCount > 0) {
      updateV2AccountData(identityName, accountId, {
        virtualTime: filteredVirtualTime
      });
      console.log(`[Link] 已删除 ${deletedCount} 条联动内容 (recordId: ${recordId})`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[Link] 删除联动内容失败:', error);
    return 0;
  }
}

/**
 * 获取与某个真实记录关联的所有联动内容
 * @param {string} recordId - 真实记录的ID
 * @returns {Array} 联动内容列表
 */
export function getLinkedContentByRecordId(recordId) {
  const current = getCurrentV2Account();
  if (!current) return [];
  
  const virtualTime = current.accountData?.virtualTime || [];
  return virtualTime.filter(
    item => item.is_linked && item.linked_from_record_id === recordId
  );
}
