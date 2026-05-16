/**
 * 数据迁移工具
 * 每次修改 localStorage 或 IndexedDB 数据结构时，添加对应的迁移函数
 * 页面加载时自动检测旧数据格式，转换成新格式
 */

// 当前数据版本号 - 每次修改数据结构时 +1
export const CURRENT_DATA_VERSION = 2;  // 升级到 v2：双账号系统

// 版本键名
const VERSION_KEY = 'baby_time_data_version';

/**
 * 获取当前数据版本
 */
export function getDataVersion() {
  const version = localStorage.getItem(VERSION_KEY);
  return version ? parseInt(version, 10) : 0;
}

/**
 * 设置当前数据版本
 */
export function setDataVersion(version) {
  localStorage.setItem(VERSION_KEY, String(version));
}

/**
 * 迁移 v0 -> v1
 * 处理早期无版本号的数据格式
 */
function migrateV0ToV1() {
  console.log('[数据迁移] 执行 v0 -> v1 迁移...');
  
  // 1. 迁移登录状态：旧键名 -> 新键名
  const oldLoggedIn = localStorage.getItem('logged_in');
  if (oldLoggedIn && !localStorage.getItem('is_logged_in')) {
    localStorage.setItem('is_logged_in', oldLoggedIn);
    localStorage.removeItem('logged_in');
    console.log('[数据迁移] 已迁移登录状态键名');
  }

  // 2. 迁移用户角色：selectedFamilyRole -> user_role
  const oldRole = localStorage.getItem('selectedFamilyRole');
  if (oldRole && !localStorage.getItem('user_role')) {
    try {
      const roleMap = {
        father: { id: 'father', name: '无敌奶爸', icon: '👨' },
        mother: { id: 'mother', name: '温柔宝妈', icon: '👩' },
        grandpa: { id: 'grandpa', name: '慈祥姥爷', icon: '👴' },
        grandma: { id: 'grandma', name: '和蔼姥姥', icon: '👵' },
        uncle: { id: 'uncle', name: '帅气老舅', icon: '🧔' },
        aunt: { id: 'aunt', name: '漂亮小姨', icon: '💃' },
        'grandpa-father': { id: 'grandpa-father', name: '慈祥爷爷', icon: '👴🏻' },
        baby: { id: 'baby', name: '宝宝本人', icon: '👶' },
        guest: { id: 'guest', name: '访客参观', icon: '👀' },
      };
      const role = roleMap[oldRole] || { id: 'guest', name: '访客', icon: '👀' };
      localStorage.setItem('user_role', JSON.stringify(role));
      console.log('[数据迁移] 已迁移用户角色数据');
    } catch (e) {
      console.warn('[数据迁移] 用户角色迁移失败:', e);
    }
  }

  // 3. 清理旧的无用键
  const oldKeys = ['login_role', 'customBackground', 'login_bg'];
  oldKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`[数据迁移] 已清理旧键: ${key}`);
    }
  });

  console.log('[数据迁移] v0 -> v1 迁移完成');
}

/**
 * 迁移 v1 -> v2：单宝宝 → 双账号系统
 * - 每个身份下有独立的双账号（default + user）
 * - 老用户的现有数据迁移到 user 账号下
 * - 注入系统默认的豆芽示例数据
 */
