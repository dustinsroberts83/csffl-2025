// components/EnhancedFreeAgents.js
import { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, ArrowUpDown, Filter, Download, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateEnhancedAuctionValue, tierPlayersForAuction, calculatePositionalScarcity } from './enhancedAuctionCalculator';

// Position constants
const positionColors = {
  QB: 'bg-red-100 text-red-800 border-red-300',
  RB: 'bg-green-100 text-green-800 border-green-300',
  WR: 'bg-blue-100 text-blue-800 border-blue-300',
  TE: 'bg-orange-100 text-orange-800 border-orange-300',
  PK: 'bg-purple-100 text-purple-800 border-purple-300',
  DEF: 'bg-gray-100 text-gray-800 border-gray-300',
  DT: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  DE: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  LB: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CB: 'bg-teal-100 text-teal-800 border-teal-300',
  S: 'bg-pink-100 text-pink-800 border-pink-300'
};

const getPositionColor = (position) => {
  return positionColors[position] || 'bg-gray-100 text-gray-800 border-gray-300';
};

const positionOrder = ['QB', 'RB', 'WR', 'TE', 'PK', 'DEF', 'DT', 'DE', 'LB', 'CB', 'S'];

// Excluded positions
const excludedPositions = [
  'Off', 'PN', 'ST', 'XX', 'Def', 'Coach', 'HC',
  'TMDB', 'TMDL', 'TMLB', 'TMPK', 'TMPN', 'TMQB', 'TMRB', 'TMTE', 'TMWR'
];

