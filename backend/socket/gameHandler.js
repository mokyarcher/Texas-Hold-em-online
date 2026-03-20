const { roomDB, roomPlayerDB, userDB } = require('../db/database');
const HandEvaluator = require('../utils/HandEvaluator');
const BotAI = require('../utils/BotAI');

// 存储进行中的游戏状态
const activeGames = new Map();
// 存储 socket 到用户/房间的映射
const socketMap = new Map();
// 存储在线用户集合 (userId -> { socketId, status, roomId, gameRoomId, lastActive })
// status: 'online' | 'in_room' | 'in_game'
const onlineUsers = new Map();
// 人机AI实例
const botAI = new BotAI();
// 游戏状态监控（用于检测死锁）
const gameStateMonitors = new Map();

// 获取在线用户列表（导出供其他模块使用）
function getOnlineUsers() {
  return onlineUsers;
}

// 更新用户状态
function updateUserStatus(userId, status, roomId = null, gameRoomId = null) {
  if (onlineUsers.has(userId)) {
    const user = onlineUsers.get(userId);
    user.status = status;
    if (roomId !== undefined) user.roomId = roomId;
    if (gameRoomId !== undefined) user.gameRoomId = gameRoomId;
    user.lastActive = Date.now();
  }
}

// 更新用户最后活跃时间
function updateUserActivity(userId) {
  if (onlineUsers.has(userId)) {
    onlineUsers.get(userId).lastActive = Date.now();
  }
}

class GameState {
  constructor(roomId, players, config) {
    this.roomId = roomId;
    this.players = players.map((p, index) => ({
      userId: p.user_id,
      username: p.username || p.nickname,
      nickname: p.nickname,
      seatNumber: p.seat_number !== undefined ? p.seat_number : index,
      hand: [],
      folded: false,
      allIn: false,
      currentBet: 0,
      chips: p.chips || 1000,
      socketId: null,  // 将在连接时设置
      disconnectedAt: null, // 掉线时间
      disconnected: false, // 是否掉线
      isBot: p.is_bot === 1, // 标记是否为人机
      hasActed: false // 标记当前轮次是否已经行动过
    }));
    this.communityCards = [];
    this.pot = 0;
    this.currentRound = 0; // 0: Preflop, 1: Flop, 2: Turn, 3: River, 4: Showdown
    this.currentPlayer = 0;
    this.dealer = 0;
    this.smallBlind = config.smallBlind || 10;
    this.bigBlind = config.bigBlind || 20;
    this.currentBet = 0;
    this.lastRaise = this.bigBlind;
    this.roundBets = 0;
    this.deck = this.createDeck();
    this.status = 'playing';
    this.disconnectTimer = null; // 掉线计时器
    
    // 确保玩家按座位号排序
    this.players.sort((a, b) => a.seatNumber - b.seatNumber);
  }

