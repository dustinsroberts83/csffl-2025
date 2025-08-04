// components/DatabaseFreeAgents.js
import { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, TrendingUp, ArrowUpDown, Database, CheckCircle, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
  const [sortBy, setSortBy] = useState('auction_value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyFreeAgents, setShowOnlyFreeAgents] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [stats, setStats] = useState({ total: 0, freeAgents: 0, rostered: 0 });
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });
  const [sleeperPlayers, setSleeperPlayers] = useState(null);

  // Load free agents from database
  useEffect(() => {
    loadFreeAgents();
    fetchSleeperPlayers();
  }, [leagueId, showOnlyFreeAgents]);

  const fetchSleeperPlayers = async () => {
    try {
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (response.ok) {
        const data = await response.json();
        setSleeperPlayers(data);
      }
    } catch (error) {
      console.error('Error fetching Sleeper players:', error);
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
          .order('auction_value', { ascending: false, nullsFirst: false });
        
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

  // Sync rankings from external sources
  const syncRankings = async () => {
    try {
      setSyncStatus({ status: 'syncing', message: 'Fetching rankings from Sleeper, ESPN, and other sources...' });
      
      const response = await fetch('/api/update-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSyncStatus({ 
          status: 'success', 
          message: `Rankings updated! ${result.summary.consensusRankings} consensus rankings calculated from ${Object.keys(result.summary).length - 1} sources.` 
        });
        await loadFreeAgents();
      } else {
        throw new Error(result.error || 'Failed to update rankings');
      }
      
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err) {
      console.error('Rankings sync error:', err);
      setSyncStatus({ status: 'error', message: err.message });
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Position', 'Team', 'Age', 'Status', 'Auction Value', 'Consensus Rank', 'Sleeper Rank', 'ESPN Rank', 'Dynasty Rank'];
    const rows = sortedPlayers.map(p => [
      p.name,
      p.position,
      p.team || 'FA',
      p.age || '',
      p.is_free_agent ? 'Free Agent' : 'Rostered',
      p.auction_value,
      p.consensus_rank || '',
      p.sleeper_rank || '',
      p.espn_rank || '',
      p.dynasty_rank || ''
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

  // Handle mouse events for hover card
  const handleMouseEnter = (player, event) => {
    setHoveredPlayer(player);
  };

  const handleMouseMove = (event) => {
    if (!hoveredPlayer) return;
    
    const cardWidth = 320;
    const cardHeight = 400; // Approximate height
    const offset = 10; // Distance from cursor - reduced from original
    
    // Get mouse position relative to viewport
    let left = event.clientX + offset;
    let top = event.clientY + offset;
    
    // Keep card within viewport horizontally
    if (left + cardWidth > window.innerWidth) {
      left = event.clientX - cardWidth - offset;
    }
    
    // Keep card within viewport vertically
    if (top + cardHeight > window.innerHeight) {
      top = window.innerHeight - cardHeight - offset;
    }
    
    setCardPosition({ top, left });
  };

  const handleMouseLeave = () => {
    setHoveredPlayer(null);
  };

  // Create a map of Sleeper players for efficient lookup
  const sleeperPlayerMap = useMemo(() => {
    if (!sleeperPlayers) return new Map();
    
    const map = new Map();
    Object.values(sleeperPlayers).forEach(sp => {
      if (sp && sp.first_name && sp.last_name) {
        const fullName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
        map.set(fullName, sp);
      }
    });
    return map;
  }, [sleeperPlayers]);

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
      case 'ecr_rank':
      case 'dynasty_rank':
      case 'auction_value':
      case 'age':
      case 'consensus_rank':
      case 'sleeper_rank':
      case 'espn_rank':
        aVal = a[sortBy] || 999;
        bVal = b[sortBy] || 999;
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
      setSortOrder(field === 'auction_value' ? 'desc' : 'asc');
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
            onClick={syncRankings}
            disabled={syncStatus?.status === 'syncing'}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 text-sm"
          >
            <TrendingUp size={16} />
            Update Rankings
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
              <th className="px-4 py-3 text-center text-gray-700">Status</th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('auction_value')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  Value <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('consensus_rank')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  Consensus <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('sleeper_rank')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  Sleeper <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('espn_rank')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  ESPN <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button onClick={() => toggleSort('dynasty_rank')} className="flex items-center hover:text-gray-900 font-medium text-gray-700">
                  Dynasty <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPlayers.map((player) => {
              // Find sleeper data for this player
              const convertedName = player.name.includes(',') 
                ? player.name.split(',').map(p => p.trim()).reverse().join(' ')
                : player.name;
              
              const sleeperData = sleeperPlayerMap.get(convertedName.toLowerCase());
              
              return (
                <tr 
                  key={player.mfl_id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(player, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Player Image */}
                      <div className="flex-shrink-0">
                        {sleeperData?.player_id ? (
                          <img
                            src={`https://sleepercdn.com/content/nfl/players/${sleeperData.player_id}.jpg`}
                            alt={player.name}
                            className="w-10 h-10 rounded-full object-cover bg-gray-100"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-10 h-10 rounded-full bg-gray-200 items-center justify-center ${
                            sleeperData?.player_id ? 'hidden' : 'flex'
                          }`}
                        >
                          <User className="text-gray-400" size={20} />
                        </div>
                      </div>
                      
                      {/* Player Name and Draft Info */}
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
                    <span className={`px-2 py-1 text-xs rounded ${
                      player.is_free_agent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {player.is_free_agent ? 'Free Agent' : 'Rostered'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg font-bold text-green-600">
                      ${player.auction_value || 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-medium ${
                      player.consensus_rank <= 50 ? 'text-green-600' :
                      player.consensus_rank <= 100 ? 'text-blue-600' :
                      player.consensus_rank <= 200 ? 'text-gray-600' :
                      'text-gray-400'
                    }`}>
                      {player.consensus_rank || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {player.sleeper_rank || '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {player.espn_rank || '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {player.dynasty_rank || '-'}
                  </td>
                </tr>
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
            <li>• Consensus rankings from multiple sources</li>
            <li>• Dynasty-specific valuations and age curves</li>
            <li>• Automatic auction value calculations</li>
          </ul>
          <ul className="space-y-1">
            <li>• Sleeper API integration for search rankings</li>
            <li>• ESPN rankings when available</li>
            <li>• Historical tracking of player values</li>
            <li>• Fast loading with database queries</li>
          </ul>
        </div>
      </div>

      {/* Player Card Hover */}
      {hoveredPlayer && sleeperPlayers && (
        <div 
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 pointer-events-none"
          style={{
            top: `${cardPosition.top}px`,
            left: `${cardPosition.left}px`
          }}
        >
          {(() => {
            // Find matching Sleeper player for additional data
            const convertedName = hoveredPlayer.name.includes(',') 
              ? hoveredPlayer.name.split(',').map(p => p.trim()).reverse().join(' ')
              : hoveredPlayer.name;
            
            const sleeperData = Object.values(sleeperPlayers).find(sp => {
              if (!sp || !sp.first_name || !sp.last_name) return false;
              const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
              return sleeperName === convertedName.toLowerCase();
            });

            // Calculate dynasty outlook
            const age = hoveredPlayer.age || sleeperData?.age || 25;
            const position = hoveredPlayer.position;
            const primes = {
              QB: { start: 26, peak: 29, end: 32 },
              RB: { start: 22, peak: 24, end: 27 },
              WR: { start: 24, peak: 26, end: 29 },
              TE: { start: 25, peak: 27, end: 30 }
            };
            
            const prime = primes[position];
            let dynastyOutlook = { status: 'Unknown', color: 'text-gray-600' };
            
            if (prime) {
              if (age < prime.start) dynastyOutlook = { status: 'Pre-Prime', color: 'text-green-600' };
              else if (age >= prime.start && age <= prime.end) dynastyOutlook = { status: 'Prime Years', color: 'text-blue-600' };
              else dynastyOutlook = { status: 'Post-Prime', color: 'text-red-600' };
            }

            return (
              <>
                <div className="flex items-start gap-3">
                  {/* Player Image */}
                  <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
                    <User className="text-gray-400" size={32} />
                  </div>

                  {/* Player Info */}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{hoveredPlayer.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded ${positionColors[hoveredPlayer.position] || 'bg-gray-100'}`}>
                        {hoveredPlayer.position}
                      </span>
                      <span className="text-sm text-gray-600">{hoveredPlayer.team || 'FA'}</span>
                      {hoveredPlayer.age && <span className="text-sm text-gray-600">• Age {hoveredPlayer.age}</span>}
                    </div>
                  </div>
                </div>

                {/* Rankings Section */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Consensus Rank</div>
                    <div className="text-lg font-bold text-gray-900">{hoveredPlayer.consensus_rank || '-'}</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Auction Value</div>
                    <div className="text-lg font-bold text-green-600">${hoveredPlayer.auction_value || 1}</div>
                  </div>
                </div>

                {/* Source Rankings */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sleeper Rank:</span>
                    <span className="font-medium">{hoveredPlayer.sleeper_rank || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ESPN Rank:</span>
                    <span className="font-medium">{hoveredPlayer.espn_rank || '-'}</span>
                  </div>
                </div>

                {/* Dynasty Outlook */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Dynasty Outlook:</span>
                    <span className={`text-sm font-medium ${dynastyOutlook.color}`}>
                      {dynastyOutlook.status}
                    </span>
                  </div>
                </div>

                {/* Injury Status */}
                {hoveredPlayer.injury_status && (
                  <div className="mt-3 p-2 bg-red-50 rounded flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={16} />
                    <span className="text-sm text-red-800">{hoveredPlayer.injury_status}</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}