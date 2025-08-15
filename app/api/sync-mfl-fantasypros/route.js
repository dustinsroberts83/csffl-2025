// app/api/sync-mfl-fantasypros/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MFL_BASE_URL = 'https://api.myfantasyleague.com';
const FANTASYPROS_API_KEY = process.env.FANTASYPROS_API_KEY;
const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';

// Position mapping from MFL to FantasyPros
const POSITION_MAPPING = {
  'DT': 'DL',
  'DE': 'DL',
  'CB': 'DB',
  'S': 'DB',
  'FS': 'DB',
  'SS': 'DB'
};

// Add delay utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry and rate limiting
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryDelay = Math.pow(2, i + 1) * 1000; // 2s, 4s, 8s
        console.log(`Rate limited, waiting ${retryDelay}ms before retry...`);
        await delay(retryDelay);
        continue;
      }
      
      if (!response.ok && response.status !== 429) {
        const errorText = await response.text();
        console.error(`API error ${response.status}:`, errorText);
        return null;
      }
      
      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
}

// Enhanced name matching
function normalizePlayerName(name) {
  if (!name) return '';
  
  // Convert "Last, First" to "First Last"
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
      name = `${parts[1]} ${parts[0]}`;
    }
  }
  
  // Normalize common variations
  return name
    .toLowerCase()
    .replace(/\s+jr\.?$/i, '')      // Remove Jr.
    .replace(/\s+sr\.?$/i, '')      // Remove Sr.
    .replace(/\s+i{1,3}$/i, '')     // Remove III, II, I
    .replace(/\s+iv$/i, '')         // Remove IV
    .replace(/[^a-z\s]/g, '')       // Remove special characters
    .replace(/\s+/g, ' ')           // Normalize spaces
    .trim();
}

// Create multiple name variations for matching
function createNameVariations(name) {
  const variations = new Set();
  
  // Original name
  variations.add(name.toLowerCase());
  
  // Normalized name
  const normalized = normalizePlayerName(name);
  variations.add(normalized);
  
  // Handle special cases
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
      // First Last format
      variations.add(`${parts[1]} ${parts[0]}`.toLowerCase());
      // Normalized First Last
      variations.add(normalizePlayerName(`${parts[1]} ${parts[0]}`));
    }
  }
  
  // Handle DJ/D.J. type variations
  const djVariation = name.replace(/D\.J\./gi, 'DJ').replace(/\bDJ\b/gi, 'D.J.');
  variations.add(djVariation.toLowerCase());
  variations.add(normalizePlayerName(djVariation));
  
  // First name + last initial for common duplicates
  const nameParts = normalized.split(' ');
  if (nameParts.length >= 2) {
    variations.add(`${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}`);
  }
  
  return Array.from(variations);
}

// Fetch data from MFL API
async function fetchMFLData(type, params = {}) {
  const year = params.YEAR || '2025';
  const apiUrl = `${MFL_BASE_URL}/${year}/export`;
  
  params.TYPE = type;
  params.JSON = '1';
  
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${apiUrl}?${queryString}`;
  
  console.log('Fetching from MFL:', fullUrl);
  
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'MFLCLIENTAGENT',
      'Accept': 'application/json',
    }
  });
  
  if (!response.ok) {
    throw new Error(`MFL API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data;
}

