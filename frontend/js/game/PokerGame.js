/**
 * 扑克游戏主类
 * 管理游戏流程、状态和所有组件
 */

class PokerGame {
    constructor() {
        this.deck = new Deck();
        this.players = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentRound = 0; // 0: Pre-flop, 1: Flop, 2: Turn, 3: River, 4: Showdown
        this.currentPlayer = 0;
        this.dealer = 0;
        this.smallBlind = GameConfig.BLINDS.SMALL;
        this.bigBlind = GameConfig.BLINDS.BIG;
        this.currentBet = 0;
        this.lastRaise = GameConfig.BLINDS.BIG;
        this.roundBets = 0;
        
        // UI组件
        this.renderer = null;
        this.controls = null;
        
        this.initPlayers();
    }
    
    /**
     * 设置UI组件（可选，用于联机版时可能不需要）
     */
    setUI(renderer, controls) {
        this.renderer = renderer;
        this.controls = controls;
    }
    
    /**
     * 初始化玩家
     */
    initPlayers() {
        this.players = [];
        for (let i = 0; i < GameConfig.PLAYERS.COUNT; i++) {
            this.players.push(new Player(
                i, 
                GameConfig.PLAYERS.NAMES[i], 
                GameConfig.INITIAL_CHIPS, 
                i !== 0
            ));
        }
    }
    
    /**
     * 检查并淘汰筹码不足的玩家
     */
    checkEliminatedPlayers() {
        this.players.forEach(player => {
            if (!player.eliminated && player.chips < this.bigBlind) {
                player.eliminated = true;
                if (this.renderer) {
                    this.renderer.setEliminated(player.id);
                }
            }
        });
    }
    
    /**
     * 获取可参与游戏的玩家（未淘汰且筹码足够）
     */
    getActivePlayers() {
        return this.players.filter(p => !p.eliminated);
    }
    
    /**
     * 获取可参与游戏的玩家数量
     */
    getActivePlayerCount() {
        return this.players.filter(p => !p.eliminated).length;
    }
    
    /**
     * 找到下一个未淘汰的玩家位置
     */
    findNextActivePlayer(startPos) {
        let pos = (startPos + 1) % this.players.length;
        let loopCount = 0;
        while (this.players[pos].eliminated && loopCount < this.players.length) {
            pos = (pos + 1) % this.players.length;
            loopCount++;
        }
        return loopCount >= this.players.length ? -1 : pos;
    }
    
    /**
     * 开始新的一局
     */
    startNewHand() {
        // 检查并淘汰筹码不足的玩家
        this.checkEliminatedPlayers();
        
        // 检查是否还有足够玩家继续
        const activePlayerCount = this.getActivePlayerCount();
        if (activePlayerCount < 2) {
            alert('游戏结束！玩家数量不足。');
            return;
        }
        
        // 重置
        this.deck.reset();
        this.communityCards = [];
        this.pot = 0;
        this.currentRound = 0;
        this.currentBet = 0;
        this.roundBets = 0;
        this.players.forEach(p => p.reset());
        
        // 重置UI
        if (this.renderer) {
            this.renderer.resetGameUI();
            this.renderer.resetCurrentBets();
        }
        
        // 发牌（跳过被淘汰的玩家）
        for (let i = 0; i < 2; i++) {
            this.players.forEach(p => {
                if (!p.eliminated) {
                    p.hand.push(this.deck.deal());
                }
            });
        }
        
        // 盲注（跳过被淘汰的玩家）
        this.dealer = this.findNextActivePlayer(this.dealer);
        if (this.dealer === -1) return;
        
        let sbPos = this.findNextActivePlayer(this.dealer);
        if (sbPos === -1) return;
        
        let bbPos = this.findNextActivePlayer(sbPos);
        if (bbPos === -1) return;
        
        this.players[sbPos].bet(this.smallBlind);
        this.players[bbPos].bet(this.bigBlind);
        this.currentBet = this.bigBlind;
        this.pot = this.smallBlind + this.bigBlind;
        
        // 显示盲注下注动画
        if (this.renderer) {
            setTimeout(() => {
                this.renderer.showBetFlash(this.players[sbPos].id, this.smallBlind, 'bet');
            }, 300);
            setTimeout(() => {
                this.renderer.showBetFlash(this.players[bbPos].id, this.bigBlind, 'bet');
            }, 600);
        }
        
        // 更新UI
        if (this.renderer) {
            this.renderer.updatePositions();
            this.renderer.updatePlayerHand();
            this.renderer.updateUI();
            this.renderer.toggleControlPanels(true);
        }
        
        // 从UTG开始（大盲注后一位，跳过被淘汰的）
        this.currentPlayer = this.findNextActivePlayer(bbPos);
        
        this.checkPlayerTurn();
    }
    
