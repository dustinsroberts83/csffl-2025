// components/PlayerCard.js
import { useState, useEffect } from 'react';
import { User, TrendingUp, Activity, AlertCircle, Calendar } from 'lucide-react';

export default function PlayerCard({ player, sleeperPlayers, show, position }) {
  const [sleeperData, setSleeperData] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (player && sleeperPlayers && show) {
      // Find matching Sleeper player for additional data
      const convertedName = player.name.includes(',') 
        ? player.name.split(',').map(p => p.trim()).reverse().join(' ')
        : player.name;
      
      const match = Object.values(sleeperPlayers).find(sp => {
        if (!sp || !sp.first_name || !sp.last_name) return false;
        const sleeperName = `${sp.first_name} ${sp.last_name}`.toLowerCase();
        return sleeperName === convertedName.toLowerCase();
      });
      
      setSleeperData(match);
    }
  }, [player, sleeperPlayers, show]);

  if (!show || !player) return null;

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

  const getPositionColor = (pos) => positionColors[pos] || 'bg-gray-100 text-gray-800 border-gray-300';

  // Calculate dynasty outlook based on age and position
  const getDynastyOutlook = () => {
    const age = player.age || sleeperData?.age || 25;
    const position = player.position;
    
    const primes = {
      QB: { start: 26, peak: 29, end: 32 },
      RB: { start: 22, peak: 24, end: 27 },
      WR: { start: 24, peak: 26, end: 29 },
      TE: { start: 25, peak: 27, end: 30 }
    };
    
    const prime = primes[position];
    if (!prime) return { status: 'Unknown', color: 'text-gray-600' };
    
    if (age < prime.start) return { status: 'Pre-Prime', color: 'text-green-600' };
    if (age >= prime.start && age <= prime.end) return { status: 'Prime Years', color: 'text-blue-600' };
    return { status: 'Post-Prime', color: 'text-red-600' };
  };

  const dynastyOutlook = getDynastyOutlook();

  return (
    <div 
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%) translateY(-10px)'
      }}
    >
      <div className="flex items-start gap-3">
        {/* Player Image */}
        <div className="flex-shrink-0">
          {sleeperData?.player_id && !imageError ? (
            <img
              src={`https://sleepercdn.com/content/nfl/players/${sleeperData.player_id}.jpg`}
              alt={player.name}
              className="w-20 h-20 rounded-lg object-cover"
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
            <span className={`px-2 py-0.5 text-xs rounded ${getPositionColor(player.position)}`}>
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