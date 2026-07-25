// Mystery box (gacha): cheaper way to get skins, at the cost of randomness.
// Duplicates convert to shards, which can be crafted into a chosen skin.
import { SKINS, RARITY, getSkin, rarityOf } from './skins';

export const BOX_PRICE = 200;

export const CRAFT_COST = { common: 60, rare: 160, epic: 360, legendary: 800 };

export function craftCost(id) {
  return CRAFT_COST[rarityOf(id)] || 999;
}

// Weighted rarity pick. r in [0,1).
export function pickRarity(r) {
  const entries = Object.entries(RARITY);
  const total = entries.reduce((a, [, v]) => a + v.weight, 0);
  let x = r * total;
  for (const [k, v] of entries) {
    if (x < v.weight) return k;
    x -= v.weight;
  }
  return 'common';
}

// Open a box. ownedIds = array of owned skin ids. rng returns [0,1).
export function openBox(ownedIds, rng = Math.random) {
  const rarity = pickRarity(rng());
  const pool = SKINS.filter((s) => s.rarity === rarity && s.id !== 'classic');
  const list = pool.length ? pool : SKINS.filter((s) => s.id !== 'classic');
  const skin = list[Math.floor(rng() * list.length)] || list[0];
  const duplicate = ownedIds.includes(skin.id);
  const shards = duplicate ? RARITY[skin.rarity].shards : 0;
  return { skinId: skin.id, rarity: skin.rarity, duplicate, shards, skin };
}
