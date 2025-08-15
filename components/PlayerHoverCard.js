// components/PlayerHoverCard.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Trophy, TrendingUp, Activity, Info } from 'lucide-react';
import PlayerImage from './PlayerImage';

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

function HoverCardContent({ player, mflRank, position }) {
  if (!player) return null;
  
  // Calculate years in league if draft year exists
  const yearsInLeague = player.draft_year ? 
    new Date().getFullYear() - parseInt(player.draft_year) : null;

  return (
    <div 
      className="fixed z-50 w-80 bg-white rounded-lg shadow-2xl border border-gray-200"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 rounded-t-lg">
        <div className="flex items-start gap-3">
          {/* Player Image */}
          <PlayerImage player={player} size={64} className="rounded-lg" />
          
          {/* Player Info */}
          <div className="flex-1">
            <h3 className="font-bold text-lg leading-tight">{player.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${positionColors[player.position] || 'bg-gray-200 text-gray-800'}`}>
                {player.position}
              </span>
              <span className="text-xs text-gray-300">{player.team || 'FA'}</span>
              {player.age && <span className="text-xs text-gray-300">Age {player.age}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Rankings */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-purple-50 rounded p-2">
            <div className="flex items-center gap-1 text-purple-600">
              <TrendingUp size={14} />
              <span className="text-xs font-medium">FP ECR</span>
            </div>
            <div className="text-lg font-bold text-purple-800">
              {player.fantasypros_rank ? `#${player.fantasypros_rank}` : 'N/A'}
              {player.fantasypros_tier && (
                <span className="text-xs text-purple-600 ml-1">T{player.fantasypros_tier}</span>
              )}
            </div>
          </div>
          
          <div className="bg-blue-50 rounded p-2">
            <div className="flex items-center gap-1 text-blue-600">
              <Trophy size={14} />
              <span className="text-xs font-medium">MFL</span>
            </div>
            <div className="text-lg font-bold text-blue-800">
              {mflRank ? `#${mflRank}` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Injury Status */}
        {player.injury_status && (
          <div className="bg-red-50 rounded p-2">
            <div className="flex items-center gap-1 text-red-600">
              <Activity size={14} />
              <span className="text-xs font-medium">Injury</span>
            </div>
            <div className="text-xs text-red-800">{player.injury_status}</div>
          </div>
        )}

        {/* Quick Info */}
        <div className="border-t pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {player.bye_week && (
              <div className="flex justify-between">
                <span className="text-gray-500">Bye:</span>
                <span className="font-medium">Week {player.bye_week}</span>
              </div>
            )}
            {player.draft_year && player.draft_round && (
              <div className="flex justify-between">
                <span className="text-gray-500">Draft:</span>
                <span className="font-medium">{player.draft_round}.{player.draft_pick || '??'}</span>
              </div>
            )}
            {yearsInLeague !== null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Exp:</span>
                <span className="font-medium">{yearsInLeague} yrs</span>
              </div>
            )}
            {player.age && player.position && (
              <div className="flex justify-between">
                <span className="text-gray-500">Value:</span>
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
                    ? 'Prime' : 'Declining'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerHoverCard({ player, mflRank, children, onPlayerClick }) {
  const [showCard, setShowCard] = useState(false);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });
  const hoverTimeout = useRef(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
      setMounted(false);
    };
  }, []);

  const calculatePosition = (e) => {
    const cardWidth = 320; // w-80 = 20rem = 320px
    const cardHeight = 300; // Approximate height
    const buffer = 20;
    
    let left = e.clientX + buffer;
    let top = e.clientY - cardHeight / 2; // Center vertically on mouse
    
    // Check if card would go off right edge
    if (left + cardWidth > window.innerWidth) {
      left = e.clientX - cardWidth - buffer;
    }
    
    // Check if card would go off bottom
    if (top + cardHeight > window.innerHeight) {
      top = window.innerHeight - cardHeight - buffer;
    }
    
    // Check if card would go off top
    if (top < buffer) {
      top = buffer;
    }
    
    setCardPosition({ top, left });
  };

  const handleMouseMove = (e) => {
    if (showCard) {
      calculatePosition(e);
    }
  };

  const handleMouseEnter = (e) => {
    calculatePosition(e);
    hoverTimeout.current = setTimeout(() => {
      setShowCard(true);
    }, 500); // 500ms delay before showing
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    setShowCard(false);
  };

  const handleClick = () => {
    if (onPlayerClick) {
      onPlayerClick();
    }
  };

  if (!player) return children;

  // Clone the children and add event handlers
  const childrenWithProps = React.cloneElement(children, {
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
    ref: triggerRef
  });

  return (
    <>
      {childrenWithProps}
      {mounted && showCard && ReactDOM.createPortal(
        <HoverCardContent player={player} mflRank={mflRank} position={cardPosition} />,
        document.body
      )}
    </>
  );
}