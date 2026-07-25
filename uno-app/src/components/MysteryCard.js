import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, Pressable } from 'react-native';

// A glowing "?" card that floats in during a game. First to tap claims it.
export default function MysteryCard({ onClaim }) {
  const a = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(a, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scale = Animated.multiply(a, glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }));
  const ty = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <Pressable style={styles.wrap} onPress={onClaim} pointerEvents="box-only">
      <Animated.View style={[styles.card, { opacity: a, transform: [{ scale }, { translateY: ty }] }]}>
        <Text style={styles.q}>?</Text>
        <Text style={styles.label}>MYSTÈRE</Text>
        <Text style={styles.hint}>Tape vite !</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: '34%', alignSelf: 'center', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  card: {
    width: 120, height: 168, borderRadius: 16, backgroundColor: '#12142e',
    borderWidth: 4, borderColor: '#ffd23f', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ffd23f', shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 18,
  },
  q: { color: '#ffd23f', fontSize: 72, fontWeight: '900', fontStyle: 'italic' },
  label: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
  hint: { color: '#ff6b6b', fontWeight: '800', fontSize: 12, marginTop: 2 },
});
