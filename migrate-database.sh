#!/bin/bash

# 数据库迁移脚本 - 添加 avatar 字段
# 适用于 Linux 服务器

set -e

DB_PATH="/tmp/poker-game/backend/db/poker.db"

echo "========================================="
echo "  数据库迁移 - 添加 avatar 字段"
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

# 1. 检查数据库文件是否存在
echo ""
echo "步骤 1/3: 检查数据库文件..."
if [ ! -f "$DB_PATH" ]; then
    print_error "数据库文件不存在: $DB_PATH"
    exit 1
fi
print_success "数据库文件存在"

# 2. 检查 avatar 字段是否已存在
echo ""
echo "步骤 2/3: 检查 avatar 字段..."
AVATAR_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(users);" | grep -c "avatar")

if [ ! -z "$AVATAR_EXISTS" ]; then
    print_warning "avatar 字段已存在，跳过迁移"
    exit 0
fi
print_success "avatar 字段不存在，需要添加"

# 3. 添加 avatar 字段
echo ""
echo "步骤 3/3: 添加 avatar 字段..."
sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '👤';"

if [ $? -eq 0 ]; then
    print_success "avatar 字段添加成功"
else
    print_error "avatar 字段添加失败"
    exit 1
fi

# 4. 验证字段是否添加成功
echo ""
echo "验证字段..."
AVATAR_EXISTS_AFTER=$(sqlite3 "$DB_PATH" "PRAGMA table_info(users);" | grep -c "avatar")

if [ ! -z "$AVATAR_EXISTS_AFTER" ]; then
    print_success "avatar 字段验证成功"
else
    print_error "avatar 字段验证失败"
    exit 1
fi

echo ""
echo "========================================="
echo "  迁移完成"
echo "========================================="
echo ""
print_success "数据库迁移成功完成！"
echo ""
echo "现在可以重启应用了："
echo "  pm2 restart poker-game"
