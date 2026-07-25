import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardBack } from './Card';
import { RARITY } from '../skins';

// Mystery-box reveal overlay. result = { skin, rarity, duplicate, shards }
export default function BoxOpen({ result, onDone }) {
  const shake = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const rar = RARITY[result.rarity] || RARITY.common;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone && onDone();
  };

  useEffect(() => {
    Animated.sequence([
      Animated.sequence(
        [10, -10, 8, -8, 6, -6, 0].map((to) => Animated.timing(shake, { toValue: to, duration: 60, useNativeDriver: true }))
      ),
      Animated.spring(reveal, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
  }, []);

  const boxOpacity = reveal.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] });
  const cardScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <Pressable style={[StyleSheet.absoluteFill, styles.fill]} onPress={finish}>
      <LinearGradient colors={['#12142e', '#08091c']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.box, { opacity: boxOpacity, transform: [{ translateX: shake }] }]}>
        <Text style={styles.boxEmoji}>🎁</Text>
      </Animated.View>

      <Animated.View style={[styles.reveal, { opacity: reveal, transform: [{ scale: cardScale }] }]}>
        <View style={[styles.glow, { shadowColor: rar.color, borderColor: rar.color }]}>
          <CardBack skin={result.skin.id} animated />
        </View>
        <Text style={[styles.rarity, { color: rar.color }]}>{rar.name}</Text>
        <Text style={styles.name}>{result.skin.name}</Text>
        {result.duplicate ? (
          <Text style={styles.dup}>Doublon · +{result.shards} 💎 éclats</Text>
        ) : (
          <Text style={styles.new}>✦ Nouveau skin !</Text>
        )}
        <Text style={styles.tap}>Toucher pour continuer</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center' },
  box: { position: 'absolute' },
  boxEmoji: { fontSize: 110 },
  reveal: { alignItems: 'center', gap: 6 },
  glow: { borderRadius: 16, borderWidth: 3, padding: 6, shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 16 },
  rarity: { fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '900' },
  dup: { color: '#8be9ff', fontWeight: '800', marginTop: 4 },
  new: { color: '#7be06a', fontWeight: '800', marginTop: 4 },
  tap: { color: '#8890c0', marginTop: 18, fontSize: 12 },
});
