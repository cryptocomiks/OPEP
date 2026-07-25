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
      return <DrawFx n={Math.min(fx.n || 1, 4)} onDone={onDone} />;
    case 'plus':
      if (fx.value === 'wild4') {
        return <Badge label="+4" sub={fx.toMe ? 'Tu pioches !' : 'ça explose !'} bg="#141726" flyN={fx.toMe ? 4 : 0} explode slash onDone={onDone} />;
      }
      return <Badge label="+2" sub={fx.toMe ? 'Tu pioches !' : 'Cartes !'} bg="#E4342B" flyN={fx.toMe ? 2 : 0} slash onDone={onDone} />;
    case 'lock':
      return <Badge label="🔒" sub={fx.toMe ? 'Tu es bloqué !' : 'Bloqué !'} bg="#232a4d" onDone={onDone} />;
    case 'swap':
      return <Badge label="🔄" sub={fx.toMe ? 'On prend ta main !' : 'Échange de mains'} bg="#7a3fb0" crossing onDone={onDone} />;
    case 'renew':
      return <Badge label="♻️" sub={fx.toMe ? 'Main toute neuve !' : 'Main renouvelée'} bg="#1f7a4d" flyN={fx.toMe ? Math.min(fx.n || 3, 4) : 0} onDone={onDone} />;
    case 'flip':
      return <Badge label="🔃" sub="Sens inversé !" bg="#0e6b8c" spin onDone={onDone} />;
    case 'shield':
      return <Badge label="🛡️" sub={fx.toMe ? 'Bouclier levé !' : 'Bouclier'} bg="#8a2f2f" onDone={onDone} />;
    case 'shieldblock':
      return <Badge label="🛡️" sub={fx.toMe ? 'Attaque bloquée !' : 'Bloqué par bouclier'} bg="#2f6a8a" slash onDone={onDone} />;
    case 'spell':
      return <Badge label="🔮" sub={fx.toMe ? 'Tu subis un Sort !' : 'Sort lancé'} bg="#5b2b8a" onDone={onDone} />;
    case 'steal':
      return <Badge label="🗡️" sub={fx.toMe ? 'On te vole une carte !' : 'Carte volée'} bg="#106b57" slash onDone={onDone} />;
    case 'heal':
      return <Badge label="🌟" sub="Purge !" bg="#1f5a8a" onDone={onDone} />;
    case 'rankup':
      return <Badge label={fx.icon || '⭐'} sub={`RANG SUPÉRIEUR · ${fx.rank || ''}`} bg={fx.color || '#b45cff'} onDone={onDone} />;
    default:
      return null;
  }
}

// Draw effect: flying cards + a "PIOCHE +N" tag near the hand.
function DrawFx({ n, onDone }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(a, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FlyingCards n={n} from={DECK} to={HAND} onDone={onDone} />
      <View style={styles.drawTagWrap}>
        <Animated.View style={[styles.drawTag, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
          <Text style={styles.drawTagText}>PIOCHE +{n}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// Combat slash: red flash + two diagonal streaks sweeping across.
function Slash() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const flash = v.interpolate({ inputRange: [0, 0.15, 0.5], outputRange: [0, 0.5, 0], extrapolate: 'clamp' });
  const tx = v.interpolate({ inputRange: [0, 1], outputRange: [-W, W] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#ff2d2d', opacity: flash }]} />
      <Animated.View style={[styles.streak, { transform: [{ translateX: tx }, { rotate: '18deg' }] }]} />
      <Animated.View style={[styles.streak, { top: '58%', transform: [{ translateX: tx }, { rotate: '-14deg' }] }]} />
    </View>
  );
}

function Explosion() {
  const dirs = [
    [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.3], [0, 1.3], [-1.3, 0], [1.3, 0],
  ];
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerFill]}>
      {dirs.map(([dx, dy], i) => {
        const tx = v.interpolate({ inputRange: [0, 1], outputRange: [0, dx * (W * 0.42)] });
        const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, dy * (H * 0.28)] });
        const rot = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 220}deg`] });
        const opacity = v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
        return (
          <Animated.View key={i} style={{ position: 'absolute', opacity, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scale }] }}>
            <CardBack small />
          </Animated.View>
        );
      })}
    </View>
  );
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

// Generic centered badge with pop + shake; optional flying / crossing / explosion / slash.
function Badge({ label, sub, bg, flyN = 0, crossing, explode, spin, slash, onDone }) {
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
  const rotate = spin ? cross.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '0deg';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerFill]}>
      {slash ? <Slash /> : null}
      {explode ? <Explosion /> : null}
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
      <Animated.View style={{ opacity: pop, transform: [{ scale }, { translateX: shake }, { rotate }] }}>
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
  drawTagWrap: { position: 'absolute', bottom: H * 0.24, left: 0, right: 0, alignItems: 'center' },
  drawTag: { backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#5ad1ff', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  drawTagText: { color: '#8be9ff', fontWeight: '900', fontSize: 14, textAlign: 'center' },
  streak: { position: 'absolute', top: '30%', width: W * 1.4, height: 6, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3 },
});
