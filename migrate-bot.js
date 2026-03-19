const sqlite3 = require('./backend/node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend/db/poker.db');

console.log('开始数据库迁移...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('打开数据库失败:', err);
    process.exit(1);
  }
  console.log('数据库连接成功');
});

async function migrate() {
  try {
    // 检查 is_bot 字段是否存在
    const columns = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(room_players);", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasIsBot = columns.some(col => col.name === 'is_bot');
    const hasBotName = columns.some(col => col.name === 'bot_name');
    const hasBotAvatar = columns.some(col => col.name === 'bot_avatar');

    console.log('当前表结构:', columns.map(c => c.name));

    if (!hasIsBot) {
      console.log('添加 is_bot 字段...');
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE room_players ADD COLUMN is_bot INTEGER DEFAULT 0', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    if (!hasBotName) {
      console.log('添加 bot_name 字段...');
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE room_players ADD COLUMN bot_name TEXT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    if (!hasBotAvatar) {
      console.log('添加 bot_avatar 字段...');
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE room_players ADD COLUMN bot_avatar TEXT DEFAULT "avatar1.png"', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('数据库迁移完成！');
    db.close();
  } catch (error) {
    console.error('迁移失败:', error);
    db.close();
    process.exit(1);
  }
}

migrate();