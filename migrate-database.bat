@echo off
REM 数据库迁移脚本 - 添加 avatar 字段
REM 适用于 Windows 本地测试

setlocal enabledelayedexpansion

echo =========================================
echo  数据库迁移 - 添加 avatar 字段
echo =========================================

set DB_PATH=backend\db\poker.db

REM 1. 检查数据库文件是否存在
echo.
echo 步骤 1/3: 检查数据库文件...
if not exist "%DB_PATH%" (
    echo [错误] 数据库文件不存在: %DB_PATH%
    pause
    exit /b 1
)
echo [成功] 数据库文件存在

REM 2. 检查 avatar 字段是否已存在
echo.
echo 步骤 2/3: 检查 avatar 字段...
sqlite3 "%DB_PATH%" "PRAGMA table_info(users);" | findstr /C:"avatar" >nul

if %errorlevel% equ 0 (
    echo [警告] avatar 字段已存在，跳过迁移
    pause
    exit /b 0
)
echo [成功] avatar 字段不存在，需要添加

REM 3. 添加 avatar 字段
echo.
echo 步骤 3/3: 添加 avatar 字段...
sqlite3 "%DB_PATH%" "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '👤';"

if %errorlevel% equ 0 (
    echo [成功] avatar 字段添加成功
) else (
    echo [错误] avatar 字段添加失败
    pause
    exit /b 1
)

REM 4. 验证字段是否添加成功
echo.
echo 验证字段...
sqlite3 "%DB_PATH%" "PRAGMA table_info(users);" | findstr /C:"avatar" >nul

if %errorlevel% equ 0 (
    echo [成功] avatar 字段验证成功
) else (
    echo [错误] avatar 字段验证失败
    pause
    exit /b 1
)

echo.
echo =========================================
echo  迁移完成
echo =========================================
echo.
echo [成功] 数据库迁移成功完成！
echo.
echo 现在可以重启应用了：
echo   cd backend
echo   npm start
echo.
pause
