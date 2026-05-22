/**
 * 🛡️ safeJson - 安全 JSON 操作
 * 解决：JSON.parse 炸了导致导入导出全挂
 */

/**
 * 安全 JSON.parse
 * 失败返回 fallback，默认 {}
 */
export function safeParse(str, fallback = {}) {
  if (typeof str !== 'string') {
    console.warn('[safeParse] input not string:', typeof str);
    return fallback;
  }

  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('[safeParse error]', e.message);
    return fallback;
  }
}

/**
 * 安全 JSON.stringify
 * 失败返回 '{}'
 */
export function safeStringify(obj, space = null) {
  try {
    return JSON.stringify(obj, null, space);
  } catch (e) {
    console.warn('[safeStringify error]', e.message);
    return '{}';
  }
}

/**
 * 深拷贝（用 JSON 实现的简单深拷贝）
 */
export function safeDeepClone(obj, fallback = null) {
  try {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.warn('[safeDeepClone error]', e.message);
    return fallback;
  }
}
