#!/usr/bin/env node
/**
 * 🛡️ 系统收口检查模式 - 全项目深度扫描
 * 目标：找出所有违反"唯一入口"架构规则的引用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');

// ============================================
// 架构规则定义
// ============================================
const RULES = [
  {
    id: 'DB_V1_DIRECT_IMPORT',
    name: '直接引用 V1 数据库',
    description: '业务层禁止直接引用 src/utils/db.js，应通过 stateRepository',
    severity: 'ERROR',
    pattern: /from\s+['"]\.*\/utils\/db['"]/,
    exclude: [/repositories\//, /utils\//, /scripts\//]
  },
  {
    id: 'DB_V2_DIRECT_IMPORT',
    name: '直接引用 V2 数据库',
    description: '业务层禁止直接引用 src/utils/dbV2.js，应通过 stateRepository',
    severity: 'ERROR',
    pattern: /from\s+['"]\.*\/utils\/dbV2['"]/,
    exclude: [/repositories\//, /utils\//, /scripts\//]
  },
  {
    id: 'STORAGE_ADAPTER_DIRECT_IMPORT',
    name: '直接引用存储适配器',
    description: '业务层禁止直接引用 storageAdapter.js，应通过 mediaRepository',
    severity: 'ERROR',
    pattern: /from\s+['"]\.*\/adapters\/storageAdapter['"]/,
    exclude: [/repositories\//, /adapters\//, /utils\//]
  },
  {
    id: 'NATIVE_DIRECT_IMPORT',
    name: '直接引用原生接口',
    description: '业务层禁止直接引用 native.js，应通过 mediaRepository',
    severity: 'ERROR',
    pattern: /from\s+['"]\.*\/utils\/native['"]/,
    exclude: [/repositories\//, /utils\//, /adapters\//]
  },
  {
    id: 'OPFS_DIRECT_IMPORT',
    name: '直接引用 OPFS',
    description: '业务层禁止直接引用 opfs.js，应通过 mediaRepository',
    severity: 'ERROR',
    pattern: /from\s+['"]\.*\/utils\/opfs['"]/,
    exclude: [/repositories\//, /utils\//, /adapters\//]
  },
  {
    id: 'IMPORTSERVICE_DUPLICATE',
    name: '直接引用旧 importService',
    description: '应统一引用 src/services/import/importService.js',
    severity: 'WARNING',
    pattern: /from\s+['"]\.*\/services\/importService['"]/,
    exclude: [/services\/import\//]
  },
  {
    id: 'NATIVEAPI_DIRECT_IMPORT',
    name: '直接引用 nativeApi',
    description: '底层 driver 应被 Repository 封装',
    severity: 'WARNING',
    pattern: /from\s+['"]\.*\/utils\/nativeApi['"]/,
    exclude: [/utils\//]
  }
];

// ============================================
// 扫描逻辑
// ============================================
function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(SRC_DIR, filePath);
  const violations = [];
  
  RULES.forEach(rule => {
    // 检查是否在排除列表中
    const isExcluded = rule.exclude.some(pattern => pattern.test(relativePath));
    if (isExcluded) return;
    
    // 检查每一行
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          description: rule.description,
          line: index + 1,
          code: line.trim(),
          file: relativePath
        });
      }
    });
  });
  
  return violations;
}

// ============================================
// 主程序
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🛡️  系统收口检查模式 - 全项目深度扫描');
console.log('='.repeat(80));

const allFiles = scanDirectory(SRC_DIR);
console.log(`\n📁 扫描文件数: ${allFiles.length}`);
console.log(`📋 检查规则数: ${RULES.length}`);

const allViolations = [];

allFiles.forEach(filePath => {
  const violations = checkFile(filePath);
  if (violations.length > 0) {
    allViolations.push(...violations);
  }
});

// ============================================
// 统计与输出
// ============================================
console.log('\n' + '='.repeat(80));
console.log('📊 检查结果统计');
console.log('='.repeat(80));

// 按规则分组
const violationsByRule = {};
allViolations.forEach(v => {
  if (!violationsByRule[v.ruleId]) {
    violationsByRule[v.ruleId] = {
      name: v.ruleName,
      severity: v.severity,
      description: v.description,
      count: 0,
      files: new Set()
    };
  }
  violationsByRule[v.ruleId].count++;
  violationsByRule[v.ruleId].files.add(v.file);
});

// 按严重程度分类
const errors = allViolations.filter(v => v.severity === 'ERROR');
const warnings = allViolations.filter(v => v.severity === 'WARNING');

console.log(`\n❌  ERROR 级别违规: ${errors.length} 处`);
console.log(`⚠️  WARNING 级别违规: ${warnings.length} 处`);
console.log(`📊 总计违规: ${allViolations.length} 处\n`);

// 输出详细违规列表
console.log('='.repeat(80));
console.log('🔍 违规详情列表');
console.log('='.repeat(80));

Object.entries(violationsByRule).forEach(([ruleId, info]) => {
  const icon = info.severity === 'ERROR' ? '❌' : '⚠️';
  console.log(`\n${icon} [${ruleId}] ${info.name} (${info.count} 处)`);
  console.log(`   说明: ${info.description}`);
  console.log(`   涉及文件 (${info.files.size} 个):`);
  
  // 输出该规则下所有违规位置
  const ruleViolations = allViolations.filter(v => v.ruleId === ruleId);
  const fileViolations = {};
  ruleViolations.forEach(v => {
    if (!fileViolations[v.file]) fileViolations[v.file] = [];
    fileViolations[v.file].push({ line: v.line, code: v.code });
  });
  
  Object.entries(fileViolations).forEach(([file, locations]) => {
    console.log(`     📄 ${file}`);
    locations.forEach(loc => {
      console.log(`        行 ${loc.line}: ${loc.code}`);
    });
  });
});

// ============================================
// 分叉点分析
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🔀 分叉点分析');
console.log('='.repeat(80));

console.log('\n📌 当前发现的所有分叉点:\n');

// 1. 数据库分叉
const dbViolations = allViolations.filter(v => 
  v.ruleId === 'DB_V1_DIRECT_IMPORT' || v.ruleId === 'DB_V2_DIRECT_IMPORT'
);
console.log('1. 📊 数据库访问分叉');
console.log(`   - 直接引用 V1 db.js: ${violationsByRule['DB_V1_DIRECT_IMPORT']?.count || 0} 处`);
console.log(`   - 直接引用 V2 dbV2.js: ${violationsByRule['DB_V2_DIRECT_IMPORT']?.count || 0} 处`);
console.log('   - ✅ 正确入口: stateRepository.js');

// 2. 媒体存储分叉
const mediaViolations = allViolations.filter(v => 
  v.ruleId === 'STORAGE_ADAPTER_DIRECT_IMPORT' || 
  v.ruleId === 'NATIVE_DIRECT_IMPORT' ||
  v.ruleId === 'OPFS_DIRECT_IMPORT'
);
console.log('\n2. 🎞️ 媒体存储访问分叉');
console.log(`   - 直接引用 storageAdapter.js: ${violationsByRule['STORAGE_ADAPTER_DIRECT_IMPORT']?.count || 0} 处`);
console.log(`   - 直接引用 native.js: ${violationsByRule['NATIVE_DIRECT_IMPORT']?.count || 0} 处`);
console.log(`   - 直接引用 opfs.js: ${violationsByRule['OPFS_DIRECT_IMPORT']?.count || 0} 处`);
console.log('   - ✅ 正确入口: mediaRepository.js');

// 3. 导入服务分叉
console.log('\n3. 📥 导入服务分叉');
console.log(`   - 直接引用旧 importService.js: ${violationsByRule['IMPORTSERVICE_DUPLICATE']?.count || 0} 处`);
console.log('   - ✅ 正确入口: services/import/importService.js');

// ============================================
// 迁移方案
// ============================================
console.log('\n' + '='.repeat(80));
console.log('📋 统一迁移方案');
console.log('='.repeat(80));

console.log('\n🔧 执行步骤:');

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ 所有核心分叉点已统一！项目架构符合"唯一入口"原则。\n');
} else {
  console.log('\n需要执行以下修复:');
  
  let step = 1;
  if (violationsByRule['DB_V1_DIRECT_IMPORT']?.count > 0) {
    console.log(`\n${step}. 统一 V1 数据库入口`);
    console.log(`   将 ${violationsByRule['DB_V1_DIRECT_IMPORT'].count} 处直接引用改为: import { ... } from '@/repositories/stateRepository'`);
    step++;
  }
  
  if (violationsByRule['DB_V2_DIRECT_IMPORT']?.count > 0) {
    console.log(`\n${step}. 统一 V2 数据库入口`);
    console.log(`   将 ${violationsByRule['DB_V2_DIRECT_IMPORT'].count} 处直接引用改为: import { ... } from '@/repositories/stateRepository'`);
    step++;
  }
  
  if (mediaViolations.length > 0) {
    console.log(`\n${step}. 统一媒体存储入口`);
    console.log(`   将 ${mediaViolations.length} 处直接引用改为: import { ... } from '@/repositories/mediaRepository'`);
    step++;
  }
  
  if (violationsByRule['IMPORTSERVICE_DUPLICATE']?.count > 0) {
    console.log(`\n${step}. 统一导入服务入口`);
    console.log(`   将 ${violationsByRule['IMPORTSERVICE_DUPLICATE'].count} 处引用统一指向 services/import/importService.js`);
    step++;
  }
}

// ============================================
// 最终出口
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🚪 统一后的唯一入口');
console.log('='.repeat(80));

console.log(`
1. 📊 状态数据唯一入口
   src/repositories/stateRepository.js
   - 封装所有 V1/V2 数据库操作
   - 业务层唯一数据访问入口

2. 🎞️ 媒体存储唯一入口
   src/repositories/mediaRepository.js
   - 封装 storageAdapter / opfs / native
   - 所有媒体读写必须通过此处

3. 📥 导入服务唯一入口
   src/services/import/importService.js
   - 统一的导入处理逻辑
`);

// 退出码
process.exit(errors.length > 0 ? 1 : 0);
