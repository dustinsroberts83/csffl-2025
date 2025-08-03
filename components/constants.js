// utils/constants.js

export const positionColors = {
  QB: 'bg-red-100 text-red-800 border-red-300',
  RB: 'bg-green-100 text-green-800 border-green-300',
  WR: 'bg-blue-100 text-blue-800 border-blue-300',
  TE: 'bg-orange-100 text-orange-800 border-orange-300',
  PK: 'bg-purple-100 text-purple-800 border-purple-300',
  Def: 'bg-gray-100 text-gray-800 border-gray-300',
  DEF: 'bg-gray-100 text-gray-800 border-gray-300',
  DT: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  DE: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  LB: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CB: 'bg-teal-100 text-teal-800 border-teal-300',
  S: 'bg-pink-100 text-pink-800 border-pink-300'
};

export const getPositionColor = (position) => {
  return positionColors[position] || 'bg-gray-100 text-gray-800 border-gray-300';
};

export const positionOrder = ['QB', 'RB', 'WR', 'TE', 'PK', 'DEF', 'DT', 'DE', 'LB', 'CB', 'S'];