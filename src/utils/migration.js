/**
 * v1 -> v2 数据迁移模块
 * 
 * v1 数据结构（按身份直接存储数据）：
 * {
 *   "无敌奶爸": { timeline: [...], growth: {...}, virtualTime: [...] },
 *   "温柔宝妈": { timeline: [...], growth: {...}, virtualTime: [...] }
 * }
 * 
 * v2 数据结构（按身份+双账号隔离）：
 * {
 *   "无敌奶爸": {
 *     accounts: {
 *       "default": { 系统账号豆芽数据 },
 *       "user": { 老用户的原有数据迁移到这里 }
 *     },
 *     currentAccountId: "user"
 *   }
 * }
 */

// localStorage 键名
const V1_DATA_KEY = 'baobaoshiguang_data';
const DATA_VERSION_KEY = 'dataVersion';
const CURRENT_IDENTITY_KEY = 'currentIdentity';

/**
 * 检测是否为 v1 旧版数据结构
 * @returns {boolean}
 */
export function isV1Data() {
  const v1Data = localStorage.getItem(V1_DATA_KEY);
  if (!v1Data) return false;
  
  try {
    const parsed = JSON.parse(v1Data);
    // v1 数据的特征：直接按身份名称存储，且包含 timeline/growth/virtualTime 字段
    const identities = Object.keys(parsed);
    if (identities.length === 0) return false;
    
    const firstIdentity = parsed[identities[0]];
    return firstIdentity && (
      Array.isArray(firstIdentity.timeline) ||
      Array.isArray(firstIdentity.growth) ||
      Array.isArray(firstIdentity.virtualTime)
    );
  } catch (e) {
    return false;
  }
}

/**
 * 检测是否已迁移（检查版本标记）
 * @returns {boolean}
 */
export function isMigrated() {
  return localStorage.getItem(DATA_VERSION_KEY) === '2';
}

/**
 * 获取 v1 数据
 * @returns {Object|null}
 */
