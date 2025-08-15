// components/AuctionDraft.js
import { useState, useEffect } from 'react';
import { DollarSign, Search, User, AlertCircle, RotateCcw, Save, X, TrendingUp, RefreshCw, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOwnerName } from './teamOwners';
import PlayerHoverCard from './PlayerHoverCard';
import PlayerImage from './PlayerImage';

// Position colors
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

const SALARY_CAP = 500;
const MIN_BID = 1;
const ROSTER_SIZE = 26;

export default function AuctionDraft({ rosters, freeAgents, playerDetails }) {
  // State for database free agents
  const [databaseFreeAgents, setDatabaseFreeAgents] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  
  // Initialize draft state from localStorage or create new
  const [draftState, setDraftState] = useState(() => {
    const saved = localStorage.getItem('auctionDraftState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load draft state:', e);
      }
    }
    
    // Initialize teams from rosters
    const teams = {};
    rosters?.forEach(roster => {
      const teamName = roster.name || `Team ${roster.id}`;
      const players = roster.player ? 
        (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
      
      teams[teamName] = {
        id: roster.id,
        name: teamName,
        players: players.map(p => ({
          id: typeof p === 'object' ? p.id : p,
          salary: parseFloat(p.salary || 0),
          status: p.status || 'ROSTER'
        })),
        remainingBudget: SALARY_CAP,
        openSlots: ROSTER_SIZE
      };
      
      // Calculate remaining budget and open slots
      let totalSalary = 0;
      let rosterCount = 0;
      teams[teamName].players.forEach(player => {
        if (player.status !== 'TAXI_SQUAD') {
          totalSalary += player.salary;
          rosterCount++;
        }
      });
      
      teams[teamName].remainingBudget = SALARY_CAP - totalSalary;
      teams[teamName].openSlots = ROSTER_SIZE - rosterCount;
    });
    
    return {
      teams,
      draftPicks: [],
      availablePlayers: []
    };
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [showUndoConfirm, setShowUndoConfirm] = useState(null);
  const [rankingSource, setRankingSource] = useState('fantasypros');
  const [mflRankings, setMflRankings] = useState({});
  const [sortBy, setSortBy] = useState('fantasypros_rank');
  const [sortOrder, setSortOrder] = useState('asc');

  // Save to localStorage whenever draft state changes
  useEffect(() => {
    localStorage.setItem('auctionDraftState', JSON.stringify(draftState));
  }, [draftState]);

  // Fetch free agents from database
  useEffect(() => {
    fetchDatabaseFreeAgents();
    fetchMFLRankings();
  }, [freeAgents]);

  const fetchDatabaseFreeAgents = async () => {
    try {
      setLoadingPlayers(true);
      
      // Fetch ALL free agents using pagination to bypass 1000 row limit
      const pageSize = 1000;
      let allData = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('is_free_agent', true)
          .order('fantasypros_rank', { ascending: true, nullsFirst: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`Fetched ${allData.length} free agents from database`);
      setDatabaseFreeAgents(allData);
    } catch (error) {
      console.error('Error fetching free agents:', error);
      // Fallback to prop if database fails
      setDatabaseFreeAgents(freeAgents || []);
    } finally {
      setLoadingPlayers(false);
    }
  };

  // Fetch MFL Rankings from database
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
          // Store by lowercase name for case-insensitive matching
          rankingsMap[ranking.player_name.toLowerCase()] = ranking.mfl_rank;
        });
      }
      setMflRankings(rankingsMap);
    } catch (error) {
      console.error('Error fetching MFL rankings:', error);
    }
  };

  // Get all drafted player IDs
  const draftedPlayerIds = new Set(draftState.draftPicks.map(pick => pick.playerId));

  // Filter available players
  const availablePlayers = databaseFreeAgents
    .filter(player => !draftedPlayerIds.has(player.mfl_id))
    .filter(player => {
      if (positionFilter !== 'ALL' && player.position !== positionFilter) return false;
      if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });

  // Sort players based on selected criteria
  const sortedPlayers = [...availablePlayers].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'name':
        return sortOrder === 'asc' ? 
          a.name.localeCompare(b.name) : 
          b.name.localeCompare(a.name);
      case 'fantasypros_rank':
        aVal = a.fantasypros_rank || 9999;
        bVal = b.fantasypros_rank || 9999;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      case 'mfl_rank':
        aVal = mflRankings[a.name.toLowerCase()] || 9999;
        bVal = mflRankings[b.name.toLowerCase()] || 9999;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      case 'age':
        aVal = a.age || 0;
        bVal = b.age || 0;
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

  // Get teams that can still bid
  const activeTeams = Object.values(draftState.teams).filter(team => 
    team.openSlots > 0 && team.remainingBudget >= MIN_BID
  );

  // Calculate max bid for a team
  const getMaxBid = (team) => {
    if (team.openSlots === 0) return 0;
    if (team.openSlots === 1) return team.remainingBudget;
    
    // Must reserve $1 for each remaining slot after this one
    const reserveAmount = (team.openSlots - 1) * MIN_BID;
    return Math.max(MIN_BID, team.remainingBudget - reserveAmount);
  };

  // Add a draft pick
  const addDraftPick = () => {
    if (!selectedPlayer || !selectedTeam || !bidAmount) return;
    
    const team = draftState.teams[selectedTeam];
    const amount = parseInt(bidAmount);
    
    // Validate bid
    if (amount < MIN_BID) {
      alert(`Minimum bid is $${MIN_BID}`);
      return;
    }
    
    if (amount > getMaxBid(team)) {
      alert(`Maximum bid for ${selectedTeam} is $${getMaxBid(team)}`);
      return;
    }
    
    const pick = {
      id: Date.now(),
      playerId: selectedPlayer.mfl_id,
      playerName: selectedPlayer.name,
      position: selectedPlayer.position,
      teamName: selectedTeam,
      salary: amount,
      timestamp: new Date().toISOString()
    };
    
    // Update draft state
    setDraftState(prev => {
      const newState = { ...prev };
      
      // Add pick
      newState.draftPicks = [...prev.draftPicks, pick];
      
      // Update team
      newState.teams = {
        ...prev.teams,
        [selectedTeam]: {
          ...prev.teams[selectedTeam],
          players: [...prev.teams[selectedTeam].players, {
            id: selectedPlayer.id,
            salary: amount,
            status: 'ROSTER'
          }],
          remainingBudget: prev.teams[selectedTeam].remainingBudget - amount,
          openSlots: prev.teams[selectedTeam].openSlots - 1
        }
      };
      
      return newState;
    });
    
    // Reset form
    setSelectedPlayer(null);
    setBidAmount('');
    setSelectedTeam('');
  };

  // Undo a pick
  const undoPick = (pickId) => {
    const pick = draftState.draftPicks.find(p => p.id === pickId);
    if (!pick) return;
    
    setDraftState(prev => {
      const newState = { ...prev };
      
      // Remove pick
      newState.draftPicks = prev.draftPicks.filter(p => p.id !== pickId);
      
      // Update team
      const team = prev.teams[pick.teamName];
      newState.teams = {
        ...prev.teams,
        [pick.teamName]: {
          ...team,
          players: team.players.filter(p => p.id !== pick.playerId),
          remainingBudget: team.remainingBudget + pick.salary,
          openSlots: team.openSlots + 1
        }
      };
      
      return newState;
    });
    
    setShowUndoConfirm(null);
  };

  // Reset draft
  const resetDraft = () => {
    if (confirm('Are you sure you want to reset the entire draft? This cannot be undone.')) {
      // Clear local storage
      localStorage.removeItem('auctionDraftState');
      
      // Re-initialize the draft state
      const teams = {};
      rosters?.forEach(roster => {
        const teamName = roster.name || `Team ${roster.id}`;
        const players = roster.player ? 
          (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
        
        teams[teamName] = {
          id: roster.id,
          name: teamName,
          players: players.map(p => ({
            id: typeof p === 'object' ? p.id : p,
            salary: parseFloat(p.salary || 0),
            status: p.status || 'ROSTER'
          })),
          remainingBudget: SALARY_CAP,
          openSlots: ROSTER_SIZE
        };
        
        // Calculate remaining budget and open slots
        let totalSalary = 0;
        let rosterCount = 0;
        teams[teamName].players.forEach(player => {
          if (player.status !== 'TAXI_SQUAD') {
            totalSalary += player.salary;
            rosterCount++;
          }
        });
        
        teams[teamName].remainingBudget = SALARY_CAP - totalSalary;
        teams[teamName].openSlots = ROSTER_SIZE - rosterCount;
      });
      
      setDraftState({
        teams,
        draftPicks: [],
        availablePlayers: []
      });
      
      // Reset form
      setSelectedPlayer(null);
      setBidAmount('');
      setSelectedTeam('');
    }
  };

  // Export draft results
  const exportDraft = () => {
    const data = {
      timestamp: new Date().toISOString(),
      picks: draftState.draftPicks,
      teams: draftState.teams
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auction_draft_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get unique positions
  const positions = [...new Set(databaseFreeAgents.map(p => p.position).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Auction Draft</h2>
          <p className="text-sm text-gray-600 mt-1">
            {activeTeams.length} teams still drafting • {draftState.draftPicks.length} picks made
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportDraft}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 text-sm"
          >
            <Save size={16} />
            Export Draft
          </button>
          <button
            onClick={resetDraft}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1 text-sm"
          >
            <RotateCcw size={16} />
            Reset Draft
          </button>
        </div>
      </div>

      {/* Draft History - Moved to top */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Draft History</h3>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Pick</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Player</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase">Pos</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Team</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Salary</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {draftState.draftPicks.slice().reverse().map((pick, index) => (
                <tr key={pick.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-900">{draftState.draftPicks.length - index}</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{pick.playerName}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded ${positionColors[pick.position]}`}>
                      {pick.position}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    {pick.teamName}
                    {getOwnerName(pick.teamName) && (
                      <span className="text-xs text-gray-600 block">{getOwnerName(pick.teamName)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-medium text-green-600">
                    ${pick.salary}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {showUndoConfirm === pick.id ? (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => undoPick(pick.id)}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowUndoConfirm(null)}
                          className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowUndoConfirm(pick.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {draftState.draftPicks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No picks made yet
            </div>
          )}
        </div>
      </div>

      {/* Draft Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Status */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Team Status</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.values(draftState.teams).map(team => {
                const maxBid = getMaxBid(team);
                const isActive = team.openSlots > 0 && maxBid > 0;
                
                return (
                  <div 
                    key={team.id} 
                    className={`p-2 rounded border ${
                      isActive ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{team.name}</div>
                    {getOwnerName(team.name) && (
                      <div className="text-xs text-gray-600">{getOwnerName(team.name)}</div>
                    )}
                    <div className="text-xs text-gray-700 mt-1">
                      Budget: ${team.remainingBudget} • Slots: {team.openSlots}
                      {isActive && <span className="text-green-600 ml-1">• Max: ${maxBid}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Player Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Make a Pick</h3>
            
            {/* Search and Filters */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500"
                />
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                >
                  <option value="ALL">All Positions</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Player */}
            {selectedPlayer && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{selectedPlayer.name}</div>
                    <div className="text-sm text-gray-600">
                      <span className={`px-2 py-0.5 text-xs rounded ${positionColors[selectedPlayer.position]}`}>
                        {selectedPlayer.position}
                      </span>
                      <span className="ml-2">{selectedPlayer.team || 'FA'}</span>
                      {selectedPlayer.age && <span className="ml-2">Age {selectedPlayer.age}</span>}
                      {selectedPlayer.fantasypros_rank && (
                        <span className="ml-2 text-purple-600">ECR: #{selectedPlayer.fantasypros_rank}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Bid Form */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  >
                    <option value="" className="text-gray-500">Select Team</option>
                    {activeTeams.map(team => {
                      const ownerName = getOwnerName(team.name);
                      return (
                        <option key={team.id} value={team.name}>
                          {ownerName ? `${ownerName} - ` : ''}{team.name} (Max: ${getMaxBid(team)})
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Bid"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      min={MIN_BID}
                      max={selectedTeam ? getMaxBid(draftState.teams[selectedTeam]) : 999}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 text-gray-900 placeholder-gray-500"
                    />
                    <button
                      onClick={addDraftPick}
                      disabled={!selectedTeam || !bidAmount}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Draft
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Available Players Table */}
            {loadingPlayers ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600">Loading free agents...</div>
              </div>
            ) : sortedPlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || positionFilter !== 'ALL' 
                  ? 'No players found matching your filters' 
                  : 'No free agents available'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-lg overflow-hidden">
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
                          onPlayerClick={() => setSelectedPlayer(player)}
                        >
                          <tr 
                            className={`hover:bg-gray-50 ${
                              selectedPlayer?.mfl_id === player.mfl_id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <PlayerImage player={player} size={40} />
                                
                                <div className="cursor-pointer">
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
                            <td className="px-4 py-3 text-center cursor-pointer">
                              <span className={`px-2 py-1 text-xs rounded ${positionColors[player.position] || 'bg-gray-100'}`}>
                                {player.position}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-700 cursor-pointer">
                              {player.team || 'FA'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-700 cursor-pointer">
                              {player.age || '-'}
                            </td>
                            <td className="px-4 py-3 text-center cursor-pointer">
                              <span className={`font-medium ${
                                player.fantasypros_rank <= 50 ? 'text-purple-600' :
                                player.fantasypros_rank <= 100 ? 'text-blue-600' :
                                player.fantasypros_rank <= 200 ? 'text-gray-600' :
                                'text-gray-400'
                              }`}>
                                {player.fantasypros_rank || '-'}
                              </span>
                              {player.fantasypros_tier && (
                                <span className="ml-1 text-xs text-gray-500">
                                  (T{player.fantasypros_tier})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center cursor-pointer">
                              {mflRank ? (
                                <span className="font-medium text-blue-600">
                                  {mflRank}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        </PlayerHoverCard>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}