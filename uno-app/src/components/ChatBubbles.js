import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import { getClan } from '../clans';
import { theme } from '../theme';

// Floating chat bubbles that pop up in-game when messages arrive, then fade.
export default function ChatBubbles({ messages, meId }) {
  const [vis, setVis] = useState([]);
  const seen = useRef(new Set());

  useEffect(() => {
    if (!messages.length) return;
    const m = messages[messages.length - 1];
    if (seen.current.has(m.id)) return;
    seen.current.add(m.id);
    setVis((v) => [...v, m].slice(-4));
  }, [messages]);

  const remove = (id) => setVis((v) => v.filter((x) => x.id !== id));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {vis.map((m) => (
        <Bubble key={m.id} m={m} mine={m.pid === meId} onExpire={() => remove(m.id)} />
      ))}
    </View>
  );
}

function Bubble({ m, mine, onExpire }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.delay(4200),
      Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onExpire && onExpire());
  }, []);
  const clan = getClan(m.clan);
  return (
    <Animated.View
      style={[
        styles.bubble,
        mine && styles.mine,
        { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
      ]}
    >
      <Text style={styles.name}>{clan ? clan.icon + ' ' : ''}{mine ? 'Toi' : m.name}</Text>
      <Text style={styles.text}>{m.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 60, bottom: 190, alignItems: 'flex-start', gap: 6, zIndex: 15 },
  bubble: { backgroundColor: 'rgba(20,23,45,0.92)', borderRadius: 14, borderTopLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '92%', borderWidth: 1, borderColor: theme.border },
  mine: { backgroundColor: 'rgba(38,64,122,0.92)', alignSelf: 'flex-end', borderTopLeftRadius: 14, borderTopRightRadius: 4 },
  name: { color: theme.accent, fontWeight: '800', fontSize: 11, marginBottom: 1 },
  text: { color: '#fff', fontSize: 14 },
});
