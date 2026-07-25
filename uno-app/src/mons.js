// Creatures for the secret catching mini-game (original designs, emoji-based).
export const MONS = [
  { id: 'flamby', name: 'Flamby', emoji: '🦎', type: 'Feu', hp: 22, atk: 6, rarity: 'common', catch: 0.5, color: '#ff6a3d' },
  { id: 'aqualo', name: 'Aqualo', emoji: '🐟', type: 'Eau', hp: 24, atk: 5, rarity: 'common', catch: 0.5, color: '#3fa9ff' },
  { id: 'feuillu', name: 'Feuillu', emoji: '🌱', type: 'Plante', hp: 23, atk: 5, rarity: 'common', catch: 0.5, color: '#4bd36a' },
  { id: 'piouic', name: 'Piouic', emoji: '🐤', type: 'Vol', hp: 19, atk: 6, rarity: 'common', catch: 0.5, color: '#ffd45a' },
  { id: 'volttik', name: 'Volttik', emoji: '⚡', type: 'Élec', hp: 20, atk: 7, rarity: 'rare', catch: 0.35, color: '#ffd23f' },
  { id: 'roko', name: 'Roko', emoji: '🪨', type: 'Roche', hp: 30, atk: 4, rarity: 'rare', catch: 0.35, color: '#9a8062' },
  { id: 'spectra', name: 'Spectra', emoji: '👻', type: 'Spectre', hp: 22, atk: 8, rarity: 'epic', catch: 0.2, color: '#a98bff' },
  { id: 'drakky', name: 'Drakky', emoji: '🐉', type: 'Dragon', hp: 34, atk: 9, rarity: 'legendary', catch: 0.1, color: '#37c97a' },
  { id: 'lumina', name: 'Lumina', emoji: '✨', type: 'Fée', hp: 26, atk: 7, rarity: 'legendary', catch: 0.1, color: '#ff9ce0' },
];

export function getMon(id) {
  return MONS.find((m) => m.id === id) || MONS[0];
}
