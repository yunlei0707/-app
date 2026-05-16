/**
 * IndexedDB 数据库操作模块
 * 使用 idb 库封装数据库操作，支持宝宝档案、动态记录、时空胶囊的增删改查
 */

import { openDB } from 'idb';

const DB_NAME = 'BabyTimeDB';
const DB_VERSION = 6; // v6: 新增file-metadata表支持OPFS

// 初始化数据库
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 宝宝档案存储
      if (!db.objectStoreNames.contains('babies')) {
        const babyStore = db.createObjectStore('babies', { keyPath: 'id', autoIncrement: true });
        babyStore.createIndex('createdAt', 'createdAt');
      }

      // 动态记录存储
      if (!db.objectStoreNames.contains('moments')) {
        const momentStore = db.createObjectStore('moments', { keyPath: 'id', autoIncrement: true });
        momentStore.createIndex('babyId', 'babyId');
        momentStore.createIndex('date', 'date');
        momentStore.createIndex('createdAt', 'createdAt');
        momentStore.createIndex('milestone', 'milestone');
      }

      // 时空胶囊存储
      if (!db.objectStoreNames.contains('capsules')) {
        const capsuleStore = db.createObjectStore('capsules', { keyPath: 'id', autoIncrement: true });
        capsuleStore.createIndex('babyId', 'babyId');
        capsuleStore.createIndex('unlockDate', 'unlockDate');
        capsuleStore.createIndex('createdAt', 'createdAt');
      }

      // 设置存储
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // 用户表存储（用于登录注册）
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        userStore.createIndex('username', 'username', { unique: true });
        userStore.createIndex('createdAt', 'createdAt');
      }
      
      // 媒体文件独立存储表（性能优化：媒体与动态分离）
      if (!db.objectStoreNames.contains('media')) {
        const mediaStore = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        mediaStore.createIndex('momentId', 'momentId');  // 关联到动态
        mediaStore.createIndex('type', 'type');          // photo/video
        mediaStore.createIndex('createdAt', 'createdAt');
      }

      // 访客打卡存储
      if (!db.objectStoreNames.contains('visits')) {
        const visitStore = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
        visitStore.createIndex('babyId', 'babyId');
        visitStore.createIndex('visitorName', 'visitorName');
        visitStore.createIndex('visitDate', 'visitDate');
        visitStore.createIndex('createdAt', 'createdAt');
      }

      // 成长记录存储
      if (!db.objectStoreNames.contains('growthRecords')) {
        const growthStore = db.createObjectStore('growthRecords', { keyPath: 'id', autoIncrement: true });
        growthStore.createIndex('babyId', 'babyId');
        growthStore.createIndex('date', 'date');
      }

      // 文件元数据表（OPFS存储支持）
      if (!db.objectStoreNames.contains('file-metadata')) {
        const fileMetadataStore = db.createObjectStore('file-metadata', { keyPath: 'filename' });
        fileMetadataStore.createIndex('momentId', 'momentId');
        fileMetadataStore.createIndex('createdAt', 'createdAt');
      }
    },
  });
}

// ==================== 宝宝档案操作 ====================

/**
 * 获取所有宝宝档案
 */
export async function getAllBabies() {
  const db = await initDB();
  return db.getAll('babies');
}

/**
 * 获取指定用户的所有宝宝
 */
export async function getBabiesByUser(userId) {
  const db = await initDB();
  const allBabies = await db.getAll('babies');
  return allBabies.filter(baby => baby.userId === userId);
}

/**
 * 获取当前选中的宝宝
 */
export async function getCurrentBaby() {
  const babies = await getAllBabies();
  const settings = await getSettings();
  if (settings.currentBabyId) {
    const baby = babies.find(b => b.id === settings.currentBabyId);
    if (baby) return baby;
  }
  return babies[0] || null;
}

// ==================== 媒体文件操作（性能优化：媒体与动态分离）====================

/**
 * 添加媒体文件（独立存储）
 */
export async function addMedia(mediaData) {
  const db = await initDB();
  const media = {
    ...mediaData,
    createdAt: new Date().toISOString(),
  };
  const id = await db.add('media', media);
  return { ...media, id };
}

/**
 * 批量添加媒体文件
 */
export async function addMediaBatch(mediaList) {
  const db = await initDB();
  const tx = db.transaction('media', 'readwrite');
  const results = [];
  for (const mediaData of mediaList) {
    const media = {
      ...mediaData,
      createdAt: new Date().toISOString(),
    };
    const id = await tx.store.add(media);
    results.push({ ...media, id });
  }
  await tx.done;
  return results;
}

/**
 * 获取某个动态的所有媒体
 */
export async function getMediaByMomentId(momentId) {
  const db = await initDB();
  return await db.getAllFromIndex('media', 'momentId', momentId);
}

/**
 * 删除某个动态的所有媒体
 */
export async function deleteMediaByMomentId(momentId) {
  const db = await initDB();
  const media = await getMediaByMomentId(momentId);
  const tx = db.transaction('media', 'readwrite');
  for (const m of media) {
    await tx.store.delete(m.id);
  }
  await tx.done;
  return true;
}

// ==================== 存储配额管理 ====================

/**
 * 获取存储使用情况
 */
export async function getStorageUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage,
      total: estimate.quota,
      percent: ((estimate.usage / estimate.quota) * 100).toFixed(1),
      usedMB: (estimate.usage / 1024 / 1024).toFixed(2),
      totalMB: (estimate.quota / 1024 / 1024).toFixed(2),
    };
  }
  return null;
}

/**
 * 检查存储空间是否即将满
 */
export async function isStorageAlmostFull(threshold = 80) {
  const usage = await getStorageUsage();
  if (!usage) return false;
  return parseFloat(usage.percent) >= threshold;
}

/**
 * 智能压缩图片（超过阈值自动压缩）
 */
export async function smartCompressImage(file, maxSizeMB = 2, quality = 0.8) {
  const maxSize = maxSizeMB * 1024 * 1024;
  
  // 如果没超过阈值，直接返回原文件
  if (file.size <= maxSize) {
    return file;
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算缩放比例，限制最大宽度为1920
        const maxWidth = 1920;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转为blob
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { 
            type: 'image/jpeg', 
            lastModified: Date.now() 
          }));
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==================== 宝宝档案操作 ====================

/**
 * 添加宝宝档案
 */
export async function addBaby(babyData) {
  const db = await initDB();
  const baby = {
    ...babyData,
    createdAt: new Date().toISOString(),
  };
  const id = await db.add('babies', baby);
  return { ...baby, id };
}

/**
 * 更新宝宝档案
 */
export async function updateBaby(id, updates) {
  const db = await initDB();
  const baby = await db.get('babies', id);
  if (!baby) throw new Error('宝宝档案不存在');
  const updatedBaby = { ...baby, ...updates };
  await db.put('babies', updatedBaby);
  return updatedBaby;
}

/**
 * 删除宝宝档案
 */
