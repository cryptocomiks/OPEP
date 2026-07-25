import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, Platform, KeyboardAvoidingView, Animated, Easing, Alert, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Card, { CardBack } from './src/components/Card';
import UnoLogo from './src/components/UnoLogo';
import IntroSplash from './src/components/IntroSplash';
import FxLayer from './src/components/FxLayer';
import WinOverlay from './src/components/WinOverlay';
import TurnBadge from './src/components/TurnBadge';
import BetModal from './src/components/BetModal';
import MarketScreen from './src/components/MarketScreen';
import ProgressionScreen from './src/components/ProgressionScreen';
import ClanScreen from './src/components/ClanScreen';
import ChatPanel from './src/components/ChatPanel';
import BoxOpen from './src/components/BoxOpen';
import ChatBubbles from './src/components/ChatBubbles';
import MiniGame from './src/components/MiniGame';
import MysteryCard from './src/components/MysteryCard';
import { initSfx, play as playSfx, isMuted, setMuted } from './src/sfx';
import { startRecording, stopRecording, playBase64 } from './src/voice';
import { rankFromRating, ratingDelta } from './src/ranking';
import { CARD_COLORS, theme, GRAD } from './src/theme';
import { createGame, applyAction, publicView, canPlay, COLORS, isWildType, TARGETED } from './src/engine';
import { botAction } from './src/bots';
import { GameClient, makeCode, makeId } from './src/net';
import { getBalance, setBalance as persistBalance, addBalance, getOwned, addOwned, getEquipped, setEquipped, getOwnedChars, addOwnedChar, getEquippedChar, setEquippedChar } from './src/wallet';
import { CHARACTERS, getCharacter, charFromId, rollCharacter, CHAR_BOX_PRICE } from './src/characters';
import { loadProg, saveProg, recordEvent, levelInfo, PASS, PREMIUM_PRICE } from './src/progression';
import { openBox, BOX_PRICE, craftCost } from './src/gacha';
import { SKINS, getSkin } from './src/skins';
import { CLANS, getClan } from './src/clans';
import { SkinContext } from './src/SkinContext';

