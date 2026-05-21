/**
 * P2产品优化：用户信任感增强
 * 功能：显示同步状态、云端备份状态、数据安全提示
 */

import { getSyncGuardStatus, getLastSyncSuccessTime } from './syncGuard';
import { formatRelativeTime } from './timeSync';
import { safeStorage } from './dataRecovery';

// ========== 配置 ==========
const CONFIG = {
  // 信任级别阈值
  TRUST_LEVEL_GOOD: 24 * 60 * 60 * 1000, // 24小时内同步过
  TRUST_LEVEL_WARN: 72 * 60 * 60 * 1000, // 72小时内同步过
};

// ========== 信任状态计算 ==========

/**
 * 获取数据安全状态（用于UI显示）
 */
export function getDataSecurityStatus() {
  const syncGuard = getSyncGuardStatus();
  const lastSync = getLastSyncSuccessTime();
  
  // 计算安全级别
  let securityLevel = 'good';
  let securityIcon = '✅';
  let securityTitle = '数据安全';
  let securityMessage = '您的数据已安全备份';
  
  if (syncGuard.level === 'danger') {
    securityLevel = 'danger';
    securityIcon = '⚠️';
    securityTitle = '数据有风险';
    securityMessage = syncGuard.message;
  } else if (syncGuard.level === 'warning') {
    securityLevel = 'warning';
    securityIcon = 'ℹ️';
    securityTitle = '同步待处理';
    securityMessage = syncGuard.message;
  }
  
  // 检查是否从未同步过
  if (!lastSync) {
    securityLevel = 'warning';
    securityIcon = '⚠️';
    securityTitle = '尚未同步';
    securityMessage = '您的数据还未备份到云端，建议立即同步';
  }
  
  return {
    level: securityLevel,
    icon: securityIcon,
    title: securityTitle,
    message: securityMessage,
    lastSyncTime: lastSync,
    lastSyncRelative: lastSync ? formatRelativeTime(lastSync) : '从未同步',
    shouldShowAlert: securityLevel !== 'good',
  };
}

/**
 * 获取云端备份状态
 */
export function getCloudBackupStatus() {
  const lastSync = getLastSyncSuccessTime();
  const syncGuard = getSyncGuardStatus();
  
  let status = 'unknown';
  let statusText = '检查中...';
  let lastBackupText = '暂无备份记录';
  
  if (lastSync) {
    const timeSinceLastSync = Date.now() - new Date(lastSync).getTime();
    
    if (timeSinceLastSync < CONFIG.TRUST_LEVEL_GOOD) {
      status = 'good';
      statusText = '备份正常';
      lastBackupText = `上次备份: ${formatRelativeTime(lastSync)}`;
    } else if (timeSinceLastSync < CONFIG.TRUST_LEVEL_WARN) {
      status = 'warning';
      statusText = '备份待更新';
      lastBackupText = `上次备份: ${formatRelativeTime(lastSync)}`;
    } else {
      status = 'danger';
      statusText = '备份已过期';
      lastBackupText = `上次备份: ${formatRelativeTime(lastSync)}`;
    }
  }
  
  return {
    status,
    statusText,
    lastBackupText,
    lastBackupTime: lastSync,
    hasBackup: !!lastSync,
    consecutiveFailures: syncGuard.consecutiveFailures,
  };
}

/**
 * 获取数据统计信息（增强信任感）
 */
export function getDataTrustStats() {
  // 这里应该从实际数据库获取，先模拟
  const v2Account = safeStorage.getItem('v2_account', null);
  
  const momentsCount = v2Account?.accountData?.timeline?.length || 0;
  const babiesCount = v2Account?.accountData?.babies?.length || 0;
  
  // 估算媒体数量
  let mediaCount = 0;
  if (v2Account?.accountData?.timeline) {
    v2Account.accountData.timeline.forEach(moment => {
      if (moment.photos && Array.isArray(moment.photos)) {
        mediaCount += moment.photos.length;
      }
      if (moment.video) {
        mediaCount += 1;
      }
      if (moment.audio) {
        mediaCount += 1;
      }
    });
  }
  
  return {
    totalMoments: momentsCount,
    totalBabies: babiesCount,
    totalMedia: mediaCount,
    hasData: momentsCount > 0 || babiesCount > 0,
    lastUpdateText: momentsCount > 0 
      ? `记录了 ${momentsCount} 条成长瞬间`
      : '开始记录您的第一条成长瞬间吧',
  };
}