export async function deleteBaby(id) {
  const db = await initDB();
  // 删除宝宝的所有动态和胶囊
  const moments = await db.getAllFromIndex('moments', 'babyId', id);
  const capsules = await db.getAllFromIndex('capsules', 'babyId', id);
  
  const tx = db.transaction(['babies', 'moments', 'capsules'], 'readwrite');
  await tx.objectStore('babies').delete(id);
  
  for (const moment of moments) {
    await tx.objectStore('moments').delete(moment.id);
  }
  for (const capsule of capsules) {
    await tx.objectStore('capsules').delete(capsule.id);
  }
  
  await tx.done;
  return true;
}

// ==================== 动态记录操作 ====================

/**
 * 获取某个宝宝的动态（分页查询，性能优化）
 * 只加载需要的数据，避免一次读取全部
 * 向后兼容：先用现有索引读取，再在内存中分页
 */
export async function getMomentsByBaby(babyId, offset = 0, limit = 20) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  
  // 过滤未删除的记录，按日期倒序排列
  const filtered = moments
    .filter(m => !m.isDeleted)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // 返回分页数据
  return filtered.slice(offset, offset + limit);
}

/**
 * 获取某个宝宝的所有动态（用于导出等场景，慎用）
 */
export async function getAllMomentsByBaby(babyId) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  return moments
    .filter(m => !m.isDeleted)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * 获取某个宝宝某个日期的动态（往年今日）
 */
export async function getMomentsOnSameDayLastYear(babyId, targetDate) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  const target = new Date(targetDate);
  const lastYear = new Date(target);
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  
  const targetMonth = target.getMonth();
  const targetDay = target.getDate();
  
  return moments.filter(m => {
    const mDate = new Date(m.date);
    return mDate.getMonth() === targetMonth && mDate.getDate() === targetDay && mDate.getFullYear() !== target.getFullYear();
  });
}

/**
 * 添加动态
 */
export async function addMoment(momentData) {
  const db = await initDB();
  const moment = {
    ...momentData,
    createdAt: new Date().toISOString(),
  };
  const id = await db.add('moments', moment);
  return { ...moment, id };
}

/**
 * 更新动态
 */
export async function updateMoment(id, updates) {
  const db = await initDB();
  const moment = await db.get('moments', id);
  if (!moment) throw new Error('动态不存在');
  const updatedMoment = { ...moment, ...updates, updatedAt: new Date().toISOString() };
  await db.put('moments', updatedMoment);
  return updatedMoment;
}

/**
 * 删除动态
 */
export async function deleteMoment(id) {
  const db = await initDB();
  const moment = await db.get('moments', id);
  if (!moment) return false;
  
  // 标记为已删除，而不是直接删除
  const updatedMoment = {
    ...moment,
    isDeleted: true,
    deletedAt: new Date().toISOString()
  };
  await db.put('moments', updatedMoment);
  return true;
}

/**
 * 根据名场面标签筛选动态
 */
export async function getMomentsByMilestone(babyId, milestone) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  return moments
    .filter(m => m.milestone === milestone)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ==================== 时空胶囊操作 ====================

/**
 * 获取某个宝宝的所有时空胶囊
 */
export async function getCapsulesByBaby(babyId) {
  const db = await initDB();
  const capsules = await db.getAllFromIndex('capsules', 'babyId', babyId);
  return capsules.sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate));
}

/**
 * 获取已解锁的胶囊
 */
export async function getUnlockedCapsules(babyId) {
  const capsules = await getCapsulesByBaby(babyId);
  const now = new Date();
  return capsules.filter(c => new Date(c.unlockDate) <= now);
}

/**
 * 获取待开封的胶囊
 */
export async function getLockedCapsules(babyId) {
  const capsules = await getCapsulesByBaby(babyId);
  const now = new Date();
  return capsules.filter(c => new Date(c.unlockDate) > now);
}

/**
 * 添加时空胶囊
 */
export async function addCapsule(capsuleData) {
  const db = await initDB();
  const capsule = {
    ...capsuleData,
    createdAt: new Date().toISOString(),
    isUnlocked: false,
  };
  const id = await db.add('capsules', capsule);
  return { ...capsule, id };
}

/**
 * 更新时空胶囊
 */
export async function updateCapsule(id, updates) {
  const db = await initDB();
  const capsule = await db.get('capsules', id);
  if (!capsule) throw new Error('胶囊不存在');
  const updatedCapsule = { ...capsule, ...updates, updatedAt: new Date().toISOString() };
  await db.put('capsules', updatedCapsule);
  return updatedCapsule;
}

/**
 * 删除时空胶囊
 */
export async function deleteCapsule(id) {
  const db = await initDB();
  await db.delete('capsules', id);
  return true;
}

// ==================== 设置操作 ====================

/**
 * 获取所有设置
 */
export async function getSettings() {
  const db = await initDB();
  const allSettings = await db.getAll('settings');
  const settingsMap = {};
  allSettings.forEach(s => {
    settingsMap[s.key] = s.value;
  });
  return {
    theme: settingsMap.theme || 'light',
    themePreset: settingsMap.themePreset || 'pink', // pink, forest, ocean, lavender, sunshine, custom
    customThemeColor: settingsMap.customThemeColor || null,
    currentBabyId: settingsMap.currentBabyId || null,
    customMilestones: settingsMap.customMilestones || [],
    hiddenMilestones: settingsMap.hiddenMilestones || [],
    ...settingsMap,
  };
}

/**
 * 更新设置
 */
export async function updateSettings(updates) {
  const db = await initDB();
  const tx = db.transaction('settings', 'readwrite');
  for (const [key, value] of Object.entries(updates)) {
    await tx.store.put({ key, value });
  }
  await tx.done;
  return getSettings();
}

/**
 * 获取自定义名场面标签
 */
export async function getCustomMilestones() {
  const settings = await getSettings();
  return settings.customMilestones || [];
}

/**
 * 保存自定义名场面标签
 */
export async function saveCustomMilestones(milestones) {
  return updateSettings({ customMilestones: milestones });
}

/**
 * 添加自定义名场面标签
 */
export async function addCustomMilestone(milestone) {
  const milestones = await getCustomMilestones();
  const newMilestone = {
    id: `custom_${Date.now()}`,
    ...milestone,
  };
  milestones.push(newMilestone);
  await saveCustomMilestones(milestones);
  return newMilestone;
}

/**
 * 更新自定义名场面标签
 */
export async function updateCustomMilestone(id, updates) {
  const milestones = await getCustomMilestones();
  const index = milestones.findIndex(m => m.id === id);
  if (index !== -1) {
    milestones[index] = { ...milestones[index], ...updates };
    await saveCustomMilestones(milestones);
    return milestones[index];
  }
  throw new Error('名场面不存在');
}

/**
 * 删除自定义名场面标签
 */
export async function deleteCustomMilestone(id) {
  const milestones = await getCustomMilestones();
  const filtered = milestones.filter(m => m.id !== id);
  await saveCustomMilestones(filtered);
  return true;
}

// ==================== 自定义心情标签 ====================

/**
 * 获取自定义心情标签
 */
export async function getCustomMoods() {
  const settings = await getSettings();
  return settings.customMoods || [];
}

/**
 * 保存自定义心情标签
 */
export async function saveCustomMoods(moods) {
  return updateSettings({ customMoods: moods });
}

/**
 * 添加自定义心情标签
 */