const randomName = () => {
  const a = ['Rapide', 'Malin', 'Chanceux', 'Rusé', 'Cool', 'Fou', 'Zen', 'Turbo'];
  const b = ['Renard', 'Panda', 'Tigre', 'Hibou', 'Loup', 'Koala', 'Faucon', 'Lynx'];
  return a[Math.floor(Math.random() * a.length)] + ' ' + b[Math.floor(Math.random() * b.length)];
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const haptic = (kind) => {
  try {
    if (kind === 'heavy') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

export default function App() {
  const [intro, setIntro] = useState(true);
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(randomName());
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState('offline');
  const [lobby, setLobby] = useState({ players: [], hostId: null, started: false });
  const [gameState, setGameState] = useState(null);
  const [pendingCard, setPendingCard] = useState(null);
  const [targetPick, setTargetPick] = useState(null);
  const [toast, setToast] = useState('');
  const [balance, setBalance] = useState(0);
  const [bots, setBots] = useState(1);
  const [fx, setFx] = useState(null);
  const [fxKey, setFxKey] = useState(0);
  const [owned, setOwned] = useState(['classic']);
  const [equipped, setEquip] = useState('classic');
  const [betCtx, setBetCtx] = useState(null);
  const [bet, setBet] = useState(null);
  const [prog, setProg] = useState(null);
  const [boxResult, setBoxResult] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [muted, setMutedState] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceTalker, setVoiceTalker] = useState(null);
  const [ownedChars, setOwnedChars] = useState(['kid']);
  const [equippedChar, setEquipChar] = useState('kid');
  const [prevScreen, setPrevScreen] = useState('home');
  const [mystery, setMystery] = useState(null); // {id} active card

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
  const equippedRef = useRef('classic');
  const ownedRef = useRef(['classic']);
  const progRef = useRef(null);
  const recordingRef = useRef(false);
  const recTimerRef = useRef(null);
  const equippedCharRef = useRef('kid');
  const screenRef = useRef('home');
  const tapRef = useRef({ id: null, count: 0, t: 0 });
  const mysteryRef = useRef(null); // {id, claims:[], resolved} host-side
  const mysterySpawnRef = useRef(0);

  useEffect(() => { meRef.current.name = name; }, [name]);
  useEffect(() => { equippedRef.current = equipped; }, [equipped]);
  useEffect(() => { ownedRef.current = owned; }, [owned]);
  useEffect(() => { equippedCharRef.current = equippedChar; }, [equippedChar]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    getBalance().then(setBalance);
    getOwned().then(setOwned);
    getEquipped().then(setEquip);
    getOwnedChars().then(setOwnedChars);
    getEquippedChar().then(setEquipChar);
    loadProg().then((p) => { setProg(p); progRef.current = p; });
    initSfx().then(() => setMutedState(isMuted()));
  }, []);

  const openMini = useCallback(() => {
    if (screenRef.current !== 'mini') setPrevScreen(screenRef.current);
    setScreen('mini');
    haptic('success');
  }, []);

  // triple-tap easter egg detector
  const tripleTap = useCallback((id) => {
    const now = Date.now();
    const r = tapRef.current;
    if (r.id === id && now - r.t < 800) r.count += 1; else { r.id = id; r.count = 1; }
    r.t = now;
    if (r.count >= 3) { r.count = 0; openMini(); }
  }, [openMini]);

  const toggleMute = useCallback(() => {
    const nv = !muted;
    setMutedState(nv);
    setMuted(nv);
    if (!nv) playSfx('tap');
  }, [muted]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);
  const triggerFx = useCallback((f) => { setFx(f); setFxKey((k) => k + 1); }, []);

  const updateProg = useCallback((mut) => {
    setProg((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      mut(next);
      progRef.current = next;
      saveProg(next);
      return next;
    });
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

  const myEntry = () => ({ id: meRef.current.id, name: meRef.current.name, skin: equippedRef.current, clan: progRef.current ? progRef.current.clan : null, rating: progRef.current ? progRef.current.rating : 1000, char: equippedCharRef.current });

  // ---------- characters ----------
  const buyCharBox = useCallback(() => {
    if (balance < CHAR_BOX_PRICE) { flash('Pas assez de cash.'); return; }
    const nb = balance - CHAR_BOX_PRICE; setBalance(nb); persistBalance(nb);
    const ch = rollCharacter(Math.random);
    const dup = ownedChars.includes(ch.id);
    if (!dup) addOwnedChar(ch.id).then(setOwnedChars);
    setEquipChar(ch.id); setEquippedChar(ch.id);
    haptic('success'); flash(`${ch.emoji} ${ch.name}${dup ? ' (doublon)' : ' débloqué'} !`);
  }, [balance, ownedChars, flash]);

  const equipChar = useCallback((id) => { setEquipChar(id); setEquippedChar(id); haptic('light'); }, []);

  // ---------- skins / market ----------
  const buySkin = useCallback((skin) => {
    if (balance < skin.price) { flash('Pas assez de cash.'); return; }
    const nb = balance - skin.price;
    setBalance(nb); persistBalance(nb);
    addOwned(skin.id).then(setOwned);
    setEquip(skin.id); setEquipped(skin.id);
    haptic('success'); flash(`${skin.name} acheté et équipé !`);
  }, [balance, flash]);

  const equipSkin = useCallback((id) => { setEquip(id); setEquipped(id); haptic('light'); }, []);

  const openMysteryBox = useCallback(() => {
    const p = progRef.current;
    if (!p) return;
    const freeBox = (p.boxes || 0) > 0;
    if (!freeBox && balance < BOX_PRICE) { flash('Pas assez de cash.'); return; }
    if (!freeBox) { const nb = balance - BOX_PRICE; setBalance(nb); persistBalance(nb); }
    const result = openBox(ownedRef.current, Math.random);
    if (result.duplicate) {
      updateProg((pp) => { pp.shards = (pp.shards || 0) + result.shards; if (freeBox) pp.boxes -= 1; });
    } else {
      addOwned(result.skinId).then(setOwned);
      updateProg((pp) => { if (freeBox) pp.boxes -= 1; });
    }
    setBoxResult(result);
    haptic('success');
  }, [balance, flash, updateProg]);

  const craftSkin = useCallback((skin) => {
    const p = progRef.current;
    const cost = craftCost(skin.id);
    if (!p || (p.shards || 0) < cost) { flash('Pas assez d\'éclats.'); return; }
    updateProg((pp) => { pp.shards -= cost; });
    addOwned(skin.id).then(setOwned);
    setEquip(skin.id); setEquipped(skin.id);
    haptic('success'); flash(`${skin.name} fabriqué !`);
  }, [flash, updateProg]);

  // ---------- progression claims ----------
  const claimMission = useCallback((id) => {
    const p = progRef.current;
    const m = p && p.missions.items.find((x) => x.id === id);
    if (!m || m.claimed || m.progress < m.target) return;
    addBalance(m.cash).then(setBalance);
    updateProg((pp) => {
      const mm = pp.missions.items.find((x) => x.id === id);
      if (mm) { mm.claimed = true; pp.xp += m.xp; }
    });
    haptic('success'); flash(`Mission accomplie : +${m.cash}$`);
  }, [updateProg, flash]);

  const claimTier = useCallback((tier, track) => {
    const p = progRef.current;
    if (!p) return;
    if (levelInfo(p.xp).unlocked < tier) return;
    if (track === 'premium' && !p.premium) return;
    const list = track === 'premium' ? p.claimedPrem : p.claimedFree;
    if (list.includes(tier)) return;
    const t = PASS.find((x) => x.tier === tier);
    const r = track === 'premium' ? t.premium : t.free;
    if (r.cash) addBalance(r.cash).then(setBalance);
    if (r.skin) addOwned(r.skin).then(setOwned);
    updateProg((pp) => {
      (track === 'premium' ? pp.claimedPrem : pp.claimedFree).push(tier);
      if (r.shards) pp.shards = (pp.shards || 0) + r.shards;
      if (r.box) pp.boxes = (pp.boxes || 0) + r.box;
    });
    haptic('success'); flash(`Récompense palier ${tier} récupérée !`);
  }, [updateProg, flash]);

  const buyPremium = useCallback(() => {
    if (balance < PREMIUM_PRICE) { flash('Pas assez de cash.'); return; }
    const nb = balance - PREMIUM_PRICE; setBalance(nb); persistBalance(nb);
    updateProg((pp) => { pp.premium = true; });
    haptic('success'); flash('Passe Premium débloqué ⭐');
  }, [balance, updateProg, flash]);

  const chooseClan = useCallback((id) => {
    updateProg((pp) => { pp.clan = id; });
    haptic('light');
    const c = getClan(id);
    flash(c ? `Clan ${c.name} choisi !` : 'Sans clan.');
    setScreen('home');
  }, [updateProg, flash]);

  // ---------- betting ----------
  const applyBet = useCallback((b) => {
    if (b.amount > balance) { flash('Solde insuffisant.'); return false; }
    const nb = balance - b.amount; setBalance(nb); persistBalance(nb);
    betRef.current = b; setBet(b); flash(`Mise de ${b.amount}$ placée.`);
    return true;
  }, [balance, flash]);

  // ---------- SOLO ----------
  const doStartSolo = useCallback((players) => {
    modeRef.current = 'solo'; setMode('solo'); roleRef.current = 'host'; setRole('host');
    lobbyRef.current = { players, hostId: meRef.current.id, started: true };
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(players, seed);
    stateRef.current = st; rewardAppliedRef.current = false;
    prevRef.current = { seq: st.eventSeq, finished: false, init: false };
    setChatMessages([]); setGameState({ ...st }); setScreen('game');
  }, []);

  const startSolo = useCallback(() => {
    const me = myEntry();
    const players = [{ ...me, name: me.name || 'Toi' }];
    for (let i = 1; i <= bots; i++) players.push({ id: 'bot' + i, name: 'Bot ' + i, skin: pick(SKINS).id, clan: pick([...CLANS.map((c) => c.id), null]) });
    setBetCtx({ mode: 'solo', players, onGo: () => doStartSolo(players) });
  }, [bots, doStartSolo]);

  const applyLocal = useCallback((action) => {
    const st = stateRef.current;
    if (!st) return;
    const res = applyAction(st, action);
    if (res.ok) { stateRef.current = res.state; setGameState({ ...res.state }); }
    else if (action.playerId === meRef.current.id) flash(res.error);
  }, [flash]);

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

  // ---------- multi client factory ----------
  const attachChat = (data) => setChatMessages((prev) => [...prev, data].slice(-60));
  const handleVoice = (data) => {
    if (!data || data.pid === meRef.current.id) return;
    setVoiceTalker(data.name);
    playBase64(data.b64);
    setTimeout(() => setVoiceTalker((t) => (t === data.name ? null : t)), 3500);
  };
  const mysteryAmount = () => (Math.random() < 0.65 ? 500 : -(150 + Math.floor(Math.random() * 151)));
  const applyMysteryResult = (amount) => {
    addBalance(amount).then(setBalance);
    flash(amount >= 0 ? `🎁 Carte mystère : +${amount}$ !` : `💥 Carte mystère : ${amount}$ …`);
    haptic(amount >= 0 ? 'success' : 'heavy');
    playSfx(amount >= 0 ? 'win' : 'explode');
  };
  const handleMystery = (data) => {
    if (!data) return;
    if (data.type === 'spawn') { setMystery({ id: data.id }); playSfx('turn'); }
    else if (data.type === 'result') {
      if (data.winner === meRef.current.id) applyMysteryResult(data.amount);
      else flash(`Carte mystère prise par ${data.name || 'un joueur'} !`);
      setMystery(null);
    } else if (data.type === 'claim' && roleRef.current === 'host') {
      const m = mysteryRef.current;
      if (!m || m.id !== data.id || m.resolved) return;
      m.resolved = true;
      clientRef.current && clientRef.current.sendMystery({ type: 'result', id: data.id, winner: data.pid, name: data.name, amount: mysteryAmount() });
    }
  };
  const claimMystery = useCallback(() => {
    const m = mystery;
    if (!m) return;
    setMystery(null);
    if (modeRef.current === 'solo') { applyMysteryResult(mysteryAmount()); }
    else if (clientRef.current) { clientRef.current.sendMystery({ type: 'claim', id: m.id, pid: meRef.current.id, name: meRef.current.name, ts: Date.now() }); }
  }, [mystery]);

  // ---------- HOST ----------
  const hostGame = useCallback(() => {
    const newCode = makeCode();
    const me = myEntry();
    modeRef.current = 'multi'; setMode('multi'); roleRef.current = 'host'; setRole('host');
    setCode(newCode); setChatMessages([]);
    lobbyRef.current = { players: [me], hostId: me.id, started: false };

    const client = new GameClient(newCode, {
      onStatus: (s) => setStatus(s),
      onChat: attachChat,
      onVoice: handleVoice,
      onMystery: handleMystery,
      onJoin: (player) => {
        const lob = lobbyRef.current;
        if (lob.started || !player || !player.id) return;
        if (!lob.players.find((p) => p.id === player.id)) {
          lob.players = [...lob.players, { id: player.id, name: player.name || 'Joueur', skin: player.skin || 'classic', clan: player.clan || null }];
          setLobby({ ...lob });
        }
        client.publishLobby(lob);
      },
      onAction: (action) => {
        const st = stateRef.current;
        if (!st) return;
        const res = applyAction(st, action);
        if (res.ok) { stateRef.current = res.state; setGameState({ ...res.state }); client.publishState(res.state); }
      },
    });
    clientRef.current = client;
    client.connect();
    client.client.on('connect', () => { client.subscribeAsHost(); client.publishLobby(lobbyRef.current); });
    setLobby({ ...lobbyRef.current }); setScreen('lobby');
  }, []);

  const startGame = useCallback(() => {
    const lob = lobbyRef.current;
    if (lob.players.length < 2) { flash('Il faut au moins 2 joueurs.'); return; }
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(lob.players, seed);
    stateRef.current = st; lob.started = true; lobbyRef.current = lob;
    rewardAppliedRef.current = false;
    prevRef.current = { seq: st.eventSeq, finished: false, init: false };
    setLobby({ ...lob }); setGameState({ ...st });
    clientRef.current.publishLobby(lob); clientRef.current.publishState(st);
    setScreen('game');
  }, [flash]);

  const newRound = useCallback(() => {
    const lob = lobbyRef.current;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const st = createGame(lob.players, seed);
    stateRef.current = st; rewardAppliedRef.current = false; betRef.current = null; setBet(null);
    prevRef.current = { seq: st.eventSeq, finished: false, init: false };
    setGameState({ ...st });
    if (modeRef.current === 'multi' && clientRef.current) clientRef.current.publishState(st);
  }, []);

  // ---------- GUEST ----------
  const joinGame = useCallback(() => {
    const c = codeInput.trim().toUpperCase();
    if (c.length < 4) { flash('Entre un code valide.'); return; }
    const me = myEntry();
    modeRef.current = 'multi'; setMode('multi'); roleRef.current = 'guest'; setRole('guest');
    setCode(c); setChatMessages([]);

    const client = new GameClient(c, {
      onStatus: (s) => setStatus(s),
      onChat: attachChat,
      onVoice: handleVoice,
      onMystery: handleMystery,
      onLobby: (lob) => {
        lobbyRef.current = lob; setLobby(lob);
        if (!lob.players.find((p) => p.id === me.id) && !lob.started) client.sendJoin(me);
        if (lob.started) setScreen('game');
      },
      onState: (st) => { stateRef.current = st; setGameState({ ...st }); if (roleRef.current === 'guest') setScreen('game'); },
    });
    clientRef.current = client;
    client.connect();
    client.client.on('connect', () => {
      client.subscribeAsGuest(); client.sendJoin(me);
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        const lob = lobbyRef.current;
        if ((lob.players && lob.players.find((p) => p.id === me.id)) || tries > 6) { clearInterval(iv); return; }
        client.sendJoin(me);
      }, 1200);
    });
    setScreen('lobby');
  }, [codeInput, flash]);

  const sendChatMsg = useCallback((text) => {
    if (!clientRef.current) return;
    clientRef.current.sendChat({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, pid: meRef.current.id, name: meRef.current.name, clan: progRef.current ? progRef.current.clan : null, text });
  }, []);

  const stopTalk = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false; setRecording(false);
    if (recTimerRef.current) { clearTimeout(recTimerRef.current); recTimerRef.current = null; }
    const b64 = await stopRecording();
    if (b64 && clientRef.current) clientRef.current.sendVoice({ pid: meRef.current.id, name: meRef.current.name, b64 });
  }, []);

  const startTalk = useCallback(async () => {
    if (recordingRef.current) return;
    const ok = await startRecording();
    if (!ok) { flash('Micro indisponible (permission ?).'); return; }
    recordingRef.current = true; setRecording(true);
    haptic('light');
    recTimerRef.current = setTimeout(() => { stopTalk(); }, 8000);
  }, [flash, stopTalk]);

  const send = useCallback((action) => {
    if (modeRef.current === 'solo') applyLocal(action);
    else if (clientRef.current) clientRef.current.sendAction(action);
  }, [applyLocal]);

  const view = gameState ? publicView(gameState, meRef.current.id) : null;
  const myTurn = view && view.currentPlayerId === meRef.current.id && view.status === 'playing';

  const recordMission = useCallback((type, amount = 1) => updateProg((p) => recordEvent(p, { type, amount })), [updateProg]);

  // ---------- event-driven FX + cash + missions ----------
  useEffect(() => {
    if (!gameState) return;
    const meId = meRef.current.id;
    const v = publicView(gameState, meId);
    const prev = prevRef.current;

    if (!prev.init) { prevRef.current = { seq: v.eventSeq, finished: v.status === 'finished', init: true }; return; }

    if (v.eventSeq !== prev.seq && v.lastEvent) {
      const ev = v.lastEvent;
      if (v.status === 'playing') {
        switch (ev.type) {
          case 'draw2': triggerFx({ type: 'plus', value: ev.type, toMe: ev.target === meId }); haptic('heavy'); playSfx('plus'); break;
          case 'wild4': triggerFx({ type: 'plus', value: ev.type, toMe: ev.target === meId }); haptic('heavy'); playSfx('explode'); break;
          case 'skip': triggerFx({ type: 'lock', toMe: ev.target === meId }); haptic('heavy'); playSfx('tap'); break;
          case 'reverse': triggerFx({ type: 'flip' }); haptic('light'); playSfx('swap'); break;
          case 'swap': triggerFx({ type: 'swap', toMe: ev.target === meId }); haptic('heavy'); playSfx('swap'); break;
          case 'renew': triggerFx({ type: 'renew', n: ev.n, toMe: ev.target === meId }); haptic('heavy'); playSfx('draw'); break;
          case 'shield': triggerFx({ type: 'shield', toMe: ev.player === meId }); haptic('heavy'); playSfx('shield'); break;
          case 'shield_block': triggerFx({ type: 'shieldblock', toMe: ev.target === meId }); haptic('heavy'); playSfx('shield'); break;
          case 'spell': triggerFx({ type: 'spell', toMe: ev.player !== meId }); haptic('heavy'); playSfx('swap'); break;
          case 'steal': triggerFx({ type: 'steal', toMe: ev.target === meId }); haptic('heavy'); playSfx('steal'); break;
          case 'heal': triggerFx({ type: 'heal' }); haptic('light'); playSfx('turn'); break;
          case 'draw': if (ev.player === meId) { triggerFx({ type: 'draw', n: ev.n }); haptic('light'); playSfx('draw'); } break;
          case 'wild': case 'play': if (ev.player !== meId) playSfx('play'); break;
          default: break;
        }
      }
      // missions (only my actions)
      if (ev.player === meId) {
        if (ev.type === 'swap') recordMission('play_swap');
        else if (ev.type === 'renew') recordMission('play_renew');
        else if (ev.type === 'wild4') recordMission('play_wild4');
        else if (ev.type === 'draw') recordMission('draw', ev.n);
      }
      if (ev.type === 'shield_block' && ev.target === meId) recordMission('shield_block');
    }

    if (v.status === 'finished' && !prev.finished) {
      let credited = 0;
      const won = v.winner === meId;
      if (won && !rewardAppliedRef.current) { rewardAppliedRef.current = true; credited += v.reward; haptic('success'); playSfx('win'); }
      else haptic('light');
      const b = betRef.current;
      if (b && b.on === v.winner) { credited += b.amount * b.odds; flash(`🎉 Pari gagné : +${b.amount * b.odds}$ !`); }
      betRef.current = null; setBet(null);
      if (credited > 0) addBalance(credited).then(setBalance); else getBalance().then(setBalance);

      // ranking update
      const opps = v.players.filter((p) => p.id !== meId);
      const avgOpp = opps.length ? Math.round(opps.reduce((a, p) => a + (p.rating || 1000), 0) / opps.length) : 1000;
      updateProg((p) => {
        p.xp += won ? 30 : 10;
        const before = rankFromRating(p.rating || 1000).name;
        const d = ratingDelta(won, p.rating || 1000, avgOpp, opps.length);
        p.rating = Math.max(0, (p.rating || 1000) + d);
        if (won) p.wins = (p.wins || 0) + 1; else p.losses = (p.losses || 0) + 1;
        const after = rankFromRating(p.rating);
        if (after.name !== before && p.rating > (p.rating - d)) {
          setTimeout(() => triggerFx({ type: 'rankup', icon: after.icon, rank: after.name, color: after.color }), 1400);
        }
        flash(`${won ? 'Victoire' : 'Défaite'} · ${d >= 0 ? '+' : ''}${d} pts (${rankFromRating(p.rating).name})`);
        if (won) {
          recordEvent(p, { type: 'win', amount: 1 });
          if (modeRef.current === 'solo') recordEvent(p, { type: 'win_solo', amount: 1 });
          if (v.top && v.top.value === 'wild4') recordEvent(p, { type: 'win_plus4_last', amount: 1 });
        }
      });
    }

    prevRef.current = { seq: v.eventSeq, finished: v.status === 'finished', init: true };
  }, [gameState, triggerFx, flash, recordMission, updateProg]);

  useEffect(() => {
    if (myTurn && !prevTurnRef.current) { haptic('light'); playSfx('turn'); }
    prevTurnRef.current = myTurn;
  }, [myTurn]);

  // random mystery-card spawner (solo locally, host in multiplayer)
  useEffect(() => {
    if (screen !== 'game') return;
    const isSpawner = modeRef.current === 'solo' || roleRef.current === 'host';
    if (!isSpawner) return;
    const iv = setInterval(() => {
      const st = stateRef.current;
      if (!st || st.status !== 'playing') return;
      if (mysteryRef.current && !mysteryRef.current.resolved) return;
      if (Math.random() < 0.4) {
        const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        mysteryRef.current = { id, resolved: false };
        if (modeRef.current === 'solo') { setMystery({ id }); playSfx('turn'); }
        else if (clientRef.current) clientRef.current.sendMystery({ type: 'spawn', id });
        setTimeout(() => setMystery((cur) => (cur && cur.id === id ? null : cur)), 6000);
      }
    }, 9000);
    return () => clearInterval(iv);
  }, [screen]);

  const confirmLeave = useCallback(() => {
    Alert.alert('Quitter la partie ?', 'Tu vas revenir au menu principal.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => leave() },
    ]);
  }, []);

  const leave = useCallback(() => {
    cleanup();
    setGameState(null); setRole(null); roleRef.current = null; modeRef.current = null;
    setMode(null); setFx(null); setBet(null); setChatOpen(false); setChatMessages([]);
    setMystery(null); mysteryRef.current = null;
    setLobby({ players: [], hostId: null, started: false }); setScreen('home');
  }, [cleanup]);

  const onPlayCard = useCallback((card) => {
    if (!myTurn) { flash("Ce n'est pas ton tour."); return; }
    if (!canPlay(card, stateRef.current)) { flash('Carte non jouable.'); return; }
    haptic('light'); playSfx('play');
    if (isWildType(card)) { setPendingCard({ cardId: card.id, value: card.value }); return; }
    send({ type: 'play', playerId: meRef.current.id, cardId: card.id });
  }, [myTurn, send, flash]);

  const chooseColor = useCallback((color) => {
    const pc = pendingCard; setPendingCard(null);
    if (!pc) return;
    if (TARGETED.includes(pc.value)) setTargetPick({ cardId: pc.cardId, color });
    else send({ type: 'play', playerId: meRef.current.id, cardId: pc.cardId, color });
  }, [pendingCard, send]);

  const chooseTarget = useCallback((targetId) => {
    const tp = targetPick; setTargetPick(null);
    if (!tp) return;
    send({ type: 'play', playerId: meRef.current.id, cardId: tp.cardId, color: tp.color, target: targetId });
  }, [targetPick, send]);

  const clanId = prog ? prog.clan : null;

  return (
    <SkinContext.Provider value={equipped}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0b0e22" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {screen === 'home' && (
            <HomeScreen
              name={name} setName={setName} codeInput={codeInput} setCodeInput={setCodeInput}
              onHost={hostGame} onJoin={joinGame} onSolo={startSolo}
              onMarket={() => setScreen('market')} onPass={() => setScreen('progress')} onClan={() => setScreen('clan')}
              bots={bots} setBots={setBots} balance={balance} clanId={clanId} prog={prog}
              muted={muted} onMute={toggleMute} character={getCharacter(equippedChar)} onSecretTap={() => tripleTap('logo')}
            />
          )}

          {screen === 'market' && (
            <MarketScreen
              balance={balance} shards={prog ? prog.shards : 0} boxes={prog ? prog.boxes : 0}
              owned={owned} equipped={equipped}
              onBuy={buySkin} onEquip={equipSkin} onOpenBox={openMysteryBox} onCraft={craftSkin}
              ownedChars={ownedChars} equippedChar={equippedChar} charBoxPrice={CHAR_BOX_PRICE}
              onCharBox={buyCharBox} onEquipChar={equipChar}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'mini' && (
            <MiniGame
              character={getCharacter(equippedChar)}
              balance={balance}
              muted={muted}
              onSpend={(amount) => {
                if (balance < amount) return false;
                const nb = balance - amount; setBalance(nb); persistBalance(nb); return true;
              }}
              onClose={() => setScreen(prevScreen || 'home')}
            />
          )}

          {screen === 'progress' && prog && (
            <ProgressionScreen prog={prog} balance={balance} onClaimMission={claimMission} onClaimTier={claimTier} onBuyPremium={buyPremium} onBack={() => setScreen('home')} />
          )}

          {screen === 'clan' && (
            <ClanScreen current={clanId} onChoose={chooseClan} onBack={() => setScreen('home')} />
          )}

          {screen === 'lobby' && (
            <LobbyScreen
              code={code} role={role} status={status} lobby={lobby} meId={meRef.current.id} bet={bet}
              onStart={startGame} onLeave={confirmLeave} onBet={() => setBetCtx({ mode: 'lobby', players: lobbyRef.current.players })}
              onChat={() => setChatOpen(true)}
            />
          )}

          {screen === 'game' && view && (
            <GameScreen
              view={view} meId={meRef.current.id} myTurn={myTurn} mode={mode} status={status} bet={bet}
              onPlay={onPlayCard} onDraw={() => send({ type: 'draw', playerId: meRef.current.id })}
              onPass={() => send({ type: 'pass', playerId: meRef.current.id })}
              onLeave={confirmLeave} onChat={() => setChatOpen(true)}
              onSecretTap={() => tripleTap('discard')}
            />
          )}

          {screen === 'game' && view && view.status === 'finished' && (
            <WinOverlay
              iWon={view.winner === meRef.current.id}
              winnerName={(view.players.find((p) => p.id === view.winner) || {}).name}
              reward={view.reward} balance={balance}
              canNext={mode === 'solo' || role === 'host'} onNext={newRound} onQuit={leave}
            />
          )}

          {screen === 'game' && mode === 'multi' && (
            <>
              <ChatBubbles messages={chatMessages} meId={meRef.current.id} />
              {voiceTalker ? (
                <View style={styles.voiceInd} pointerEvents="none"><Text style={styles.voiceIndText}>🎤 {voiceTalker} parle…</Text></View>
              ) : null}
              <Pressable onPressIn={startTalk} onPressOut={stopTalk} style={[styles.micBtn, recording && styles.micBtnOn]}>
                <Text style={styles.micIcon}>🎤</Text>
                {recording ? <Text style={styles.micRec}>REC</Text> : null}
              </Pressable>
            </>
          )}

          {screen === 'game' && mystery && <MysteryCard onClaim={claimMystery} />}

          {fx && <FxLayer key={fxKey} fx={fx} onDone={() => setFx(null)} />}
          {pendingCard && <ColorPicker onPick={chooseColor} onCancel={() => setPendingCard(null)} />}
          {targetPick && view && (
            <TargetPicker players={view.players.filter((p) => p.id !== meRef.current.id)} onPick={chooseTarget} onCancel={() => setTargetPick(null)} />
          )}
          {betCtx && (
            <BetModal
              players={betCtx.players} meId={meRef.current.id} balance={balance}
              onConfirm={(b) => { const ok = applyBet(b); const go = betCtx.onGo; setBetCtx(null); if (ok && go) go(); }}
              onSkip={() => { const go = betCtx.onGo; setBetCtx(null); if (go) go(); }}
            />
          )}
          {boxResult && <BoxOpen result={boxResult} onDone={() => setBoxResult(null)} />}
          {chatOpen && (mode === 'multi') && (
            <ChatPanel messages={chatMessages} meId={meRef.current.id} onSend={sendChatMsg} onClose={() => setChatOpen(false)} />
          )}
          {toast ? (<View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View>) : null}
          {intro && <IntroSplash onDone={() => setIntro(false)} />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SkinContext.Provider>
  );
}

