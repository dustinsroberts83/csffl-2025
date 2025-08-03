// components/Rosters.js
import { Users } from 'lucide-react';
import { getOwnerName } from './teamOwners';

// Position constants
const positionColors = {
  QB: 'bg-red-100 text-red-800 border-red-300',
  RB: 'bg-green-100 text-green-800 border-green-300',
  WR: 'bg-blue-100 text-blue-800 border-blue-300',
  TE: 'bg-orange-100 text-orange-800 border-orange-300',
  PK: 'bg-purple-100 text-purple-800 border-purple-300',
  Def: 'bg-gray-100 text-gray-800 border-gray-300',
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

export default function Rosters({ rosters, playerDetails, league }) {
  if (!rosters || rosters.length === 0) {
    return <div className="text-gray-600">No roster data available</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Team Rosters</h2>
      <div className="grid gap-6">
        {rosters.map((roster) => {
          // Get all players from the roster
          const allPlayers = roster.player ? 
            (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
          
          // Separate active roster and taxi squad based on status
          const activeRoster = [];
          const taxiSquad = [];
          
          allPlayers.forEach(player => {
            // Make sure we're working with the full player object
            const playerObj = typeof player === 'object' ? player : { id: player };
            
            // Check the status field
            if (playerObj.status === 'TAXI_SQUAD') {
              taxiSquad.push(playerObj);
            } else {
              // Default to active roster for 'ROSTER' status or any other status
              activeRoster.push(playerObj);
            }
          });
          
          // Group active players by position
          const playersByPosition = {};
          activeRoster.forEach((player) => {
            const playerId = player.id;
            const playerInfo = playerDetails[playerId];
            if (playerInfo) {
              const position = playerInfo.position || 'Unknown';
              if (!playersByPosition[position]) {
                playersByPosition[position] = [];
              }
              playersByPosition[position].push({ 
                ...playerInfo, 
                salary: player.salary || null,
                contractInfo: player.contractInfo || null,
                contractStatus: player.contractStatus || null,
                contractYear: player.contractYear || null
              });
            }
          });

          // Sort positions
          const sortedPositions = Object.keys(playersByPosition).sort((a, b) => {
            const indexA = positionOrder.indexOf(a);
            const indexB = positionOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          
          // Calculate total salary for active roster
          const activeSalary = activeRoster.reduce((sum, player) => {
            return sum + parseFloat(player.salary || 0);
          }, 0);
          
          // Get owner name
          const teamName = roster.name || `Team ${roster.id}`;
          const ownerName = getOwnerName(teamName);
          
          return (
            <div key={roster.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white">
              <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{teamName}</h3>
                    {ownerName && (
                      <p className="text-sm text-gray-300 mt-1">Owner: {ownerName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-gray-300">Salary: </span>
                      <span className="font-bold">${activeSalary.toFixed(2)}</span>
                      <span className="text-gray-300">/{league?.salaryCapAmount || '500'}</span>
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      {activeRoster.length} active
                      {taxiSquad.length > 0 && <span> • {taxiSquad.length} taxi</span>}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                {/* Active Roster */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <Users size={18} className="mr-2" />
                    Active Roster
                    <span className="ml-2 text-sm font-normal text-gray-500">({activeRoster.length} players)</span>
                  </h4>
                  {sortedPositions.length > 0 ? (
                    <div className="space-y-3">
                      {sortedPositions.map((position) => (
                        <div key={position}>
                          <h5 className="text-sm font-semibold text-gray-600 mb-2">{position}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {playersByPosition[position].map((player) => (
                              <div 
                                key={player.id} 
                                className={`text-sm p-2 rounded-lg border ${getPositionColor(position)}`}
                              >
                                <div className="font-medium">{player.name}</div>
                                <div className="text-xs opacity-75">
                                  {player.team}
                                  {player.salary && <span className="ml-2">${player.salary}</span>}
                                  {player.contractYear && player.contractYear !== "0" && (
                                    <span className="ml-1">• Y{player.contractYear}</span>
                                  )}
                                </div>
                                {player.contractInfo && (
                                  <div className="text-xs opacity-60 mt-1">{player.contractInfo}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No active players</p>
                  )}
                </div>

                {/* Taxi Squad */}
                {taxiSquad.length > 0 && (
                  <div className="border-t border-gray-200 mt-4 pt-4">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <Users size={18} className="mr-2 text-gray-600" />
                      Taxi Squad
                      <span className="ml-2 text-sm font-normal text-gray-500">({taxiSquad.length} players)</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {taxiSquad.map((player) => {
                        const playerId = player.id;
                        const playerInfo = playerDetails[playerId];
                        
                        return (
                          <div 
                            key={playerId} 
                            className={`text-sm p-2 rounded-lg border ${
                              playerInfo ? getPositionColor(playerInfo.position) : 'bg-gray-50 text-gray-600 border-gray-300'
                            } opacity-75`}
                          >
                            {playerInfo ? (
                              <>
                                <div className="font-medium">{playerInfo.name}</div>
                                <div className="text-xs">
                                  {playerInfo.position} - {playerInfo.team}
                                  {player.salary && <span className="ml-2">${player.salary}</span>}
                                  {player.contractYear && player.contractYear !== "0" && (
                                    <span className="ml-1">• Y{player.contractYear}</span>
                                  )}
                                </div>
                                {player.contractInfo && (
                                  <div className="text-xs opacity-60 mt-1">{player.contractInfo}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500">Player ID: {playerId}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}