// components/DebugData.js

export default function DebugData({ rosters, players }) {
  if (!rosters || rosters.length === 0) {
    return <div className="text-gray-600">No roster data available</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Debug Data - First Roster</h2>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="font-bold text-gray-800 mb-2">First Roster Full Structure:</h3>
        <pre className="bg-white p-4 rounded border border-gray-300 overflow-x-auto text-xs text-gray-800">
          {JSON.stringify(rosters[0], null, 2)}
        </pre>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="font-bold text-gray-800 mb-2">First Player Object:</h3>
        <pre className="bg-white p-4 rounded border border-gray-300 overflow-x-auto text-xs text-gray-800">
          {rosters[0].player && JSON.stringify(
            Array.isArray(rosters[0].player) ? rosters[0].player[0] : rosters[0].player, 
            null, 
            2
          )}
        </pre>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="font-bold text-gray-800 mb-2">Sample Player Details:</h3>
        <pre className="bg-white p-4 rounded border border-gray-300 overflow-x-auto text-xs text-gray-800">
          {players && JSON.stringify(players.slice(0, 5), null, 2)}
        </pre>
      </div>
    </div>
  );
}