export default function EnhancedFreeAgents({ freeAgents, year, playerScores, league, sleeperPlayers }) {
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRookiesOnly, setShowRookiesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [valueTierFilter, setValueTierFilter] = useState('ALL');
  const [ageFilter, setAgeFilter] = useState({ min: 0, max: 99 });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);

  // Add useEffect to handle processing state
  useEffect(() => {
    setIsProcessing(true);
    const timer = setTimeout(() => {
      setIsProcessing(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [freeAgents]);

  // Helper function to calculate age
  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Generate basic projection for a player
  const generateBasicProjection = (player, year) => {
    const baseProjections = {
      QB: 280,
      RB: 180,
      WR: 160,
      TE: 120,
      PK: 120,
      DEF: 100,
      DT: 80,
      DE: 85,
      LB: 100,
      CB: 75,
      S: 80
    };
    
    return baseProjections[player.position] || 50;
  };

  // Filter out excluded positions
  const relevantFreeAgents = freeAgents?.filter(
    player => !excludedPositions.includes(player.position)
  ) || [];

  // Enhanced player data with projections and auction values
  const enhancedPlayers = useMemo(() => {
    console.log('Starting enhancedPlayers calculation...');
    if (!relevantFreeAgents.length) return [];
    
    console.log(`Processing ${relevantFreeAgents.length} free agents`);
    
    // First add basic projections
    let players = relevantFreeAgents.map(player => ({
      ...player,
      projectedPoints: playerScores?.[player.id]?.score || 
                      playerScores?.[player.id]?.points || 
                      generateBasicProjection(player, year)
    }));
    
    // Enhance with Sleeper data if available
    if (sleeperPlayers && typeof sleeperPlayers === 'object') {
      console.log('Enhancing with Sleeper data...');
      // Convert Sleeper players to array once for better performance
      const sleeperArray = Object.values(sleeperPlayers).filter(sp => 
        sp && sp.first_name && sp.last_name
      );
      
      players = players.map(player => {
        const playerName = player.name.toLowerCase();
        const sleeperMatch = sleeperArray.find(sp => {
          const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
          return sleeperName === playerName || 
                 sp.search_full_name?.toLowerCase() === playerName.replace(/[^a-z]/g, '');
        });
        
        if (sleeperMatch) {
          return {
            ...player,
            searchRank: sleeperMatch.search_rank || 999,
            depthChart: sleeperMatch.depth_chart_order,
            injuryStatus: sleeperMatch.injury_status,
            age: sleeperMatch.age || calculateAge(player.birthdate)
          };
        }
        
        return {
          ...player,
          age: calculateAge(player.birthdate)
        };
      });
    }
    
    console.log('Calculating auction values...');
    // Calculate enhanced auction values - this might be slow
    const enhancedResults = players.map((player, index) => {
      if (index % 100 === 0) {
        console.log(`Processing player ${index}/${players.length}`);
      }
      
      try {
        const result = calculateEnhancedAuctionValue(player, players, {
          totalBudget: 500,
          numTeams: 12,
          rosterSize: 26,
          currentYear: parseInt(year),
          includeRankings: { sleeper: true }
        });
        
        return {
          ...player,
          auctionValue: result.auctionValue || 1,
          vbd: result.vbd || 0,
          valueBreakdown: result.breakdown || {},
          dynastyMultiplier: result.dynastyMultiplier || 1
        };
      } catch (error) {
        console.error('Error calculating value for player:', player.name, error);
        return {
          ...player,
          auctionValue: 1,
          vbd: 0,
          valueBreakdown: {},
          dynastyMultiplier: 1
        };
      }
    });
    
    console.log('Enhanced players calculation complete');
    return enhancedResults;
  }, [relevantFreeAgents, playerScores, year, sleeperPlayers]);

  // Tier players
  const tieredPlayers = useMemo(() => {
    return tierPlayersForAuction(enhancedPlayers, {
      totalBudget: 500,
      numTeams: 12,
      rosterSize: 26,
      currentYear: parseInt(year)
    });
  }, [enhancedPlayers, year]);

  // Calculate positional scarcity
  const scarcityByPosition = useMemo(() => {
    const scarcity = {};
    positionOrder.forEach(pos => {
      scarcity[pos] = calculatePositionalScarcity(pos, enhancedPlayers);
    });
    return scarcity;
  }, [enhancedPlayers]);

  // Apply filters
  let filteredPlayers = enhancedPlayers;
  
  if (showRookiesOnly) {
    filteredPlayers = filteredPlayers.filter(p => p.draft_year === year);
  }
  
  if (positionFilter !== 'ALL') {
    filteredPlayers = filteredPlayers.filter(p => p.position === positionFilter);
  }
  
  if (searchTerm) {
    filteredPlayers = filteredPlayers.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  if (valueTierFilter !== 'ALL') {
    const tierRanges = {
      elite: [40, 999],
      premium: [25, 39],
      starter: [10, 24],
      value: [5, 9],
      bargain: [2, 4],
      dollar: [1, 1]
    };
    const [min, max] = tierRanges[valueTierFilter] || [0, 999];
    filteredPlayers = filteredPlayers.filter(p => 
      p.auctionValue >= min && p.auctionValue <= max
    );
  }
  
  if (ageFilter.min > 0 || ageFilter.max < 99) {
    filteredPlayers = filteredPlayers.filter(p => {
      const age = p.age || 25;
      return age >= ageFilter.min && age <= ageFilter.max;
    });
  }

  // Apply sorting
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'value':
        compareValue = (a.auctionValue || 0) - (b.auctionValue || 0);
        break;
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'position':
        const posA = positionOrder.indexOf(a.position);
        const posB = positionOrder.indexOf(b.position);
        compareValue = posA - posB;
        break;
      case 'points':
        compareValue = (a.projectedPoints || 0) - (b.projectedPoints || 0);
        break;
      case 'age':
        compareValue = (a.age || 25) - (b.age || 25);
        break;
      case 'rank':
        compareValue = (a.searchRank || 999) - (b.searchRank || 999);
        break;
      case 'vbd':
        compareValue = (a.vbd || 0) - (b.vbd || 0);
        break;
      default:
        compareValue = 0;
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Position', 'Team', 'Age', 'Auction Value', 'Projected Points', 'Search Rank'];
    const rows = sortedPlayers.map(p => [
      p.name,
      p.position,
      p.team || 'FA',
      p.age || '',
      p.auctionValue,
      p.projectedPoints?.toFixed(1) || '',
      p.searchRank || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `free_agents_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Free Agents Analysis</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 text-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
          <div className="text-sm text-gray-600">
            {filteredPlayers.length} players • ${sortedPlayers.slice(0, 26).reduce((sum, p) => sum + p.auctionValue, 0)} top 26 value
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Name or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">All Positions</option>
              {positionOrder.map(pos => (
                <option key={pos} value={pos}>
                  {pos} ({enhancedPlayers.filter(p => p.position === pos).length})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value Tier</label>
            <select
              value={valueTierFilter}
              onChange={(e) => setValueTierFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">All Tiers</option>
              <option value="elite">Elite ($40+) - {tieredPlayers.elite.length}</option>
              <option value="premium">Premium ($25-39) - {tieredPlayers.premium.length}</option>
              <option value="starter">Starter ($10-24) - {tieredPlayers.starter.length}</option>
              <option value="value">Value ($5-9) - {tieredPlayers.value.length}</option>
              <option value="bargain">Bargain ($2-4) - {tieredPlayers.bargain.length}</option>
              <option value="dollar">Dollar ($1) - {tieredPlayers.dollar.length}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quick Filters</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRookiesOnly}
                  onChange={(e) => setShowRookiesOnly(e.target.checked)}
                  className="mr-1"
                />
                <span className="text-sm">Rookies</span>
              </label>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
              >
                <Filter size={14} />
                Advanced
                {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={ageFilter.min || ''}
                    onChange={(e) => setAgeFilter({...ageFilter, min: parseInt(e.target.value) || 0})}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={ageFilter.max === 99 ? '' : ageFilter.max}
                    onChange={(e) => setAgeFilter({...ageFilter, max: parseInt(e.target.value) || 99})}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Position Scarcity Indicators */}
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Positional Scarcity</h3>
        <div className="flex flex-wrap gap-2">
          {positionOrder.map(pos => {
            const scarcity = scarcityByPosition[pos];
            const color = scarcity > 1.2 ? 'text-red-600' : scarcity > 1.1 ? 'text-orange-600' : 'text-gray-600';
            return (
              <span key={pos} className={`text-xs ${color}`}>
                {pos}: {scarcity.toFixed(2)}x
              </span>
            );
          })}
        </div>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-lg overflow-hidden shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('name')} className="flex items-center hover:text-gray-900">
                  Player <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('position')} className="flex items-center hover:text-gray-900">
                  Pos <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Team</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('value')} className="flex items-center hover:text-gray-900">
                  Value <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('points')} className="flex items-center hover:text-gray-900">
                  Proj Pts <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('vbd')} className="flex items-center hover:text-gray-900">
                  VBD <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('age')} className="flex items-center hover:text-gray-900">
                  Age <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                <button onClick={() => toggleSort('rank')} className="flex items-center hover:text-gray-900">
                  Rank <ArrowUpDown size={14} className="ml-1" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                Info
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPlayers.length > 0 ? (
              sortedPlayers.map((player) => {
                const isRookie = player.draft_year === year;
                const isExpanded = expandedPlayer === player.id;
                
                return (
                  <React.Fragment key={player.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                          {isRookie && (
                            <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              Rookie
                            </span>
                          )}
                          {player.injuryStatus && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                              {player.injuryStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getPositionColor(player.position)}`}>
                          {player.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {player.team || 'FA'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-bold text-green-600">
                          ${player.auctionValue}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {player.projectedPoints?.toFixed(1) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {player.vbd?.toFixed(1) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {player.age || '-'}
                        {player.dynastyMultiplier && player.dynastyMultiplier !== 1 && (
                          <span className={`ml-1 text-xs ${player.dynastyMultiplier > 1 ? 'text-green-600' : 'text-red-600'}`}>
                            ({player.dynastyMultiplier > 1 ? '+' : ''}{((player.dynastyMultiplier - 1) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {player.searchRank ? (
                          <span className={`font-medium ${
                            player.searchRank <= 50 ? 'text-green-600' :
                            player.searchRank <= 100 ? 'text-blue-600' :
                            player.searchRank <= 200 ? 'text-gray-600' :
                            'text-gray-400'
                          }`}>
                            {player.searchRank}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Info size={16} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="9" className="px-4 py-3 bg-gray-50">
                          <div className="text-sm">
                            <h4 className="font-semibold mb-2">Value Breakdown</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div>
                                <span className="text-gray-600">Base Value:</span>
                                <span className="ml-1 font-medium">${player.valueBreakdown?.baseValue || 0}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Age Adjustment:</span>
                                <span className="ml-1 font-medium">{((player.valueBreakdown?.ageAdjustment || 1) * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Draft Capital:</span>
                                <span className="ml-1 font-medium">{((player.valueBreakdown?.draftCapital || 1) * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Team Situation:</span>
                                <span className="ml-1 font-medium">{((player.valueBreakdown?.teamSituation || 1) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            {player.draft_year && player.draft_round && (
                              <div className="mt-2">
                                <span className="text-gray-600">Draft:</span>
                                <span className="ml-1">{player.draft_year} - Round {player.draft_round}, Pick {player.draft_pick}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                  No players found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Value Tiers Summary */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Value Tiers Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-xs text-gray-600">Elite ($40+)</div>
            <div className="text-lg font-bold text-purple-600">{tieredPlayers.elite.length}</div>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-xs text-gray-600">Premium ($25-39)</div>
            <div className="text-lg font-bold text-blue-600">{tieredPlayers.premium.length}</div>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-xs text-gray-600">Starter ($10-24)</div>
            <div className="text-lg font-bold text-green-600">{tieredPlayers.starter.length}</div>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-xs text-gray-600">Value ($5-9)</div>
            <div className="text-lg font-bold text-yellow-600">{tieredPlayers.value.length}</div>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-xs text-gray-600">Bargain ($2-4)</div>
            <div className="text-lg font-bold text-orange-600">{tieredPlayers.bargain.length}</div>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-xs text-gray-600">Dollar ($1)</div>
            <div className="text-lg font-bold text-gray-600">{tieredPlayers.dollar.length}</div>
          </div>
        </div>
      </div>

      {/* Dynasty Strategy Tips */}
      <div className="mt-6 bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-2">Dynasty Auction Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• Target players aged 23-26 for best dynasty value</li>
            <li>• Rookies get 15% value boost - worth paying up</li>
            <li>• RBs decline rapidly after age 27 (-8% to -50%)</li>
            <li>• WRs have longer prime (25-29) with gradual decline</li>
            <li>• TEs take time to develop but last longer</li>
          </ul>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• Elite offenses (KC, BUF, SF) add 5% to player value</li>
            <li>• Top 3 round picks get 5-20% draft capital bonus</li>
            <li>• Build around 2-3 elite players under $60 each</li>
            <li>• Save 30% of budget for value plays ($5-15)</li>
            <li>• Don't forget contract implications in year 3!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}