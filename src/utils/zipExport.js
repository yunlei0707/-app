/**
 * ⚠️ DEPRECATED - 已迁移到 src/services/exportService.js
 * 
 * 此文件仅作为兼容性保留，新代码请直接使用 exportService.js
 * 未来版本将删除此文件
 */

export {
  exportAllData,
  exportAllDataWithVideos,
  triggerDownload,
  isNativePlatform
} from '../services/exportService.js';

console.warn('[zipExport.js] ⚠️ 此文件已废弃，请使用 src/services/exportService.js');
