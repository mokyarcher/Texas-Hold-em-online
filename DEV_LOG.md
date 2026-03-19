# 德州扑克联机版 - 开发进度日志

> 记录每次代码改动、需求操作和版本更新，方便快速追溯和恢复。

---

## 📝 开发行为准则

> ⚠️ **重要：每次修改完代码后，必须先提交到 Git！**
> 
> 提交规范：
> ```bash
> git add -A
> git commit -m "feat: 功能描述"
> ```

---

---

## 📌 最新操作

### 2026-03-19 - 用户个人信息功能
- **操作**: 添加用户个人信息查看和修改功能
- **功能**:
  - 查看个人信息：用户名、昵称、筹码
  - 修改昵称功能（最多20字符）
  - 修改密码功能（需验证当前密码）
  - 在大厅页面头部添加"👤 个人信息"按钮
- **修改文件**:
  - `backend/routes/auth.js`: 添加 `/auth/update-nickname` 和 `/auth/update-password` 接口
  - `backend/db/database.js`: 添加 `findByIdWithPassword`, `updateNickname`, `updatePassword` 方法
  - `frontend/lobby.html`: 添加个人信息弹窗和相关交互
- **状态**: ✅ 已完成
- **提交**: `e6f119f`

### 2026-03-19 - 富豪排行榜功能
- **操作**: 添加排行榜功能
- **功能**:
  - 所有用户可查看排行榜
  - 按筹码量排序，显示前50名
  - 前三名显示金银铜牌（🥇🥈🥉）
  - 当前登录用户高亮显示
  - 排行榜按钮在刷新列表旁边
- **修改文件**:
  - `backend/routes/auth.js`: 添加 `/auth/leaderboard` 接口
  - `backend/db/database.js`: 添加 `getLeaderboard` 方法
  - `frontend/lobby.html`: 添加排行榜按钮、弹窗和交互逻辑
- **状态**: ✅ 已完成
- **提交**: `cf81e0f`

### 2026-03-19 - 超管后台管理功能
- **操作**: 为超管用户(mokyarcher)添加后台管理功能
- **功能**:
  - 后台管理按钮（仅超管可见，在刷新列表右边）
  - 查看所有注册用户列表
  - 删除用户（不能删除自己）
  - 增加/减少/设置用户筹码
  - 一键清除所有房间
- **修改文件**:
  - `backend/routes/admin.js`: 新建超管接口路由
  - `backend/routes/auth.js`: 登录/注册/获取用户信息时返回 isAdmin 标识
  - `backend/db/database.js`: 添加 getAllUsers, deleteUser, deleteAllRooms 方法
  - `backend/server.js`: 注册 admin 路由
  - `frontend/lobby.html`: 添加后台管理按钮、弹窗和交互逻辑
- **状态**: ✅ 已完成
- **提交**: `cf81e0f`

### 2026-03-19 - 服务启动方式要求
- **操作**: 明确服务启动规范，创建启动脚本
- **原因**: 后台启动会出现问题
- **要求**: 
  - 必须使用前台启动（禁止后台模式）
  - 必须在**新的标签页/终端窗口**中启动，不能占用当前终端
- **启动方式**: 
  - 双击运行 `start-server.bat` 启动（推荐）
  - 或手动在终端执行 `cd backend && npm start`
- **状态**: ✅ 已记录

### 2026-03-19 - 修改初始筹码
- **操作**: 新用户注册初始筹码从 1000 改为 20000
- **修改文件**:
  - `backend/routes/auth.js`: 注册时传入 20000 筹码，返回用户信息时也显示 20000
  - `backend/db/database.js`: 数据库默认值改为 20000，createUser 默认参数改为 20000
- **状态**: ✅ 已完成
- **提交**: `b39706f`

### 2026-03-19 - 初始托管
- **操作**: 将联机版代码托管至 GitHub
- **仓库**: https://github.com/mokyarcher/Texas-Hold-em-online
- **提交内容**:
  - Backend: server.js, routes/, socket/, middleware/, utils/, db/
  - Frontend: login.html, lobby.html, room.html, game.html, css/, js/
  - .gitignore (排除 node_modules, *.log, *.db)
- **状态**: ✅ 已完成
- **备注**: 使用 HTTPS 推送，SSH key 权限受限

---

## 📝 需求记录

| 时间 | 需求描述 | 状态 | 关联文件 |
|------|----------|------|----------|
| 2026-03-19 | 新用户初始筹码改为 20000 | ✅ 已完成 | auth.js, database.js |
| 2026-03-19 | 创建开发进度文档 DEV_LOG.md | ✅ 已完成 | DEV_LOG.md |

---

## 🔄 版本历史

### v1.0.0 (2026-03-19)
- 初始版本提交
- 支持多人在线对战
- 包含登录、大厅、房间、游戏页面

---

## 💡 待办事项

- [x] 服务必须使用前台启动（后台启动会出现问题） 

---

*最后更新: 2026-03-19 11:15*
