@echo off
echo ====================================
echo   宝贝时光 v3.0 - 完整版
echo ====================================
echo.
echo 正在启动...
echo 浏览器访问: http://localhost:8080
echo.
echo 按 Ctrl+C 停止
echo.
cd /d "%~dp0\dist"
python -m http.server 8080
pause
