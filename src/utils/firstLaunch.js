/**
 * P1上线防护：首次安装/空数据处理
 * 功能：新用户首次安装时的初始化逻辑和空数据保护
 */

import { safeStorage, safeJSONParse } from './dataRecovery';
import { getCurrentUTC } from './timeSync';

// ========== 配置 ==========
const CONFIG = {
  // 首次安装标记
  FIRST_LAUNCH_KEY: 'first_launch_completed',
  // 应用版本标记
  APP_VERSION_KEY: 'app_version',
  // 欢迎状态
  ONBOARDING_KEY: 'onboarding_completed',
};

// ========== 状态 ==========
let isFirstLaunch = false;
let isFreshInstall = false;

/**
 * 检查是否是首次启动
 * @returns {Object} 首次启动信息
 */
export function checkFirstLaunch() {
  const firstLaunchCompleted = safeStorage.getItem(CONFIG.FIRST_LAUNCH_KEY, false);
  
  isFirstLaunch = !firstLaunchCompleted;
  isFreshInstall = isFirstLaunch && localStorage.length < 10; // 几乎没有数据就是全新安装
  
  if (isFirstLaunch) {
    console.log('[FirstLaunch] 🎉 检测到首次启动应用');
    if (isFreshInstall) {
      console.log('[FirstLaunch] 📱 这是全新安装，无任何历史数据');
    } else {
      console.log('[FirstLaunch] 📱 首次启动，但存在历史数据（可能是迁移过来的）');
    }
  }
  
  return {
    isFirstLaunch,
    isFreshInstall,
    hasExistingData: localStorage.length > 10,
  };
}

/**
 * 执行首次启动初始化
 */
export function performFirstLaunchInit(appVersion) {
  console.log('[FirstLaunch] 执行首次启动初始化...');
  
  // 1. 标记首次启动已完成
  safeStorage.setItem(CONFIG.FIRST_LAUNCH_KEY, true);
  
  // 2. 记录应用版本
  if (appVersion) {
    safeStorage.setItem(CONFIG.APP_VERSION_KEY, appVersion);
  }
  
  // 3. 初始化空数据骨架
  initEmptyDataStructure();
  
  // 4. 记录初始化时间
  safeStorage.setItem('first_launch_time', getCurrentUTC());
  
  console.log('[FirstLaunch] ✅ 首次启动初始化完成');
  
  return {
    success: true,
    version: appVersion,
    initializedAt: getCurrentUTC(),
  };
}

/**
 * 初始化空数据骨架（防止空数据导致的异常）
 */
function initEmptyDataStructure() {
  // 确保v2账号数据结构存在
  const v2Account = safeStorage.getItem('v2_account', null);
  if (!v2Account) {
    safeStorage.setItem('v2_account', {
      identityName: '',
      accountId: '',
      accountData: {
        timeline: [],
        babies: [],
        growth: [],
      },
    });
    console.log('[FirstLaunch] 已初始化v2账号空数据结构');
  }
  
  // 确保同步状态存在
  const syncState = safeStorage.getItem('sync_state', null);
  if (!syncState) {
    safeStorage.setItem('sync_state', {
      lastSyncTime: null,
      status: 'idle',
      consecutiveFailures: 0,
    });
    console.log('[FirstLaunch] 已初始化同步状态空数据结构');
  }
  
  // 确保设置存在
  const settings = safeStorage.getItem('app_settings', null);
  if (!settings) {
    safeStorage.setItem('app_settings', {
      autoSync: true,
      wifiOnly: false,
      mediaQuality: 'high',
      theme: 'light',
      notifications: true,
    });
    console.log('[FirstLaunch] 已初始化设置空数据结构');
  }
}

/**
 * 检查是否是空数据状态（用于同步逻辑判断）
 */
export function isEmptyDataState() {
  // 检查是否有实际数据
  const v2Account = safeStorage.getItem('v2_account', null);
  const hasMoments = v2Account?.accountData?.timeline?.length > 0;
  const hasBabies = v2Account?.accountData?.babies?.length > 0;
  
  // 检查IndexedDB中是否有数据（这里简化处理，实际需要检查db.js）
  // 对于首次安装用户，localStorage也基本是空的
  
  return !hasMoments && !hasBabies;
}

/**
 * 获取首次启动的同步策略
 * 空数据状态下：优先从云端拉取，不主动推送
 * 有数据状态下：正常增量同步
 */
export function getFirstSyncStrategy() {
  if (isEmptyDataState()) {
    console.log('[FirstLaunch] 空数据状态，首次同步策略：优先从云端拉取');
    return {
      strategy: 'pull_first',
      pullOnly: true, // 只拉不推，防止覆盖云端数据
      fullSync: true, // 全量同步
      showProgress: true,
    };
  }
  
  console.log('[FirstLaunch] 有本地数据，正常同步策略');
  return {
    strategy: 'normal',
    pullOnly: false,
    fullSync: false,
    showProgress: true,
  };
}

