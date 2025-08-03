// utils/multiSourceDataFetcher.js

// Cache configuration
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
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
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

// Fetch Sleeper players data
export async function fetchSleeperPlayers() {
  return getCachedOrFetch('sleeper-players', async () => {
    try {
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!response.ok) throw new Error('Failed to fetch Sleeper data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching Sleeper players:', error);
      return null;
    }
  });
}

// Fetch FantasyPros ECR (Expert Consensus Rankings) - Mock for now
// In production, you'd need to use their API with authentication
export async function fetchFantasyProsECR(scoring = 'ppr', position = 'all') {
  const cacheKey = `fantasypros-ecr-${scoring}-${position}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    // Mock data structure - replace with actual API call
    console.log('FantasyPros API would require authentication');
    
    // Return mock consensus rankings
    return {
      lastUpdated: new Date().toISOString(),
      rankings: [
        { name: 'Christian McCaffrey', position: 'RB', team: 'SF', rank: 1, avgRank: 1.2, stdDev: 0.4 },
        { name: 'Tyreek Hill', position: 'WR', team: 'MIA', rank: 2, avgRank: 2.5, stdDev: 1.1 },
        { name: 'CeeDee Lamb', position: 'WR', team: 'DAL', rank: 3, avgRank: 3.1, stdDev: 0.8 },
        // ... more players
      ]
    };
  });
}

// Fetch dynasty rankings from DynastyProcess (if available)
export async function fetchDynastyProcessRankings() {
  return getCachedOrFetch('dynastyprocess-rankings', async () => {
    try {
      // DynastyProcess provides some free data via GitHub
      const response = await fetch('https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv');
      if (!response.ok) throw new Error('Failed to fetch DynastyProcess data');
      
      const csvText = await response.text();
      // Parse CSV (you'd use a CSV parser library in production)
      console.log('DynastyProcess data fetched - would parse CSV here');
      
      return {
        lastUpdated: new Date().toISOString(),
        values: [] // Parsed dynasty values
      };
    } catch (error) {
      console.error('Error fetching DynastyProcess data:', error);
      return null;
    }
  });
}

// Combine rankings from multiple sources
export async function getConsensusRankings(players) {
  const [sleeperData, fantasyProsData, dynastyData] = await Promise.all([
    fetchSleeperPlayers(),
    fetchFantasyProsECR('ppr'),
    fetchDynastyProcessRankings()
  ]);
  
  // Map players with all available ranking data
  return players.map(player => {
    const rankings = {
      sleeper: null,
      fantasyPros: null,
      dynasty: null,
      consensus: null
    };
    
    // Match Sleeper data
    if (sleeperData) {
      const sleeperMatch = Object.values(sleeperData).find(sp => {
        if (!sp || !sp.first_name || !sp.last_name) return false;
        const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
        return sleeperName === player.name.toLowerCase();
      });
      
      if (sleeperMatch) {
        rankings.sleeper = {
          searchRank: sleeperMatch.search_rank,
          age: sleeperMatch.age,
          yearsExp: sleeperMatch.years_exp,
          injuryStatus: sleeperMatch.injury_status
        };
      }
    }
    
    // Match FantasyPros data (mock)
    if (fantasyProsData && fantasyProsData.rankings) {
      const fpMatch = fantasyProsData.rankings.find(fp => 
        fp.name.toLowerCase() === player.name.toLowerCase()
      );
      
      if (fpMatch) {
        rankings.fantasyPros = {
          rank: fpMatch.rank,
          avgRank: fpMatch.avgRank,
          stdDev: fpMatch.stdDev
        };
      }
    }
    
    // Calculate consensus rank
    const ranks = [];
    if (rankings.sleeper?.searchRank) ranks.push(rankings.sleeper.searchRank);
    if (rankings.fantasyPros?.rank) ranks.push(rankings.fantasyPros.rank);
    
    if (ranks.length > 0) {
      rankings.consensus = Math.round(ranks.reduce((a, b) => a + b) / ranks.length);
    }
    
    return {
      ...player,
      rankings
    };
  });
}

// Fetch ADP data from multiple sources
export async function getConsensusADP(year = 2025) {
  const cacheKey = `consensus-adp-${year}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    // In production, you'd aggregate ADP from:
    // - Underdog Fantasy
    // - FFPC
    // - BestBall10s
    // - Draft.com
    
    console.log('Fetching consensus ADP data...');
    
    // Mock ADP data
    return {
      lastUpdated: new Date().toISOString(),
      adp: {
        'Christian McCaffrey': { overall: 1.2, position: 'RB1' },
        'Tyreek Hill': { overall: 2.8, position: 'WR1' },
        'CeeDee Lamb': { overall: 3.5, position: 'WR2' },
        // ... more players
      }
    };
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

// Master function to enhance player data with all sources
export async function enhancePlayerData(players, options = {}) {
  const {
    includeSleeper = true,
    includeFantasyPros = true,
    includeDynasty = true,
    includeInjuries = true,
    year = 2025
  } = options;
  
  let enhancedPlayers = [...players];
  
  // Get consensus rankings
  if (includeSleeper || includeFantasyPros) {
    enhancedPlayers = await getConsensusRankings(enhancedPlayers);
  }
  
  // Add dynasty metrics
  if (includeDynasty) {
    enhancedPlayers = await getDynastyMetrics(enhancedPlayers);
  }
  
  // Add injury data
  if (includeInjuries) {
    const injuryData = await getInjuryData();
    enhancedPlayers = enhancedPlayers.map(player => ({
      ...player,
      injury: injuryData.injuries[player.id] || null
    }));
  }
  
  // Add consensus ADP
  const adpData = await getConsensusADP(year);
  enhancedPlayers = enhancedPlayers.map(player => ({
    ...player,
    consensusADP: adpData.adp[player.name] || null
  }));
  
  return enhancedPlayers;
}

// Export all cache management
export function clearCache() {
  cache.clear();
  console.log('Data cache cleared');
}

export function getCacheStatus() {
  const status = {};
  cache.forEach((value, key) => {
    const age = Date.now() - value.timestamp;
    status[key] = {
      age: Math.round(age / 1000 / 60) + ' minutes',
      expired: age > CACHE_DURATION
    };
  });
  return status;
}