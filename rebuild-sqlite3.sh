#!/bin/bash

# 简单修复 sqlite3 问题 - 重新编译
# 适用于 Linux 服务器

set -e

APP_DIR="/tmp/poker-game"

echo "========================================="
echo "  重新编译 sqlite3 模块"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 1. 停止应用
echo ""
echo "步骤 1/3: 停止应用..."
if pm2 list | grep -q "poker-game"; then
    pm2 stop poker-game
    print_success "应用已停止"
else
    echo "应用未运行"
fi

# 2. 删除 node_modules（包含 Windows 编译的 sqlite3）
echo ""
echo "步骤 2/4: 删除 node_modules..."
cd $APP_DIR
rm -rf backend/node_modules
print_success "backend/node_modules 已删除"

# 3. 重新安装依赖（在 Linux 上编译 sqlite3）
echo ""
echo "步骤 3/4: 重新安装依赖..."
cd $APP_DIR/backend
npm install
print_success "依赖安装完成"

# 4. 重启应用
echo ""
echo "========================================="
echo "  重启应用"
echo "========================================="
pm2 restart poker-game

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
