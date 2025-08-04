// app/api/upload-mfl-rankings/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE endpoint to remove all rankings
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { leagueId = '37306', year = 2025 } = body;

    const { error } = await supabase
      .from('mfl_rankings')
      .delete()
      .eq('league_id', leagueId)
      .eq('year', year);

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true,
      message: 'All MFL rankings deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { rankings, leagueId = '37306', year = 2025 } = body;
    
    if (!rankings || !Array.isArray(rankings)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rankings array is required' 
      }, { status: 400 });
    }

    console.log(`Uploading ${rankings.length} MFL rankings...`);

    // Clear existing rankings for this league/year
    const { error: deleteError } = await supabase
      .from('mfl_rankings')
      .delete()
      .eq('league_id', leagueId)
      .eq('year', year);

    if (deleteError) {
      console.error('Error clearing old rankings:', deleteError);
    }

    // Prepare data for insertion
    const rankingsToInsert = rankings.map(ranking => ({
      player_name: ranking.name,
      mfl_rank: ranking.rank,
      position: ranking.position || null,
      status: ranking.status || null,
      league_id: leagueId,
      year: year,
      updated_at: new Date().toISOString()
    }));

    // Batch upsert rankings
    const batchSize = 100;
    let totalInserted = 0;
    let errors = [];
    
    for (let i = 0; i < rankingsToInsert.length; i += batchSize) {
      const batch = rankingsToInsert.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('mfl_rankings')
          .upsert(batch, {
            onConflict: 'player_name,league_id,year',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          console.error(`Error upserting batch ${Math.floor(i/batchSize) + 1}:`, error);
          errors.push({
            batch: Math.floor(i/batchSize) + 1,
            error: error.message
          });
        } else {
          totalInserted += data?.length || 0;
          console.log(`Batch ${Math.floor(i/batchSize) + 1} complete: ${data?.length || 0} rows`);
        }
      } catch (batchError) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} exception:`, batchError);
        errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: batchError.message
        });
      }
    }

    if (errors.length > 0 && totalInserted === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'All batches failed',
        errors: errors
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully uploaded ${totalInserted} MFL rankings`,
      stats: {
        total: rankingsToInsert.length,
        inserted: totalInserted,
        leagueId,
        year,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to retrieve current rankings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId') || '37306';
    const year = searchParams.get('year') || '2025';

    const { data, error } = await supabase
      .from('mfl_rankings')
      .select('*')
      .eq('league_id', leagueId)
      .eq('year', year)
      .order('mfl_rank', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true,
      rankings: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}