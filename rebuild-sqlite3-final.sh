#!/bin/bash

# 彻底修复 sqlite3 问题 - 清除缓存并重新编译
# 适用于 Linux 服务器

set -e

APP_DIR="/tmp/poker-game"

echo "========================================="
echo "  彻底修复 sqlite3 问题"
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

# 1. 停止应用
echo ""
echo "步骤 1/6: 停止应用..."
if pm2 list | grep -q "poker-game"; then
    pm2 stop poker-game
    print_success "应用已停止"
else
    echo "应用未运行"
fi

# 2. 清除 npm 缓存
echo ""
echo "步骤 2/6: 清除 npm 缓存..."
npm cache clean --force
print_success "npm 缓存已清除"

# 3. 完全删除 node_modules
echo ""
echo "步骤 3/6: 完全删除 node_modules..."
cd $APP_DIR
rm -rf backend/node_modules
rm -rf node_modules
print_success "node_modules 已完全删除"

# 4. 删除 package-lock.json
echo ""
echo "步骤 4/6: 删除 package-lock.json..."
cd $APP_DIR/backend
rm -f package-lock.json
print_success "package-lock.json 已删除"

# 5. 重新安装依赖（强制从源码编译 sqlite3）
echo ""
echo "步骤 5/6: 重新安装依赖（强制从源码编译）..."
cd $APP_DIR/backend
npm install --build-from-source
print_success "依赖安装完成"

# 6. 重启应用（使用绝对路径）
echo ""
echo "========================================="
echo "  重启应用"
echo "========================================="
# 停止旧进程
pm2 delete poker-game 2>/dev/null || true
# 使用绝对路径启动
pm2 start $APP_DIR/backend/server.js --name "poker-game"

# 等待几秒
sleep 5

# 检查状态
echo ""
echo "应用状态:"
pm2 status poker-game

# 检查日志
echo ""
echo "最近的日志:"
pm2 logs poker-game --lines 20 --nostream

print_success "修复完成！"
echo ""
echo "如果还有问题，请查看完整日志："
echo "  pm2 logs poker-game"
