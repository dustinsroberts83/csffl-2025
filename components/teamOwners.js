// components/teamOwners.js

export const teamOwnerMap = {
  "Unidick Sparkle": "Brian",
  "Bet The NRFI": "Denver",
  "Cum": "Greg",
  "POLK HIGH PANTHERS": "Eric",
  "FC Imagine A Life Where Me & Lil Dylan Are Married": "Cory",
  "June 5, 1989 Beijing China": "Chris",
  "Young Abels' Sexploitation of a League of Old Fuks - Especially Lil Dylan": "Abel",
  "Team Bring It": "Nick",
  "Denver's Leather Daddy": "Omar",
  "2": "Cote",
  "Face Full of Bumper": "Dylan",
  "D'Justin": "Dustin"
};

// Helper function to get owner name from team name
export function getOwnerName(teamName) {
  return teamOwnerMap[teamName] || null;
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