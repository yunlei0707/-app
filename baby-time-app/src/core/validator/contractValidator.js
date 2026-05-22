/**
 * 契约校验器
 * 防止污染数据写入 state
 * 
 * 校验规则：
 * - ❌ 禁止 function
 * - ❌ 禁止 undefined
 * - ❌ 禁止 Symbol
 * - ❌ 禁止循环引用
 * - ✅ 允许：string/number/boolean/null/array/plain-object
 */

const DANGEROUS_TYPES = ['function', 'symbol', 'undefined'];
const MAX_DEPTH = 50;  // 防止栈溢出

/**
 * 校验数据是否安全
 * @param {any} data 要校验的数据
 * @param {string} context 上下文（用于报错定位）
 * @throws {Error} 数据污染时抛出
 */
export function validateSafeData(data, context = 'unknown') {
  const seen = new Set();  // 循环引用检测
  _validate(data, seen, 0, context);
}

/**
 * 安全写入：校验后再写入
 * @param {object} target 目标对象
 * @param {string} key 键名
 * @param {any} value 值
 */
export function safeSet(target, key, value) {
  validateSafeData(value, `${key} = ${JSON.stringify(value).slice(0, 50)}`);
  target[key] = value;
}

/**
 * 深度校验
 */
function _validate(data, seen, depth, context) {
  // 栈溢出保护
  if (depth > MAX_DEPTH) {
    throw new Error(`[ContractValidator] 数据层级过深 (>${MAX_DEPTH})，上下文: ${context}`);
  }
  
  // 循环引用检测
  if (data !== null && typeof data === 'object') {
    if (seen.has(data)) {
      throw new Error(`[ContractValidator] 检测到循环引用，上下文: ${context}`);
    }
    seen.add(data);
  }
  
  // 类型检测
  const type = typeof data;
  
  // 危险类型
  if (DANGEROUS_TYPES.includes(type)) {
    throw new Error(`[ContractValidator] 检测到危险类型 "${type}"，上下文: ${context}`);
  }
  
  // undefined 单独处理（typeof undefined是"undefined"，上面已经处理了）
  if (data === undefined) {
    throw new Error(`[ContractValidator] 检测到 undefined，上下文: ${context}`);
  }
  
  // 基本类型直接通过
  if (data === null || type !== 'object') {
    return;
  }
  
  // 数组
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      _validate(data[i], seen, depth + 1, `${context}[${i}]`);
    }
    return;
  }
  
  // 普通对象
  if (Object.prototype.toString.call(data) === '[object Object]') {
    // 检查构造函数（排除自定义类实例）
    if (data.constructor !== Object) {
      throw new Error(`[ContractValidator] 不支持自定义类实例: ${data.constructor.name}，上下文: ${context}`);
    }
    
    for (const key of Object.keys(data)) {
      _validate(data[key], seen, depth + 1, `${context}.${key}`);
    }
    return;
  }
  
  // 其他对象类型（Date, RegExp等）暂时放行，但打日志
  console.warn(`[ContractValidator] 检测到特殊对象类型: ${Object.prototype.toString.call(data)}，上下文: ${context}`);
}

/**
 * 静默校验：只返回是否通过，不抛出
 */
export function isSafeData(data) {
  try {
    validateSafeData(data);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 清理不安全数据：递归移除所有不安全的值
 */
export function cleanUnsafeData(data, seen = new Set()) {
  // 基本类型直接返回
  if (data === null || typeof data !== 'object') {
    return DANGEROUS_TYPES.includes(typeof data) ? null : data;
  }
  
  // 循环引用返回null
  if (seen.has(data)) {
    return null;
  }
  seen.add(data);
  
  // 数组
  if (Array.isArray(data)) {
    return data.map(item => cleanUnsafeData(item, seen)).filter(x => x !== undefined);
  }
  
  // 普通对象
  if (Object.prototype.toString.call(data) === '[object Object]' && data.constructor === Object) {
    const result = {};
    for (const key of Object.keys(data)) {
      const value = cleanUnsafeData(data[key], seen);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
  
  // 其他类型返回null
  return null;
}

export default {
  validateSafeData,
  safeSet,
  isSafeData,
  cleanUnsafeData,
};