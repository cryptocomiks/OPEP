// Season progression: XP, battle pass (free + premium), daily/weekly missions.
// One persisted blob; missions regenerate when the day/week key changes.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'uno_prog_v1';
export const XP_PER_TIER = 120;
export const MAX_TIER = 15;
export const PREMIUM_PRICE = 1500;

// reward = { cash?, shards?, box?, skin? }
export const PASS = [
  { tier: 1, free: { cash: 60 }, premium: { cash: 120 } },
  { tier: 2, free: { shards: 20 }, premium: { cash: 150 } },
  { tier: 3, free: { cash: 80 }, premium: { box: 1 } },
  { tier: 4, free: { cash: 90 }, premium: { shards: 60 } },
  { tier: 5, free: { box: 1 }, premium: { skin: 'ice' } },
  { tier: 6, free: { cash: 100 }, premium: { cash: 200 } },
  { tier: 7, free: { shards: 30 }, premium: { box: 1 } },
  { tier: 8, free: { cash: 120 }, premium: { shards: 90 } },
  { tier: 9, free: { cash: 120 }, premium: { skin: 'neon' } },
  { tier: 10, free: { box: 1 }, premium: { cash: 350 } },
  { tier: 11, free: { cash: 140 }, premium: { box: 2 } },
  { tier: 12, free: { shards: 40 }, premium: { skin: 'yugioh' } },
  { tier: 13, free: { cash: 160 }, premium: { shards: 150 } },
  { tier: 14, free: { cash: 180 }, premium: { box: 2 } },
  { tier: 15, free: { box: 2 }, premium: { skin: 'galaxy' } },
];

const POOL = [
  { id: 'win1', type: 'win', target: 1, scope: 'daily', cash: 80, xp: 40, desc: 'Gagne 1 manche' },
  { id: 'swap2', type: 'play_swap', target: 2, scope: 'daily', cash: 60, xp: 30, desc: 'Joue 2 cartes Échange 🔄' },
  { id: 'renew1', type: 'play_renew', target: 1, scope: 'daily', cash: 60, xp: 30, desc: 'Joue 1 carte Renouveau ♻️' },
  { id: 'wild4x3', type: 'play_wild4', target: 3, scope: 'daily', cash: 70, xp: 35, desc: 'Joue 3 cartes +4' },
  { id: 'draw10', type: 'draw', target: 10, scope: 'daily', cash: 50, xp: 25, desc: 'Pioche 10 cartes' },
  { id: 'solo1', type: 'win_solo', target: 1, scope: 'daily', cash: 40, xp: 20, desc: 'Gagne une partie solo' },
  { id: 'win3', type: 'win', target: 3, scope: 'weekly', cash: 250, xp: 120, desc: 'Gagne 3 manches' },
  { id: 'p4last', type: 'win_plus4_last', target: 1, scope: 'weekly', cash: 300, xp: 150, desc: 'Gagne avec un +4 en dernière carte' },
  { id: 'shield1', type: 'shield_block', target: 1, scope: 'weekly', cash: 200, xp: 100, desc: 'Bloque une attaque avec un Bouclier 🛡️' },
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickN(list, n, seed) {
  const arr = list.slice();
  // deterministic shuffle from seed
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
export function weekKey(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export function generateMissions(dk, wk) {
  const daily = pickN(POOL.filter((m) => m.scope === 'daily'), 3, hash(dk));
  const weekly = pickN(POOL.filter((m) => m.scope === 'weekly'), 2, hash(wk));
  return [...daily, ...weekly].map((m) => ({ ...m, progress: 0, claimed: false }));
}

export function levelInfo(xp) {
  const unlocked = Math.floor(xp / XP_PER_TIER); // number of tiers reached
  const tier = Math.min(MAX_TIER, unlocked);
  const into = xp % XP_PER_TIER;
  return { tier, unlocked, into, need: XP_PER_TIER, pct: into / XP_PER_TIER };
}

function defaults() {
  const dk = dayKey();
  const wk = weekKey();
  return {
    xp: 0,
    premium: false,
    claimedFree: [],
    claimedPrem: [],
    shards: 0,
    boxes: 0,
    clan: null,
    missions: { dayKey: dk, weekKey: wk, items: generateMissions(dk, wk) },
  };
}

export async function loadProg() {
  let p;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    p = raw ? JSON.parse(raw) : defaults();
  } catch (e) {
    p = defaults();
  }
  // migrate missing fields
  const d = defaults();
  p = { ...d, ...p, missions: p.missions || d.missions };
  // refresh missions on day/week change
  const dk = dayKey();
  const wk = weekKey();
  if (p.missions.dayKey !== dk || p.missions.weekKey !== wk) {
    // keep weekly progress if only the day changed
    const fresh = generateMissions(dk, wk);
    if (p.missions.weekKey === wk) {
      for (const m of fresh) {
        if (m.scope === 'weekly') {
          const old = p.missions.items.find((x) => x.id === m.id);
          if (old) {
            m.progress = old.progress;
            m.claimed = old.claimed;
          }
        }
      }
    }
    p.missions = { dayKey: dk, weekKey: wk, items: fresh };
  }
  return p;
}

export async function saveProg(p) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {}
  return p;
}

// Apply a gameplay event to mission progress. event = { type, amount }
export function recordEvent(p, event) {
  let changed = false;
  for (const m of p.missions.items) {
    if (m.claimed) continue;
    if (m.type === event.type && m.progress < m.target) {
      m.progress = Math.min(m.target, m.progress + (event.amount || 1));
      changed = true;
    }
  }
  return changed;
}