  createDeck() {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank });
      }
    }
    // 洗牌
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  dealCard() {
    return this.deck.pop();
  }

  getActivePlayers() {
    return this.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
  }

  getNotFoldedPlayers() {
    return this.players.filter(p => !p.folded && !p.eliminated);
  }

  findPlayerByUserId(userId) {
    return this.players.findIndex(p => p.userId === userId);
  }

  findNextActivePlayer(startPos) {
    const total = this.players.length;
    let pos = (startPos + 1) % total;
    let loopCount = 0;
    while (loopCount < total) {
      const player = this.players[pos];
      // 跳过已弃牌、全下、被移除的玩家
      if (!player.folded && !player.allIn && !player.eliminated) {
        return pos;
      }
      pos = (pos + 1) % total;
      loopCount++;
    }
    // 没有找到活跃玩家，返回第一个未弃牌的玩家（可能是全下玩家）
    for (let i = 0; i < total; i++) {
      if (!this.players[i].folded && !this.players[i].eliminated) {
        return i;
      }
    }
    return -1;
  }

  findFirstActivePlayer() {
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (!player.folded && !player.allIn && !player.eliminated) {
        return i;
      }
    }
    // 如果没有活跃玩家，返回0（避免-1错误）
    return 0;
  }

  toJSON() {
    return {
      roomId: this.roomId,
      players: this.players.map(p => ({
        userId: p.userId,
        username: p.username,
        seatNumber: p.seatNumber,
        chips: p.chips,
        currentBet: p.currentBet,
        folded: p.folded,
        allIn: p.allIn,
        isBot: p.isBot
      })),
      communityCards: this.communityCards,
      pot: this.pot,
      currentRound: this.currentRound,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      currentBet: this.currentBet,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      status: this.status
    };
  }

  toPrivateJSON(userId) {
    const playerIndex = this.findPlayerByUserId(userId);
    const player = playerIndex >= 0 ? this.players[playerIndex] : null;
    
    return {
      ...this.toJSON(),
      yourSeat: playerIndex,
      yourHand: player ? player.hand : []
    };
  }
}

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // 标记为已认证（将在 user_online、join_room 或 join_game 时设置 userId）
    socket.authenticated = false;
    
    // 用户上线（在大厅页面）
    socket.on('user_online', ({ userId }) => {
      socket.userId = userId;
      socket.authenticated = true;
      
      // 添加到在线用户集合，状态为 'online'（在大厅）
      onlineUsers.set(userId, {
        socketId: socket.id,
        status: 'online',  // online | in_room | in_game
        roomId: null,
        gameRoomId: null,
        lastActive: Date.now()
      });
      
      console.log(`User ${userId} is now online (in lobby). Total online: ${onlineUsers.size}`);
    });

    // 加入等待房间（在 room.html 页面）
    socket.on('join_room', ({ roomId, userId, token }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.authenticated = true;
      
      // 更新用户状态为 'in_room'
      if (onlineUsers.has(userId)) {
        const user = onlineUsers.get(userId);
        user.status = 'in_room';
        user.roomId = roomId;
        user.lastActive = Date.now();
      } else {
        onlineUsers.set(userId, {
          socketId: socket.id,
          status: 'in_room',
          roomId: roomId,
          gameRoomId: null,
          lastActive: Date.now()
        });
      }
      
      socketMap.set(socket.id, { roomId, userId });
      console.log(`User ${userId} joined waiting room ${roomId}. Total online: ${onlineUsers.size}`);
    });

    // 加入游戏（在 game.html 页面，游戏开始后进行游戏）
    socket.on('join_game', ({ roomId, userId, token }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.authenticated = true;
      
      // 更新用户状态为 'in_game'
      if (onlineUsers.has(userId)) {
        const user = onlineUsers.get(userId);
        user.socketId = socket.id;  // 更新 socketId
        user.status = 'in_game';
        user.gameRoomId = roomId;
        user.lastActive = Date.now();
      } else {
        // 如果之前没有记录，添加新记录
        onlineUsers.set(userId, {
          socketId: socket.id,
          status: 'in_game',
          roomId: null,
          gameRoomId: roomId,
          lastActive: Date.now()
        });
      }
      console.log(`User ${userId} joined game room ${roomId}. Total online: ${onlineUsers.size}`);
      
      // 清理该用户之前的 socket 记录（防止页面刷新后旧连接残留）
      for (const [sid, info] of socketMap.entries()) {
        if (info.userId === userId && info.roomId === roomId) {
          socketMap.delete(sid);
          console.log(`Cleaned up old socket for user ${userId}`);
          break;
        }
      }
      
      socketMap.set(socket.id, { roomId, userId });
      
      console.log(`User ${userId} joined room ${roomId}, socket: ${socket.id}`);

      // 如果游戏正在进行，更新 socket 映射
      const game = activeGames.get(roomId);
      if (game) {
        const playerIndex = game.findPlayerByUserId(userId);
        if (playerIndex >= 0) {
          const player = game.players[playerIndex];
          
          // 检查是否是真正的掉线后重连
          // 只有在已经被标记为 disconnected 且超过3秒延迟后才算真正的掉线重连
          const wasDisconnected = player.disconnected === true;
          
          if (wasDisconnected && game.status === 'playing') {
            console.log(`Player ${player.username} reconnected after true disconnect`);
            player.disconnected = false;
            player.disconnectedAt = null;
            
            // 广播重连消息（只在真正的掉线后重连时提示）
            io.to(roomId).emit('player_reconnected', {
              userId: userId,
              username: player.username,
              message: `${player.username} 已重新连接`
            });
          } else {
            // 正常加入游戏（首次进入或3秒内重连），不提示重连
            console.log(`Player ${player.username} joined normally (no disconnect or quick reconnect)`);
          }
          
          player.socketId = socket.id;
        }
        
        // 发送完整状态给该玩家
        try {
          socket.emit('game_state', game.toPrivateJSON(userId));
          // 广播公开状态给其他人
          socket.to(roomId).emit('public_state', game.toJSON());
        } catch (error) {
          console.error('Error sending game state:', error);
        }
      }
    });

    // 开始游戏（房主调用）
    socket.on('start_game', async ({ roomId }) => {
      console.log('Start game requested for room:', roomId);
      
      const room = await roomDB.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      const dbPlayers = await roomPlayerDB.getRoomPlayers(roomId);
      
      // 获取玩家详细信息（包括筹码）
      const players = [];
      for (const p of dbPlayers) {
        let chips = 1000;
        if (p.is_bot === 1) {
          // 人机使用默认筹码
          chips = 20000;
        } else {
          // 真实玩家从数据库获取筹码
          const user = await userDB.findById(p.user_id);
          chips = user ? user.chips : 1000;
        }
        players.push({
          ...p,
          chips: chips
        });
      }
      
      // 创建游戏状态
      const game = new GameState(roomId, players, {
        smallBlind: room.small_blind,
        bigBlind: room.big_blind
      });
      
      // 轮换庄家位置（根据已完成的游戏次数）
      const roomGames = room.game_count || 0;
      game.dealer = roomGames % game.players.length;
      
      // 增加游戏计数
      await roomDB.incrementGameCount(roomId);
      
      activeGames.set(roomId, game);

      // 从 socketMap 恢复 socketId
      socketMap.forEach((info, sockId) => {
        if (info.roomId === roomId) {
          const playerIndex = game.findPlayerByUserId(info.userId);
          if (playerIndex >= 0) {
            game.players[playerIndex].socketId = sockId;
            console.log(`Mapped socket ${sockId} to player ${info.userId}`);
          }
        }
      });

      // 发牌
      game.players.forEach(p => {
        p.hand = [game.dealCard(), game.dealCard()];
      });

      // 盲注
      const sbPos = (game.dealer + 1) % game.players.length;
      const bbPos = (game.dealer + 2) % game.players.length;
      
      game.players[sbPos].chips -= game.smallBlind;
      game.players[sbPos].currentBet = game.smallBlind;
      game.players[sbPos].hasActed = true; // 小盲注已行动
      game.pot += game.smallBlind;
      
      game.players[bbPos].chips -= game.bigBlind;
      game.players[bbPos].currentBet = game.bigBlind;
      game.players[bbPos].hasActed = true; // 大盲注已行动
      game.pot += game.bigBlind;
      game.currentBet = game.bigBlind;

      // 从UTG开始（大盲后一位）
      game.currentPlayer = (bbPos + 1) % game.players.length;

      console.log('Game started, broadcasting state...');
      console.log('Players:', game.players.map(p => ({ userId: p.userId, socketId: p.socketId })));

      // 确保所有玩家的 socket 都加入房间
      game.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.join(roomId);
          console.log(`Player ${p.userId} socket joined room ${roomId}`);
        }
      });

      // 广播游戏开始 - 每个玩家收到自己的手牌
      let sentCount = 0;
      game.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.emit('game_started', {
            redirect: '/game.html?id=' + roomId
          });
          playerSocket.emit('game_state', game.toPrivateJSON(p.userId));
          sentCount++;
          console.log(`Sent game start to player ${p.userId}`);
        } else {
          console.log(`Player ${p.userId} has no socket, skipping`);
        }
      });

      console.log(`Game start sent to ${sentCount}/${game.players.length} players`);

      // 广播公开状态
      io.to(roomId).emit('public_state', game.toJSON());

      // 检查第一个玩家是否是人机
      handleBotTurn(io, roomId, game);
    });

    // 玩家行动
    socket.on('player_action', async ({ action, amount }) => {
      const { roomId, userId } = socket;
      if (!roomId) {
        socket.emit('error', { message: '不在房间中' });
        return;
      }

      const game = activeGames.get(roomId);
      if (!game || game.status !== 'playing') {
        socket.emit('error', { message: '游戏未在进行中' });
        return;
      }

      const playerIndex = game.findPlayerByUserId(userId);
      if (playerIndex < 0) {
        socket.emit('error', { message: '不是游戏参与者' });
        return;
      }

      if (playerIndex !== game.currentPlayer) {
        socket.emit('error', { message: '不是你的回合' });
        return;
      }

      // 执行玩家行动
      await executePlayerAction(io, roomId, game, playerIndex, action, amount);
    });

    // 离开房间
    socket.on('leave_room', () => {
      if (socket.roomId) {
        socket.leave(socket.roomId);
        socketMap.delete(socket.id);
        console.log(`User ${socket.userId} left room ${socket.roomId}`);
      }
    });

    // 重连请求
    socket.on('reconnect_request', ({ roomId, userId }) => {
      console.log(`Reconnect request: user ${userId} to room ${roomId}`);
      
      const game = activeGames.get(roomId);
      if (!game) {
        // 游戏已经完全清理，无法重连
        socket.emit('reconnect_failed', { message: '游戏已结束' });
        return;
      }
      
      const playerIndex = game.findPlayerByUserId(userId);
      if (playerIndex < 0) {
        socket.emit('reconnect_failed', { message: '不是游戏参与者' });
        return;
      }
      
      const player = game.players[playerIndex];
      
      // 检查玩家是否之前已断开连接，如果是，清理相关定时器
      const prevSocketId = player.socketId;
      if (prevSocketId !== socket.id) {
        // 玩家重新连接，清理之前的断开连接定时器
        if (player.countdownInterval) {
          clearInterval(player.countdownInterval);
          player.countdownInterval = null;
        }
        if (player.disconnectTimer) {
          clearTimeout(player.disconnectTimer);
          player.disconnectTimer = null;
        }
      }
      
      // 更新 socket 映射
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      player.socketId = socket.id;
      player.disconnected = false;
      player.disconnectedAt = null;
      socketMap.set(socket.id, { roomId, userId });
      
      // 发送当前游戏状态
      socket.emit('reconnect_success', {
        gameState: game.toPrivateJSON(userId),
        message: '重连成功'
      });
      
      console.log(`User ${userId} reconnected to room ${roomId}`);
    });

    // 玩家在游戏结束后做出选择（留在房间或返回大厅）
    socket.on('player_choice_after_game', async ({ roomId, choice, userId }) => {
      console.log(`[ENDGAME] Received choice from ${userId}: ${choice} for room ${roomId}`);
      await handlePlayerChoice(io, roomId, userId, choice);
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // 从在线用户集合移除（但要检查是否是同一个socket）
      if (socket.userId && onlineUsers.has(socket.userId)) {
        const user = onlineUsers.get(socket.userId);
        // 只有当前socket匹配时才删除（防止新连接已建立时误删）
        if (user.socketId === socket.id) {
          onlineUsers.delete(socket.userId);
          console.log(`User ${socket.userId} is now offline. Total online: ${onlineUsers.size}`);
        } else {
          console.log(`User ${socket.userId} has new socket ${user.socketId}, keeping online status`);
        }
      }
      
      const info = socketMap.get(socket.id);
      if (info) {
        const { roomId, userId } = info;
        const game = activeGames.get(roomId);
        if (game && game.status === 'playing') {
          const playerIndex = game.findPlayerByUserId(userId);
          if (playerIndex >= 0) {
            const player = game.players[playerIndex];
            player.socketId = null;
            
            // 延迟3秒标记为掉线（给页面跳转留出时间）
            console.log(`Player ${player.username} disconnected, waiting 3s before marking as disconnected...`);
            
            // 添加一个标识，确保定时器不会重复执行
            const timeoutId = setTimeout(() => {
              try {
                // 3秒后检查玩家是否已经重新连接
                if (player.socketId === null && activeGames.has(roomId)) {
                  // 仍然没有连接，认为是真正的掉线
                  player.disconnected = true;
                  player.disconnectedAt = Date.now();
                  
                  console.log(`Player ${player.username} marked as disconnected after 3s delay`);
                  
                  // 广播玩家掉线（游戏中）
                  io.to(roomId).emit('player_disconnected', {
                    userId: userId,
                    username: player.username,
                    message: `${player.username} 已掉线，等待60秒重连...`
                  });
                  
                  // 所有掉线玩家都启动60秒倒计时，让他们有机会重连
                  if (activeGames.has(roomId)) {
                    console.log(`Player ${player.username} disconnected, starting 60s reconnect timer...`);
                    
                    // 为掉线玩家启动60秒倒计时
                    player.disconnectTimer = setTimeout(() => {
                      handleDisconnectTimeout(io, roomId, game, playerIndex);
                    }, 60000);
                    
                    // 启动倒计时广播（每秒发送一次，持续60秒）
                    let countdown = 60;
                    player.countdownInterval = setInterval(() => {
                      countdown--;
                      if (countdown >= 0 && activeGames.has(roomId) && player.disconnected) {
                        io.to(roomId).emit('player_disconnect_countdown', {
                          userId: userId,
                          username: player.username,
                          secondsLeft: countdown
                        });
                        
                        if (countdown === 0) {
                          // 倒计时结束，清除定时器
                          if (player.countdownInterval) {
                            clearInterval(player.countdownInterval);
                            player.countdownInterval = null;
                          }
                        }
                      } else {
                        // 游戏已结束或玩家已重连，清除定时器
                        if (player.countdownInterval) {
                          clearInterval(player.countdownInterval);
                          player.countdownInterval = null;
                        }
                      }
                    }, 1000);
                    
                    // 如果是当前行动玩家，额外标记游戏需要处理
                    if (game.currentPlayer === playerIndex) {
                      console.log(`Current player ${player.username} disconnected, will auto-fold after 60s`);
                    }
                  }
                } else {
                  console.log(`Player ${player.username} reconnected within 3s, not marking as disconnected`);
                }
              } catch (error) {
                console.error('Error in disconnect timeout handler:', error);
              }
            }, 3000);
          }
        } else if (game && game.status === 'finished') {
          // 游戏已结束，玩家正常离开，不做任何处理
          console.log(`Player ${userId} left finished game ${roomId}`);
        }
        
        // 广播玩家离开房间（等待房间）
        try {
          io.to(roomId).emit('player_offline', {
            userId: userId,
            message: '有玩家断开连接'
          });
        } catch (error) {
          console.error('Error emitting player_offline:', error);
        }
        
        socketMap.delete(socket.id);
      }
    });
  });
}

