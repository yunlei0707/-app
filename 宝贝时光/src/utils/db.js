/**
 * IndexedDB 数据库操作模块
 * 使用 idb 库封装数据库操作，支持宝宝档案、动态记录、时空胶囊的增删改查
 */

import { openDB } from 'idb';

const DB_NAME = 'BabyTimeDB';
const DB_VERSION = 1;

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
 * 获取某个宝宝的所有动态
 */
export async function getMomentsByBaby(babyId) {
  const db = await initDB();
  const moments = await db.getAllFromIndex('moments', 'babyId', babyId);
  // 按日期倒序排列
  return moments.sort((a, b) => new Date(b.date) - new Date(a.date));
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
  await db.delete('moments', id);
  return true;
}

/**
 * 根据里程碑标签筛选动态
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
    currentBabyId: settingsMap.currentBabyId || null,
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

// ==================== 数据导出 ====================

/**
 * 导出所有数据为 JSON
 */
export async function exportAllData() {
  const db = await initDB();
  const [babies, moments, capsules, settings] = await Promise.all([
    db.getAll('babies'),
    db.getAll('moments'),
    db.getAll('capsules'),
    db.getAll('settings'),
  ]);
  
  return {
    exportTime: new Date().toISOString(),
    version: '1.0.0',
    data: { babies, moments, capsules, settings },
  };
}

// ==================== 初始化示例数据 ====================

/**
 * 检查是否需要初始化示例数据
 */
export async function checkAndInitSampleData() {
  const babies = await getAllBabies();
  if (babies.length === 0) {
    // 创建默认宝宝
    const defaultBaby = await addBaby({
      name: '小豆芽',
      nickname: '豆芽',
      avatar: null,
      birthDate: getDefaultBirthDate(),
      gender: 'girl',
    });

    // 创建示例动态
    const now = new Date();
    
    // 示例动态1：三个月前
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

    // 示例动态2：一个月前
    const date2 = new Date(now);
    date2.setMonth(date2.getMonth() - 1);
    
    await addMoment({
      babyId: defaultBaby.id,
      type: 'diary',
      date: date2.toISOString(),
      content: '今天学会叫"妈妈"了！虽然还不太清晰，但是听到的那一刻真的太感动了。',
      mood: 'touched',
      weather: 'cloudy',
      milestone: 'growth',
      milestoneLabel: '学会说话',
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
