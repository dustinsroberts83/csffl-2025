// components/teamOwners.js

export const teamOwnerMap = {
  "Unidick Sparkle": "Brian",
  "Suck my Cap Space": "Denver",
  "cum ...in Lil Dylan.": "Greg",
  "HONKY LIPS": "Eric",
  "FC Imagine A Life Where Me & Lil Dylan Are Married": "Cory",
  "June 5, 1989 Beijing China": "Chris",
  "Young Abels' Sexploitation of a League of Old Fuks - Especially Lil Dylan": "Abel",
  "Team Bring It": "Nick",
  "Denver's Leather Daddy": "Omar",
  "2": "Cote",
  "Face Full of Bumper": "Dylan",
  "D'Justin": "Dustin",  // Straight apostrophe
  "D'Justin": "Dustin"   // Curly apostrophe - add both versions
};

// Function to normalize apostrophes
function normalizeApostrophes(text) {
  if (!text) return text;
  // Replace all types of apostrophes with a standard one
  return text.replace(/[''´`]/g, "'");
}

// Create normalized map for better matching
const normalizedTeamMap = {};
Object.entries(teamOwnerMap).forEach(([team, owner]) => {
  // Create multiple normalized versions for matching
  const normalized = team.toLowerCase().trim();
  const noSpaces = normalized.replace(/\s+/g, '');
  const singleSpaces = team.trim().replace(/\s+/g, ' ');
  const normalizedApostrophes = normalizeApostrophes(team);
  const normalizedLower = normalizeApostrophes(normalized);
  
  normalizedTeamMap[normalized] = owner;
  normalizedTeamMap[noSpaces] = owner;
  normalizedTeamMap[singleSpaces] = owner;
  normalizedTeamMap[normalizedApostrophes] = owner;
  normalizedTeamMap[normalizedLower] = owner;
});

// Robust helper function with multiple matching strategies
export function getOwnerName(teamName) {
  if (!teamName) return null;
  
  // Strategy 1: Exact match
  if (teamOwnerMap[teamName]) {
    return teamOwnerMap[teamName];
  }
  
  // Strategy 2: Normalize apostrophes and try again
  const normalizedApostrophes = normalizeApostrophes(teamName);
  if (teamOwnerMap[normalizedApostrophes]) {
    return teamOwnerMap[normalizedApostrophes];
  }
  
  // Strategy 3: Trim whitespace
  const trimmed = teamName.trim();
  if (teamOwnerMap[trimmed]) {
    return teamOwnerMap[trimmed];
  }
  
  // Strategy 4: Normalize spaces (multiple spaces to single)
  const normalizedSpaces = teamName.trim().replace(/\s+/g, ' ');
  if (teamOwnerMap[normalizedSpaces]) {
    return teamOwnerMap[normalizedSpaces];
  }
  
  // Strategy 5: Case-insensitive match with normalized apostrophes
  const lower = normalizeApostrophes(teamName.toLowerCase().trim());
  if (normalizedTeamMap[lower]) {
    return normalizedTeamMap[lower];
  }
  
  // Strategy 6: Remove all spaces and try
  const noSpaces = lower.replace(/\s+/g, '');
  if (normalizedTeamMap[noSpaces]) {
    return normalizedTeamMap[noSpaces];
  }
  
  // Log unmapped team for debugging
  console.warn(`No owner mapping found for team: "${teamName}"`);
  console.warn(`Tried variations: "${trimmed}", "${normalizedSpaces}", "${lower}", "${normalizedApostrophes}"`);
  
  return null;
}

// Reverse mapping to get team name from owner name
export const ownerTeamMap = Object.entries(teamOwnerMap).reduce((acc, [team, owner]) => {
  acc[owner] = team;
  return acc;
}, {});

// Helper function to get team name from owner name
export function getTeamName(ownerName) {
  return ownerTeamMap[ownerName] || null;
}