/**
 * P4阶段：数据结构校验工具
 * 功能：导入/同步时校验数据完整性，防止坏数据污染
 */

// ========== Schema版本控制 ==========
export const CURRENT_SCHEMA_VERSION = 1;
export const MIN_SUPPORTED_SCHEMA_VERSION = 1;

// ========== 必填字段定义 ==========
const REQUIRED_FIELDS = {
  baby: ['id', 'name', 'createdAt'],
  moment: ['id', 'babyId', 'type', 'createdAt'],
  capsule: ['id', 'babyId', 'title', 'unlockDate'],
  growth: ['id', 'babyId', 'date', 'height', 'weight'],
};

// ========== 数据类型定义 ==========
const TYPE_DEFINITIONS = {
  id: 'string',
  name: 'string',
  babyId: 'string',
  type: 'string',
  title: 'string',
  content: ['string', 'undefined'],
  createdAt: 'string',
  updatedAt: ['string', 'undefined'],
  unlockDate: 'string',
  date: 'string',
  height: 'number',
  weight: 'number',
  headCircumference: ['number', 'undefined'],
  footLength: ['number', 'undefined'],
  location: ['string', 'undefined'],
  mood: ['string', 'undefined'],
  weather: ['string', 'undefined'],
  milestoneLabel: ['string', 'undefined'],
  tags: ['array', 'undefined'],
  photos: ['array', 'undefined'],
  videos: ['array', 'undefined'],
  audios: ['array', 'undefined'],
};

// ========== 校验结果类 ==========
export class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalChecked: 0,
      errorsCount: 0,
      warningsCount: 0,
    };
  }
  
  addError(message, field = null, value = null) {
    this.valid = false;
    this.stats.errorsCount++;
    this.errors.push({
      message,
      field,
      value: typeof value === 'object' ? JSON.stringify(value).substr(0, 100) : value,
    });
  }
  
  addWarning(message, field = null, value = null) {
    this.stats.warningsCount++;
    this.warnings.push({
      message,
      field,
      value: typeof value === 'object' ? JSON.stringify(value).substr(0, 100) : value,
    });
  }
  
  incrementChecked() {
    this.stats.totalChecked++;
  }
  
  getSummary() {
    return {
      valid: this.valid,
      totalChecked: this.stats.totalChecked,
      errorsCount: this.stats.errorsCount,
      warningsCount: this.stats.warningsCount,
      hasCriticalErrors: this.errors.some(e => e.level === 'critical'),
    };
  }
}

// ========== 类型检查工具 ==========
function getType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkType(value, expectedType) {
  const actualType = getType(value);
  const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
  return expectedTypes.includes(actualType);
}

// ========== 核心校验函数 ==========

/**
 * 校验Schema版本
 */
export function validateSchemaVersion(data, result = new ValidationResult()) {
  const schemaVersion = data.schemaVersion || data.version;
  
  if (!schemaVersion) {
    result.addWarning('未指定Schema版本，可能存在兼容性问题', 'schemaVersion');
    return result;
  }
  
  if (schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    result.addError(
      `Schema版本过低：${schemaVersion}，最低支持：${MIN_SUPPORTED_SCHEMA_VERSION}`,
      'schemaVersion',
      schemaVersion
    );
  }
  
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    result.addWarning(
      `Schema版本高于当前版本：${schemaVersion}，可能存在不兼容字段`,
      'schemaVersion'
    );
  }
  
  return result;
}

/**
 * 校验宝宝数据
 */
export function validateBaby(baby, result = new ValidationResult()) {
  result.incrementChecked();
  
  // 检查必填字段
  for (const field of REQUIRED_FIELDS.baby) {
    if (baby[field] === undefined || baby[field] === null || baby[field] === '') {
      result.addError(`宝宝缺少必填字段：${field}`, `baby.${field}`, baby[field]);
    }
  }
  
  // 类型检查
  if (baby.name && typeof baby.name !== 'string') {
    result.addError('宝宝姓名必须是字符串', 'baby.name', baby.name);
  }
  
  if (baby.birthday) {
    const date = new Date(baby.birthday);
    if (isNaN(date.getTime())) {
      result.addError('宝宝生日格式无效', 'baby.birthday', baby.birthday);
    }
  }
  
  return result;
}