    /**
     * 检查是否轮到玩家行动
     */
    checkPlayerTurn() {
        if (this.players[this.currentPlayer].isAI) {
            setTimeout(() => this.aiAction(), GameConfig.AI.DECISION_DELAY);
        } else {
            if (this.controls) this.controls.update();
        }
    }
    
    /**
     * AI行动
     */
    aiAction() {
        const player = this.players[this.currentPlayer];
        const decision = SimpleAI.makeDecision(
            player, 
            this.currentBet, 
            this.lastRaise, 
            this.roundBets
        );
        
        if (decision.action !== 'skip') {
            if (this.renderer && decision.message) {
                this.renderer.showChat(this.currentPlayer, decision.message);
            }
            this.executeAction(decision.action, decision.amount);
        } else {
            this.nextPlayer();
        }
    }
    
    /**
     * 执行动作
     */
    executeAction(action, amount = 0) {
        const player = this.players[this.currentPlayer];
        
        // 安全检查：如果玩家筹码不足或被淘汰，自动弃牌
        if (player.eliminated || player.chips < 0) {
            player.folded = true;
            if (this.renderer) this.renderer.setFolded(player.id);
            this.nextPlayer();
            return;
        }
        
        // 安全检查：确保下注金额不超过筹码
        amount = Math.min(amount, player.chips);
        amount = Math.max(0, amount);  // 确保不为负数
        
        switch(action) {
            case 'fold':
                player.folded = true;
                if (this.renderer) {
                    this.renderer.setFolded(player.id);
                }
                break;
            case 'check':
                break;
            case 'call':
                const callAmount = this.currentBet - player.currentBet;
                if (callAmount > 0) {
                    this.pot += player.bet(callAmount);
                    if (this.renderer) {
                        this.renderer.showBetFlash(player.id, callAmount, 'call');
                    }
                }
                break;
            case 'raise':
                const raiseAmount = amount - (this.currentBet - player.currentBet);
                this.pot += player.bet(amount);
                this.currentBet = player.currentBet;
                this.lastRaise = raiseAmount;
                this.roundBets++;
                if (this.renderer) {
                    this.renderer.showBetFlash(player.id, amount, 'raise');
                }
                break;
            case 'allin':
                const allInAmount = player.chips;
                this.pot += player.bet(allInAmount);
                if (player.currentBet > this.currentBet) {
                    this.currentBet = player.currentBet;
                }
                if (this.renderer && allInAmount > 0) {
                    this.renderer.showBetFlash(player.id, allInAmount, 'allin');
                }
                break;
        }
        
        if (this.renderer) {
            this.renderer.updateUI();
        }
        
        // 检查是否进入下一轮
        if (this.shouldAdvanceRound()) {
            this.advanceRound();
        } else {
            this.nextPlayer();
        }
    }
    
    /**
     * 判断是否进入下一轮
     */
    shouldAdvanceRound() {
        const activePlayers = this.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
        
        // 只剩一个未弃牌玩家，直接结束
        if (activePlayers.length <= 1) return true;
        
        // 所有活跃玩家都已行动且下注额相等
        const allActed = activePlayers.every(p => p.currentBet === this.currentBet || p.allIn);
        
        // Pre-flop 轮需要大盲注后至少一轮下注，其他轮次至少一轮
        return allActed && this.roundBets >= 0;
    }
    