// ---------------- Home ----------------
function HomeScreen({ name, setName, codeInput, setCodeInput, onHost, onJoin, onSolo, onMarket, onPass, onClan, bots, setBots, balance, clanId, prog, muted, onMute, character, onSecretTap }) {
  const clan = getClan(clanId);
  const li = prog ? levelInfo(prog.xp) : { tier: 0 };
  const rank = rankFromRating(prog ? prog.rating : 1000);
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.home}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconChip} onPress={onMute}><Text style={styles.walletText}>{muted ? '🔇' : '🔊'}</Text></TouchableOpacity>
          <View style={styles.walletChip}><Text style={styles.walletText}>💰 {balance}$</Text></View>
          <View style={styles.walletChip}><Text style={styles.walletText}>💎 {prog ? prog.shards : 0}</Text></View>
        </View>

        <View style={[styles.rankBanner, { borderColor: rank.color }]}>
          <View style={[styles.charBubble, { backgroundColor: character.color }]}><Text style={styles.charEmoji}>{character.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rankName, { color: rank.color }]}>{rank.icon} {rank.name}</Text>
            <Text style={styles.rankPts}>{prog ? prog.rating : 1000} pts · {prog ? prog.wins || 0 : 0}V / {prog ? prog.losses || 0 : 0}D</Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <NavCard icon="🛍️" label="Boutique" onPress={onMarket} />
          <NavCard icon="🏆" label={li.tier > 0 ? `Passe ${li.tier}` : 'Passe'} onPress={onPass} />
          <NavCard icon={clan ? clan.icon : '⚔️'} label={clan ? clan.name : 'Clan'} onPress={onClan} color={clan ? clan.color : undefined} />
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={onSecretTap} style={styles.logoWrap}><UnoLogo size={68} /></TouchableOpacity>
        <Text style={styles.tagline}>Joue avec tes amis · rejoins avec un code</Text>

        <Text style={styles.label}>Ton pseudo</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ton pseudo" placeholderTextColor={theme.sub} maxLength={16} />

        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onHost}><Text style={styles.btnText}>Créer une partie</Text></TouchableOpacity>

        <Text style={styles.label}>Rejoindre avec un code</Text>
        <TextInput style={[styles.input, styles.codeInput]} value={codeInput} onChangeText={(t) => setCodeInput(t.toUpperCase())} placeholder="EX: K7P2M" placeholderTextColor={theme.sub} autoCapitalize="characters" maxLength={6} />
        <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={onJoin}><Text style={styles.btnText}>Rejoindre</Text></TouchableOpacity>

        <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>solo · entraînement</Text><View style={styles.line} /></View>
        <View style={styles.soloRow}>
          <Text style={styles.label}>Bots :</Text>
          {[1, 2, 3].map((n) => (
            <TouchableOpacity key={n} style={[styles.botPick, bots === n && styles.botPickOn]} onPress={() => setBots(n)}>
              <Text style={[styles.botPickText, bots === n && styles.botPickTextOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={onSolo}><Text style={styles.btnText}>Jouer en solo (vs bots)</Text></TouchableOpacity>
        <Text style={styles.footer}>Aucun compte requis · réseau public</Text>
      </ScrollView>
    </LinearGradient>
  );
}

// ---------------- Lobby ----------------
function LobbyScreen({ code, role, status, lobby, meId, bet, onStart, onLeave, onBet, onChat }) {
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.betBtn} onPress={onChat}><Text style={styles.betBtnText}>💬</Text></TouchableOpacity>
            <TouchableOpacity style={styles.betBtn} onPress={onBet}><Text style={styles.betBtnText}>{bet ? `🎲 ${bet.amount}$` : '💵 Parier'}</Text></TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }}>
          {lobby.players.map((p) => {
            const clan = getClan(p.clan);
            const ch = p.char ? getCharacter(p.char) : charFromId(p.id);
            return (
              <View key={p.id} style={styles.playerRow}>
                <View style={[styles.avatar, { backgroundColor: ch.color }]}><Text style={styles.avatarText}>{ch.emoji}</Text></View>
                <Text style={styles.playerName}>{rankFromRating(p.rating || 1000).icon} {clan ? clan.icon + ' ' : ''}{p.name}</Text>
                {p.id === lobby.hostId ? <Text style={styles.hostTag}>hôte</Text> : null}
                {p.id === meId ? <Text style={styles.youTag}>toi</Text> : null}
              </View>
            );
          })}
          {lobby.players.length < 2 ? <Text style={styles.waiting}>En attente de joueurs…</Text> : null}
        </ScrollView>
        {role === 'host' ? (
          <TouchableOpacity style={[styles.btn, lobby.players.length >= 2 ? styles.btnPrimary : styles.btnDisabled]} onPress={onStart} disabled={lobby.players.length < 2}><Text style={styles.btnText}>Lancer la partie</Text></TouchableOpacity>
        ) : (<Text style={styles.waiting}>L'hôte va lancer la partie…</Text>)}
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onLeave}><Text style={styles.btnGhostText}>Quitter</Text></TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ---------------- Game ----------------
function GameScreen({ view, meId, myTurn, mode, status, bet, onPlay, onDraw, onPass, onLeave, onChat, onSecretTap }) {
  const finished = view.status === 'finished';
  const dirArrow = view.direction === 1 ? '↻' : '↺';
  const me = view.players.find((p) => p.id === meId) || {};

  const dealt = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(dealt, { toValue: 1, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);

  const discardPop = useRef(new Animated.Value(1)).current;
  const topId = view.top && view.top.id;
  const prevTop = useRef(topId);
  useEffect(() => {
    if (prevTop.current !== topId) {
      prevTop.current = topId; discardPop.setValue(0.55);
      Animated.spring(discardPop, { toValue: 1, friction: 4, tension: 130, useNativeDriver: true }).start();
    }
  }, [topId]);

  const handStyle = { opacity: dealt, transform: [{ translateY: dealt.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) }] };

  return (
    <LinearGradient colors={GRAD.felt} style={{ flex: 1 }}>
      <View style={styles.feltVignette} pointerEvents="none" />
      <View style={styles.container}>
        <TopBar title="UNO" status={mode === 'solo' ? 'solo' : status} onLeave={onLeave} logo onChat={mode === 'multi' ? onChat : null} />

        <View style={styles.opponents}>
          {view.players.filter((p) => p.id !== meId).map((p) => {
            const active = p.id === view.currentPlayerId && !finished;
            const clan = getClan(p.clan);
            const ch = p.char ? getCharacter(p.char) : charFromId(p.id);
            return (
              <View key={p.id} style={[styles.oppChip, active && styles.oppActive]}>
                <View style={styles.oppHead}>
                  <View style={[styles.oppSprite, { backgroundColor: ch.color }]}><Text style={styles.oppSpriteText}>{ch.emoji}</Text></View>
                  <Text style={styles.oppName} numberOfLines={1}>{rankFromRating(p.rating).icon} {clan ? clan.icon + ' ' : ''}{p.name}</Text>
                </View>
                <View style={styles.oppCards}>
                  <CardBack small skin={p.skin} />
                  <Text style={styles.oppCount}>×{p.count}</Text>
                </View>
                <View style={styles.oppTags}>
                  {p.shield > 0 ? <Text style={styles.shieldTag}>🛡️{p.shield}</Text> : null}
                  {p.count === 1 ? <Text style={styles.unoBadge}>UNO!</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.tableFelt}>
          <View style={styles.table}>
            <TouchableOpacity onPress={myTurn && !finished ? onDraw : undefined} activeOpacity={0.85}>
              <View style={styles.deckStack}>
                <Card faceDown />
                <View style={styles.deckBadge}><Text style={styles.deckBadgeText}>{view.drawCount}</Text></View>
              </View>
            </TouchableOpacity>
            <View style={styles.centerInfo}>
              <View style={[styles.colorDot, { backgroundColor: CARD_COLORS[view.currentColor] || '#888' }]} />
              <Text style={styles.dir}>{dirArrow}</Text>
            </View>
            <TouchableOpacity activeOpacity={1} onPress={onSecretTap}>
              <Animated.View style={{ transform: [{ scale: discardPop }] }}><Card card={view.top} /></Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoLine}>
          <Text style={[styles.turnBanner, myTurn && styles.turnMine]}>
            {finished ? ' ' : myTurn ? (view.awaitingPlay ? 'Joue une carte ou passe' : 'À toi !') : `Tour de ${(view.players.find((p) => p.id === view.currentPlayerId) || {}).name || '…'}`}
          </Text>
          {bet ? <Text style={styles.betLine}>🎲 {bet.amount}$ · ×{bet.odds}</Text> : null}
        </View>

        <View style={styles.logBox}>
          {view.log.slice(-2).map((l, i) => (<Text key={i} style={styles.logLine} numberOfLines={1}>{l}</Text>))}
        </View>

        <Animated.View style={[styles.handWrap, handStyle]}>
          <View style={styles.handHeader}>
            <Text style={styles.handTitle}>
              Ta main ({view.yourHand.length}){me.shield > 0 ? `  · 🛡️${me.shield}` : ''}{view.yourHand.length === 1 ? '  ·  UNO !' : ''}
            </Text>
            {myTurn && view.awaitingPlay ? (<TouchableOpacity style={styles.passBtn} onPress={onPass}><Text style={styles.passText}>Passer</Text></TouchableOpacity>) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
            {view.yourHand.map((c) => {
              const playable = myTurn && !finished && canPlayLocal(c, view);
              return (<View key={c.id} style={styles.handCard}><Card card={c} onPress={() => onPlay(c)} dim={myTurn && !playable} /></View>);
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
  if (card.color === null) return true;
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
          {COLORS.map((c) => (<TouchableOpacity key={c} style={[styles.colorTile, { backgroundColor: CARD_COLORS[c] }]} onPress={() => onPick(c)} />))}
        </View>
        <TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity>
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
        <TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function NavCard({ icon, label, onPress, color }) {
  return (
    <TouchableOpacity style={styles.navCard} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={[styles.navLabel, color && { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function TopBar({ title, status, onLeave, logo, onChat }) {
  const dot = status === 'connected' || status === 'solo' ? theme.ok : status === 'offline' || (status && status.startsWith('error')) ? theme.danger : theme.accent;
  return (
    <View style={styles.topbar}>
      <TouchableOpacity onPress={onLeave} style={styles.leaveBtn}><Text style={styles.leaveText}>✕</Text></TouchableOpacity>
      {logo ? <UnoLogo size={26} tilt={-8} /> : <Text style={styles.topTitle}>{title}</Text>}
      <View style={styles.statusWrap}>
        {onChat ? <TouchableOpacity onPress={onChat} style={styles.chatBtn}><Text style={styles.chatIcon}>💬</Text></TouchableOpacity> : null}
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0e22' },
  container: { flex: 1, padding: 14 },
  home: { padding: 20, paddingTop: 20, alignItems: 'stretch' },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  walletChip: { backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  iconChip: { backgroundColor: theme.panel, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 'auto' },
  walletText: { color: theme.accent, fontWeight: '900', fontSize: 14 },
  rankBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginTop: 12, backgroundColor: theme.panel, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2 },
  charBubble: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  charEmoji: { fontSize: 26 },
  rankName: { fontWeight: '900', fontSize: 18 },
  rankPts: { color: theme.sub, fontSize: 12, marginTop: 1 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navCard: { flex: 1, backgroundColor: theme.panel, borderColor: theme.border, borderWidth: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', gap: 4 },
  navIcon: { fontSize: 24 },
  navLabel: { color: theme.text, fontWeight: '800', fontSize: 12 },
  logoWrap: { alignItems: 'center', marginTop: 14, marginBottom: 6 },
  tagline: { color: theme.sub, textAlign: 'center', marginBottom: 16 },
  label: { color: theme.text, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: theme.panel, color: theme.text, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: theme.border },
  codeInput: { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 14 },
  btnPrimary: { backgroundColor: theme.danger },
  btnGreen: { backgroundColor: theme.ok },
  btnBlue: { backgroundColor: '#2277CC' },
  btnDisabled: { backgroundColor: theme.panel2 },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginTop: 10 },
  btnGhostText: { color: theme.sub, fontWeight: '700' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.sub, marginHorizontal: 12, fontSize: 12 },
  soloRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botPick: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.panel, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  botPickOn: { backgroundColor: '#2277CC', borderColor: '#5aa0e0' },
  botPickText: { color: theme.sub, fontWeight: '900', fontSize: 18 },
  botPickTextOn: { color: '#fff' },
  footer: { color: theme.sub, textAlign: 'center', marginTop: 22, fontSize: 12 },

  topbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  leaveBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  leaveText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  topTitle: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22, letterSpacing: 2 },
  statusWrap: { width: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  chatBtn: { padding: 2 },
  chatIcon: { fontSize: 20 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },

  codeBox: { backgroundColor: theme.panel, borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  codeLabel: { color: theme.sub, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  codeBig: { color: theme.text, fontSize: 44, fontWeight: '900', letterSpacing: 10, marginVertical: 6 },
  codeHint: { color: theme.sub, fontSize: 12, textAlign: 'center' },

  lobbyActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  betBtn: { backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  betBtnText: { color: theme.accent, fontWeight: '800' },
  sectionTitle: { color: theme.text, fontWeight: '800', fontSize: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.panel, borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#1a1a1a', fontWeight: '900' },
  playerName: { color: theme.text, fontWeight: '700', flex: 1 },
  hostTag: { color: '#1a1a1a', backgroundColor: theme.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  youTag: { color: '#fff', backgroundColor: theme.ok, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  waiting: { color: theme.sub, textAlign: 'center', marginVertical: 12 },

  feltVignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 40, borderColor: 'rgba(0,0,0,0.22)' },
  opponents: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 6 },
  oppChip: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: 92 },
  oppActive: { borderColor: theme.accent },
  oppHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  oppSprite: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  oppSpriteText: { fontSize: 13 },
  oppName: { color: theme.text, fontWeight: '700', maxWidth: 80 },
  oppCards: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  oppCount: { color: '#dfe4ff', fontWeight: '800' },
  oppTags: { flexDirection: 'row', gap: 6, marginTop: 2 },
  shieldTag: { color: '#ffd23f', fontWeight: '900', fontSize: 11 },
  unoBadge: { color: '#ff6b6b', fontWeight: '900', fontSize: 11 },

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
  micBtn: { position: 'absolute', right: 16, bottom: 200, width: 58, height: 58, borderRadius: 29, backgroundColor: '#2277CC', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 25, elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6 },
  micBtnOn: { backgroundColor: '#E4342B', transform: [{ scale: 1.12 }] },
  micIcon: { fontSize: 24 },
  micRec: { color: '#fff', fontSize: 8, fontWeight: '900' },
  voiceInd: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: 'rgba(34,119,204,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, zIndex: 25 },
  voiceIndText: { color: '#fff', fontWeight: '800' },
});
