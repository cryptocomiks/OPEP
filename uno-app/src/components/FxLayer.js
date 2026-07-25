import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Dimensions, StyleSheet, View, Text } from 'react-native';
import { CardBack } from './Card';

const { width: W, height: H } = Dimensions.get('window');
const DECK = { x: W * 0.5 - 38, y: H * 0.4 };
const HAND = { x: W * 0.5 - 38, y: H * 0.8 };

// Renders one transient effect then calls onDone. Re-mounted per fx via `key`.
export default function FxLayer({ fx, onDone }) {
  if (!fx) return null;
  switch (fx.type) {
    case 'draw':
      return <FlyingCards n={Math.min(fx.n || 1, 4)} from={DECK} to={HAND} onDone={onDone} />;
    case 'plus':
      return (
        <Badge
          label={fx.value === 'wild4' ? '+4' : '+2'}
          sub={fx.toMe ? 'Tu pioches !' : 'Cartes !'}
          bg={fx.value === 'wild4' ? '#141726' : '#E4342B'}
          flyN={fx.toMe ? (fx.value === 'wild4' ? 4 : 2) : 0}
          onDone={onDone}
        />
      );
    case 'lock':
      return <Badge label="🔒" sub={fx.toMe ? 'Tu es bloqué !' : 'Bloqué !'} bg="#232a4d" onDone={onDone} />;
    case 'swap':
      return <Badge label="🔄" sub={fx.toMe ? 'On prend ta main !' : 'Échange de mains'} bg="#7a3fb0" crossing onDone={onDone} />;
    case 'renew':
      return (
        <Badge
          label="♻️"
          sub={fx.toMe ? 'Main toute neuve !' : 'Main renouvelée'}
          bg="#1f7a4d"
          flyN={fx.toMe ? Math.min(fx.n || 3, 4) : 0}
          onDone={onDone}
        />
      );
    default:
      return null;
  }
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

// Generic centered badge with pop + shake; optional flying cards / crossing cards.
function Badge({ label, sub, bg, flyN = 0, crossing, onDone }) {
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const cross = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.parallel([
        Animated.sequence([12, -12, 8, -8, 4, 0].map((to) => Animated.timing(shake, { toValue: to, duration: 45, useNativeDriver: true }))),
        Animated.timing(cross, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.delay(520),
      Animated.timing(pop, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => onDone && onDone());
    const t = setTimeout(() => onDone && onDone(), 2400);
    return () => clearTimeout(t);
  }, []);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerFill]}>
      {crossing ? (
        <View style={styles.crossWrap}>
          <Animated.View style={{ transform: [{ translateX: cross.interpolate({ inputRange: [0, 1], outputRange: [40, -40] }) }] }}>
            <CardBack small />
          </Animated.View>
          <Animated.View style={{ transform: [{ translateX: cross.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] }) }] }}>
            <CardBack small />
          </Animated.View>
        </View>
      ) : null}
      <Animated.View style={{ opacity: pop, transform: [{ scale }, { translateX: shake }] }}>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={styles.badgeText}>{label}</Text>
          <Text style={styles.badgeSub}>{sub}</Text>
        </View>
      </Animated.View>
      {flyN > 0 ? <FlyingCards n={flyN} from={DECK} to={HAND} onDone={() => {}} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flyer: { position: 'absolute' },
  centerFill: { alignItems: 'center', justifyContent: 'center' },
  crossWrap: { position: 'absolute', flexDirection: 'row', gap: 6 },
  badge: {
    paddingVertical: 20,
    paddingHorizontal: 38,
    borderRadius: 26,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  badgeText: { color: '#F5C518', fontSize: 60, fontWeight: '900', fontStyle: 'italic' },
  badgeSub: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
});
