#!/bin/bash

# 彻底修复 sqlite3 问题 - 使用 better-sqlite3
# 适用于 Linux 服务器

set -e

APP_DIR="/opt/poker-game"

echo "========================================="
echo "  彻底修复 sqlite3 问题"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
    print_warning "应用未运行"
fi

# 2. 完全删除 node_modules
echo ""
echo "步骤 2/6: 完全删除 node_modules..."
cd $APP_DIR
rm -rf node_modules
print_success "node_modules 已删除"

# 3. 备份 package.json
echo ""
echo "步骤 3/6: 备份 package.json..."
cp package.json package.json.backup
print_success "package.json 已备份"

# 4. 替换 sqlite3 为 better-sqlite3
echo ""
echo "步骤 4/6: 替换 sqlite3 为 better-sqlite3..."
sed -i 's/"sqlite3"/"better-sqlite3"/g' package.json
print_success "已将 sqlite3 替换为 better-sqlite3"

# 5. 重新安装依赖
echo ""
echo "步骤 5/6: 重新安装依赖..."
npm install
print_success "依赖安装完成"

# 6. 重启应用
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
