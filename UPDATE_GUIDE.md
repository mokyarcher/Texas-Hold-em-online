# 德州扑克游戏 - 更新指南

## 📋 更新步骤

### 方法一：使用自动更新脚本（推荐）

#### 1. 在本地准备新版本

确保你的本地项目已经更新到最新版本。

#### 2. 上传新版本到服务器

```bash
# 在本地执行（Windows PowerShell）
scp -r Texas-Hold-em-LAN root@your-server-ip:/tmp/poker-game-new
```

**注意：** 上传到 `/tmp/poker-game-new`，不要覆盖 `/tmp/poker-game`

#### 3. 登录服务器

```bash
ssh root@your-server-ip
```

#### 4. 上传并运行更新脚本

```bash
# 上传更新脚本
scp update-final.sh root@your-server-ip:/tmp/

# 登录服务器后运行
cd /tmp
chmod +x update-final.sh
sudo ./update-final.sh
```

#### 5. 确认更新

脚本会提示：
```
步骤 3/6: 更新应用文件...
请确保新文件已上传到 /tmp/poker-game-new

是否继续更新? (y/n)
```

输入 `y` 确认更新。

---

### 方法二：手动更新

#### 1. 备份当前版本

```bash
# 创建备份
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p /tmp/poker-game-backup
cp -r /tmp/poker-game /tmp/poker-game-backup/$BACKUP_NAME
```

#### 2. 停止应用

```bash
pm2 stop poker-game
```

#### 3. 上传新版本

```bash
# 在本地执行
scp -r Texas-Hold-em-LAN root@your-server-ip:/tmp/poker-game-new
```

#### 4. 更新文件

```bash
# 更新后端
rm -rf /tmp/poker-game/backend
cp -r /tmp/poker-game-new/backend /tmp/poker-game/

# 更新前端
rm -rf /tmp/poker-game/frontend
cp -r /tmp/poker-game-new/frontend /tmp/poker-game/

# 更新配置文件（如果存在）
cp /tmp/poker-game-new/package.json /tmp/poker-game/ 2>/dev/null || true
cp /tmp/poker-game-new/.env.example /tmp/poker-game/ 2>/dev/null || true
```

#### 5. 重新安装依赖（处理 sqlite3）

```bash
cd /tmp/poker-game/backend
rm -rf node_modules
rm -f package-lock.json
npm install --build-from-source
```

#### 6. 保存 PM2 配置并重启

```bash
# 保存 PM2 配置
pm2 save

# 重启应用
pm2 restart poker-game
```

#### 7. 验证更新

```bash
# 查看状态
pm2 status poker-game

# 查看日志
pm2 logs poker-game --lines 20
```

---

## 🔄 更新脚本功能说明

`update-final.sh` 脚本会自动完成以下操作：

1. ✅ **备份当前版本**：创建带时间戳的备份
2. ✅ **停止应用**：安全停止 poker-game
3. ✅ **更新文件**：更新 backend、frontend 和配置文件
4. ✅ **重新安装依赖**：处理 sqlite3 编译问题
5. ✅ **保存 PM2 配置**：确保开机自启正常
6. ✅ **重启应用**：启动新版本
7. ✅ **显示状态和日志**：验证更新成功

---

## 📁 目录结构说明

更新前后的目录结构：

```
/tmp/
├── poker-game/              # 当前运行的版本
│   ├── backend/
│   ├── frontend/
│   └── ...
├── poker-game-new/          # 新版本（上传到这里）
│   ├── backend/
│   ├── frontend/
│   └── ...
└── poker-game-backup/      # 备份目录
    ├── backup-20260319-143022/
    └── ...
```

---

## 🔙 回滚到旧版本

如果更新后出现问题，可以回滚到备份版本：

```bash
# 1. 停止应用
pm2 stop poker-game

# 2. 查看可用备份
ls -la /tmp/poker-game-backup/

# 3. 恢复备份（替换 BACKUP_NAME 为实际备份名）
BACKUP_NAME="backup-20260319-143022"
rm -rf /tmp/poker-game
cp -r /tmp/poker-game-backup/$BACKUP_NAME /tmp/poker-game

# 4. 重新安装依赖（如果需要）
cd /tmp/poker-game/backend
npm install --build-from-source

# 5. 重启应用
pm2 restart poker-game
```

---

## ✅ 验证更新成功

更新后，检查以下几点：

### 1. 应用状态

```bash
pm2 status poker-game
```

应该显示 `online` 状态。

### 2. 应用日志

```bash
pm2 logs poker-game --lines 20
```

应该看到：
```
Database tables initialized
Poker Server running on port 3000
HTTP API: http://localhost:3000/api
WebSocket: ws://localhost:3000
```

### 3. 访问测试

在浏览器中访问：
```
http://your-server-ip:3000
```

确保游戏可以正常访问和使用。

---

## 🚨 常见问题

### Q1: 更新后应用无法启动？

**解决方案：**

1. 查看错误日志：
```bash
pm2 logs poker-game --err
```

2. 检查 sqlite3 编译：
```bash
cd /tmp/poker-game/backend
npm install --build-from-source
```

3. 回滚到备份版本（见上文）

### Q2: 更新后前端没有变化？

**解决方案：**

清除浏览器缓存：
- Chrome: Ctrl + Shift + Delete
- Firefox: Ctrl + Shift + Delete
- Edge: Ctrl + Shift + Delete

或者使用无痕模式访问。

### Q3: 更新后数据库丢失？

**解决方案：**

数据库文件在 `backend/db/` 目录下，更新脚本不会删除数据库文件。如果数据库丢失：

```bash
# 检查备份
ls -la /tmp/poker-game-backup/$BACKUP_NAME/backend/db/

# 恢复数据库
cp /tmp/poker-game-backup/$BACKUP_NAME/backend/db/*.db /tmp/poker-game/backend/db/
```

### Q4: 如何查看更新历史？

```bash
# 查看所有备份
ls -la /tmp/poker-game-backup/

# 查看备份时间
ls -lt /tmp/poker-game-backup/
```

---

## 📝 更新最佳实践

1. **先在本地测试**：确保新版本在本地运行正常
2. **创建备份**：每次更新前自动备份
3. **分步更新**：先更新后端，测试后再更新前端
4. **验证功能**：更新后全面测试游戏功能
5. **保留备份**：至少保留最近 3 个备份

---

## 🎉 更新完成

恭喜！德州扑克游戏已成功更新到最新版本。

现在你可以：
1. 在浏览器中访问游戏
2. 测试所有功能是否正常
3. 邀请朋友一起玩

祝你游戏愉快！🃏
