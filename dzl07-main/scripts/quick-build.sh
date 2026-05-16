#!/bin/bash
# 快速构建脚本 - 跳过压缩，用于快速验证语法
echo "🚀 快速构建验证中..."
npm run build 2>&1 | tail -15
if [ $? -eq 0 ]; then
  echo "✅ 构建成功！"
  exit 0
else
  echo "❌ 构建失败！"
  exit 1
fi
