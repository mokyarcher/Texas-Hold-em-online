/**
 * 扑克牌类
 * 表示一张扑克牌，包含花色和点数
 */

class Card {
    /**
     * 创建一张扑克牌
     * @param {string} suit - 花色 ('hearts', 'diamonds', 'clubs', 'spades')
     * @param {number} rank - 点数 (2-14, 14为A)
     */
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.suitSymbols = CARD_CONSTANTS.SUIT_SYMBOLS;
        this.rankNames = CARD_CONSTANTS.RANK_NAMES;
    }
    
    /**
     * 获取牌的字符串表示
     * @returns {string} 如 "A♠"
     */
    toString() {
        return `${this.rankNames[this.rank]}${this.suitSymbols[this.suit]}`;
    }
    
    /**
     * 获取牌的颜色
     * @returns {string} 'red' 或 'black'
     */
    getColor() {
        return (this.suit === 'hearts' || this.suit === 'diamonds') ? 'red' : 'black';
    }
    
    /**
     * 创建牌的HTML表示
     * @param {boolean} hidden - 是否显示牌背
     * @returns {string} HTML字符串
     */
    createHTML(hidden = false) {
        if (hidden) {
            return `<div class="playing-card hidden"></div>`;
        }
        const suitClass = this.suit;
        const colorClass = this.getColor() === 'red' ? 'hearts' : 'spades';
        return `
            <div class="playing-card">
                <div class="card-corner top-left ${colorClass}">${this.rankNames[this.rank]}<br>${this.suitSymbols[this.suit]}</div>
                <div class="card-suit ${suitClass}">${this.suitSymbols[this.suit]}</div>
                <div class="card-corner bottom-right ${colorClass}">${this.rankNames[this.rank]}<br>${this.suitSymbols[this.suit]}</div>
            </div>
        `;
    }
}

// 导出（兼容ES模块和普通脚本）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Card;
}
