# SQLite3 问题修复指南

## 问题描述

在 Linux 服务器上部署德州扑克游戏时，遇到 `sqlite3` 模块无法加载的错误：

```
Error: /opt/poker-game/backend/node_modules/sqlite3/build/Release/node_sqlite3.node: invalid ELF header
code: 'ERR_DLOPEN_FAILED'
```

这是因为 `sqlite3` 是原生模块，需要在 Linux 上重新编译。

## 解决方案

### 方案一：使用 better-sqlite3（推荐，最简单）

`better-sqlite3` 是纯 JavaScript 实现的 SQLite3 库，不需要编译，兼容性更好。

#### 使用自动修复脚本

```bash
# 1. 上传修复脚本到服务器
scp fix-sqlite3-v2.sh root@your-server-ip:/tmp/

# 2. 登录服务器
ssh root@your-server-ip

# 3. 运行修复脚本
cd /tmp
chmod +x fix-sqlite3-v2.sh
sudo ./fix-sqlite3-v2.sh
```

#### 手动修复步骤

```bash
# 1. 停止应用
pm2 stop poker-game

# 2. 进入应用目录
cd /opt/poker-game

# 3. 备份 package.json
cp package.json package.json.backup

# 4. 替换 sqlite3 为 better-sqlite3
sed -i 's/"sqlite3"/"better-sqlite3"/g' package.json

# 5. 删除 node_modules
rm -rf node_modules

# 6. 重新安装依赖
npm install

# 7. 重启应用
pm2 restart poker-game

# 8. 查看日志
pm2 logs poker-game
```

#### 验证修复成功

应该看到类似这样的日志：

```
Database tables initialized
Poker Server running on port 3000
HTTP API: http://localhost:3000/api
WebSocket: ws://localhost:3000
```

---

### 方案二：编译 sqlite3（需要编译工具）

如果必须使用原生的 `sqlite3`，需要安装编译工具并从源码编译。

#### 安装编译工具

**CentOS/RHEL/TencentOS:**
```bash
yum install -y python3 make gcc-c++
```

**Ubuntu/Debian:**
```bash
apt-get update
apt-get install -y python3 make g++ gcc build-essential
```

#### 从源码编译 sqlite3

```bash
# 1. 停止应用
pm2 stop poker-game

# 2. 进入应用目录
cd /opt/poker-game

# 3. 删除 node_modules
rm -rf node_modules

# 4. 从源码安装 sqlite3
npm install --build-from-source

# 5. 重启应用
pm2 restart poker-game

# 6. 查看日志
pm2 logs poker-game
```

---

### 方案三：修改代码使用 better-sqlite3

如果方案一和方案二都不行，需要修改代码以支持 `better-sqlite3`。

#### 1. 修改 database.js

将 `sqlite3` 替换为 `better-sqlite3`：

```javascript
// 原来的代码
const sqlite3 = require('sqlite3').verbose();

// 修改为
const Database = require('better-sqlite3');
const sqlite3 = Database.verbose();
```

#### 2. 修改 package.json

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0"
  }
}
```

#### 3. 重新安装和启动

```bash
cd /opt/poker-game
rm -rf node_modules
npm install
pm2 restart poker-game
pm2 logs poker-game
```

---

## 常见问题

### Q1: better-sqlite3 和 sqlite3 有什么区别？

**better-sqlite3:**
- ✅ 纯 JavaScript 实现，不需要编译
- ✅ 跨平台兼容性好
- ✅ API 与 sqlite3 几乎完全兼容
- ⚠️ 性能比原生模块稍慢（但影响不大）

**sqlite3:**
- ✅ 原生模块，性能更好
- ❌ 需要编译，依赖编译工具
- ❌ 跨平台兼容性差

### Q2: 如何验证 sqlite3 已被替换？

检查 package.json：

```bash
grep better-sqlite3 /opt/poker-game/package.json
```

应该看到 `better-sqlite3` 而不是 `sqlite3`。

### Q3: 如果修复后还有问题？

查看完整日志：

```bash
pm2 logs poker-game --lines 100
```

检查是否有其他错误。

### Q4: 如何回滚到 sqlite3？

```bash
# 1. 恢复备份的 package.json
cp /opt/poker-game/package.json.backup /opt/poker-game/package.json

# 2. 重新安装
cd /opt/poker-game
rm -rf node_modules
npm install

# 3. 重启
pm2 restart poker-game
```

---

## 推荐方案

**推荐使用方案一（better-sqlite3）**，因为：
1. 不需要安装编译工具
2. 不需要编译，安装更快
3. 跨平台兼容性好
4. 性能差异对扑克游戏影响不大

---

## 技术支持

如果以上方案都无法解决问题，请提供以下信息：

1. 操作系统版本：`cat /etc/os-release`
2. Node.js 版本：`node -v`
3. npm 版本：`npm -v`
4. 完整错误日志：`pm2 logs poker-game --lines 50`
