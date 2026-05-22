/**
 * 🛡️ Schema Validator - Repository 层统一数据结构校验
 *
 * 解决："脏数据写进存储，整个 app 白屏"的问题
 *
 * 核心原则：在写入存储层之前，必须过校验这一关
 * 坏数据绝对不能进到存储层
 */

// ===== Moment Schema =====
const MOMENT_SCHEMA = {
  required: ['id', 'babyId', 'date'],
  types: {
    id: 'string',
    babyId: 'string',
    content: 'string',
    date: ['string', 'number'],
    mood: 'string',
    photos: 'array',
    videos: 'array',
    audios: 'array',
    type: 'string',
    createdAt: 'number',
    updatedAt: 'number'
  },
  defaults: {
    content: '',
    mood: 'neutral',
    photos: [],
    videos: [],
    audios: [],
    type: 'normal'
  }
};

// ===== Baby Schema =====
const BABY_SCHEMA = {
  required: ['id', 'name'],
  types: {
    id: 'string',
    name: 'string',
    birthday: ['string', 'number'],
    gender: 'string',
    avatar: 'string',
    createdAt: 'number',
    updatedAt: 'number'
  },
  defaults: {
    gender: 'unknown'
  }
};

// ===== Capsule Schema =====
const CAPSULE_SCHEMA = {
  required: ['id', 'title'],
  types: {
    id: 'string',
    title: 'string',
    description: 'string',
    openDate: ['string', 'number'],
    moments: 'array',
    createdAt: 'number',
    updatedAt: 'number'
  },
  defaults: {
    moments: []
  }
};

// ===== 校验核心 =====

function validateAgainstSchema(data, schema, typeName) {
  const errors = [];
  const sanitized = { ...data };

  // 检查是否有 function（数据污染）
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'function') {
      errors.push(`字段 ${key} 包含 function，禁止写入`);
      delete sanitized[key];
    }
  }

  // 必填字段检查
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }
  }

  // 类型检查 + 补默认值
  if (schema.types) {
    for (const [field, allowedTypes] of Object.entries(schema.types)) {
      const value = data[field];
      const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];

      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (!types.includes(actualType)) {
          errors.push(`字段 ${field} 类型错误: 期望 ${types.join('/')}, 实际 ${actualType}`);
        }
      } else if (schema.defaults && schema.defaults[field] !== undefined) {
        sanitized[field] = schema.defaults[field];
      }
    }
  }

  // 自动加时间戳
  if (!sanitized.createdAt) {
    sanitized.createdAt = Date.now();
  }
  if (!sanitized.updatedAt) {
    sanitized.updatedAt = Date.now();
  }

  if (errors.length > 0) {
    console.error(`[Schema] ${typeName} 校验失败:`, errors);
    return { valid: false, errors, sanitizedData: sanitized };
  }

  return { valid: true, errors: [], sanitizedData: sanitized };
}

// ===== 对外接口 =====

export function validateMoment(momentData) {
  return validateAgainstSchema(momentData, MOMENT_SCHEMA, 'Moment');
}

export function validateBaby(babyData) {
  return validateAgainstSchema(babyData, BABY_SCHEMA, 'Baby');
}

export function validateCapsule(capsuleData) {
  return validateAgainstSchema(capsuleData, CAPSULE_SCHEMA, 'Capsule');
}

/**
 * Repository 层写入前必须调用这个
 */
export function validateBeforeWrite(data, type) {
  const validators = {
    'moment': validateMoment,
    'baby': validateBaby,
    'capsule': validateCapsule
  };

  const validator = validators[type];
  if (!validator) {
    console.warn(`[Schema] 未知数据类型: ${type}, 跳过校验`);
    return { valid: true, errors: [], sanitizedData: data };
  }

  return validator(data);
}

export const schemaValidator = {
  validateMoment,
  validateBaby,
  validateCapsule,
  validateBeforeWrite
};

export default schemaValidator;
