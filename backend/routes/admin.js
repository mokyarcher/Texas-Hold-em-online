const express = require('express');
const { userDB, roomDB, roomPlayerDB } = require('../db/database');

const router = express.Router();

// 超管用户名
const ADMIN_USERNAME = 'mokyarcher';

// 检查是否为超管的中间件
function requireAdmin(req, res, next) {
  const userId = req.userId;
  // 需要通过用户名判断，但userId是token中的，我们需要查询用户信息
  // 这里简化处理，在中间件链中传递用户信息
  next();
}

// 获取所有用户列表（超管专用）
router.get('/users', async (req, res) => {
  try {
    const userId = req.userId;
    
    // 检查是否为超管
    const adminUser = await userDB.findById(userId);
    if (!adminUser || adminUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ error: '无权限访问' });
    }
    
    const users = await userDB.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户（超管专用）
router.delete('/users/:userId', async (req, res) => {
  try {
    const adminUserId = req.userId;
    const targetUserId = parseInt(req.params.userId);
    
    // 检查是否为超管
    const adminUser = await userDB.findById(adminUserId);
    if (!adminUser || adminUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ error: '无权限访问' });
    }
    
    // 不能删除自己
    if (targetUserId === adminUserId) {
      return res.status(400).json({ error: '不能删除超管账户' });
    }
    
    await userDB.deleteUser(targetUserId);
    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改用户筹码（超管专用）
router.post('/users/:userId/chips', async (req, res) => {
  try {
    const adminUserId = req.userId;
    const targetUserId = parseInt(req.params.userId);
    const { amount, operation } = req.body; // operation: 'add' | 'subtract' | 'set'
    
    // 检查是否为超管
    const adminUser = await userDB.findById(adminUserId);
    if (!adminUser || adminUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ error: '无权限访问' });
    }
    
    // 获取目标用户
    const targetUser = await userDB.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    let newChips;
    const currentChips = targetUser.chips || 0;
    const amountNum = parseInt(amount) || 0;
    
    switch (operation) {
      case 'add':
        newChips = currentChips + amountNum;
        break;
      case 'subtract':
        newChips = currentChips - amountNum;
        if (newChips < 0) newChips = 0;
        break;
      case 'set':
        newChips = amountNum;
        break;
      default:
        return res.status(400).json({ error: '无效的操作类型' });
    }
    
    await userDB.updateChips(targetUserId, newChips);
    
    res.json({
      message: '筹码修改成功',
      user: {
        id: targetUserId,
        username: targetUser.username,
        nickname: targetUser.nickname,
        oldChips: currentChips,
        newChips: newChips
      }
    });
  } catch (error) {
    console.error('Update chips error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 一键清除所有房间（超管专用）
router.delete('/rooms/all', async (req, res) => {
  try {
    const adminUserId = req.userId;
    
    // 检查是否为超管
    const adminUser = await userDB.findById(adminUserId);
    if (!adminUser || adminUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ error: '无权限访问' });
    }
    
    // 获取所有房间进行广播通知
    const rooms = await roomDB.getRoomList(adminUserId);
    
    // 获取io实例用于广播
    const io = req.app.get('io');
    
    // 广播房间被清除消息给所有玩家
    if (io) {
      rooms.forEach(room => {
        io.to(room.id).emit('room_deleted', {
          message: '超管已清除所有房间',
          roomId: room.id
        });
      });
    }
    
    // 清除所有房间
    await roomDB.deleteAllRooms();
    
    res.json({ 
      message: '所有房间已清除',
      deletedCount: rooms.length
    });
  } catch (error) {
    console.error('Clear all rooms error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
