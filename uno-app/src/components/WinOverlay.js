import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import UnoLogo from './UnoLogo';

// End-of-round overlay with an animated cash count-up.
export default function WinOverlay({ iWon, winnerName, reward, balance, canNext, onNext, onQuit }) {
  const pop = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = count.addListener(({ value }) => setShown(Math.round(value)));
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(count, { toValue: iWon ? reward : 0, duration: 1200, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    return () => count.removeListener(id);
  }, []);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={[StyleSheet.absoluteFill, styles.fill]}>
      <LinearGradient colors={iWon ? ['#1b2a1b', '#0b0e22'] : ['#2a1b1b', '#0b0e22']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale }] }]}>
        <UnoLogo size={54} />
        <Text style={[styles.title, { color: iWon ? '#33d17a' : '#ff6b6b' }]}>
          {iWon ? '🏆 GAGNÉ !' : 'Manche terminée'}
        </Text>
        <Text style={styles.winner}>{iWon ? 'Tu remportes la manche' : `${winnerName || '?'} remporte la manche`}</Text>

        <View style={styles.cashBox}>
          <Text style={styles.cashLabel}>{iWon ? 'GAINS' : 'GAINS DU VAINQUEUR'}</Text>
          <Text style={styles.cash}>{iWon ? '+' : ''}{iWon ? shown : reward}$</Text>
          <Text style={styles.balance}>💰 Solde : {balance}$</Text>
        </View>

        <View style={styles.actions}>
          {canNext ? (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onNext}>
              <Text style={styles.btnText}>Nouvelle manche</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.waiting}>En attente de l'hôte…</Text>
          )}
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onQuit}>
            <Text style={styles.btnGhostText}>Quitter</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center', gap: 8, width: '100%' },
  title: { fontSize: 40, fontWeight: '900', fontStyle: 'italic', marginTop: 14 },
  winner: { color: '#cfd4ff', fontSize: 15, marginBottom: 8 },
  cashBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 44,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 12,
  },
  cashLabel: { color: '#a9b0e0', fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  cash: { color: '#F5C518', fontSize: 52, fontWeight: '900', fontStyle: 'italic', marginVertical: 2 },
  balance: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  actions: { width: '100%', gap: 10, marginTop: 8 },
  btn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#E4342B' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  btnGhostText: { color: '#cfd4ff', fontWeight: '700' },
  waiting: { color: '#a9b0e0', textAlign: 'center', paddingVertical: 8 },
});
