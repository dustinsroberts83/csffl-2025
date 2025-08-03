// components/Standings.js
import { Trophy } from 'lucide-react';

export default function Standings({ standings, rosters }) {
  if (!standings || standings.length === 0) {
    return <div className="text-gray-600">No standings data available</div>;
  }

  // Sort by wins, then by points
  const sortedStandings = [...standings].sort((a, b) => {
    const winsA = parseFloat(a.w || 0);
    const winsB = parseFloat(b.w || 0);
    if (winsA !== winsB) return winsB - winsA;
    return parseFloat(b.pf || 0) - parseFloat(a.pf || 0);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">League Standings</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-b border-gray-200 p-3 text-left text-gray-700">Rank</th>
              <th className="border-b border-gray-200 p-3 text-left text-gray-700">Team</th>
              <th className="border-b border-gray-200 p-3 text-center text-gray-700">Record</th>
              <th className="border-b border-gray-200 p-3 text-right text-gray-700">PF</th>
              <th className="border-b border-gray-200 p-3 text-right text-gray-700">PA</th>
              {standings[0]?.streak && (
                <th className="border-b border-gray-200 p-3 text-center text-gray-700">Streak</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((team, index) => {
              const franchise = rosters?.find(r => r.id === team.id);
              const wins = parseFloat(team.w || 0);
              const losses = parseFloat(team.l || 0);
              const ties = parseFloat(team.t || 0);
              
              return (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="border-b border-gray-200 p-3 text-gray-900">
                    <div className="flex items-center">
                      {index === 0 && <Trophy size={16} className="mr-1 text-yellow-500" />}
                      {index + 1}
                    </div>
                  </td>
                  <td className="border-b border-gray-200 p-3 font-medium text-gray-900">
                    {franchise?.name || `Team ${team.id}`}
                  </td>
                  <td className="border-b border-gray-200 p-3 text-center text-gray-800">
                    {wins}-{losses}{ties > 0 && `-${ties}`}
                  </td>
                  <td className="border-b border-gray-200 p-3 text-right text-gray-800">{parseFloat(team.pf || 0).toFixed(2)}</td>
                  <td className="border-b border-gray-200 p-3 text-right text-gray-800">{parseFloat(team.pa || 0).toFixed(2)}</td>
                  {team.streak && (
                    <td className="border-b border-gray-200 p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        team.streak.includes('W') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {team.streak}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}