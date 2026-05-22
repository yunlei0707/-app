#!/usr/bin/env node
/**
 * 🛡️ 架构分层自动检测脚本
 * 防止越层调用和回退到旧入口
 * 
 * 核心原则：任何能力只能有一个业务入口
 * 
 * 使用方式：
 *   node scripts/check-architecture.js
 *   npm run check:arch
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
let hasErrors = false;
let errorCount = 0;

// ============================================================
// 违规模式定义
// ============================================================
const VIOLATION_PATTERNS = [
  {
    name: '业务层直接引用 db.js',
    description: '应通过 stateRepository 访问数据库',
    pattern: /from\s+['"]\.*\/utils\/db['"]/,
    exclude: [/repositories\//]
  },
  {
    name: '业务层直接引用 dbV2.js',
    description: '应通过 stateRepository 访问数据库',
    pattern: /from\s+['"]\.*\/utils\/dbV2['"]/,
    exclude: [/repositories\//, /adapters\//]
  },
  {
    name: '业务层直接引用 storageAdapter.js',
    description: '应通过 mediaRepository 访问媒体存储',
    pattern: /from\s+['"]\.*\/(adapters|utils)\/storageAdapter['"]/,
    exclude: [/repositories\//]
  },
  {
    name: '业务层直接引用 native.js',
    description: '应通过 mediaRepository 或对应 adapter',
    pattern: /from\s+['"]\.*\/utils\/native['"]/,
    exclude: [/adapters\//, /repositories\//]
  },
  {
    name: '业务层直接引用 opfs.js',
    description: '应通过 mediaRepository 或对应 adapter',
    pattern: /from\s+['"]\.*\/utils\/opfs['"]/,
    exclude: [/adapters\//, /repositories\//, /utils\//]
  },
  {
    name: 'UI/页面层直接使用 localStorage',
    description: '敏感数据应通过 stateRepository 或 AppContext 管理',
    pattern: /localStorage\.(get|set|remove|clear)/,
    exclude: [
      /adapters\//, 
      /repositories\//, 
      /core\//, 
      /services\//, 
      /utils\//,
      /store\//,
      /ui\//
    ]
  }
];

// ============================================================
// 文件扫描逻辑
// ============================================================
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
  const fileViolations = [];
  
  VIOLATION_PATTERNS.forEach(rule => {
    // 检查是否在排除列表中
    const isExcluded = rule.exclude.some(pattern => pattern.test(relativePath));
    if (isExcluded) return;
    
    // 检查是否匹配违规模式
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        fileViolations.push({
          rule: rule.name,
          description: rule.description,
          line: index + 1,
          content: line.trim()
        });
      }
    });
  });
  
  return fileViolations;
}

// ============================================================
// 主程序
// ============================================================
console.log('\n🛡️  架构分层自动检测中...\n');

const allFiles = scanDirectory(SRC_DIR);
console.log(`📁 扫描文件数: ${allFiles.length}\n`);

const allViolations = [];

allFiles.forEach(filePath => {
  const violations = checkFile(filePath);
  if (violations.length > 0) {
    const relativePath = path.relative(SRC_DIR, filePath);
    allViolations.push({ file: relativePath, violations });
  }
});

// ============================================================
// 输出结果
// ============================================================
if (allViolations.length === 0) {
  console.log('✅  架构检测通过！所有引用符合分层规范。\n');
  process.exit(0);
} else {
  console.log('❌  发现架构违规引用：\n');
  
  allViolations.forEach(({ file, violations }) => {
    console.log(`📄  ${file}`);
    violations.forEach(v => {
      console.log(`   行 ${v.line}: ${v.content}`);
      console.log(`      ❌ ${v.rule}`);
      console.log(`      💡 ${v.description}\n`);
      errorCount++;
    });
  });
  
  console.log(`\n❌  总计 ${errorCount} 处架构违规\n`);
  console.log('📋 修复指南：');
  console.log('   1. 数据库访问：import { ... } from \'@/repositories/stateRepository\'');
  console.log('   2. 媒体存储访问：import { ... } from \'@/repositories/mediaRepository\'');
  console.log('   3. 底层 driver 只能在 repository 或 adapter 层引用\n');
  
  process.exit(1);
}
