/**
 * P0上线防护：多账号/设备污染防护
 * 功能：确保每条数据带user_id，查询必过滤，不同用户数据隔离
 */

// ========== 用户数据隔离系统 ==========

let currentUserId = null;
let isInitialized = false;

/**
 * 初始化用户隔离系统
 * @param {string} userId - 当前登录用户ID
 */
export function initUserIsolation(userId) {
  if (!userId) {
    throw new Error('初始化用户隔离系统失败：userId不能为空');
  }
  
  currentUserId = userId;
  isInitialized = true;
  
  console.log(`[UserIsolation] 用户隔离系统已初始化，用户ID: ${userId}`);
  
  // 验证现有数据的用户归属
  validateExistingData(userId);
  
  return true;
}

/**
 * 获取当前用户ID（带校验）
 */
export function getCurrentUserId() {
  if (!isInitialized || !currentUserId) {
    console.warn('[UserIsolation] 用户隔离系统未初始化，可能导致数据污染！');
    return null;
  }
  return currentUserId;
}

/**
 * 检查用户ID是否匹配（用于数据操作前校验）
 */
export function checkUserId(dataUserId) {
  const currentId = getCurrentUserId();
  
  if (!currentId) {
    console.error('[UserIsolation] 用户未登录，禁止数据操作');
    return false;
  }
  
  if (dataUserId && dataUserId !== currentId) {
    console.error(`[UserIsolation] 用户ID不匹配：数据归属 ${dataUserId}，当前用户 ${currentId}`);
    return false;
  }
  
  return true;
}

/**
 * 给数据添加用户ID标记
 */
export function withUserId(data) {
  const userId = getCurrentUserId();
  
  if (!userId) {
    throw new Error('无法标记用户ID：用户未登录');
  }
  
  return {
    ...data,
    user_id: userId,
  };
}

/**
 * 创建带用户过滤的查询条件
 */
export function buildUserFilter(additionalFilter = {}) {
  const userId = getCurrentUserId();
  
  if (!userId) {
    console.warn('[UserIsolation] 用户未登录，查询可能返回空');
    return { user_id: '__NO_USER__' }; // 返回一个不可能匹配的值
  }
  
  return {
    ...additionalFilter,
    user_id: userId,
  };
}

/**
 * 验证数据的用户归属
 * @returns {boolean} 是否属于当前用户
 */
export function belongsToCurrentUser(data) {
  if (!data) return false;
  
  // 如果数据没有user_id，视为无主数据（谨慎处理）
  if (!data.user_id) {
    console.warn('[UserIsolation] 数据无user_id标记，可能存在历史数据');
    return true; // 暂时放行，后续可改为严格模式
  }
  
  return checkUserId(data.user_id);
}

/**
 * 验证现有数据的用户归属
 */
function validateExistingData(userId) {
  try {
    // 检查localStorage中的v2账号数据
    const keys = Object.keys(localStorage);
    const babyTimeKeys = keys.filter(k => 
      k.includes('baby') || k.includes('moment') || k.includes('v2')
    );
    
    console.log(`[UserIsolation] 检查 ${babyTimeKeys.length} 个本地存储项`);
    
    // 为无user_id的历史数据标记当前用户
    babyTimeKeys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && typeof data === 'object' && !data.user_id) {
          data.user_id = userId;
          localStorage.setItem(key, JSON.stringify(data));
          console.log(`[UserIsolation] 已为历史数据 ${key} 标记用户`);
        }
      } catch (e) {
        // 忽略无法解析的项
      }
    });
    
  } catch (e) {
    console.error('[UserIsolation] 验证现有数据失败:', e);
  }
}

/**
 * 用户登出时清理
 */
export function cleanupOnLogout() {
  currentUserId = null;
  isInitialized = false;
  console.log('[UserIsolation] 用户隔离系统已清理');
}

/**
 * 检查是否已初始化
 */
export function isUserIsolationReady() {
  return isInitialized && !!currentUserId;
}

/**
 * Supabase查询包装器（自动添加user_id过滤）
 */
export function createSupabaseQuery(supabaseClient, tableName) {
  return {
    select: (columns = '*') => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.error('[UserIsolation] 禁止未登录查询');
        return { data: [], error: new Error('用户未登录') };
      }
      
      return supabaseClient
        .from(tableName)
        .select(columns)
        .eq('user_id', userId);
    },
    
    insert: (data) => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.error('[UserIsolation] 禁止未登录插入');
        return { data: null, error: new Error('用户未登录') };
      }
      
      const dataWithUser = Array.isArray(data)
        ? data.map(item => withUserId(item))
        : withUserId(data);
        
      return supabaseClient
        .from(tableName)
        .insert(dataWithUser);
    },
    
    update: (data) => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.error('[UserIsolation] 禁止未登录更新');
        return { data: null, error: new Error('用户未登录') };
      }
      
      return supabaseClient
        .from(tableName)
        .update(data)
        .eq('user_id', userId);
    },
    
    delete: () => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.error('[UserIsolation] 禁止未登录删除');
        return { data: null, error: new Error('用户未登录') };
      }
      
      return supabaseClient
        .from(tableName)
        .delete()
        .eq('user_id', userId);
    },
  };
}

/**
 * IndexedDB查询包装器（自动过滤非当前用户数据）
 */
export function filterByUser(results) {
  const userId = getCurrentUserId();
  
  if (!userId) {
    console.warn('[UserIsolation] 用户未登录，返回空结果');
    return [];
  }
  
  if (!Array.isArray(results)) {
    return results;
  }
  
  return results.filter(item => {
    // 没有user_id的项视为历史数据，暂时放行
    if (!item.user_id) return true;
    return item.user_id === userId;
  });
}

/**
 * 断言用户隔离已就绪
 */
export function assertUserIsolationReady() {
  if (!isUserIsolationReady()) {
    throw new Error('用户隔离系统未初始化，数据操作被阻止');
  }
  return true;
}

/**
 * 创建用户隔离的存储包装器
 */
export function createUserScopedStorage(prefix = 'user_data') {
  return {
    getItem: (key) => {
      const userId = getCurrentUserId();
      if (!userId) return null;
      
      const scopedKey = `${prefix}_${userId}_${key}`;
      return localStorage.getItem(scopedKey);
    },
    
    setItem: (key, value) => {
      const userId = getCurrentUserId();
      if (!userId) throw new Error('用户未登录');
      
      const scopedKey = `${prefix}_${userId}_${key}`;
      localStorage.setItem(scopedKey, value);
    },
    
    removeItem: (key) => {
      const userId = getCurrentUserId();
      if (!userId) return;
      
      const scopedKey = `${prefix}_${userId}_${key}`;
      localStorage.removeItem(scopedKey);
    },
    
    clearAll: () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      
      const userPrefix = `${prefix}_${userId}_`;
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith(userPrefix)) {
          localStorage.removeItem(key);
        }
      });
    },
  };
}

// 默认导出
export default {
  initUserIsolation,
  getCurrentUserId,
  checkUserId,
  withUserId,
  buildUserFilter,
  belongsToCurrentUser,
  cleanupOnLogout,
  isUserIsolationReady,
  assertUserIsolationReady,
  createSupabaseQuery,
  filterByUser,
  createUserScopedStorage,
};
