// UNO game engine — pure logic, no React / no network here.
// State is a plain serialisable object so the host can broadcast it as JSON.

export const COLORS = ['red', 'yellow', 'green', 'blue'];

// A card: { id, color, value }
//  color: 'red' | 'yellow' | 'green' | 'blue' | null (wild-type)
//  value: '0'..'9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' | 'swap' | 'renew'
//  swap  = échange ta main avec un joueur ciblé
//  renew = un joueur ciblé jette toute sa main et pioche une main neuve

export const WILD_TYPES = ['wild', 'wild4', 'swap', 'renew'];
export const TARGETED = ['swap', 'renew']; // need a chosen target player

export function isWildType(card) {
  return WILD_TYPES.includes(card.value);
}

export function buildDeck() {
  const deck = [];
  let n = 0;
  const push = (color, value) => deck.push({ id: `c${n++}`, color, value });

  for (const color of COLORS) {
    push(color, '0'); // one 0 per color
    for (let v = 1; v <= 9; v++) {
      push(color, String(v));
      push(color, String(v)); // two of 1..9
    }
    for (const special of ['skip', 'reverse', 'draw2']) {
      push(color, special);
      push(color, special); // two of each action
    }
  }
  for (let i = 0; i < 4; i++) {
    push(null, 'wild');
    push(null, 'wild4');
  }
  // custom special cards
  for (let i = 0; i < 4; i++) {
    push(null, 'swap');
    push(null, 'renew');
  }
  return deck; // 116 cards
}

// Deterministic-ish shuffle using a seeded RNG so host is reproducible if needed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isColored(card) {
  return card.color !== null;
}

// Create a fresh game. players = [{ id, name }]
export function createGame(players, seed) {
  const rng = mulberry32(seed);
  let deck = shuffle(buildDeck(), rng);

  const hands = {};
  for (const p of players) hands[p.id] = [];
  // deal 7 each
  for (let r = 0; r < 7; r++) {
    for (const p of players) hands[p.id].push(deck.pop());
  }

  // flip first non-wild card as start of discard
  let first = deck.pop();
  while (!isColored(first)) {
    deck.unshift(first); // put wilds back at bottom
    first = deck.pop();
  }
  const discard = [first];

  return {
    players: players.map((p) => ({ id: p.id, name: p.name })),
    hands,
    drawPile: deck,
    discard,
    order: players.map((p) => p.id),
    turnIndex: 0,
    direction: 1,
    currentColor: first.color,
    status: 'playing',
    winner: null,
    // when a player has drawn and may play the drawn card or pass:
    awaitingPlay: false,
    // event system: drives client-side animations reliably
    lastEvent: null,
    eventSeq: 0,
    log: [`La partie commence. Carte de départ: ${describe(first)}.`],
    seed,
  };
}

