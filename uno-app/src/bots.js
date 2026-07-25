// Deterministic bot strategy for solo mode.
// No randomness -> reproducible games, which makes debugging predictable.

import { canPlay, cardPoints, COLORS } from './engine';

function bestColor(state, botId) {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of state.hands[botId]) if (c.color) counts[c.color]++;
  let best = 'red';
  let bestN = -1;
  for (const col of COLORS) {
    if (counts[col] > bestN) {
      bestN = counts[col];
      best = col;
    }
  }
  return best;
}

function playDecision(state, botId, playable) {
  // deterministic order: keep wilds for last, shed high-value cards first, then by id
  const sorted = playable.slice().sort((a, b) => {
    const aw = a.value === 'wild' || a.value === 'wild4' ? 1 : 0;
    const bw = b.value === 'wild' || b.value === 'wild4' ? 1 : 0;
    if (aw !== bw) return aw - bw;
    const pd = cardPoints(b) - cardPoints(a);
    if (pd !== 0) return pd;
    return a.id < b.id ? -1 : 1;
  });
  const card = sorted[0];
  const isWild = card.value === 'wild' || card.value === 'wild4';
  const action = { type: 'play', playerId: botId, cardId: card.id };
  if (isWild) action.color = bestColor(state, botId);
  return action;
}

// Returns the next action a bot should take given the current state.
export function botAction(state, botId) {
  const hand = state.hands[botId] || [];
  const playable = hand.filter((c) => canPlay(c, state));
  if (state.awaitingPlay) {
    // the bot already drew this turn: play if it now can, otherwise pass
    if (playable.length) return playDecision(state, botId, playable);
    return { type: 'pass', playerId: botId };
  }
  if (playable.length) return playDecision(state, botId, playable);
  return { type: 'draw', playerId: botId };
}
