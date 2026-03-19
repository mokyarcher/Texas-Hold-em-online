#!/bin/bash

# 修复 sqlite3 模块编译问题
# 适用于 Linux 服务器

set -e

APP_DIR="/opt/poker-game"

echo "========================================="
echo "  修复 sqlite3 模块"
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
echo "步骤 1/4: 停止应用..."
if pm2 list | grep -q "poker-game"; then
    pm2 stop poker-game
    print_success "应用已停止"
else
    print_warning "应用未运行"
fi

# 2. 删除 node_modules
echo ""
echo "步骤 2/4: 删除 node_modules..."
cd $APP_DIR
rm -rf node_modules
print_success "node_modules 已删除"

# 3. 安装编译工具
echo ""
echo "步骤 3/4: 安装编译工具..."
if [ -f /etc/redhat-release ]; then
    # CentOS/RHEL
    print_warning "检测到 CentOS/RHEL 系统"
    yum install -y python3 make gcc-c++
elif [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    print_warning "检测到 Debian/Ubuntu 系统"
    apt-get update
    apt-get install -y python3 make g++ gcc build-essential
fi
print_success "编译工具安装完成"

# 4. 重新安装依赖
echo ""
echo "步骤 4/4: 重新安装依赖..."
npm install --build-from-source

print_success "依赖安装完成"

# 5. 重启应用
echo ""
echo "========================================="
echo "  重启应用"
echo "========================================="
pm2 restart poker-game

# 等待几秒
sleep 3

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
