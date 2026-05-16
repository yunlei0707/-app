/**
 * 存储配置
 * 控制OPFS存储模式的开关和相关参数
 */

export const STORAGE_CONFIG = {
  // OPFS存储模式：'auto'=自动检测 | true=强制开启 | false=强制关闭
  USE_OPFS: 'auto',

  // 并发读取文件数量限制，防止内存暴涨
  MAX_CONCURRENT_READ: 5,

  // 启动时自动清理孤儿文件
  AUTO_CLEANUP_ORPHANS: true,

  // 调试模式：开启后控制台输出更多日志
  DEBUG_MODE: false,

  // 单视频最大大小限制（30MB）
  MAX_VIDEO_SIZE: 30 * 1024 * 1024,
};

export default STORAGE_CONFIG;