function shouldAdvanceRound(game) {
  const activePlayers = game.getActivePlayers();
  
  // 只剩一个活跃玩家，应该进入下一轮/结束
  if (activePlayers.length <= 1) {
    console.log(`[Game] Only ${activePlayers.length} active player(s), should advance`);
    return true;
  }
  
  // 检查所有活跃玩家是否都已行动（跟注或全下）
  const allBetMatched = activePlayers.every(p => 
    p.currentBet === game.currentBet || p.allIn
  );
  
  // 检查所有活跃玩家是否都至少行动过一次
  const allHaveActed = activePlayers.every(p => p.hasActed);
  
  console.log(`[Game] shouldAdvanceRound check: allBetMatched=${allBetMatched}, allHaveActed=${allHaveActed}`);
  console.log(`[Game] Active players: ${activePlayers.map(p => `${p.username}(hasActed:${p.hasActed},currentBet:${p.currentBet})`).join(', ')}`);
  
  // 只有当所有玩家都至少行动过一次，并且下注额相等时，才能进入下一轮
  if (allBetMatched && allHaveActed) {
    console.log(`[Game] All active players have acted and bets matched, should advance round`);
    return true;
  }
  
  return false;
}

async function advanceRound(io, roomId, game) {
  console.log(`[ADVANCE] Called for room ${roomId}, current round: ${game.currentRound}`);
  const notFoldedPlayers = game.getNotFoldedPlayers();
  console.log(`[ADVANCE] Not folded players: ${notFoldedPlayers.length} - ${notFoldedPlayers.map(p => p.username).join(', ')}`);
  
  // 检查是否还有任何玩家在游戏中（包括人机）
  if (notFoldedPlayers.length === 0) {
    console.log(`[ADVANCE] No players left, ending game`);
    // 没有任何玩家在游戏中，直接结束游戏并解散房间
    console.log(`[Game] Room ${roomId} - no players left, ending game and deleting room`);
    await roomDB.deleteRoom(roomId);
    activeGames.delete(roomId);
    
    io.to(roomId).emit('game_end', {
      message: '游戏结束，房间已解散',
      reason: 'no_players'
    });
    
    // 通知所有玩家返回大厅
    io.to(roomId).emit('room_deleted', {
      message: '房间已解散'
    });
    
    return;
  }
  
  // 只剩一个玩家，直接获胜
  if (notFoldedPlayers.length === 1) {
    console.log(`[ADVANCE] Only one player left: ${notFoldedPlayers[0].username}, calling endGame`);
    endGame(io, roomId, game, notFoldedPlayers[0]);
    return;
  }
  
  console.log(`[ADVANCE] Continuing to next round`);

  game.currentRound++;
  game.currentBet = 0;
  game.roundBets = 0;
  game.players.forEach(p => {
    p.currentBet = 0;
    p.hasActed = false; // 重置行动标记
  });
  console.log(`[ADVANCE] Reset hasActed for all players`);

  switch (game.currentRound) {
    case 1: // Flop
      game.communityCards.push(game.dealCard(), game.dealCard(), game.dealCard());
      break;
    case 2: // Turn
      game.communityCards.push(game.dealCard());
      break;
    case 3: // River
      game.communityCards.push(game.dealCard());
      break;
    case 4: // Showdown
      showdown(io, roomId, game);
      return;
  }

  // 找到第一个未弃牌玩家
  game.currentPlayer = game.findFirstActivePlayer();
  
  io.to(roomId).emit('new_round', {
    round: game.currentRound,
    communityCards: game.communityCards
  });

  broadcastGameState(io, roomId, game);

  // 检查第一个玩家是否是人机
  handleBotTurn(io, roomId, game);
}

