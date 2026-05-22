/**
 * 🛡️ safeCall - 安全调用函数
 * 解决："xxx is not a function" 导致的白屏
 *
 * 使用：
 *   safeCall(user.onClick, () => {}, arg1, arg2)
 *   safeCall(() => obj.nested.method())
 */

export function safeCall(fn, fallback = () => {}, ...args) {
  try {
    // 直接传函数体的情况：safeCall(() => x.y.z())
    if (arguments.length === 1 && typeof fn === 'function') {
      return fn();
    }

    if (typeof fn === 'function') {
      return fn(...args);
    }

    console.warn('[safeCall] not a function:', fn);
    return typeof fallback === 'function' ? fallback() : fallback;
  } catch (e) {
    console.error('[safeCall error]', e.message);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

/**
 * 安全调用对象方法
 * 使用：safeCallMethod(obj, 'methodName', arg1, arg2)
 */
export function safeCallMethod(obj, methodName, ...args) {
  try {
    if (!obj) return undefined;
    const method = obj[methodName];
    if (typeof method === 'function') {
      return method.apply(obj, args);
    }
    return undefined;
  } catch (e) {
    console.error(`[safeCallMethod] ${methodName}:`, e.message);
    return undefined;
  }
}
