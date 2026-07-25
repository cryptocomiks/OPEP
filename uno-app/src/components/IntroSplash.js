import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import UnoLogo from './UnoLogo';
import { CARD_COLORS } from '../theme';

const FAN = [
  { color: CARD_COLORS.red },
  { color: CARD_COLORS.yellow },
  { color: '#141726' },
  { color: CARD_COLORS.green },
  { color: CARD_COLORS.blue },
];

// A one-shot intro: a fan of cards opens, the logo pops, the fan closes, fade out.
export default function IntroSplash({ onDone }) {
  const spread = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone && onDone());
  };

  useEffect(() => {
    Animated.sequence([
      Animated.timing(spread, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.timing(logo, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(spread, { toValue: 0, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.delay(120),
    ]).start(() => finish());
    // safety auto-dismiss
    const t = setTimeout(finish, 4200);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish}>
        <LinearGradient colors={['#161a3a', '#0b0e22']} style={StyleSheet.absoluteFill} />
        <View style={styles.center}>
          <View style={styles.fanArea}>
            {FAN.map((c, i) => {
              const off = i - 2;
              const rot = spread.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${off * 15}deg`] });
              const tx = spread.interpolate({ inputRange: [0, 1], outputRange: [0, off * 52] });
              const ty = spread.interpolate({ inputRange: [0, 1], outputRange: [0, Math.abs(off) * 14] });
              return (
                <Animated.View
                  key={i}
                  style={[styles.card, { backgroundColor: c.color, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }] }]}
                >
                  <View style={styles.cardOval} />
                </Animated.View>
              );
            })}
          </View>
          <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
            <UnoLogo size={84} />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 },
  fanArea: { width: 200, height: 150, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    width: 78,
    height: 116,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOval: { width: '130%', height: '55%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', transform: [{ rotate: '-20deg' }] },
});
