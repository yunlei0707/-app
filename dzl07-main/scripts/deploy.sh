#!/bin/bash
# 一键部署脚本 - 拉取→构建→提交→推送
set -e

echo "🚀 开始一键部署..."

# 1. 检查工作区状态
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  工作区有未提交的修改"
  git status --short
fi

# 2. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 3. 构建验证
echo "🔨 构建验证中..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ 构建失败！请修复错误后再部署"
  exit 1
fi
echo "✅ 构建验证通过"

# 4. 提交所有修改
if [ -n "$(git status --porcelain)" ]; then
  MESSAGE="${1:-🔧 代码更新}"
  echo "📝 提交修改: $MESSAGE"
  git add .
  git commit -m "$MESSAGE"
fi

# 5. 推送
echo "📤 推送到远程仓库..."
git push origin main

echo "✅ 部署完成！Vercel正在自动构建中"
echo "🌐 查看部署状态: https://vercel.com/yunlei0707/dzl07"