export function getV1Data() {
  try {
    const data = localStorage.getItem(V1_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('解析 v1 数据失败:', e);
    return null;
  }
}

/**
 * 获取当前登录身份
 * @returns {string|null}
 */
export function getCurrentIdentity() {
  return localStorage.getItem(CURRENT_IDENTITY_KEY);
}

/**
 * 创建 v2 数据结构（单个身份）
 * @param {string} identityName - 身份名称（如"无敌奶爸"）
 * @param {Object} v1IdentityData - v1 中该身份的数据
 * @returns {Object} v2 格式的该身份数据
 */
function createV2IdentityData(identityName, v1IdentityData) {
  // 创建系统账号（豆芽示例数据）
  const defaultAccount = createSystemAccount();
  
  // 创建用户账号（迁移 v1 数据）
  const userAccount = createUserAccountFromV1(v1IdentityData);
  
  return {
    accounts: {
      'default': defaultAccount,
      'user': userAccount
    },
    currentAccountId: 'user' // 默认显示用户自己的账号
  };
}

/**
 * 创建系统账号（豆芽示例数据）
 * @returns {Object}
 */
function createSystemAccount() {
  const now = new Date();
  
  // 豆芽的出生日期（假设比当前日期早1年）
  const beanSproutBirth = new Date(now);
  beanSproutBirth.setFullYear(beanSproutBirth.getFullYear() - 1);
  beanSproutBirth.setMonth(beanSproutBirth.getMonth() - 3); // 1岁3个月
  
  return {
    id: 'default',
    name: '豆芽',
    nickname: '豆芽',
    avatar: null,
    birthDate: beanSproutBirth.toISOString(),
    gender: 'girl',
    isSystem: true,
    createdAt: now.toISOString(),
    // 5条示例动态
    timeline: [
      {
        id: 'sys-1',
        type: 'photo',
        date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 3个月前
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
        date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 2个月前
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
        date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 1个月前
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
        date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2周前
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
        date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1周前
        content: '今天豆芽学会了用勺子自己吃饭，虽然弄得满脸都是，但是特别有成就感！',
        photos: ['https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=400'],
        mood: 'excited',
        weather: 'sunny',
        milestone: 'learning',
        milestoneLabel: '学会自己吃饭',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    // 成长数据
    growth: {
      height: 75, // cm
      weight: 9.5, // kg
      records: []
    },
    // 虚拟时光
    virtualTime: []
  };
}

/**
 * 从 v1 数据创建用户账号
 * @param {Object} v1Data - v1 数据中的身份数据
 * @returns {Object}
 */
function createUserAccountFromV1(v1Data) {
  const now = new Date();
  
  // 提取宝宝信息
  let babyInfo = {
    name: '我的宝宝',
    nickname: '',
    avatar: null,
    birthDate: getDefaultBirthDate(),
    gender: 'girl'
  };
  
  // 尝试从 v1 数据中获取宝宝信息
  if (v1Data.growth && v1Data.growth.babyInfo) {
    babyInfo = { ...babyInfo, ...v1Data.growth.babyInfo };
  } else if (v1Data.growth && v1Data.growth.name) {
    babyInfo.name = v1Data.growth.name || '我的宝宝';
    babyInfo.birthDate = v1Data.growth.birthDate || getDefaultBirthDate();
    babyInfo.gender = v1Data.growth.gender || 'girl';
  }
  
  // 迁移 timeline 动态
  let timeline = [];
  if (Array.isArray(v1Data.timeline)) {
    timeline = v1Data.timeline.map((item, index) => ({
      ...item,
      id: item.id || `migrated-${Date.now()}-${index}`
    }));
  }
  
  // 迁移成长数据
  let growth = {
    height: null,
    weight: null,
    records: []
  };
  if (v1Data.growth) {
    growth = {
      height: v1Data.growth.height || null,
      weight: v1Data.growth.weight || null,
      records: v1Data.growth.records || []
    };
  }
  
  // 迁移虚拟时光
  let virtualTime = [];
  if (Array.isArray(v1Data.virtualTime)) {
    virtualTime = v1Data.virtualTime;
  }
  
  return {
    id: 'user',
    name: babyInfo.name,
    nickname: babyInfo.nickname || babyInfo.name,
    avatar: babyInfo.avatar,
    birthDate: babyInfo.birthDate,
    gender: babyInfo.gender,
    isSystem: false,
    createdAt: now.toISOString(),
    timeline,
    growth,
    virtualTime
  };
}

/**
 * 获取默认出生日期（假设1岁）
 * @returns {string}
 */
function getDefaultBirthDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  date.setMonth(date.getMonth() - 3);
  return date.toISOString();
}

/**
 * 执行 v1 -> v2 迁移
 * @returns {Object} 迁移结果 { success: boolean, message: string, migratedCount: number }
 */
export async function migrateV1ToV2() {
  // 检查是否已迁移
  if (isMigrated()) {
    return { success: true, message: '已迁移，跳过', migratedCount: 0 };
  }
  
  // 检查是否有 v1 数据
  if (!isV1Data()) {
    // 没有 v1 数据，标记为已迁移（避免后续重复检查）
    localStorage.setItem(DATA_VERSION_KEY, '2');
    return { success: true, message: '无 v1 数据，已标记版本', migratedCount: 0 };
  }
  
  try {
    const v1Data = getV1Data();
    if (!v1Data) {
      return { success: false, message: '无法解析 v1 数据', migratedCount: 0 };
    }
    
    const identities = Object.keys(v1Data);
    const migrationResult = {};
    let migratedCount = 0;
    
    // 获取当前登录身份
    const currentIdentity = getCurrentIdentity();
    
    for (const identityName of identities) {
      const identityData = v1Data[identityName];
      migrationResult[identityName] = createV2IdentityData(identityName, identityData);
      migratedCount++;
    }
    
    // 保存迁移后的数据到 localStorage
    localStorage.setItem('v2Data', JSON.stringify(migrationResult));
    
    // 设置当前身份
    if (currentIdentity && migrationResult[currentIdentity]) {
      localStorage.setItem('currentIdentity', currentIdentity);
      localStorage.setItem('currentAccountId', 'user');
    } else if (identities.length > 0) {
      // 如果没有当前身份，设置第一个为当前
      localStorage.setItem('currentIdentity', identities[0]);
      localStorage.setItem('currentAccountId', 'user');
    }
    
    // 标记迁移完成
    localStorage.setItem(DATA_VERSION_KEY, '2');
    
    // 可选：保留 v1 数据备份
    // localStorage.setItem('v1DataBackup', JSON.stringify(v1Data));
    
    // 删除旧版数据结构
    localStorage.removeItem(V1_DATA_KEY);
    
    return {
      success: true,
      message: `成功迁移 ${migratedCount} 个身份的数据`,
      migratedCount,
      currentIdentity: localStorage.getItem('currentIdentity'),
      currentAccountId: localStorage.getItem('currentAccountId')
    };
    
  } catch (error) {
    console.error('迁移失败:', error);
    return { success: false, message: '迁移失败: ' + error.message, migratedCount: 0 };
  }
}

/**
 * 获取 v2 数据
 * @returns {Object|null}
 */
export function getV2Data() {
  try {
    const data = localStorage.getItem('v2Data');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('解析 v2 数据失败:', e);
    return null;
  }
}

/**
 * 保存 v2 数据
 * @param {Object} data - v2 数据
 */
export function saveV2Data(data) {
  localStorage.setItem('v2Data', JSON.stringify(data));
}

/**
 * 更新单个身份的数据
 * @param {string} identityName - 身份名称
 * @param {Object} identityData - 该身份的新数据
 */
export function updateV2Identity(identityName, identityData) {
  const v2Data = getV2Data() || {};
  v2Data[identityName] = identityData;
  saveV2Data(v2Data);
}

/**
 * 获取指定身份和账号的数据
 * @param {string} identityName - 身份名称
 * @param {string} accountId - 账号ID (default/user)
 * @returns {Object|null}
 */
export function getV2AccountData(identityName, accountId) {
  const v2Data = getV2Data();
  if (!v2Data || !v2Data[identityName]) return null;
  
  const identityData = v2Data[identityName];
  if (!identityData.accounts || !identityData.accounts[accountId]) return null;
  
  return identityData.accounts[accountId];
}

/**
 * 更新指定身份和账号的数据
 * @param {string} identityName - 身份名称
 * @param {string} accountId - 账号ID
 * @param {Object} accountData - 账号数据
 */
export function updateV2AccountData(identityName, accountId, accountData) {
  const v2Data = getV2Data() || {};
  
  if (!v2Data[identityName]) {
    v2Data[identityName] = {
      accounts: {},
      currentAccountId: accountId
    };
  }
  
  if (!v2Data[identityName].accounts) {
    v2Data[identityName].accounts = {};
  }
  
  v2Data[identityName].accounts[accountId] = {
    ...v2Data[identityName].accounts[accountId],
    ...accountData
  };
  
  saveV2Data(v2Data);
}

/**
 * 切换当前账号
 * @param {string} identityName - 身份名称
 * @param {string} accountId - 账号ID
 */
export function switchV2Account(identityName, accountId) {
  const v2Data = getV2Data();
  if (!v2Data || !v2Data[identityName]) return false;
  
  v2Data[identityName].currentAccountId = accountId;
  saveV2Data(v2Data);
  
  localStorage.setItem('currentIdentity', identityName);
  localStorage.setItem('currentAccountId', accountId);
  
  // ✅ 修复：触发自定义事件，通知页面账号已切换
  // 确保TimelinePage等组件能及时响应账号变化并重新加载对应数据
  try {
    const event = new CustomEvent('account-switched', {
      detail: { identityName, accountId, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  } catch (e) {
    console.warn('触发账号切换事件失败:', e);
  }
  
  return true;
}

/**
 * 获取当前选中的账号数据
 * @returns {Object|null} { identityName, accountId, accountData, identityData }
 */
export function getCurrentV2Account() {
  const identityName = getCurrentIdentity();
  const accountId = localStorage.getItem('currentAccountId') || 'user';
  
  if (!identityName) return null;
  
  const v2Data = getV2Data();
  if (!v2Data || !v2Data[identityName]) return null;
  
  const identityData = v2Data[identityName];
  const currentAccountId = identityData.currentAccountId || accountId;
  const accountData = identityData.accounts?.[currentAccountId] || null;
  
  return {
    identityName,
    accountId: currentAccountId,
    accountData,
    identityData
  };
}
