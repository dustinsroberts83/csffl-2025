import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Search, User, AlertCircle, RotateCcw, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOwnerName } from './teamOwners';

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

// Player Hover Card Component
function PlayerHoverCard({ player, sleeperPlayers, position }) {
  const [imageError, setImageError] = useState(false);
  
  // Find matching Sleeper player for additional data and image
  const convertedName = player.name.includes(',') 
    ? player.name.split(',').map(p => p.trim()).reverse().join(' ')
    : player.name;
  
  const sleeperData = sleeperPlayers ? Object.values(sleeperPlayers).find(sp => {
    if (!sp || !sp.first_name || !sp.last_name) return false;
    const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
    return sleeperName === convertedName.toLowerCase();
  }) : null;

  // Calculate dynasty outlook
  const age = player.age || sleeperData?.age || 25;
  const playerPosition = player.position;
  const primes = {
    QB: { start: 26, peak: 29, end: 32 },
    RB: { start: 22, peak: 24, end: 27 },
    WR: { start: 24, peak: 26, end: 29 },
    TE: { start: 25, peak: 27, end: 30 }
  };
  
  const prime = primes[playerPosition];
  let dynastyOutlook = { status: 'Unknown', color: 'text-gray-600' };
  
  if (prime) {
    if (age < prime.start) dynastyOutlook = { status: 'Pre-Prime', color: 'text-green-600' };
    else if (age >= prime.start && age <= prime.end) dynastyOutlook = { status: 'Prime Years', color: 'text-blue-600' };
    else dynastyOutlook = { status: 'Post-Prime', color: 'text-red-600' };
  }

  return (
    <div 
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 pointer-events-none"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
    >
      <div className="flex items-start gap-3">
        {/* Player Image */}
        <div className="flex-shrink-0">
          {sleeperData?.player_id && !imageError ? (
            <img
              src={`https://sleepercdn.com/content/nfl/players/${sleeperData.player_id}.jpg`}
              alt={player.name}
              className="w-20 h-20 rounded-lg object-cover bg-gray-100"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
              <User className="text-gray-400" size={32} />
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900">{player.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 text-xs rounded ${positionColors[player.position] || 'bg-gray-100'}`}>
              {player.position}
            </span>
            <span className="text-sm text-gray-600">{player.team || 'FA'}</span>
            {player.age && <span className="text-sm text-gray-600">• Age {player.age}</span>}
          </div>
        </div>
      </div>

      {/* Rankings Section */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-600">Consensus Rank</div>
          <div className="text-lg font-bold text-gray-900">{player.consensus_rank || '-'}</div>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <div className="text-xs text-gray-600">Auction Value</div>
          <div className="text-lg font-bold text-green-600">${player.auction_value || 1}</div>
        </div>
      </div>

      {/* Source Rankings */}
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Sleeper Rank:</span>
          <span className="font-medium">{player.sleeper_rank || '-'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">ESPN Rank:</span>
          <span className="font-medium">{player.espn_rank || '-'}</span>
        </div>
        {player.dynasty_rank && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Dynasty Rank:</span>
            <span className="font-medium">{player.dynasty_rank}</span>
          </div>
        )}
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

      {/* Additional Info */}
      {(player.injury_status || sleeperData?.injury_status) && (
        <div className="mt-3 p-2 bg-red-50 rounded flex items-center gap-2">
          <AlertCircle className="text-red-600" size={16} />
          <span className="text-sm text-red-800">
            {player.injury_status || sleeperData.injury_status}
          </span>
        </div>
      )}

      {/* Draft Info */}
      {player.draft_year && (
        <div className="mt-3 text-xs text-gray-500">
          {player.draft_year} Draft
          {player.draft_round && ` - Round ${player.draft_round}.${player.draft_pick}`}
        </div>
      )}

      {/* Sleeper Metadata */}
      {sleeperData && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
          {sleeperData.years_exp !== undefined && (
            <div className="text-xs text-gray-600">
              Experience: {sleeperData.years_exp} {sleeperData.years_exp === 1 ? 'year' : 'years'}
            </div>
          )}
          {sleeperData.college && (
            <div className="text-xs text-gray-600">College: {sleeperData.college}</div>
          )}
          {sleeperData.height && sleeperData.weight && (
            <div className="text-xs text-gray-600">
              {Math.floor(sleeperData.height / 12)}'{sleeperData.height % 12}" • {sleeperData.weight} lbs
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });
  const [sleeperPlayers, setSleeperPlayers] = useState(null);
  const [useMFLRankings, setUseMFLRankings] = useState(false);
  const [mflRankings, setMflRankings] = useState({});

  // Save to localStorage whenever draft state changes
  useEffect(() => {
    localStorage.setItem('auctionDraftState', JSON.stringify(draftState));
  }, [draftState]);

  // Fetch free agents from database
  useEffect(() => {
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
            .order('auction_value', { ascending: false, nullsFirst: false })
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
    
    fetchDatabaseFreeAgents();
    fetchSleeperPlayers();
    fetchMFLRankings();
  }, [freeAgents]);

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

  // Filter available players
  const availablePlayers = useMemo(() => {
    if (!databaseFreeAgents || databaseFreeAgents.length === 0) return [];
    
    return databaseFreeAgents
      .filter(player => !draftedPlayerIds.has(player.mfl_id))
      .filter(player => {
        if (positionFilter !== 'ALL' && player.position !== positionFilter) return false;
        if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by auction value, then by name
        const valueA = a.auction_value || 1;
        const valueB = b.auction_value || 1;
        if (valueB !== valueA) return valueB - valueA;
        return a.name.localeCompare(b.name);
      });
  }, [databaseFreeAgents, draftedPlayerIds, positionFilter, searchTerm]);

  // Group players by position
  const playersByPosition = useMemo(() => {
    const grouped = {};
    availablePlayers.forEach(player => {
      if (!grouped[player.position]) {
        grouped[player.position] = [];
      }
      grouped[player.position].push(player);
    });
    
    // Sort each position group by MFL rank if enabled
    if (useMFLRankings) {
      Object.keys(grouped).forEach(position => {
        grouped[position].sort((a, b) => {
          const rankA = mflRankings[a.name.toLowerCase()] || 9999;
          const rankB = mflRankings[b.name.toLowerCase()] || 9999;
          return rankA - rankB;
        });
      });
    }
    
    return grouped;
  }, [availablePlayers, useMFLRankings, mflRankings]);

  // Get teams that can still bid
  const activeTeams = useMemo(() => {
    return Object.values(draftState.teams).filter(team => 
      team.openSlots > 0 && team.remainingBudget >= MIN_BID
    );
  }, [draftState.teams]);

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
      
      // Re-initialize the draft state without reloading the page
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

  // Handle mouse events for hover card
  const handleMouseEnter = (player, event) => {
    setHoveredPlayer(player);
  };

  const handleMouseMove = (event) => {
    if (!hoveredPlayer) return;
    
    const cardWidth = 320;
    const cardHeight = 450; // Slightly taller to accommodate image
    const offset = 10;
    
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
                  {Object.keys(positionColors).map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              
              {/* MFL Rankings Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useMFLRankings"
                  checked={useMFLRankings}
                  onChange={(e) => setUseMFLRankings(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="useMFLRankings" className="text-sm text-gray-700 cursor-pointer">
                  Sort by MFL Expert Rankings
                </label>
                {Object.keys(mflRankings).length > 0 && (
                  <span className="text-xs text-gray-500">
                    ({Object.keys(mflRankings).length} rankings loaded)
                  </span>
                )}
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
                      <span className="ml-2">Value: ${selectedPlayer.auction_value || 1}</span>
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

            {/* Available Players */}
            {loadingPlayers ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600">Loading free agents...</div>
              </div>
            ) : availablePlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || positionFilter !== 'ALL' 
                  ? 'No players found matching your filters' 
                  : 'No free agents available'}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-2">
                  Showing {availablePlayers.length} of {databaseFreeAgents.length} total free agents
                </div>
                {Object.entries(playersByPosition).map(([position, players]) => (
                  <div key={position} className="mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">{position}</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {players.map(player => (
                        <div
                          key={player.mfl_id}
                          onClick={() => setSelectedPlayer(player)}
                          onMouseEnter={(e) => handleMouseEnter(player, e)}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                          className={`p-2 rounded border cursor-pointer hover:bg-gray-50 ${
                            selectedPlayer?.mfl_id === player.mfl_id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-medium text-sm text-gray-900">{player.name}</span>
                              <span className="text-xs text-gray-600 ml-2">{player.team || 'FA'}</span>
                              {player.age && <span className="text-xs text-gray-500 ml-1">Age {player.age}</span>}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">${player.auction_value || 1}</div>
                              {player.consensus_rank && (
                                <div className="text-xs text-gray-500">Rank: {player.consensus_rank}</div>
                              )}
                              {useMFLRankings && mflRankings[player.name.toLowerCase()] && (
                                <div className="text-xs text-blue-600">
                                  MFL: #{mflRankings[player.name.toLowerCase()]}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft History */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Draft History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
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

      {/* Player Card Hover */}
      {hoveredPlayer && (
        <PlayerHoverCard 
          player={hoveredPlayer} 
          sleeperPlayers={sleeperPlayers} 
          position={cardPosition}
        />
      )}
    </div>
  );
}