function showdown(io, roomId, game) {
  console.log(`[SHOWDOWN] Called for room ${roomId}`);
  const activePlayers = game.getNotFoldedPlayers();
  console.log(`[SHOWDOWN] Active players: ${activePlayers.length} - ${activePlayers.map(p => p.username).join(', ')}`);
  
  if (activePlayers.length === 0) {
    console.log('[SHOWDOWN] No active players in showdown');
    return;
  }
  
  if (activePlayers.length === 1) {
    console.log(`[SHOWDOWN] Only one player left: ${activePlayers[0].username}, calling endGame`);
    endGame(io, roomId, game, activePlayers[0]);
    return;
  }
  
  // 使用 HandEvaluator 评估牌型决定胜负
  const winnerIndex = HandEvaluator.compareHands(activePlayers, game.communityCards);
  
  if (winnerIndex === -1) {
    // 平局，平分底池（简化处理：给第一个玩家）
    endGame(io, roomId, game, activePlayers[0], true);
  } else {
    const winner = activePlayers[winnerIndex];
    const bestHand = HandEvaluator.getBestHand(winner.hand, game.communityCards);
    endGame(io, roomId, game, winner, false, bestHand);
  }
}

async function endGame(io, roomId, game, winner, isTie = false, bestHand = null) {
  console.log(`[ENDGAME] Called for room ${roomId}, winner: ${winner ? winner.username : 'none'}, isTie: ${isTie}`);
  console.log(`[ENDGAME] Game state - status: ${game.status}, round: ${game.currentRound}, pot: ${game.pot}`);
  console.log(`[ENDGAME] Players: ${game.players.map(p => `${p.username}(folded:${p.folded},allIn:${p.allIn},eliminated:${p.eliminated})`).join(', ')}`);
  
  winner.chips += game.pot;
  game.status = 'finished';
  console.log(`[ENDGAME] Game status set to 'finished'`);
  
  // 清除掉线计时器（游戏结束，不再需要）
  if (game.disconnectTimer) {
    clearTimeout(game.disconnectTimer);
    game.disconnectTimer = null;
    console.log(`Cleared disconnect timer for room ${roomId}`);
  }
  
  // 重置所有玩家的掉线状态
  game.players.forEach(p => {
    p.disconnected = false;
    p.disconnectedAt = null;
  });
  
  // 更新数据库中的用户筹码（只更新真实玩家）
  for (const p of game.players) {
    if (!p.isBot) {
      await userDB.updateChips(p.userId, p.chips);
    }
  }
  
  // 检查哪些玩家筹码不足（小于100，无法参加下一局）
  const eliminatedPlayers = [];
  const continuePlayers = [];
  
  for (const p of game.players) {
    if (p.chips < 100) {
      eliminatedPlayers.push(p);
      // 从房间中移除筹码不足的玩家（只移除真实玩家）
      if (!p.isBot) {
        await roomPlayerDB.leaveRoom(roomId, p.userId);
      }
    } else {
      continuePlayers.push(p);
    }
  }
  
  // 发送所有玩家的手牌（游戏结束公开）
  const allHands = game.players.map(p => ({
    userId: p.userId,
    username: p.username,
    hand: p.hand,
    folded: p.folded,
    chips: p.chips,
    canContinue: p.chips >= 100
  }));
  
  // 获取真实玩家（不包括人机，且筹码>=100）
  const realPlayers = game.players.filter(p => !p.isBot && p.chips >= 100);
  
  io.to(roomId).emit('game_end', {
    winner: {
      userId: winner.userId,
      username: winner.username,
      winAmount: game.pot,
      handName: bestHand ? bestHand.name : (isTie ? '平局' : '获胜')
    },
    isTie,
    allHands,
    eliminatedPlayers: eliminatedPlayers.map(p => p.username),
    canContinue: continuePlayers.length >= 2, // 至少2人才能继续
    finalState: game.toJSON()
  });

  // 清理游戏相关定时器
  if (game.disconnectTimer) {
    clearTimeout(game.disconnectTimer);
    game.disconnectTimer = null;
  }
  if (game.countdownInterval) {
    clearInterval(game.countdownInterval);
    game.countdownInterval = null;
  }
  
  // 设置玩家选择状态
  game.playerChoices = new Map(); // 存储玩家的选择
  game.playersStaying = []; // 选择留下的玩家
  game.playersLeaving = []; // 选择离开的玩家
  game.choiceTimeout = null; // 选择超时定时器
  
  // 所有真实玩家都需要选择（筹码>=100）
  const playersNeedToChoose = realPlayers;
  
  if (playersNeedToChoose.length > 0) {
    console.log(`[ENDGAME] Waiting for ${playersNeedToChoose.length} players to choose (10 seconds)`);
    
    // 设置10秒超时
    game.choiceTimeout = setTimeout(async () => {
      console.log(`[ENDGAME] Choice timeout for room ${roomId}`);
      await handlePlayerChoicesTimeout(io, roomId, game);
    }, 10000); // 10秒超时
    
    // 存储需要选择的玩家列表
    game.playersNeedToChoose = playersNeedToChoose.map(p => p.userId);
  } else {
    // 没有真实玩家需要选择，直接处理结束
    console.log(`[ENDGAME] No real players need to choose, cleaning up immediately`);
    await cleanupAfterGame(io, roomId, game);
  }
}

