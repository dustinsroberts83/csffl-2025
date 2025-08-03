// utils/enhancedAuctionCalculator.js

// Position-specific aging curves for dynasty leagues
const AGING_CURVES = {
  QB: {
    peak: [26, 32],
    youngBonus: { 21: 1.1, 22: 1.08, 23: 1.06, 24: 1.04, 25: 1.02 },
    oldPenalty: { 33: 0.98, 34: 0.95, 35: 0.92, 36: 0.88, 37: 0.82, 38: 0.75 }
  },
  RB: {
    peak: [23, 26],
    youngBonus: { 21: 1.15, 22: 1.1 },
    oldPenalty: { 27: 0.92, 28: 0.85, 29: 0.75, 30: 0.65, 31: 0.5, 32: 0.35 }
  },
  WR: {
    peak: [25, 29],
    youngBonus: { 21: 1.2, 22: 1.15, 23: 1.1, 24: 1.05 },
    oldPenalty: { 30: 0.95, 31: 0.9, 32: 0.85, 33: 0.75, 34: 0.65 }
  },
  TE: {
    peak: [26, 30],
    youngBonus: { 21: 1.25, 22: 1.2, 23: 1.15, 24: 1.1, 25: 1.05 },
    oldPenalty: { 31: 0.95, 32: 0.9, 33: 0.8, 34: 0.7 }
  }
};

// Replacement levels for your specific league setup
const REPLACEMENT_LEVELS = {
  QB: 24,    // 2 QBs per team
  RB: 48,    // 4 RBs per team  
  WR: 60,    // 5 WRs per team
  TE: 24,    // 2 TEs per team
  PK: 12,    // 1 PK per team
  DEF: 12,   // 1 DEF per team
  DT: 24,    // IDP positions
  DE: 24,
  LB: 36,
  CB: 24,
  S: 24
};

// Positional weights based on your league's starting requirements
const POSITION_WEIGHTS = {
  QB: 0.18,  // 1 starter, high scoring
  RB: 0.25,  // 1 starter + flex options
  WR: 0.35,  // 2 starters + flex options  
  TE: 0.12,  // 1 starter
  PK: 0.02,
  DEF: 0.03,
  DT: 0.01,
  DE: 0.01,
  LB: 0.015,
  CB: 0.01,
  S: 0.01
};

// Calculate dynasty multiplier based on age
function getDynastyMultiplier(player, currentYear) {
  if (!player.birthdate) return 1.0;
  
  const age = currentYear - new Date(player.birthdate).getFullYear();
  const position = player.position;
  const curve = AGING_CURVES[position];
  
  if (!curve) return 1.0;
  
  // Check if in peak years
  if (age >= curve.peak[0] && age <= curve.peak[1]) {
    return 1.0;
  }
  
  // Apply young player bonus
  if (curve.youngBonus[age]) {
    return curve.youngBonus[age];
  }
  
  // Apply aging penalty
  if (curve.oldPenalty[age]) {
    return curve.oldPenalty[age];
  }
  
  // Default for very young or very old
  if (age < 21) return 1.3; // High upside for very young
  if (age > 34) return 0.6; // Steep decline for very old
  
  return 1.0;
}

// Calculate draft capital value
function getDraftCapitalMultiplier(player) {
  if (!player.draft_round || !player.draft_pick) return 1.0;
  
  const overallPick = (parseInt(player.draft_round) - 1) * 32 + parseInt(player.draft_pick);
  
  if (overallPick <= 10) return 1.2;      // Top 10 picks
  if (overallPick <= 32) return 1.1;      // First round
  if (overallPick <= 64) return 1.05;     // Second round
  if (overallPick <= 96) return 1.0;      // Third round
  if (overallPick <= 160) return 0.95;    // Rounds 4-5
  return 0.9;                              // Late rounds
}

// Calculate team situation multiplier
function getTeamMultiplier(player) {
  // Elite offenses
  const eliteOffenses = ['KC', 'BUF', 'MIA', 'PHI', 'SF', 'CIN', 'DAL'];
  // Good situations for specific positions
  const goodQBTeams = ['KC', 'BUF', 'CIN', 'LAC', 'JAX'];
  const goodRBTeams = ['SF', 'MIA', 'ATL', 'DET', 'BAL'];
  const goodWRTeams = ['KC', 'MIA', 'CIN', 'MIN', 'PHI'];
  
  let multiplier = 1.0;
  
  if (eliteOffenses.includes(player.team)) {
    multiplier *= 1.05;
  }
  
  if (player.position === 'QB' && goodQBTeams.includes(player.team)) {
    multiplier *= 1.05;
  } else if (player.position === 'RB' && goodRBTeams.includes(player.team)) {
    multiplier *= 1.05;
  } else if (player.position === 'WR' && goodWRTeams.includes(player.team)) {
    multiplier *= 1.05;
  }
  
  return Math.min(multiplier, 1.1); // Cap at 10% bonus
}

// Enhanced VBD calculation
export function calculateEnhancedVBD(player, allPlayers, settings = {}) {
  const position = player.position;
  const replacementLevel = REPLACEMENT_LEVELS[position];
  
  if (!replacementLevel) return 0;
  
  // Get position players sorted by projected points
  const positionPlayers = allPlayers
    .filter(p => p.position === position)
    .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
  
  // Find replacement player
  const replacementPlayer = positionPlayers[replacementLevel - 1];
  const replacementPoints = replacementPlayer?.projectedPoints || 0;
  
  // Base VBD
  const baseVBD = Math.max(0, (player.projectedPoints || 0) - replacementPoints);
  
  // Apply position weight
  const weightedVBD = baseVBD * (POSITION_WEIGHTS[position] || 0.01);
  
  return weightedVBD;
}