/**
 * 校验动态数据
 */
export function validateMoment(moment, result = new ValidationResult()) {
  result.incrementChecked();
  
  // 检查必填字段
  for (const field of REQUIRED_FIELDS.moment) {
    if (moment[field] === undefined || moment[field] === null || moment[field] === '') {
      result.addError(`动态缺少必填字段：${field}`, `moment.${field}`, moment[field]);
    }
  }
  
  // 类型检查
  if (moment.type && !['photo', 'text', 'video', 'audio', 'growth'].includes(moment.type)) {
    result.addWarning(`未知的动态类型：${moment.type}`, 'moment.type', moment.type);
  }
  
  // 日期检查
  if (moment.date) {
    const date = new Date(moment.date);
    if (isNaN(date.getTime())) {
      result.addError('动态日期格式无效', 'moment.date', moment.date);
    }
  }
  
  // 媒体文件检查
  if (moment.photos && !Array.isArray(moment.photos)) {
    result.addError('photos字段必须是数组', 'moment.photos', typeof moment.photos);
  }
  
  if (moment.videos && !Array.isArray(moment.videos)) {
    result.addError('videos字段必须是数组', 'moment.videos', typeof moment.videos);
  }
  
  if (moment.audios && !Array.isArray(moment.audios)) {
    result.addError('audios字段必须是数组', 'moment.audios', typeof moment.audios);
  }
  
  // 检查视频文件引用
  if (moment.videos && Array.isArray(moment.videos)) {
    moment.videos.forEach((video, idx) => {
      if (!video.filename && !video.url && !video.opfsPath) {
        result.addWarning(`视频${idx}没有文件路径引用`, `moment.videos[${idx}]`);
      }
    });
  }
  
  return result;
}

/**
 * 校验胶囊数据
 */
export function validateCapsule(capsule, result = new ValidationResult()) {
  result.incrementChecked();
  
  for (const field of REQUIRED_FIELDS.capsule) {
    if (capsule[field] === undefined || capsule[field] === null) {
      result.addError(`胶囊缺少必填字段：${field}`, `capsule.${field}`, capsule[field]);
    }
  }
  
  // 解锁日期检查
  if (capsule.unlockDate) {
    const date = new Date(capsule.unlockDate);
    if (isNaN(date.getTime())) {
      result.addError('胶囊解锁日期格式无效', 'capsule.unlockDate', capsule.unlockDate);
    }
  }
  
  return result;
}

/**
 * 校验成长记录
 */
export function validateGrowthRecord(record, result = new ValidationResult()) {
  result.incrementChecked();
  
  for (const field of REQUIRED_FIELDS.growth) {
    if (record[field] === undefined || record[field] === null) {
      result.addError(`成长记录缺少必填字段：${field}`, `growth.${field}`, record[field]);
    }
  }
  
  // 数值范围检查
  if (record.height !== undefined) {
    if (record.height < 0 || record.height > 200) {
      result.addWarning(`身高数值异常：${record.height}cm`, 'growth.height', record.height);
    }
  }
  
  if (record.weight !== undefined) {
    if (record.weight < 0 || record.weight > 100) {
      result.addWarning(`体重数值异常：${record.weight}kg`, 'growth.weight', record.weight);
    }
  }
  
  return result;
}

/**
 * 校验v2账号数据
 */
export function validateV2AccountData(accountData, result = new ValidationResult()) {
  if (!accountData) {
    result.addWarning('v2账号数据为空', 'v2AccountData');
    return result;
  }
  
  if (!accountData.accountId && !accountData.identityName) {
    result.addWarning('v2账号缺少唯一标识', 'v2AccountData.accountId');
  }
  
  if (accountData.timeline && Array.isArray(accountData.timeline)) {
    for (const moment of accountData.timeline) {
      validateMoment(moment, result);
    }
  }
  
  return result;
}

