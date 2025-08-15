// app/api/fantasypros/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const FANTASYPROS_API_KEY = process.env.FANTASYPROS_API_KEY;
const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';

// Cache for API responses
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 300; // 300ms between requests

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Ensure minimum time between requests
async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

// Enhanced name normalization
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

// Fetch with retry logic
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await rateLimit(); // Apply rate limiting
      
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryDelay = Math.pow(2, i + 1) * 1000; // 2s, 4s, 8s
        console.log(`Rate limited, waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const scoring = searchParams.get('scoring') || 'PPR';
    const position = searchParams.get('position') || 'ALL';
    const week = searchParams.get('week') || '0';
    const season = searchParams.get('season') || '2025';
    const sport = searchParams.get('sport') || 'NFL';
    
    if (!FANTASYPROS_API_KEY) {
      return NextResponse.json({ 
        error: 'FantasyPros API key not configured' 
      }, { status: 500 });
    }

    if (!endpoint) {
      return NextResponse.json({ 
        error: 'Endpoint parameter is required' 
      }, { status: 400 });
    }

    const cacheKey = `${endpoint}-${sport}-${season}-${scoring}-${position}-${week}`;
    
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`Returning cached data for ${cacheKey}`);
      return NextResponse.json(cached);
    }

    let apiUrl;
    
    // Build the proper URL based on the endpoint
    switch (endpoint) {
      case 'rankings':
        apiUrl = `${FANTASYPROS_BASE_URL}/${sport.toLowerCase()}/${season}/consensus-rankings`;
        break;
      case 'projections':
        apiUrl = `${FANTASYPROS_BASE_URL}/${sport.toLowerCase()}/${season}/projections`;
        break;
      case 'players':
        apiUrl = `${FANTASYPROS_BASE_URL}/${sport.toLowerCase()}/players`;
        break;
      case 'adp':
        apiUrl = `${FANTASYPROS_BASE_URL}/${sport.toLowerCase()}/${season}/adp`;
        break;
      default:
        return NextResponse.json({ 
          error: 'Invalid endpoint' 
        }, { status: 400 });
    }

    // Build query parameters
    const params = new URLSearchParams();
    
    if (position && position !== 'ALL') {
      params.append('position', position);
    }
    
    if (scoring) {
      params.append('scoring', scoring);
    }
    
    if (week && week !== '0') {
      params.append('week', week);
    }

    const fullUrl = `${apiUrl}?${params.toString()}`;
    console.log(`Fetching from FantasyPros: ${fullUrl}`);

    const response = await fetchWithRetry(fullUrl, {
      method: 'GET',
      headers: {
        'x-api-key': FANTASYPROS_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FantasyPros API error:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      return NextResponse.json({ 
        error: `FantasyPros API error: ${response.status}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();

    let processedData;
    
    switch (endpoint) {
      case 'rankings':
        processedData = processRankingsData(data);
        break;
      case 'projections':
        processedData = processProjectionsData(data);
        break;
      case 'players':
        processedData = processPlayersData(data);
        break;
      case 'adp':
        processedData = processADPData(data);
        break;
      default:
        processedData = data;
    }

    setCache(cacheKey, processedData);

    return NextResponse.json(processedData);

  } catch (error) {
    console.error('FantasyPros API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch from FantasyPros',
      details: error.message 
    }, { status: 500 });
  }
}

function processRankingsData(data) {
  if (!data || !data.players) return { players: [] };

  return {
    lastUpdated: data.last_updated || new Date().toISOString(),
    count: data.count || 0,
    totalExperts: data.total_experts || 0,
    players: data.players.map(player => ({
      id: player.player_id,
      name: player.player_name,
      team: player.player_team_id,
      position: player.player_position_id,
      rank: player.rank_ecr,
      tier: player.tier,
      positionRank: player.pos_rank,
      fantasypros_rank: player.rank_ecr,
      fantasypros_tier: player.tier,
      bye_week: player.player_bye_week,
      owned_avg: player.player_owned_avg,
      owned_espn: player.player_owned_espn,
      owned_yahoo: player.player_owned_yahoo,
      image_url: player.player_square_image_url,
      page_url: player.player_page_url
    }))
  };
}

function processProjectionsData(data) {
  if (!data || !data.players) return { players: [] };

  return {
    lastUpdated: new Date().toISOString(),
    season: data.season,
    week: data.week,
    scoring: data.scoring,
    players: data.players.map(player => ({
      id: player.fpid,
      name: player.name,
      team: player.team_id,
      position: player.position_id,
      projections: {
        points: player.stats?.points || 0,
        passingYards: player.stats?.pass_yds || 0,
        passingTDs: player.stats?.pass_tds || 0,
        passingInts: player.stats?.pass_ints || 0,
        rushingYards: player.stats?.rush_yds || 0,
        rushingTDs: player.stats?.rush_tds || 0,
        receptions: player.stats?.rec_rec || 0,
        receivingYards: player.stats?.rec_yds || 0,
        receivingTDs: player.stats?.rec_tds || 0,
        fumbles: player.stats?.fumbles || 0
      }
    }))
  };
}

