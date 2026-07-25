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
import TurnBadge from './src/components/TurnBadge';
import BetModal from './src/components/BetModal';
import MarketScreen from './src/components/MarketScreen';
import { CARD_COLORS, theme, GRAD } from './src/theme';
import { createGame, applyAction, publicView, canPlay, COLORS, isWildType, TARGETED } from './src/engine';
import { botAction } from './src/bots';
import { GameClient, makeCode, makeId } from './src/net';
import { getBalance, setBalance as persistBalance, addBalance, getOwned, addOwned, getEquipped, setEquipped } from './src/wallet';
import { SkinContext } from './src/SkinContext';

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
  const [screen, setScreen] = useState('home'); // home | lobby | game | market
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(randomName());
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState('offline');
  const [lobby, setLobby] = useState({ players: [], hostId: null, started: false });
  const [gameState, setGameState] = useState(null);
  const [pendingCard, setPendingCard] = useState(null); // {cardId, value} wild-type awaiting color
  const [targetPick, setTargetPick] = useState(null); // {cardId, color} awaiting target
  const [toast, setToast] = useState('');
  const [balance, setBalance] = useState(0);
  const [bots, setBots] = useState(1);
  const [fx, setFx] = useState(null);
  const [fxKey, setFxKey] = useState(0);
  const [owned, setOwned] = useState(['classic']);
  const [equipped, setEquip] = useState('classic');
  const [betCtx, setBetCtx] = useState(null); // {mode, players, onGo}
  const [bet, setBet] = useState(null); // active wager for display

  const meRef = useRef({ id: makeId(), name });
  const clientRef = useRef(null);
  const stateRef = useRef(null);
  const lobbyRef = useRef({ players: [], hostId: null, started: false });
  const roleRef = useRef(null);
  const modeRef = useRef(null);
  const prevRef = useRef({ seq: 0, finished: false, init: false });
  const rewardAppliedRef = useRef(false);
  const betRef = useRef(null);
  const prevTurnRef = useRef(false);

  useEffect(() => {
    meRef.current.name = name;
  }, [name]);

  useEffect(() => {
    getBalance().then(setBalance);
    getOwned().then(setOwned);
    getEquipped().then(setEquip);
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
    prevRef.current = { seq: 0, finished: false, init: false };
    betRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ---------- skins / market ----------
  const buySkin = useCallback(
    (skin) => {
      if (balance < skin.price) {
        flash('Pas assez de cash.');
        return;
      }
      const nb = balance - skin.price;
      setBalance(nb);
      persistBalance(nb);
      addOwned(skin.id).then(setOwned);
      setEquip(skin.id);
      setEquipped(skin.id);
      haptic('success');
      flash(`${skin.name} acheté et équipé !`);
    },
    [balance, flash]
  );

  const equipSkin = useCallback((id) => {
    setEquip(id);
    setEquipped(id);
    haptic('light');
  }, []);

  // ---------- betting ----------
  const applyBet = useCallback(
    (b) => {
      if (b.amount > balance) {
        flash('Solde insuffisant.');
        return false;
      }
      const nb = balance - b.amount;
      setBalance(nb);
      persistBalance(nb);
      betRef.current = b;
      setBet(b);
      flash(`Mise de ${b.amount}$ placée.`);
      return true;
    },
    [balance, flash]
  );

  // ---------- SOLO ----------
  const doStartSolo = useCallback((players) => {
    modeRef.current = 'solo';
    setMode('solo');
    roleRef.current = 'host';
    setRole('host');
    lobbyRef.current = { players, hostId: meRef.current.id, started: true };
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(players, seed);
    stateRef.current = st;
    rewardAppliedRef.current = false;
    prevRef.current = { seq: st.eventSeq, finished: false, init: false };
    setGameState({ ...st });
    setScreen('game');
  }, []);

  const startSolo = useCallback(() => {
    const me = meRef.current;
    const players = [{ id: me.id, name: me.name || 'Toi' }];
    for (let i = 1; i <= bots; i++) players.push({ id: 'bot' + i, name: 'Bot ' + i });
    setBetCtx({ mode: 'solo', players, onGo: () => doStartSolo(players) });
  }, [bots, doStartSolo]);

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

  // bot loop (solo)
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
    prevRef.current = { seq: st.eventSeq, finished: false, init: false };
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
    betRef.current = null;
    setBet(null);
    prevRef.current = { seq: st.eventSeq, finished: false, init: false };
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

  // ---------- event-driven FX + cash ----------
  useEffect(() => {
    if (!gameState) return;
    const meId = meRef.current.id;
    const v = publicView(gameState, meId);
    const prev = prevRef.current;

    if (!prev.init) {
      prevRef.current = { seq: v.eventSeq, finished: v.status === 'finished', init: true };
      return;
    }

    if (v.eventSeq !== prev.seq && v.status === 'playing' && v.lastEvent) {
      const ev = v.lastEvent;
      switch (ev.type) {
        case 'draw2':
        case 'wild4':
          triggerFx({ type: 'plus', value: ev.type, toMe: ev.target === meId });
          haptic('heavy');
          break;
        case 'skip':
          triggerFx({ type: 'lock', toMe: ev.target === meId });
          haptic('heavy');
          break;
        case 'swap':
          triggerFx({ type: 'swap', toMe: ev.target === meId });
          haptic('heavy');
          break;
        case 'renew':
          triggerFx({ type: 'renew', n: ev.n, toMe: ev.target === meId });
          haptic('heavy');
          break;
        case 'draw':
          if (ev.player === meId) {
            triggerFx({ type: 'draw', n: ev.n });
            haptic('light');
          }
          break;
        default:
          break;
      }
    }

    if (v.status === 'finished' && !prev.finished) {
      let credited = 0;
      if (v.winner === meId && !rewardAppliedRef.current) {
        rewardAppliedRef.current = true;
        credited += v.reward;
        haptic('success');
      } else {
        haptic('light');
      }
      const b = betRef.current;
      if (b && b.on === v.winner) {
        credited += b.amount * b.odds;
        flash(`🎉 Pari gagné : +${b.amount * b.odds}$ !`);
      }
      betRef.current = null;
      setBet(null);
      if (credited > 0) addBalance(credited).then(setBalance);
      else getBalance().then(setBalance);
    }

    prevRef.current = { seq: v.eventSeq, finished: v.status === 'finished', init: true };
  }, [gameState, triggerFx, flash]);

  // haptic when it becomes my turn
  useEffect(() => {
    if (myTurn && !prevTurnRef.current) haptic('light');
    prevTurnRef.current = myTurn;
  }, [myTurn]);

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
    setBet(null);
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
      if (isWildType(card)) {
        setPendingCard({ cardId: card.id, value: card.value });
        return;
      }
      send({ type: 'play', playerId: meRef.current.id, cardId: card.id });
    },
    [myTurn, send, flash]
  );

  const chooseColor = useCallback(
    (color) => {
      const pc = pendingCard;
      setPendingCard(null);
      if (!pc) return;
      if (TARGETED.includes(pc.value)) {
        setTargetPick({ cardId: pc.cardId, color });
      } else {
        send({ type: 'play', playerId: meRef.current.id, cardId: pc.cardId, color });
      }
    },
    [pendingCard, send]
  );

  const chooseTarget = useCallback(
    (targetId) => {
      const tp = targetPick;
      setTargetPick(null);
      if (!tp) return;
      send({ type: 'play', playerId: meRef.current.id, cardId: tp.cardId, color: tp.color, target: targetId });
    },
    [targetPick, send]
  );

  // ================= RENDER =================
  return (
    <SkinContext.Provider value={equipped}>
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
              onMarket={() => setScreen('market')}
              bots={bots}
              setBots={setBots}
              balance={balance}
            />
          )}

          {screen === 'market' && (
            <MarketScreen
              balance={balance}
              owned={owned}
              equipped={equipped}
              onBuy={buySkin}
              onEquip={equipSkin}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'lobby' && (
            <LobbyScreen
              code={code}
              role={role}
              status={status}
              lobby={lobby}
              meId={meRef.current.id}
              bet={bet}
              onStart={startGame}
              onLeave={confirmLeave}
              onBet={() => setBetCtx({ mode: 'lobby', players: lobbyRef.current.players })}
            />
          )}

          {screen === 'game' && view && (
            <GameScreen
              view={view}
              meId={meRef.current.id}
              myTurn={myTurn}
              mode={mode}
              status={status}
              bet={bet}
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
          {pendingCard && <ColorPicker onPick={chooseColor} onCancel={() => setPendingCard(null)} />}
          {targetPick && view && (
            <TargetPicker
              players={view.players.filter((p) => p.id !== meRef.current.id)}
              onPick={chooseTarget}
              onCancel={() => setTargetPick(null)}
            />
          )}
          {betCtx && (
            <BetModal
              players={betCtx.players}
              meId={meRef.current.id}
              balance={balance}
              onConfirm={(b) => {
                const ok = applyBet(b);
                const go = betCtx.onGo;
                setBetCtx(null);
                if (ok && go) go();
              }}
              onSkip={() => {
                const go = betCtx.onGo;
                setBetCtx(null);
                if (go) go();
              }}
            />
          )}
          {toast ? (
            <View style={styles.toast} pointerEvents="none">
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}

          {intro && <IntroSplash onDone={() => setIntro(false)} />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SkinContext.Provider>
  );
}

// ---------------- Home ----------------
function HomeScreen({ name, setName, codeInput, setCodeInput, onHost, onJoin, onSolo, onMarket, bots, setBots, balance }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.home}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.marketBtn} onPress={onMarket}>
            <Text style={styles.marketText}>🛍️ Boutique</Text>
          </TouchableOpacity>
          <View style={styles.walletChip}>
            <Text style={styles.walletText}>💰 {balance}$</Text>
          </View>
        </View>

        <View style={styles.logoWrap}>
          <UnoLogo size={72} />
        </View>
        <Text style={styles.tagline}>Joue avec tes amis · rejoins avec un code</Text>

        <Text style={styles.label}>Ton pseudo</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ton pseudo" placeholderTextColor={theme.sub} maxLength={16} />

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
            <TouchableOpacity key={n} style={[styles.botPick, bots === n && styles.botPickOn]} onPress={() => setBots(n)}>
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
function LobbyScreen({ code, role, status, lobby, meId, bet, onStart, onLeave, onBet }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <View style={styles.container}>
        <TopBar title="Salon" status={status} onLeave={onLeave} />
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Code de la partie</Text>
          <Text style={styles.codeBig}>{code}</Text>
          <Text style={styles.codeHint}>Partage ce code pour que tes amis rejoignent</Text>
        </View>

        <View style={styles.lobbyActions}>
          <Text style={styles.sectionTitle}>Joueurs ({lobby.players.length})</Text>
          <TouchableOpacity style={styles.betBtn} onPress={onBet}>
            <Text style={styles.betBtnText}>{bet ? `🎲 ${bet.amount}$ misés` : '💵 Parier'}</Text>
          </TouchableOpacity>
        </View>

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
          <TouchableOpacity style={[styles.btn, lobby.players.length >= 2 ? styles.btnPrimary : styles.btnDisabled]} onPress={onStart} disabled={lobby.players.length < 2}>
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
function GameScreen({ view, meId, myTurn, mode, status, bet, onPlay, onDraw, onPass, onLeave }) {
  const finished = view.status === 'finished';
  const dirArrow = view.direction === 1 ? '↻' : '↺';

  const dealt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(dealt, { toValue: 1, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

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

  const handStyle = {
    opacity: dealt,
    transform: [{ translateY: dealt.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) }],
  };

  return (
    <LinearGradient colors={GRAD.felt} style={{ flex: 1 }}>
      <View style={styles.feltVignette} pointerEvents="none" />
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
                  <Text style={styles.oppName} numberOfLines={1}>{p.name}</Text>
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
        <View style={styles.tableFelt}>
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
        </View>

        {/* turn / bet line */}
        <View style={styles.infoLine}>
          <Text style={[styles.turnBanner, myTurn && styles.turnMine]}>
            {finished ? ' ' : myTurn ? (view.awaitingPlay ? 'Joue une carte ou passe' : 'À toi !') : `Tour de ${(view.players.find((p) => p.id === view.currentPlayerId) || {}).name || '…'}`}
          </Text>
          {bet ? <Text style={styles.betLine}>🎲 {bet.amount}$ · ×{bet.odds}</Text> : null}
        </View>

        {/* log */}
        <View style={styles.logBox}>
          {view.log.slice(-2).map((l, i) => (
            <Text key={i} style={styles.logLine} numberOfLines={1}>{l}</Text>
          ))}
        </View>

        {/* my hand */}
        <Animated.View style={[styles.handWrap, handStyle]}>
          <View style={styles.handHeader}>
            <Text style={styles.handTitle}>Ta main ({view.yourHand.length}){view.yourHand.length === 1 ? '  ·  UNO !' : ''}</Text>
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
            {view.yourHand.length === 0 ? <Text style={styles.waiting}>{finished ? 'Manche terminée' : 'Tu es spectateur'}</Text> : null}
          </ScrollView>
        </Animated.View>
      </View>

      <TurnBadge visible={myTurn && !finished && !view.awaitingPlay} />
    </LinearGradient>
  );
}

function canPlayLocal(card, view) {
  if (card.color === null) return true; // wild-type
  if (card.color === view.currentColor) return true;
  if (view.top && card.value === view.top.value && view.top.color !== null) return true;
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

function TargetPicker({ players, onPick, onCancel }) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Choisis un joueur</Text>
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          {players.map((p) => (
            <TouchableOpacity key={p.id} style={styles.targetRow} onPress={() => onPick(p.id)}>
              <Text style={styles.targetName}>{p.name}</Text>
              <Text style={styles.targetCount}>🂠 {p.count}</Text>
            </TouchableOpacity>
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
  home: { padding: 24, paddingTop: 24, alignItems: 'stretch' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marketBtn: { backgroundColor: theme.panel, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  marketText: { color: theme.text, fontWeight: '800' },
  walletChip: { backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
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
  leaveBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  leaveText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  topTitle: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22, letterSpacing: 2 },
  statusWrap: { width: 34, alignItems: 'flex-end' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },

  codeBox: { backgroundColor: theme.panel, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  codeLabel: { color: theme.sub, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  codeBig: { color: theme.text, fontSize: 46, fontWeight: '900', letterSpacing: 10, marginVertical: 6 },
  codeHint: { color: theme.sub, fontSize: 12, textAlign: 'center' },

  lobbyActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  betBtn: { backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  betBtnText: { color: theme.accent, fontWeight: '800' },
  sectionTitle: { color: theme.text, fontWeight: '800', fontSize: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.panel, borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#1a1a1a', fontWeight: '900' },
  playerName: { color: theme.text, fontWeight: '700', flex: 1 },
  hostTag: { color: '#1a1a1a', backgroundColor: theme.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  youTag: { color: '#fff', backgroundColor: theme.ok, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  waiting: { color: theme.sub, textAlign: 'center', marginVertical: 12 },

  feltVignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0, borderWidth: 40, borderColor: 'rgba(0,0,0,0.22)' },
  opponents: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 6 },
  oppChip: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: 90 },
  oppActive: { borderColor: theme.accent },
  oppName: { color: theme.text, fontWeight: '700', maxWidth: 90 },
  oppCards: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  oppCount: { color: '#dfe4ff', fontWeight: '800' },
  unoBadge: { color: '#ffd23f', fontWeight: '900', fontSize: 11, marginTop: 2 },

  tableFelt: { alignItems: 'center', justifyContent: 'center', marginVertical: 12, paddingVertical: 14, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  table: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  deckStack: { position: 'relative' },
  deckBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: '#0b0e22', borderColor: theme.accent, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  deckBadgeText: { color: theme.accent, fontWeight: '800', fontSize: 12 },
  centerInfo: { alignItems: 'center', gap: 6 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
  dir: { color: theme.text, fontSize: 26 },

  infoLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 22 },
  turnBanner: { textAlign: 'center', color: '#dfe4ff', fontWeight: '700' },
  turnMine: { color: '#9dffc0', fontSize: 16 },
  betLine: { color: theme.accent, fontWeight: '800', fontSize: 12 },

  logBox: { minHeight: 34, marginBottom: 4, marginTop: 2 },
  logLine: { color: '#cfe6d8', fontSize: 12, textAlign: 'center' },

  handWrap: { marginTop: 'auto', backgroundColor: 'rgba(11,14,34,0.72)', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  handHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  handTitle: { color: theme.text, fontWeight: '800' },
  passBtn: { backgroundColor: theme.panel2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  passText: { color: theme.text, fontWeight: '800' },
  hand: { paddingVertical: 4, paddingHorizontal: 2, gap: 8 },
  handCard: { marginRight: 2 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: theme.panel, borderRadius: 18, padding: 24, alignItems: 'center', width: 300, borderWidth: 1, borderColor: theme.border },
  modalTitle: { color: theme.text, fontWeight: '800', fontSize: 18, marginBottom: 16 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 180, justifyContent: 'space-between', gap: 12 },
  colorTile: { width: 78, height: 78, borderRadius: 14, borderWidth: 3, borderColor: '#fff' },
  cancel: { color: theme.sub, marginTop: 18, fontWeight: '700' },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.panel2, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  targetName: { color: theme.text, fontWeight: '800' },
  targetCount: { color: theme.sub, fontWeight: '700' },

  toast: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, maxWidth: '90%' },
  toastText: { color: '#fff', fontWeight: '600' },
});
