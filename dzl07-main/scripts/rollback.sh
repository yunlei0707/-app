#!/bin/bash
# 一键回滚脚本 - 回滚到上一个commit
set -e

echo "⏪ 准备回滚到上一个commit..."

# 显示最近5个commit
echo "📜 最近5个commit:"
git log --oneline -5

# 确认
read -p "确认回滚到上一个commit吗？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消回滚"
    exit 0
fi

# 执行回滚
git reset --hard HEAD~1

echo "✅ 已回滚到上一个commit"
echo "📌 当前版本: $(git log --oneline -1)"

# 强制推送
read -p "是否强制推送到远程？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main --force
    echo "✅ 已强制推送"
fi
