// components/enhancedDataFetcher.js

// Cache configuration
const CACHE_DURATION = 1000 * 60 * 60 * 4; // 4 hours
const cache = new Map();

// Helper to check if cache is valid
function isCacheValid(key) {
  const cached = cache.get(key);
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_DURATION;
}

// Get from cache or fetch
async function getCachedOrFetch(key, fetchFn) {
  if (isCacheValid(key)) {
    console.log(`Using cached data for ${key}`);
    return cache.get(key).data;
  }
  
  console.log(`Fetching fresh data for ${key}`);
  try {
    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Error fetching ${key}:`, error);
    // Return cached data if available, even if expired
    const cached = cache.get(key);
    if (cached) {
      console.log(`Using expired cache for ${key} due to fetch error`);
      return cached.data;
    }
    throw error;
  }
}

// Fetch Sleeper players and rankings
export async function fetchSleeperData() {
  return getCachedOrFetch('sleeper-all', async () => {
    try {
      // Fetch player data
      const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!playersResponse.ok) throw new Error('Failed to fetch Sleeper players');
      const players = await playersResponse.json();
      
      // Fetch trending players (contains ranking info)
      const trendingResponse = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=200');
      const trending = await trendingResponse.json();
      
      return { players, trending };
    } catch (error) {
      console.error('Error fetching Sleeper data:', error);
      return { players: null, trending: null };
    }
  });
}

// Fetch FantasyPros ECR via unofficial endpoints (for demonstration)
// Note: In production, you should use their official API with proper authentication
export async function fetchFantasyProsECR(scoring = 'PPR', position = 'ALL') {
  const cacheKey = `fantasypros-ecr-${scoring}-${position}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    // FantasyPros requires authentication for their API
    // This is a placeholder showing the structure you'd get
    console.log('FantasyPros API requires authentication - using mock data');
    
    // In production, you would:
    // 1. Sign up for FantasyPros API access
    // 2. Use your API key to fetch real ECR data
    // 3. Parse and return the actual rankings
    
    return {
      lastUpdated: new Date().toISOString(),
      rankings: []
    };
  });
}

// Fetch ESPN rankings (via unofficial method)
export async function fetchESPNRankings() {
  return getCachedOrFetch('espn-rankings', async () => {
    try {
      // ESPN's fantasy API endpoint (may require headers/cookies)
      const response = await fetch('https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leaguedefaults/3?view=kona_player_info');
      
      if (!response.ok) throw new Error('Failed to fetch ESPN data');
      const data = await response.json();
      
      // Parse ESPN's player pool
      const rankings = {};
      if (data.players) {
        data.players.forEach(player => {
          const name = player.player?.fullName;
          if (name) {
            rankings[name] = {
              rank: player.player?.ownership?.auctionValueAverage || 0,
              projectedPoints: player.player?.stats?.[0]?.appliedTotal || 0
            };
          }
        });
      }
      
      return rankings;
    } catch (error) {
      console.error('Error fetching ESPN data:', error);
      return {};
    }
  });
}

