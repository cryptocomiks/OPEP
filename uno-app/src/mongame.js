// Pure logic for the secret overworld/catching mini-game in Lavenvyl.
import { MONS } from './mons';

// Legend: T tree(wall) . path g tallgrass(encounter) w water(wall) B building(wall) S shop(interact)
const RAW = [
  'TTTTTTTTTTTT',
  'T..gg.....BT',
  'T..gg....BST',
  'T........B.T',
  'T..wwww....T',
  'T..wwww..ggT',
  'T........ggT',
  'Tgg......ggT',
  'Tgg....TT..T',
  'T..........T',
  'TTTTTTTTTTTT',
];
const LEGEND = { T: 1, '.': 0, g: 2, w: 3, B: 4, S: 5 };

export const MAP = RAW.map((r) => r.split('').map((ch) => (LEGEND[ch] != null ? LEGEND[ch] : 0)));
export const MAP_H = MAP.length;
export const MAP_W = MAP[0].length;
export const START = { x: 5, y: 9 };

export function tileAt(x, y) {
  if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) return 1;
  return MAP[y][x];
}
export const isWalkable = (t) => t === 0 || t === 2;
export const isGrass = (t) => t === 2;
export const isShop = (t) => t === 5;

export function encounter(rng) {
  return rng() < 0.24;
}

const RWEIGHT = { common: 55, rare: 30, epic: 12, legendary: 3 };

export function pickWild(rng, level = 1) {
  const total = MONS.reduce((a, m) => a + (RWEIGHT[m.rarity] || 1), 0);
  let x = rng() * total;
  let chosen = MONS[0];
  for (const m of MONS) {
    const w = RWEIGHT[m.rarity] || 1;
    if (x < w) { chosen = m; break; }
    x -= w;
  }
  const lvl = 1 + Math.floor(rng() * 4) + level;
  const hp = chosen.hp + (lvl - 1) * 3;
  return { mon: chosen, level: lvl, maxHp: hp, hp };
}

export function damage(atk, rng) {
  return Math.max(1, Math.round(atk * (0.8 + 0.5 * rng())));
}

// ballBonus: 1 normal, 1.5 super ball. wildHpFrac in [0,1].
export function catchChance(mon, wildHpFrac, ballBonus = 1) {
  return Math.min(0.95, Math.max(0.03, mon.catch * (1.6 - wildHpFrac) * ballBonus));
}