// ========== UI 显示组件 ==========

/**
 * 首页同步状态卡片数据
 */
export function getHomeSyncCardData() {
  const securityStatus = getDataSecurityStatus();
  const backupStatus = getCloudBackupStatus();
  const dataStats = getDataTrustStats();
  
  return {
    // 主状态
    mainIcon: securityStatus.icon,
    mainTitle: securityStatus.title,
    mainMessage: securityStatus.message,
    
    // 备份信息
    backupStatus: backupStatus.status,
    backupStatusText: backupStatus.statusText,
    lastBackupText: backupStatus.lastBackupText,
    hasBackup: backupStatus.hasBackup,
    
    // 数据统计
    stats: {
      moments: dataStats.totalMoments,
      babies: dataStats.totalBabies,
      media: dataStats.totalMedia,
    },
    
    // 操作建议
    action: {
      showButton: securityStatus.shouldShowAlert,
      buttonText: securityStatus.level === 'danger' ? '立即同步' : '检查同步',
      buttonType: securityStatus.level === 'danger' ? 'danger' : 'default',
    },
    
    // 安全提示
    securityTips: getSecurityTips(),
  };
}

/**
 * 获取安全提示信息
 */
function getSecurityTips() {
  const tips = [
    {
      icon: '🔒',
      text: '数据加密存储',
      detail: '您的数据在传输和存储时都经过加密处理',
    },
    {
      icon: '☁️',
      text: '云端备份',
      detail: '所有数据都会同步备份到云端服务器',
    },
    {
      icon: '💾',
      text: '本地冗余',
      detail: '设备本地也保存完整数据副本',
    },
    {
      icon: '🔄',
      text: '多设备同步',
      detail: '登录同一账号可在多设备查看数据',
    },
  ];
  
  // 随机返回1-2条，或者根据状态返回特定提示
  const backupStatus = getCloudBackupStatus();
  
  if (backupStatus.status === 'danger') {
    return [
      {
        icon: '⚠️',
        text: '建议立即备份',
        detail: '您的数据长时间未同步，建议尽快备份',
      },
      tips[0],
    ];
  }
  
  return tips.slice(0, 2);
}

/**
 * 设置页面 - 数据安全区块
 */
export function getSettingsSecuritySection() {
  const backupStatus = getCloudBackupStatus();
  const syncGuard = getSyncGuardStatus();
  
  return {
    title: '数据安全',
    icon: '🛡️',
    items: [
      {
        label: '云端备份状态',
        value: backupStatus.statusText,
        valueType: backupStatus.status,
        detail: backupStatus.lastBackupText,
        action: backupStatus.status !== 'good' ? '立即同步' : null,
      },
      {
        label: '连续失败次数',
        value: `${syncGuard.consecutiveFailures} 次`,
        valueType: syncGuard.consecutiveFailures > 0 ? 'warning' : 'normal',
        detail: syncGuard.consecutiveFailures > 0 ? '建议检查网络连接' : '同步正常',
      },
      {
        label: '本地数据保护',
        value: '已启用',
        valueType: 'good',
        detail: '数据损坏时可自动恢复',
      },
      {
        label: '导出数据备份',
        value: '→',
        action: '立即导出',
        detail: '将所有数据导出为压缩包',
      },
    ],
  };
}

// ========== 信任文案生成 ==========

/**
 * 生成删除操作前的确认文案（增强安全感）
 */
export function getDeleteConfirmationText(itemCount = 1, itemType = '记录') {
  const backupStatus = getCloudBackupStatus();
  
  let warningText = '';
  if (backupStatus.status === 'danger') {
    warningText = '⚠️ 注意：您的数据近期未同步，删除后可能无法恢复';
  } else if (backupStatus.status === 'warning') {
    warningText = 'ℹ️ 建议先同步再删除，确保云端数据一致';
  }
  
  return {
    title: `确认删除${itemCount > 1 ? `这${itemCount}条` : '这条'}${itemType}？`,
    message: itemCount > 1
      ? `删除后将无法恢复。您确定要删除这${itemCount}条${itemType}吗？`
      : '删除后将无法恢复。您确定要删除这条记录吗？',
    warning: warningText,
    confirmText: '确认删除',
    cancelText: '取消',
    danger: true,
  };
}

