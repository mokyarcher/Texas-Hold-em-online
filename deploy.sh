#!/bin/bash

# 德州扑克游戏部署脚本
# 适用于 Linux 服务器

set -e  # 遇到错误立即退出

echo "========================================="
echo "  德州扑克游戏 - 自动部署脚本"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="poker-game"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/$APP_NAME-backup"
LOG_DIR="/opt/$APP_NAME/logs"
PORT=3000

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}请使用 root 用户或 sudo 运行此脚本${NC}"
    exit 1
fi

# 函数：打印成功消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函数：打印警告消息
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 函数：打印错误消息
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. 检查 Node.js 环境
echo ""
echo "步骤 1/7: 检查 Node.js 环境..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js 已安装: $NODE_VERSION"
else
    print_error "Node.js 未安装"
    echo "请先安装 Node.js:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  apt-get install -y nodejs"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm 已安装: $NPM_VERSION"
else
    print_error "npm 未安装"
    exit 1
fi

# 2. 安装 PM2（进程管理器）
echo ""
echo "步骤 2/7: 安装 PM2..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v)
    print_success "PM2 已安装: $PM2_VERSION"
else
    print_warning "PM2 未安装，正在安装..."
    npm install -g pm2
    print_success "PM2 安装完成"
fi

# 3. 创建必要的目录
echo ""
echo "步骤 3/7: 创建目录结构..."
mkdir -p $APP_DIR
mkdir -p $LOG_DIR
mkdir -p $BACKUP_DIR
print_success "目录创建完成"

# 4. 备份现有应用（如果存在）
echo ""
echo "步骤 4/7: 备份现有应用..."
if [ -d "$APP_DIR/backend" ]; then
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r $APP_DIR $BACKUP_DIR/$BACKUP_NAME
    print_success "备份完成: $BACKUP_NAME"
else
    print_warning "未找到现有应用，跳过备份"
fi

# 5. 部署应用文件
echo ""
echo "步骤 5/7: 部署应用文件..."
echo "请确保当前目录包含以下文件:"
echo "  - backend/ (后端代码，包含 package.json)"
echo "  - frontend/ (前端代码)"
echo ""

read -p "是否继续部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "部署已取消"
    exit 1
fi

# 复制文件
cp -r backend $APP_DIR/
cp -r frontend $APP_DIR/
cp backend/package.json $APP_DIR/
cp .env.example $APP_DIR/.env 2>/dev/null || true

print_success "文件复制完成"

# 6. 安装依赖
echo ""
echo "步骤 6/7: 安装依赖..."
cd $APP_DIR
npm install --production
print_success "依赖安装完成"

# 7. 配置环境变量
echo ""
echo "步骤 7/7: 配置环境变量..."
if [ ! -f "$APP_DIR/.env" ]; then
    print_warning ".env 文件不存在，使用默认配置"
    cp .env.example .env
else
    print_success ".env 文件已存在"
fi

# 生成随机 JWT 密钥
if grep -q "poker-secret-key-change-in-production" $APP_DIR/.env; then
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/poker-secret-key-change-in-production.*/$JWT_SECRET/" $APP_DIR/.env
    print_success "JWT 密钥已更新"
fi

# 8. 启动应用
echo ""
echo "========================================="
echo "  启动应用"
echo "========================================="

# 停止旧进程
if pm2 list | grep -q "$APP_NAME"; then
    echo "停止旧进程..."
    pm2 stop $APP_NAME || true
    pm2 delete $APP_NAME || true
fi

# 启动新进程
echo "启动应用..."
pm2 start backend/server.js --name "$APP_NAME" --env production

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup | tail -n 1

print_success "应用启动完成"

# 9. 显示状态
echo ""
echo "========================================="
echo "  部署完成"
echo "========================================="
echo ""
echo "应用信息:"
echo "  应用名称: $APP_NAME"
echo "  应用目录: $APP_DIR"
echo "  日志目录: $LOG_DIR"
echo "  端口: $PORT"
echo ""
echo "常用命令:"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs $APP_NAME"
echo "  重启应用: pm2 restart $APP_NAME"
echo "  停止应用: pm2 stop $APP_NAME"
echo ""
print_success "部署成功完成！"
echo ""
echo "访问地址: http://your-server-ip:$PORT"