// 处理玩家选择超时
async function handlePlayerChoicesTimeout(io, roomId, game) {
  console.log(`[ENDGAME] Handling choice timeout for room ${roomId}`);
  
  // 未选择的玩家根据筹码自动决定
  if (game.playersNeedToChoose) {
    for (const userId of game.playersNeedToChoose) {
      if (!game.playerChoices.has(userId)) {
        // 查找玩家信息
        const player = game.players.find(p => p.userId === userId);
        if (player) {
          if (player.chips >= 1000) {
            // 筹码>=1000，自动选择留下
            game.playerChoices.set(userId, 'stay');
            game.playersStaying.push(userId);
            await roomPlayerDB.setReady(roomId, userId, 0);
            console.log(`[ENDGAME] Player ${userId} auto-stayed (chips: ${player.chips})`);
          } else {
            // 筹码<1000，自动选择离开
            game.playerChoices.set(userId, 'leave');
            game.playersLeaving.push(userId);
            await roomPlayerDB.leaveRoom(roomId, userId);
            console.log(`[ENDGAME] Player ${userId} auto-left (chips: ${player.chips})`);
          }
        }
      }
    }
  }
  
  // 检查是否还有足够玩家留下
  const stayingCount = game.playersStaying.length;
  if (stayingCount >= 2) {
    // 足够玩家留下，自动开始下一局
    console.log(`[ENDGAME] ${stayingCount} players staying, auto-starting next game`);
    await autoStartNextGame(io, roomId, game);
  } else {
    // 不足够玩家留下，清理房间
    console.log(`[ENDGAME] Only ${stayingCount} player(s) staying, cleaning up room`);
    await cleanupAfterGame(io, roomId, game);
  }
}

// 处理玩家选择
async function handlePlayerChoice(io, roomId, userId, choice) {
  const game = activeGames.get(roomId);
  if (!game || game.status !== 'finished') {
    console.log(`[ENDGAME] Cannot handle choice - game not found or not finished`);
    return;
  }
  
  console.log(`[ENDGAME] Player ${userId} chose to ${choice}`);
  
  // 记录玩家选择
  game.playerChoices.set(userId, choice);
  
  if (choice === 'stay') {
    game.playersStaying.push(userId);
    // 重置准备状态
    await roomPlayerDB.setReady(roomId, userId, 0);
  } else {
    game.playersLeaving.push(userId);
    // 从房间中移除
    await roomPlayerDB.leaveRoom(roomId, userId);
  }
  
  // 通知所有玩家当前选择状态
  const readyCount = game.playerChoices.size;
  const totalCount = game.playersNeedToChoose ? game.playersNeedToChoose.length : 0;
  
  io.to(roomId).emit('waiting_for_players', {
    readyCount,
    totalCount
  });
  
  // 检查是否所有玩家都已选择
  if (game.playersNeedToChoose && readyCount >= totalCount) {
    console.log(`[ENDGAME] All players have made their choices`);
    
    // 清除超时定时器
    if (game.choiceTimeout) {
      clearTimeout(game.choiceTimeout);
      game.choiceTimeout = null;
    }
    
    // 检查是否还有足够玩家留下
    const stayingCount = game.playersStaying.length;
    if (stayingCount >= 2) {
      // 足够玩家留下，自动开始下一局
      console.log(`[ENDGAME] ${stayingCount} players staying, auto-starting next game`);
      await autoStartNextGame(io, roomId, game);
    } else {
      // 不足够玩家留下，清理房间
      console.log(`[ENDGAME] Only ${stayingCount} player(s) staying, cleaning up room`);
      await cleanupAfterGame(io, roomId, game);
    }
  }
}

// 自动开始下一局游戏
async function autoStartNextGame(io, roomId, game) {
  console.log(`[ENDGAME] Auto-starting next game for room ${roomId}`);
  
  // 通知所有玩家游戏即将重新开始
  io.to(roomId).emit('game_restart', {
    message: '游戏即将开始！',
    stayingPlayers: game.playersStaying,
    countdown: 5 // 5秒倒计时后开始
  });
  
  // 等待5秒让玩家准备
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 清理旧游戏状态
  activeGames.delete(roomId);
  
  // 重置房间状态为等待
  await roomDB.updateRoomStatus(roomId, 'waiting');
  
  console.log(`[ENDGAME] Old game state cleaned, starting new game`);
  
  // 获取房间信息
  const room = await roomDB.getRoomById(roomId);
  if (!room) {
    console.log(`[ENDGAME] Room ${roomId} not found, cannot start new game`);
    return;
  }
  
  // 获取当前房间玩家
  const dbPlayers = await roomPlayerDB.getRoomPlayers(roomId);
  if (dbPlayers.length < 2) {
    console.log(`[ENDGAME] Not enough players (${dbPlayers.length}), cannot start new game`);
    return;
  }
  
  // 获取玩家详细信息（包括筹码）
  const players = [];
  for (const p of dbPlayers) {
    let chips = 1000;
    if (p.is_bot === 1) {
      chips = 20000;
    } else {
      const user = await userDB.findById(p.user_id);
      chips = user ? user.chips : 1000;
    }
    players.push({
      ...p,
      chips: chips
    });
  }
  
  // 创建新的游戏状态
  const newGame = new GameState(roomId, players, {
    smallBlind: room.small_blind,
    bigBlind: room.big_blind
  });
  
  // 轮换庄家位置
  const roomGames = room.game_count || 0;
  newGame.dealer = roomGames % newGame.players.length;
  
  // 增加游戏计数
  await roomDB.incrementGameCount(roomId);
  
  activeGames.set(roomId, newGame);
  
  // 更新房间状态为游戏中
  await roomDB.updateRoomStatus(roomId, 'playing');
  
  // 从 socketMap 恢复 socketId
  socketMap.forEach((info, sockId) => {
    if (info.roomId === roomId) {
      const playerIndex = newGame.findPlayerByUserId(info.userId);
      if (playerIndex >= 0) {
        newGame.players[playerIndex].socketId = sockId;
        console.log(`[ENDGAME] Mapped socket ${sockId} to player ${info.userId}`);
      }
    }
  });
  
  // 发牌
  newGame.players.forEach(p => {
    p.hand = [newGame.dealCard(), newGame.dealCard()];
  });
  
  // 盲注
  const sbPos = (newGame.dealer + 1) % newGame.players.length;
  const bbPos = (newGame.dealer + 2) % newGame.players.length;
  
  newGame.players[sbPos].chips -= newGame.smallBlind;
  newGame.players[sbPos].currentBet = newGame.smallBlind;
  newGame.players[sbPos].hasActed = true;
  newGame.pot += newGame.smallBlind;
  
  newGame.players[bbPos].chips -= newGame.bigBlind;
  newGame.players[bbPos].currentBet = newGame.bigBlind;
  newGame.players[bbPos].hasActed = true;
  newGame.pot += newGame.bigBlind;
  newGame.currentBet = newGame.bigBlind;
  
  // 从UTG开始
  newGame.currentPlayer = (bbPos + 1) % newGame.players.length;
  
  console.log(`[ENDGAME] New game started, broadcasting state...`);
  
  // 确保所有玩家的 socket 都加入房间
  newGame.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.socketId);
    if (playerSocket) {
      playerSocket.join(roomId);
    }
  });
  
  // 广播游戏开始
  let sentCount = 0;
  newGame.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.socketId);
    if (playerSocket) {
      playerSocket.emit('game_started', {
        redirect: '/game.html?id=' + roomId
      });
      playerSocket.emit('game_state', newGame.toPrivateJSON(p.userId));
      sentCount++;
    }
  });
  
  console.log(`[ENDGAME] Game start sent to ${sentCount}/${newGame.players.length} players`);
  
  // 广播公开状态
  io.to(roomId).emit('public_state', newGame.toJSON());
  
  // 检查第一个玩家是否是人机
  handleBotTurn(io, roomId, newGame);
}

