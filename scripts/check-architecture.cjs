#!/usr/bin/env node

/**
 * 架构分层检测脚本
 * 在 git commit 前自动运行，检查是否有越层调用
 * 
 * 使用方式：
 *   node scripts/check-architecture.js
 * 
 * 返回码：
 *   0 - 检测通过
 *   1 - 检测失败，阻止 commit
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('🛡️  ========================================');
console.log('   架构分层检测 - pre-commit 自动检查');
console.log('   ========================================');
console.log('');

// 分层规则：谁可以依赖谁
const LAYER_RULES = {
  ui: ['state', 'services', 'utils', 'config', 'data'],
  state: ['services', 'repositories', 'utils', 'config', 'data'],
  services: ['repositories', 'core', 'utils', 'config', 'data'],
  repositories: ['core', 'utils', 'config', 'data'],
  core: ['utils', 'config', 'data'],
  utils: [],
};

// 目录到层的映射
const DIR_TO_LAYER = {
  'components': 'ui',
  'pages': 'ui',
  'store': 'state',
  'services': 'services',
  'repositories': 'repositories',
  'core': 'core',
  'utils': 'utils',
  'hooks': 'ui',
  'adapters': 'utils',
};

// 检查的文件扩展名
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// 需要跳过的目录
const SKIP_DIRS = ['node_modules', 'dist', '.git', 'build'];

// 统计
let totalFiles = 0;
let violations = [];

// 递归遍历目录
function scanDir(dir, baseDir = dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(file)) {
        scanDir(fullPath, baseDir);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (EXTENSIONS.includes(ext)) {
        checkFile(fullPath, baseDir);
      }
    }
  }
}

// 检查单个文件
function checkFile(filePath, baseDir) {
  totalFiles++;
  
  const relativePath = path.relative(baseDir, filePath);
  const parts = relativePath.split(path.sep);
  
  // 判断文件属于哪一层
  let fileLayer = null;
  for (const part of parts) {
    if (DIR_TO_LAYER[part]) {
      fileLayer = DIR_TO_LAYER[part];
      break;
    }
  }
  
  // 如果无法判断属于哪一层，跳过（比如 App.jsx 在根目录）
  if (!fileLayer) return;
  
  // 读取文件内容
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 检查所有 import 语句
  const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    // 只检查我们的 alias 路径
    if (!importPath.startsWith('@')) continue;
    
    // 判断 import 的是哪一层
    let importLayer = null;
    const alias = importPath.split('/')[0];
    
    if (alias === '@ui') importLayer = 'ui';
    else if (alias === '@components') importLayer = 'ui';
    else if (alias === '@pages') importLayer = 'ui';
    else if (alias === '@state') importLayer = 'state';
    else if (alias === '@store') importLayer = 'state';
    else if (alias === '@services') importLayer = 'services';
    else if (alias === '@repositories') importLayer = 'repositories';
    else if (alias === '@core') importLayer = 'core';
    else if (alias === '@utils') importLayer = 'utils';
    else if (['@config', '@data', '@assets', '@hooks'].includes(alias)) continue; // 通用层任何人都可以访问
    else continue; // 其他 alias 跳过
    
    // 检查是否越层
    const allowedLayers = LAYER_RULES[fileLayer] || [];
    if (!allowedLayers.includes(importLayer) && fileLayer !== importLayer) {
      // 同层可以互相访问
      violations.push({
        file: relativePath,
        fileLayer,
        importPath,
        importLayer,
        line: getLineNumber(content, match.index),
      });
    }
  }
}

// 获取行号
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// 运行检测
const srcDir = path.join(process.cwd(), 'src');
scanDir(srcDir, srcDir);

// 输出结果
console.log(`📁 扫描文件：${totalFiles} 个`);
console.log(`⚠️  发现违规：${violations.length} 处`);
console.log('');

if (violations.length > 0) {
  console.log('❌ 发现以下越层调用：');
  console.log('');
  
  violations.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.file}:${v.line}`);
    console.log(`     ❌ ${v.fileLayer.toUpperCase()} 层 → ${v.importLayer.toUpperCase()} 层`);
    console.log(`        ${v.importPath}`);
    console.log('');
  });
  
  console.log('📖 参考文档：docs/ARCHITECTURE_DEVELOPER_GUIDE.md');
  console.log('');
  console.log('💡 修复建议：');
  console.log('   • 不要跨层调用，应该通过中间层包装');
  console.log('   • ui → services → repositories → core');
  console.log('   • 禁止反向依赖');
  console.log('');
  
  // 阻止 commit
  console.log('🚫 架构检测未通过，commit 已阻止');
  console.log('');
  process.exit(1);
} else {
  console.log('✅ 架构分层检测通过！');
  console.log('');
  process.exit(0);
}
