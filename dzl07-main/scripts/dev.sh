#!/bin/bash
# 本地预览脚本 - 启动开发服务器
echo "🌐 启动本地开发服务器..."
echo "📝 按 Ctrl+C 停止服务器"
echo ""

# 检查端口
PORT=5173
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 $PORT 已被占用，正在清理..."
    lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null
    sleep 1
fi

# 启动开发服务器
npm run dev -- --host 0.0.0.0