/**
 * 生成数据导出成功文案
 */
export function getExportSuccessText(fileSize) {
  return {
    title: '导出成功 ✅',
    message: `已成功导出您的所有数据，大小约 ${fileSize}`,
    tips: [
      '建议将导出文件保存到安全位置',
      '可以将备份文件发送到邮箱保存',
      '定期导出备份是个好习惯',
    ],
    action: '查看文件',
  };
}

/**
 * 生成首次同步完成文案
 */
export function getFirstSyncSuccessText() {
  const stats = getDataTrustStats();
  
  return {
    title: '首次同步完成 🎉',
    message: `您的 ${stats.totalMoments} 条记录已安全备份到云端`,
    features: [
      { icon: '🔒', text: '数据已加密存储' },
      { icon: '☁️', text: '云端备份完成' },
      { icon: '📱', text: '多设备可同步查看' },
    ],
    nextSteps: [
      '继续记录更多美好时光',
      '邀请家人一起参与记录',
      '定期导出数据做额外备份',
    ],
  };
}

// ========== 辅助工具 ==========

/**
 * 检查是否应该显示"数据安全"引导
 * 新用户、从未同步过的用户应该看到
 */
export function shouldShowSecurityGuide() {
  const hasCompletedGuide = safeStorage.getItem('security_guide_completed', false);
  if (hasCompletedGuide) return false;
  
  const lastSync = getLastSyncSuccessTime();
  if (!lastSync) return true; // 从未同步过
  
  // 首次同步后显示一次
  const timeSinceFirstSync = Date.now() - new Date(lastSync).getTime();
  return timeSinceFirstSync < 24 * 60 * 60 * 1000; // 24小时内
}

/**
 * 标记安全引导已完成
 */
export function markSecurityGuideCompleted() {
  safeStorage.setItem('security_guide_completed', true);
}

/**
 * 生成数据安全总结报告（用于分享或查看）
 */
export function generateSecurityReport() {
  const security = getDataSecurityStatus();
  const backup = getCloudBackupStatus();
  const stats = getDataTrustStats();
  
  return {
    generatedAt: new Date().toLocaleString('zh-CN'),
    overallStatus: security.title,
    overallLevel: security.level,
    
    backup: {
      status: backup.statusText,
      lastBackup: backup.lastBackupText,
      hasBackup: backup.hasBackup,
    },
    
    data: {
      totalRecords: stats.totalMoments + stats.totalBabies,
      totalMedia: stats.totalMedia,
    },
    
    recommendations: generateSecurityRecommendations(),
    
    footer: '宝贝时光 - 守护您的每一段珍贵记忆',
  };
}

/**
 * 生成安全建议
 */
function generateSecurityRecommendations() {
  const recommendations = [];
  const backupStatus = getCloudBackupStatus();
  const syncGuard = getSyncGuardStatus();
  
  if (backupStatus.status !== 'good') {
    recommendations.push({
      priority: 'high',
      text: '立即同步数据到云端',
      reason: '确保数据有云端备份',
    });
  }
  
  if (syncGuard.consecutiveFailures > 0) {
    recommendations.push({
      priority: 'medium',
      text: '检查网络连接状态',
      reason: '同步连续失败，可能是网络问题',
    });
  }
  
  recommendations.push({
    priority: 'low',
    text: '定期导出数据备份',
    reason: '建议每月导出一次做离线备份',
  });
  
  return recommendations;
}

// 默认导出
export default {
  getDataSecurityStatus,
  getCloudBackupStatus,
  getDataTrustStats,
  getHomeSyncCardData,
  getSettingsSecuritySection,
  getDeleteConfirmationText,
  getExportSuccessText,
  getFirstSyncSuccessText,
  shouldShowSecurityGuide,
  markSecurityGuideCompleted,
  generateSecurityReport,
};
