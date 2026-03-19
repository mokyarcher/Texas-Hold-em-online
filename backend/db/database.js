const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'poker.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// 初始化表结构
function initDatabase() {
  // 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT,
      chips INTEGER DEFAULT 20000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
  });

  // 房间表
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_id INTEGER NOT NULL,
      max_players INTEGER DEFAULT 6,
      small_blind INTEGER DEFAULT 10,
      big_blind INTEGER DEFAULT 20,
      password TEXT,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating rooms table:', err);
  });

  // 房间玩家关联表
  db.run(`
    CREATE TABLE IF NOT EXISTS room_players (
      room_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      seat_number INTEGER,
      is_ready INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, user_id)
    )
  `, (err) => {
    if (err) console.error('Error creating room_players table:', err);
  });

  console.log('Database tables initialized');
}

// 辅助函数：将 db.get 包装为 Promise
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// 辅助函数：将 db.all 包装为 Promise
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 辅助函数：将 db.run 包装为 Promise
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// 用户相关数据库操作
const userDB = {
  // 创建用户
  async createUser(username, password, nickname, chips = 20000) {
    return dbRun(
      'INSERT INTO users (username, password, nickname, chips) VALUES (?, ?, ?, ?)',
      [username, password, nickname || username, chips]
    );
  },

  // 根据用户名查找用户
  async findByUsername(username) {
    return dbGet('SELECT * FROM users WHERE username = ?', [username]);
  },

  // 根据ID查找用户
  async findById(id) {
    return dbGet(
      'SELECT id, username, nickname, chips, created_at FROM users WHERE id = ?',
      [id]
    );
  },

  // 根据ID查找用户（包含密码）
  async findByIdWithPassword(id) {
    return dbGet(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
  },

  // 获取排行榜（按筹码排序）
  async getLeaderboard(currentUserId) {
    return dbAll(`
      SELECT 
        id, 
        username, 
        nickname, 
        chips,
        CASE WHEN id = ? THEN 1 ELSE 0 END as is_current_user
      FROM users 
      ORDER BY chips DESC 
      LIMIT 50
    `, [currentUserId]);
  },

  // 获取所有用户（超管用）
  async getAllUsers() {
    return dbAll(
      'SELECT id, username, nickname, chips, created_at, last_login FROM users ORDER BY created_at DESC'
    );
  },

  // 删除用户（超管用）
  async deleteUser(id) {
    return dbRun('DELETE FROM users WHERE id = ?', [id]);
  },

  // 更新最后登录时间
  async updateLastLogin(id) {
    return dbRun(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  },

  // 更新筹码
  async updateChips(id, chips) {
    return dbRun('UPDATE users SET chips = ? WHERE id = ?', [chips, id]);
  },

  // 更新昵称
  async updateNickname(id, nickname) {
    return dbRun('UPDATE users SET nickname = ? WHERE id = ?', [nickname, id]);
  },

  // 更新密码
  async updatePassword(id, password) {
    return dbRun('UPDATE users SET password = ? WHERE id = ?', [password, id]);
  }
};

// 房间相关数据库操作
const roomDB = {
  // 创建房间
  async createRoom(roomId, name, hostId, maxPlayers, smallBlind, bigBlind, password) {
    const hashedPassword = password ? await require('bcryptjs').hash(password, 10) : null;
    return dbRun(
      'INSERT INTO rooms (id, name, host_id, max_players, small_blind, big_blind, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roomId, name, hostId, maxPlayers, smallBlind, bigBlind, hashedPassword]
    );
  },

  // 获取房间列表
  async getRoomList(userId) {
    return dbAll(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
        CASE WHEN r.password IS NOT NULL THEN 1 ELSE 0 END as has_password,
        CASE WHEN EXISTS (
          SELECT 1 FROM room_players WHERE room_id = r.id AND user_id = ?
        ) THEN 1 ELSE 0 END as is_joined,
        u.username as host_name,
        CASE WHEN EXISTS (
          SELECT 1 FROM room_players WHERE room_id = r.id AND user_id = ?
        ) THEN 1 ELSE 0 END as is_my_room
      FROM rooms r
      LEFT JOIN users u ON r.host_id = u.id
      ORDER BY r.created_at DESC
    `, [userId, userId]);
  },

  // 根据ID获取房间
  async getRoomById(roomId) {
    return dbGet('SELECT * FROM rooms WHERE id = ?', [roomId]);
  },

  // 更新房间状态
  async updateRoomStatus(roomId, status) {
    return dbRun('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId]);
  },

  // 删除房间
  async deleteRoom(roomId) {
    return dbRun('DELETE FROM rooms WHERE id = ?', [roomId]);
  },
  
  // 更新房主
  async updateHost(roomId, newHostId) {
    return dbRun('UPDATE rooms SET host_id = ? WHERE id = ?', [newHostId, roomId]);
  },
  
  // 更新房间状态
  async updateRoomStatus(roomId, status) {
    return dbRun('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId]);
  },
  
  // 删除所有房间（超管用）
  async deleteAllRooms() {
    // 先删除所有房间玩家关联记录
    await dbRun('DELETE FROM room_players');
    // 再删除所有房间
    return dbRun('DELETE FROM rooms');
  }
};

// 房间玩家相关数据库操作
const roomPlayerDB = {
  // 加入房间
  async joinRoom(roomId, userId, seatNumber) {
    return dbRun(
      'INSERT OR REPLACE INTO room_players (room_id, user_id, seat_number) VALUES (?, ?, ?)',
      [roomId, userId, seatNumber]
    );
  },

  // 离开房间
  async leaveRoom(roomId, userId) {
    return dbRun(
      'DELETE FROM room_players WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
  },

  // 获取房间内的所有玩家
  async getRoomPlayers(roomId) {
    return dbAll(`
      SELECT rp.*, u.username, u.nickname, u.chips
      FROM room_players rp
      JOIN users u ON rp.user_id = u.id
      WHERE rp.room_id = ?
      ORDER BY rp.joined_at
    `, [roomId]);
  },

  // 设置准备状态
  async setReady(roomId, userId, isReady) {
    return dbRun(
      'UPDATE room_players SET is_ready = ? WHERE room_id = ? AND user_id = ?',
      [isReady ? 1 : 0, roomId, userId]
    );
  },

  // 获取房间玩家数量
  async getPlayerCount(roomId) {
    const result = await dbGet(
      'SELECT COUNT(*) as count FROM room_players WHERE room_id = ?',
      [roomId]
    );
    return result ? result.count : 0;
  },

  // 删除房间的所有玩家
  async clearRoomPlayers(roomId) {
    return dbRun('DELETE FROM room_players WHERE room_id = ?', [roomId]);
  }
};

module.exports = {
  db,
  initDatabase,
  userDB,
  roomDB,
  roomPlayerDB
};