/**
 * 🛡️ Safe SDK - 安全运行时防护
 *
 * 解决：
 *   - "xxx is not a function" 白屏
 *   - JSON.parse 炸了导致导入导出失败
 *   - Promise reject 没人 catch 导致挂掉
 *   - 全局错误导致整个应用挂掉
 *
 * 使用方式：
 *   import { safeCall, safeParse, setupErrorGuard } from '@core/safe'
 */

export * from './safeCall';
export * from './safeJson';
export * from './errorGuard';
