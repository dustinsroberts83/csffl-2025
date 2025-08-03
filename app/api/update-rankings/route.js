// app/api/update-rankings/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const cached = cache.get(key);
    if (cached) {
      console.log(`Using expired cache for ${key} due to fetch error`);
      return cached.data;
    }
    throw error;
  }
}

// Fetch Sleeper data
async function fetchSleeperData() {
  return getCachedOrFetch('sleeper-all', async () => {
    try {
      const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!playersResponse.ok) throw new Error('Failed to fetch Sleeper players');
      const players = await playersResponse.json();
      
      const trendingResponse = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=200');
      const trending = await trendingResponse.json();
      
      return { players, trending };
    } catch (error) {
      console.error('Error fetching Sleeper data:', error);
      return { players: null, trending: null };
    }
  });
}

// Fetch ESPN rankings
async function fetchESPNRankings() {
  return getCachedOrFetch('espn-rankings', async () => {
    try {
      const response = await fetch('https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leaguedefaults/3?view=kona_player_info');
      
      if (!response.ok) throw new Error('Failed to fetch ESPN data');
      const data = await response.json();
      
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

// Convert name format from "Last, First" to "First Last"
function convertNameFormat(name) {
  if (!name) return '';
  
  // Check if name is in "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  
  return name;
}

// Calculate auction value based on rank
function calculateAuctionValueFromRank(rank, totalBudget = 500) {
  if (rank <= 12) return Math.round(totalBudget * 0.15);
  if (rank <= 24) return Math.round(totalBudget * 0.12);
  if (rank <= 36) return Math.round(totalBudget * 0.10);
  if (rank <= 48) return Math.round(totalBudget * 0.08);
  if (rank <= 60) return Math.round(totalBudget * 0.06);
  if (rank <= 84) return Math.round(totalBudget * 0.04);
  if (rank <= 120) return Math.round(totalBudget * 0.02);
  if (rank <= 180) return Math.round(totalBudget * 0.01);
  if (rank <= 250) return 3;
  if (rank <= 300) return 2;
  return 1;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { leagueId } = body;
    
    console.log('Starting rankings update...');
    
    // Fetch all players from database
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .order('name');
    
    if (fetchError) {
      throw new Error(`Database fetch error: ${fetchError.message}`);
    }
    
    console.log(`Fetching rankings for ${players.length} players...`);
    
    // Fetch external data sources
    const [sleeperData, espnData] = await Promise.all([
      fetchSleeperData(),
      fetchESPNRankings()
    ]);
    
    // Process each player
    const updates = [];
    const batchSize = 100;
    
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(players.length/batchSize)}...`);
      
      const batchUpdates = batch.map(player => {
        if (!player.mfl_id || !player.name) {
          return null;
        }
        
        // Convert name format from "Last, First" to "First Last"
        const convertedName = convertNameFormat(player.name);
        
        let sleeperRank = null;
        let espnRank = null;
        let age = player.age;
        let injuryStatus = null;
        
        // Match with Sleeper data
        if (sleeperData?.players) {
          const sleeperMatch = Object.values(sleeperData.players).find(sp => {
            if (!sp || !sp.first_name || !sp.last_name) return false;
            
            const sleeperFullName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
            const dbNameLower = convertedName.toLowerCase();
            const originalNameLower = player.name.toLowerCase();
            
            // Try exact match with converted name
            if (sleeperFullName === dbNameLower) return true;
            
            // Try exact match with original name
            if (sleeperFullName === originalNameLower) return true;
            
            // Try search_full_name
            if (sp.search_full_name) {
              const searchName = dbNameLower.replace(/[^a-z]/g, '');
              if (sp.search_full_name.toLowerCase() === searchName) return true;
            }
            
            return false;
          });
          
          if (sleeperMatch) {
            sleeperRank = sleeperMatch.search_rank || null;
            age = sleeperMatch.age || age;
            injuryStatus = sleeperMatch.injury_status || null;
          }
        }
        
        // Match with ESPN data
        if (espnData) {
          if (espnData[convertedName]) {
            espnRank = Math.round(espnData[convertedName].rank) || null;
          } else if (espnData[player.name]) {
            espnRank = Math.round(espnData[player.name].rank) || null;
          }
        }
        
        // Calculate consensus rank
        const ranks = [];
        if (sleeperRank && sleeperRank < 500) ranks.push(sleeperRank);
        if (espnRank && espnRank < 500) ranks.push(espnRank);
        if (player.ecr_rank && player.ecr_rank < 500) ranks.push(player.ecr_rank);
        
        let consensusRank = null;
        if (ranks.length > 0) {
          consensusRank = Math.round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length);
        }
        
        // Calculate auction value
        const auctionValue = consensusRank ? calculateAuctionValueFromRank(consensusRank) : 1;
        
        // Apply position adjustments
        const positionMultipliers = {
          QB: 1.1,
          RB: 1.0,
          WR: 1.0,
          TE: 0.9,
          PK: 0.3,
          DEF: 0.5,
          DT: 0.4,
          DE: 0.4,
          LB: 0.5,
          CB: 0.4,
          S: 0.4
        };
        
        const adjustedValue = Math.max(1, Math.round(auctionValue * (positionMultipliers[player.position] || 0.5)));
        
        return {
          mfl_id: player.mfl_id,
          sleeper_rank: sleeperRank,
          espn_rank: espnRank,
          consensus_rank: consensusRank,
          auction_value: adjustedValue,
          age: age,
          injury_status: injuryStatus,
          rankings_updated_at: new Date().toISOString()
        };
      }).filter(update => update !== null);
      
      updates.push(...batchUpdates);
    }
    
    console.log(`Updating ${updates.length} players in database...`);
    
    // Batch update in chunks
    let totalUpdated = 0;
    let errors = [];
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      console.log(`Updating batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(updates.length/batchSize)}...`);
      
      try {
        // Use update instead of upsert to only update existing records
        for (const update of batch) {
          const { data, error } = await supabase
            .from('players')
            .update({
              sleeper_rank: update.sleeper_rank,
              espn_rank: update.espn_rank,
              consensus_rank: update.consensus_rank,
              auction_value: update.auction_value,
              age: update.age,
              injury_status: update.injury_status,
              rankings_updated_at: update.rankings_updated_at
            })
            .eq('mfl_id', update.mfl_id)
            .select();
          
          if (error) {
            errors.push({
              mfl_id: update.mfl_id,
              error: error.message
            });
          } else if (data && data.length > 0) {
            totalUpdated++;
          }
        }
      } catch (batchError) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} error:`, batchError);
        errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: batchError.message
        });
      }
    }
    
    // Log summary
    const rankingSummary = {
      totalPlayers: players.length,
      sleeperRankings: updates.filter(u => u.sleeper_rank).length,
      espnRankings: updates.filter(u => u.espn_rank).length,
      consensusRankings: updates.filter(u => u.consensus_rank).length,
      auctionValues: updates.filter(u => u.auction_value > 1).length
    };
    
    console.log('Rankings update complete:', rankingSummary);
    
    return NextResponse.json({ 
      success: true,
      updated: totalUpdated,
      summary: rankingSummary,
      errors: errors.length > 0 ? errors : null
    });
    
  } catch (error) {
    console.error('Rankings update error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}