// UNO game engine — pure logic, no React / no network here.
// State is a plain serialisable object so the host can broadcast it as JSON.

export const COLORS = ['red', 'yellow', 'green', 'blue'];

// A card: { id, color, value }
//  color: 'red' | 'yellow' | 'green' | 'blue' | null (wilds)
//  value: '0'..'9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

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
  return deck; // 108 cards
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
    // set when a wild was played and host waits for color choice (host-local, rarely used since we pass color with action):
    log: [`La partie commence. Carte de départ: ${describe(first)}.`],
    seed,
  };
}

export function topCard(state) {
  return state.discard[state.discard.length - 1];
}

export function currentPlayerId(state) {
  return state.order[state.turnIndex];
}

export function canPlay(card, state) {
  const top = topCard(state);
  if (card.value === 'wild' || card.value === 'wild4') return true;
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
    return { ok: true, state };
  }

  if (action.type === 'pass') {
    if (!state.awaitingPlay) return { ok: false, error: "Tu dois d'abord piocher", state };
    state.awaitingPlay = false;
    state.log.push(`${nameOf(state, pid)} passe son tour.`);
    advance(state, 1);
    return { ok: true, state };
  }

  if (action.type === 'play') {
    const hand = state.hands[pid];
    const idx = hand.findIndex((c) => c.id === action.cardId);
    if (idx === -1) return { ok: false, error: 'Carte introuvable', state };
    const card = hand[idx];
    if (!canPlay(card, state)) return { ok: false, error: 'Carte non jouable', state };

    const isWild = card.value === 'wild' || card.value === 'wild4';
    if (isWild && !COLORS.includes(action.color)) {
      return { ok: false, error: 'Choisis une couleur', state };
    }

    // remove from hand, place on discard
    hand.splice(idx, 1);
    const played = isWild ? { ...card, color: action.color } : card;
    state.discard.push(played);
    state.currentColor = isWild ? action.color : card.color;
    state.awaitingPlay = false;
    state.log.push(`${nameOf(state, pid)} joue ${describe(played)}.`);

    // win check
    if (hand.length === 0) {
      state.status = 'finished';
      state.winner = pid;
      state.log.push(`🏆 ${nameOf(state, pid)} gagne la partie !`);
      return { ok: true, state };
    }

    // effects
    const two = state.order.length === 2;
    switch (card.value) {
      case 'skip':
        advance(state, 2);
        break;
      case 'reverse':
        state.direction *= -1;
        advance(state, two ? 2 : 1); // reverse acts as skip in 2-player
        break;
      case 'draw2': {
        advance(state, 1);
        const target = currentPlayerId(state);
        drawN(state, target, 2);
        state.log.push(`${nameOf(state, target)} pioche 2 cartes.`);
        advance(state, 1);
        break;
      }
      case 'wild4': {
        advance(state, 1);
        const target = currentPlayerId(state);
        drawN(state, target, 4);
        state.log.push(`${nameOf(state, target)} pioche 4 cartes.`);
        advance(state, 1);
        break;
      }
      case 'wild':
        advance(state, 1);
        break;
      default:
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
    awaitingPlay: state.awaitingPlay,
    currentPlayerId: currentPlayerId(state),
    log: state.log.slice(-6),
    yourHand: viewerId && state.hands[viewerId] ? state.hands[viewerId] : [],
  };
}