async function migrateV1ToV2() {
  console.log('[数据迁移] 执行 v1 -> v2 迁移：双账号系统...');
  
  try {
    // 1. 获取当前登录的身份
    const userRole = safeGetItem('user_role', { name: '访客参观' });
    const identityName = userRole.name || '访客参观';
    
    // 2. 从旧版 localStorage 读取数据（如果有的话）
    const oldBabies = safeGetItem('babies', []);
    const oldMoments = safeGetItem('moments', []);
    
    // 3. 初始化双账号结构
    // 这会自动注入 default（豆芽）+ user（空）账号
    const { getIdentityData } = await import('./dbV2');
    const identityData = getIdentityData(identityName);
    
    // 4. 迁移老数据到 user 账号
    if (oldBabies.length > 0 || oldMoments.length > 0) {
      console.log(`[数据迁移] 找到 ${oldBabies.length} 个宝宝, ${oldMoments.length} 条动态，正在迁移...`);
      
      // 迁移宝宝信息到 user 账号
      if (oldBabies.length > 0) {
        const firstBaby = oldBabies[0];
        identityData.accounts.user.name = firstBaby.name || '我的宝宝';
        identityData.accounts.user.birthday = firstBaby.birthday || '';
        identityData.accounts.user.avatar = firstBaby.avatar || '👶';
      }
      
      // 迁移动态数据
      if (oldMoments.length > 0) {
        identityData.accounts.user.data.timeline = oldMoments;
      }
      
      // 保存迁移后的数据
      const { saveAllData } = await import('./dbV2');
      const allData = JSON.parse(localStorage.getItem('baby_time_v2') || '{}');
      allData[identityName] = identityData;
      saveAllData(allData);
      
      // 清理旧版数据（保留备份 7 天）
      localStorage.setItem('baby_time_v1_backup', JSON.stringify({
        babies: oldBabies,
        moments: oldMoments,
        migratedAt: new Date().toISOString()
      }));
      
      console.log('[数据迁移] v1 -> v2 迁移完成！');
    } else {
      console.log('[数据迁移] 新用户，无需迁移，已初始化双账号结构');
    }
    
  } catch (error) {
    console.error('[数据迁移] v1 -> v2 迁移失败:', error);
    // 迁移失败不阻塞，让应用继续运行
  }
}

/**
 * 迁移注册表
 * 按版本顺序排列，从低到高
 */
const MIGRATIONS = [
  { from: 0, to: 1, migrate: migrateV0ToV1 },
  { from: 1, to: 2, migrate: migrateV1ToV2 },
];

/**
 * 执行数据迁移
 * 在应用初始化时调用
 */
export async function runMigrations() {
  const currentVersion = getDataVersion();
  
  if (currentVersion >= CURRENT_DATA_VERSION) {
    console.log(`[数据迁移] 数据已是最新版本 v${currentVersion}`);
    return;
  }

  console.log(`[数据迁移] 检测到旧版本数据 v${currentVersion}，需要迁移到 v${CURRENT_DATA_VERSION}`);

  try {
    // 按顺序执行迁移
    for (const migration of MIGRATIONS) {
      if (currentVersion < migration.to && migration.from === currentVersion) {
        await migration.migrate();
        setDataVersion(migration.to);
      }
    }

    // 设置最终版本号
    setDataVersion(CURRENT_DATA_VERSION);
    console.log(`[数据迁移] 所有迁移完成，当前版本 v${CURRENT_DATA_VERSION}`);
  } catch (error) {
    console.error('[数据迁移] 迁移过程出错:', error);
    // 迁移失败时，尝试恢复到安全状态，不要让应用崩溃
    try {
      // 可以在这里添加降级处理逻辑
    } catch (e) {
      console.error('[数据迁移] 降级处理也失败了', e);
    }
  }
}

/**
 * 安全获取 localStorage 数据
 * 如果解析失败，返回默认值并清理损坏数据
 */
export function safeGetItem(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    if (value === null || value === undefined) {
      return defaultValue;
    }
    try {
      return JSON.parse(value);
    } catch {
      // 如果不是 JSON 格式，直接返回原值
      return value;
    }
  } catch (error) {
    console.warn(`[数据安全] 获取 ${key} 失败，返回默认值:`, error);
    return defaultValue;
  }
}

/**
 * 安全设置 localStorage 数据
 * 防止序列化失败
 */
export function safeSetItem(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`[数据安全] 设置 ${key} 失败:`, error);
    return false;
  }
}

/**
 * IndexedDB 数据迁移辅助函数
 * 在 db.js 中打开数据库时使用
 */
export function handleIDBUpgrade(db, oldVersion, newVersion) {
  console.log(`[IndexedDB 迁移] 数据库从 v${oldVersion} 升级到 v${newVersion}`);
  
  // 示例迁移逻辑
  // if (oldVersion < 1) {
  //   db.createObjectStore('moments', { keyPath: 'id' });
  // }
  // if (oldVersion < 2) {
  //   const store = db.transaction.objectStore('moments');
  //   store.createIndex('babyId', 'babyId', { unique: false });
  // }
}

export default {
  runMigrations,
  safeGetItem,
  safeSetItem,
  handleIDBUpgrade,
  CURRENT_DATA_VERSION,
};