export async function addCustomMood(mood) {
  const moods = await getCustomMoods();
  const newMood = {
    id: `mood_${Date.now()}`,
    ...mood,
  };
  moods.push(newMood);
  await saveCustomMoods(moods);
  return newMood;
}

/**
 * 更新自定义心情标签
 */
export async function updateCustomMood(id, updates) {
  const moods = await getCustomMoods();
  const index = moods.findIndex(m => m.id === id);
  if (index !== -1) {
    moods[index] = { ...moods[index], ...updates };
    await saveCustomMoods(moods);
    return moods[index];
  }
  throw new Error('心情标签不存在');
}

/**
 * 删除自定义心情标签
 */
export async function deleteCustomMood(id) {
  const moods = await getCustomMoods();
  const filtered = moods.filter(m => m.id !== id);
  await saveCustomMoods(filtered);
  return true;
}

// ==================== 数据导出 ====================

/**
 * 导出所有数据为 JSON
 */
export async function exportAllData() {
  const db = await initDB();
  const [babies, moments, capsules, settings, users] = await Promise.all([
    db.getAll('babies'),
    db.getAll('moments'),
    db.getAll('capsules'),
    db.getAll('settings'),
    db.getAll('users'),
  ]);
  
  return {
    exportTime: new Date().toISOString(),
    version: '1.1.0',
    data: { babies, moments, capsules, settings, users },
  };
}

/**
 * 导入数据
 * @param {Object} data - 导出的数据对象
 * @param {boolean} mode - 'merge' 合并或 'replace' 覆盖
 */
export async function importAllData(data, mode = 'merge') {
  const db = await initDB();
  
  if (mode === 'replace') {
    // 覆盖模式：清空所有数据后导入
    const tx = db.transaction(['babies', 'moments', 'capsules', 'settings', 'users'], 'readwrite');
    await tx.objectStore('babies').clear();
    await tx.objectStore('moments').clear();
    await tx.objectStore('capsules').clear();
    await tx.objectStore('settings').clear();
    await tx.objectStore('users').clear();
    await tx.done;
  }
  
  const { data: importedData } = data;
  const { babies, moments, capsules, settings, users } = importedData;
  
  // 导入数据
  if (babies && babies.length > 0) {
    for (const baby of babies) {
      await db.put('babies', baby);
    }
  }
  
  if (moments && moments.length > 0) {
    for (const moment of moments) {
      await db.put('moments', moment);
    }
  }
  
  if (capsules && capsules.length > 0) {
    for (const capsule of capsules) {
      await db.put('capsules', capsule);
    }
  }
  
  if (settings && settings.length > 0) {
    for (const setting of settings) {
      await db.put('settings', setting);
    }
  }
  
  if (users && users.length > 0 && mode === 'replace') {
    // 用户数据只在覆盖模式下导入
    for (const user of users) {
      await db.put('users', user);
    }
  }
  
  return true;
}

// ==================== 用户操作（登录注册） ====================

/**
 * 获取所有用户
 */
export async function getAllUsers() {
  const db = await initDB();
  return db.getAll('users');
}

/**
 * 简单密码加密（Base64编码 + 反转）
 */
export function simpleEncrypt(password) {
  const reversed = password.split('').reverse().join('');
  return btoa(unescape(encodeURIComponent(reversed)));
}

/**
 * 验证密码
 */
export function verifyPassword(inputPassword, storedPassword) {
  return simpleEncrypt(inputPassword) === storedPassword;
}

/**
 * 根据用户名获取用户
 */
export async function getUserByUsername(username) {
  const db = await initDB();
  const users = await db.getAllFromIndex('users', 'username', username);
  return users[0] || null;
}

/**
 * 根据用户ID获取用户
 */
export async function getUserById(id) {
  const db = await initDB();
  return db.get('users', id);
}

/**
 * 检查用户名是否已存在
 */
export async function isUsernameExists(username) {
  const user = await getUserByUsername(username);
  return user !== null;
}

export async function getUserByNickname(nickname) {
  const db = await initDB();
  const users = await db.getAll(users);
  return users.find(u => u.nickname === nickname) || null;
}

/**
 * 注册新用户
 */
export async function registerUser(username, password, userInfo = {}) {
  // 检查用户名是否已存在
  const exists = await isUsernameExists(username);
  if (exists) {
    throw new Error('用户名已存在');
  }

  const db = await initDB();
  const encryptedPassword = simpleEncrypt(password);
  const user = {
    username,
    password: encryptedPassword,
    nickname: userInfo.nickname || username,
    avatar: userInfo.avatar || null,
    signature: userInfo.signature || '',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  
  const id = await db.add('users', user);
  return { ...user, id };
}

/**
 * 用户登录
 */
export async function loginUser(nickname, password) {
  // 先用昵称查找
  let user = await getUserByNickname(nickname);
  
  // 如果找不到，用用户名查找（兼容旧数据）
  if (!user) {
    user = await getUserByUsername(nickname);
  }
  
  if (!user) {
    throw new Error('昵称不存在');
  }
  
  if (!verifyPassword(password, user.password)) {
    throw new Error('密码错误');
  }
  
  // 更新最后登录时间
  const db = await initDB();
  user.lastLoginAt = new Date().toISOString();
  await db.put('users', user);
  
  return user;
}


/**
 * 更新用户资料
 */
export async function updateUser(id, updates) {
  const db = await initDB();
  const user = await db.get('users', id);
  if (!user) throw new Error('用户不存在');
  const updatedUser = { ...user, ...updates, updatedAt: new Date().toISOString() };
  await db.put('users', updatedUser);
  return updatedUser;
}

// ==================== 初始化示例数据 ====================

/**
 * 生成波形数据
 * @returns {Array} 32帧 x 6个数值 的二维数组
 */
function generateWaveform() {
  return Array(32).fill(0).map(() => Array(6).fill(0).map(() => Math.random() * 255));
}

/**
 * 检查是否需要初始化示例数据
 */
export async function checkAndInitSampleData(userId) {
  const babies = await getBabiesByUser(userId);
  if (babies.length === 0) {
    // 创建默认宝宝（不创建示例数据，让用户自己记录）
    const defaultBaby = await addBaby({
      name: '小豆芽',
      nickname: '豆芽',
      avatar: null,
      birthDate: getDefaultBirthDate(),
      gender: 'girl',
      userId: userId,
    });

    // 更新当前宝宝设置
    await updateSettings({ currentBabyId: defaultBaby.id });
    
    return defaultBaby;
  }
  return babies[0];
}

/**
 * 获取默认生日（假设宝宝6个月大）
 */
function getDefaultBirthDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString();
}

// 预设头像列表
export const PRESET_AVATARS = [
  '👶', '🍼', '🧸', '🐻', '🐰', '🦊', '🐼', '🐨',
  '👼', '🌟', '🎀', '🎈', '🌈', '☀️', '🌙', '💫',
];

/**
 * 生成颜色变体（用于自定义主题）
 * @param {string} hexColor - 十六进制颜色值，如 #FF7B70
 */