// 游戏结束后的清理工作
async function cleanupAfterGame(io, roomId, game) {
  console.log(`[ENDGAME] Cleaning up game ${roomId}`);
  
  // 获取当前房间人数
  const playerCount = await roomPlayerDB.getPlayerCount(roomId);
  
  // 计算留下的真实玩家数量
  const stayingRealPlayers = game.playersStaying ? game.playersStaying.length : 0;
  
  if (playerCount === 0) {
    // 所有人都被淘汰或离开，删除房间
    await roomDB.deleteRoom(roomId);
    console.log(`[ENDGAME] Room ${roomId} deleted - all players left`);
    activeGames.delete(roomId);
  } else if (stayingRealPlayers === 0 && playerCount > 0) {
    // 没有真实玩家留下，但还有玩家（可能是人机或筹码不足的玩家）
    await roomDB.updateRoomStatus(roomId, 'waiting');
    console.log(`[ENDGAME] Room ${roomId} reset to waiting - no real players staying`);
    activeGames.delete(roomId);
  } else if (playerCount === 1) {
    // 只剩一个人，重置为等待状态
    await roomDB.updateRoomStatus(roomId, 'waiting');
    console.log(`[ENDGAME] Room ${roomId} reset to waiting - only one player left`);
    activeGames.delete(roomId);
  } else {
    // 多人可以下一局，重置为等待状态并通知玩家
    await roomDB.updateRoomStatus(roomId, 'waiting');
    console.log(`[ENDGAME] Room ${roomId} ready for next game with ${stayingRealPlayers} staying players`);
    
    // 通知留下的玩家游戏即将重新开始
    if (game.playersStaying && game.playersStaying.length > 0) {
      io.to(roomId).emit('game_restart', {
        message: '游戏即将开始！',
        stayingPlayers: game.playersStaying
      });
    }
    
    // 清理游戏状态
    activeGames.delete(roomId);
  }
}

// 处理掉线超时（60秒后自动弃牌并移除）
function handleDisconnectTimeout(io, roomId, game, playerIndex) {
  const player = game.players[playerIndex];
  if (!player || !player.disconnected) {
    console.log(`Player ${playerIndex} reconnected or not found, cancel timeout`);
    // 如果玩家重新连接，确保清理定时器
    if (player && player.countdownInterval) {
      clearInterval(player.countdownInterval);
      player.countdownInterval = null;
    }
    return;
  }
  
  console.log(`Player ${player.username} timeout (60s), auto folding and removing...`);
  
  // 清除相关的定时器
  if (player.countdownInterval) {
    clearInterval(player.countdownInterval);
    player.countdownInterval = null;
  }
  
  // 自动弃牌
  player.folded = true;
  
  // 广播该玩家因超时被弃牌
  io.to(roomId).emit('action_broadcast', {
    playerId: player.userId,
    username: player.username,
    action: 'fold',
    amount: 0,
    currentPot: game.pot,
    message: `${player.username} 掉线超时被自动弃牌`
  });
  
  // 从游戏中移除该玩家（标记为已移除）
  player.eliminated = true;
  
  // 广播玩家被移除
  io.to(roomId).emit('player_removed', {
    userId: player.userId,
    username: player.username,
    reason: 'disconnect_timeout',
    message: `${player.username} 因掉线被移出游戏`
  });
  
  // 注意：这里不从 room_players 中移除玩家，以便他们可以重连
  // 只有在游戏结束时才清理不在游戏中的玩家
  
  // 检查是否进入下一轮或结束游戏
  const activePlayers = game.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
  
  if (activePlayers.length <= 1) {
    // 只剩一个活跃玩家，结束游戏
    if (activePlayers.length === 1) {
      endGame(io, roomId, game, activePlayers[0]);
    } else {
      // 没有活跃玩家，平局处理
      showdown(io, roomId, game);
    }
  } else {
    // 继续游戏，找到下一个可行动的玩家
    const nextPlayer = game.findNextActivePlayer(game.currentPlayer);
    if (nextPlayer >= 0) {
      game.currentPlayer = nextPlayer;
      broadcastGameState(io, roomId, game);
    } else {
      // 没有找到下一个玩家，但还有多个活跃玩家，这不应该发生
      console.error(`[Disconnect] No next player found but ${activePlayers.length} active players remain`);
      // 尝试结束游戏
      if (activePlayers.length === 1) {
        endGame(io, roomId, game, activePlayers[0]);
      }
    }
  }
}

// 存储 io 实例供监控使用
let ioInstance = null;

function broadcastGameState(io, roomId, game) {
  // 保存 io 实例
  if (!ioInstance && io) {
    ioInstance = io;
  }
  
  console.log(`[Broadcast] Room ${roomId}, Round ${game.currentRound}, CurrentPlayer: ${game.currentPlayer}, Players: ${game.players.length}`);
  
  // 更新游戏状态监控
  updateGameStateMonitor(roomId, game);
  
  // 给每个在线玩家发送包含自己手牌的私有状态
  game.players.forEach(p => {
    if (p.socketId) {
      try {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket && playerSocket.connected) {
          playerSocket.emit('game_state', game.toPrivateJSON(p.userId));
          console.log(`[Broadcast] Sent state to player ${p.username} (userId: ${p.userId}, isBot: ${p.isBot})`);
        } else {
          // Socket不可用，清空该玩家的socketId
          p.socketId = null;
        }
      } catch (error) {
        console.error('Error emitting game state to player:', error);
        // 清空该玩家的socketId
        p.socketId = null;
      }
    }
  });

  // 广播公开状态给所有人（包括观战者）
  try {
    io.to(roomId).emit('public_state', game.toJSON());
    console.log(`[Broadcast] Sent public state to room ${roomId}`);
  } catch (error) {
    console.error('Error broadcasting public state:', error);
  }
}

