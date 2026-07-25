import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MAP, MAP_W, MAP_H, START, tileAt, isWalkable, isGrass, isShop, encounter, pickWild, damage, catchChance } from '../mongame';
import { MONS, getMon } from '../mons';
import { loadMon, saveMon } from '../monstore';
import { playMusic, stopMusic, play as playSfx } from '../sfx';
import { theme } from '../theme';

const { width: SW } = Dimensions.get('window');
const TILE = Math.floor(Math.min(SW - 24, 360) / MAP_W);
const TILE_BG = { 0: '#d9c48a', 1: '#1f7a3a', 2: '#57d06a', 3: '#3fa9ff', 4: '#8a6d3b', 5: '#c0392b' };
const TILE_EMOJI = { 1: '🌲', 3: '', 4: '🏠', 5: '🏪' };

export default function MiniGame({ character, balance, onSpend, onClose, muted }) {
  const [mon, setMon] = useState(null);
  const [pos, setPos] = useState(START);
  const [mode, setMode] = useState('world'); // world | battle | dex | shop
  const [wild, setWild] = useState(null);
  const [myHp, setMyHp] = useState(1);
  const [log, setLog] = useState('Explore les hautes herbes pour trouver des monstres !');
  const busy = useRef(false);

  useEffect(() => {
    loadMon().then((m) => setMon(m));
    if (!muted) playMusic();
    return () => stopMusic();
  }, []);

  const persist = (m) => { setMon(m); saveMon(m); };
  const active = mon ? getMon(mon.party[0]) : null;
  const myMax = active ? active.hp + 12 : 1;

  const move = (dx, dy) => {
    if (mode !== 'world' || !mon) return;
    const nx = pos.x + dx, ny = pos.y + dy;
    const t = tileAt(nx, ny);
    if (isShop(t)) { setMode('shop'); return; }
    if (!isWalkable(t)) return;
    setPos({ x: nx, y: ny });
    if (isGrass(t) && encounter(Math.random)) startBattle();
  };

  const startBattle = () => {
    const w = pickWild(Math.random, 1);
    setWild(w);
    setMyHp(myMax);
    setLog(`Un ${w.mon.name} sauvage (Nv.${w.level}) apparaît !`);
    setMode('battle');
    playSfx('turn');
  };

  const wildTurn = (w, curMyHp) => {
    const dmg = damage(w.mon.atk, Math.random);
    const nh = Math.max(0, curMyHp - dmg);
    setMyHp(nh);
    if (nh <= 0) {
      setLog(`Ton ${active.name} est K.O. ! Tu fuis...`);
      playSfx('plus');
      setTimeout(() => { setMode('world'); setWild(null); }, 1200);
      return false;
    }
    setLog((l) => l + `\n${w.mon.name} riposte (-${dmg}).`);
    return true;
  };

  const attack = () => {
    if (busy.current || !wild) return;
    busy.current = true;
    const dmg = damage(active.atk, Math.random);
    const nhp = Math.max(0, wild.hp - dmg);
    const w = { ...wild, hp: nhp };
    setWild(w);
    playSfx('play');
    if (nhp <= 0) {
      setLog(`${w.mon.name} s'enfuit, épuisé ! (essaie de l'affaiblir puis capture)`);
      setTimeout(() => { setMode('world'); setWild(null); busy.current = false; }, 1200);
      return;
    }
    setLog(`Tu infliges ${dmg} dégâts.`);
    setTimeout(() => { wildTurn(w, myHp); busy.current = false; }, 500);
  };

  const throwBall = (kind) => {
    if (busy.current || !wild || !mon) return;
    const have = kind === 'super' ? mon.superballs : mon.balls;
    if (have <= 0) { setLog('Plus de balls de ce type !'); return; }
    busy.current = true;
    const m2 = { ...mon };
    if (kind === 'super') m2.superballs -= 1; else m2.balls -= 1;
    const frac = wild.hp / wild.maxHp;
    const chance = catchChance(wild.mon, frac, kind === 'super' ? 1.6 : 1);
    playSfx('draw');
    if (Math.random() < chance) {
      if (!m2.dex.includes(wild.mon.id)) m2.dex.push(wild.mon.id);
      if (!m2.party.includes(wild.mon.id)) m2.party.push(wild.mon.id);
      persist(m2);
      setLog(`✨ Gagné ! ${wild.mon.name} est capturé et ajouté au Pokédex !`);
      playSfx('catch');
      setTimeout(() => { setMode('world'); setWild(null); busy.current = false; }, 1500);
    } else {
      persist(m2);
      setLog(`Zut ! ${wild.mon.name} s'est libéré...`);
      setTimeout(() => { wildTurn(wild, myHp); busy.current = false; }, 600);
    }
  };

  const usePotion = () => {
    if (busy.current || !mon) return;
    if (mon.potions <= 0) { setLog('Plus de potions !'); return; }
    busy.current = true;
    persist({ ...mon, potions: mon.potions - 1 });
    setMyHp(myMax);
    setLog('Ton monstre récupère toute sa santé !');
    playSfx('shield');
    setTimeout(() => { wildTurn(wild, myMax); busy.current = false; }, 500);
  };

  const flee = () => { setMode('world'); setWild(null); busy.current = false; setLog('Tu prends la fuite.'); };

  const buy = (item, price) => {
    if (!onSpend(price)) { setLog('Pas assez de cash UNO !'); return; }
    const m2 = { ...mon };
    if (item === 'ball') m2.balls += 5;
    else if (item === 'super') m2.superballs += 2;
    else if (item === 'potion') m2.potions += 3;
    persist(m2);
    setLog('Achat effectué !');
    playSfx('tap');
  };

  if (!mon) return <View style={styles.fill}><Text style={styles.loading}>Chargement de Lavenvyl…</Text></View>;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={['#123', '#061018']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.back}><Text style={styles.backText}>‹ Sortir</Text></TouchableOpacity>
        <Text style={styles.title}>Lavenvyl</Text>
        <Text style={styles.cash}>💰 {balance}$</Text>
      </View>

      {mode === 'world' && (
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
          <View style={styles.map}>
            {MAP.map((row, y) => (
              <View key={y} style={{ flexDirection: 'row' }}>
                {row.map((t, x) => {
                  const here = pos.x === x && pos.y === y;
                  return (
                    <View key={x} style={[styles.tile, { width: TILE, height: TILE, backgroundColor: TILE_BG[t] || '#333' }]}>
                      {here ? <Text style={{ fontSize: TILE * 0.7 }}>{character.emoji}</Text> : <Text style={{ fontSize: TILE * 0.6 }}>{isGrass(t) ? '🌿' : TILE_EMOJI[t] || ''}</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <Text style={styles.log}>{log}</Text>

          <View style={styles.dpad}>
            <View style={styles.dRow}><Pad label="▲" onPress={() => move(0, -1)} /></View>
            <View style={styles.dRow}>
              <Pad label="◀" onPress={() => move(-1, 0)} />
              <View style={{ width: 58 }} />
              <Pad label="▶" onPress={() => move(1, 0)} />
            </View>
            <View style={styles.dRow}><Pad label="▼" onPress={() => move(0, 1)} /></View>
          </View>

          <View style={styles.worldBtns}>
            <TouchableOpacity style={styles.wBtn} onPress={() => setMode('dex')}><Text style={styles.wBtnText}>📕 Pokédex ({mon.dex.length}/{MONS.length})</Text></TouchableOpacity>
            <TouchableOpacity style={styles.wBtn} onPress={() => setMode('shop')}><Text style={styles.wBtnText}>🎒 Sac · 🔴{mon.balls} 🔵{mon.superballs} 🧪{mon.potions}</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {mode === 'battle' && wild && (
        <View style={styles.battle}>
          <View style={styles.wildBox}>
            <Text style={styles.wildName}>{wild.mon.name} Nv.{wild.level} · {wild.mon.type}</Text>
            <HpBar hp={wild.hp} max={wild.maxHp} color="#ff6b6b" />
            <Text style={styles.bigMon}>{wild.mon.emoji}</Text>
          </View>
          <View style={styles.myBox}>
            <Text style={styles.bigMon}>{active.emoji}</Text>
            <Text style={styles.wildName}>{active.name} · le tien</Text>
            <HpBar hp={myHp} max={myMax} color="#33d17a" />
          </View>
          <Text style={styles.battleLog}>{log}</Text>
          <View style={styles.actions}>
            <BtlBtn label="⚔️ Attaque" onPress={attack} />
            <BtlBtn label={`🔴 Ball (${mon.balls})`} onPress={() => throwBall('normal')} />
            <BtlBtn label={`🔵 Super (${mon.superballs})`} onPress={() => throwBall('super')} />
            <BtlBtn label={`🧪 Potion (${mon.potions})`} onPress={usePotion} />
            <BtlBtn label="🏃 Fuir" onPress={flee} />
          </View>
        </View>
      )}

      {mode === 'dex' && (
        <ScrollView contentContainerStyle={styles.dexWrap}>
          <Text style={styles.subtitle}>Pokédex — {mon.dex.length}/{MONS.length}</Text>
          <View style={styles.dexGrid}>
            {MONS.map((m) => {
              const got = mon.dex.includes(m.id);
              return (
                <View key={m.id} style={[styles.dexCell, { borderColor: got ? m.color : theme.border }]}>
                  <Text style={styles.dexEmoji}>{got ? m.emoji : '❔'}</Text>
                  <Text style={styles.dexName}>{got ? m.name : '???'}</Text>
                  {got ? <Text style={[styles.dexType, { color: m.color }]}>{m.type}</Text> : null}
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setMode('world')}><Text style={styles.closeText}>Retour</Text></TouchableOpacity>
        </ScrollView>
      )}

      {mode === 'shop' && (
        <View style={styles.shop}>
          <Text style={styles.subtitle}>🏪 Boutique de Lavenvyl</Text>
          <Text style={styles.shopHint}>Payé avec ton cash UNO. Solde : {balance}$</Text>
          <ShopItem label="🔴 5 Balls" price={50} onBuy={() => buy('ball', 50)} />
          <ShopItem label="🔵 2 Super Balls" price={120} onBuy={() => buy('super', 120)} />
          <ShopItem label="🧪 3 Potions" price={60} onBuy={() => buy('potion', 60)} />
          <Text style={styles.bag}>Sac : 🔴{mon.balls} · 🔵{mon.superballs} · 🧪{mon.potions}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setMode('world')}><Text style={styles.closeText}>Sortir de la boutique</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Pad({ label, onPress }) {
  return <TouchableOpacity style={styles.pad} onPress={onPress}><Text style={styles.padText}>{label}</Text></TouchableOpacity>;
}
function BtlBtn({ label, onPress }) {
  return <TouchableOpacity style={styles.btlBtn} onPress={onPress}><Text style={styles.btlText}>{label}</Text></TouchableOpacity>;
}
function ShopItem({ label, price, onBuy }) {
  return (
    <View style={styles.shopItem}>
      <Text style={styles.shopLabel}>{label}</Text>
      <TouchableOpacity style={styles.shopBuy} onPress={onBuy}><Text style={styles.shopBuyText}>{price}$</Text></TouchableOpacity>
    </View>
  );
}
function HpBar({ hp, max, color }) {
  return (
    <View style={styles.hpBg}>
      <View style={[styles.hpFill, { width: `${Math.max(0, (hp / max) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#061018' },
  loading: { color: '#fff', textAlign: 'center', marginTop: 80 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  back: { paddingVertical: 6, paddingRight: 10 },
  backText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  title: { flex: 1, textAlign: 'center', color: '#ffd23f', fontWeight: '900', fontSize: 22, fontStyle: 'italic' },
  cash: { color: '#ffd23f', fontWeight: '900' },
  map: { borderWidth: 3, borderColor: '#0a0', borderRadius: 6, overflow: 'hidden', marginTop: 6 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  log: { color: '#cfe6d8', textAlign: 'center', marginVertical: 10, paddingHorizontal: 16, minHeight: 36 },
  dpad: { alignItems: 'center', marginTop: 4 },
  dRow: { flexDirection: 'row', alignItems: 'center' },
  pad: { width: 58, height: 58, margin: 3, borderRadius: 12, backgroundColor: '#1b1f3b', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#343b6e' },
  padText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  worldBtns: { marginTop: 12, gap: 8, width: '86%' },
  wBtn: { backgroundColor: '#1b1f3b', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#343b6e' },
  wBtnText: { color: '#fff', fontWeight: '800' },

  battle: { flex: 1, padding: 16 },
  wildBox: { alignItems: 'flex-end', marginTop: 10 },
  myBox: { alignItems: 'flex-start', marginTop: 6 },
  wildName: { color: '#fff', fontWeight: '800', marginBottom: 4 },
  bigMon: { fontSize: 72 },
  battleLog: { color: '#cfe6d8', minHeight: 44, marginVertical: 8, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 'auto', marginBottom: 20 },
  btlBtn: { backgroundColor: '#2277CC', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  btlText: { color: '#fff', fontWeight: '800' },
  hpBg: { width: 160, height: 12, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#000' },
  hpFill: { height: 12 },

  dexWrap: { padding: 16, alignItems: 'center' },
  subtitle: { color: '#ffd23f', fontWeight: '900', fontSize: 18, marginVertical: 8, textAlign: 'center' },
  dexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  dexCell: { width: 96, backgroundColor: '#101828', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 2 },
  dexEmoji: { fontSize: 34 },
  dexName: { color: '#fff', fontWeight: '800', marginTop: 4 },
  dexType: { fontSize: 11, fontWeight: '700' },

  shop: { flex: 1, padding: 20 },
  shopHint: { color: '#a9b0e0', textAlign: 'center', marginBottom: 12 },
  shopItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1b1f3b', borderRadius: 12, padding: 14, marginBottom: 10 },
  shopLabel: { color: '#fff', fontWeight: '800', fontSize: 16 },
  shopBuy: { backgroundColor: '#33A047', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  shopBuyText: { color: '#fff', fontWeight: '900' },
  bag: { color: '#cfe6d8', textAlign: 'center', marginTop: 10, fontWeight: '700' },
  closeBtn: { backgroundColor: '#E4342B', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  closeText: { color: '#fff', fontWeight: '800' },
});
