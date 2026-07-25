// Card-back "sleeve" skins. Buyable directly or won from mystery boxes.
// rarity drives mystery-box odds; holo=true uses the slow rainbow shimmer.
export const RARITY = {
  common: { name: 'Commune', color: '#9aa4c8', weight: 58, shards: 15 },
  rare: { name: 'Rare', color: '#4aa3ff', weight: 26, shards: 40 },
  epic: { name: 'Épique', color: '#b45cff', weight: 12, shards: 90 },
  legendary: { name: 'Légendaire', color: '#ffb01a', weight: 4, shards: 200 },
};

export const SKINS = [
  { id: 'classic', name: 'Classique', price: 0, rarity: 'common', kind: 'classic', icon: '', accent: '#F5C518', colors: ['#141726', '#0b0e22'] },
  { id: 'ocean', name: 'Océan', price: 150, rarity: 'common', icon: '🌊', accent: '#5ad1ff', colors: ['#3fd0ff', '#1466c9', '#062f5e'] },
  { id: 'forest', name: 'Forêt', price: 150, rarity: 'common', icon: '🌿', accent: '#7be06a', colors: ['#79e06a', '#2f9b3a', '#0c3d18'] },
  { id: 'fire', name: 'Tornade de Feu', price: 350, rarity: 'rare', icon: '🔥', accent: '#ff7a1a', colors: ['#ffb020', '#ff3d00', '#7a0d00'] },
  { id: 'spark', name: 'Éclairs', price: 350, rarity: 'rare', icon: '⚡', accent: '#5ad1ff', colors: ['#8be9ff', '#1f6bff', '#04113f'] },
  { id: 'ice', name: 'Glace Éternelle', price: 400, rarity: 'rare', icon: '❄️', accent: '#bff3ff', colors: ['#e8fbff', '#7fd4ff', '#1f6f9e'] },
  { id: 'holo', name: 'Poké Holo', price: 650, rarity: 'epic', icon: '✨', accent: '#ffd23f', colors: ['#ff6ec7', '#7a5cff', '#31d0ff'], holo: true },
  { id: 'yugioh', name: 'Duel Antique', price: 700, rarity: 'epic', icon: '🔮', accent: '#c9a227', colors: ['#6b3fa0', '#3a1a5e', '#1b0b2e'] },
  { id: 'neon', name: 'Néon City', price: 700, rarity: 'epic', icon: '🟣', accent: '#ff4df0', colors: ['#ff4df0', '#7a1aff', '#0a0030'] },
  { id: 'galaxy', name: 'Galaxie', price: 1000, rarity: 'legendary', icon: '🌌', accent: '#c9a8ff', colors: ['#ff8ae0', '#6a5cff', '#0a0b3a'], holo: true },
  { id: 'gold', name: 'Or Massif', price: 1200, rarity: 'legendary', icon: '👑', accent: '#ffe08a', colors: ['#fff3b0', '#e6b800', '#6b4e00'] },
];

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export function rarityOf(id) {
  return getSkin(id).rarity || 'common';
}
