// components/DatabaseFreeAgents.js
import { useState, useEffect } from 'react';
import { Download, RefreshCw, TrendingUp, ArrowUpDown, CheckCircle, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PlayerHoverCard from './PlayerHoverCard';
import PlayerImage from './PlayerImage';

const positionColors = {
  QB: 'bg-red-100 text-red-800',
  RB: 'bg-green-100 text-green-800',
  WR: 'bg-blue-100 text-blue-800',
  TE: 'bg-orange-100 text-orange-800',
  PK: 'bg-purple-100 text-purple-800',
  DEF: 'bg-gray-100 text-gray-800',
  DT: 'bg-indigo-100 text-indigo-800',
  DE: 'bg-indigo-100 text-indigo-800',
  LB: 'bg-yellow-100 text-yellow-800',
  CB: 'bg-teal-100 text-teal-800',
  S: 'bg-pink-100 text-pink-800'
};

export default function DatabaseFreeAgents({ leagueId, year }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('fantasypros_rank');
  const [sortOrder, setSortOrder] = useState('asc');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyFreeAgents, setShowOnlyFreeAgents] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [stats, setStats] = useState({ total: 0, freeAgents: 0, rostered: 0 });
  const [syncingFantasyPros, setSyncingFantasyPros] = useState(false);
  const [lastFantasyProsSync, setLastFantasyProsSync] = useState(null);
  const [mflRankings, setMflRankings] = useState({});

  // Load free agents from database
  useEffect(() => {
    loadFreeAgents();
    fetchMFLRankings();
  }, [leagueId, showOnlyFreeAgents]);

  const fetchMFLRankings = async () => {
    try {
      const { data, error } = await supabase
        .from('mfl_rankings')
        .select('*')
        .order('mfl_rank', { ascending: true });
      
      if (error) throw error;
      
      // Create a map for easy lookup by player name
      const rankingsMap = {};
      if (data) {
        data.forEach(ranking => {
          rankingsMap[ranking.player_name.toLowerCase()] = ranking.mfl_rank;
        });
      }
      setMflRankings(rankingsMap);
    } catch (error) {
      console.error('Error fetching MFL rankings:', error);
    }
  };

  const loadFreeAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get counts
      const { count: freeAgentCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('is_free_agent', true);

      const { count: rosteredCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('is_free_agent', false);

      setStats({
        total: (freeAgentCount || 0) + (rosteredCount || 0),
        freeAgents: freeAgentCount || 0,
        rostered: rosteredCount || 0
      });

      // Fetch ALL data using pagination to bypass 1000 row limit
      const pageSize = 1000;
      let allData = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('players')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('fantasypros_rank', { ascending: true, nullsFirst: false });
        
        if (showOnlyFreeAgents) {
          query = query.eq('is_free_agent', true);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`Loaded ${allData.length} players from database`);
      setPlayers(allData);
      
      // Get last sync time
      if (allData.length > 0) {
        const lastUpdate = allData.reduce((latest, player) => {
          const playerUpdate = new Date(player.updated_at);
          return playerUpdate > latest ? playerUpdate : latest;
        }, new Date(0));
        setLastSync(lastUpdate);
      }
    } catch (err) {
      console.error('Error loading free agents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync FantasyPros rankings
  const syncFantasyProsRankings = async () => {
    try {
      setSyncingFantasyPros(true);
      
      const response = await fetch('/api/fantasypros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setLastFantasyProsSync(new Date());
        await loadFreeAgents();
        
        alert(`FantasyPros sync successful!\nUpdated: ${result.updated} players\nMatched: ${result.matched} players`);
      } else {
        throw new Error(result.error || 'Failed to sync FantasyPros rankings');
      }
    } catch (error) {
      console.error('FantasyPros sync error:', error);
      alert(`Failed to sync FantasyPros rankings: ${error.message}`);
    } finally {
      setSyncingFantasyPros(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Position', 'Team', 'Age', 'FantasyPros ECR', 'FantasyPros Tier', 'MFL Rank'];
    const rows = sortedPlayers.map(p => [
      p.name,
      p.position,
      p.team || 'FA',
      p.age || '',
      p.fantasypros_rank || '',
      p.fantasypros_tier || '',
      mflRankings[p.name.toLowerCase()] || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fantasy_players_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter and sort players
  const filteredPlayers = players.filter(player => {
    if (positionFilter !== 'ALL' && player.position !== positionFilter) return false;
    if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'name':
        return sortOrder === 'asc' ? 
          a.name.localeCompare(b.name) : 
          b.name.localeCompare(a.name);
      case 'fantasypros_rank':
      case 'fantasypros_tier':
      case 'age':
        aVal = a[sortBy] || 999;
        bVal = b[sortBy] || 999;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      case 'mfl_rank':
        aVal = mflRankings[a.name.toLowerCase()] || 999;
        bVal = mflRankings[b.name.toLowerCase()] || 999;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      default:
        return 0;
    }
  });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Get unique positions
  const positions = [...new Set(players.map(p => p.position).filter(Boolean))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="text-gray-700">Loading player database...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Player Database</h2>
          <p className="text-sm text-gray-600 mt-1">
            {stats.freeAgents.toLocaleString()} free agents • {stats.rostered.toLocaleString()} rostered
            {lastSync && (
              <span className="ml-2">
                • Last updated: {new Date(lastSync).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncFantasyProsRankings}
            disabled={syncingFantasyPros}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 text-sm"
          >
            {syncingFantasyPros ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Syncing...
              </>
            ) : (
              <>
                <TrendingUp size={16} />
                Sync FantasyPros
              </>
            )}
          </button>
          <button
            onClick={exportToCSV}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          syncStatus.status === 'syncing' ? 'bg-blue-50 text-blue-700' :
          syncStatus.status === 'success' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          {syncStatus.status === 'syncing' && <RefreshCw className="animate-spin" size={16} />}
          {syncStatus.status === 'success' && <CheckCircle size={16} />}
          {syncStatus.status === 'error' && <AlertCircle size={16} />}
          {syncStatus.message}
        </div>
      )}

      {lastFantasyProsSync && (
        <div className="text-xs text-gray-500">
          FantasyPros last synced: {lastFantasyProsSync.toLocaleTimeString()}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Player name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="ALL">All Positions</option>
              {positions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Show</label>
            <select
              value={showOnlyFreeAgents ? 'free' : 'all'}
              onChange={(e) => setShowOnlyFreeAgents(e.target.value === 'free')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="free">Free Agents Only</option>
              <option value="all">All Players</option>
            </select>
          </div>
        </div>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-lg overflow-hidden shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={() => toggleSort('name')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  Player <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-gray-700">Pos</th>
              <th className="px-4 py-3 text-center text-gray-700">Team</th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('age')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  Age <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('fantasypros_rank')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  FP ECR <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('mfl_rank')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  MFL Rank <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('fantasypros_tier')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  FP Tier <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPlayers.map((player) => {
              const mflRank = mflRankings[player.name.toLowerCase()];
              
              return (
                <PlayerHoverCard 
                  key={player.mfl_id} 
                  player={player} 
                  mflRank={mflRank}
                >
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PlayerImage player={player} size={40} />
                        
                        <div>
                          <div className="font-medium text-gray-900">{player.name}</div>
                          {player.draft_year && (
                            <div className="text-xs text-gray-500">
                              {player.draft_year} Draft
                              {player.draft_round && ` - Rd ${player.draft_round}.${player.draft_pick}`}
                            </div>
                          )}
                          {player.injury_status && (
                            <div className="text-xs text-red-600 mt-1">
                              {player.injury_status}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded ${positionColors[player.position] || 'bg-gray-100'}`}>
                        {player.position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{player.team || 'FA'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{player.age || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${
                        player.fantasypros_rank <= 50 ? 'text-purple-600' :
                        player.fantasypros_rank <= 100 ? 'text-blue-600' :
                        player.fantasypros_rank <= 200 ? 'text-gray-600' :
                        'text-gray-400'
                      }`}>
                        {player.fantasypros_rank || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {mflRank ? (
                        <span className="font-medium text-blue-600">
                          {mflRank}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {player.fantasypros_tier ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                          Tier {player.fantasypros_tier}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                </PlayerHoverCard>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedPlayers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No players found matching your filters
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Database Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <ul className="space-y-1">
            <li>• Real-time roster status (free agent vs rostered)</li>
            <li>• FantasyPros Expert Consensus Rankings (ECR)</li>
            <li>• FantasyPros tier-based rankings</li>
            <li>• MFL Expert Rankings</li>
          </ul>
          <ul className="space-y-1">
            <li>• Injury status tracking</li>
            <li>• Draft capital information</li>
            <li>• Fast loading with database queries</li>
            <li>• Hover over players for detailed info</li>
          </ul>
        </div>
      </div>
    </div>
  );
}