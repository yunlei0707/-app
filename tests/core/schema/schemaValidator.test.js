/**
 * Schema Validator 单元测试
 */

import { describe, it, expect } from 'vitest';
import { schemaValidator } from '../../../src/core/schema/schemaValidator.js';

describe('Schema Validator', () => {
  describe('Moment 校验', () => {
    it('应该通过合法的 Moment 数据', () => {
      const moment = {
        id: 'm_001',
        babyId: 'b_001',
        date: Date.now(),
        content: '今天宝宝会翻身了！',
        photos: ['photo1.jpg']
      };

      const result = schemaValidator.validate(moment, 'moment');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少必填字段', () => {
      const moment = {
        // 缺少 id, babyId, date
        content: '今天很开心'
      };

      const result = schemaValidator.validate(moment, 'moment');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: id');
      expect(result.errors).toContain('缺少必填字段: babyId');
      expect(result.errors).toContain('缺少必填字段: date');
    });

    it('应该自动补全默认值', () => {
      const moment = {
        id: 'm_001',
        babyId: 'b_001',
        date: Date.now()
      };

      const result = schemaValidator.validate(moment, 'moment');
      expect(result.data.mood).toBe('neutral');
      expect(result.data.photos).toEqual([]);
      expect(result.data.videos).toEqual([]);
      expect(result.data.audios).toEqual([]);
      expect(result.data.type).toBe('normal');
    });

    it('应该拒绝包含 function 的数据（污染检测）', () => {
      const moment = {
        id: 'm_001',
        babyId: 'b_001',
        date: Date.now(),
        malicious: () => { console.log('hack'); }
      };

      const result = schemaValidator.validate(moment, 'moment');
      expect(result.errors).toContain('字段 malicious 包含 function，禁止写入');
      expect(result.data.malicious).toBeUndefined();
    });
  });

  describe('Baby 校验', () => {
    it('应该通过合法的 Baby 数据', () => {
      const baby = {
        id: 'b_001',
        name: '小宝贝',
        birthday: Date.now(),
        gender: 'girl'
      };

      const result = schemaValidator.validate(baby, 'baby');
      expect(result.valid).toBe(true);
    });

    it('应该检测缺少必填的 name 字段', () => {
      const baby = {
        id: 'b_001'
        // 缺少 name
      };

      const result = schemaValidator.validate(baby, 'baby');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: name');
    });

    it('gender 默认值应该是 unknown', () => {
      const baby = {
        id: 'b_001',
        name: '小宝贝'
      };

      const result = schemaValidator.validate(baby, 'baby');
      expect(result.data.gender).toBe('unknown');
    });
  });

  describe('Capsule 校验', () => {
    it('应该通过合法的 Capsule 数据', () => {
      const capsule = {
        id: 'c_001',
        title: '一岁生日',
        description: '宝宝满一岁了',
        moments: ['m_001', 'm_002']
      };

      const result = schemaValidator.validate(capsule, 'capsule');
      expect(result.valid).toBe(true);
      expect(result.data.moments).toEqual(['m_001', 'm_002']);
    });

    it('moments 默认值应该是空数组', () => {
      const capsule = {
        id: 'c_001',
        title: '一岁生日'
      };

      const result = schemaValidator.validate(capsule, 'capsule');
      expect(result.data.moments).toEqual([]);
    });
  });

  describe('边界情况', () => {
    it('不支持的 schema 类型应该报错', () => {
      const result = schemaValidator.validate({}, 'unknownType');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('不支持的类型');
    });

    it('类型不匹配时应该报错', () => {
      const moment = {
        id: 123, // 应该是 string
        babyId: 'b_001',
        date: Date.now()
      };

      const result = schemaValidator.validate(moment, 'moment');
      expect(result.errors).toContain('字段 id 类型错误，期望 string，实际是 number');
    });

    it('null 应该被检测为缺失必填字段', () => {
      const moment = {
        id: null,
        babyId: 'b_001',
        date: Date.now()
      };

      const result = schemaValidator.validate(moment, 'moment');
      expect(result.errors).toContain('缺少必填字段: id');
    });
  });
});
