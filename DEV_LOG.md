# 德州扑克联机版 - 开发进度日志

> 记录每次代码改动、需求操作和版本更新，方便快速追溯和恢复。

---

## 📝 开发行为准则

> ⚠️ **重要：每次修改完代码后，必须先提交到 Git，并立即推送到远程！**
> 
> **流程：修改代码 → 提交(commit) → 推送(push)**
> 
> 标准命令：
> ```bash
> git add -A
> git commit -m "feat: 功能描述"
> git push
> ```
> 
> 或使用自动推送脚本（一键完成）：
> ```bash
> git-auto-push.bat "提交信息"
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
- **UI设计**: 
  - 横屏左右分栏布局，左侧显示信息，右侧修改
  - 弹窗宽度700px，带用户头像区域
- **修改文件**:
  - `backend/routes/auth.js`: 添加 `/auth/update-nickname` 和 `/auth/update-password` 接口
  - `backend/db/database.js`: 添加 `findByIdWithPassword`, `updateNickname`, `updatePassword` 方法
  - `frontend/lobby.html`: 添加个人信息弹窗和相关交互
- **状态**: ✅ 已完成
- **提交**: `e6f119f`, `4ebb2d7`

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

### 2026-03-21 - 游戏结束机制大改（多局连续游戏）
- **操作**: 重构游戏结束后的流程，支持连续多局游戏而无需退出房间
- **功能**:
  - 小局结束后，筹码>=1000的玩家可选择留下或离开
  - 10秒选择时间，未选择则根据筹码自动决定（>=1000留下，<1000离开）
  - >=2人留下时，5秒倒计时后自动开始下一局
  - 自动轮换庄家位置（根据游戏计数）
  - 完全清理旧状态，重新发牌、分配盲注
- **修改文件**:
  - `backend/socket/gameHandler.js`: 
    - 重构 `endGame` 函数
    - 添加 `handlePlayerChoicesTimeout` 处理超时
    - 添加 `handlePlayerChoice` 处理玩家选择
    - 添加 `autoStartNextGame` 自动开始新游戏
    - 添加 `game_count` 轮换庄家
  - `backend/db/database.js`: 添加 `game_count` 字段和 `incrementGameCount` 方法
  - `frontend/game.html`: 
    - 修改游戏结束弹窗，添加"留在房间继续"按钮
    - 添加 `resetGameTable` 清理牌桌状态
    - 添加 `game_restart` 和 `game_started` 事件处理
- **数据库**: 执行 `ALTER TABLE rooms ADD COLUMN game_count INTEGER DEFAULT 0;`
- **状态**: ✅ 已完成

### 2026-03-21 - 修复游戏状态bug（hasActed）
- **操作**: 修复盲注玩家 hasActed 状态未设置导致的游戏卡死问题
- **问题**: Preflop轮小盲注和大盲注已下注，但 hasActed 为 false，导致无法推进轮次
- **修复**: 在 `start_game` 中设置盲注时同时设置 `hasActed = true`
- **修改文件**: `backend/socket/gameHandler.js`
- **状态**: ✅ 已完成

### 2026-03-21 - 修复socket连接状态问题
- **操作**: 修复玩家选择留下后 socket 映射问题
- **修改**:
  - `join_game` 中更新 `onlineUsers` 的 `socketId`
  - `disconnect` 事件中检查 socketId 匹配后再删除在线状态
  - `start_game` 中确保所有玩家 socket 加入房间
- **修改文件**: `backend/socket/gameHandler.js`
- **状态**: ✅ 已完成

### 2026-03-21 - 人机思考时间优化
- **操作**: 增加人机决策的思考延迟，提升真实感
- **修改**: 思考时间从 1-3秒 调整为 2-5秒
- **修改文件**: `backend/socket/gameHandler.js` (handleBotTurn)
- **状态**: ✅ 已完成

### 2026-03-21 - 术语和UI调整
- **操作**: 根据用户要求调整游戏术语和UI
- **修改内容**:
  - "德州扑克" 改为 "贵州扑克"
  - "富豪" 改为 "积分"
  - 所有筹码图标改为 "⭐"
  - 排行榜优化：头像左侧，昵称和状态中间
  - 已连接状态显示改为绿色，位置移到右上角退出按钮旁边
  - 字体放大三倍，颜色优化
  - 添加标语"仅供娱乐 禁止赌博"
  - 大小盲按钮改为大写英文（SB/BB/D）
  - 玩家信息框位置调整（靠桌边）
  - 手牌摆放优化（根据位置左右调整）
  - 桌位布局优化（2-8人桌合理分配）
- **修改文件**: `frontend/game.html`, `frontend/room.html`, `frontend/lobby.html`, `frontend/css/`
- **状态**: ✅ 已完成

---

*最后更新: 2026-03-21*