function processPlayersData(data) {
  if (!data || !data.players) return { players: [] };

  return {
    count: data.count || 0,
    players: data.players.map(player => ({
      id: player.player_id,
      name: player.player_name,
      team: player.team_id,
      position: player.position_id,
      age: player.age,
      rank_ecr: player.rank_ecr,
      rank_adp: player.rank_adp,
      birthdate: player.birthdate,
      image_url: player.square_image_url
    }))
  };
}

function processADPData(data) {
  if (!data || !data.players) return { players: [] };

  return {
    lastUpdated: new Date().toISOString(),
    players: data.players.map(player => ({
      id: player.player_id,
      name: player.player_name,
      team: player.player_team_id,
      position: player.player_position_id,
      adp: {
        overall: player.rank_ave || player.adp,
        min: player.rank_min || player.adp_min,
        max: player.rank_max || player.adp_max,
        std: player.rank_std || player.adp_std
      }
    }))
  };
}

// POST endpoint to sync FantasyPros data to database
export async function POST(request) {
  try {
    const body = await request.json();
    const { leagueId } = body;
    
    if (!FANTASYPROS_API_KEY) {
      return NextResponse.json({ 
        error: 'FantasyPros API key not configured' 
      }, { status: 500 });
    }

    console.log('Fetching FantasyPros rankings...');

    const sport = 'NFL';
    const season = '2025';
    const apiUrl = `${FANTASYPROS_BASE_URL}/${sport.toLowerCase()}/${season}/consensus-rankings`;
    
    // Include all positions except K and DST
    const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];
    let allPlayers = [];
    
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      console.log(`Progress: ${i + 1}/${positions.length} - Fetching ${position} rankings...`);
      
      const params = new URLSearchParams({
        scoring: 'PPR',
        position: position
      });

      const fullUrl = `${apiUrl}?${params}`;

      try {
        const rankingsResponse = await fetchWithRetry(fullUrl, {
          method: 'GET',
          headers: {
            'x-api-key': FANTASYPROS_API_KEY,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (!rankingsResponse.ok) {
          const errorText = await rankingsResponse.text();
          console.error(`FantasyPros API error for ${position}:`, rankingsResponse.status, errorText);
          continue;
        }

        const rankingsData = await rankingsResponse.json();
        const processedRankings = processRankingsData(rankingsData);
        
        if (processedRankings.players && processedRankings.players.length > 0) {
          allPlayers = allPlayers.concat(processedRankings.players);
          console.log(`Added ${processedRankings.players.length} ${position} players`);
        }
        
        // Add extra delay every 3 requests
        if ((i + 1) % 3 === 0 && i < positions.length - 1) {
          console.log('Adding extra delay...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error fetching ${position}:`, error);
      }
    }

    console.log(`Processing ${allPlayers.length} total players from FantasyPros...`);

    // Fetch all players from database
    const { data: dbPlayers, error: fetchError } = await supabase
      .from('players')
      .select('mfl_id, name');

    if (fetchError) {
      throw new Error(`Database fetch error: ${fetchError.message}`);
    }

    // Create a map for name matching with variations
    const nameToMflId = new Map();
    dbPlayers.forEach(player => {
      const variations = [
        player.name.toLowerCase(),
        normalizePlayerName(player.name),
        player.name.replace(/,/g, '').toLowerCase()
      ];
      
      variations.forEach(variation => {
        nameToMflId.set(variation, player.mfl_id);
      });
    });

    // Match FantasyPros players with database
    const updates = [];
    let matched = 0;
    let unmatched = [];

    for (const player of allPlayers) {
      const variations = [
        player.name.toLowerCase(),
        normalizePlayerName(player.name),
        player.name.replace(/[^a-z\s]/gi, '').toLowerCase()
      ];
      
      let mflId = null;
      for (const variation of variations) {
        if (nameToMflId.has(variation)) {
          mflId = nameToMflId.get(variation);
          break;
        }
      }

      if (mflId) {
        updates.push({
          mfl_id: mflId,
          fantasypros_rank: player.fantasypros_rank,
          fantasypros_tier: player.fantasypros_tier,
          bye_week: player.bye_week
        });
        matched++;
      } else {
        unmatched.push(player.name);
      }
    }

    console.log(`Matched ${matched} players, ${unmatched.length} unmatched`);

    // Batch update
    const batchSize = 100;
    let totalUpdated = 0;
    let errors = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      console.log(`Updating batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(updates.length/batchSize)}...`);
      
      for (const update of batch) {
        const { error } = await supabase
          .from('players')
          .update({
            fantasypros_rank: update.fantasypros_rank,
            fantasypros_tier: update.fantasypros_tier,
            bye_week: update.bye_week,
            updated_at: new Date().toISOString()
          })
          .eq('mfl_id', update.mfl_id);
        
        if (error) {
          errors.push({
            mfl_id: update.mfl_id,
            error: error.message
          });
        } else {
          totalUpdated++;
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      updated: totalUpdated,
      matched: matched,
      unmatched: unmatched.length,
      message: `Updated ${totalUpdated} players with FantasyPros data`,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('FantasyPros sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync FantasyPros data',
      details: error.message 
    }, { status: 500 });
  }
}