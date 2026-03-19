/**
 * 玩家类
 * 表示一个玩家（真人或AI），管理手牌、筹码和状态
 */

class Player {
    /**
     * 创建玩家
     * @param {number} id - 玩家ID
     * @param {string} name - 玩家名称
     * @param {number} chips - 初始筹码
     * @param {boolean} isAI - 是否为AI玩家
     */
    constructor(id, name, chips, isAI = true) {
        this.id = id;
        this.name = name;
        this.chips = chips;
        this.hand = [];
        this.folded = false;
        this.allIn = false;
        this.currentBet = 0;
        this.isAI = isAI;
        this.totalBet = 0;
        this.eliminated = false;  // 是否被淘汰
    }
    
    /**
     * 重置玩家状态（每局开始时）
     */
    reset() {
        this.hand = [];
        this.folded = false;
        this.allIn = false;
        this.currentBet = 0;
        this.totalBet = 0;
        // eliminated 不重置，一旦淘汰永久离场
    }
    
    /**
     * 下注
     * @param {number} amount - 下注金额
     * @returns {number} 实际下注金额
     */
    bet(amount) {
        amount = Math.min(amount, this.chips);
        this.chips -= amount;
        this.currentBet += amount;
        this.totalBet += amount;
        if (this.chips === 0) this.allIn = true;
        return amount;
    }
    
    /**
     * 检查玩家是否还能行动
     * @returns {boolean}
     */
    canAct() {
        return !this.folded && !this.allIn && !this.eliminated && this.chips > 0;
    }
    
    /**
     * 检查玩家是否能加入游戏（筹码足够大盲注）
     * @param {number} bigBlind - 大盲注金额
     * @returns {boolean}
     */
    canJoinGame(bigBlind) {
        return !this.eliminated && this.chips >= bigBlind;
    }
    
    /**
     * 获取需要跟注的金额
     * @param {number} currentBet - 当前桌上下注额
     * @returns {number}
     */
    getAmountToCall(currentBet) {
        return currentBet - this.currentBet;
    }
}

// 导出（兼容ES模块和普通脚本）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
