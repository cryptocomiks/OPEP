// Four clans. Picking one seeds a signature "power card" into your starting hand
// and shows your banner on your player chip.
export const CLANS = [
  { id: 'guerrier', name: 'Guerrier', icon: '🛡️', color: '#c0392b', card: 'shield', desc: 'Bouclier : bloque les attaques pendant 5 tours.' },
  { id: 'ensorceleur', name: 'Ensorceleur', icon: '🔮', color: '#8e44ad', card: 'spell', desc: 'Sort : tous les adversaires piochent 1 carte.' },
  { id: 'voleur', name: 'Voleur', icon: '🗡️', color: '#16a085', card: 'steal', desc: 'Vol : prends une carte à un joueur ciblé.' },
  { id: 'oracle', name: 'Oracle', icon: '🌟', color: '#2980b9', card: 'heal', desc: 'Purge : jette tes 2 cartes les plus lourdes.' },
];

export function getClan(id) {
  return CLANS.find((c) => c.id === id) || null;
}

export function clanCardValue(clanId) {
  const c = getClan(clanId);
  return c ? c.card : null;
}
