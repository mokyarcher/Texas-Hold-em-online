# 德州扑克联机版 - 开发进度日志

> 记录每次代码改动、需求操作和版本更新，方便快速追溯和恢复。

---

## 📌 最新操作

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

- [ ] 

---

*最后更新: 2026-03-19 10:02*
