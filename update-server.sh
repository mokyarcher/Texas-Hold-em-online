#!/bin/bash

# ============================================================
# 德州扑克游戏 - 服务器端更新脚本
# 在服务器上执行此脚本进行更新
# 使用方式: ./update-server.sh
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
APP_NAME="poker-game"
APP_DIR="/opt/game/$APP_NAME"
BACKUP_DIR="/opt/game/backups"
UPDATE_DIR="/opt/game/update"
DB_FILE="$APP_DIR/backend/db/poker.db"

# 函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_step() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}  步骤 $1/8: $2${NC}"
    echo -e "${BLUE}=========================================${NC}"
}

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    print_error "请使用 root 用户或 sudo 运行此脚本"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  德州扑克游戏 - 服务器更新脚本${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# ============================================================
# 步骤 1: 检查更新文件
# ============================================================
print_step "1" "检查更新文件"

if [ ! -d "$UPDATE_DIR" ]; then
    print_error "未找到更新目录: $UPDATE_DIR"
    print_info "请将新版本文件上传到 $UPDATE_DIR 目录"
    print_info "上传方式: scp -r poker-game-new/* root@服务器IP:$UPDATE_DIR/"
    exit 1
fi

if [ ! -f "$UPDATE_DIR/backend/server.js" ]; then
    print_error "更新目录中未找到有效的后端文件"
    print_info "请确保上传了完整的项目文件"
    exit 1
fi

print_success "更新文件检查通过"

# ============================================================
# 步骤 2: 备份当前版本
# ============================================================
print_step "2" "备份当前版本"

BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份代码（排除 node_modules 和数据库）
if [ -d "$APP_DIR" ]; then
    print_info "备份当前代码..."
    cd $APP_DIR
    tar -czf $BACKUP_DIR/${BACKUP_NAME}.tar.gz \
        --exclude="node_modules" \
        --exclude="*.db" \
        --exclude="*.log" \
        .
    print_success "代码备份完成: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    # 单独备份数据库
    if [ -f "$DB_FILE" ]; then
        print_info "备份数据库..."
        cp $DB_FILE $BACKUP_DIR/${BACKUP_NAME}.db
        print_success "数据库备份完成: $BACKUP_DIR/${BACKUP_NAME}.db"
    fi
else
    print_warning "未找到当前安装目录，跳过备份"
fi

# ============================================================
# 步骤 3: 停止服务
# ============================================================
print_step "3" "停止服务"

print_info "停止 PM2 服务..."
pm2 stop $APP_NAME 2>/dev/null || true
print_success "服务已停止"

# ============================================================
# 步骤 4: 更新文件
# ============================================================
print_step "4" "更新文件"

print_info "更新后端文件..."
rm -rf $APP_DIR/backend
mkdir -p $APP_DIR/backend
cp -r $UPDATE_DIR/backend/* $APP_DIR/backend/

print_info "更新前端文件..."
rm -rf $APP_DIR/frontend
mkdir -p $APP_DIR/frontend
cp -r $UPDATE_DIR/frontend/* $APP_DIR/frontend/

print_info "更新配置文件..."
if [ -f "$UPDATE_DIR/package.json" ]; then
    cp $UPDATE_DIR/package.json $APP_DIR/
fi
if [ -f "$UPDATE_DIR/.env.example" ]; then
    cp $UPDATE_DIR/.env.example $APP_DIR/
fi

print_success "文件更新完成"

# ============================================================
# 步骤 5: 安装依赖
# ============================================================
print_step "5" "安装依赖"

cd $APP_DIR/backend
print_info "安装 npm 依赖..."
npm install --production
print_success "依赖安装完成"

# ============================================================
# 步骤 6: 数据库迁移
# ============================================================
print_step "6" "数据库迁移"

if [ -f "$DB_FILE" ]; then
    print_info "检查数据库结构..."
    
    # 检查是否需要添加 game_count 字段
    if ! sqlite3 $DB_FILE ".schema rooms" | grep -q "game_count"; then
        print_warning "需要添加 game_count 字段"
        sqlite3 $DB_FILE "ALTER TABLE rooms ADD COLUMN game_count INTEGER DEFAULT 0;"
        print_success "数据库迁移完成"
    else
        print_success "数据库结构已是最新"
    fi
else
    print_warning "未找到数据库文件，将自动创建"
    mkdir -p $APP_DIR/backend/db
    touch $DB_FILE
fi

# ============================================================
# 步骤 7: 启动服务
# ============================================================
print_step "7" "启动服务"

cd $APP_DIR
print_info "启动 PM2 服务..."
pm2 start backend/server.js --name "$APP_NAME" --env production
pm2 save

print_success "服务已启动"

# ============================================================
# 步骤 8: 验证更新
# ============================================================
print_step "8" "验证更新"

print_info "检查服务状态..."
sleep 2

if pm2 list | grep -q "$APP_NAME"; then
    STATUS=$(pm2 list | grep "$APP_NAME" | awk '{print $10}')
    if [ "$STATUS" = "online" ]; then
        print_success "服务运行正常"
    else
        print_error "服务状态异常: $STATUS"
        print_info "请检查日志: pm2 logs $APP_NAME"
    fi
else
    print_error "服务未找到"
fi

# 测试端口
if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
    print_success "端口 3000 监听正常"
else
    print_warning "端口 3000 未监听，请检查服务"
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  更新完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo '服务器IP'):3000"
echo ""
echo "常用命令:"
echo "  查看状态: pm2 status $APP_NAME"
echo "  查看日志: pm2 logs $APP_NAME"
echo "  重启服务: pm2 restart $APP_NAME"
echo ""
echo "备份位置:"
echo "  代码: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
if [ -f "$BACKUP_DIR/${BACKUP_NAME}.db" ]; then
    echo "  数据库: $BACKUP_DIR/${BACKUP_NAME}.db"
fi
echo ""
print_success "更新成功！"
echo ""

# 清理更新目录
read -p "是否清理更新目录? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf $UPDATE_DIR
    print_success "更新目录已清理"
fi
