#!/bin/bash

# 德州扑克游戏 - 快速更新脚本

set -e

APP_NAME="poker-game"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/$APP_NAME-backup"

echo "========================================="
echo "  德州扑克游戏 - 更新脚本"
echo "========================================="

# 1. 备份当前版本
echo ""
echo "步骤 1/5: 备份当前版本..."
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
cp -r $APP_DIR $BACKUP_DIR/$BACKUP_NAME
echo "✓ 备份完成: $BACKUP_NAME"

# 2. 停止应用
echo ""
echo "步骤 2/5: 停止应用..."
pm2 stop $APP_NAME
echo "✓ 应用已停止"

# 3. 更新文件
echo ""
echo "步骤 3/5: 更新应用文件..."
echo "请确保新文件已上传到 /tmp/poker-game-new"
echo ""

read -p "是否继续更新? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "更新已取消，正在恢复应用..."
    pm2 restart $APP_NAME
    exit 1
fi

# 备份新文件
cp -r /tmp/poker-game-new /tmp/poker-game-new-backup-$(date +%Y%m%d-%H%M%S)

# 更新后端
echo "更新后端文件..."
rm -rf $APP_DIR/backend
cp -r /tmp/poker-game-new/backend $APP_DIR/

# 更新前端
echo "更新前端文件..."
rm -rf $APP_DIR/frontend
cp -r /tmp/poker-game-new/frontend $APP_DIR/

# 更新配置文件
if [ -f /tmp/poker-game-new/package.json ]; then
    cp /tmp/poker-game-new/package.json $APP_DIR/
fi

if [ -f /tmp/poker-game-new/.env.example ]; then
    cp /tmp/poker-game-new/.env.example $APP_DIR/.env.example
fi

echo "✓ 文件更新完成"

# 4. 安装依赖
echo ""
echo "步骤 4/5: 安装依赖..."
cd $APP_DIR
npm install --production
echo "✓ 依赖安装完成"

# 5. 重启应用
echo ""
echo "步骤 5/5: 重启应用..."
pm2 restart $APP_NAME
echo "✓ 应用已重启"

# 显示状态
echo ""
echo "========================================="
echo "  更新完成"
echo "========================================="
echo ""
pm2 status $APP_NAME
echo ""
echo "查看日志: pm2 logs $APP_NAME"
echo ""
echo "如果出现问题，可以从以下位置恢复备份:"
echo "  $BACKUP_DIR/$BACKUP_NAME"