/**
 * 检查是否需要显示欢迎引导
 */
export function needsOnboarding() {
  return !safeStorage.getItem(CONFIG.ONBOARDING_KEY, false);
}

/**
 * 完成欢迎引导
 */
export function completeOnboarding() {
  safeStorage.setItem(CONFIG.ONBOARDING_KEY, true);
  console.log('[FirstLaunch] 欢迎引导已完成');
}

/**
 * 处理账号登录后的空数据处理
 * 新登录用户可能本地空但云端有数据，这时候要小心处理
 */
export function handleEmptyDataOnLogin(userId) {
  console.log(`[FirstLaunch] 用户 ${userId} 登录，检查数据状态`);
  
  const isEmpty = isEmptyDataState();
  
  if (isEmpty) {
    console.log('[FirstLaunch] ⚠️  本地无数据，将尝试从云端拉取');
    return {
      shouldPullFromCloud: true,
      shouldWarnUser: true,
      message: '检测到您是首次在本设备登录，将同步您的云端数据...',
    };
  }
  
  console.log('[FirstLaunch] 本地已有数据，正常启动同步');
  return {
    shouldPullFromCloud: true,
    shouldWarnUser: false,
  };
}

/**
 * 空数据保护：防止空数据覆盖云端
 */
export function preventEmptyDataOverwrite(localDataCount, remoteDataCount) {
  // 本地数据为0，但云端有数据 -> 极可能是新设备，绝不允许覆盖云端
  if (localDataCount === 0 && remoteDataCount > 0) {
    console.error('[FirstLaunch] ❌ 阻止空数据覆盖云端操作');
    return {
      blocked: true,
      reason: 'local_empty_remote_has_data',
      message: '检测到本地无数据但云端有数据，为保护您的数据，同步将只拉不推',
      safeAction: 'pull_only',
    };
  }
  
  // 本地数据远少于云端 -> 可能是本地数据丢失了，警告
  if (localDataCount > 0 && remoteDataCount > 0 && localDataCount < remoteDataCount * 0.5) {
    console.warn('[FirstLaunch] ⚠️  本地数据量远少于云端，可能存在数据丢失风险');
    return {
      blocked: false,
      warning: true,
      reason: 'local_much_less_than_remote',
      message: '本地数据量远少于云端，是否确认继续同步？',
    };
  }
  
  return {
    blocked: false,
    warning: false,
  };
}

/**
 * 应用版本升级检查
 */
export function checkAppVersion(newVersion) {
  const oldVersion = safeStorage.getItem(CONFIG.APP_VERSION_KEY, '0.0.0');
  
  if (oldVersion !== newVersion) {
    console.log(`[FirstLaunch] 应用版本变更: ${oldVersion} -> ${newVersion}`);
    
    // 记录新版本
    safeStorage.setItem(CONFIG.APP_VERSION_KEY, newVersion);
    
    return {
      isUpgrade: true,
      oldVersion,
      newVersion,
    };
  }
  
  return {
    isUpgrade: false,
    version: newVersion,
  };
}

/**
 * 获取首次启动相关统计信息
 */
export function getFirstLaunchStats() {
  return {
    firstLaunchCompleted: safeStorage.getItem(CONFIG.FIRST_LAUNCH_KEY, false),
    firstLaunchTime: safeStorage.getItem('first_launch_time', null),
    appVersion: safeStorage.getItem(CONFIG.APP_VERSION_KEY, 'unknown'),
    onboardingCompleted: safeStorage.getItem(CONFIG.ONBOARDING_KEY, false),
    localStorageItems: localStorage.length,
    estimatedDataSize: JSON.stringify(localStorage).length,
  };
}

/**
 * 重置首次启动状态（仅用于测试）
 */
export function resetFirstLaunchState() {
  localStorage.removeItem(CONFIG.FIRST_LAUNCH_KEY);
  localStorage.removeItem(CONFIG.APP_VERSION_KEY);
  localStorage.removeItem(CONFIG.ONBOARDING_KEY);
  localStorage.removeItem('first_launch_time');
  console.log('[FirstLaunch] 首次启动状态已重置（仅用于测试）');
}

// 默认导出
export default {
  checkFirstLaunch,
  performFirstLaunchInit,
  isEmptyDataState,
  getFirstSyncStrategy,
  needsOnboarding,
  completeOnboarding,
  handleEmptyDataOnLogin,
  preventEmptyDataOverwrite,
  checkAppVersion,
  getFirstLaunchStats,
  resetFirstLaunchState,
};
