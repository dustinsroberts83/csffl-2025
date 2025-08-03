// components/LeagueInfo.js
import { Users, Trophy, DollarSign } from 'lucide-react';

export default function LeagueInfo({ league }) {
  if (!league) return <div className="text-gray-600">No league data available</div>;

  const { name, franchises, starters, rosterSize } = league;
  const salaryCapInfo = league.salaryCapAmount || league.usesSalaries;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">{name || 'League Information'}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center mb-2">
            <Users className="mr-2 text-blue-600" size={20} />
            <span className="font-semibold text-gray-800">Teams</span>
          </div>
          <p className="text-2xl text-gray-900">{franchises?.count || 'N/A'}</p>
        </div>
        {salaryCapInfo && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <div className="flex items-center mb-2">
              <DollarSign className="mr-2 text-green-600" size={20} />
              <span className="font-semibold text-gray-800">Salary Cap</span>
            </div>
            <p className="text-2xl text-gray-900">${salaryCapInfo}</p>
          </div>
        )}
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-center mb-2">
            <Trophy className="mr-2 text-purple-600" size={20} />
            <span className="font-semibold text-gray-800">Roster Size</span>
          </div>
          <p className="text-2xl text-gray-900">{rosterSize || 'N/A'}</p>
        </div>
      </div>
      
      {starters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2 text-gray-800">Starting Lineup</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(starters.position).map(([pos, data]) => {
              // Handle both formats: simple count or {limit, name} object
              const count = typeof data === 'object' ? data.limit : data;
              const displayName = typeof data === 'object' ? data.name : pos;
              
              return (
                <span key={pos} className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border border-gray-300">
                  {count} {displayName}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}