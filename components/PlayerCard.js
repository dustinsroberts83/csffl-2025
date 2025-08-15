// components/PlayerCard.js
import { X, Calendar, Trophy, TrendingUp, Activity, DollarSign } from 'lucide-react';

const positionColors = {
  QB: 'bg-red-100 text-red-800',
  RB: 'bg-green-100 text-green-800',
  WR: 'bg-blue-100 text-blue-800',
  TE: 'bg-orange-100 text-orange-800',
  DT: 'bg-indigo-100 text-indigo-800',
  DE: 'bg-indigo-100 text-indigo-800',
  LB: 'bg-yellow-100 text-yellow-800',
  CB: 'bg-teal-100 text-teal-800',
  S: 'bg-pink-100 text-pink-800'
};

export default function PlayerCard({ player, onClose, mflRank }) {
  if (!player) return null;

  // Construct image URL based on player ID
  const imageUrl = `https://www.myfantasyleague.com/${new Date().getFullYear()}/player_photo.jpg?PLAYER_ID=${player.mfl_id}`;
  
  // Calculate years in league if draft year exists
  const yearsInLeague = player.draft_year ? 
    new Date().getFullYear() - parseInt(player.draft_year) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 rounded-t-lg">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-300 hover:text-white"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-start gap-4">
            {/* Player Image */}
            <div className="flex-shrink-0">
              <img
                src={imageUrl}
                alt={player.name}
                className="w-24 h-24 rounded-lg object-cover bg-gray-700"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/96x96?text=No+Photo';
                }}
              />
            </div>
            
            {/* Player Info */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{player.name}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${positionColors[player.position] || 'bg-gray-200 text-gray-800'}`}>
                  {player.position}
                </span>
                <span className="text-gray-300">{player.team || 'Free Agent'}</span>
                {player.age && <span className="text-gray-300">Age {player.age}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Rankings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">FantasyPros ECR</span>
              </div>
              <div className="text-2xl font-bold text-purple-800">
                {player.fantasypros_rank ? `#${player.fantasypros_rank}` : 'N/A'}
              </div>
              {player.fantasypros_tier && (
                <div className="text-sm text-purple-600 mt-1">Tier {player.fantasypros_tier}</div>
              )}
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Trophy size={18} />
                <span className="text-sm font-medium">MFL Expert Rank</span>
              </div>
              <div className="text-2xl font-bold text-blue-800">
                {mflRank ? `#${mflRank}` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Draft Info */}
          {player.draft_year && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar size={18} />
                <span className="text-sm font-medium">Draft Information</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Draft Year:</span>
                  <span className="ml-2 font-medium">{player.draft_year}</span>
                </div>
                {player.draft_round && (
                  <div>
                    <span className="text-gray-500">Round:</span>
                    <span className="ml-2 font-medium">{player.draft_round}.{player.draft_pick || '??'}</span>
                  </div>
                )}
                {yearsInLeague !== null && (
                  <div>
                    <span className="text-gray-500">Years in League:</span>
                    <span className="ml-2 font-medium">{yearsInLeague}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Injury Status */}
          {player.injury_status && (
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Activity size={18} />
                <span className="text-sm font-medium">Injury Status</span>
              </div>
              <div className="text-red-800">{player.injury_status}</div>
            </div>
          )}

          {/* Additional Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {player.bye_week && (
                <div>
                  <span className="text-gray-500">Bye Week:</span>
                  <span className="ml-2 font-medium">{player.bye_week}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Status:</span>
                <span className="ml-2 font-medium text-green-600">Available</span>
              </div>
            </div>
          </div>

          {/* Dynasty Value Indicators */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Dynasty Considerations</h3>
            <div className="space-y-2 text-sm">
              {player.age && player.position && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Age Value:</span>
                  <span className={`font-medium ${
                    (player.position === 'RB' && player.age <= 26) ||
                    (player.position === 'WR' && player.age <= 28) ||
                    (player.position === 'QB' && player.age <= 32) ||
                    (player.position === 'TE' && player.age <= 30)
                      ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {(player.position === 'RB' && player.age <= 26) ||
                     (player.position === 'WR' && player.age <= 28) ||
                     (player.position === 'QB' && player.age <= 32) ||
                     (player.position === 'TE' && player.age <= 30)
                      ? 'Prime Years' : 'Declining Value'}
                  </span>
                </div>
              )}
              {player.draft_round && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Draft Capital:</span>
                  <span className={`font-medium ${
                    parseInt(player.draft_round) <= 2 ? 'text-green-600' :
                    parseInt(player.draft_round) <= 4 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {parseInt(player.draft_round) <= 2 ? 'High' :
                     parseInt(player.draft_round) <= 4 ? 'Medium' : 'Low'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}