// Main enhanced auction value calculator
export function calculateEnhancedAuctionValue(player, allPlayers, settings = {}) {
  const {
    totalBudget = 500,
    numTeams = 12,
    rosterSize = 26,
    currentYear = 2025,
    includeRankings = {},
    contractStatus = null
  } = settings;
  
  // Base VBD calculation
  const vbd = calculateEnhancedVBD(player, allPlayers, settings);
  
  // Calculate total VBD for all draftable players
  const draftableSlots = rosterSize * numTeams;
  const allVBDs = allPlayers
    .map(p => ({
      player: p,
      vbd: calculateEnhancedVBD(p, allPlayers, settings)
    }))
    .sort((a, b) => b.vbd - a.vbd)
    .slice(0, draftableSlots);
  
  const totalVBD = allVBDs.reduce((sum, item) => sum + item.vbd, 0);
  
  // Total dollars minus minimum bids
  const totalDollars = (totalBudget * numTeams) - draftableSlots;
  
  // Base auction value
  let auctionValue = 1; // Minimum bid
  
  if (totalVBD > 0 && vbd > 0) {
    const dollarPerVBD = totalDollars / totalVBD;
    auctionValue = Math.round(vbd * dollarPerVBD);
  }
  
  // Apply dynasty adjustments
  const dynastyMultiplier = getDynastyMultiplier(player, currentYear);
  const draftCapitalMultiplier = getDraftCapitalMultiplier(player);
  const teamMultiplier = getTeamMultiplier(player);
  
  // Rookie bonus
  const rookieMultiplier = player.draft_year === currentYear.toString() ? 1.15 : 1.0;
  
  // Contract year penalty (players more likely to change teams)
  const contractMultiplier = contractStatus === 'expiring' ? 0.95 : 1.0;
  
  // Combine all multipliers
  const totalMultiplier = dynastyMultiplier * draftCapitalMultiplier * 
                         teamMultiplier * rookieMultiplier * contractMultiplier;
  
  // Apply multipliers to auction value
  auctionValue = Math.round(auctionValue * totalMultiplier);
  
  // Incorporate external rankings if available
  if (includeRankings.sleeper && player.searchRank) {
    const rankValue = calculateValueFromRank(player.searchRank, totalBudget);
    auctionValue = Math.round((auctionValue * 0.7) + (rankValue * 0.3));
  }
  
  // Ensure minimum and maximum values
  auctionValue = Math.max(1, auctionValue);
  auctionValue = Math.min(auctionValue, Math.floor(totalBudget * 0.4));
  
  return {
    auctionValue,
    vbd,
    dynastyMultiplier,
    breakdown: {
      baseValue: Math.round(vbd * (totalDollars / totalVBD)),
      ageAdjustment: dynastyMultiplier,
      draftCapital: draftCapitalMultiplier,
      teamSituation: teamMultiplier,
      rookieBonus: rookieMultiplier,
      contractStatus: contractMultiplier
    }
  };
}

// Helper function to convert ranking to value
function calculateValueFromRank(rank, totalBudget) {
  if (rank <= 12) return Math.floor(totalBudget * 0.12);
  if (rank <= 24) return Math.floor(totalBudget * 0.08);
  if (rank <= 50) return Math.floor(totalBudget * 0.05);
  if (rank <= 100) return Math.floor(totalBudget * 0.02);
  if (rank <= 200) return Math.floor(totalBudget * 0.01);
  return 1;
}

// Calculate positional scarcity
export function calculatePositionalScarcity(position, allPlayers) {
  const replacementLevel = REPLACEMENT_LEVELS[position];
  if (!replacementLevel) return 1.0;
  
  const positionPlayers = allPlayers
    .filter(p => p.position === position)
    .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
  
  if (positionPlayers.length < replacementLevel) return 1.5; // High scarcity
  
  // Calculate drop-off from top tier to replacement
  const topTier = positionPlayers.slice(0, Math.floor(replacementLevel / 3));
  const replacement = positionPlayers[replacementLevel - 1];
  
  if (!replacement) return 1.0;
  
  const avgTopPoints = topTier.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) / topTier.length;
  const dropOff = avgTopPoints - (replacement.projectedPoints || 0);
  
  // Higher drop-off = higher scarcity
  if (dropOff > 100) return 1.3;
  if (dropOff > 75) return 1.2;
  if (dropOff > 50) return 1.1;
  return 1.0;
}

// Tier players for auction strategy
export function tierPlayersForAuction(players, settings = {}) {
  const tiers = {
    elite: [],      // $40+ 
    premium: [],    // $25-39
    starter: [],    // $10-24
    value: [],      // $5-9
    bargain: [],    // $2-4
    dollar: []      // $1
  };
  
  players.forEach(player => {
    const result = calculateEnhancedAuctionValue(player, players, settings);
    const value = result.auctionValue;
    
    const tieredPlayer = {
      ...player,
      auctionValue: value,
      valueBreakdown: result.breakdown,
      vbd: result.vbd
    };
    
    if (value >= 40) tiers.elite.push(tieredPlayer);
    else if (value >= 25) tiers.premium.push(tieredPlayer);
    else if (value >= 10) tiers.starter.push(tieredPlayer);
    else if (value >= 5) tiers.value.push(tieredPlayer);
    else if (value >= 2) tiers.bargain.push(tieredPlayer);
    else tiers.dollar.push(tieredPlayer);
  });
  
  // Sort each tier by value
  Object.keys(tiers).forEach(tier => {
    tiers[tier].sort((a, b) => b.auctionValue - a.auctionValue);
  });
  
  return tiers;
}