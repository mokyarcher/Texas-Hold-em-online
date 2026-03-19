#!/bin/bash

# Node.js 安装脚本
# 适用于 CentOS/RHEL/Ubuntu/Debian 系统

set -e

echo "========================================="
echo "  Node.js 安装脚本"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# 检测系统类型
echo ""
echo "检测系统类型..."
if [ -f /etc/redhat-release ]; then
    OS="centos"
    print_success "检测到 CentOS/RHEL 系统"
    cat /etc/redhat-release
elif [ -f /etc/debian_version ]; then
    OS="debian"
    print_success "检测到 Debian/Ubuntu 系统"
    cat /etc/os-release | grep PRETTY_NAME
else
    print_error "未知的系统类型"
    exit 1
fi

# 检查是否已安装 Node.js
echo ""
echo "检查 Node.js 安装状态..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js 已安装: $NODE_VERSION"
    read -p "是否重新安装? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "跳过安装"
        exit 0
    fi
    print_warning "将卸载现有 Node.js..."
    if [ "$OS" = "centos" ]; then
        yum remove -y nodejs npm || true
    else
        apt-get remove -y nodejs npm || true
    fi
fi

# 安装 Node.js
echo ""
echo "========================================="
echo "  开始安装 Node.js 18.x"
echo "========================================="

if [ "$OS" = "centos" ]; then
    # CentOS/RHEL 安装
    echo ""
    echo "安装 Node.js (CentOS/RHEL)..."
    
    # 安装必要的工具
    print_warning "安装必要的工具..."
    yum install -y curl wget
    
    # 添加 NodeSource 仓库
    print_warning "添加 NodeSource 仓库..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    
    # 安装 Node.js
    print_warning "安装 Node.js 和 npm..."
    yum install -y nodejs
    
    # 验证安装
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        NPM_VERSION=$(npm -v)
        print_success "Node.js 安装成功: $NODE_VERSION"
        print_success "npm 安装成功: $NPM_VERSION"
    else
        print_error "Node.js 安装失败"
        exit 1
    fi
    
elif [ "$OS" = "debian" ]; then
    # Debian/Ubuntu 安装
    echo ""
    echo "安装 Node.js (Debian/Ubuntu)..."
    
    # 更新包列表
    print_warning "更新包列表..."
    apt-get update
    
    # 安装必要的工具
    print_warning "安装必要的工具..."
    apt-get install -y curl wget build-essential
    
    # 添加 NodeSource 仓库
    print_warning "添加 NodeSource 仓库..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # 安装 Node.js
    print_warning "安装 Node.js 和 npm..."
    apt-get install -y nodejs
    
    # 验证安装
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        NPM_VERSION=$(npm -v)
        print_success "Node.js 安装成功: $NODE_VERSION"
        print_success "npm 安装成功: $NPM_VERSION"
    else
        print_error "Node.js 安装失败"
        exit 1
    fi
fi

# 安装 PM2（进程管理器）
echo ""
echo "========================================="
echo "  安装 PM2 进程管理器"
echo "========================================="
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v)
    print_success "PM2 已安装: $PM2_VERSION"
else
    print_warning "正在安装 PM2..."
    npm install -g pm2
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 -v)
        print_success "PM2 安装成功: $PM2_VERSION"
    else
        print_error "PM2 安装失败"
        exit 1
    fi
fi

# 配置 npm 镜像（可选）
echo ""
echo "========================================="
echo "  配置 npm 镜像"
echo "========================================="
read -p "是否配置淘宝 npm 镜像（推荐国内使用）? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "配置淘宝 npm 镜像..."
    npm config set registry https://registry.npmmirror.com
    print_success "npm 镜像配置完成"
    npm config get registry
fi

# 显示安装结果
echo ""
echo "========================================="
echo "  安装完成"
echo "========================================="
echo ""
echo "版本信息:"
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"
echo "  PM2: $(pm2 -v)"
echo ""
echo "npm 配置:"
echo "  全局安装路径: $(npm root -g)"
echo "  npm 镜像: $(npm config get registry)"
echo ""
print_success "所有组件安装完成！"
echo ""
echo "现在可以运行部署脚本了："
echo "  ./deploy.sh"
