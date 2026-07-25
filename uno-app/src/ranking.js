// ELO-style ranking with visible tiers.
export const RANKS = [
  { min: 0, name: 'Bois', icon: '🪵', color: '#8a5a2b' },
  { min: 900, name: 'Bronze', icon: '🥉', color: '#cd7f32' },
  { min: 1050, name: 'Argent', icon: '🥈', color: '#c0c0c0' },
  { min: 1200, name: 'Or', icon: '🥇', color: '#ffd23f' },
  { min: 1400, name: 'Platine', icon: '💠', color: '#3fe0d0' },
  { min: 1600, name: 'Diamant', icon: '💎', color: '#5ad1ff' },
  { min: 1850, name: 'Maître', icon: '🔱', color: '#b45cff' },
  { min: 2100, name: 'Champion', icon: '🏆', color: '#ff5e5e' },
];

export const START_RATING = 1000;

export function rankFromRating(r) {
  let cur = RANKS[0];
  for (const t of RANKS) if (r >= t.min) cur = t;
  return cur;
}

// Rating change after a game. avgOpp = average opponent rating, nOpp = count.
export function ratingDelta(won, myRating, avgOpp, nOpp) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (avgOpp - myRating) / 400));
  let d = K * ((won ? 1 : 0) - expected);
  d *= Math.sqrt(Math.max(1, nOpp));
  const rounded = Math.round(d);
  // never lose rating on a win, never gain on a loss
  if (won) return Math.max(5, rounded);
  return Math.min(-3, rounded);
}
