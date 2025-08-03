// components/RosterDiagnostic.js
import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, AlertCircle } from 'lucide-react';

export default function RosterDiagnostic({ rosters, playerDetails }) {
  const [expandedRoster, setExpandedRoster] = useState(null);
  const [showRawData, setShowRawData] = useState(false);

  if (!rosters || rosters.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-yellow-600" size={20} />
          <span className="text-yellow-800">No roster data available</span>
        </div>
      </div>
    );
  }

  // Analyze roster structure
  const rosterAnalysis = rosters.map((roster, index) => {
    const analysis = {
      index,
      id: roster.id || 'No ID',
      name: roster.name || 'No Name',
      playerCount: 0,
      playerStructure: 'unknown',
      samplePlayers: [],
      issues: []
    };

    // Check player structure
    if (!roster.player) {
      analysis.issues.push('No player property');
      analysis.playerStructure = 'missing';
    } else if (Array.isArray(roster.player)) {
      analysis.playerCount = roster.player.length;
      analysis.playerStructure = 'array';
      analysis.samplePlayers = roster.player.slice(0, 3);
    } else if (typeof roster.player === 'object') {
      analysis.playerCount = 1;
      analysis.playerStructure = 'single object';
      analysis.samplePlayers = [roster.player];
    } else if (typeof roster.player === 'string') {
      analysis.playerCount = 1;
      analysis.playerStructure = 'string ID';
      analysis.samplePlayers = [roster.player];
    }

    // Check for common issues
    if (analysis.playerCount === 0) {
      analysis.issues.push('No players found');
    }

    return analysis;
  });

  // Count total players across all rosters
  const totalPlayers = rosterAnalysis.reduce((sum, r) => sum + r.playerCount, 0);
  const rostersWithIssues = rosterAnalysis.filter(r => r.issues.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Roster Data Diagnostic</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-blue-900">Total Rosters:</span>
            <p className="font-bold text-blue-900">{rosters.length}</p>
          </div>
          <div>
            <span className="text-blue-900">Total Players:</span>
            <p className="font-bold text-blue-900">{totalPlayers}</p>
          </div>
          <div>
            <span className="text-blue-900">Avg per Roster:</span>
            <p className="font-bold text-blue-900">
              {rosters.length > 0 ? (totalPlayers / rosters.length).toFixed(1) : 0}
            </p>
          </div>
          <div>
            <span className="text-blue-900">Rosters with Issues:</span>
            <p className="font-bold text-red-600">{rostersWithIssues}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-gray-900">Roster Analysis</h4>
          <button
            onClick={() => setShowRawData(!showRawData)}
            className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-gray-900"
          >
            {showRawData ? 'Hide' : 'Show'} Raw Data
          </button>
        </div>

        {rosterAnalysis.map((analysis) => (
          <div key={analysis.index} className="border border-gray-200 rounded-lg">
            <div
              className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => setExpandedRoster(
                expandedRoster === analysis.index ? null : analysis.index
              )}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-gray-700" />
                  <span className="font-medium text-gray-900">{analysis.name}</span>
                  <span className="text-sm text-gray-700">
                    ({analysis.playerCount} players)
                  </span>
                  {analysis.issues.length > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                      {analysis.issues.length} issues
                    </span>
                  )}
                </div>
                {expandedRoster === analysis.index ? 
                  <ChevronUp size={16} className="text-gray-700" /> : 
                  <ChevronDown size={16} className="text-gray-700" />
                }
              </div>
            </div>

            {expandedRoster === analysis.index && (
              <div className="p-3 border-t border-gray-200">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">ID:</span> 
                    <span className="text-gray-700 ml-1">{analysis.id}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Player Structure:</span>{' '}
                    <span className={`px-2 py-1 rounded text-xs ${
                      analysis.playerStructure === 'array' ? 'bg-green-100 text-green-700' :
                      analysis.playerStructure === 'missing' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {analysis.playerStructure}
                    </span>
                  </div>
                  
                  {analysis.issues.length > 0 && (
                    <div>
                      <span className="font-medium text-red-600">Issues:</span>
                      <ul className="ml-4 list-disc text-red-600">
                        {analysis.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <span className="font-medium text-gray-900">Sample Players:</span>
                    <div className="mt-1 space-y-1">
                      {analysis.samplePlayers.map((player, i) => (
                        <div key={i} className="ml-4 p-2 bg-gray-100 rounded text-xs">
                          {typeof player === 'string' ? (
                            <div className="text-gray-900">
                              Player ID: {player}
                              {playerDetails && playerDetails[player] && (
                                <span className="ml-2 text-green-600">
                                  → {playerDetails[player].name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-900">
                              {player.id && <div>ID: {player.id}</div>}
                              {player.status && <div>Status: {player.status}</div>}
                              {player.salary && <div>Salary: ${player.salary}</div>}
                              {player.contractYear && <div>Contract Year: {player.contractYear}</div>}
                              {playerDetails && playerDetails[player.id] && (
                                <div className="text-green-600">
                                  → {playerDetails[player.id].name} ({playerDetails[player.id].position})
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {showRawData && (
                    <div>
                      <span className="font-medium text-gray-900">Raw Roster Data:</span>
                      <pre className="mt-1 p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(rosters[analysis.index], null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Common Issues & Solutions</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• If player count is 0, the roster structure might be different than expected</li>
          <li>• If players are strings, they're just IDs that need to be looked up in playerDetails</li>
          <li>• If structure is "single object", the API returned one player instead of an array</li>
          <li>• Check the raw data to see the exact structure from MFL</li>
        </ul>
      </div>
    </div>
  );
}