export function generateColorVariants(hexColor) {
  // 移除 # 号
  const hex = hexColor.replace('#', '');
  
  // 解析 RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // 生成浅色变体（增加白色混合）
  const lighten = (color, percent) => {
    const num = parseInt(color, 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, num + amt);
    const G = Math.min(255, num + amt);
    const B = Math.min(255, num + amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  };
  
  // 生成深色变体（减少亮度）
  const darken = (color, percent) => {
    const num = parseInt(color, 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, num - amt);
    const G = Math.max(0, num - amt);
    const B = Math.max(0, num - amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  };
  
  return {
    primary: hexColor,
    primaryLight: lighten(hexColor, 30),
    primaryDark: darken(hexColor, 15),
    warm: lighten(hexColor, 50),
    warmLight: lighten(hexColor, 70),
  };
}

/**
 * 应用自定义主题颜色
 * @param {string} hexColor - 十六进制颜色值
 */
export function applyCustomTheme(hexColor) {
  const variants = generateColorVariants(hexColor);
  const root = document.documentElement;
  
  root.setAttribute('data-theme', 'custom');
  root.style.setProperty('--color-primary', variants.primary);
  root.style.setProperty('--color-primary-light', variants.primaryLight);
  root.style.setProperty('--color-primary-dark', variants.primaryDark);
  root.style.setProperty('--color-warm', variants.warm);
  root.style.setProperty('--color-warm-light', variants.warmLight);
}

/**
 * 应用预设主题
 * @param {string} preset - 主题预设名称
 */
export function applyThemePreset(preset) {
  const root = document.documentElement;
  root.setAttribute('data-theme', preset === 'pink' ? '' : preset);
}

// ==================== 访客打卡操作 ====================

/**
 * 添加访客打卡记录
 * @param {Object} visitData - 打卡数据
 * @param {string} visitData.babyId - 宝宝ID
 * @param {string} visitData.visitorName - 访客称呼
 * @param {string} visitData.visitDate - 打卡日期 (YYYY-MM-DD)
 */
export async function addVisit(visitData) {
  const db = await initDB();
  
  // 检查今天是否已打卡（同一宝宝同一称呼同一天只能打卡一次）
  const existingVisits = await db.getAllFromIndex('visits', 'babyId', visitData.babyId);
  const hasCheckedIn = existingVisits.some(
    v => v.visitorName === visitData.visitorName && v.visitDate === visitData.visitDate
  );
  
  if (hasCheckedIn) {
    throw new Error('今天已经打卡过了');
  }
  
  const visit = {
    ...visitData,
    createdAt: new Date().toISOString(),
  };
  
  const id = await db.add('visits', visit);
  return { ...visit, id };
}

/**
 * 获取某个宝宝的所有打卡记录
 * @param {string} babyId - 宝宝ID
 */
export async function getVisitsByBaby(babyId) {
  const db = await initDB();
  const visits = await db.getAllFromIndex('visits', 'babyId', babyId);
  // 按时间倒序排列
  return visits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * 获取访客打卡排行榜
 * @param {string} babyId - 宝宝ID
 * @returns {Array} 排行列表 [{visitorName, count}]
 */
export async function getVisitRanking(babyId) {
  const visits = await getVisitsByBaby(babyId);
  
  // 按访客名称分组统计
  const rankingMap = {};
  visits.forEach(visit => {
    if (rankingMap[visit.visitorName]) {
      rankingMap[visit.visitorName]++;
    } else {
      rankingMap[visit.visitorName] = 1;
    }
  });
  
  // 转换为数组并排序
  const ranking = Object.entries(rankingMap)
    .map(([visitorName, count]) => ({ visitorName, count }))
    .sort((a, b) => b.count - a.count);
  
  return ranking;
}

/**
 * 删除访客打卡记录
 * @param {number} id - 记录ID
 */
export async function deleteVisit(id) {
  const db = await initDB();
  await db.delete('visits', id);
  return true;
}

/**
 * 生成邀请打卡Token
 * @param {string} babyId - 宝宝ID
 * @returns {string} 邀请Token
 */
export function generateInviteToken(babyId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${babyId}_${timestamp}_${random}`;
}

/**
 * 验证邀请Token
 * @param {string} babyId - 宝宝ID
 * @param {string} token - 邀请Token
 * @returns {boolean} 是否有效
 */
export function verifyInviteToken(babyId, token) {
  if (!token) return false;
  
  // 检查token格式和有效期（7天）
  const parts = token.split('_');
  if (parts.length < 3) return false;
  
  const tokenBabyId = parts[0];
  const tokenTimestamp = parseInt(parts[1], 10);
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  
  return tokenBabyId === babyId && (now - tokenTimestamp) < sevenDays;
}

/**
 * 获取今日打卡数量
 * @param {string} babyId - 宝宝ID
 */
export async function getTodayVisitCount(babyId) {
  const visits = await getVisitsByBaby(babyId);
  const today = new Date().toISOString().split('T')[0];
  return visits.filter(v => v.visitDate === today).length;
}

// ==================== 回收站功能 ====================

/**
 * 软删除动态（标记为已删除）
 * @param {number} momentId - 动态ID
 */
export async function softDeleteMoment(momentId) {
  const db = await initDB();
  const moment = await db.get('moments', momentId);
  if (!moment) throw new Error('动态不存在');
  
  const updatedMoment = { 
    ...moment, 
    isDeleted: true, 
    deletedAt: new Date().toISOString() 
  };
  await db.put('moments', updatedMoment);
  return updatedMoment;
}

/**
 * 恢复已删除的动态
 * @param {number} momentId - 动态ID
 */
export async function restoreMoment(momentId) {
  const db = await initDB();
  const moment = await db.get('moments', momentId);
  if (!moment) throw new Error('动态不存在');
  
  const updatedMoment = { 
    ...moment, 
    isDeleted: false, 
    deletedAt: null 
  };
  await db.put('moments', updatedMoment);
  return updatedMoment;
}

/**
 * 永久删除动态
 * @param {number} momentId - 动态ID
 */
export async function deleteMomentPermanently(momentId) {
  const db = await initDB();
  await db.delete('moments', momentId);
  return true;
}

/**
 * 获取某个宝宝回收站中的动态
 * @param {string} babyId - 宝宝ID
 */
export async function getDeletedMomentsByBaby(babyId) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  return moments
    .filter(m => m.isDeleted === true)
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
}

/**
 * 清空回收站
 * @param {string} babyId - 宝宝ID
 */
export async function emptyRecycleBin(babyId) {
  const db = await initDB();
  const deletedMoments = await getDeletedMomentsByBaby(babyId);
  
  const tx = db.transaction('moments', 'readwrite');
  for (const moment of deletedMoments) {
    await tx.store.delete(moment.id);
  }
  await tx.done;
  return true;
}

/**
 * 自动清理30天前删除的记录
 * @param {string} babyId - 宝宝ID
 */
export async function cleanExpiredDeleted(babyId) {
  const db = await initDB();
  const deletedMoments = await getDeletedMomentsByBaby(babyId);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const expiredMoments = deletedMoments.filter(
    m => new Date(m.deletedAt) < thirtyDaysAgo
  );
  
  const tx = db.transaction('moments', 'readwrite');
  for (const moment of expiredMoments) {
    await tx.store.delete(moment.id);
  }
  await tx.done;
  return expiredMoments.length;
}

// ==================== 月度报告统计 ====================

/**
 * 获取某月的统计数据
 * @param {string} babyId - 宝宝ID
 * @param {number} year - 年份
 * @param {number} month - 月份（1-12）
 */
export async function getMonthlyStats(babyId, year, month) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  
  // 筛选当月记录
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const monthlyMoments = moments.filter(m => {
    const momentDate = new Date(m.date);
    return momentDate >= startDate && momentDate <= endDate;
  });
  
  // 统计各类型数量
  const photoMoments = monthlyMoments.filter(m => m.type === 'photo');
  const videoMoments = monthlyMoments.filter(m => m.type === 'video');
  const diaryMoments = monthlyMoments.filter(m => m.type === 'diary');
  const audioMoments = monthlyMoments.filter(m => m.type === 'audio');
  
  // 照片总数
  const photoCount = photoMoments.reduce((acc, m) => acc + (m.photos?.length || 0), 0);
  
  // 视频总数
  const videoCount = videoMoments.reduce((acc, m) => acc + (m.videos?.length || 0), 0);
  
  // 获取名场面事件
  const milestones = monthlyMoments
    .filter(m => m.milestone)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 获取心情分布
  const moodStats = {};
  monthlyMoments.forEach(m => {
    if (m.mood) {
      moodStats[m.mood] = (moodStats[m.mood] || 0) + 1;
    }
  });
  
  return {
    year,
    month,
    totalMoments: monthlyMoments.length,
    photoCount,
    videoCount,
    diaryCount: diaryMoments.length,
    audioCount: audioMoments.length,
    milestones,
    moodStats,
  };
}

// ==================== 宝宝成长档案统计 ====================

/**
 * 停用词列表（用于关键词提取）
 */
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '你', '他', '她', '有', '和', '就', '不', '都', '也', '还', '很', '这', '那', '要', '会', '对', '说', '去', '到', '能', '让', '把', '给', '从', '被', '比', '等', '着', '过', '但', '又', '却', '而', '以', '为', '之', '于', '上', '下', '中', '后', '前', '里', '时', '来', '出', '没', '可', '只', '这个', '那个', '什么', '怎么', '没有', '可以', '因为', '所以', '但是', '如果', '虽然', '自己', '一个', '一些', '一样', '一点', '已经', '现在', '今天', '明天', '昨天', '每天', '然后', '可是', '或者', '而且', '还是', '就是', '这样', '那样', '这么', '那么', '真', '好', '真', '太', '最', '更', '挺', '蛮', '挺', '满', '怪', '死', '老', '多', '少', '点', '下', '起', '地', '得'
]);

/**
 * 从文本中提取关键词（出现2次以上的词）
 * @param {Array} diaryMoments - 日记动态列表
 * @returns {Array} 关键词数组 [{word, count}]
 */
function extractKeywords(diaryMoments) {
  const wordCount = {};
  
  diaryMoments.forEach(moment => {
    const content = moment.content || '';
    // 简单分词：按空格和标点分割
    const words = content
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && w.length <= 6) // 过滤太短或太长的词
      .filter(w => !STOP_WORDS.has(w.toLowerCase()));
    
    words.forEach(word => {
      const key = word.toLowerCase();
      wordCount[key] = (wordCount[key] || 0) + 1;
    });
  });
  
  // 返回出现2次以上的词
  return Object.entries(wordCount)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // 最多10个
    .map(([word, count]) => ({ word, count }));
}

/**
 * 根据时间范围获取开始和结束日期
 * @param {string} range - '1month' | '3months' | '1year' | 'all'
 * @param {string} birthDate - 宝宝出生日期
 * @returns {{ startDate: Date, endDate: Date, rangeDays: number }}
 */
function getDateRange(range, birthDate) {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let startDate;
  let rangeDays;
  
  switch (range) {
    case '1month':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      rangeDays = 30;
      break;
    case '3months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      rangeDays = 90;
      break;
    case '1year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      rangeDays = 365;
      break;
    case 'all':
    default:
      // 从出生日期开始计算
      startDate = birthDate ? new Date(birthDate) : new Date(0);
      const diffTime = endDate - startDate;
      rangeDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      break;
  }
  
  return { startDate, endDate, rangeDays };
}

/**
 * 生成时光寄语
 * @param {Object} stats - 统计数据
 * @param {string} range - 时间范围
 * @param {string} babyName - 宝宝名字
 * @returns {string}
 */
function generateTimeMessage(stats, range, babyName) {
  const { totalMoments, milestoneCount, firstMilestones } = stats;
  const rangeText = {
    '1month': '一个月',
    '3months': '三个月',
    '1year': '一年',
    'all': '这段时间'
  }[range] || '这段时间';
  
  const name = babyName || '宝宝';
  
  // 优先规则：第一次名场面
  if (firstMilestones && firstMilestones.length > 0) {
    return `这${rangeText}，${name}又解锁了${firstMilestones.length}个第一次，每一步都值得被记住。`;
  }
  
  // 名场面数>=3
  if (milestoneCount >= 3) {
    return `这${rangeText}，${name}达成了${milestoneCount}个名场面，成长的速度让人惊叹！`;
  }
  
  // 记录数>=10
  if (totalMoments >= 10) {
    return `这${rangeText}一共记录了${totalMoments}条时光，每一刻都是爱的印记。`;
  }
  
  // 记录数>0
  if (totalMoments > 0) {
    return `虽然记录不多，但每一刻都珍贵。继续陪伴，继续记录❤️`;
  }
  
  // 没有记录
  return `还没有记录，但爱一直在。现在就开始记录吧✨`;
}

/**
 * 找出代表时刻（最"重"的记录）
 * @param {Array} moments - 动态列表
 * @returns {Object|null}
 */
function findRepresentativeMoment(moments) {
  if (!moments || moments.length === 0) return null;
  
  // 计算每条记录的"重量"
  const scoredMoments = moments.map(m => {
    const photoCount = m.photos?.length || 0;
    const contentLength = (m.content || '').length;
    const date = new Date(m.date).getTime();
    
    // 权重：照片最多 > 文字最长 > 最新
    const score = photoCount * 1000 + contentLength * 10 + date * 0.001;
    
    return { ...m, _score: score };
  });
  
  // 返回得分最高的
  return scoredMoments.sort((a, b) => b._score - a._score)[0];
}

/**
 * 获取宝宝成长档案统计数据
 * @param {string} babyId - 宝宝ID
 * @param {string} range - 时间范围：'1month' | '3months' | '1year' | 'all'
 * @param {string} birthDate - 宝宝出生日期（可选）
 * @returns {Promise<Object>}
 */
export async function getGrowthReportStats(babyId, range = '1month', birthDate = null) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  
  // 计算时间范围
  const { startDate, endDate, rangeDays } = getDateRange(range, birthDate);
  
  // 筛选时间范围内的记录
  const filteredMoments = moments.filter(m => {
    const momentDate = new Date(m.date);
    return momentDate >= startDate && momentDate <= endDate;
  });
  
  // 统计各类型数量
  const photoMoments = filteredMoments.filter(m => m.type === 'photo');
  const videoMoments = filteredMoments.filter(m => m.type === 'video');
  const diaryMoments = filteredMoments.filter(m => m.type === 'diary');
  const audioMoments = filteredMoments.filter(m => m.type === 'audio');
  
  // 照片总数
  const photoCount = photoMoments.reduce((acc, m) => acc + (m.photos?.length || 0), 0);
  
  // 视频总数
  const videoCount = videoMoments.reduce((acc, m) => acc + (m.videos?.length || 0), 0);
  
  // 获取名场面事件
  const milestones = filteredMoments
    .filter(m => m.milestone)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 分离"第一次"名场面
  const firstMilestones = milestones.filter(m => m.milestone === 'first');
  
  // 获取心情分布
  const moodStats = {};
  filteredMoments.forEach(m => {
    if (m.mood) {
      moodStats[m.mood] = (moodStats[m.mood] || 0) + 1;
    }
  });
  
  // 提取关键词
  const keywords = extractKeywords(diaryMoments);
  
  // 找出代表时刻
  const representativeMoment = findRepresentativeMoment(filteredMoments);
  
  // 计算总记录数
  const totalMoments = filteredMoments.length;
  
  return {
    range,
    rangeDays,
    totalMoments,
    photoCount,
    videoCount,
    diaryCount: diaryMoments.length,
    audioCount: audioMoments.length,
    milestones,
    milestoneCount: milestones.length,
    firstMilestones,
    moodStats,
    keywords,
    representativeMoment,
    timeMessage: generateTimeMessage({
      totalMoments,
      milestoneCount: milestones.length,
      firstMilestones
    }, range, null), // babyName 由组件传入
  };
}

// ==================== 忘记密码功能（安全问题） ====================

/**
 * 更新用户安全问题
 * @param {number} userId - 用户ID
 * @param {string} question - 安全问题
 * @param {string} answer - 答案
 */
export async function updateSecurityQuestion(userId, question, answer) {
  const db = await initDB();
  const user = await db.get('users', userId);
  if (!user) throw new Error('用户不存在');
  
  const updatedUser = { 
    ...user, 
    securityQuestion: question,
    securityAnswer: answer,
    updatedAt: new Date().toISOString()
  };
  await db.put('users', updatedUser);
  return updatedUser;
}

/**
 * 验证安全问题答案
 * @param {string} username - 用户名
 * @param {string} answer - 答案
 */
export async function verifySecurityAnswer(nickname, answer) {
  // 先用昵称查找
  let user = await getUserByNickname(nickname);
  
  // 如果找不到，用用户名查找（兼容旧数据）
  if (!user) {
    user = await getUserByUsername(nickname);
  }
  if (!user) throw new Error('用户不存在');
  if (!user.securityQuestion || !user.securityAnswer) {
    throw new Error('该用户未设置安全问题');
  }
  if (user.securityAnswer.toLowerCase() !== answer.toLowerCase()) {
    throw new Error('答案错误');
  }
  return user;
}


/**
 * 解密密码（用于忘记密码显示）
 * @param {string} encryptedPassword - 加密后的密码
 */
export function decryptPassword(encryptedPassword) {
  try {
    const decoded = atob(encryptedPassword);
    return decoded.split('').reverse().join('');
  } catch (error) {
    throw new Error('密码解析失败');
  }
}

// ==================== 游客登录功能 ====================

/**
 * 创建游客账号
 * @returns {Object} 游客用户信息
 */
export async function createGuestAccount() {
  const db = await initDB();
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const randomPassword = Math.random().toString(36).substring(2, 10);
  
  const guestUser = {
    username: guestId,
    password: simpleEncrypt(randomPassword),
    nickname: '小游客',
    avatar: '👶',
    isGuest: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  
  const id = await db.add('users', guestUser);
  return { ...guestUser, id, rawPassword: randomPassword };
}

/**
 * 创建示例宝宝档案
 * @param {number} userId - 用户ID
 * @returns {Object} 示例宝宝信息
 */
export async function createSampleBaby(userId) {
  const defaultBaby = await addBaby({
    name: '小豆芽',
    nickname: '豆芽',
    avatar: null,
    birthDate: getDefaultBirthDate(),
    gender: 'girl',
    userId: userId,
  });

  // 创建示例动态
  const now = new Date();
  
  // 示例动态1：照片 - 三个月前
  const date1 = new Date(now);
  date1.setMonth(date1.getMonth() - 3);
  
  await addMoment({
    babyId: defaultBaby.id,
    type: 'photo',
    date: date1.toISOString(),
    content: '今天第一次尝试翻身，虽然只翻了一半，但已经超级棒了！',
    photos: ['https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400'],
    mood: 'happy',
    weather: 'sunny',
    milestone: 'first',
    milestoneLabel: '第一次翻身',
  });

  // 示例动态2：视频 - 两个月前
  const date2 = new Date(now);
  date2.setMonth(date2.getMonth() - 2);
  
  await addMoment({
    babyId: defaultBaby.id,
    type: 'video',
    date: date2.toISOString(),
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
  });

  // 示例动态3：语音 - 一个月前
  const date3 = new Date(now);
  date3.setMonth(date3.getMonth() - 1);
  
  await addMoment({
    babyId: defaultBaby.id,
    type: 'audio',
    date: date3.toISOString(),
    content: '今天第一次叫妈妈，虽然发音还不太标准，但真的好甜~',
    audios: [{
      url: 'https://www.w3schools.com/html/horse.ogg',
      duration: 8,
      waveform: generateWaveform(),
    }],
    mood: 'touched',
    weather: 'sunny',
    milestone: 'growth',
    milestoneLabel: '学会说话',
  });

  // 示例动态4：日记 - 两周前
  const date4 = new Date(now);
  date4.setDate(date4.getDate() - 14);
  
  await addMoment({
    babyId: defaultBaby.id,
    type: 'diary',
    date: date4.toISOString(),
    content: '今天带豆芽去公园玩，她对花花草草特别感兴趣，一直在摸小树叶。看见小狗狗就激动得不行，一定要追着跑。希望下周天气好，可以再去一次！',
    mood: 'happy',
    weather: 'windy',
    milestone: 'daily',
    milestoneLabel: '户外活动',
  });

  // 更新当前宝宝设置
  await updateSettings({ currentBabyId: defaultBaby.id });
  
  return defaultBaby;
}

/**
 * 清空所有数据（清除缓存）
 */
export async function clearAllData() {
  const db = await initDB();
  const tx = db.transaction(['babies', 'moments', 'capsules', 'settings', 'users'], 'readwrite');
  await tx.objectStore('babies').clear();
  await tx.objectStore('moments').clear();
  await tx.objectStore('capsules').clear();
  await tx.objectStore('settings').clear();
  await tx.objectStore('users').clear();
  await tx.done;
  // 同时清除 localStorage 中的 v2 数据
  localStorage.removeItem('v2Data');
  localStorage.removeItem('currentAccountId');
  localStorage.removeItem('lastDataUpdate');
  return true;
}
// ==================== 成长记录操作 ====================

/**
 * 添加成长记录
 */
export async function addGrowthRecord(recordData) {
  const db = await initDB();
  const record = {
    ...recordData,
    date: recordData.date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };
  const id = await db.add('growthRecords', record);
  return { ...record, id };
}

/**
 * 获取某个宝宝的成长记录
 */
export async function getGrowthRecordsByBaby(babyId) {
  const db = await initDB();
  const records = await db.getAllFromIndex('growthRecords', 'babyId', babyId);
  return records.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * 获取某个宝宝最新一条成长记录
 */
export async function getLatestGrowthRecord(babyId) {
  const records = await getGrowthRecordsByBaby(babyId);
  return records[0] || null;
}

/**
 * 更新成长记录
 */
export async function updateGrowthRecord(id, updates) {
  const db = await initDB();
  const record = await db.get('growthRecords', id);
  if (!record) throw new Error('记录不存在');
  const updated = { ...record, ...updates, updatedAt: new Date().toISOString() };
  await db.put('growthRecords', updated);
  return updated;
}

/**
 * 删除成长记录
 */
export async function deleteGrowthRecord(id) {
  const db = await initDB();
  await db.delete('growthRecords', id);
  return true;
}

// ==================== 文件元数据操作（OPFS支持） ====================

/**
 * 保存文件元数据
 * @param {Object} metadata 文件元数据
 * @returns {Promise<Object>}
 */
export async function saveFileMetadata(metadata) {
  const db = await initDB();
  const meta = {
    ...metadata,
    createdAt: new Date().toISOString(),
  };
  await db.put('file-metadata', meta);
  return meta;
}

/**
 * 获取文件元数据
 * @param {string} filename 文件名
 * @returns {Promise<Object|null>}
 */
export async function getFileMetadata(filename) {
  const db = await initDB();
  return await db.get('file-metadata', filename);
}

/**
 * 删除文件元数据
 * @param {string} filename 文件名
 * @returns {Promise<boolean>}
 */
export async function deleteFileMetadata(filename) {
  const db = await initDB();
  await db.delete('file-metadata', filename);
  return true;
}

/**
 * 根据动态ID获取所有关联的文件元数据
 * @param {number} momentId 动态ID
 * @returns {Promise<Array>}
 */
export async function getFileMetadataByMomentId(momentId) {
  const db = await initDB();
  return await db.getAllFromIndex('file-metadata', 'momentId', momentId);
}

/**
 * 获取所有文件元数据
 * @returns {Promise<Array>}
 */
export async function getAllFileMetadata() {
  const db = await initDB();
  return await db.getAll('file-metadata');
}

// ==================== 导入功能优化 - v2 导出 ====================

/**
 * 判断字符串是否为base64格式的媒体数据
 * @param {string} str - 待检测字符串
 * @returns {boolean} 是否为base64媒体
 */
export function isBase64Media(str) {
  if (typeof str !== 'string') return false;
  return str.startsWith('data:image/') || 
         str.startsWith('data:video/') || 
         str.startsWith('data:audio/');
}

/**
 * 将base64转换为Blob
 * @param {string} base64 - base64字符串
 * @returns {Blob} Blob对象
 */
export function base64ToBlob(base64) {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  
  return new Blob([uInt8Array], { type: contentType });
}

/**
 * 获取文件扩展名
 * @param {string} mimeType - MIME类型
 * @returns {string} 扩展名
 */
function getExtensionFromMimeType(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return map[mimeType] || 'dat';
}

/**
 * 将base64媒体保存到OPFS
 * @param {string} base64 - base64媒体数据
 * @param {string} momentId - 关联的动态ID
 * @returns {Promise<string>} 保存后的文件名
 */
export async function saveBase64MediaToOPFS(base64, momentId = null) {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      console.warn('[Import] OPFS不可用，保留base64格式');
      return base64;
    }

    const blob = base64ToBlob(base64);
    const ext = getExtensionFromMimeType(blob.type);
    const filename = `import_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
    
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // 保存元数据到IndexedDB
    const db = await initDB();
    await db.put('file-metadata', {
      filename,
      momentId,
      type: blob.type,
      size: blob.size,
      createdAt: new Date().toISOString(),
      source: 'import'
    });

    console.log(`[Import] 媒体文件已保存到OPFS: ${filename}, 大小: ${(blob.size / 1024).toFixed(2)}KB`);
    return filename;
  } catch (e) {
    console.error('[Import] 保存媒体到OPFS失败:', e);
    // 失败时降级为保留base64
    return base64;
  }
}

/**
 * 处理动态中的媒体文件，将base64转存到OPFS
 * @param {Object} moment - 动态数据
 * @returns {Promise<Object>} 处理后的动态数据
 */
async function processMomentMedia(moment) {
  // 处理照片
  if (moment.photos && Array.isArray(moment.photos)) {
    const processedPhotos = [];
    for (const photo of moment.photos) {
      if (isBase64Media(photo)) {
        const filename = await saveBase64MediaToOPFS(photo, moment.id);
        processedPhotos.push({ filename, isOPFS: true });
      } else {
        processedPhotos.push(photo);
      }
    }
    moment.photos = processedPhotos;
  }

  // 处理视频
  if (moment.video && isBase64Media(moment.video)) {
    const filename = await saveBase64MediaToOPFS(moment.video, moment.id);
    moment.video = { filename, isOPFS: true };
  }

  // 处理视频数组
  if (moment.videos && Array.isArray(moment.videos)) {
    const processedVideos = [];
    for (const video of moment.videos) {
      if (typeof video === 'string' && isBase64Media(video)) {
        const filename = await saveBase64MediaToOPFS(video, moment.id);
        processedVideos.push({ filename, isOPFS: true });
      } else {
        processedVideos.push(video);
      }
    }
    moment.videos = processedVideos;
  }

  // 处理音频
  if (moment.audios && Array.isArray(moment.audios)) {
    const processedAudios = [];
    for (const audio of moment.audios) {
      if (audio.url && isBase64Media(audio.url)) {
        const filename = await saveBase64MediaToOPFS(audio.url, moment.id);
        processedAudios.push({ ...audio, url: filename, isOPFS: true });
      } else {
        processedAudios.push(audio);
      }
    }
    moment.audios = processedAudios;
  }

  return moment;
}

/**
 * 手动触发垃圾回收提示（仅作提示，实际GC由浏览器控制）
 */
export function suggestGarbageCollection() {
  // 清除可能的大对象引用
  if (window.gc && typeof window.gc === 'function') {
    try {
      window.gc();
    } catch (e) {
      // 忽略，某些浏览器不支持
    }
  }
}

/**
 * 导入数据 - v2 优化版本，支持分批导入、进度回调、取消导入、OPFS存储
 * @param {Object} data - 导出的数据对象
 * @param {string} mode - 'merge' 合并或 'replace' 覆盖
 * @param {Object} options - 选项
 * @param {Function} options.onProgress - 进度回调 (progress, message)
 * @param {Function} options.onCancelCheck - 取消检查回调，返回true表示取消
 * @param {number} options.batchSize - 每批处理数量
 * @returns {Promise<boolean>} 是否成功
 */
export async function importAllDataV2(data, mode = 'merge', options = {}) {
  const {
    onProgress = () => {},
    onCancelCheck = () => false,
    batchSize = 20
  } = options;

  const db = await initDB();
  const { data: importedData } = data;
  const { babies, moments, capsules, settings, users } = importedData;

  // 计算总工作量
  let totalItems = 0;
  if (babies && babies.length) totalItems += babies.length;
  if (moments && moments.length) totalItems += moments.length;
  if (capsules && capsules.length) totalItems += capsules.length;
  if (settings && settings.length) totalItems += settings.length;
  if (users && users.length) totalItems += users.length;

  let processedItems = 0;

  // 检查是否需要取消
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  if (mode === 'replace') {
    onProgress(5, '正在清空现有数据...');
    // 覆盖模式：清空所有数据后导入
    const tx = db.transaction(['babies', 'moments', 'capsules', 'settings', 'users'], 'readwrite');
    await tx.objectStore('babies').clear();
    await tx.objectStore('moments').clear();
    await tx.objectStore('capsules').clear();
    await tx.objectStore('settings').clear();
    await tx.objectStore('users').clear();
    await tx.done;
    processedItems += 5;
  }

  // 检查是否需要取消
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  // 导入宝宝档案
  if (babies && babies.length > 0) {
    onProgress(Math.round((processedItems / (totalItems || 1)) * 100), `正在导入宝宝档案 (0/${babies.length})...`);
    
    for (let i = 0; i < babies.length; i += batchSize) {
      if (onCancelCheck()) {
        throw new Error('导入已取消');
      }

      const batch = babies.slice(i, i + batchSize);
      const tx = db.transaction('babies', 'readwrite');
      
      for (const baby of batch) {
        await tx.store.put(baby);
      }
      await tx.done;
      
      processedItems += batch.length;
      onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `正在导入宝宝档案 (${Math.min(i + batchSize, babies.length)}/${babies.length})...`);
      
      // 批次间释放内存
      suggestGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // 检查是否需要取消
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  // 导入动态记录 - 优化：分批处理，媒体转存OPFS
  if (moments && moments.length > 0) {
    onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `准备导入动态记录 (0/${moments.length})...`);
    
    for (let i = 0; i < moments.length; i += batchSize) {
      if (onCancelCheck()) {
        throw new Error('导入已取消');
      }

      const batch = moments.slice(i, i + batchSize);
      const tx = db.transaction('moments', 'readwrite');
      
      for (const moment of batch) {
        // 处理媒体文件：将base64转存到OPFS
        const processedMoment = await processMomentMedia(moment);
        await tx.store.put(processedMoment);
      }
      await tx.done;
      
      processedItems += batch.length;
      onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `正在导入动态记录 (${Math.min(i + batchSize, moments.length)}/${moments.length})...`);
      
      // 批次间释放内存
      suggestGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // 检查是否需要取消
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  // 导入时空胶囊
  if (capsules && capsules.length > 0) {
    onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `准备导入时空胶囊 (0/${capsules.length})...`);
    
    for (let i = 0; i < capsules.length; i += batchSize) {
      if (onCancelCheck()) {
        throw new Error('导入已取消');
      }

      const batch = capsules.slice(i, i + batchSize);
      const tx = db.transaction('capsules', 'readwrite');
      
      for (const capsule of batch) {
        await tx.store.put(capsule);
      }
      await tx.done;
      
      processedItems += batch.length;
      onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `正在导入时空胶囊 (${Math.min(i + batchSize, capsules.length)}/${capsules.length})...`);
      
      // 批次间释放内存
      suggestGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // 检查是否需要取消
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  // 导入设置
  if (settings && settings.length > 0) {
    onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `正在导入设置...`);
    const tx = db.transaction('settings', 'readwrite');
    
    for (const setting of settings) {
      await tx.store.put(setting);
    }
    await tx.done;
    
    processedItems += settings.length;
    suggestGarbageCollection();
  }

  // 检查是否需要取消
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  // 导入用户数据 - 仅在覆盖模式下
  if (users && users.length > 0 && mode === 'replace') {
    onProgress(Math.round((processedItems / (totalItems || 1)) * 90), `正在导入用户数据...`);
    const tx = db.transaction('users', 'readwrite');
    
    for (const user of users) {
      await tx.store.put(user);
    }
    await tx.done;
    
    processedItems += users.length;
  }

  onProgress(100, '导入完成！');
  suggestGarbageCollection();
  return true;
}

/**
 * 从ZIP文件流式读取并导入数据
 * @param {File} zipFile - ZIP文件对象
 * @param {string} mode - 导入模式
 * @param {Object} options - 选项
 * @returns {Promise<boolean>} 是否成功
 */
export async function importFromZipStream(zipFile, mode = 'merge', options = {}) {
  const {
    onProgress = () => {},
    onCancelCheck = () => false
  } = options;

  // 检查JSZip是否可用
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip库未加载，请检查网络连接');
  }

  onProgress(5, '正在加载ZIP文件...');
  
  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  const zip = new window.JSZip();
  const zipContent = await zip.loadAsync(zipFile, {
    // 使用流式加载，避免一次性加载全部到内存
    streamFiles: true
  });

  // 查找data.json文件
  const dataJsonFile = zipContent.file('data.json');
  if (!dataJsonFile) {
    throw new Error('ZIP文件中未找到data.json');
  }

  onProgress(10, '正在解析数据文件...');

  if (onCancelCheck()) {
    throw new Error('导入已取消');
  }

  // 读取data.json内容
  const jsonContent = await dataJsonFile.async('string');
  const data = JSON.parse(jsonContent);

  onProgress(15, '数据解析完成，开始导入...');

  // 使用v2版本导入
  return await importAllDataV2(data, mode, options);
}

/**
 * 批量导入多个文件
 * @param {FileList} files - 文件列表
 * @param {string} mode - 导入模式
 * @param {Object} options - 选项
 * @returns {Promise<{success: number, failed: number, total: number}>} 导入结果
 */
export async function importMultipleFiles(files, mode = 'merge', options = {}) {
  const {
    onProgress = () => {},
    onCancelCheck = () => false
  } = options;

  const total = files.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    if (onCancelCheck()) {
      throw new Error('导入已取消');
    }

    const file = files[i];
    onProgress(Math.round((i / total) * 100), `正在处理第 ${i + 1}/${total} 个文件: ${file.name}`);

    try {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.zip')) {
        await importFromZipStream(file, mode, {
          onProgress: (subProgress, message) => {
            const overallProgress = Math.round((i / total) * 100) + Math.round(subProgress / total);
            onProgress(overallProgress, `[${file.name}] ${message}`);
          },
          onCancelCheck
        });
      } else if (fileName.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        await importAllDataV2(data, mode, {
          onProgress: (subProgress, message) => {
            const overallProgress = Math.round((i / total) * 100) + Math.round(subProgress / total);
            onProgress(overallProgress, `[${file.name}] ${message}`);
          },
          onCancelCheck
        });
      } else {
        console.warn(`不支持的文件格式: ${file.name}`);
        failed++;
        continue;
      }
      success++;
    } catch (error) {
      console.error(`导入文件失败: ${file.name}`, error);
      failed++;
    }

    // 文件间释放内存
    suggestGarbageCollection();
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  onProgress(100, `批量导入完成：成功 ${success} 个，失败 ${failed} 个`);

  return { success, failed, total };
}
 
