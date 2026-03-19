const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { roomDB, roomPlayerDB, userDB } = require('../db/database');

// 获取房间列表
router.get('/list', async (req, res) => {
  try {
    const userId = req.userId;
    const rooms = await roomDB.getRoomList(userId);
    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建房间
router.post('/create', async (req, res) => {
  try {
    const userId = req.userId;
    const { name, maxPlayers, smallBlind, bigBlind, password } = req.body;

    // 验证输入
    if (!name) {
      return res.status(400).json({ error: '房间名称不能为空' });
    }

    const maxPlayersNum = parseInt(maxPlayers) || 6;
    if (maxPlayersNum < 2 || maxPlayersNum > 9) {
      return res.status(400).json({ error: '房间人数必须在2-9人之间' });
    }

    const sb = parseInt(smallBlind) || 10;
    const bb = parseInt(bigBlind) || 20;

    // 生成房间ID
    const roomId = uuidv4().substring(0, 8).toUpperCase();

    // 创建房间
    await roomDB.createRoom(roomId, name, userId, maxPlayersNum, sb, bb, password || null);

    // 房主自动加入房间，占用座位0
    await roomPlayerDB.joinRoom(roomId, userId, 0);

    // 获取创建的房间信息
    const room = await roomDB.getRoomById(roomId);
    const players = await roomPlayerDB.getRoomPlayers(roomId);

    res.status(201).json({
      message: '房间创建成功',
      room: {
        ...room,
        players
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取房间详情
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await roomDB.getRoomById(roomId);

    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    const players = await roomPlayerDB.getRoomPlayers(roomId);

    res.json({
      room: {
        ...room,
        players
      }
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 加入房间
router.post('/:roomId/join', async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { password } = req.body;

    const room = await roomDB.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    // 如果房间正在游戏中，只允许之前在房间中的玩家重新加入
    if (room.status !== 'waiting') {
      // 检查用户是否之前在房间中
      const existingPlayers = await roomPlayerDB.getRoomPlayers(roomId);
      const wasInRoom = existingPlayers.some(p => p.user_id === userId);
      
      if (!wasInRoom) {
        return res.status(400).json({ error: '房间已开始游戏' });
      }
      
      // 如果是之前在房间中的玩家，则允许重新加入
      console.log(`Player ${userId} rejoining game in progress`);
    }

    // 验证密码
    if (room.password && room.password !== password) {
      return res.status(403).json({ error: '房间密码错误' });
    }

    // 检查是否已在房间中
    const existingPlayers = await roomPlayerDB.getRoomPlayers(roomId);
    if (existingPlayers.find(p => p.user_id === userId)) {
      return res.json({
        message: '已经在房间中',
        room: {
          ...room,
          players: existingPlayers
        }
      });
    }

    // 检查房间是否已满
    if (existingPlayers.length >= room.max_players) {
      return res.status(400).json({ error: '房间已满' });
    }

    // 寻找可用座位
    const usedSeats = existingPlayers.map(p => p.seat_number);
    let seatNumber = 0;
    while (usedSeats.includes(seatNumber) && seatNumber < room.max_players) {
      seatNumber++;
    }

    // 加入房间
    await roomPlayerDB.joinRoom(roomId, userId, seatNumber);

    // 如果房间正在游戏中，将玩家状态设置为未准备，以便他们可以重新准备
    if (room.status === 'playing') {
      await roomPlayerDB.setReady(roomId, userId, 0);
    }

    const players = await roomPlayerDB.getRoomPlayers(roomId);

    res.json({
      message: '加入房间成功',
      room: {
        ...room,
        players
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 离开房间
router.post('/:roomId/leave', async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;

    const room = await roomDB.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    // 获取离开玩家的信息（用于广播）
    const leavingPlayer = await userDB.findById(userId);

    // 获取io实例用于广播
    const io = req.app.get('io');

    // 检查是否是房主且游戏正在进行中
    if (room.host_id === userId && room.status === 'playing') {
      console.log(`Host ${userId} left playing room ${roomId}, ending game...`);
      
      // 广播游戏结束（房主离开）
      if (io) {
        io.to(roomId).emit('game_end_host_left', {
          message: '房主已离开，游戏结束',
          hostName: leavingPlayer ? (leavingPlayer.nickname || leavingPlayer.username) : '房主'
        });
      }
      
      // 清理游戏状态
      const { activeGames } = require('../socket/gameHandler');
      if (activeGames) {
        activeGames.delete(roomId);
      }
      
      // 删除房间（包括所有玩家记录）
      await roomDB.deleteRoom(roomId);
      console.log(`Room ${roomId} deleted - host left during game`);
      
      return res.json({ message: '离开房间成功，游戏已结束' });
    }

    // 检查房间状态，如果正在游戏中，只将玩家标记为掉线而不是完全移除
    if (room.status === 'playing') {
      // 在游戏中离开，不实际移除玩家，而是让他们掉线
      // 这样他们可以重新加入游戏
      if (io && leavingPlayer) {
        // 广播玩家掉线消息给其他玩家
        io.to(roomId).emit('player_disconnected', {
          userId: userId,
          username: leavingPlayer.username,
          message: `${leavingPlayer.nickname || leavingPlayer.username} 已掉线`
        });
        console.log(`Broadcast player_disconnected: ${leavingPlayer.username}`);
      }
      
      console.log(`User ${userId} disconnected from playing room ${roomId}, not leaving permanently`);
      return res.json({ message: '已断开连接，可重新加入游戏' });
    } else {
      // 等待状态下离开，实际移除玩家
      await roomPlayerDB.leaveRoom(roomId, userId);
      console.log(`User ${userId} left room ${roomId}`);

      if (io && leavingPlayer) {
        // 广播玩家离开消息给其他玩家
        io.to(roomId).emit('player_left', {
          userId: userId,
          username: leavingPlayer.username,
          nickname: leavingPlayer.nickname,
          message: `${leavingPlayer.nickname || leavingPlayer.username} 离开了房间`
        });
        console.log(`Broadcast player_left: ${leavingPlayer.username}`);
      }

      // 检查房间是否还有玩家
      const playerCount = await roomPlayerDB.getPlayerCount(roomId);
      console.log(`Room ${roomId} now has ${playerCount} players`);
      
      if (playerCount === 0) {
        // 房间没人了，删除房间
        await roomDB.deleteRoom(roomId);
        console.log(`Room ${roomId} deleted - no players left`);
        return res.json({ message: '离开房间成功，房间已解散' });
      }
    }

    // 如果房主离开（等待状态），转让房主给第一个剩余玩家
    if (room.host_id === userId && room.status === 'waiting') {
      const remainingPlayers = await roomPlayerDB.getRoomPlayers(roomId);
      if (remainingPlayers.length > 0) {
        const newHostId = remainingPlayers[0].user_id;
        await roomDB.updateHost(roomId, newHostId);
        console.log(`Room ${roomId} host changed to ${newHostId}`);
        
        // 广播房主变更
        if (io) {
          io.to(roomId).emit('host_changed', {
            newHostId: newHostId,
            newHostName: remainingPlayers[0].username
          });
        }
      }
    }

    // 关键修改：如果房间状态是"playing"，需要更新房间状态为"waiting"
    // 这样玩家才能重新加入正在进行的游戏
    if (room.status === 'playing') {
      const remainingPlayers = await roomPlayerDB.getRoomPlayers(roomId);
      if (remainingPlayers.length > 0) {
        // 如果还有其他玩家在房间里，保持房间为playing状态
        // 但允许玩家重新加入
      }
    }

    res.json({ message: '离开房间成功' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 准备/取消准备
router.post('/:roomId/ready', async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { isReady } = req.body;

    const room = await roomDB.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    await roomPlayerDB.setReady(roomId, userId, isReady ? 1 : 0);

    const players = await roomPlayerDB.getRoomPlayers(roomId);

    res.json({
      message: isReady ? '准备成功' : '取消准备',
      players
    });
  } catch (error) {
    console.error('Ready error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除房间（仅房主）
router.delete('/:roomId', async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;

    const room = await roomDB.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    // 检查是否是房主
    if (room.host_id !== userId) {
      return res.status(403).json({ error: '只有房主可以删除房间' });
    }

    // 获取io实例用于广播
    const io = req.app.get('io');
    
    // 广播房间被删除
    if (io) {
      io.to(roomId).emit('room_deleted', {
        message: '房主已解散房间',
        roomId: roomId
      });
    }

    // 删除房间（会自动删除关联的玩家记录）
    await roomDB.deleteRoom(roomId);
    console.log(`Room ${roomId} deleted by host ${userId}`);

    res.json({ message: '房间已删除' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 开始游戏（仅房主）
router.post('/:roomId/start', async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;

    const room = await roomDB.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    // 检查是否是房主
    if (room.host_id !== userId) {
      return res.status(403).json({ error: '只有房主可以开始游戏' });
    }

    const players = await roomPlayerDB.getRoomPlayers(roomId);
    
    // 检查人数
    if (players.length < 2) {
      return res.status(400).json({ error: '至少需要2名玩家' });
    }

    // 检查是否所有人都准备了（除了房主）
    const notReadyPlayers = players.filter(p => p.user_id !== room.host_id && !p.is_ready);
    if (notReadyPlayers.length > 0) {
      return res.status(400).json({ 
        error: '还有玩家未准备',
        notReadyPlayers: notReadyPlayers.map(p => p.username)
      });
    }

    // 更新房间状态
    await roomDB.updateRoomStatus(roomId, 'playing');

    res.json({
      message: '游戏开始',
      roomId,
      players
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;