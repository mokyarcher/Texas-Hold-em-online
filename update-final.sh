#!/bin/bash

# 德州扑克游戏 - 快速更新脚本
# 适用于 /tmp/poker-game 目录

set -e

APP_NAME="poker-game"
APP_DIR="/tmp/poker-game"
BACKUP_DIR="/tmp/poker-game-backup"

echo "========================================="
echo "  德州扑克游戏 - 更新脚本"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. 备份当前版本
echo ""
echo "步骤 1/6: 备份当前版本..."
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r $APP_DIR $BACKUP_DIR/$BACKUP_NAME
print_success "备份完成: $BACKUP_NAME"

# 2. 停止应用
echo ""
echo "步骤 2/6: 停止应用..."
if pm2 list | grep -q "$APP_NAME"; then
    pm2 stop $APP_NAME
    print_success "应用已停止"
else
    print_warning "应用未运行"
fi

# 3. 更新文件
echo ""
echo "步骤 3/6: 更新应用文件..."
echo "请确保新文件已上传到 /tmp/poker-game-new"
echo ""

read -p "是否继续更新? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "更新已取消，正在恢复应用..."
    pm2 restart $APP_NAME
    exit 1
fi

# 检查新文件是否存在
if [ ! -d "/tmp/poker-game-new" ]; then
    print_error "错误: /tmp/poker-game-new 目录不存在"
    print_warning "请先将新版本文件上传到 /tmp/poker-game-new"
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

print_success "文件更新完成"

# 4. 重新安装依赖（处理 sqlite3 编译问题）
echo ""
echo "步骤 4/6: 重新安装依赖..."
cd $APP_DIR/backend
rm -rf node_modules
rm -f package-lock.json
npm install --build-from-source
print_success "依赖安装完成"

# 5. 保存 PM2 配置
echo ""
echo "步骤 5/6: 保存 PM2 配置..."
pm2 save
print_success "PM2 配置已保存"

# 6. 重启应用
echo ""
echo "步骤 6/6: 重启应用..."
pm2 restart $APP_NAME
print_success "应用已重启"

# 等待几秒
sleep 5

# 显示状态
echo ""
echo "========================================="
echo "  更新完成"
echo "========================================="
echo ""
echo "应用状态:"
pm2 status $APP_NAME
echo ""
echo "最近的日志:"
pm2 logs $APP_NAME --lines 20 --nostream
echo ""
print_success "更新成功完成！"
echo ""
echo "查看完整日志: pm2 logs $APP_NAME"
echo ""
echo "如果出现问题，可以从以下位置恢复备份:"
echo "  $BACKUP_DIR/$BACKUP_NAME"