// 更新游戏状态监控
function updateGameStateMonitor(roomId, game) {
  const now = Date.now();
  const monitor = gameStateMonitors.get(roomId);
  
  // 获取当前玩家
  const currentPlayer = game.players[game.currentPlayer];
  
  if (!monitor) {
    // 首次记录
    gameStateMonitors.set(roomId, {
      lastUpdate: now,
      currentPlayer: game.currentPlayer,
      currentRound: game.currentRound,
      pot: game.pot,
      stuckCount: 0,
      isBotTurn: currentPlayer ? currentPlayer.isBot : false
    });
    return;
  }
  
  // 检查状态是否改变
  if (monitor.currentPlayer !== game.currentPlayer || 
      monitor.currentRound !== game.currentRound ||
      monitor.pot !== game.pot) {
    // 状态已改变，重置监控
    monitor.lastUpdate = now;
    monitor.currentPlayer = game.currentPlayer;
    monitor.currentRound = game.currentRound;
    monitor.pot = game.pot;
    monitor.stuckCount = 0;
    monitor.isBotTurn = currentPlayer ? currentPlayer.isBot : false;
    return;
  }
  
  // 状态未改变，检查是否卡住
  const timeSinceLastUpdate = now - monitor.lastUpdate;
  
  // 如果当前是真人玩家的回合，给更多时间（60秒）
  const isBotTurn = currentPlayer ? currentPlayer.isBot : false;
  const threshold = isBotTurn ? 15000 : 60000; // 人机15秒，真人60秒
  
  if (timeSinceLastUpdate > threshold) {
    monitor.stuckCount++;
    console.log(`[Monitor] Room ${roomId} state unchanged for ${timeSinceLastUpdate}ms (${isBotTurn ? 'bot' : 'human'} turn), stuckCount: ${monitor.stuckCount}`);
    
    // 如果连续3次检测到卡住，尝试恢复
    if (monitor.stuckCount >= 3) {
      console.error(`[Monitor] Room ${roomId} appears to be stuck! Attempting recovery...`);
      recoverStuckGame(roomId, game);
      monitor.stuckCount = 0;
      monitor.lastUpdate = now;
    }
  }
}

// 恢复卡住的游戏
async function recoverStuckGame(roomId, game) {
  if (!ioInstance) {
    console.error(`[Recovery] IO instance not available`);
    return;
  }
  
  try {
    console.log(`[Recovery] Attempting to recover stuck game in room ${roomId}`);
    
    // 检查当前玩家是否有效
    if (game.currentPlayer < 0 || game.currentPlayer >= game.players.length) {
      console.log(`[Recovery] Invalid currentPlayer ${game.currentPlayer}, finding next active player`);
      const nextPlayer = game.findNextActivePlayer(0);
      if (nextPlayer >= 0) {
        game.currentPlayer = nextPlayer;
      } else {
        // 没有活跃玩家，结束游戏
        console.log(`[Recovery] No active players, ending game`);
        const notFoldedPlayers = game.getNotFoldedPlayers();
        if (notFoldedPlayers.length === 1) {
          await endGame(ioInstance, roomId, game, notFoldedPlayers[0]);
        } else {
          await showdown(ioInstance, roomId, game);
        }
        return;
      }
    }
    
    const currentPlayer = game.players[game.currentPlayer];
    
    // 如果当前玩家是人机，强制它行动
    if (currentPlayer && currentPlayer.isBot) {
      console.log(`[Recovery] Forcing bot ${currentPlayer.username} to fold`);
      await executePlayerAction(ioInstance, roomId, game, game.currentPlayer, 'fold', 0);
      return;
    }
    
    // 如果当前玩家是真人且不在线，自动弃牌
    if (currentPlayer && !currentPlayer.isBot) {
      const playerSocket = ioInstance.sockets.sockets.get(currentPlayer.socketId);
      if (!playerSocket || !playerSocket.connected) {
        console.log(`[Recovery] Player ${currentPlayer.username} is offline, auto-folding`);
        await executePlayerAction(ioInstance, roomId, game, game.currentPlayer, 'fold', 0);
        return;
      }
    }
    
    // 尝试推进到下一轮
    console.log(`[Recovery] Trying to advance round`);
    if (shouldAdvanceRound(game)) {
      await advanceRound(ioInstance, roomId, game);
    } else {
      // 强制找到下一个玩家
      const nextPlayer = game.findNextActivePlayer(game.currentPlayer);
      if (nextPlayer >= 0 && nextPlayer !== game.currentPlayer) {
        game.currentPlayer = nextPlayer;
        broadcastGameState(ioInstance, roomId, game);
        handleBotTurn(ioInstance, roomId, game);
      }
    }
  } catch (error) {
    console.error(`[Recovery] Error recovering game:`, error);
  }
}