// Fetch Dynasty rankings from DynastyNerds (requires API key)
export async function fetchDynastyNerdsRankings(apiKey) {
  if (!apiKey) {
    console.log('DynastyNerds API key not provided');
    return null;
  }
  
  return getCachedOrFetch('dynastynerds-rankings', async () => {
    try {
      const response = await fetch('https://api.dynastynerds.com/api/v1/dynasty-rankings', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch DynastyNerds data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching DynastyNerds data:', error);
      return null;
    }
  });
}

// Fetch from KeepTradeCut for dynasty values
export async function fetchKeepTradeCutValues() {
  return getCachedOrFetch('ktc-values', async () => {
    try {
      // KTC doesn't have a public API, but you can scrape or use their export
      console.log('KeepTradeCut requires scraping or manual import');
      
      // In production, you could:
      // 1. Use a scraping service
      // 2. Manual CSV import from their site
      // 3. Use their Discord bot API (if available)
      
      return {
        lastUpdated: new Date().toISOString(),
        values: {}
      };
    } catch (error) {
      console.error('Error fetching KTC data:', error);
      return null;
    }
  });
}

// Get injury data
export async function getInjuryData() {
  // Could integrate with:
  // - https://www.pro-football-reference.com
  // - ESPN injury reports
  // - Rotoworld news
  
  return getCachedOrFetch('injury-data', async () => {
    console.log('Fetching injury data...');
    
    // Mock injury data
    return {
      lastUpdated: new Date().toISOString(),
      injuries: {
        // playerId: { status: 'Questionable', description: 'Hamstring', returnDate: '2025-09-01' }
      }
    };
  });
}

// Dynasty-specific metrics
export async function getDynastyMetrics(players) {
  const dynastyData = {
    // Age apex by position
    positionPrimes: {
      QB: { start: 26, peak: 29, end: 32 },
      RB: { start: 22, peak: 24, end: 27 },
      WR: { start: 24, peak: 26, end: 29 },
      TE: { start: 25, peak: 27, end: 30 }
    },
    
    // Breakout thresholds
    breakoutMetrics: {
      WR: { 
        year2: { targets: 100, yards: 800, tds: 6 },
        year3: { targets: 120, yards: 1000, tds: 8 }
      },
      RB: {
        year2: { touches: 200, yards: 1000, tds: 8 },
        year3: { touches: 250, yards: 1200, tds: 10 }
      }
    }
  };
  
  return players.map(player => {
    const position = player.position;
    const age = player.age || 25;
    const yearsExp = player.yearsExp || 3;
    
    // Calculate prime status
    const prime = dynastyData.positionPrimes[position];
    let primeStatus = 'unknown';
    
    if (prime) {
      if (age < prime.start) primeStatus = 'pre-prime';
      else if (age >= prime.start && age <= prime.end) primeStatus = 'prime';
      else primeStatus = 'post-prime';
    }
    
    // Calculate breakout probability for young players
    let breakoutProbability = 0;
    if (yearsExp <= 3 && (position === 'WR' || position === 'RB')) {
      // Simple calculation - would be more complex with real stats
      if (yearsExp === 1) breakoutProbability = 0.25;
      else if (yearsExp === 2) breakoutProbability = 0.35;
      else if (yearsExp === 3) breakoutProbability = 0.20;
    }
    
    return {
      ...player,
      dynastyMetrics: {
        primeStatus,
        breakoutProbability,
        careerArc: calculateCareerArc(position, age)
      }
    };
  });
}

// Calculate expected career arc
function calculateCareerArc(position, age) {
  const arcs = {
    QB: { peak: 29, duration: 15 },
    RB: { peak: 24, duration: 8 },
    WR: { peak: 26, duration: 11 },
    TE: { peak: 27, duration: 12 }
  };
  
  const arc = arcs[position];
  if (!arc) return { remaining: 5, peakYears: 0 };
  
  const careerStart = arc.peak - Math.floor(arc.duration * 0.3);
  const careerEnd = careerStart + arc.duration;
  const peakStart = arc.peak - 1;
  const peakEnd = arc.peak + 2;
  
  const remaining = Math.max(0, careerEnd - age);
  const peakYears = age >= peakStart && age <= peakEnd ? peakEnd - age + 1 : 0;
  
  return { remaining, peakYears };
}

// Aggregate all ranking sources
export async function aggregateRankings(players, options = {}) {
  const {
    includeSleeperRankings = true,
    includeFantasyPros = false, // Requires API key
    includeESPN = true,
    includeDynastyNerds = false, // Requires API key
    includeKTC = false,
    dynastyNerdsApiKey = null
  } = options;
  
  console.log('Aggregating rankings from multiple sources...');
  
  // Fetch all data sources in parallel
  const [sleeperData, espnData] = await Promise.all([
    includeSleeperRankings ? fetchSleeperData() : null,
    includeESPN ? fetchESPNRankings() : null
  ]);
  
  // Map rankings to players
  return players.map(player => {
    const rankings = {
      sources: {},
      consensus: null
    };
    
    // Sleeper rankings
    if (sleeperData?.players) {
      const sleeperMatch = Object.values(sleeperData.players).find(sp => {
        if (!sp || !sp.first_name || !sp.last_name) return false;
        const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
        return sleeperName === player.name.toLowerCase();
      });
      
      if (sleeperMatch) {
        rankings.sources.sleeper = {
          rank: sleeperMatch.search_rank || 999,
          age: sleeperMatch.age,
          injuryStatus: sleeperMatch.injury_status,
          depthChart: sleeperMatch.depth_chart_order
        };
      }
    }
    
    // ESPN rankings
    if (espnData && espnData[player.name]) {
      rankings.sources.espn = {
        rank: espnData[player.name].rank,
        projectedPoints: espnData[player.name].projectedPoints
      };
    }
    
    // Calculate consensus ranking
    const validRanks = [];
    Object.values(rankings.sources).forEach(source => {
      if (source.rank && source.rank < 500) {
        validRanks.push(source.rank);
      }
    });
    
    if (validRanks.length > 0) {
      rankings.consensus = Math.round(
        validRanks.reduce((sum, rank) => sum + rank, 0) / validRanks.length
      );
    }
    
    return {
      ...player,
      rankings
    };
  });
}

// Update player auction values based on aggregated data
export async function updatePlayerAuctionValues(players, leagueSettings = {}) {
  const {
    totalBudget = 500,
    numTeams = 12,
    rosterSize = 26,
    scoringSystem = 'PPR'
  } = leagueSettings;
  
  // Get aggregated rankings
  const rankedPlayers = await aggregateRankings(players, {
    includeSleeperRankings: true,
    includeESPN: true
  });
  
  // Calculate auction values based on consensus rankings
  const totalDollars = (totalBudget * numTeams) - (rosterSize * numTeams); // Minus $1 minimum bids
  const draftableSlots = rosterSize * numTeams;
  
  return rankedPlayers.map(player => {
    let auctionValue = 1; // Minimum bid
    
    if (player.rankings?.consensus) {
      const rank = player.rankings.consensus;
      
      // Top tier players (1-24) get premium values
      if (rank <= 24) {
        auctionValue = Math.round(totalBudget * 0.15 * (25 - rank) / 24);
      }
      // Second tier (25-60)
      else if (rank <= 60) {
        auctionValue = Math.round(totalBudget * 0.08 * (61 - rank) / 36);
      }
      // Third tier (61-120)
      else if (rank <= 120) {
        auctionValue = Math.round(totalBudget * 0.04 * (121 - rank) / 60);
      }
      // Fourth tier (121-200)
      else if (rank <= 200) {
        auctionValue = Math.round(totalBudget * 0.02 * (201 - rank) / 80);
      }
      // Everyone else gets close to minimum
      else if (rank <= draftableSlots) {
        auctionValue = Math.max(1, Math.round(5 * (draftableSlots - rank) / (draftableSlots - 200)));
      }
    }
    
    // Apply position adjustments
    const positionMultipliers = {
      QB: 1.1,  // Slight premium in superflex
      RB: 1.0,  // Baseline
      WR: 1.0,  // Baseline
      TE: 0.9,  // Slight discount unless elite
      PK: 0.3,  // Significant discount
      DEF: 0.5, // Moderate discount
      DT: 0.4, DE: 0.4, LB: 0.5, CB: 0.4, S: 0.4 // IDP discounts
    };
    
    const multiplier = positionMultipliers[player.position] || 0.5;
    auctionValue = Math.round(auctionValue * multiplier);
    
    // Ensure minimum value
    auctionValue = Math.max(1, auctionValue);
    
    // Cap at 40% of budget
    auctionValue = Math.min(auctionValue, Math.floor(totalBudget * 0.4));
    
    return {
      ...player,
      auctionValue,
      auctionValueBreakdown: {
        consensusRank: player.rankings?.consensus,
        baseValue: Math.round(auctionValue / multiplier),
        positionAdjustment: multiplier,
        sources: Object.keys(player.rankings?.sources || {}).length
      }
    };
  });
}

// Clear all caches
export function clearAllCaches() {
  cache.clear();
  console.log('All data caches cleared');
}

// Get cache status
export function getCacheStatus() {
  const status = {};
  cache.forEach((value, key) => {
    const age = Date.now() - value.timestamp;
    status[key] = {
      age: Math.round(age / 1000 / 60) + ' minutes',
      expired: age > CACHE_DURATION,
      size: JSON.stringify(value.data).length
    };
  });
  return status;
}