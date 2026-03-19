/**
 * 牌组类
 * 管理一副扑克牌，包括洗牌和发牌
 */

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }
    
    /**
     * 重置牌组，生成一副新牌并洗牌
     */
    reset() {
        this.cards = [];
        const suits = CARD_CONSTANTS.SUITS;
        const ranks = CARD_CONSTANTS.RANKS;
        
        for (let suit of suits) {
            for (let rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
        this.shuffle();
    }
    
    /**
     * 洗牌（Fisher-Yates算法）
     */
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    
    /**
     * 发一张牌
     * @returns {Card} 发出的牌
     */
    deal() {
        return this.cards.pop();
    }
    
    /**
     * 获取剩余牌数
     * @returns {number}
     */
    remaining() {
        return this.cards.length;
    }
}

// 导出（兼容ES模块和普通脚本）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Deck;
}
