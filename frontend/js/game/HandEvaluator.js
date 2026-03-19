/**
 * 手牌评估器
 * 评估扑克牌型，比较牌力大小
 */

class HandEvaluator {
    /**
     * 评估5张牌的牌型
     * @param {Card[]} cards - 5张牌
     * @returns {Object} {rank, name, value} rank越大牌型越大
     */
    static evaluate(cards) {
        // 将牌按点数排序（从大到小）
        const sorted = [...cards].sort((a, b) => b.rank - a.rank);
        const ranks = sorted.map(c => c.rank);
        const suits = sorted.map(c => c.suit);
        
        // 检查同花
        const suitCounts = {};
        suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
        const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
        
        // 检查顺子
        let straight = false;
        let straightHigh = 0;
        const uniqueRanks = [...new Set(ranks)];
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            if (uniqueRanks[i] - uniqueRanks[i+4] === 4) {
                straight = true;
                straightHigh = uniqueRanks[i];
            }
        }
        // 特殊顺子：A-5
        if (uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && 
            uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
            straight = true;
            straightHigh = 5;
        }
        
        // 统计点数
        const rankCounts = {};
        ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
        const counts = Object.values(rankCounts).sort((a, b) => b - a);
        
        // 同花顺
        if (flushSuit && straight) {
            const flushCards = sorted.filter(c => c.suit === flushSuit);
            const flushRanks = flushCards.map(c => c.rank);
            for (let i = 0; i <= flushRanks.length - 5; i++) {
                if (flushRanks[i] - flushRanks[i+4] === 4) {
                    return { rank: 8, name: '同花顺', value: flushRanks[i] };
                }
            }
        }
        
        // 四条
        if (counts[0] === 4) {
            const quadRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 4));
            const kicker = ranks.find(r => r !== quadRank);
            return { rank: 7, name: '四条', value: quadRank * 15 + kicker };
        }
        
        // 葫芦
        if (counts[0] === 3 && counts[1] >= 2) {
            const tripRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
            const pairRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] >= 2 && r != tripRank));
            return { rank: 6, name: '葫芦', value: tripRank * 15 + pairRank };
        }
        
        // 同花
        if (flushSuit) {
            const flushCards = sorted.filter(c => c.suit === flushSuit).slice(0, 5);
            const value = flushCards.reduce((acc, c, i) => acc + c.rank * Math.pow(15, 4-i), 0);
            return { rank: 5, name: '同花', value };
        }
        
        // 顺子
        if (straight) {
            return { rank: 4, name: '顺子', value: straightHigh };
        }
        
        // 三条
        if (counts[0] === 3) {
            const tripRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
            const kickers = ranks.filter(r => r !== tripRank).slice(0, 2);
            return { rank: 3, name: '三条', value: tripRank * 225 + kickers[0] * 15 + kickers[1] };
        }
        
        // 两对
        if (counts[0] === 2 && counts[1] === 2) {
            const pairs = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(Number).sort((a,b) => b-a);
            const kicker = ranks.find(r => !pairs.includes(r));
            return { rank: 2, name: '两对', value: pairs[0] * 225 + pairs[1] * 15 + kicker };
        }
        
        // 一对
        if (counts[0] === 2) {
            const pairRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 2));
            const kickers = ranks.filter(r => r !== pairRank).slice(0, 3);
            return { rank: 1, name: '一对', value: pairRank * 3375 + kickers[0] * 225 + kickers[1] * 15 + kickers[2] };
        }
        
        // 高牌
        return { rank: 0, name: '高牌', value: ranks.slice(0, 5).reduce((acc, r, i) => acc + r * Math.pow(15, 4-i), 0) };
    }
    
    /**
     * 从7张牌（2张手牌+5张公共牌）中找出最佳5张组合
     * @param {Card[]} playerCards - 2张手牌
     * @param {Card[]} communityCards - 5张公共牌
     * @returns {Object} 最佳牌型评估结果
     */
    static getBestHand(playerCards, communityCards) {
        const allCards = [...playerCards, ...communityCards];
        let best = null;
        
        // 从7张牌中选5张的最佳组合
        for (let i = 0; i < allCards.length; i++) {
            for (let j = i+1; j < allCards.length; j++) {
                const fiveCards = allCards.filter((_, idx) => idx !== i && idx !== j);
                const eval_ = this.evaluate(fiveCards);
                if (!best || eval_.rank > best.rank || (eval_.rank === best.rank && eval_.value > best.value)) {
                    best = eval_;
                }
            }
        }
        return best;
    }
    
    /**
     * 评估翻牌前的手牌强度
     * @param {Card[]} hand - 2张手牌
     * @returns {Object} {name, desc}
     */
    static evaluatePreflop(hand) {
        const ranks = hand.map(c => c.rank).sort((a,b) => b-a);
        const suited = hand[0].suit === hand[1].suit;
        const pair = ranks[0] === ranks[1];
        const high = ranks[0] >= 10 || ranks[1] >= 10;
        const connected = Math.abs(ranks[0] - ranks[1]) === 1;
        
        if (pair && ranks[0] >= 10) return { name: '强牌', desc: '高对' };
        if (pair) return { name: '对子', desc: '中小对' };
        if ((ranks[0] === 14 && ranks[1] === 13) || (suited && high)) return { name: '强牌', desc: suited ? '同花大高张' : '大高张' };
        if (high) return { name: 'playable', desc: '高张' };
        if (suited && connected) return { name: '投机牌', desc: '同花连张' };
        return { name: '弱牌', desc: '建议弃牌' };
    }
}

// 导出（兼容ES模块和普通脚本）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandEvaluator;
}
