const express = require('express');
const bcrypt = require('bcryptjs');
const { userDB } = require('../db/database');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { getOnlineUsers } = require('../socket/gameHandler');

const router = express.Router();

// 超管用户名
const ADMIN_USERNAME = 'mokyarcher';

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6个字符' });
    }

    // 检查用户名是否已存在
    const existingUser = await userDB.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const result = await userDB.createUser(username, hashedPassword, nickname, 20000);

    // 生成 Token
    const token = generateToken(result.lastID);

    // 判断是否为超管
    const isAdmin = username === ADMIN_USERNAME;

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.lastID,
        username,
        nickname: nickname || username,
        chips: 20000,
        isAdmin
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    console.log(`Login attempt: ${username}`);

    // 查找用户
    const user = await userDB.findByUsername(username);
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    console.log(`User found: ${user.username}, password length: ${user.password?.length}`);

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log(`Password valid: ${isValidPassword}`);

    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await userDB.updateLastLogin(user.id);

    // 生成 Token
    const token = generateToken(user.id);

    // 判断是否为超管
    const isAdmin = user.username === ADMIN_USERNAME;

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        chips: user.chips,
        isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取排行榜（按筹码排序）- 需要认证
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const leaderboard = await userDB.getLeaderboard(currentUserId);
    
    // 获取在线用户集合
    const onlineUsersMap = getOnlineUsers();
    
    // 为每个用户添加状态信息
    // status: 'offline' | 'online' | 'in_room' | 'in_game'
    const leaderboardWithStatus = leaderboard.map(user => {
      const onlineInfo = onlineUsersMap.get(user.id);
      return {
        ...user,
        status: onlineInfo ? onlineInfo.status : 'offline',
        isOnline: onlineInfo ? 1 : 0  // 兼容旧版本
      };
    });
    
    res.json(leaderboardWithStatus);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const userId = req.userId;
    const user = await userDB.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 判断是否为超管
    const isAdmin = user.username === ADMIN_USERNAME;

    res.json({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      chips: user.chips,
      isAdmin
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改昵称
router.post('/update-nickname', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { nickname } = req.body;

    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({ error: '昵称不能为空' });
    }

    if (nickname.length > 20) {
      return res.status(400).json({ error: '昵称不能超过20个字符' });
    }

    await userDB.updateNickname(userId, nickname.trim());

    res.json({
      message: '昵称修改成功',
      nickname: nickname.trim()
    });
  } catch (error) {
    console.error('Update nickname error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改密码
router.post('/update-password', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '当前密码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少6个字符' });
    }

    // 获取用户信息（需要密码字段）
    const user = await userDB.findByIdWithPassword(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userDB.updatePassword(userId, hashedPassword);

    res.json({
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
