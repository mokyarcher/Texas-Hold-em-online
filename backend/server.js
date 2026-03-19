const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./db/database');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const { initSocketHandlers } = require('./socket/gameHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // 生产环境应该限制具体的域名
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// 初始化数据库
initDatabase();

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件（前端页面）
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/test', express.static(path.join(__dirname, '../test')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/rooms', authMiddleware, roomRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 初始化 WebSocket
initSocketHandlers(io);

// 将 io 实例存储到 app 中，供路由使用
app.set('io', io);

// 启动服务器（监听所有网络接口，支持局域网访问）
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Poker Server running on port ${PORT}`);
  console.log(`HTTP API: http://localhost:${PORT}/api`);
  console.log(`HTTP API (LAN): http://0.0.0.0:${PORT}/api`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`WebSocket (LAN): ws://0.0.0.0:${PORT}`);
});

module.exports = { app, server, io };
