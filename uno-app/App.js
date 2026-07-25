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
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Card from './src/components/Card';
import UnoLogo from './src/components/UnoLogo';
import IntroSplash from './src/components/IntroSplash';
import FxLayer from './src/components/FxLayer';
import WinOverlay from './src/components/WinOverlay';
import { CARD_COLORS, theme, GRAD } from './src/theme';
import { createGame, applyAction, publicView, canPlay, COLORS } from './src/engine';
import { botAction } from './src/bots';
import { GameClient, makeCode, makeId } from './src/net';
import { getBalance, addBalance } from './src/wallet';

const randomName = () => {
  const a = ['Rapide', 'Malin', 'Chanceux', 'Rusé', 'Cool', 'Fou', 'Zen', 'Turbo'];
  const b = ['Renard', 'Panda', 'Tigre', 'Hibou', 'Loup', 'Koala', 'Faucon', 'Lynx'];
  return a[Math.floor(Math.random() * a.length)] + ' ' + b[Math.floor(Math.random() * b.length)];
};

const haptic = (kind) => {
  try {
    if (kind === 'heavy') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

export default function App() {
  const [intro, setIntro] = useState(true);
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [mode, setMode] = useState(null); // solo | multi
  const [name, setName] = useState(randomName());
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState(null); // host | guest
  const [status, setStatus] = useState('offline');
  const [lobby, setLobby] = useState({ players: [], hostId: null, started: false });
  const [gameState, setGameState] = useState(null);
  const [colorPickFor, setColorPickFor] = useState(null);
  const [toast, setToast] = useState('');
  const [balance, setBalance] = useState(0);
  const [bots, setBots] = useState(1);
  const [fx, setFx] = useState(null);
  const [fxKey, setFxKey] = useState(0);

  const meRef = useRef({ id: makeId(), name });
  const clientRef = useRef(null);
  const stateRef = useRef(null);
  const lobbyRef = useRef({ players: [], hostId: null, started: false });
  const roleRef = useRef(null);
  const modeRef = useRef(null);
  const prevRef = useRef({ topId: null, myCount: 0, finished: false });
  const rewardAppliedRef = useRef(false);

  useEffect(() => {
    meRef.current.name = name;
  }, [name]);

  useEffect(() => {
    getBalance().then(setBalance);
  }, []);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const triggerFx = useCallback((f) => {
    setFx(f);
    setFxKey((k) => k + 1);
  }, []);

  const cleanup = useCallback(() => {
    if (clientRef.current) clientRef.current.end();
    clientRef.current = null;
    stateRef.current = null;
    lobbyRef.current = { players: [], hostId: null, started: false };
    prevRef.current = { topId: null, myCount: 0, finished: false };
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ---------- SOLO ----------
  const startSolo = useCallback(() => {
    const me = meRef.current;
    const players = [{ id: me.id, name: me.name || 'Toi' }];
    for (let i = 1; i <= bots; i++) players.push({ id: 'bot' + i, name: 'Bot ' + i });
    modeRef.current = 'solo';
    setMode('solo');
    roleRef.current = 'host';
    setRole('host');
    lobbyRef.current = { players, hostId: me.id, started: true };
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(players, seed);
    stateRef.current = st;
    rewardAppliedRef.current = false;
    prevRef.current = { topId: null, myCount: 0, finished: false };
    setGameState({ ...st });
    setScreen('game');
  }, [bots]);

  const applyLocal = useCallback(
    (action) => {
      const st = stateRef.current;
      if (!st) return;
      const res = applyAction(st, action);
      if (res.ok) {
        stateRef.current = res.state;
        setGameState({ ...res.state });
      } else if (action.playerId === meRef.current.id) {
        flash(res.error);
      }
    },
    [flash]
  );

  // bot loop (solo): whenever it's a bot's turn, schedule its move
  useEffect(() => {
    if (modeRef.current !== 'solo' || !gameState) return;
    const v = publicView(gameState);
    if (v.status !== 'playing') return;
    const cur = v.currentPlayerId;
    if (cur === meRef.current.id) return;
    const timer = setTimeout(() => {
      const st = stateRef.current;
      if (!st || st.status !== 'playing') return;
      if (publicView(st).currentPlayerId !== cur) return;
      applyLocal(botAction(st, cur));
    }, 950);
    return () => clearTimeout(timer);
  }, [gameState, applyLocal]);

  // ---------- HOST (multi) ----------
  const hostGame = useCallback(() => {
    const newCode = makeCode();
    const me = meRef.current;
    modeRef.current = 'multi';
    setMode('multi');
    roleRef.current = 'host';
    setRole('host');
    setCode(newCode);
    lobbyRef.current = { players: [{ id: me.id, name: me.name }], hostId: me.id, started: false };

    const client = new GameClient(newCode, {
      onStatus: (s) => setStatus(s),
      onJoin: (player) => {
        const lob = lobbyRef.current;
        if (lob.started || !player || !player.id) return;
        if (!lob.players.find((p) => p.id === player.id)) {
          lob.players = [...lob.players, { id: player.id, name: player.name || 'Joueur' }];
          setLobby({ ...lob });
        }
        client.publishLobby(lob);
      },
      onAction: (action) => {
        const st = stateRef.current;
        if (!st) return;
        const res = applyAction(st, action);
        if (res.ok) {
          stateRef.current = res.state;
          setGameState({ ...res.state });
          client.publishState(res.state);
        }
      },
    });
    clientRef.current = client;
    client.connect();
    client.client.on('connect', () => {
      client.subscribeAsHost();
      client.publishLobby(lobbyRef.current);
    });
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
    rewardAppliedRef.current = false;
    prevRef.current = { topId: null, myCount: 0, finished: false };
    setLobby({ ...lob });
    setGameState({ ...st });
    clientRef.current.publishLobby(lob);
    clientRef.current.publishState(st);
    setScreen('game');
  }, [flash]);

  const newRound = useCallback(() => {
    const lob = lobbyRef.current;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(lob.players, seed);
    stateRef.current = st;
    rewardAppliedRef.current = false;
    prevRef.current = { topId: null, myCount: 0, finished: false };
    setGameState({ ...st });
    if (modeRef.current === 'multi' && clientRef.current) clientRef.current.publishState(st);
  }, []);

  // ---------- GUEST (multi) ----------
  const joinGame = useCallback(() => {
    const c = codeInput.trim().toUpperCase();
    if (c.length < 4) {
      flash('Entre un code valide.');
      return;
    }
    const me = meRef.current;
    modeRef.current = 'multi';
    setMode('multi');
    roleRef.current = 'guest';
    setRole('guest');
    setCode(c);

    const client = new GameClient(c, {
      onStatus: (s) => setStatus(s),
      onLobby: (lob) => {
        lobbyRef.current = lob;
        setLobby(lob);
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

  // ---------- gameplay send ----------
  const send = useCallback(
    (action) => {
      if (modeRef.current === 'solo') applyLocal(action);
      else if (clientRef.current) clientRef.current.sendAction(action);
    },
    [applyLocal]
  );

  const view = gameState ? publicView(gameState, meRef.current.id) : null;
  const myTurn = view && view.currentPlayerId === meRef.current.id && view.status === 'playing';

  // ---------- FX + cash detection ----------
  useEffect(() => {
    if (!gameState) return;
    const meId = meRef.current.id;
    const v = publicView(gameState, meId);
    const prev = prevRef.current;
    const myCount = v.yourHand.length;

    if (prev.topId !== null && v.status === 'playing') {
      const topChanged = v.top && v.top.id !== prev.topId;
      const delta = myCount - prev.myCount;
      const isPlus = topChanged && v.top && (v.top.value === 'draw2' || v.top.value === 'wild4');
      if (isPlus) {
        triggerFx({ type: 'plus', value: v.top.value, toMe: delta > 0 });
        haptic('heavy');
      } else if (delta > 0) {
        triggerFx({ type: 'draw', n: delta });
        haptic('light');
      }
    }

    if (v.status === 'finished' && !prev.finished) {
      if (v.winner === meId && !rewardAppliedRef.current) {
        rewardAppliedRef.current = true;
        addBalance(v.reward).then(setBalance);
        haptic('success');
      } else {
        haptic('light');
      }
    }

    prevRef.current = { topId: v.top ? v.top.id : null, myCount, finished: v.status === 'finished' };
  }, [gameState, triggerFx]);

  const confirmLeave = useCallback(() => {
    Alert.alert('Quitter la partie ?', 'Tu vas revenir au menu principal.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => leave() },
    ]);
  }, []);

  const leave = useCallback(() => {
    cleanup();
    setGameState(null);
    setRole(null);
    roleRef.current = null;
    modeRef.current = null;
    setMode(null);
    setFx(null);
    setLobby({ players: [], hostId: null, started: false });
    setScreen('home');
  }, [cleanup]);

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
      haptic('light');
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

  // ================= RENDER =================
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0e22" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {screen === 'home' && (
          <HomeScreen
            name={name}
            setName={setName}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            onHost={hostGame}
            onJoin={joinGame}
            onSolo={startSolo}
            bots={bots}
            setBots={setBots}
            balance={balance}
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
            onLeave={confirmLeave}
          />
        )}

        {screen === 'game' && view && (
          <GameScreen
            view={view}
            meId={meRef.current.id}
            myTurn={myTurn}
            mode={mode}
            role={role}
            status={status}
            onPlay={onPlayCard}
            onDraw={() => send({ type: 'draw', playerId: meRef.current.id })}
            onPass={() => send({ type: 'pass', playerId: meRef.current.id })}
            onLeave={confirmLeave}
          />
        )}

        {screen === 'game' && view && view.status === 'finished' && (
          <WinOverlay
            iWon={view.winner === meRef.current.id}
            winnerName={(view.players.find((p) => p.id === view.winner) || {}).name}
            reward={view.reward}
            balance={balance}
            canNext={mode === 'solo' || role === 'host'}
            onNext={newRound}
            onQuit={leave}
          />
        )}

        {fx && <FxLayer key={fxKey} fx={fx} onDone={() => setFx(null)} />}
        {colorPickFor && <ColorPicker onPick={chooseColor} onCancel={() => setColorPickFor(null)} />}
        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {intro && <IntroSplash onDone={() => setIntro(false)} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------- Home ----------------
function HomeScreen({ name, setName, codeInput, setCodeInput, onHost, onJoin, onSolo, bots, setBots, balance }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.home}>
        <View style={styles.walletChip}>
          <Text style={styles.walletText}>💰 {balance}$</Text>
        </View>

        <View style={styles.logoWrap}>
          <UnoLogo size={72} />
        </View>
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

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>solo · entraînement</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.soloRow}>
          <Text style={styles.label}>Bots :</Text>
          {[1, 2, 3].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.botPick, bots === n && styles.botPickOn]}
              onPress={() => setBots(n)}
            >
              <Text style={[styles.botPickText, bots === n && styles.botPickTextOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={onSolo}>
          <Text style={styles.btnText}>Jouer en solo (vs bots)</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Aucun compte requis · réseau public</Text>
      </ScrollView>
    </LinearGradient>
  );
}

// ---------------- Lobby ----------------
function LobbyScreen({ code, role, status, lobby, meId, onStart, onLeave }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
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
          {lobby.players.length < 2 ? <Text style={styles.waiting}>En attente de joueurs…</Text> : null}
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
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onLeave}>
          <Text style={styles.btnGhostText}>Quitter</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ---------------- Game ----------------
function GameScreen({ view, meId, myTurn, mode, role, status, onPlay, onDraw, onPass, onLeave }) {
  const finished = view.status === 'finished';
  const dirArrow = view.direction === 1 ? '↻' : '↺';

  // deal-in animation
  const dealt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(dealt, { toValue: 1, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  // discard pop on top change
  const discardPop = useRef(new Animated.Value(1)).current;
  const topId = view.top && view.top.id;
  const prevTop = useRef(topId);
  useEffect(() => {
    if (prevTop.current !== topId) {
      prevTop.current = topId;
      discardPop.setValue(0.55);
      Animated.spring(discardPop, { toValue: 1, friction: 4, tension: 130, useNativeDriver: true }).start();
    }
  }, [topId]);

  // turn pulse
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop;
    if (myTurn && !finished) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: false }),
        ])
      );
      loop.start();
    } else {
      pulse.setValue(0);
    }
    return () => loop && loop.stop();
  }, [myTurn, finished]);

  const handStyle = {
    opacity: dealt,
    transform: [{ translateY: dealt.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) }],
  };

  return (
    <LinearGradient colors={GRAD.table} style={{ flex: 1 }}>
      <View style={styles.container}>
        <TopBar title="UNO" status={mode === 'solo' ? 'solo' : status} onLeave={onLeave} logo />

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
                  <View style={styles.oppCards}>
                    <Card faceDown small />
                    <Text style={styles.oppCount}>×{p.count}</Text>
                  </View>
                  {p.count === 1 ? <Text style={styles.unoBadge}>UNO!</Text> : null}
                </View>
              );
            })}
        </View>

        {/* table */}
        <View style={styles.table}>
          <TouchableOpacity onPress={myTurn && !finished ? onDraw : undefined} activeOpacity={0.85}>
            <View style={styles.deckStack}>
              <Card faceDown />
              <View style={styles.deckBadge}>
                <Text style={styles.deckBadgeText}>{view.drawCount}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.centerInfo}>
            <View style={[styles.colorDot, { backgroundColor: CARD_COLORS[view.currentColor] || '#888' }]} />
            <Text style={styles.dir}>{dirArrow}</Text>
          </View>

          <Animated.View style={{ transform: [{ scale: discardPop }] }}>
            <Card card={view.top} />
          </Animated.View>
        </View>

        {/* turn banner */}
        <Animated.Text
          style={[
            styles.turnBanner,
            myTurn && styles.turnMine,
            myTurn && !finished
              ? { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }
              : null,
          ]}
        >
          {finished
            ? ' '
            : myTurn
            ? view.awaitingPlay
              ? 'Joue une carte ou passe'
              : '🟢 À toi de jouer !'
            : `Tour de ${(view.players.find((p) => p.id === view.currentPlayerId) || {}).name || '…'}`}
        </Animated.Text>

        {/* log */}
        <View style={styles.logBox}>
          {view.log.slice(-2).map((l, i) => (
            <Text key={i} style={styles.logLine} numberOfLines={1}>
              {l}
            </Text>
          ))}
        </View>

        {/* my hand */}
        <Animated.View style={[styles.handWrap, handStyle]}>
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
              <Text style={styles.waiting}>{finished ? 'Manche terminée' : 'Tu es spectateur'}</Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function canPlayLocal(card, view) {
  if (card.value === 'wild' || card.value === 'wild4') return true;
  if (card.color === view.currentColor) return true;
  if (view.top && card.value === view.top.value && card.color !== null && view.top.color !== null) return true;
  return false;
}