    /**
     * 下一个玩家
     */
    nextPlayer() {
        const activePlayers = this.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
        
        // 如果只剩一个活跃玩家，直接进入下一轮
        if (activePlayers.length <= 1) {
            this.advanceRound();
            return;
        }
        
        // 找到下一个可以行动的玩家（跳过弃牌、全下、被淘汰的）
        let nextPlayer = (this.currentPlayer + 1) % this.players.length;
        let loopCount = 0;
        
        while ((this.players[nextPlayer].folded || this.players[nextPlayer].allIn || this.players[nextPlayer].eliminated) && loopCount < this.players.length) {
            nextPlayer = (nextPlayer + 1) % this.players.length;
            loopCount++;
        }
        
        // 如果找不到可行动玩家，进入下一轮
        if (loopCount >= this.players.length) {
            this.advanceRound();
            return;
        }
        
        this.currentPlayer = nextPlayer;
        this.checkPlayerTurn();
    }
    
    /**
     * 进入下一轮
     */
    advanceRound() {
        // 检查是否只剩一个未弃牌玩家，直接结束
        const notFoldedPlayers = this.players.filter(p => !p.folded && !p.eliminated);
        if (notFoldedPlayers.length === 1) {
            this.singlePlayerWin(notFoldedPlayers[0]);
            return;
        }
        
        this.currentRound++;
        this.currentBet = 0;
        this.roundBets = 0;
        this.players.forEach(p => p.currentBet = 0);
        
        switch(this.currentRound) {
            case GameConfig.ROUNDS.FLOP:
                for (let i = 0; i < 3; i++) {
                    this.communityCards.push(this.deck.deal());
                }
                break;
            case GameConfig.ROUNDS.TURN:
                this.communityCards.push(this.deck.deal());
                break;
            case GameConfig.ROUNDS.RIVER:
                this.communityCards.push(this.deck.deal());
                break;
            case GameConfig.ROUNDS.SHOWDOWN:
                this.showdown();
                return;
        }
        
        if (this.renderer) {
            this.renderer.updateCommunityCards();
            this.renderer.updatePlayerHand();
            this.renderer.updateRound(this.currentRound);
            this.renderer.resetCurrentBets();
            this.renderer.updateUI();
        }
        
        // 找到第一个未弃牌且未淘汰的玩家
        this.currentPlayer = this.players.findIndex(p => !p.folded && !p.eliminated);
        this.checkPlayerTurn();
    }
    
    /**
     * 摊牌结算
     */
    showdown() {
        const activePlayers = this.players.filter(p => !p.folded && !p.eliminated);
        let winner = activePlayers[0];
        let bestHand = HandEvaluator.getBestHand(winner.hand, this.communityCards);
        
        activePlayers.forEach(p => {
            const hand = HandEvaluator.getBestHand(p.hand, this.communityCards);
            if (hand.rank > bestHand.rank || (hand.rank === bestHand.rank && hand.value > bestHand.value)) {
                winner = p;
                bestHand = hand;
            }
        });
        
        winner.chips += this.pot;
        
        // 结算后检查是否有玩家需要被淘汰
        this.checkEliminatedPlayers();
        
        if (this.renderer) {
            this.renderer.showWinner(winner.id, bestHand.name);
            this.renderer.updateUI();
            this.renderer.toggleControlPanels(false);
            
            // 显示所有牌
            this.players.forEach((p, i) => {
                if (i !== 0 && !p.eliminated) {
                    const handEl = document.getElementById(`ai${i}Hand`);
                    if (handEl) {
                        handEl.innerHTML = p.hand.map(c => c.createHTML(false)).join('');
                    }
                }
            });
        }
    }
    
    /**
     * 只剩一个玩家时，直接获胜
     */
    singlePlayerWin(winner) {
        winner.chips += this.pot;
        
        if (this.renderer) {
            this.renderer.showWinner(winner.id, '其他玩家弃牌/淘汰');
            this.renderer.updateUI();
            this.renderer.toggleControlPanels(false);
        }
    }
    
    // ===== 玩家动作接口 =====
    
    fold() { this.executeAction('fold'); }
    check() { this.executeAction('check'); }
    call() { this.executeAction('call'); }
    
    raise() {
        const slider = document.getElementById('betSlider');
        if (!slider) return;
        const amount = parseInt(slider.value);
        this.executeAction('raise', amount);
    }
    
    allIn() { this.executeAction('allin'); }
    
    /**
     * 智能选择：检查或跟注
     */
    checkOrCall() {
        const player = this.players[0];
        const toCall = this.currentBet - player.currentBet;
        if (toCall === 0) {
            this.check();
        } else {
            this.call();
        }
    }
}

// 导出（兼容ES模块和普通脚本）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PokerGame;
}
