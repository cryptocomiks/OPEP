import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Card from './src/components/Card';
import { CARD_COLORS, theme } from './src/theme';
import {
  createGame,
  applyAction,
  publicView,
  canPlay,
  COLORS,
} from './src/engine';
import { GameClient, makeCode, makeId } from './src/net';

const randomName = () => {
  const a = ['Rapide', 'Malin', 'Chanceux', 'Rusé', 'Cool', 'Fou', 'Zen', 'Turbo'];
  const b = ['Renard', 'Panda', 'Tigre', 'Hibou', 'Loup', 'Koala', 'Faucon', 'Lynx'];
  return a[Math.floor(Math.random() * a.length)] + ' ' + b[Math.floor(Math.random() * b.length)];
};

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [name, setName] = useState(randomName());
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState(null); // host | guest
  const [status, setStatus] = useState('offline');
  const [lobby, setLobby] = useState({ players: [], hostId: null, started: false });
  const [gameState, setGameState] = useState(null);
  const [colorPickFor, setColorPickFor] = useState(null); // cardId awaiting color
  const [toast, setToast] = useState('');

  const meRef = useRef({ id: makeId(), name });
  const clientRef = useRef(null);
  const stateRef = useRef(null); // host authoritative
  const lobbyRef = useRef({ players: [], hostId: null, started: false });
  const roleRef = useRef(null);

  useEffect(() => {
    meRef.current.name = name;
  }, [name]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const cleanup = useCallback(() => {
    if (clientRef.current) clientRef.current.end();
    clientRef.current = null;
    stateRef.current = null;
    lobbyRef.current = { players: [], hostId: null, started: false };
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ---------- HOST ----------
  const hostGame = useCallback(() => {
    const newCode = makeCode();
    const me = meRef.current;
    roleRef.current = 'host';
    setRole('host');
    setCode(newCode);

    lobbyRef.current = { players: [{ id: me.id, name: me.name }], hostId: me.id, started: false };

    const client = new GameClient(newCode, {
      onStatus: (s) => setStatus(s),
      onJoin: (player) => {
        const lob = lobbyRef.current;
        if (lob.started) return;
        if (!player || !player.id) return;
        if (!lob.players.find((p) => p.id === player.id)) {
          lob.players = [...lob.players, { id: player.id, name: player.name || 'Joueur' }];
          setLobby({ ...lob });
        }
        client.publishLobby(lob); // ack so the joiner sees themselves
      },
      onAction: (action) => {
        const st = stateRef.current;
        if (!st) return;
        const res = applyAction(st, action);
        // even on invalid action we keep going; just don't broadcast garbage
        if (res.ok) {
          stateRef.current = res.state;
          setGameState({ ...res.state });
          client.publishState(res.state);
        }
      },
    });
    clientRef.current = client;
    client.connect();
    const onConn = () => {
      client.subscribeAsHost();
      client.publishLobby(lobbyRef.current);
    };
    // subscribe as soon as connected
    client.client.on('connect', onConn);
    setLobby({ ...lobbyRef.current });
    setScreen('lobby');
  }, []);

  const startGame = useCallback(() => {
    const lob = lobbyRef.current;
    if (lob.players.length < 2) {
      flash('Il faut au moins 2 joueurs.');
      return;
    }
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(lob.players, seed);
    stateRef.current = st;
    lob.started = true;
    lobbyRef.current = lob;
    setLobby({ ...lob });
    setGameState({ ...st });
    clientRef.current.publishLobby(lob);
    clientRef.current.publishState(st);
    setScreen('game');
  }, [flash]);

  const newRound = useCallback(() => {
    // host only, reuse same lobby
    const lob = lobbyRef.current;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(lob.players, seed);
    stateRef.current = st;
    setGameState({ ...st });
    clientRef.current.publishState(st);
  }, []);

  // ---------- GUEST ----------
  const joinGame = useCallback(() => {
    const c = codeInput.trim().toUpperCase();
    if (c.length < 4) {
      flash('Entre un code valide.');
      return;
    }
    const me = meRef.current;
    roleRef.current = 'guest';
    setRole('guest');
    setCode(c);

    const client = new GameClient(c, {
      onStatus: (s) => setStatus(s),
      onLobby: (lob) => {
        lobbyRef.current = lob;
        setLobby(lob);
        // if we're not in the roster yet, (re)announce ourselves
        if (!lob.players.find((p) => p.id === me.id) && !lob.started) {
          client.sendJoin({ id: me.id, name: me.name });
        }
        if (lob.started) setScreen('game');
      },
      onState: (st) => {
        stateRef.current = st;
        setGameState({ ...st });
        if (roleRef.current === 'guest') setScreen('game');
      },
    });
    clientRef.current = client;
    client.connect();
    client.client.on('connect', () => {
      client.subscribeAsGuest();
      client.sendJoin({ id: me.id, name: me.name });
      // retry a few times in case the host wasn't subscribed yet
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        const lob = lobbyRef.current;
        const inRoster = lob.players && lob.players.find((p) => p.id === me.id);
        if (inRoster || tries > 6) {
          clearInterval(iv);
          return;
        }
        client.sendJoin({ id: me.id, name: me.name });
      }, 1200);
    });
    setScreen('lobby');
  }, [codeInput, flash]);

  // ---------- gameplay actions (everyone sends via broker) ----------
  const send = useCallback((action) => {
    if (clientRef.current) clientRef.current.sendAction(action);
  }, []);

  const view = gameState ? publicView(gameState, meRef.current.id) : null;
  const myTurn = view && view.currentPlayerId === meRef.current.id && view.status === 'playing';

  const onPlayCard = useCallback(
    (card) => {
      if (!myTurn) {
        flash("Ce n'est pas ton tour.");
        return;
      }
      if (!canPlay(card, stateRef.current)) {
        flash('Carte non jouable.');
        return;
      }
      if (card.value === 'wild' || card.value === 'wild4') {
        setColorPickFor(card.id);
        return;
      }
      send({ type: 'play', playerId: meRef.current.id, cardId: card.id });
    },
    [myTurn, send, flash]
  );

  const chooseColor = useCallback(
    (color) => {
      send({ type: 'play', playerId: meRef.current.id, cardId: colorPickFor, color });
      setColorPickFor(null);
    },
    [colorPickFor, send]
  );

  const leave = useCallback(() => {
    cleanup();
    setGameState(null);
    setRole(null);
    roleRef.current = null;
    setLobby({ players: [], hostId: null, started: false });
    setScreen('home');
  }, [cleanup]);

  // ================= RENDER =================
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {screen === 'home' && (
          <HomeScreen
            name={name}
            setName={setName}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            onHost={hostGame}
            onJoin={joinGame}
          />
        )}

        {screen === 'lobby' && (
          <LobbyScreen
            code={code}
            role={role}
            status={status}
            lobby={lobby}
            meId={meRef.current.id}
            onStart={startGame}
            onLeave={leave}
          />
        )}

        {screen === 'game' && view && (
          <GameScreen
            view={view}
            meId={meRef.current.id}
            myTurn={myTurn}
            role={role}
            status={status}
            onPlay={onPlayCard}
            onDraw={() => send({ type: 'draw', playerId: meRef.current.id })}
            onPass={() => send({ type: 'pass', playerId: meRef.current.id })}
            onNewRound={newRound}
            onLeave={leave}
          />
        )}

        {colorPickFor && <ColorPicker onPick={chooseColor} onCancel={() => setColorPickFor(null)} />}
        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------- Screens ----------------

function HomeScreen({ name, setName, codeInput, setCodeInput, onHost, onJoin }) {
  return (
    <ScrollView contentContainerStyle={styles.home}>
      <Text style={styles.logo}>UNO</Text>
      <Text style={styles.tagline}>Joue avec tes amis · rejoins avec un code</Text>

      <Text style={styles.label}>Ton pseudo</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ton pseudo"
        placeholderTextColor={theme.sub}
        maxLength={16}
      />

      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onHost}>
        <Text style={styles.btnText}>Créer une partie</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.line} />
      </View>

      <Text style={styles.label}>Rejoindre avec un code</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        value={codeInput}
        onChangeText={(t) => setCodeInput(t.toUpperCase())}
        placeholder="EX: K7P2M"
        placeholderTextColor={theme.sub}
        autoCapitalize="characters"
        maxLength={6}
      />
      <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={onJoin}>
        <Text style={styles.btnText}>Rejoindre</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Aucun compte requis · réseau public</Text>
    </ScrollView>
  );
}