// 处理人机行动
function handleBotTurn(io, roomId, game) {
  // 检查游戏状态
  if (!game || game.status !== 'playing') {
    console.log(`[Bot] Game not active, skipping bot turn`);
    return;
  }
  
  // 检查当前玩家索引是否有效
  if (game.currentPlayer < 0 || game.currentPlayer >= game.players.length) {
    console.error(`[Bot] Invalid currentPlayer index: ${game.currentPlayer}`);
    // 尝试修复当前玩家索引
    const nextPlayer = game.findNextActivePlayer(0);
    if (nextPlayer >= 0) {
      game.currentPlayer = nextPlayer;
      broadcastGameState(io, roomId, game);
    }
    return;
  }
  
  const currentPlayer = game.players[game.currentPlayer];
  
  if (!currentPlayer) {
    console.error(`[Bot] Current player is null at index ${game.currentPlayer}`);
    return;
  }
  
  if (!currentPlayer.isBot) {
    console.log(`[Bot] Current player ${currentPlayer.username} is not a bot, skipping`);
    return;
  }
  
  // 检查人机是否还可以行动
  if (currentPlayer.folded || currentPlayer.allIn || currentPlayer.eliminated) {
    console.log(`[Bot] Bot ${currentPlayer.username} cannot act (folded: ${currentPlayer.folded}, allIn: ${currentPlayer.allIn}, eliminated: ${currentPlayer.eliminated})`);
    // 跳过这个人机，找到下一个可行动的玩家
    const nextPlayer = game.findNextActivePlayer(game.currentPlayer);
    if (nextPlayer >= 0 && nextPlayer !== game.currentPlayer) {
      game.currentPlayer = nextPlayer;
      broadcastGameState(io, roomId, game);
      // 递归调用处理下一个玩家
      handleBotTurn(io, roomId, game);
    }
    return;
  }
  
  console.log(`[Bot] Bot ${currentPlayer.username} is taking action...`);
  
  // 延迟2-5秒模拟思考时间（根据决策难度不同）
  // 随机生成思考时间，让体验更真实
  const thinkTime = 2000 + Math.random() * 3000;
  
  setTimeout(async () => {
    // 再次检查游戏状态（延迟后可能已改变）
    if (!activeGames.has(roomId) || !game || game.status !== 'playing') {
      console.log(`[Bot] Game state changed during thinking, aborting action`);
      return;
    }
    
    // 检查当前玩家是否仍然是这个人机
    const currentPlayerIndex = game.currentPlayer;
    if (currentPlayerIndex < 0 || currentPlayerIndex >= game.players.length) {
      console.error(`[Bot] Invalid currentPlayer index after thinking: ${currentPlayerIndex}`);
      return;
    }
    
    const player = game.players[currentPlayerIndex];
    if (!player || !player.isBot || player.userId !== currentPlayer.userId) {
      console.log(`[Bot] Turn changed to another player, aborting bot action`);
      return;
    }
    
    // 检查人机是否还可以行动
    if (player.folded || player.allIn || player.eliminated) {
      console.log(`[Bot] Bot ${player.username} cannot act anymore, skipping`);
      // 找到下一个玩家
      const nextPlayer = game.findNextActivePlayer(game.currentPlayer);
      if (nextPlayer >= 0 && nextPlayer !== game.currentPlayer) {
        game.currentPlayer = nextPlayer;
        broadcastGameState(io, roomId, game);
        handleBotTurn(io, roomId, game);
      }
      return;
    }
    
    try {
      const decision = botAI.decideAction(game, currentPlayerIndex);
      
      console.log(`[Bot] Bot ${player.username} decided: ${decision.action}${decision.amount ? ` ${decision.amount}` : ''}`);
      
      // 执行人机的行动
      await executePlayerAction(io, roomId, game, currentPlayerIndex, decision.action, decision.amount);
    } catch (error) {
      console.error(`[Bot] Error executing bot action:`, error);
      // 如果出错，尝试让人机弃牌
      try {
        await executePlayerAction(io, roomId, game, currentPlayerIndex, 'fold', 0);
      } catch (foldError) {
        console.error(`[Bot] Error folding bot:`, foldError);
      }
    }
  }, thinkTime);
}

// 执行玩家行动（包括人机）
async function executePlayerAction(io, roomId, game, playerIndex, action, amount) {
  console.log(`[ACTION] Executing action for room ${roomId}, playerIndex: ${playerIndex}, action: ${action}, amount: ${amount}`);
  
  const player = game.players[playerIndex];
  if (!player) {
    console.error(`[ACTION] Player not found at index ${playerIndex}`);
    return;
  }
  
  console.log(`[ACTION] Player: ${player.username}, currentBet: ${player.currentBet}, chips: ${player.chips}`);
  console.log(`[ACTION] Game state - currentPlayer: ${game.currentPlayer}, currentBet: ${game.currentBet}, pot: ${game.pot}`);
  
  switch (action) {
    case 'fold':
      player.folded = true;
      break;
    case 'check':
      if (player.currentBet !== game.currentBet) {
        const errorMsg = `Player ${player.username} tried to check but needs to call`;
        console.error(errorMsg);
        if (!player.isBot) {
          const socket = io.sockets.sockets.get(player.socketId);
          if (socket) socket.emit('error', { message: '不能过牌，需要跟注' });
        }
        return;
      }
      break;
    case 'call':
      const callAmount = Math.min(game.currentBet - player.currentBet, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      game.pot += callAmount;
      if (player.chips === 0) player.allIn = true;
      break;
    case 'raise':
      const raiseTotal = Math.min(amount, player.chips + player.currentBet);
      const actualRaise = raiseTotal - player.currentBet;
      if (actualRaise <= 0) {
        const errorMsg = `Player ${player.username} tried invalid raise`;
        console.error(errorMsg);
        if (!player.isBot) {
          const socket = io.sockets.sockets.get(player.socketId);
          if (socket) socket.emit('error', { message: '加注金额无效' });
        }
        return;
      }
      player.chips -= actualRaise;
      player.currentBet = raiseTotal;
      game.pot += actualRaise;
      if (player.currentBet > game.currentBet) {
        game.lastRaise = player.currentBet - game.currentBet;
        game.currentBet = player.currentBet;
      }
      game.roundBets++;
      if (player.chips === 0) player.allIn = true;
      break;
    case 'allin':
      const allInAmount = player.chips;
      player.chips = 0;
      player.currentBet += allInAmount;
      game.pot += allInAmount;
      if (player.currentBet > game.currentBet) {
        game.currentBet = player.currentBet;
      }
      player.allIn = true;
      break;
    default:
      const errorMsg = `Player ${player.username} made invalid action: ${action}`;
      console.error(errorMsg);
      if (!player.isBot) {
        const socket = io.sockets.sockets.get(player.socketId);
        if (socket) socket.emit('error', { message: '无效的行动' });
      }
      return;
  }

  // 标记玩家已行动
  player.hasActed = true;
  console.log(`[ACTION] Player ${player.username} has acted, hasActed set to true`);

  // 广播行动
  io.to(roomId).emit('action_broadcast', {
    playerId: player.userId,
    username: player.username,
    action,
    amount: action === 'raise' ? amount : (action === 'call' ? game.currentBet - player.currentBet : 0),
    currentPot: game.pot
  });

  // 检查是否进入下一轮
    console.log(`[ACTION] Checking shouldAdvanceRound for room ${roomId}`);
    if (shouldAdvanceRound(game)) {
      console.log(`[ACTION] shouldAdvanceRound returned true, advancing round`);
      await advanceRound(io, roomId, game);
    } else {
      console.log(`[ACTION] shouldAdvanceRound returned false, finding next player`);
      // 下一个玩家
      const nextPlayer = game.findNextActivePlayer(game.currentPlayer);
      
      // 检查是否找到下一个玩家
      if (nextPlayer < 0) {
        console.error(`[Game] No next active player found after ${player.username}'s action. Ending game.`);
        // 没有活跃玩家，结束游戏
        const notFoldedPlayers = game.getNotFoldedPlayers();
        if (notFoldedPlayers.length === 1) {
          await endGame(io, roomId, game, notFoldedPlayers[0]);
        } else if (notFoldedPlayers.length === 0) {
          // 所有人都弃牌了，不应该发生，但处理一下
          console.error(`[Game] All players folded unexpectedly!`);
          await showdown(io, roomId, game);
        } else {
          // 还有未弃牌玩家但都不是活跃状态（都全下了），进入摊牌
          console.log(`[Game] All remaining players are all-in, going to showdown`);
          await advanceRound(io, roomId, game);
        }
        return;
      }
      
      game.currentPlayer = nextPlayer;
      broadcastGameState(io, roomId, game);
      
      // 检查下一个玩家是否是人机
      handleBotTurn(io, roomId, game);
    }
}

module.exports = {
  initSocketHandlers,
  activeGames,
  getOnlineUsers
};