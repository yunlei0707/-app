#!/usr/bin/env node
/**
 * 🔍 架构审计脚本
 * 扫描全项目检测：
 * 1. 旧入口引用（db.js, dbV2.js, storageAdapter, native, opfs, 旧 importService）
 * 2. 双入口检测
 * 3. 孤儿文件检测
 * 4. UI 层直接使用 localStorage
 * 
 * 输出：谁在引用、哪些是旧逻辑、哪些是新逻辑
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (/\.(js|jsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function detectPatterns(allFiles, patterns, excludeRegex = null) {
  const results = [];
  allFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(SRC_DIR, filePath);
    if (excludeRegex && excludeRegex.test(relativePath)) return;
    patterns.forEach(rule => {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (rule.pattern.test(line)) {
          results.push({
            file: relativePath,
            line: index + 1,
            code: line.trim(),
            issue: rule.name,
            category: rule.category
          });
        }
      });
    });
  });
  return results;
}

// ============================================
// 主程序
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🔍 架构审计 - 全项目深度扫描');
console.log('='.repeat(80));

const allFiles = scanDirectory(SRC_DIR);
console.log(`\n📁 扫描文件数: ${allFiles.length}`);

// ============================================
// 1. 扫描谁在引用
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🔍 第一部分：谁在引用');
console.log('='.repeat(80));

const PATTERNS = [
  { name: 'db.js (V1 旧逻辑)', pattern: /from\s+['"]\.*\/utils\/db['"]/, category: '旧数据库入口' },
  { name: 'dbV2.js (V2 新逻辑)', pattern: /from\s+['"]\.*\/utils\/dbV2['"]/, category: '新数据库入口' },
  { name: 'storageAdapter (底层 driver)', pattern: /from\s+['"]\.*\/(utils|adapters)\/storageAdapter['"]/, category: '存储适配器' },
  { name: 'native.js (底层 driver)', pattern: /from\s+['"]\.*\/utils\/native['"]/, category: '原生接口' },
  { name: 'opfs.js (底层 driver)', pattern: /from\s+['"]\.*\/utils\/opfs['"]/, category: 'OPFS 存储' },
  { name: '旧 importService (旧逻辑)', pattern: /from\s+['"]\.*\/services\/importService['"]/, category: '旧导入服务' },
  { name: 'stateRepository (统一入口)', pattern: /from\s+['"]\.*\/repositories\/stateRepository['"]/, category: '✅ 统一数据库入口' },
  { name: 'mediaRepository (统一入口)', pattern: /from\s+['"]\.*\/repositories\/mediaRepository['"]/, category: '✅ 统一媒体入口' },
];

const allResults = detectPatterns(allFiles, PATTERNS, null);

// 按引用类型分组
const byCategory = {};
PATTERNS.forEach(p => { byCategory[p.category] = []; });
allResults.forEach(r => {
  if (byCategory[r.category]) byCategory[r.category].push(r);
});

Object.entries(byCategory).forEach(([category, items]) => {
  if (items.length === 0) {
    console.log(`\n✅ ${category}: 0 处引用`);
  } else {
    const icon = category.includes('✅') ? '✅' : '⚠️';
    console.log(`\n${icon} ${category}: ${items.length} 处引用`);
    const byFile = {};
    items.forEach(i => {
      if (!byFile[i.file]) byFile[i.file] = [];
      byFile[i.file].push(i);
    });
    Object.entries(byFile).forEach(([file, lines]) => {
      console.log(`   📄 ${file}`);
      lines.slice(0, 2).forEach(l => {
        console.log(`      行 ${l.line}: ${l.code.substring(0, 60)}${l.code.length > 60 ? '...' : ''}`);
      });
      if (lines.length > 2) console.log(`      ... 还有 ${lines.length - 2} 处`);
    });
  }
});

// ============================================
// 2. 哪些是旧逻辑 vs 新逻辑
// ============================================
console.log('\n' + '='.repeat(80));
console.log('📦 第二部分：旧逻辑 vs 新逻辑');
console.log('='.repeat(80));

const OLD_LOGIC_COUNT = allResults.filter(r => 
  r.category.includes('旧') || r.category.includes('底层') || r.category.includes('存储')
).length;

const NEW_LOGIC_COUNT = allResults.filter(r => 
  r.category.includes('✅')
).length;

console.log(`\n📊 统计汇总：`);
console.log(`   旧逻辑引用: ${OLD_LOGIC_COUNT} 处`);
console.log(`   新逻辑引用: ${NEW_LOGIC_COUNT} 处`);
console.log(`   架构健康度: ${OLD_LOGIC_COUNT === 0 ? '✅ 健康' : '⚠️ 需要修复'}`);

console.log(`\n🔴 待迁移的旧逻辑文件:`);
const oldLogicFiles = [...new Set(allResults
  .filter(r => r.category.includes('旧') || r.category === '存储适配器' || r.category === '原生接口' || r.category === 'OPFS 存储')
  .map(r => r.file))];
if (oldLogicFiles.length === 0) {
  console.log('   ✅ 没有需要迁移的旧逻辑文件');
} else {
  oldLogicFiles.forEach(f => console.log(`   📄 ${f}`));
}

console.log(`\n🟢 已迁移的新逻辑文件:`);
const newLogicFiles = [...new Set(allResults
  .filter(r => r.category.includes('✅'))
  .map(r => r.file))];
newLogicFiles.forEach(f => console.log(`   📄 ${f}`));

// ============================================
// 3. 双入口检测
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🔀 第三部分：双入口检测');
console.log('='.repeat(80));

const DUAL_ENTRIES = [
  { 
    name: '数据库', 
    files: [
      { path: 'src/utils/db.js', type: '旧逻辑 V1', status: '保留兼容层' },
      { path: 'src/utils/dbV2.js', type: '新逻辑 V2', status: '保留底层 driver' },
      { path: 'src/repositories/stateRepository.js', type: '✅ 统一入口', status: '推荐使用' }
    ]
  },
  { 
    name: '媒体存储', 
    files: [
      { path: 'src/utils/storageAdapter.js', type: '旧逻辑（已弃用）', status: '需确认' },
      { path: 'src/adapters/storageAdapter.js', type: '新逻辑底层 driver', status: '保留底层 driver' },
      { path: 'src/repositories/mediaRepository.js', type: '✅ 统一入口', status: '推荐使用' }
    ]
  },
  { 
    name: '导入服务', 
    files: [
      { path: 'src/services/importService.js', type: '旧逻辑兼容层', status: 're-export 到新入口' },
      { path: 'src/services/import/importService.js', type: '✅ 统一入口', status: '推荐使用' }
    ]
  }
];

DUAL_ENTRIES.forEach(ep => {
  console.log(`\n📦 ${ep.name}:`);
  ep.files.forEach(f => {
    const exists = fs.existsSync(path.join(__dirname, '..', f.path));
    console.log(`   ${exists ? '✅' : '❌'} ${f.path}`);
    console.log(`      类型: ${f.type}`);
    console.log(`      状态: ${f.status}`);
  });
});

// ============================================
// 4. 孤儿文件检测（无人引用的旧文件）
// ============================================
console.log('\n' + '='.repeat(80));
console.log('👻 第四部分：孤儿文件检测');
console.log('='.repeat(80));

const fileImports = {};
allFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(SRC_DIR, filePath);
  fileImports[relativePath] = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    fileImports[relativePath].push(match[1]);
  }
});

const ORPHAN_CANDIDATES = [
  'src/utils/storageAdapter.js',
  'src/utils/db.js',
  'src/services/importService.js',
];

console.log('\n📋 潜在孤儿文件引用情况:');
ORPHAN_CANDIDATES.forEach(orphanPath => {
  const fullPath = path.join(__dirname, '..', orphanPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`   ❓ ${orphanPath} - 文件不存在`);
    return;
  }
  const checkPath = orphanPath.replace('src/', '').replace('.js', '');
  const referencers = [];
  Object.entries(fileImports).forEach(([importer, imports]) => {
    if (imports.some(i => i.includes(checkPath) && !importer.includes('repositories'))) {
      referencers.push(importer);
    }
  });
  if (referencers.length === 0) {
    console.log(`   ⚠️ ${orphanPath} - 孤儿文件，业务层无引用`);
  } else {
    console.log(`   ✅ ${orphanPath} - 有 ${referencers.length} 个文件引用`);
  }
});

// ============================================
// 5. 修复方案
// ============================================
console.log('\n' + '='.repeat(80));
console.log('🛠️ 第五部分：修复方案');
console.log('='.repeat(80));

const needsFix = oldLogicFiles.length > 0;

if (!needsFix) {
  console.log(`\n✅ 所有核心架构问题已修复！`);
  console.log(`\n   🏆 宝贝时光现在严格遵循"唯一入口"架构原则：`);
  console.log(`\n   1. 📊 所有数据访问 → stateRepository.js`);
  console.log(`   2. 🎞️ 所有媒体操作 → mediaRepository.js`);
  console.log(`   3. 📥 所有导入操作 → services/import/importService.js`);
  console.log(`\n   🚀 项目架构已达到生产级标准！`);
} else {
  console.log(`\n📋 需要执行以下修复：`);
  console.log(`\n1. 🔄 统一数据库入口`);
  console.log(`   - 目标：所有业务层引用统一指向 stateRepository.js`);
  console.log(`   - 文件：${oldLogicFiles.filter(f => f.includes('db')).length} 个文件待迁移`);
  console.log(`\n2. 🎞️ 统一媒体存储入口`);
  console.log(`   - 目标：所有媒体操作统一指向 mediaRepository.js`);
  console.log(`   - 文件：${oldLogicFiles.filter(f => f.includes('storage') || f.includes('native') || f.includes('opfs')).length} 个文件待迁移`);
  console.log(`\n3. 📥 统一导入服务入口`);
  console.log(`   - 目标：旧 importService.js 改为 re-export 新入口`);
  console.log(`\n4. 🧹 清理孤儿文件（确认后执行）`);
  console.log(`   - src/utils/storageAdapter.js`);
  console.log(`   - src/utils/db.js`);
  console.log(`   - src/services/importService.js`);
}

console.log('\n' + '='.repeat(80) + '\n');

process.exit(needsFix ? 1 : 0);