function ColorPicker({ onPick, onCancel }) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Choisis une couleur</Text>
        <View style={styles.colorGrid}>
          {COLORS.map((c) => (
            <TouchableOpacity key={c} style={[styles.colorTile, { backgroundColor: CARD_COLORS[c] }]} onPress={() => onPick(c)} />
          ))}
        </View>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TopBar({ title, status, onLeave, logo }) {
  const dot =
    status === 'connected' || status === 'solo'
      ? theme.ok
      : status === 'offline' || (status && status.startsWith('error'))
      ? theme.danger
      : theme.accent;
  return (
    <View style={styles.topbar}>
      <TouchableOpacity onPress={onLeave} style={styles.leaveBtn}>
        <Text style={styles.leaveText}>✕</Text>
      </TouchableOpacity>
      {logo ? <UnoLogo size={26} tilt={-8} /> : <Text style={styles.topTitle}>{title}</Text>}
      <View style={styles.statusWrap}>
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
      </View>
    </View>
  );
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0e22' },
  container: { flex: 1, padding: 14 },
  home: { padding: 24, paddingTop: 40, alignItems: 'stretch' },
  walletChip: { alignSelf: 'flex-end', backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  walletText: { color: theme.accent, fontWeight: '900', fontSize: 15 },
  logoWrap: { alignItems: 'center', marginTop: 18, marginBottom: 8 },
  tagline: { color: theme.sub, textAlign: 'center', marginBottom: 22 },
  label: { color: theme.text, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: theme.panel, color: theme.text, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: theme.border },
  codeInput: { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  btnPrimary: { backgroundColor: theme.danger },
  btnGreen: { backgroundColor: theme.ok },
  btnBlue: { backgroundColor: '#2277CC' },
  btnDisabled: { backgroundColor: theme.panel2 },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginTop: 10 },
  btnGhostText: { color: theme.sub, fontWeight: '700' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.sub, marginHorizontal: 12, fontSize: 12 },
  soloRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botPick: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.panel, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  botPickOn: { backgroundColor: '#2277CC', borderColor: '#5aa0e0' },
  botPickText: { color: theme.sub, fontWeight: '900', fontSize: 18 },
  botPickTextOn: { color: '#fff' },
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
  oppChip: { backgroundColor: theme.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: 90 },
  oppActive: { borderColor: theme.accent },
  oppName: { color: theme.text, fontWeight: '700', maxWidth: 90 },
  oppCards: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  oppCount: { color: theme.sub, fontWeight: '800' },
  unoBadge: { color: theme.danger, fontWeight: '900', fontSize: 11, marginTop: 2 },

  table: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginVertical: 14 },
  deckStack: { position: 'relative' },
  deckBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: '#0b0e22', borderColor: theme.accent, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  deckBadgeText: { color: theme.accent, fontWeight: '800', fontSize: 12 },
  centerInfo: { alignItems: 'center', gap: 6 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
  dir: { color: theme.text, fontSize: 26 },

  turnBanner: { textAlign: 'center', color: theme.sub, fontWeight: '700', marginBottom: 4, minHeight: 20 },
  turnMine: { color: theme.ok, fontSize: 16 },

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