function LobbyScreen({ code, role, status, lobby, meId, onStart, onLeave }) {
  return (
    <View style={styles.container}>
      <TopBar title="Salon" status={status} onLeave={onLeave} />
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Code de la partie</Text>
        <Text style={styles.codeBig}>{code}</Text>
        <Text style={styles.codeHint}>Partage ce code pour que tes amis rejoignent</Text>
      </View>

      <Text style={styles.sectionTitle}>Joueurs ({lobby.players.length})</Text>
      <ScrollView style={{ flex: 1 }}>
        {lobby.players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(p.name || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.playerName}>{p.name}</Text>
            {p.id === lobby.hostId ? <Text style={styles.hostTag}>hôte</Text> : null}
            {p.id === meId ? <Text style={styles.youTag}>toi</Text> : null}
          </View>
        ))}
        {lobby.players.length < 2 ? (
          <Text style={styles.waiting}>En attente de joueurs…</Text>
        ) : null}
      </ScrollView>

      {role === 'host' ? (
        <TouchableOpacity
          style={[styles.btn, lobby.players.length >= 2 ? styles.btnPrimary : styles.btnDisabled]}
          onPress={onStart}
          disabled={lobby.players.length < 2}
        >
          <Text style={styles.btnText}>Lancer la partie</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.waiting}>L'hôte va lancer la partie…</Text>
      )}
    </View>
  );
}

