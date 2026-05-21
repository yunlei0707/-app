/**
 * P2产品优化：心理安全感设计
 * 功能：删除二次确认、上传中保护、同步中防重复操作
 */

import { safeStorage } from './dataRecovery';
import { guardCriticalAction } from './syncGuard';
import { getDeleteConfirmationText } from './trustBuilder';

// ========== 配置 ==========
const CONFIG = {
  // 操作冷却时间（防止快速重复点击）
  ACTION_COOLDOWN: 1000,
  // 长时间操作警告阈值（超过这个时间显示警告）
  LONG_OPERATION_WARNING: 30000, // 30秒
};

// ========== 操作状态管理 ==========
const operationStates = new Map();
const operationTimers = new Map();

/**
 * 开始一个操作（防止重复点击）
 */
export function startOperation(operationId) {
  const now = Date.now();
  const state = operationStates.get(operationId);
  
  if (state && state.isRunning) {
    console.warn(`[PsychSafety] 操作 "${operationId}" 正在进行中，拒绝重复执行`);
    return {
      allowed: false,
      reason: 'operation_in_progress',
      message: '操作正在进行中，请稍候',
    };
  }
  
  // 检查冷却时间
  if (state && state.lastEndTime && now - state.lastEndTime < CONFIG.ACTION_COOLDOWN) {
    console.warn(`[PsychSafety] 操作 "${operationId}" 过于频繁，强制冷却`);
    return {
      allowed: false,
      reason: 'too_frequent',
      message: '请稍候再试',
      remainingCooldown: CONFIG.ACTION_COOLDOWN - (now - state.lastEndTime),
    };
  }
  
  operationStates.set(operationId, {
    isRunning: true,
    startTime: now,
    lastEndTime: null,
  });
  
  // 设置长时间操作警告定时器
  const warnTimer = setTimeout(() => {
    const state = operationStates.get(operationId);
    if (state && state.isRunning) {
      console.warn(`[PsychSafety] 操作 "${operationId}" 已执行超过 ${CONFIG.LONG_OPERATION_WARNING / 1000} 秒`);
      state.warned = true;
    }
  }, CONFIG.LONG_OPERATION_WARNING);
  
  operationTimers.set(operationId, warnTimer);
  
  console.log(`[PsychSafety] 操作 "${operationId}" 开始`);
  return { allowed: true };
}

/**
 * 结束一个操作
 */
export function endOperation(operationId, success = true) {
  const state = operationStates.get(operationId);
  if (!state) return;
  
  const now = Date.now();
  const duration = now - state.startTime;
  
  // 清除警告定时器
  const warnTimer = operationTimers.get(operationId);
  if (warnTimer) {
    clearTimeout(warnTimer);
    operationTimers.delete(operationId);
  }
  
  operationStates.set(operationId, {
    isRunning: false,
    startTime: state.startTime,
    lastEndTime: now,
    lastSuccess: success,
    lastDuration: duration,
  });
  
  console.log(`[PsychSafety] 操作 "${operationId}" 结束，耗时: ${duration}ms，结果: ${success ? '成功' : '失败'}`);
}

/**
 * 检查操作是否正在进行
 */
export function isOperationRunning(operationId) {
  const state = operationStates.get(operationId);
  return state?.isRunning || false;
}

/**
 * 获取操作状态
 */
export function getOperationState(operationId) {
  return operationStates.get(operationId) || null;
}

// ========== 删除确认 ==========

/**
 * 删除前的完整检查流程（含心理安全设计）
 */
export function beforeDeleteCheck(deleteCount = 1, deleteType = '记录') {
  // 1. 检查同步状态（数据是否安全）
  const syncGuard = guardCriticalAction('delete');
  
  // 2. 获取删除确认文案（含安全感设计）
  const confirmation = getDeleteConfirmationText(deleteCount, deleteType);
  
  // 3. 如果同步有问题，增强警告
  if (syncGuard.warning) {
    confirmation.enhancedWarning = syncGuard.message;
    confirmation.confirmText = '我已知风险，确认删除';
  }
  
  if (syncGuard.allowed === false) {
    // 不允许删除
    return {
      canDelete: false,
      reason: syncGuard.reason,
      message: syncGuard.message,
      suggestion: syncGuard.suggestion,
      isBlocked: true,
    };
  }
  
  return {
    canDelete: true,
    confirmation,
    hasWarning: syncGuard.warning,
    syncStatus: syncGuard,
  };
}

