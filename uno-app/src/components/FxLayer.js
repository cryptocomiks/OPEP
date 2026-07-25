import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Dimensions, StyleSheet, View, Text } from 'react-native';
import { CardBack } from './Card';

const { width: W, height: H } = Dimensions.get('window');

// Deck sits mid-table; the local hand is near the bottom.
const DECK = { x: W * 0.5 - 38, y: H * 0.4 };
const HAND = { x: W * 0.5 - 38, y: H * 0.8 };

// Renders one transient effect then calls onDone. Re-mounted per fx via `key`.
export default function FxLayer({ fx, onDone }) {
  if (!fx) return null;
  if (fx.type === 'draw') return <FlyingCards n={Math.min(fx.n || 1, 4)} from={DECK} to={HAND} onDone={onDone} />;
  if (fx.type === 'plus') return <PlusBadge value={fx.value} toMe={fx.toMe} onDone={onDone} />;
  return null;
}

function FlyingCards({ n, from, to, onDone }) {
  const items = useRef(Array.from({ length: n }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = items.map((v, i) =>
      Animated.timing(v, { toValue: 1, duration: 520, delay: i * 110, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    );
    Animated.stagger(0, anims).start(() => onDone && onDone());
    const t = setTimeout(() => onDone && onDone(), 520 + n * 110 + 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((v, i) => {
        const spread = (i - (n - 1) / 2) * 26;
        const tx = v.interpolate({ inputRange: [0, 1], outputRange: [0, to.x - from.x + spread] });
        const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, to.y - from.y] });
        const scale = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.05, 1] });
        const rot = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spread}deg`] });
        const opacity = v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={[styles.flyer, { left: from.x, top: from.y, opacity, transform: [{ translateX: tx }, { translateY: ty }, { scale }, { rotate: rot }] }]}
          >
            <CardBack small />
          </Animated.View>
        );
      })}
    </View>
  );
}

function PlusBadge({ value, toMe, onDone }) {
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const label = value === 'wild4' ? '+4' : '+2';
  const n = value === 'wild4' ? 4 : 2;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.sequence([
        ...[12, -12, 8, -8, 4, 0].map((to) =>
          Animated.timing(shake, { toValue: to, duration: 45, useNativeDriver: true })
        ),
      ]),
      Animated.delay(500),
      Animated.timing(pop, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => onDone && onDone());
    const t = setTimeout(() => onDone && onDone(), 2200);
    return () => clearTimeout(t);
  }, []);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerFill]}>
      <Animated.View style={{ opacity: pop, transform: [{ scale }, { translateX: shake }] }}>
        <View style={[styles.badge, value === 'wild4' ? styles.badgeWild : styles.badgeRed]}>
          <Text style={styles.badgeText}>{label}</Text>
          <Text style={styles.badgeSub}>{toMe ? 'Tu pioches !' : 'Cartes !'}</Text>
        </View>
      </Animated.View>
      {toMe ? <FlyingCards n={n} from={DECK} to={HAND} onDone={() => {}} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flyer: { position: 'absolute' },
  centerFill: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    paddingVertical: 22,
    paddingHorizontal: 40,
    borderRadius: 26,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  badgeRed: { backgroundColor: '#E4342B' },
  badgeWild: { backgroundColor: '#141726' },
  badgeText: { color: '#F5C518', fontSize: 64, fontWeight: '900', fontStyle: 'italic' },
  badgeSub: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
});