function GameScreen({ view, meId, myTurn, role, status, onPlay, onDraw, onPass, onNewRound, onLeave }) {
  const finished = view.status === 'finished';
  const winnerName = finished
    ? (view.players.find((p) => p.id === view.winner) || {}).name
    : null;
  const dirArrow = view.direction === 1 ? '↻' : '↺';

  return (
    <View style={styles.container}>
      <TopBar title="UNO" status={status} onLeave={onLeave} />

      {/* opponents */}
      <View style={styles.opponents}>
        {view.players
          .filter((p) => p.id !== meId)
          .map((p) => {
            const active = p.id === view.currentPlayerId && !finished;
            return (
              <View key={p.id} style={[styles.oppChip, active && styles.oppActive]}>
                <Text style={styles.oppName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.oppCount}>🂠 {p.count}</Text>
                {p.count === 1 ? <Text style={styles.unoBadge}>UNO!</Text> : null}
              </View>
            );
          })}
      </View>

      {/* table */}
      <View style={styles.table}>
        <TouchableOpacity onPress={myTurn && !finished ? onDraw : undefined} activeOpacity={0.8}>
          <View style={styles.deckBack}>
            <Text style={styles.deckText}>UNO</Text>
            <Text style={styles.deckCount}>{view.drawCount}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.centerInfo}>
          <View style={[styles.colorDot, { backgroundColor: CARD_COLORS[view.currentColor] || '#888' }]} />
          <Text style={styles.dir}>{dirArrow}</Text>
        </View>

        <View>
          <Card card={view.top} />
        </View>
      </View>

      {/* turn banner */}
      {!finished ? (
        <Text style={[styles.turnBanner, myTurn && styles.turnMine]}>
          {myTurn
            ? view.awaitingPlay
              ? 'Joue une carte ou passe'
              : '🟢 À toi de jouer !'
            : `Tour de ${(view.players.find((p) => p.id === view.currentPlayerId) || {}).name || '…'}`}
        </Text>
      ) : (
        <View style={styles.winBox}>
          <Text style={styles.winText}>🏆 {winnerName} gagne !</Text>
        </View>
      )}

      {/* log */}
      <View style={styles.logBox}>
        {view.log.slice(-2).map((l, i) => (
          <Text key={i} style={styles.logLine} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>

      {/* my hand */}
      <View style={styles.handWrap}>
        <View style={styles.handHeader}>
          <Text style={styles.handTitle}>
            Ta main ({view.yourHand.length}){view.yourHand.length === 1 ? '  ·  UNO !' : ''}
          </Text>
          {myTurn && view.awaitingPlay ? (
            <TouchableOpacity style={styles.passBtn} onPress={onPass}>
              <Text style={styles.passText}>Passer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
          {view.yourHand.map((c) => {
            const playable = myTurn && !finished && canPlayLocal(c, view);
            return (
              <View key={c.id} style={styles.handCard}>
                <Card card={c} onPress={() => onPlay(c)} dim={myTurn && !playable} />
              </View>
            );
          })}
          {view.yourHand.length === 0 ? (
            <Text style={styles.waiting}>{finished ? 'Partie terminée' : 'Tu es spectateur'}</Text>
          ) : null}
        </ScrollView>
      </View>

      {finished && role === 'host' ? (
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onNewRound}>
          <Text style={styles.btnText}>Nouvelle manche</Text>
        </TouchableOpacity>
      ) : null}
      {finished && role !== 'host' ? (
        <Text style={styles.waiting}>L'hôte peut lancer une nouvelle manche.</Text>
      ) : null}
    </View>
  );
}

// local playability check using the public view's top+color
function canPlayLocal(card, view) {
  if (card.value === 'wild' || card.value === 'wild4') return true;
  if (card.color === view.currentColor) return true;
  if (view.top && card.value === view.top.value && card.color !== null && view.top.color !== null)
    return true;
  return false;
}

function ColorPicker({ onPick, onCancel }) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Choisis une couleur</Text>
        <View style={styles.colorGrid}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorTile, { backgroundColor: CARD_COLORS[c] }]}
              onPress={() => onPick(c)}
            />
          ))}
        </View>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TopBar({ title, status, onLeave }) {
  const dot =
    status === 'connected' ? theme.ok : status === 'offline' || status === 'error' ? theme.danger : theme.accent;
  return (
    <View style={styles.topbar}>
      <TouchableOpacity onPress={onLeave} style={styles.leaveBtn}>
        <Text style={styles.leaveText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.statusWrap}>
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
      </View>
    </View>
  );
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, padding: 14 },
  home: { padding: 24, paddingTop: 60, alignItems: 'stretch' },
  logo: {
    fontSize: 72,
    fontWeight: '900',
    color: theme.accent,
    textAlign: 'center',
    letterSpacing: 4,
    textShadowColor: theme.danger,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  tagline: { color: theme.sub, textAlign: 'center', marginBottom: 30, marginTop: 4 },
  label: { color: theme.text, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: theme.panel,
    color: theme.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  codeInput: { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  btnPrimary: { backgroundColor: theme.danger },
  btnGreen: { backgroundColor: theme.ok },
  btnDisabled: { backgroundColor: theme.panel2 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.sub, marginHorizontal: 12 },
  footer: { color: theme.sub, textAlign: 'center', marginTop: 26, fontSize: 12 },

  topbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  leaveBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.panel, justifyContent: 'center', alignItems: 'center' },
  leaveText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  topTitle: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22, letterSpacing: 2 },
  statusWrap: { width: 34, alignItems: 'flex-end' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },

  codeBox: { backgroundColor: theme.panel, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  codeLabel: { color: theme.sub, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  codeBig: { color: theme.text, fontSize: 46, fontWeight: '900', letterSpacing: 10, marginVertical: 6 },
  codeHint: { color: theme.sub, fontSize: 12, textAlign: 'center' },

  sectionTitle: { color: theme.text, fontWeight: '800', fontSize: 16, marginTop: 18, marginBottom: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.panel, borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#1a1a1a', fontWeight: '900' },
  playerName: { color: theme.text, fontWeight: '700', flex: 1 },
  hostTag: { color: '#1a1a1a', backgroundColor: theme.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  youTag: { color: '#fff', backgroundColor: theme.ok, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  waiting: { color: theme.sub, textAlign: 'center', marginVertical: 12 },

  opponents: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 6 },
  oppChip: { backgroundColor: theme.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: 84 },
  oppActive: { borderColor: theme.accent },
  oppName: { color: theme.text, fontWeight: '700', maxWidth: 90 },
  oppCount: { color: theme.sub, marginTop: 2 },
  unoBadge: { color: theme.danger, fontWeight: '900', fontSize: 11, marginTop: 2 },

  table: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginVertical: 14 },
  deckBack: { width: 74, height: 108, borderRadius: 12, backgroundColor: '#111421', borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  deckText: { color: theme.accent, fontWeight: '900', transform: [{ rotate: '-20deg' }], fontSize: 20 },
  deckCount: { color: theme.sub, position: 'absolute', bottom: 6, fontSize: 12 },
  centerInfo: { alignItems: 'center', gap: 6 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
  dir: { color: theme.text, fontSize: 26 },

  turnBanner: { textAlign: 'center', color: theme.sub, fontWeight: '700', marginBottom: 4 },
  turnMine: { color: theme.ok, fontSize: 16 },
  winBox: { alignItems: 'center', marginVertical: 6 },
  winText: { color: theme.accent, fontSize: 22, fontWeight: '900' },

  logBox: { minHeight: 34, marginBottom: 4 },
  logLine: { color: theme.sub, fontSize: 12, textAlign: 'center' },

  handWrap: { marginTop: 'auto', backgroundColor: theme.panel, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: theme.border },
  handHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  handTitle: { color: theme.text, fontWeight: '800' },
  passBtn: { backgroundColor: theme.panel2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  passText: { color: theme.text, fontWeight: '800' },
  hand: { paddingVertical: 4, paddingHorizontal: 2, gap: 8 },
  handCard: { marginRight: 2 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: theme.panel, borderRadius: 18, padding: 24, alignItems: 'center', width: 280 },
  modalTitle: { color: theme.text, fontWeight: '800', fontSize: 18, marginBottom: 16 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 180, justifyContent: 'space-between', gap: 12 },
  colorTile: { width: 78, height: 78, borderRadius: 14, borderWidth: 3, borderColor: '#fff' },
  cancel: { color: theme.sub, marginTop: 18, fontWeight: '700' },

  toast: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, maxWidth: '90%' },
  toastText: { color: '#fff', fontWeight: '600' },
});
