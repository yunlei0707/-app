/**
 * 🚓 ESLint 架构分层检测插件
 *
 * 自动拦住越层调用，让工具帮我们守规矩
 *
 * 分层规则（从上层到下层）：
 *
 * ui/        → 可以 import: ui/, state/, services/, repositories/, core/, utils/
 * state/     → 可以 import: state/, services/, repositories/, core/, utils/
 * services/  → 可以 import: services/, repositories/, core/, utils/
 * repositories/ → 可以 import: repositories/, core/, utils/
 * core/      → 可以 import: core/, utils/
 * utils/     → 可以 import: utils/ （最底层，不能依赖上层）
 *
 * ❌ 禁止反向依赖：core 不能 import services / state / ui
 * ❌ 禁止跨层跳跃：ui 不能直接 import core（中间必须有 service/repository）
 */

const LAYER_ORDER = ['utils', 'core', 'repositories', 'services', 'state', 'ui'];

// 每层可以访问的层（包括自己和下层）
const ALLOWED_IMPORTS = {
  'ui': ['ui', 'state', 'services', 'repositories', 'core', 'utils'],
  'state': ['state', 'services', 'repositories', 'core', 'utils'],
  'services': ['services', 'repositories', 'core', 'utils'],
  'repositories': ['repositories', 'core', 'utils'],
  'core': ['core', 'utils'],
  'utils': ['utils']
};

// 带 alias 的路径映射
const ALIAS_MAP = {
  '@ui/': 'ui',
  '@state/': 'state',
  '@services/': 'services',
  '@repositories/': 'repositories',
  '@core/': 'core',
  '@utils/': 'utils',
  '@config/': 'utils',
  '@data/': 'utils'
};

function getFileLayer(filePath) {
  if (filePath.includes('/ui/')) return 'ui';
  if (filePath.includes('/state/')) return 'state';
  if (filePath.includes('/services/')) return 'services';
  if (filePath.includes('/repositories/')) return 'repositories';
  if (filePath.includes('/core/')) return 'core';
  if (filePath.includes('/utils/')) return 'utils';
  return null; // 不在分层目录内，跳过检查
}

function getImportLayer(importPath) {
  // 检查 alias
  for (const [alias, layer] of Object.entries(ALIAS_MAP)) {
    if (importPath.startsWith(alias)) {
      return layer;
    }
  }

  // 检查相对路径
  if (importPath.includes('/ui/')) return 'ui';
  if (importPath.includes('/state/')) return 'state';
  if (importPath.includes('/services/')) return 'services';
  if (importPath.includes('/repositories/')) return 'repositories';
  if (importPath.includes('/core/')) return 'core';
  if (importPath.includes('/utils/')) return 'utils';

  return null; // 第三方库或不在分层内，跳过检查
}

module.exports = {
  rules: {
    'no-cross-layer-import': {
      create(context) {
        const filePath = context.getFilename();
        const fileLayer = getFileLayer(filePath);

        // 不在分层目录内，跳过
        if (!fileLayer) {
          return {};
        }

        return {
          ImportDeclaration(node) {
            const importPath = node.source.value;
            const importLayer = getImportLayer(importPath);

            // 不是分层内的 import，跳过
            if (!importLayer) {
              return;
            }

            const allowed = ALLOWED_IMPORTS[fileLayer];

            // 检查是否越层
            if (!allowed.includes(importLayer)) {
              context.report({
                node,
                message: `🚓 架构越层检测：${fileLayer}/ 层不能直接 import ${importLayer}/ 层\n\n   请通过中间层调用，或检查分层规则：\n   ui → state → services → repositories → core → utils`
              });
            }

            // 额外检查：禁止跳跃多层（如 ui 直接 import core）
            const fileLayerIndex = LAYER_ORDER.indexOf(fileLayer);
            const importLayerIndex = LAYER_ORDER.indexOf(importLayer);

            if (fileLayer === 'ui' && importLayer === 'core') {
              context.report({
                node,
                message: `⚠️  UI 层建议不要直接依赖 Core 层\n\n   请通过 Service/Repository 层封装后再调用\n   分层设计：ui → state → services → repositories → core`
              });
            }
          }
        };
      }
    }
  }
};

console.log('✅ ESLint 架构分层检测插件已加载');
console.log('   分层规则：ui → state → services → repositories → core → utils');