/**
 * 生成删除过程中的状态更新文案
 */
export function getDeleteProgressText(current, total) {
  return {
    text: `正在删除 ${current}/${total}...`,
    hint: '请稍候，不要退出页面',
    progress: Math.round((current / total) * 100),
  };
}

/**
 * 删除成功后的反馈文案
 */
export function getDeleteSuccessText(deletedCount, itemType = '记录') {
  return {
    title: '删除成功',
    message: `已成功删除 ${deletedCount} 条${itemType}`,
    undoAvailable: false, // 后续可添加撤销功能
    action: null,
  };
}

// ========== 上传保护 ==========

/**
 * 开始上传前的检查和准备
 */
export function beforeUploadCheck(fileType = 'media', fileCount = 1) {
  // 检查是否已有上传在进行
  if (isOperationRunning('media_upload')) {
    return {
      canUpload: false,
      reason: 'upload_in_progress',
      message: '已有文件正在上传中，请稍候',
      suggestion: '等待当前上传完成后再试',
    };
  }
  
  // 标记开始上传
  startOperation('media_upload');
  
  return {
    canUpload: true,
    uploadId: `upload_${Date.now()}`,
    estimatedTime: estimateUploadTime(fileType, fileCount),
    hint: '上传过程中请勿退出页面',
  };
}

/**
 * 估算上传时间
 */
function estimateUploadTime(fileType, fileCount) {
  const baseTimes = {
    image: 2000, // 每张图2秒
    video: 30000, // 每段视频30秒
    audio: 10000, // 每段音频10秒
    media: 5000, // 通用媒体
  };
  
  const baseTime = baseTimes[fileType] || baseTimes.media;
  const totalTime = baseTime * fileCount;
  
  // 格式化显示
  if (totalTime < 60000) {
    return `约 ${Math.ceil(totalTime / 1000)} 秒`;
  }
  return `约 ${Math.ceil(totalTime / 60000)} 分钟`;
}

/**
 * 上传进度文案
 */
export function getUploadProgressText(current, total, fileType = '媒体文件') {
  const progress = Math.round((current / total) * 100);
  
  let hint = '正在上传，请稍候';
  if (progress > 80) {
    hint = '即将完成...';
  } else if (progress > 50) {
    hint = '已过半，继续加油';
  }
  
  return {
    text: `正在上传 ${fileType} (${progress}%)`,
    hint,
    progress,
    current,
    total,
  };
}

/**
 * 上传成功文案
 */