// Official UNO scoring: number cards = face value, action cards = 20, wilds = 50.
export function cardPoints(card) {
  if (card.value === 'swap' || card.value === 'renew') return 40;
  if (card.value === 'wild' || card.value === 'wild4') return 50;
  if (card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2') return 20;
  return parseInt(card.value, 10) || 0;
}

export function handPoints(hand) {
  return hand.reduce((a, c) => a + cardPoints(c), 0);
}

// Cash the winner earns. More opponents in the pot => a bigger win, plus all the
// points still stuck in everyone else's hands (scaled up by table size).
export function roundReward(state, winnerId) {
  let pts = 0;
  let opp = 0;
  for (const p of state.players) {
    if (p.id !== winnerId) {
      pts += handPoints(state.hands[p.id] || []);
      opp++;
    }
  }
  const base = 50 + opp * 25;
  return Math.round(base + pts * (1 + 0.25 * Math.max(0, opp - 1)));
}

// Small helper to record the latest gameplay event (for animations).
function setEvent(state, ev) {
  state.lastEvent = ev;
  state.eventSeq = (state.eventSeq || 0) + 1;
}

export function topCard(state) {
  return state.discard[state.discard.length - 1];
}

export function currentPlayerId(state) {
  return state.order[state.turnIndex];
}

export function canPlay(card, state) {
  const top = topCard(state);
  if (isWildType(card)) return true; // wild, wild4, swap, renew playable anytime
  if (card.color === state.currentColor) return true;
  if (card.value === top.value && isColored(card) && isColored(top)) return true;
  return false;
}

function refillIfNeeded(state) {
  if (state.drawPile.length > 0) return;
  const top = state.discard.pop();
  const rng = mulberry32((state.seed ^ state.discard.length ^ 0x9e3779b9) >>> 0);
  state.drawPile = shuffle(
    state.discard.map((c) =>
      // reset chosen color on wilds when they go back to the pile
      c.value === 'wild' || c.value === 'wild4' ? { ...c, color: null } : c
    ),
    rng
  );
  state.discard = [top];
}

function drawN(state, playerId, count) {
  for (let i = 0; i < count; i++) {
    refillIfNeeded(state);
    if (state.drawPile.length === 0) break;
    state.hands[playerId].push(state.drawPile.pop());
  }
}

function advance(state, steps = 1) {
  const n = state.order.length;
  state.turnIndex = (state.turnIndex + state.direction * steps + n * steps) % n;
}

export function describe(card) {
  const colorFr = { red: 'Rouge', yellow: 'Jaune', green: 'Vert', blue: 'Bleu' };
  const valFr = {
    skip: 'Passe', reverse: 'Sens inverse', draw2: '+2', wild: 'Joker', wild4: '+4',
    swap: 'Échange', renew: 'Renouveau',
  };
  const c = card.color ? colorFr[card.color] + ' ' : '';
  return c + (valFr[card.value] || card.value);
}

// ----- Actions -----
// action = { type, playerId, cardId?, color? }
// Returns { ok, error?, state }  (state mutated in place then returned)

export function applyAction(state, action) {
  if (state.status !== 'playing') return { ok: false, error: 'Partie terminée', state };
  const pid = action.playerId;
  if (pid !== currentPlayerId(state)) return { ok: false, error: "Ce n'est pas ton tour", state };

  if (action.type === 'draw') {
    if (state.awaitingPlay) return { ok: false, error: 'Tu as déjà pioché', state };
    drawN(state, pid, 1);
    state.awaitingPlay = true;
    state.log.push(`${nameOf(state, pid)} pioche une carte.`);
    setEvent(state, { type: 'draw', player: pid, n: 1 });
    return { ok: true, state };
  }

  if (action.type === 'pass') {
    if (!state.awaitingPlay) return { ok: false, error: "Tu dois d'abord piocher", state };
    state.awaitingPlay = false;
    state.log.push(`${nameOf(state, pid)} passe son tour.`);
    setEvent(state, { type: 'pass', player: pid });
    advance(state, 1);
    return { ok: true, state };
  }

  if (action.type === 'play') {
    const hand = state.hands[pid];
    const idx = hand.findIndex((c) => c.id === action.cardId);
    if (idx === -1) return { ok: false, error: 'Carte introuvable', state };
    const card = hand[idx];
    if (!canPlay(card, state)) return { ok: false, error: 'Carte non jouable', state };

    const isWild = isWildType(card);
    if (isWild && !COLORS.includes(action.color)) {
      return { ok: false, error: 'Choisis une couleur', state };
    }
    // swap / renew need a valid target (someone else)
    const needsTarget = TARGETED.includes(card.value);
    if (needsTarget) {
      const t = action.target;
      if (!t || t === pid || !state.order.includes(t)) {
        return { ok: false, error: 'Choisis un joueur', state };
      }
    }

    // remove from hand, place on discard
    hand.splice(idx, 1);
    const played = isWild ? { ...card, color: action.color } : card;
    state.discard.push(played);
    state.currentColor = isWild ? action.color : card.color;
    state.awaitingPlay = false;
    state.log.push(`${nameOf(state, pid)} joue ${describe(played)}.`);

    // win check (playing your last card wins immediately)
    if (hand.length === 0) {
      state.status = 'finished';
      state.winner = pid;
      state.reward = roundReward(state, pid);
      state.log.push(`🏆 ${nameOf(state, pid)} gagne la manche ! +${state.reward}$`);
      setEvent(state, { type: 'win', player: pid, reward: state.reward });
      return { ok: true, state };
    }

    // effects
    const two = state.order.length === 2;
    switch (card.value) {
      case 'skip': {
        advance(state, 1);
        const target = currentPlayerId(state);
        state.log.push(`${nameOf(state, target)} est bloqué 🔒.`);
        setEvent(state, { type: 'skip', player: pid, target });
        advance(state, 1);
        break;
      }
      case 'reverse':
        state.direction *= -1;
        setEvent(state, { type: 'reverse', player: pid });
        advance(state, two ? 2 : 1); // reverse acts as skip in 2-player
        break;
      case 'draw2': {
        advance(state, 1);
        const target = currentPlayerId(state);
        drawN(state, target, 2);
        state.log.push(`${nameOf(state, target)} pioche 2 cartes.`);
        setEvent(state, { type: 'draw2', player: pid, target, n: 2 });
        advance(state, 1);
        break;
      }
      case 'wild4': {
        advance(state, 1);
        const target = currentPlayerId(state);
        drawN(state, target, 4);
        state.log.push(`${nameOf(state, target)} pioche 4 cartes.`);
        setEvent(state, { type: 'wild4', player: pid, target, n: 4 });
        advance(state, 1);
        break;
      }
      case 'swap': {
        const target = action.target;
        const mine = state.hands[pid];
        state.hands[pid] = state.hands[target];
        state.hands[target] = mine;
        state.log.push(`🔄 ${nameOf(state, pid)} échange sa main avec ${nameOf(state, target)} !`);
        setEvent(state, { type: 'swap', player: pid, target });
        advance(state, 1);
        break;
      }
      case 'renew': {
        const target = action.target;
        const old = state.hands[target];
        const count = old.length;
        // old hand goes to the bottom of the draw pile, target draws a fresh hand
        state.hands[target] = [];
        state.drawPile = old
          .map((c) => (c.value === 'wild' || c.value === 'wild4' ? { ...c, color: null } : c))
          .concat(state.drawPile);
        drawN(state, target, count);
        state.log.push(`♻️ ${nameOf(state, target)} rend sa main et pioche ${count} cartes neuves !`);
        setEvent(state, { type: 'renew', player: pid, target, n: count });
        advance(state, 1);
        break;
      }
      case 'wild':
        setEvent(state, { type: 'wild', player: pid, color: action.color });
        advance(state, 1);
        break;
      default:
        setEvent(state, { type: 'play', player: pid, value: card.value });
        advance(state, 1);
    }
    return { ok: true, state };
  }

  return { ok: false, error: 'Action inconnue', state };
}

function nameOf(state, pid) {
  const p = state.players.find((x) => x.id === pid);
  return p ? p.name : '???';
}

// Public view of state for a given player (hide other hands' contents -> counts only)
export function publicView(state, viewerId) {
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      count: state.hands[p.id] ? state.hands[p.id].length : 0,
    })),
    order: state.order,
    turnIndex: state.turnIndex,
    direction: state.direction,
    currentColor: state.currentColor,
    top: topCard(state),
    drawCount: state.drawPile.length,
    status: state.status,
    winner: state.winner,
    reward: state.reward || 0,
    awaitingPlay: state.awaitingPlay,
    currentPlayerId: currentPlayerId(state),
    lastEvent: state.lastEvent || null,
    eventSeq: state.eventSeq || 0,
    log: state.log.slice(-6),
    yourHand: viewerId && state.hands[viewerId] ? state.hands[viewerId] : [],
  };
}
