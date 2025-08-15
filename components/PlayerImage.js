import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

// Cache for Sleeper player data
let sleeperPlayersCache = null;
let cachePromise = null;

export default function PlayerImage({ player, size = 40, className = "" }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [sleeperPlayers, setSleeperPlayers] = useState(null);
  
  // Fetch Sleeper players data (with caching)
  useEffect(() => {
    const fetchSleeperPlayers = async () => {
      // If we already have the data cached, use it
      if (sleeperPlayersCache) {
        setSleeperPlayers(sleeperPlayersCache);
        return;
      }
      
      // If a fetch is already in progress, wait for it
      if (cachePromise) {
        try {
          const data = await cachePromise;
          setSleeperPlayers(data);
        } catch (error) {
          console.error('Error loading Sleeper players:', error);
        }
        return;
      }
      
      // Start a new fetch
      cachePromise = fetch('https://api.sleeper.app/v1/players/nfl')
        .then(res => res.json())
        .then(data => {
          sleeperPlayersCache = data;
          return data;
        })
        .catch(error => {
          console.error('Error fetching Sleeper players:', error);
          cachePromise = null;
          throw error;
        });
      
      try {
        const data = await cachePromise;
        setSleeperPlayers(data);
      } catch (error) {
        // Fallback to initials on error
      }
    };
    
    fetchSleeperPlayers();
  }, []);
  
  // Find matching player when Sleeper data loads
  useEffect(() => {
    if (!sleeperPlayers || !player.name) return;
    
    // Normalize player name for matching
    const normalizedName = player.name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+jr$/i, '')
      .replace(/\s+sr$/i, '')
      .replace(/\s+iii$/i, '')
      .replace(/\s+ii$/i, '')
      .replace(/\s+iv$/i, '')
      .trim();
    
    // Search for player in Sleeper data
    let matchedPlayer = null;
    
    // Try exact match first
    Object.values(sleeperPlayers).forEach(sleeperPlayer => {
      if (!sleeperPlayer || typeof sleeperPlayer !== 'object') return;
      
      const sleeperFullName = `${sleeperPlayer.first_name || ''} ${sleeperPlayer.last_name || ''}`.toLowerCase().trim();
      const sleeperSearchName = (sleeperPlayer.search_full_name || '').toLowerCase();
      
      if (sleeperFullName === normalizedName || sleeperSearchName === normalizedName) {
        matchedPlayer = sleeperPlayer;
      }
    });
    
    // If no exact match, try last name + first initial
    if (!matchedPlayer && player.name.includes(',')) {
      const parts = player.name.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const searchName = `${parts[1]} ${parts[0]}`.toLowerCase();
        Object.values(sleeperPlayers).forEach(sleeperPlayer => {
          if (!sleeperPlayer || typeof sleeperPlayer !== 'object') return;
          const sleeperFullName = `${sleeperPlayer.first_name || ''} ${sleeperPlayer.last_name || ''}`.toLowerCase().trim();
          if (sleeperFullName === searchName) {
            matchedPlayer = sleeperPlayer;
          }
        });
      }
    }
    
    if (matchedPlayer && matchedPlayer.player_id) {
      // Sleeper serves images from this URL pattern
      const sleeperImageUrl = `https://sleepercdn.com/content/nfl/players/thumb/${matchedPlayer.player_id}.jpg`;
      setImageUrl(sleeperImageUrl);
    }
  }, [sleeperPlayers, player.name]);
  
  const handleImageError = () => {
    setImageError(true);
    setImageUrl(null);
  };
  
  const containerClasses = `flex-shrink-0 rounded-full bg-gray-200 overflow-hidden ${className}`;
  const containerStyle = { width: `${size}px`, height: `${size}px` };
  
  // Generate initials from player name
  const getInitials = (name) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  // Generate a color based on position
  const getPositionColor = (position) => {
    const colors = {
      QB: 'bg-red-500',
      RB: 'bg-green-500',
      WR: 'bg-blue-500',
      TE: 'bg-orange-500',
      PK: 'bg-purple-500',
      DEF: 'bg-gray-500',
      DT: 'bg-indigo-500',
      DE: 'bg-indigo-500',
      LB: 'bg-yellow-500',
      CB: 'bg-teal-500',
      S: 'bg-pink-500'
    };
    return colors[position] || 'bg-gray-500';
  };
  
  // Show image if we have a URL and no error
  if (imageUrl && !imageError) {
    return (
      <div className={containerClasses} style={containerStyle}>
        <img
          src={imageUrl}
          alt={player.name}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      </div>
    );
  }
  
  // Fallback to initials
  return (
    <div className={containerClasses} style={containerStyle}>
      <div className={`w-full h-full flex items-center justify-center text-white font-semibold ${getPositionColor(player.position)}`}>
        {getInitials(player.name)}
      </div>
    </div>
  );
}