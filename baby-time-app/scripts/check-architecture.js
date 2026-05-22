#!/usr/bin/env node

/**
 * 架构守护脚本
 * 检测越层 import，违反规则直接报错
 * 
 * 分层规则（从上到下）：
 *   ui/       → 只能调 state/
 *   state/    → 只能调 services/
 *   services/ → 只能调 repositories/
 *   repositories/ → 只能调 core/ 或 utils/
 *   core/     → 底层能力，不依赖上层
 * 
 * 使用方式：
 *   node scripts/check-architecture.js
 *   或者配置到 pre-commit 钩子
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '../src');

// 分层规则：key 是当前层，value 是允许 import 的层
const RULES = {
  'ui/': ['state/', 'services/'],  // UI可以调状态和服务（放宽一点）
  'state/': ['services/'],
  'services/': ['repositories/', 'core/'],
  'repositories/': ['core/', 'utils/'],
  'core/': ['utils/'],
};

// 允许的例外（工具层、配置、数据，不参与分层）
const ALLOWED_IMPORTS = [
  'react',
  'react-dom',
  'lodash',
  'dayjs',
  'config/',
  'data/',
  'utils/',    // 工具层，所有层都可以用
  '*.css',     // 样式文件
  '*.scss',
];

function isAllowedImport(currentFile, importPath) {
  // 样式文件直接放行
  if (importPath.endsWith('.css') || importPath.endsWith('.scss')) {
    return true;
  }
  
  // 第三方库直接放行（不是相对路径）
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return true;
  }
  
  // 相对路径转绝对路径
  const fullImportPath = path.resolve(path.dirname(path.join(ROOT, currentFile)), importPath);
  const relativeImportPath = path.relative(ROOT, fullImportPath).replace(/\\/g, '/');
  
  // 检查是否是允许的例外路径
  for (const allowed of ALLOWED_IMPORTS) {
    if (allowed.endsWith('/') && relativeImportPath.startsWith(allowed.replace('/', ''))) {
      return true;
    }
    if (relativeImportPath.startsWith(allowed)) {
      return true;
    }
  }
  
  // 找到当前文件属于哪一层
  let currentLayer = null;
  for (const layer of Object.keys(RULES)) {
    if (currentFile.startsWith(layer)) {
      currentLayer = layer;
      break;
    }
  }
  
  // 不在分层体系内的（如 utils/）直接放行
  if (!currentLayer) {
    return true;
  }
  
  // 同层内调用允许
  if (relativeImportPath.startsWith(currentLayer.replace('/', ''))) {
    return true;
  }
  
  // 检查 import 的层是否在允许列表中
  const allowedLayers = RULES[currentLayer];
  for (const allowedLayer of allowedLayers) {
    if (relativeImportPath.startsWith(allowedLayer.replace('/', ''))) {
      return true;
    }
  }
  
  return false;
}

function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  const imports = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

function scanDirectory(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...scanDirectory(fullPath));
    } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function main() {
  console.log('🔍 开始检测架构分层...\n');
  
  const files = scanDirectory(ROOT);
  const errors = [];
  
  for (const file of files) {
    const relativePath = path.relative(ROOT, file).replace(/\\/g, '/');
    const imports = extractImports(file);
    
    for (const importPath of imports) {
      // 跳过第三方库
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }
      
      if (!isAllowedImport(relativePath, importPath)) {
        errors.push({
          file: relativePath,
          import: importPath,
          message: `越层调用: ${relativePath} → ${importPath}`
        });
      }
    }
  }
  
  if (errors.length === 0) {
    console.log('✅ 架构分层检测通过！');
    process.exit(0);
  } else {
    console.log('❌ 发现越层调用，请修复：\n');
    for (const error of errors) {
      console.log(`  📁 ${error.file}`);
      console.log(`     ❌ import "${error.import}"`);
      console.log();
    }
    console.log(`\n总共发现 ${errors.length} 处违规`);
    console.log('\n请参考分层规则：');
    console.log('  ui/       → 只能调 state/ 或 services/');
    console.log('  state/    → 只能调 services/');
    console.log('  services/ → 只能调 repositories/ 或 core/');
    console.log('  repositories/ → 只能调 core/ 或 utils/');
    process.exit(1);
  }
}

main();