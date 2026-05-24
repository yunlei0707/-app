/**
 * Schema Validator - Repository layer data structure validation.
 */

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

function validateAgainstSchema(data, schema, typeName) {
  const errors = [];
  const source = data && typeof data === 'object' ? data : {};
  const sanitized = { ...source };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'function') {
      errors.push(`字段 ${key} 包含 function，禁止写入`);
      delete sanitized[key];
    }
  }

  for (const field of schema.required || []) {
    if (source[field] === undefined || source[field] === null) {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  for (const [field, allowedTypes] of Object.entries(schema.types || {})) {
    const value = source[field];
    const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];

    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (!types.includes(actualType)) {
        errors.push(`字段 ${field} 类型错误，期望 ${types.join('/')}，实际是 ${actualType}`);
      }
    } else if (schema.defaults && schema.defaults[field] !== undefined) {
      sanitized[field] = schema.defaults[field];
    }
  }

  if (!sanitized.createdAt) sanitized.createdAt = Date.now();
  if (!sanitized.updatedAt) sanitized.updatedAt = Date.now();

  if (errors.length > 0) {
    console.error(`[Schema] ${typeName} 校验失败:`, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: sanitized,
    data: sanitized
  };
}

export function validateMoment(momentData) {
  return validateAgainstSchema(momentData, MOMENT_SCHEMA, 'Moment');
}

export function validateBaby(babyData) {
  return validateAgainstSchema(babyData, BABY_SCHEMA, 'Baby');
}

export function validateCapsule(capsuleData) {
  return validateAgainstSchema(capsuleData, CAPSULE_SCHEMA, 'Capsule');
}

export function validate(data, type) {
  const validators = {
    moment: validateMoment,
    baby: validateBaby,
    capsule: validateCapsule
  };

  const validator = validators[type];
  if (!validator) {
    return {
      valid: false,
      errors: [`不支持的类型: ${type}`],
      sanitizedData: data,
      data
    };
  }

  return validator(data);
}

export function validateBeforeWrite(data, type) {
  const result = validate(data, type);
  if (!result.valid && result.errors[0]?.startsWith('不支持的类型')) {
    console.warn(`[Schema] 未知数据类型: ${type}, 跳过校验`);
    return { valid: true, errors: [], sanitizedData: data, data };
  }
  return result;
}

export const schemaValidator = {
  validate,
  validateMoment,
  validateBaby,
  validateCapsule,
  validateBeforeWrite
};

export default schemaValidator;
