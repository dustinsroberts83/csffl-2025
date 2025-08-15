// components/MFLViewer.js
'use client';

import { useState, useEffect } from 'react';
import { Users, Trophy, DollarSign, AlertCircle, RefreshCw, Activity, Calculator, BarChart, Database, Gavel, TrendingUp, Search } from 'lucide-react';
import LeagueInfo from './LeagueInfo';
import Rosters from './Rosters';
import Standings from './Standings';
import DatabaseFreeAgents from './DatabaseFreeAgents';
import TradeCalculator from './TradeCalculator';
import AuctionDraft from './AuctionDraft';
import MFLRankingsUploader from './MFLRankingsUploader';
import DiagnosticTool from './DiagnosticTool';  // ADD THIS IMPORT

export default function MFLViewer() {
  const [leagueId, setLeagueId] = useState('');
  const [year, setYear] = useState('2025');
  const [activeTab, setActiveTab] = useState('league');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPrivateLeague, setIsPrivateLeague] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [enhancementStatus, setEnhancementStatus] = useState('');
  const [data, setData] = useState({
    league: null,
    rosters: null,
    standings: null,
    players: null,
    playerDetails: {},
    freeAgents: null,
    playerScores: null
  });

  // ... (all the existing functions remain the same) ...

  // Fetch data through API proxy
  const fetchMFLData = async (type, additionalParams = {}) => {
    const params = {
      TYPE: type,
      ...additionalParams
    };
    
    const typesRequiringLeague = [
      'league', 'rosters', 'leagueStandings', 'transactions', 
      'projectedScores', 'playerScores', 'weeklyResults', 
      'schedule', 'playoffBrackets', 'freeAgents', 'salaries',
      'accounting', 'pool', 'survivorPool', 'draftResults',
      'auctionResults', 'myDraftList', 'messageBoard', 'tradeBait'
    ];
    
    if (typesRequiringLeague.includes(type)) {
      if (!leagueId) {
        throw new Error('League ID required for this request');
      }
      params.L = leagueId;
    }
    
    params.YEAR = year;
    
    const queryParams = new URLSearchParams(params);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log(`Fetching MFL data: /api/mfl?${queryParams}`);
      
      const response = await fetch(`/api/mfl?${queryParams}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('MFL API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Request timed out');
        throw new Error('Request timed out after 10 seconds');
      }
      console.error(`Error fetching ${type}:`, error);
      throw error;
    }
  };

  // Handle login for private leagues
  const handleLogin = async () => {
    try {
      const response = await fetch('/api/mfl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          leagueId,
          year
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        setIsPrivateLeague(false);
        setError('');
        fetchAllData();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Login failed. Please check your credentials.');
    }
  };

  const fetchAllData = async () => {
    if (!leagueId) {
      setError('Please enter a league ID');
      return;
    }

    setLoading(true);
    setError(null);
    setEnhancementStatus('Fetching league data...');

    try {
      // First batch: Basic league data
      const [leagueData, rostersData, standingsData, playersData] = await Promise.all([
        fetchMFLData('league'),
        fetchMFLData('rosters'),
        fetchMFLData('leagueStandings'),
        fetchMFLData('players')
      ]);

      setEnhancementStatus('Processing league data...');

      // Try to fetch player scores/projections
      let playerScores = null;
      try {
        const scoresData = await fetchMFLData('projectedScores', { 
          W: '0',
          COUNT: '500',
          STATUS: 'freeagent'
        });
        
        if (scoresData.projectedScores && scoresData.projectedScores.playerScore) {
          playerScores = {};
          const scores = Array.isArray(scoresData.projectedScores.playerScore) 
            ? scoresData.projectedScores.playerScore 
            : [scoresData.projectedScores.playerScore];
          
          scores.forEach(score => {
            if (score.id) {
              playerScores[score.id] = score;
            }
          });
        }
      } catch (scoreError) {
        console.log('Could not fetch player projections:', scoreError);
      }

      // Try to fetch ADP data
      let adpData = null;
      try {
        const adpResponse = await fetchMFLData('adp', { 
          PERIOD: 'RECENT',
          DAYS: '30',
          FCOUNT: '12'
        });
        
        if (adpResponse.adp && adpResponse.adp.player) {
          adpData = {};
          const adpPlayers = Array.isArray(adpResponse.adp.player) 
            ? adpResponse.adp.player 
            : [adpResponse.adp.player];
          
          adpPlayers.forEach(player => {
            if (player.id) {
              adpData[player.id] = parseFloat(player.averagePick || player.adp || 0);
            }
          });
        }
      } catch (adpError) {
        console.log('Could not fetch ADP data:', adpError);
      }

      // Create player details map
      const playerDetails = {};
      if (playersData.players && playersData.players.player) {
        playersData.players.player.forEach(player => {
          playerDetails[player.id] = {
            ...player,
            adp: adpData?.[player.id] || null
          };
        });
      }

      // Get rostered player IDs
      const rosteredPlayerIds = new Set();
      if (rostersData.rosters && rostersData.rosters.franchise) {
        const franchises = Array.isArray(rostersData.rosters.franchise) 
          ? rostersData.rosters.franchise 
          : [rostersData.rosters.franchise];
        
        franchises.forEach(roster => {
          const players = roster.player ? 
            (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
          
          players.forEach(player => {
            const playerId = typeof player === 'object' ? player.id : player;
            rosteredPlayerIds.add(playerId);
          });
        });
      }

      // Filter free agents
      const freeAgents = playersData.players?.player?.filter(
        player => !rosteredPlayerIds.has(player.id)
      ).slice(0, 100).map(player => ({
        ...player,
        adp: adpData?.[player.id] || null
      })) || [];

      console.log('Free agents sample:', freeAgents[0]);

      // Get franchise names
      const franchiseNames = {};
      if (leagueData.league && leagueData.league.franchises && leagueData.league.franchises.franchise) {
        const franchises = Array.isArray(leagueData.league.franchises.franchise) 
          ? leagueData.league.franchises.franchise 
          : [leagueData.league.franchises.franchise];
        
        franchises.forEach(franchise => {
          franchiseNames[franchise.id] = franchise.name || `Team ${franchise.id}`;
        });
      }

      // Merge franchise names into rosters
      const rostersWithNames = rostersData.rosters?.franchise || [];
      if (rostersWithNames.length > 0) {
        rostersWithNames.forEach(roster => {
          if (!roster.name && franchiseNames[roster.id]) {
            roster.name = franchiseNames[roster.id];
          }
        });
      }

      setEnhancementStatus('');

      // Set data
      setData({
        league: leagueData.league,
        rosters: rostersWithNames,
        standings: standingsData.leagueStandings?.franchise || [],
        players: playersData.players?.player || [],
        playerDetails: playerDetails,
        freeAgents: freeAgents,
        playerScores: playerScores || {}
      });

      setLoading(false);
    } catch (err) {
      if (err.message.includes('Authentication required')) {
        setIsPrivateLeague(true);
        setError('This appears to be a private league. Please login to continue.');
      } else if (err.message.includes('Invalid League')) {
        setError('Invalid League ID. Please enter a numeric league ID (e.g., 12345), not a username.');
      } else if (err.message.includes('not found')) {
        setError('League not found. Make sure you\'re using your numeric league ID from your MFL URL.');
      } else {
        setError(err.message || 'Failed to fetch league data. Please check your league ID.');
      }
      setEnhancementStatus('');
      setLoading(false);
    }
  };

  // Complete sync function - MFL + FantasyPros only
  const syncMFLAndFantasyPros = async () => {
    if (!leagueId) {
      alert('Please enter a league ID first');
      return;
    }

    try {
      setEnhancementStatus('Syncing MFL free agents and FantasyPros rankings...');
      
      const response = await fetch('/api/sync-mfl-fantasypros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          year
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Sync Complete!\n
Free Agents: ${result.summary.freeAgents}
FantasyPros Rankings Fetched: ${result.summary.fantasyProsRankingsFetched}
Players Matched: ${result.summary.playersMatched}
Rankings Updated: ${result.summary.rankingsUpdated}`);
        
        // Refresh the current tab if on free agents
        if (activeTab === 'freeAgents') {
          setActiveTab('league');
          setTimeout(() => setActiveTab('freeAgents'), 100);
        }
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      
      setEnhancementStatus('');
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Failed to sync: ${error.message}`);
      setEnhancementStatus('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center text-gray-900">
          <Trophy className="mr-3 text-blue-600" size={32} />
          CSFFL 2025
        </h1>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <Activity className="mr-2 mt-1 flex-shrink-0 text-green-600" size={20} />
            <div>
              <p className="font-semibold text-gray-800">Enhanced Features Active!</p>
              <p className="text-sm text-gray-700">• FantasyPros Expert Consensus Rankings</p>
              <p className="text-sm text-gray-700">• MFL expert rankings support</p>
              <p className="text-sm text-gray-700">• Database-powered free agent tracking</p>
              <p className="text-sm text-gray-700">• Auction draft with live tracking</p>
            </div>
          </div>
        </div>

        {/* Login form for private leagues */}
        {isPrivateLeague && !isAuthenticated && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-gray-800">Private League Authentication</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="MFL Username"
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg w-full text-gray-900"
              />
              <input
                type="password"
                placeholder="MFL Password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg w-full text-gray-900"
              />
              <button
                onClick={handleLogin}
                className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 w-full"
              >
                Login to Private League
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Enter League ID"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg flex-1 text-gray-900"
          />
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 animate-spin" size={16} />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2" size={16} />
                Fetch Data
              </>
            )}
          </button>
          <button
            onClick={syncMFLAndFantasyPros}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            title="Complete MFL and FantasyPros sync"
          >
            <RefreshCw size={16} />
            Full Sync
          </button>
        </div>

        {enhancementStatus && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg mb-4 flex items-center">
            <RefreshCw className="mr-2 animate-spin" size={16} />
            {enhancementStatus}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          <button
            className={`px-4 py-2 font-semibold ${activeTab === 'league' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('league')}
          >
            League Info
          </button>
          <button
            className={`px-4 py-2 font-semibold ${activeTab === 'rosters' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('rosters')}
          >
            Rosters
          </button>
          <button
            className={`px-4 py-2 font-semibold ${activeTab === 'standings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('standings')}
          >
            Standings
          </button>
          <button
            className={`px-4 py-2 font-semibold flex items-center gap-1 ${activeTab === 'freeAgents' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('freeAgents')}
          >
            <BarChart size={16} />
            Free Agents
          </button>
          <button
            className={`px-4 py-2 font-semibold flex items-center gap-1 ${activeTab === 'auction' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('auction')}
          >
            <Gavel size={16} />
            Auction Draft
          </button>
          <button
            className={`px-4 py-2 font-semibold flex items-center gap-1 ${activeTab === 'rankings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('rankings')}
          >
            <TrendingUp size={16} />
            Upload Rankings
          </button>
          <button
            className={`px-4 py-2 font-semibold flex items-center gap-1 ${activeTab === 'diagnostic' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('diagnostic')}
          >
            <Search size={16} />
            Diagnostic
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        {!data.league && !loading && (
          <div className="text-gray-600 text-center py-8">
            <Trophy size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">Welcome to CSFFL 2025</p>
            <p>Enter your league ID and click "Fetch Data" to load your league</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="animate-spin mr-2" size={24} />
            <span className="text-gray-600">Loading league data...</span>
          </div>
        )}
        {!loading && data.league && (
          <>
            {activeTab === 'league' && <LeagueInfo league={data.league} />}
            {activeTab === 'rosters' && <Rosters rosters={data.rosters} playerDetails={data.playerDetails} league={data.league} />}
            {activeTab === 'standings' && <Standings standings={data.standings} rosters={data.rosters} />}
            {activeTab === 'freeAgents' && (
              <DatabaseFreeAgents 
                leagueId={leagueId}
                year={year} 
              />
            )}
            {activeTab === 'auction' && (
              <AuctionDraft
                rosters={data.rosters}
                freeAgents={data.freeAgents}
                playerDetails={data.playerDetails}
              />
            )}
            {activeTab === 'rankings' && (
              <MFLRankingsUploader
                leagueId={leagueId}
              />
            )}
            {activeTab === 'diagnostic' && (
              <DiagnosticTool
                leagueId={leagueId}
              />
            )}
          </>
        )}
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold mb-2 text-gray-800">Features:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <h4 className="font-medium text-gray-800">🎯 Full Sync</h4>
            <ul className="ml-4 space-y-1">
              <li>• Fetches all players from MFL</li>
              <li>• Identifies and stores free agents</li>
              <li>• Gets FantasyPros ECR for all positions</li>
              <li>• Automatically matches and updates rankings</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800">📊 Auction Draft</h4>
            <ul className="ml-4 space-y-1">
              <li>• Live salary cap tracking</li>
              <li>• Maximum bid enforcement</li>
              <li>• Draft history with undo</li>
              <li>• Export draft results</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm font-semibold text-blue-800">Dynasty League Features</p>
          <p className="text-sm text-blue-700 mt-1">
            12 teams • $500 salary cap • 26 roster spots + 6 taxi • 3-year contracts with 10% raises
          </p>
        </div>
      </div>
    </div>
  );
}