/**
 * 完整数据校验（导入时使用）
 */
export function validateFullData(data, options = {}) {
  const { 
    failFast = false,        // 遇到第一个错误立即返回
    maxErrors = 50,          // 最多记录多少个错误
    strictMode = false       // 严格模式：警告也会导致失败
  } = options;
  
  const result = new ValidationResult();
  
  try {
    // 1. Schema版本校验
    validateSchemaVersion(data, result);
    
    if (failFast && !result.valid) {
      return result.getSummary();
    }
    
    // 2. 校验宝宝数据
    if (data.babies && Array.isArray(data.babies)) {
      for (const baby of data.babies) {
        validateBaby(baby, result);
        if (failFast && !result.valid) return result.getSummary();
        if (result.stats.errorsCount >= maxErrors) break;
      }
    }
    
    // 3. 校验动态数据
    const momentsToCheck = [
      ...(data.moments || []),
      ...(data.data?.moments || []),
    ];
    
    for (const moment of momentsToCheck) {
      validateMoment(moment, result);
      if (failFast && !result.valid) return result.getSummary();
      if (result.stats.errorsCount >= maxErrors) break;
    }
    
    // 4. 校验胶囊数据
    if (data.capsules && Array.isArray(data.capsules)) {
      for (const capsule of data.capsules) {
        validateCapsule(capsule, result);
        if (failFast && !result.valid) return result.getSummary();
        if (result.stats.errorsCount >= maxErrors) break;
      }
    }
    
    // 5. 校验v2账号数据
    if (data.v2AccountData) {
      validateV2AccountData(data.v2AccountData, result);
    }
    
    // 6. 媒体文件完整性检查（警告级别）
    // （检查是否存在无效的文件引用）
    
  } catch (error) {
    result.addError(`数据校验过程中发生异常：${error.message}`, 'validation');
    console.error('[DataValidator] 校验异常:', error);
  }
  
  const summary = result.getSummary();
  
  // 严格模式下，警告也视为失败
  if (strictMode && summary.warningsCount > 0) {
    summary.valid = false;
  }
  
  return {
    ...summary,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * 快速校验（仅检查关键问题，不检查警告）
 */
export function quickValidate(data) {
  return validateFullData(data, { failFast: true, maxErrors: 10 });
}

/**
 * 格式化校验结果，生成用户友好的提示
 */
export function formatValidationResult(validationResult) {
  const { valid, errorsCount, warningsCount, errors, warnings } = validationResult;
  
  let message = '';
  
  if (valid) {
    if (warningsCount > 0) {
      message = `数据校验通过，但发现 ${warningsCount} 个潜在问题，建议检查后导入`;
    } else {
      message = '数据校验通过，可以安全导入';
    }
  } else {
    message = `数据校验失败，发现 ${errorsCount} 个错误${warningsCount > 0 ? `，${warningsCount} 个警告` : ''}`;
  }
  
  // 生成详细错误列表
  const errorDetails = errors.slice(0, 10).map(e => 
    `❌ ${e.message}${e.field ? ` (字段: ${e.field})` : ''}`
  );
  
  const warningDetails = warnings.slice(0, 5).map(w => 
    `⚠️ ${w.message}${w.field ? ` (字段: ${w.field})` : ''}`
  );
  
  return {
    message,
    valid,
    canImport: valid || (errorsCount === 0 && warningsCount > 0), // 只有警告可以导入
    errorDetails,
    warningDetails,
    hasMoreErrors: errors.length > 10,
    hasMoreWarnings: warnings.length > 5,
  };
}

// 默认导出
export default {
  validateSchemaVersion,
  validateBaby,
  validateMoment,
  validateCapsule,
  validateGrowthRecord,
  validateV2AccountData,
  validateFullData,
  quickValidate,
  formatValidationResult,
  ValidationResult,
  CURRENT_SCHEMA_VERSION,
  MIN_SUPPORTED_SCHEMA_VERSION,
};