// Fetch FantasyPros rankings for a specific position with rate limiting
async function fetchFantasyProsRankings(position, season = '2025') {
  // Add base delay between calls (300ms)
  await delay(300);
  
  const apiUrl = `${FANTASYPROS_BASE_URL}/nfl/${season}/consensus-rankings`;
  
  const params = new URLSearchParams({
    scoring: 'PPR',
    position: position
  });

  const fullUrl = `${apiUrl}?${params}`;
  console.log(`Fetching FantasyPros ${position} rankings...`);

  try {
    const response = await fetchWithRetry(fullUrl, {
      method: 'GET',
      headers: {
        'x-api-key': FANTASYPROS_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response) {
      console.log(`Skipping ${position} due to API errors`);
      return [];
    }

    const data = await response.json();
    
    if (!data || !data.players) return [];

    const players = data.players.map(player => ({
      name: player.player_name,
      team: player.player_team_id,
      position: position,
      rank: player.rank_ecr,
      positionRank: player.pos_rank,
      tier: player.tier,
      bye_week: player.player_bye_week
    }));

    console.log(`Successfully fetched ${players.length} ${position} players`);
    return players;
    
  } catch (error) {
    console.error(`Error fetching ${position} rankings:`, error);
    return [];
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { leagueId, year = '2025' } = body;
    
    if (!leagueId) {
      return NextResponse.json({ 
        error: 'League ID is required' 
      }, { status: 400 });
    }

    console.log(`Starting MFL to FantasyPros sync for league ${leagueId}...`);

    // Step 1: Fetch all data from MFL
    console.log('Step 1: Fetching MFL data...');
    
    const [playersData, rostersData] = await Promise.all([
      fetchMFLData('players', { YEAR: year }),
      fetchMFLData('rosters', { L: leagueId, YEAR: year })
    ]);

    // Step 2: Identify rostered players
    console.log('Step 2: Identifying rostered players...');
    const rosteredPlayerIds = new Set();
    
    if (rostersData.rosters && rostersData.rosters.franchise) {
      const franchises = Array.isArray(rostersData.rosters.franchise) 
        ? rostersData.rosters.franchise 
        : [rostersData.rosters.franchise];
      
      franchises.forEach(roster => {
        const players = roster.player ? 
          (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
        
        players.forEach(p => {
          const playerId = typeof p === 'object' ? p.id : p;
          if (playerId) {
            rosteredPlayerIds.add(playerId.toString());
          }
        });
      });
    }

    console.log(`Found ${rosteredPlayerIds.size} rostered players`);

    // Step 3: Filter and prepare free agents
    console.log('Step 3: Processing free agents...');
    const excludedPositions = ['Off', 'PN', 'ST', 'XX', 'Def', 'Coach', 'HC', 
                              'TMDB', 'TMDL', 'TMLB', 'TMPK', 'TMPN', 'TMQB', 
                              'TMRB', 'TMTE', 'TMWR', 'PK', 'K', 'DEF', 'DST'];
    
    const allPlayers = playersData.players?.player || [];
    const freeAgents = allPlayers
      .filter(player => {
        if (!player.id || !player.name || !player.position) return false;
        if (excludedPositions.includes(player.position)) return false;
        if (!player.team || player.team === '' || player.team === 'FA') return false; // Only players on NFL teams
        return !rosteredPlayerIds.has(player.id.toString());
      })
      .map(player => {
        // Calculate age from birthdate
        let age = null;
        if (player.birthdate) {
          const today = new Date();
          const birth = new Date(player.birthdate);
          age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
        }

        return {
          mfl_id: player.id.toString(),
          name: player.name.trim(),
          position: player.position,
          team: player.team || null,
          age: age,
          is_free_agent: true,
          league_id: leagueId,
          draft_year: player.draft_year || null,
          draft_round: player.draft_round || null,
          draft_pick: player.draft_pick || null,
          updated_at: new Date().toISOString()
        };
      });

    console.log(`Found ${freeAgents.length} free agents`);

    // Step 4: Store/update players in database
    console.log('Step 4: Updating database with free agents...');
    
    // First, mark all players as rostered
    const { error: updateError } = await supabase
      .from('players')
      .update({ is_free_agent: false })
      .eq('league_id', leagueId);
    
    if (updateError) {
      console.error('Error marking players as rostered:', updateError);
    }

    // Then upsert free agents
    const batchSize = 500;
    for (let i = 0; i < freeAgents.length; i += batchSize) {
      const batch = freeAgents.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('players')
        .upsert(batch, {
          onConflict: 'mfl_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Error upserting batch ${Math.floor(i/batchSize) + 1}:`, error);
      } else {
        console.log(`Batch ${Math.floor(i/batchSize) + 1} complete`);
      }
    }

    // Step 5: Fetch FantasyPros rankings
    console.log('Step 5: Fetching FantasyPros rankings...');
    
    // Get unique positions from free agents
    const mflPositions = [...new Set(freeAgents.map(p => p.position))];
    const fantasyProsPositions = new Set();
    
    // Map MFL positions to FantasyPros positions
    mflPositions.forEach(pos => {
      const mappedPos = POSITION_MAPPING[pos] || pos;
      fantasyProsPositions.add(mappedPos);
    });

    // Ensure we're fetching all standard positions (excluding K and DST)
    ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'].forEach(pos => {
      fantasyProsPositions.add(pos);
    });

    console.log('Fetching rankings for positions:', Array.from(fantasyProsPositions));

    // Fetch rankings for all positions with rate limiting
    const allRankings = [];
    const positionsArray = Array.from(fantasyProsPositions);
    
    for (let i = 0; i < positionsArray.length; i++) {
      const position = positionsArray[i];
      console.log(`Progress: ${i + 1}/${positionsArray.length} positions`);
      
      const rankings = await fetchFantasyProsRankings(position, '2025');
      allRankings.push(...rankings);
      
      // Add extra delay every 3 requests to be safe
      if ((i + 1) % 3 === 0 && i < positionsArray.length - 1) {
        console.log('Adding extra delay after 3 requests...');
        await delay(1000);
      }
    }

    console.log(`Fetched ${allRankings.length} total rankings from FantasyPros`);

    // Step 6: Match and update rankings
    console.log('Step 6: Matching players and updating rankings...');
    
    // Create a map of FantasyPros rankings with multiple name variations
    const rankingsMap = new Map();
    allRankings.forEach(ranking => {
      const variations = createNameVariations(ranking.name);
      variations.forEach(variation => {
        rankingsMap.set(variation, ranking);
      });
    });

    // Match free agents with rankings
    let matched = 0;
    let unmatched = [];
    const updates = [];

    for (const player of freeAgents) {
      const variations = createNameVariations(player.name);
      let ranking = null;
      
      // Try each variation
      for (const variation of variations) {
        if (rankingsMap.has(variation)) {
          ranking = rankingsMap.get(variation);
          break;
        }
      }
      
      // If no exact match, try fuzzy matching for common patterns
      if (!ranking && player.position !== 'DEF') {
        const normalized = normalizePlayerName(player.name);
        const nameParts = normalized.split(' ');
        
        if (nameParts.length >= 2) {
          // Try first name + last initial
          const firstLastInitial = `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}`;
          ranking = rankingsMap.get(firstLastInitial);
        }
      }

      if (ranking) {
        updates.push({
          mfl_id: player.mfl_id,
          fantasypros_rank: ranking.rank,
          fantasypros_tier: ranking.tier,
          bye_week: ranking.bye_week
        });
        matched++;
      } else {
        unmatched.push({
          name: player.name,
          position: player.position,
          team: player.team
        });
      }
    }

    console.log(`Matched ${matched} out of ${freeAgents.length} free agents`);
    if (unmatched.length > 0 && unmatched.length <= 20) {
      console.log('Sample unmatched players:', unmatched.slice(0, 20));
    }

    // Update rankings in database
    let totalUpdated = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from('players')
        .update({
          fantasypros_rank: update.fantasypros_rank,
          fantasypros_tier: update.fantasypros_tier,
          bye_week: update.bye_week,
          rankings_updated_at: new Date().toISOString()
        })
        .eq('mfl_id', update.mfl_id);
      
      if (!error) {
        totalUpdated++;
      }
    }

    return NextResponse.json({ 
      success: true,
      summary: {
        totalPlayers: allPlayers.length,
        rosteredPlayers: rosteredPlayerIds.size,
        freeAgents: freeAgents.length,
        fantasyProsRankingsFetched: allRankings.length,
        playersMatched: matched,
        rankingsUpdated: totalUpdated,
        unmatchedCount: unmatched.length
      },
      message: `Successfully synced ${freeAgents.length} free agents and updated ${totalUpdated} rankings`
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync MFL and FantasyPros data',
      details: error.message 
    }, { status: 500 });
  }
}