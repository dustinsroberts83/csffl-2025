// app/api/sync-database/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { leagueId, players, rosters, sleeperPlayers, playerDetails } = body;
    
    if (!players || !rosters || !playerDetails) {
      return NextResponse.json({ 
        success: false, 
        error: 'Players, rosters, and playerDetails data required for sync' 
      });
    }

    console.log('Starting sync with:', {
      playersCount: players.length,
      rostersCount: rosters.length,
      playerDetailsCount: Object.keys(playerDetails).length
    });

    // Create a map of rostered player IDs
    const rosteredPlayerIds = new Set();
    if (rosters && rosters.length > 0) {
      rosters.forEach(roster => {
        // Handle both player array and single player object
        const rosterPlayers = roster.player ? 
          (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
        
        rosterPlayers.forEach(p => {
          let playerId = null;
          
          // Extract player ID from various possible structures
          if (typeof p === 'string') {
            playerId = p;
          } else if (typeof p === 'object' && p !== null) {
            // The diagnostic shows players have an 'id' property
            playerId = p.id || p.player_id || p.playerId || null;
          }
          
          if (playerId) {
            rosteredPlayerIds.add(playerId.toString());
          }
        });
      });
    }

    console.log(`Found ${rosteredPlayerIds.size} rostered players`);
    console.log('Sample rostered IDs:', Array.from(rosteredPlayerIds).slice(0, 10));

    // Prepare player data for database - merge with playerDetails
    const playersToSync = players
      .filter(player => {
        // Filter out non-player positions
        const excludedPositions = ['Off', 'PN', 'ST', 'XX', 'Def', 'Coach', 'HC', 
                                  'TMDB', 'TMDL', 'TMLB', 'TMPK', 'TMPN', 'TMQB', 
                                  'TMRB', 'TMTE', 'TMWR'];
        
        // Skip players without required data
        if (!player.id) {
          console.log('Skipping player without ID:', player);
          return false;
        }
        
        // Get full player details
        const fullPlayer = playerDetails[player.id] || player;
        
        if (!fullPlayer.name || fullPlayer.name.trim() === '') {
          console.log('Skipping player without name, ID:', player.id);
          return false;
        }
        
        return fullPlayer.position && !excludedPositions.includes(fullPlayer.position);
      })
      .map(player => {
        // Always merge with playerDetails to get complete info
        const fullPlayer = playerDetails[player.id] ? {
          ...player,
          ...playerDetails[player.id]
        } : player;
        
        // Match with Sleeper data for enhanced info
        let sleeperMatch = null;
        if (sleeperPlayers && typeof sleeperPlayers === 'object') {
          // Try exact name match first
          sleeperMatch = Object.values(sleeperPlayers).find(sp => {
            if (!sp || !sp.first_name || !sp.last_name) return false;
            const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
            return sleeperName === fullPlayer.name.toLowerCase();
          });
          
          // If no exact match, try search_full_name
          if (!sleeperMatch) {
            const searchName = fullPlayer.name.toLowerCase().replace(/[^a-z]/g, '');
            sleeperMatch = Object.values(sleeperPlayers).find(sp => 
              sp.search_full_name?.toLowerCase() === searchName
            );
          }
        }

        // Calculate age from birthdate
        let age = null;
        if (fullPlayer.birthdate) {
          const today = new Date();
          const birth = new Date(fullPlayer.birthdate);
          age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
        }

        // Determine if player is a free agent
        const isFreeAgent = !rosteredPlayerIds.has(fullPlayer.id.toString());

        return {
          mfl_id: fullPlayer.id.toString(),
          name: fullPlayer.name.trim(),
          position: fullPlayer.position,
          team: fullPlayer.team || null,
          age: sleeperMatch?.age || age || null,
          is_free_agent: isFreeAgent,
          league_id: leagueId,
          // Rankings from Sleeper
          ecr_rank: sleeperMatch?.search_rank || null,
          dynasty_rank: sleeperMatch?.dynasty_rank || null,
          auction_value: 1, // Will be calculated separately
          // Additional metadata
          sleeper_id: sleeperMatch?.player_id || null,
          draft_year: fullPlayer.draft_year || null,
          draft_round: fullPlayer.draft_round || null,
          draft_pick: fullPlayer.draft_pick || null,
          updated_at: new Date().toISOString()
        };
      });

    // Log summary
    const freeAgentCount = playersToSync.filter(p => p.is_free_agent).length;
    const rosteredCount = playersToSync.filter(p => !p.is_free_agent).length;
    
    console.log(`Syncing ${playersToSync.length} players to database:`);
    console.log(`- Free agents: ${freeAgentCount}`);
    console.log(`- Rostered players: ${rosteredCount}`);
    console.log('Sample player:', playersToSync[0]);

    if (playersToSync.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid players to sync after filtering'
      });
    }

    // Batch upsert to database
    const batchSize = 500;
    let totalUpdated = 0;
    let errors = [];
    
    for (let i = 0; i < playersToSync.length; i += batchSize) {
      const batch = playersToSync.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('players')
          .upsert(batch, {
            onConflict: 'mfl_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          console.error(`Supabase batch error for batch ${Math.floor(i/batchSize) + 1}:`, error);
          errors.push({
            batch: Math.floor(i/batchSize) + 1,
            error: error.message,
            details: error.details
          });
          
          // Log the problematic data
          console.log('Problematic batch:', batch.slice(0, 5));
        } else {
          totalUpdated += data?.length || 0;
          console.log(`Batch ${Math.floor(i/batchSize) + 1} complete: ${data?.length} rows`);
        }
      } catch (batchError) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} error:`, batchError);
        errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: batchError.message
        });
      }
    }

    if (errors.length > 0 && totalUpdated === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'All batches failed',
        errors: errors
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      playersUpdated: playersToSync.length,
      freeAgents: freeAgentCount,
      rosteredPlayers: rosteredCount,
      actuallyInserted: totalUpdated,
      errors: errors.length > 0 ? errors : null,
      partialSuccess: errors.length > 0
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}