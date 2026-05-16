#!/bin/bash
echo "===================================="
echo "  宝贝时光 v3.0 - 完整版"
echo "===================================="
echo ""
echo "浏览器访问: http://localhost:8080"
echo ""
cd "$(dirname "$0")/dist"
python3 -m http.server 8080
