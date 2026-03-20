class BotAI {
  constructor() {
    this.difficulty = 'medium'; // easy, medium, hard
  }

  decideAction(game, playerIndex) {
    console.log(`[BotAI] decideAction called for player ${playerIndex}`);
    
    const player = game.players[playerIndex];
    if (!player) {
      console.error(`[BotAI] Player not found at index ${playerIndex}`);
      return { action: 'fold' };
    }
    
    console.log(`[BotAI] Player: ${player.username}, hand: ${JSON.stringify(player.hand)}, chips: ${player.chips}`);
    
    const handStrength = this.evaluateHandStrength(game, player);
    const potOdds = this.calculatePotOdds(game, player);
    const position = this.getPosition(game, playerIndex);
    const randomFactor = Math.random();
    
    console.log(`[BotAI] handStrength: ${handStrength}, potOdds: ${potOdds}, position: ${position}`);

    const callAmount = game.currentBet - player.currentBet;
    const canCheck = callAmount === 0;
    const canCall = callAmount <= player.chips;

    if (canCheck) {
      if (handStrength > 0.6 || randomFactor > 0.6) {
        const decision = this.decideBet(game, player, handStrength, position);
        console.log(`[BotAI] Decision (canCheck): ${JSON.stringify(decision)}`);
        return decision;
      }
      console.log(`[BotAI] Decision: check`);
      return { action: 'check' };
    }

    if (canCall) {
      if (handStrength > 0.7) {
        const decision = this.decideBet(game, player, handStrength, position);
        console.log(`[BotAI] Decision (strong hand): ${JSON.stringify(decision)}`);
        return decision;
      } else if (handStrength > 0.4 && potOdds > 0.25) {
        console.log(`[BotAI] Decision: call (good pot odds)`);
        return { action: 'call' };
      } else if (handStrength > 0.25 && randomFactor > 0.5) {
        console.log(`[BotAI] Decision: call (random)`);
        return { action: 'call' };
      } else if (handStrength < 0.15 && randomFactor > 0.85) {
        console.log(`[BotAI] Decision: call (bluff)`);
        return { action: 'call' };
      }
    }

    console.log(`[BotAI] Decision: fold`);
    return { action: 'fold' };
  }

  decideBet(game, player, handStrength, position) {
    const potSize = game.pot;
    const minRaise = game.currentBet + game.bigBlind;
    const maxRaise = player.chips + player.currentBet;

    let raiseAmount;
    const randomFactor = Math.random();

    if (handStrength > 0.9) {
      raiseAmount = Math.min(
        potSize * (0.5 + randomFactor * 0.5),
        maxRaise
      );
    } else if (handStrength > 0.7) {
      raiseAmount = Math.min(
        potSize * (0.3 + randomFactor * 0.3),
        maxRaise
      );
    } else if (handStrength > 0.5) {
      raiseAmount = Math.min(
        potSize * (0.2 + randomFactor * 0.2),
        maxRaise
      );
    } else {
      raiseAmount = minRaise;
    }

    raiseAmount = Math.max(minRaise, raiseAmount);
    raiseAmount = Math.floor(raiseAmount);

    if (raiseAmount > maxRaise) {
      return { action: 'allin' };
    }

    return { action: 'raise', amount: raiseAmount };
  }

  evaluateHandStrength(game, player) {
    console.log(`[BotAI] evaluateHandStrength called`);
    
    const round = game.currentRound;
    const communityCards = game.communityCards;
    const hand = player.hand;
    
    console.log(`[BotAI] round: ${round}, hand: ${JSON.stringify(hand)}, communityCards: ${JSON.stringify(communityCards)}`);

    let strength = 0;

    const handRank = this.getHandRank(hand, communityCards);
    console.log(`[BotAI] handRank: ${handRank}`);
    strength += handRank * 0.4;

    if (hand.length === 2) {
      const highCard = this.getHighCardValue(hand[0]);
      const lowCard = this.getHighCardValue(hand[1]);
      
      if (hand[0].rank === hand[1].rank) {
        strength += 0.3 + (highCard / 14) * 0.2;
      } else if (this.isSuited(hand)) {
        strength += 0.1 + (highCard / 14) * 0.1;
      } else if (this.isConnected(hand)) {
        strength += 0.1 + (highCard / 14) * 0.1;
      } else {
        strength += (highCard + lowCard) / 28 * 0.15;
      }
    }

    if (communityCards.length > 0) {
      const communityStrength = this.evaluateCommunityCards(communityCards, hand);
      strength += communityStrength * 0.3;
    }

    const positionBonus = this.getPositionBonus(game, player);
    strength += positionBonus * 0.1;

    const randomFactor = (Math.random() - 0.5) * 0.1;
    strength += randomFactor;

    return Math.max(0, Math.min(1, strength));
  }

  getHandRank(hand, communityCards) {
    console.log(`[BotAI] getHandRank called`);
    
    const allCards = [...hand, ...communityCards];
    console.log(`[BotAI] allCards: ${JSON.stringify(allCards)}`);
    
    if (allCards.length < 5) return 0.3;

    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const rankValues = {};
    ranks.forEach((r, i) => rankValues[r] = i + 2);

    const rankCounts = {};
    const suitCounts = {};
    
    allCards.forEach(card => {
      if (!card || !card.rank) {
        console.error(`[BotAI] Invalid card: ${JSON.stringify(card)}`);
        return;
      }
      const rankVal = rankValues[card.rank];
      rankCounts[rankVal] = (rankCounts[rankVal] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const isFlush = Object.values(suitCounts).some(c => c >= 5);
    const isStraight = this.checkStraight(rankCounts);

    console.log(`[BotAI] counts: ${JSON.stringify(counts)}, isFlush: ${isFlush}, isStraight: ${isStraight}`);

    if (counts[0] === 4) return 0.9;
    if (counts[0] === 3 && counts[1] >= 2) return 0.85;
    if (isFlush) return 0.8;
    if (isStraight) return 0.75;
    if (counts[0] === 3) return 0.6;
    if (counts[0] === 2 && counts[1] === 2) return 0.5;
    if (counts[0] === 2) return 0.35;
    
    const highCard = Math.max(...Object.keys(rankCounts).map(Number));
    return highCard / 14 * 0.3;
  }

  checkStraight(rankCounts) {
    const ranks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
    let consecutive = 1;
    
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i-1] + 1) {
        consecutive++;
        if (consecutive >= 5) return true;
      } else {
        consecutive = 1;
      }
    }
    
    if (ranks.includes(14) && ranks.includes(2) && ranks.includes(3) && ranks.includes(4) && ranks.includes(5)) {
      return true;
    }
    
    return false;
  }

  evaluateCommunityCards(communityCards, hand) {
    if (communityCards.length === 0) return 0;
    
    let strength = 0;
    const allCards = [...hand, ...communityCards];
    
    const handRank = this.getHandRank(hand, communityCards);
    strength += handRank;

    const drawPotential = this.evaluateDrawPotential(allCards);
    strength += drawPotential * 0.3;

    return Math.min(1, strength);
  }

  evaluateDrawPotential(cards) {
    const suitCounts = {};
    const rankCounts = {};
    
    cards.forEach(card => {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    });

    let potential = 0;
    
    Object.values(suitCounts).forEach(count => {
      if (count >= 4) potential += 0.3;
      if (count >= 3) potential += 0.15;
    });

    const ranks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
    let consecutive = 1;
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i-1] + 1) {
        consecutive++;
        if (consecutive >= 4) potential += 0.25;
      } else {
        consecutive = 1;
      }
    }

    return Math.min(1, potential);
  }

  calculatePotOdds(game, player) {
    const callAmount = game.currentBet - player.currentBet;
    const totalPot = game.pot + callAmount;
    
    if (callAmount === 0) return 1;
    return callAmount / totalPot;
  }

  getPosition(game, playerIndex) {
    const dealerPos = game.dealer;
    const playerPos = playerIndex;
    const totalPlayers = game.players.length;
    
    const distance = (playerPos - dealerPos + totalPlayers) % totalPlayers;
    
    if (distance === 0) return 'dealer';
    if (distance === 1) return 'small_blind';
    if (distance === 2) return 'big_blind';
    if (distance <= totalPlayers / 3) return 'early';
    if (distance <= 2 * totalPlayers / 3) return 'middle';
    return 'late';
  }

  getPositionBonus(game, playerIndex) {
    const position = this.getPosition(game, playerIndex);
    
    switch (position) {
      case 'dealer': return 0.1;
      case 'late': return 0.08;
      case 'middle': return 0.05;
      case 'early': return 0;
      case 'big_blind': return -0.02;
      case 'small_blind': return -0.03;
      default: return 0;
    }
  }

  getHighCardValue(card) {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return ranks.indexOf(card.rank) + 2;
  }

  isSuited(hand) {
    return hand[0].suit === hand[1].suit;
  }

  isConnected(hand) {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const rank1 = ranks.indexOf(hand[0].rank);
    const rank2 = ranks.indexOf(hand[1].rank);
    
    const diff = Math.abs(rank1 - rank2);
    return diff === 1 || diff === 12;
  }
}

module.exports = BotAI;