export function getUploadSuccessText(fileCount = 1) {
  return {
    title: '上传成功 ✅',
    message: fileCount > 1
      ? `${fileCount} 个文件已全部上传完成'
      : '文件上传完成',
    hint: '数据已安全保存',
    action: '查看记录',
  };
}

/**
 * 上传失败文案
 */
export function getUploadFailureText(error = '网络错误') {
  return {
    title: '上传失败',
    message: `${error}，请检查网络后重试`,
    hint: '您的数据不会丢失，可稍后重新上传',
    canRetry: true,
    action: '重新上传',
  };
}

/**
 * 结束上传状态
 */
export function endUpload(success = true) {
  endOperation('media_upload', success);
}

// ========== 同步保护 ==========

/**
 * 开始同步前的检查
 */
export function beforeSyncCheck(forceSync = false) {
  // 检查是否已有同步在进行
  if (isOperationRunning('sync')) {
    return {
      canSync: false,
      reason: 'sync_in_progress',
      message: '正在同步中，请稍候',
      suggestion: '同步完成后会自动刷新',
    };
  }
  
  // 标记开始同步
  startOperation('sync');
  
  return {
    canSync: true,
    syncId: `sync_${Date.now()}`,
    isForced: forceSync,
  };
}

/**
 * 同步进度文案
 */
export function getSyncProgressText(step, totalSteps, currentItem = '') {
  const stepTexts = {
    1: '检查本地数据...',
    2: '连接云端服务器...',
    3: '上传本地变更...',
    4: '下载云端更新...',
    5: '合并数据...',
    6: '验证完整性...',
    7: '完成同步',
  };
  
  const progress = Math.round((step / totalSteps) * 100);
  
  return {
    text: stepTexts[step] || '同步中...',
    hint: currentItem ? `正在处理: ${currentItem}` : '请稍候',
    progress,
    step,
    totalSteps,
  };
}

/**
 * 同步成功文案
 */
export function getSyncSuccessText(changesSynced = 0, hasConflicts = false) {
  let message = '所有数据已同步完成';
  if (changesSynced > 0) {
    message = `已同步 ${changesSynced} 条变更`;
  }
  
  return {
    title: '同步成功 ✅',
    message,
    hasConflicts,
    conflictAction: hasConflicts ? '查看冲突' : null,
    hint: '云端数据已更新',
  };
}

/**
 * 同步失败文案
 */
export function getSyncFailureText(error = '网络错误', consecutiveFailures = 0) {
  let hint = '请检查网络连接后重试';
  if (consecutiveFailures >= 3) {
    hint = '连续多次失败，可能是服务器问题，请稍后再试';
  }
  
  return {
    title: '同步失败',
    message: error,
    hint,
    consecutiveFailures,
    canRetry: true,
    action: '重新同步',
  };
}

/**
 * 结束同步状态
 */
export function endSync(success = true) {
  endOperation('sync', success);
}

// ========== 退出页面保护 ==========

/**
 * 检查是否有正在进行的操作需要阻止页面退出
 */
export function shouldBlockExit() {
  const runningOperations = [];
  
  for (const [operationId, state] of operationStates.entries()) {
    if (state.isRunning) {
      runningOperations.push(operationId);
    }
  }
  
  if (runningOperations.length > 0) {
    return {
      shouldBlock: true,
      operations: runningOperations,
      message: '有操作正在进行中，退出可能导致数据丢失',
      confirmText: '我知道风险，确认退出',
    };
  }
  
  return {
    shouldBlock: false,
  };
}

/**
 * 生成页面退出前的警告文案
 */
export function getExitWarningText(runningOperations) {
  const operationNames = {
    'media_upload': '文件上传',
    'sync': '数据同步',
    'delete': '数据删除',
    'export': '数据导出',
  };
  
  const operationTexts = runningOperations
    .map(id => operationNames[id] || id)
    .join('、');
  
  return {
    title: '确定要离开吗？',
    message: `以下操作正在进行中，退出可能导致失败：\n${operationTexts}`,
    warning: '建议等待操作完成后再离开',
    confirmText: '我知道风险，确认离开',
    cancelText: '继续等待',
  };
}

// ========== 长期操作守护 ==========

/**
 * 创建一个长时间操作的守护
 */
export function createLongOperationGuard(operationId, totalEstimatedTime) {
  return {
    id: operationId,
    startTime: Date.now(),
    totalEstimatedTime,
    
    updateProgress(progress) {
      console.log(`[PsychSafety] ${operationId} 进度: ${progress}%`);
    },
    
    cancel() {
      console.log(`[PsychSafety] 用户取消操作: ${operationId}`);
      endOperation(operationId, false);
    },
    
    getElapsedTime() {
      return Date.now() - this.startTime;
    },
    
    getEstimatedRemaining() {
      return Math.max(0, totalEstimatedTime - this.getElapsedTime());
    },
  };
}

// ========== 初始化 ==========

/**
 * 初始化心理安全系统
 */
export function initPsychSafety() {
  console.log('[PsychSafety] 心理安全系统初始化');
  
  // 监听页面卸载
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', (event) => {
      const exitCheck = shouldBlockExit();
      if (exitCheck.shouldBlock) {
        event.preventDefault();
        event.returnValue = exitCheck.message;
        return exitCheck.message;
      }
    });
  }
  
  return true;
}

/**
 * 重置所有操作状态（仅用于错误恢复）
 */
export function resetAllOperations() {
  console.warn('[PsychSafety] 强制重置所有操作状态');
  
  // 清除所有定时器
  for (const timer of operationTimers.values()) {
    clearTimeout(timer);
  }
  operationTimers.clear();
  
  // 清除所有状态
  operationStates.clear();
}

// 默认导出
export default {
  startOperation,
  endOperation,
  isOperationRunning,
  getOperationState,
  
  // 删除相关
  beforeDeleteCheck,
  getDeleteProgressText,
  getDeleteSuccessText,
  
  // 上传相关
  beforeUploadCheck,
  getUploadProgressText,
  getUploadSuccessText,
  getUploadFailureText,
  endUpload,
  
  // 同步相关
  beforeSyncCheck,
  getSyncProgressText,
  getSyncSuccessText,
  getSyncFailureText,
  endSync,
  
  // 退出保护
  shouldBlockExit,
  getExitWarningText,
  
  // 长期操作
  createLongOperationGuard,
  
  // 系统
  initPsychSafety,
  resetAllOperations,
};
