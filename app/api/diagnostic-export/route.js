// app/api/diagnostic-export/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MFL_BASE_URL = 'https://api.myfantasyleague.com';
const FANTASYPROS_API_KEY = process.env.FANTASYPROS_API_KEY;
const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizePlayerName(name) {
  if (!name) return '';
  
  // Convert "Last, First" to "First Last"
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
      name = `${parts[1]} ${parts[0]}`;
    }
  }
  
  return name
    .toLowerCase()
    .replace(/\s+jr\.?$/i, '')
    .replace(/\s+sr\.?$/i, '')
    .replace(/\s+i{1,3}$/i, '')
    .replace(/\s+iv$/i, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchMFLData(type, params = {}) {
  const year = params.YEAR || '2025';
  const apiUrl = `${MFL_BASE_URL}/${year}/export`;
  
  params.TYPE = type;
  params.JSON = '1';
  
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${apiUrl}?${queryString}`;
  
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

async function fetchFantasyProsRankings(position, season = '2025') {
  await delay(300);
  
  const apiUrl = `${FANTASYPROS_BASE_URL}/nfl/${season}/consensus-rankings`;
  const params = new URLSearchParams({
    scoring: 'PPR',
    position: position
  });

  const fullUrl = `${apiUrl}?${params}`;

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'x-api-key': FANTASYPROS_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (!data || !data.players) return [];

    return data.players.map(player => ({
      name: player.player_name,
      team: player.player_team_id || 'FA',
      position: player.player_position_id || position,
      rank: player.rank_ecr,
      bye_week: player.player_bye_week
    }));
    
  } catch (error) {
    console.error(`Error fetching ${position} rankings:`, error);
    return [];
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const year = searchParams.get('year') || '2025';
    
    if (!leagueId) {
      return NextResponse.json({ 
        error: 'League ID is required' 
      }, { status: 400 });
    }

    console.log('Starting diagnostic export...');

    // Step 1: Get MFL data
    const [playersData, rostersData] = await Promise.all([
      fetchMFLData('players', { YEAR: year }),
      fetchMFLData('rosters', { L: leagueId, YEAR: year })
    ]);

    // Step 2: Identify rostered players
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

    // Step 3: Get all MFL free agents (on NFL teams only)
    const excludedPositions = ['Off', 'PN', 'ST', 'XX', 'Def', 'Coach', 'HC', 
                              'TMDB', 'TMDL', 'TMLB', 'TMPK', 'TMPN', 'TMQB', 
                              'TMRB', 'TMTE', 'TMWR', 'PK', 'K', 'DEF', 'DST'];
    
    const allPlayers = playersData.players?.player || [];
    const mflFreeAgents = allPlayers
      .filter(player => {
        if (!player.id || !player.name || !player.position) return false;
        if (excludedPositions.includes(player.position)) return false;
        if (!player.team || player.team === '' || player.team === 'FA') return false; // Only players on teams
        return !rosteredPlayerIds.has(player.id.toString());
      })
      .map(player => ({
        id: player.id,
        name: player.name,
        normalized: normalizePlayerName(player.name),
        position: player.position,
        team: player.team,
        age: player.birthdate ? new Date().getFullYear() - new Date(player.birthdate).getFullYear() : null
      }));

    console.log(`Found ${mflFreeAgents.length} MFL free agents on NFL teams`);

    // Step 4: Get FantasyPros rankings
    const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];
    const fantasyProsPlayers = [];
    
    for (const position of positions) {
      const rankings = await fetchFantasyProsRankings(position, year);
      fantasyProsPlayers.push(...rankings);
    }

    console.log(`Found ${fantasyProsPlayers.length} FantasyPros players`);

    // Step 5: Create comparison data
    const comparisonData = {
      summary: {
        mflFreeAgentsCount: mflFreeAgents.length,
        fantasyProsPlayersCount: fantasyProsPlayers.length,
        timestamp: new Date().toISOString()
      },
      mflFreeAgents: mflFreeAgents.sort((a, b) => a.name.localeCompare(b.name)),
      fantasyProsPlayers: fantasyProsPlayers
        .filter(p => p.team && p.team !== 'FA') // Only players on teams
        .sort((a, b) => a.name.localeCompare(b.name)),
      unmatchedSamples: []
    };

    // Step 6: Find unmatched samples
    const fpNormalizedMap = new Map();
    fantasyProsPlayers.forEach(fp => {
      fpNormalizedMap.set(normalizePlayerName(fp.name), fp);
    });

    const unmatchedSamples = [];
    for (const mflPlayer of mflFreeAgents.slice(0, 50)) { // First 50 for analysis
      const fpMatch = fpNormalizedMap.get(mflPlayer.normalized);
      
      if (!fpMatch) {
        // Try to find close matches
        const closeMatches = fantasyProsPlayers
          .filter(fp => {
            const fpNorm = normalizePlayerName(fp.name);
            return fpNorm.includes(mflPlayer.normalized.split(' ')[0]) || // First name match
                   fpNorm.includes(mflPlayer.normalized.split(' ').pop()); // Last name match
          })
          .slice(0, 3);
        
        unmatchedSamples.push({
          mfl: {
            name: mflPlayer.name,
            normalized: mflPlayer.normalized,
            position: mflPlayer.position,
            team: mflPlayer.team
          },
          closeMatches: closeMatches.map(fp => ({
            name: fp.name,
            normalized: normalizePlayerName(fp.name),
            position: fp.position,
            team: fp.team
          }))
        });
      }
    }

    comparisonData.unmatchedSamples = unmatchedSamples;

    // Create CSV data
    const csvLines = ['MFL_Name,MFL_Normalized,MFL_Position,MFL_Team,FP_Match,FP_Normalized,FP_Position,FP_Team'];
    
    for (const mflPlayer of mflFreeAgents) {
      const fpMatch = fpNormalizedMap.get(mflPlayer.normalized);
      
      csvLines.push([
        mflPlayer.name,
        mflPlayer.normalized,
        mflPlayer.position,
        mflPlayer.team,
        fpMatch ? fpMatch.name : 'NO_MATCH',
        fpMatch ? normalizePlayerName(fpMatch.name) : '',
        fpMatch ? fpMatch.position : '',
        fpMatch ? fpMatch.team : ''
      ].join(','));
    }

    // Return both JSON and CSV download options
    const format = searchParams.get('format') || 'json';
    
    if (format === 'csv') {
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="mfl-fp-diagnostic-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(comparisonData);

  } catch (error) {
    console.error('Diagnostic export error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate diagnostic export',
      details: error.message 
    }, { status: 500 });
  }
}