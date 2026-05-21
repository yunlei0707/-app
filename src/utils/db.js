/**
 * IndexedDB 数据库操作模块
 * 使用 idb 库封装数据库操作，支持宝宝档案、动态记录、时空胶囊的增删改查
 * ✅ 生产级架构：新增 babyId_createdAt 复合索引支持游标分页
 */

import { openDB } from 'idb';

const DB_NAME = 'BabyTimeDB';
const DB_VERSION = 7; // v7: 新增 babyId_createdAt 复合索引优化分页

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
        // ✅ 新增：复合索引，用于高效游标分页
        momentStore.createIndex('babyId_createdAt', ['babyId', 'createdAt'], { unique: false });
      } else {
        // 为已存在的 store 添加复合索引（升级时）
        const momentStore = transaction.objectStore('moments');
        if (!momentStore.indexNames.contains('babyId_createdAt')) {
          momentStore.createIndex('babyId_createdAt', ['babyId', 'createdAt'], { unique: false });
        }
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

// ==================== 动态记录操作 - 生产级游标分页 ====================

/**
 * ✅ 生产级：获取某个宝宝的动态（游标分页，高性能）
 * 使用 babyId_createdAt 复合索引进行游标遍历，避免全表扫描和内存排序
 * 
 * @param {number|string} babyId - 宝宝ID
 * @param {string|null} lastCreatedAt - 上一页最后一条的createdAt（用于分页）
 * @param {number} limit - 每页条数，默认20
 * @returns {Promise<Array>} 动态列表（按createdAt倒序）
 */
export async function getMomentsByBaby(babyId, lastCreatedAt = null, limit = 20) {
  const db = await initDB();
  const tx = db.transaction('moments', 'readonly');
  const store = tx.objectStore('moments');
  const index = store.index('babyId_createdAt');
  
  const moments = [];
  let range;
  
  if (lastCreatedAt) {
    // 游标分页：获取比 lastCreatedAt 更早的记录
    // 使用 bound 限定范围，同时排除 lastCreatedAt 本身（避免重复）
    range = IDBKeyRange.bound(
      [babyId, new Date(0).toISOString()],
      [babyId, lastCreatedAt],
      false,
      true  // exclude the upper bound (lastCreatedAt)
    );
  } else {
    // 第一页：获取该宝宝的所有动态
    range = IDBKeyRange.bound(
      [babyId, new Date(0).toISOString()],
      [babyId, new Date().toISOString()]
    );
  }
  
  // 使用游标遍历（prev = 倒序，即最新的在前）
  let cursor = await index.openCursor(range, 'prev');
  while (cursor && moments.length < limit) {
    // 过滤已删除的记录
    if (!cursor.value.isDeleted) {
      moments.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  
  await tx.done;
  return moments;
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
 * 获取某个宝宝的所有动态（包括已删除的，用于同步）
 */
export async function getAllMomentsByBabyForSync(babyId) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  return moments
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * 获取所有宝宝的所有动态（包括已删除的，用于同步）
 */
export async function getAllMomentsForSync() {
  const db = await initDB();
  const moments = await db.getAll('moments');
  return moments;
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
 * 获取某个宝宝的时空胶囊
 */
export async function getCapsulesByBaby(babyId) {
  const db = await initDB();
  const capsules = await db.getAllFromIndex('capsules', 'babyId', babyId);
  return capsules.sort((a, b) => new Date(b.unlockDate) - new Date(a.unlockDate));
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
  const settings = {};
  const keys = await db.getAllKeys('settings');
  
  for (const key of keys) {
    const item = await db.get('settings', key);
    if (item && item.value !== undefined) {
      settings[key] = item.value;
    }
  }
  
  return settings;
}

/**
 * 更新设置
 */
export async function updateSettings(key, value) {
  const db = await initDB();
  await db.put('settings', { key, value });
  return true;
}

// ==================== 用户操作 ====================

/**
 * 添加用户
 */
export async function addUser(userData) {
  const db = await initDB();
  const user = {
    ...userData,
    createdAt: new Date().toISOString(),
  };
  const id = await db.add('users', user);
  return { ...user, id };
}

/**
 * 根据用户名查找用户
 */
export async function getUserByUsername(username) {
  const db = await initDB();
  const tx = db.transaction('users', 'readonly');
  const index = tx.store.index('username');
  const cursor = await index.openCursor(username);
  await tx.done;
  return cursor ? cursor.value : null;
}

/**
 * 更新用户
 */
export async function updateUser(id, updates) {
  const db = await initDB();
  const user = await db.get('users', id);
  if (!user) throw new Error('用户不存在');
  const updatedUser = { ...user, ...updates, updatedAt: new Date().toISOString() };
  await db.put('users', updatedUser);
  return updatedUser;
}

// ==================== 成长记录操作 ====================

/**
 * 获取某个宝宝的成长记录
 */
export async function getGrowthRecordsByBaby(babyId) {
  const db = await initDB();
  const records = await db.getAllFromIndex('growthRecords', 'babyId', babyId);
  return records.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * 添加成长记录
 */
export async function addGrowthRecord(recordData) {
  const db = await initDB();
  const record = {
    ...recordData,
    createdAt: new Date().toISOString(),
  };
  const id = await db.add('growthRecords', record);
  return { ...record, id };
}

/**
 * 更新成长记录
 */
export async function updateGrowthRecord(id, updates) {
  const db = await initDB();
  const record = await db.get('growthRecords', id);
  if (!record) throw new Error('成长记录不存在');
  const updatedRecord = { ...record, ...updates, updatedAt: new Date().toISOString() };
  await db.put('growthRecords', updatedRecord);
  return updatedRecord;
}

// ==================== 自定义名场面和心情操作 ====================

/**
 * 获取自定义名场面列表
 */
export async function getCustomMilestones() {
  const settings = await getSettings();
  return settings.customMilestones || [];
}

/**
 * 添加自定义名场面
 */
export async function addCustomMilestone(milestone) {
  const milestones = await getCustomMilestones();
  milestones.push(milestone);
  await updateSettings('customMilestones', milestones);
  return milestones;
}

/**
 * 更新自定义名场面
 */
export async function updateCustomMilestone(id, updates) {
  const milestones = await getCustomMilestones();
  const index = milestones.findIndex(m => m.id === id);
  if (index === -1) throw new Error('名场面不存在');
  milestones[index] = { ...milestones[index], ...updates };
  await updateSettings('customMilestones', milestones);
  return milestones;
}

/**
 * 删除自定义名场面
 */
export async function deleteCustomMilestone(id) {
  const milestones = await getCustomMilestones();
  const filtered = milestones.filter(m => m.id !== id);
  await updateSettings('customMilestones', filtered);
  return filtered;
}

/**
 * 获取自定义心情列表
 */
export async function getCustomMoods() {
  const settings = await getSettings();
  return settings.customMoods || [];
}

/**
 * 添加自定义心情
 */
export async function addCustomMood(mood) {
  const moods = await getCustomMoods();
  moods.push(mood);
  await updateSettings('customMoods', moods);
  return moods;
}

/**
 * 更新自定义心情
 */
export async function updateCustomMood(id, updates) {
  const moods = await getCustomMoods();
  const index = moods.findIndex(m => m.id === id);
  if (index === -1) throw new Error('心情不存在');
  moods[index] = { ...moods[index], ...updates };
  await updateSettings('customMoods', moods);
  return moods;
}

/**
 * 删除自定义心情
 */
export async function deleteCustomMood(id) {
  const moods = await getCustomMoods();
  const filtered = moods.filter(m => m.id !== id);
  await updateSettings('customMoods', filtered);
  return filtered;
}

// ==================== 主题操作 ====================

/**
 * 应用主题预设
 */
export function applyThemePreset(preset) {
  const colors = {
    pink: { primary: '#EC4899', primaryLight: '#FDF2F8' },
    blue: { primary: '#3B82F6', primaryLight: '#EFF6FF' },
    green: { primary: '#10B981', primaryLight: '#F0FDF4' },
    purple: { primary: '#8B5CF6', primaryLight: '#F5F3FF' },
  };
  const color = colors[preset] || colors.pink;
  document.documentElement.style.setProperty('--primary-color', color.primary);
  document.documentElement.style.setProperty('--primary-light', color.primaryLight);
}

/**
 * 应用自定义主题色
 */
export function applyCustomTheme(color) {
  document.documentElement.style.setProperty('--primary-color', color);
  // 生成浅色版本（简单的透明度处理）
  document.documentElement.style.setProperty('--primary-light', color + '15');
}

// ==================== 示例数据初始化 ====================

/**
 * 检查并初始化示例数据
 */
export async function checkAndInitSampleData(userId) {
  const settings = await getSettings();
  if (settings.sampleDataInited) return;
  
  const babies = await getBabiesByUser(userId);
  if (babies.length === 0) {
    // 添加示例宝宝
    const baby = await addBaby({
      name: '小宝宝',
      nickname: '贝贝',
      birthDate: new Date().toISOString(),
      gender: 'unknown',
      userId: userId,
      avatar: null,
    });
    
    // 添加一条示例动态
    await addMoment({
      babyId: baby.id,
      type: 'diary',
      content: '欢迎来到宝贝时光！开始记录宝宝的成长点滴吧~',
      date: new Date().toISOString(),
      photos: [],
      mood: null,
      milestone: null,
    });
    
    await updateSettings('sampleDataInited', true);
    await updateSettings('currentBabyId', baby.id);
  }
}


// ==================== 导出功能 ====================

/**
 * 导出所有数据（用于导出为ZIP）
 */
export async function exportAllData() {
  try {
    const babies = await getAllBabies();
    const currentBaby = await getCurrentBaby();
    
    let allMoments = [];
    let allCapsules = [];
    let allGrowthRecords = [];
    
    if (currentBaby?.id) {
      allMoments = await getAllMomentsByBaby(currentBaby.id);
      allCapsules = await getCapsulesByBaby(currentBaby.id);
      allGrowthRecords = await getGrowthRecordsByBaby(currentBaby.id);
    }
    
    const settings = await getSettings();
    const milestones = await getCustomMilestones();
    const moods = await getCustomMoods();
    
    return {
      data: {
        babies,
        currentBaby,
        moments: allMoments,
        capsules: allCapsules,
        growthRecords: allGrowthRecords,
        settings,
        customMilestones: milestones,
        customMoods: moods,
      },
      exportTime: new Date().toISOString(),
      version: '1.0.0'
    };
  } catch (error) {
    console.error('exportAllData failed:', error);
    return {
      data: {},
      exportTime: new Date().toISOString(),
      version: '1.0.0',
      error: error.message
    };
  }
}



// ==================== 导入相关功能占位实现 ====================

/**
 * 从ZIP导入数据（占位）
 */
export async function importAllData(zipData) {
  console.warn('importAllData is not fully implemented');
  return { success: false, message: '功能开发中' };
}

/**
 * 从ZIP导入数据V2版本（占位）
 */
export async function importAllDataV2(zipData) {
  console.warn('importAllDataV2 is not fully implemented');
  return { success: false, message: '功能开发中' };
}

/**
 * 从ZIP流导入数据（占位）
 */
export async function importFromZipStream(stream) {
  console.warn('importFromZipStream is not fully implemented');
  return { success: false, message: '功能开发中' };
}

/**
 * 导入多个文件（占位）
 */
export async function importMultipleFiles(files) {
  console.warn('importMultipleFiles is not fully implemented');
  return { success: false, message: '功能开发中' };
}

/**
 * 清空所有数据（占位）
 */
export async function clearAllData() {
  console.warn('clearAllData is not fully implemented');
  return { success: false, message: '功能开发中' };
}



/**
 * 获取成长报告统计（占位）
 */
export async function getGrowthReportStats(babyId) {
  console.warn('getGrowthReportStats is not fully implemented');
  return {
    totalMoments: 0,
    totalPhotos: 0,
    totalVideos: 0,
    totalAudios: 0,
    milestoneCount: 0,
    thisMonthMoments: 0,
  };
}




// ==================== 回收站相关功能 ====================

/**
 * 获取已删除的动态（占位）
 */
export async function getDeletedMomentsByBaby(babyId) {
  console.warn('getDeletedMomentsByBaby is not fully implemented');
  return [];
}

/**
 * 恢复动态（占位）
 */
export async function restoreMoment(momentId) {
  console.warn('restoreMoment is not fully implemented');
  return { success: true };
}

/**
 * 永久删除动态（占位）
 */
export async function deleteMomentPermanently(momentId) {
  console.warn('deleteMomentPermanently is not fully implemented');
  return { success: true };
}

/**
 * 清空回收站（占位）
 */
export async function emptyRecycleBin(babyId) {
  console.warn('emptyRecycleBin is not fully implemented');
  return { success: true };
}




// ==================== 用户注册相关功能 ====================

/**
 * 预设头像列表
 */
export const PRESET_AVATARS = [
  '👶', '👧', '👦', '🧒', '👶🏻', '👶🏼', '👶🏽', '👶🏾', '👶🏿',
  '🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🦁', '🐯', '🐨'
];

/**
 * 注册用户（占位）
 */
export async function registerUser(userData) {
  console.warn('registerUser is not fully implemented');
  return { success: true, user: { id: 'temp-id', ...userData } };
}

/**
 * 更新安全问题（占位）
 */
export async function updateSecurityQuestion(userId, question, answer) {
  console.warn('updateSecurityQuestion is not fully implemented');
  return { success: true };
}


