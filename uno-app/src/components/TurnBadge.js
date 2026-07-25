import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

// Big, unmissable "TON TOUR" badge. Pops in, then keeps a gentle glow pulse.
export default function TurnBadge({ visible }) {
  const enter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop;
    if (visible) {
      enter.setValue(0);
      Animated.spring(enter, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      Animated.timing(enter, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
    return () => loop && loop.stop();
  }, [visible]);

  if (!visible) return null;

  const scale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })
  );
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.95] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity: enter, transform: [{ scale }] }]}>
      <Animated.View style={[styles.badge, { shadowOpacity }]}>
        <Text style={styles.text}>🟢 TON TOUR</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  badge: {
    backgroundColor: '#33A047',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#eafff0',
    shadowColor: '#33ff88',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  text: { color: '#fff', fontSize: 26, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
});
