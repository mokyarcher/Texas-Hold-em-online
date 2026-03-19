@echo off
echo =====================================
echo   Git Auto Push Tool
echo =====================================

if "%~1"=="" (
    echo.
    echo 用法: git-auto-push.bat "提交信息"
    echo.
    pause
    exit /b 1
)

echo.
echo [1/3] 添加更改...
git add -A

echo.
echo [2/3] 提交: %~1
git commit -m "%~1"

echo.
echo [3/3] 推送到远程...
git push

echo.
echo =====================================
echo   完成！
echo =====================================
pause
