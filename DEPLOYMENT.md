# 德州扑克游戏 - Linux 服务器部署指南

## 📋 系统要求

- 操作系统：Linux (CentOS/Ubuntu/Debian)
- Node.js：v14 或更高版本
- npm：v6 或更高版本
- 内存：至少 512MB
- 磁盘空间：至少 1GB

## 🔧 部署步骤

### 方法一：使用自动部署脚本（推荐）

#### 1. 上传项目文件到服务器

将整个项目文件夹上传到服务器的临时目录，例如 `/tmp/poker-game`

```bash
# 使用 scp 上传（在本地执行）
scp -r Texas-Hold-em-LAN root@your-server-ip:/tmp/poker-game
```

#### 2. 登录服务器

```bash
ssh root@your-server-ip
```

#### 3. 进入项目目录

```bash
cd /tmp/poker-game
```

#### 4. 给部署脚本添加执行权限

```bash
chmod +x deploy.sh
```

#### 5. 运行部署脚本

```bash
sudo ./deploy.sh
```

脚本会自动完成以下操作：
- ✅ 检查 Node.js 和 npm 环境
- ✅ 安装 PM2 进程管理器
- ✅ 创建必要的目录结构
- ✅ 备份现有应用（如果存在）
- ✅ 部署应用文件
- ✅ 安装依赖
- ✅ 配置环境变量
- ✅ 启动应用

---

### 方法二：手动部署

#### 1. 安装 Node.js 和 npm

**CentOS/RHEL:**
```bash
# 安装 Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node -v
npm -v
```

**Ubuntu/Debian:**
```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node -v
npm -v
```

#### 2. 安装 PM2（进程管理器）

```bash
npm install -g pm2
```

#### 3. 创建应用目录

```bash
sudo mkdir -p /opt/poker-game
sudo mkdir -p /opt/poker-game/logs
```

#### 4. 上传项目文件

```bash
# 在本地执行
scp -r Texas-Hold-em-LAN/* root@your-server-ip:/opt/poker-game/
```

#### 5. 安装依赖

```bash
cd /opt/poker-game
npm install --production
```

#### 6. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**重要配置项：**
```env
PORT=3000
JWT_SECRET=your-random-secret-key-here
NODE_ENV=production
```

生成随机 JWT 密钥：
```bash
openssl rand -hex 32
```

#### 7. 启动应用

```bash
# 使用 PM2 启动
pm2 start backend/server.js --name "poker-game" --env production

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup | tail -n 1
```

执行 PM2 输出的命令以设置开机自启。

---

## 🔥 防火墙配置

### CentOS/RHEL (firewalld)

```bash
# 开放 3000 端口
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# 查看防火墙状态
sudo firewall-cmd --list-all
```

### Ubuntu (ufw)

```bash
# 开放 3000 端口
sudo ufw allow 3000/tcp

# 重新加载防火墙
sudo ufw reload

# 查看防火墙状态
sudo ufw status
```

### 云服务器安全组

如果你的服务器在云平台（阿里云、腾讯云等），还需要在控制台的安全组中开放 3000 端口。

---

## 📊 应用管理

### 查看应用状态

```bash
pm2 status
```

### 查看实时日志

```bash
pm2 logs poker-game
```

### 查看错误日志

```bash
pm2 logs poker-game --err
```

### 重启应用

```bash
pm2 restart poker-game
```

### 停止应用

```bash
pm2 stop poker-game
```

### 删除应用

```bash
pm2 delete poker-game
```

### 监控应用

```bash
pm2 monit
```

---

## 🔄 更新部署

### 使用更新脚本

创建 `update.sh` 文件：

```bash
#!/bin/bash

APP_NAME="poker-game"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/$APP_NAME-backup"

echo "开始更新应用..."

# 1. 备份当前版本
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
cp -r $APP_DIR $BACKUP_DIR/$BACKUP_NAME
echo "备份完成: $BACKUP_NAME"

# 2. 停止应用
pm2 stop $APP_NAME

# 3. 更新文件（假设新文件在 /tmp/poker-game-new）
cp -r /tmp/poker-game-new/backend $APP_DIR/
cp -r /tmp/poker-game-new/frontend $APP_DIR/
cp /tmp/poker-game-new/package.json $APP_DIR/

# 4. 安装依赖
cd $APP_DIR
npm install --production

# 5. 重启应用
pm2 restart $APP_NAME

echo "更新完成！"
```

### 手动更新步骤

```bash
# 1. 备份当前版本
sudo cp -r /opt/poker-game /opt/poker-game-backup-$(date +%Y%m%d)

# 2. 停止应用
pm2 stop poker-game

# 3. 上传新文件
# (使用 scp 或其他方式上传新文件到 /opt/poker-game)

# 4. 安装依赖
cd /opt/poker-game
npm install --production

# 5. 重启应用
pm2 restart poker-game
```

---

## 🐛 故障排查

### 1. 应用无法启动

查看错误日志：
```bash
pm2 logs poker-game --err
```

常见问题：
- 端口被占用：修改 `.env` 中的 `PORT`
- 依赖缺失：重新运行 `npm install`
- 权限问题：确保文件权限正确

### 2. 数据库错误

检查数据库文件权限：
```bash
ls -la /opt/poker-game/backend/db/
```

如果权限不正确：
```bash
sudo chmod 644 /opt/poker-game/backend/db/*.db
sudo chown -R $(whoami):$(whoami) /opt/poker-game/backend/db/
```

### 3. 网络连接问题

检查端口是否监听：
```bash
netstat -tlnp | grep 3000
```

检查防火墙：
```bash
# CentOS
sudo firewall-cmd --list-ports

# Ubuntu
sudo ufw status
```

### 4. 内存不足

检查内存使用：
```bash
free -h
```

如果内存不足，考虑：
- 增加服务器内存
- 使用 PM2 集群模式：`pm2 start backend/server.js -i max`

---

## 🔒 安全建议

1. **修改 JWT 密钥**
   - 生产环境务必使用强随机密钥
   - 不要在代码中硬编码密钥

2. **配置 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书（Let's Encrypt）

3. **限制 CORS**
   - 在 `.env` 中设置具体的域名
   - 不要使用 `CORS_ORIGIN=*`

4. **定期备份**
   - 备份数据库文件
   - 备份配置文件

5. **监控日志**
   - 定期检查错误日志
   - 设置日志轮转

---

## 📝 访问应用

部署成功后，通过以下地址访问：

```
http://your-server-ip:3000
```

如果配置了域名：

```
http://your-domain.com
```

---

## 📞 技术支持

如遇到问题，请检查：
1. PM2 日志：`pm2 logs poker-game`
2. 应用日志：`/opt/poker-game/logs/`
3. 系统日志：`/var/log/`

---

## 🎉 部署完成

恭喜！德州扑克游戏已成功部署到服务器。

现在你可以：
1. 在浏览器中访问游戏
2. 邀请朋友一起玩
3. 享受局域网联机的乐趣！

祝你游戏愉快！🃏
