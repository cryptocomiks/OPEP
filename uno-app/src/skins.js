// Card-back "sleeve" skins buyable in the market.
// kind drives the visual in components/Card.js -> CardBack.
export const SKINS = [
  { id: 'classic', name: 'Classique', price: 0, kind: 'classic', icon: '', accent: '#F5C518', colors: ['#141726', '#0b0e22'] },
  { id: 'fire', name: 'Tornade de Feu', price: 350, kind: 'fire', icon: '🔥', accent: '#ff7a1a', colors: ['#ffb020', '#ff3d00', '#7a0d00'] },
  { id: 'spark', name: 'Éclairs', price: 450, kind: 'spark', icon: '⚡', accent: '#5ad1ff', colors: ['#8be9ff', '#1f6bff', '#04113f'] },
  { id: 'holo', name: 'Poké Holo', price: 600, kind: 'holo', icon: '✨', accent: '#ffd23f', colors: ['#ff6ec7', '#7a5cff', '#31d0ff'] },
  { id: 'yugioh', name: 'Duel Antique', price: 750, kind: 'yugioh', icon: '🔮', accent: '#c9a227', colors: ['#6b3fa0', '#3a1a5e', '#1b0b2e'] },
  { id: 'gold', name: 'Or Massif', price: 1200, kind: 'gold', icon: '👑', accent: '#ffe08a', colors: ['#fff3b0', '#e6b800', '#6b4e00'] },
];

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}
