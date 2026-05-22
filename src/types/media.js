/**
 * 📦 Media Schema - 全局统一的媒体数据结构
 *
 * 架构原则：所有层（存储/渲染/导出/导入）只认这一个结构，从根源消除数据不一致
 *
 * 核心字段说明：
 * - path: 沙箱内真实路径，是核心字段！导出/播放/删除都靠它
 * - displayUrl: 仅用于前端显示，可临时生成，不入库
 * - hash: 可选字段，用于去重，先不强制计算（避免大文件卡顿）
 *
 * 历史兼容：
 * - 纯字符串路径 → 自动转换为标准 MediaItem 对象
 * - 旧格式字段 { url / path / filename } → 自动归一化为 path
 *
 * 为什么用 path 而不是 url？
 * url 容易混淆：可能是 blob URL、http URL、file URL、Capacitor 转换后的 URL
 * path 才是真正的沙箱内稳定标识
 */

/**
 * 全局统一的媒体对象标准
 * @typedef {Object} MediaItem
 * @property {string} id - 全局唯一ID
 * @property {'photo'|'video'|'audio'} type - 媒体类型
 * @property {string} path - 沙箱内真实路径（核心字段）
 * @property {string} fileName - 文件名，用于导出和显示
 * @property {string} mimeType - MIME类型
 * @property {number} size - 文件大小（字节）
 * @property {number} [duration] - 音视频专属：时长（秒）
 * @property {string} [coverPath] - 视频专属：封面图路径
 * @property {any} [waveform] - 音频专属：波形数据
 * @property {string} [hash] - 内容哈希（可选，用于去重）
 * @property {number} createdAt - 创建时间戳
 *
 * @property {string} [displayUrl] - 仅用于前端显示，可临时生成，不入库
 */

/**
 * 媒体类型枚举
 */
export const MEDIA_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video',
  AUDIO: 'audio',
};

/**
 * 必填字段（校验用）
 * 注意：hash 是可选字段，避免大文件计算卡顿
 */
export const REQUIRED_FIELDS = ['id', 'type', 'path', 'fileName', 'mimeType', 'size', 'createdAt'];

/**
 * 可选字段
 */
export const OPTIONAL_FIELDS = ['duration', 'coverPath', 'waveform', 'hash', 'displayUrl'];
