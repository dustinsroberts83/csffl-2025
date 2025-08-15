
'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, TrendingUp, RefreshCw } from 'lucide-react';

export default function FantasyProsTest() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState('rankings');
  const [scoring, setScoring] = useState('PPR');
  const [position, setPosition] = useState('ALL');

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const params = new URLSearchParams({
        endpoint,
        scoring,
        position,
        sport: 'NFL',
        season: '2025'
      });

      const res = await fetch(`/api/fantasypros?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(JSON.stringify(data, null, 2));
      }

      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncToDatabase = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/fantasypros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: '37306' })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(JSON.stringify(data, null, 2));
      }

      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">FantasyPros API Test</h1>

        {/* API Test Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-100">API Endpoint Test</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Endpoint
              </label>
              <select
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="rankings">Consensus Rankings</option>
                <option value="projections">Projections</option>
                <option value="players">Players</option>
                <option value="adp">ADP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Scoring
              </label>
              <select
                value={scoring}
                onChange={(e) => setScoring(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PPR">PPR</option>
                <option value="HALF">Half PPR</option>
                <option value="STD">Standard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Position
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Positions</option>
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
                <option value="K">K</option>
                <option value="DST">DST</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={testAPI}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <CheckCircle size={16} />
              )}
              Test API Endpoint
            </button>

            <button
              onClick={syncToDatabase}
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <TrendingUp size={16} />
              )}
              Sync Rankings to Database
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-semibold text-red-300 mb-2">Error:</h3>
                <pre className="text-sm text-red-200 whitespace-pre-wrap font-mono">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Success Response */}
        {response && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-400 flex-shrink-0 mt-1" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-green-300 mb-2">Success!</h3>
                
                {/* Sync Results */}
                {response.updated !== undefined && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="text-sm text-gray-400">Players Updated</div>
                      <div className="text-2xl font-bold text-green-400">{response.updated}</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="text-sm text-gray-400">Players Matched</div>
                      <div className="text-2xl font-bold text-blue-400">{response.matched}</div>
                    </div>
                  </div>
                )}

                {/* API Response Preview */}
                {response.players && (
                  <div>
                    <div className="text-sm text-gray-300 mb-2">
                      Total Players: {response.count || response.players.length}
                    </div>
                    <div className="bg-gray-800 rounded p-3 max-h-96 overflow-y-auto">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Top 10 Players:</h4>
                      <div className="space-y-2">
                        {response.players.slice(0, 10).map((player, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                            <div>
                              <span className="font-medium">{player.name}</span>
                              <span className="text-sm text-gray-400 ml-2">
                                {player.position} - {player.team}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-green-400 font-bold">#{player.rank}</span>
                              {player.tier && (
                                <span className="text-xs text-gray-400 ml-2">Tier {player.tier}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* API Configuration Info */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-100">API Configuration</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Base URL:</span>
              <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded font-mono">
                https://api.fantasypros.com/public/v2/json
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">API Key Location:</span>
              <code className="text-green-400 bg-gray-900 px-2 py-1 rounded font-mono">
                .env.local → FANTASYPROS_API_KEY
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Auth Header:</span>
              <code className="text-yellow-400 bg-gray-900 px-2 py-1 rounded font-mono">
                x-api-key: YOUR_API_KEY
              </code>
            </div>
          </div>
        </div>

        {/* Troubleshooting Steps */}
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 text-yellow-300">Troubleshooting Steps</h3>
          <ol className="space-y-2 text-sm text-yellow-200">
            <li>1. Verify your API key is set in <code className="bg-gray-800 px-1 rounded">.env.local</code></li>
            <li>2. Check that the API key format is correct (no extra spaces or quotes)</li>
            <li>3. Ensure you're using the correct endpoint path: <code className="bg-gray-800 px-1 rounded">/nfl/2025/consensus-rankings</code></li>
            <li>4. The API key should be sent in the <code className="bg-gray-800 px-1 rounded">x-api-key</code> header</li>
            <li>5. Try testing with curl to isolate the issue:</li>
          </ol>
          <pre className="mt-3 p-3 bg-gray-800 rounded text-xs overflow-x-auto">
{`curl -H "x-api-key: YOUR_API_KEY" \\
     -H "Accept: application/json" \\
     "https://api.fantasypros.com/public/v2/json/nfl/2025/consensus-rankings?position=ALL&scoring=PPR"`}
          </pre>
        </div>
      </div>
    </div>
  );
}