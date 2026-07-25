// Player character avatars ("sprites"). Emoji-based for zero-asset simplicity.
export const CHARACTERS = [
  { id: 'kid', name: 'Gamin', emoji: '🧒', color: '#2277CC', rarity: 'common' },
  { id: 'girl', name: 'Exploratrice', emoji: '👧', color: '#E4342B', rarity: 'common' },
  { id: 'cap', name: 'Casquette', emoji: '🧢', color: '#33A047', rarity: 'common' },
  { id: 'ninja', name: 'Ninja', emoji: '🥷', color: '#444a6e', rarity: 'rare' },
  { id: 'wizard', name: 'Mage', emoji: '🧙', color: '#8e44ad', rarity: 'rare' },
  { id: 'robot', name: 'Robot', emoji: '🤖', color: '#16a085', rarity: 'rare' },
  { id: 'alien', name: 'Alien', emoji: '👽', color: '#7be06a', rarity: 'epic' },
  { id: 'vamp', name: 'Vampire', emoji: '🧛', color: '#7a1020', rarity: 'epic' },
  { id: 'knight', name: 'Chevalier', emoji: '🦸', color: '#2980b9', rarity: 'epic' },
  { id: 'king', name: 'Roi', emoji: '🤴', color: '#ffd23f', rarity: 'legendary' },
  { id: 'ghost', name: 'Fantôme', emoji: '👻', color: '#c9d0ff', rarity: 'legendary' },
  { id: 'dragon', name: 'Dragon', emoji: '🐲', color: '#27ae60', rarity: 'legendary' },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

// Stable fallback character from a player id (so everyone has a sprite even without one set).
export function charFromId(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CHARACTERS[h % 3]; // only the 3 free ones as fallback
}

export const CHAR_BOX_PRICE = 250;

const CH_WEIGHT = { common: 55, rare: 28, epic: 13, legendary: 4 };

// Roll a random character from a box (weighted by rarity). rng returns [0,1).
export function rollCharacter(rng = Math.random) {
  const total = CHARACTERS.reduce((a, c) => a + (CH_WEIGHT[c.rarity] || 1), 0);
  let x = rng() * total;
  for (const c of CHARACTERS) {
    const w = CH_WEIGHT[c.rarity] || 1;
    if (x < w) return c;
    x -= w;
  }
  return CHARACTERS[0];
}
