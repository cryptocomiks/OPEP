import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CARD_COLORS, CARD_TEXT_ON, LABELS } from '../theme';
import { getSkin } from '../skins';
import { useEquippedSkin } from '../SkinContext';

const SIZES = {
  small: { width: 44, height: 64, radius: 8, font: 20, corner: 9, border: 3 },
  big: { width: 76, height: 112, radius: 12, font: 34, corner: 13, border: 3 },
};
function cardDims(size) {
  return { width: size.width, height: size.height, borderRadius: size.radius, borderWidth: size.border };
}

// Skinned, optionally animated card back.
export function CardBack({ small, skin, animated }) {
  const ctxSkin = useEquippedSkin();
  const s = getSkin(skin || ctxSkin);
  const size = small ? SIZES.small : SIZES.big;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || s.kind === 'classic') return;
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: s.kind === 'holo' ? 2600 : 1700, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [animated, s.kind]);

  const tx = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-size.width, size.width * 1.5] });

  if (s.kind === 'classic') {
    return (
      <View style={[styles.card, cardDims(size), { backgroundColor: '#0d1020' }]}>
        <View style={[styles.oval, { transform: [{ rotate: '-20deg' }] }]}>
          <Text style={[styles.backText, small && { fontSize: 12 }]}>UNO</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, cardDims(size), { borderColor: s.accent }]}>
      <LinearGradient colors={s.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {s.icon ? (
        <Text style={[styles.skinIcon, { fontSize: small ? 22 : 40, opacity: s.kind === 'holo' ? 0.9 : 0.85 }]}>{s.icon}</Text>
      ) : null}
      {animated ? (
        <Animated.View style={[styles.shimmer, { transform: [{ translateX: tx }, { rotate: '18deg' }] }]} />
      ) : null}
      <View style={[styles.innerBorder, { borderColor: 'rgba(255,255,255,0.25)', borderRadius: size.radius - 3 }]} />
    </View>
  );
}

// Renders a single UNO card. card = { color, value }.
export default function Card({ card, onPress, disabled, small, dim, faceDown }) {
  if (faceDown) return <CardBack small={small} />;

  const isWild = card.color === null;
  const bg = card.color ? CARD_COLORS[card.color] : '#141726';
  const fg = card.color ? CARD_TEXT_ON[card.color] : '#fff';
  const label = LABELS[card.value] || card.value;
  const size = small ? SIZES.small : SIZES.big;

  const body = (
    <View style={[styles.card, cardDims(size), { backgroundColor: bg, opacity: dim ? 0.4 : 1 }]}>
      {isWild ? (
        <View style={styles.wildGrid}>
          <View style={[styles.q, { backgroundColor: CARD_COLORS.red }]} />
          <View style={[styles.q, { backgroundColor: CARD_COLORS.blue }]} />
          <View style={[styles.q, { backgroundColor: CARD_COLORS.yellow }]} />
          <View style={[styles.q, { backgroundColor: CARD_COLORS.green }]} />
        </View>
      ) : (
        <View style={[styles.oval, styles.ovalWhite]} />
      )}
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, { color: fg, fontSize: size.font }]}>{label}</Text>
      </View>
      {!small ? (
        <>
          <Text style={[styles.corner, styles.cornerTL, { color: fg, fontSize: size.corner }]}>{label}</Text>
          <Text style={[styles.corner, styles.cornerBR, { color: fg, fontSize: size.corner }]}>{label}</Text>
        </>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} disabled={disabled} onPress={onPress}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fff',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  value: { fontWeight: '900', fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 } },
  corner: { position: 'absolute', fontWeight: '800', fontStyle: 'italic' },
  cornerTL: { top: 4, left: 6 },
  cornerBR: { bottom: 4, right: 6, transform: [{ rotate: '180deg' }] },
  wildGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  q: { width: '50%', height: '50%' },
  oval: { position: 'absolute', width: '135%', height: '58%', borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  ovalWhite: { backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ rotate: '-20deg' }] },
  backText: { color: '#F5C518', fontWeight: '900', fontStyle: 'italic', fontSize: 16, letterSpacing: -1 },
  skinIcon: { position: 'absolute', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  shimmer: { position: 'absolute', top: -20, bottom: -20, width: 22, backgroundColor: 'rgba(255,255,255,0.55)' },
  innerBorder: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1 },
});
