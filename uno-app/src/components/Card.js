import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CARD_COLORS, CARD_TEXT_ON, LABELS } from '../theme';

// Renders a single UNO card. card = { color, value }.
export default function Card({ card, onPress, disabled, small, dim, selectedColor }) {
  const isWild = card.value === 'wild' || card.value === 'wild4';
  const bg = card.color ? CARD_COLORS[card.color] : '#111421';
  const fg = card.color ? CARD_TEXT_ON[card.color] : '#fff';
  const label = LABELS[card.value] || card.value;

  const size = small
    ? { width: 42, height: 62, radius: 8, font: 20, corner: 9 }
    : { width: 74, height: 108, radius: 12, font: 34, corner: 13 };

  const body = (
    <View
      style={[
        styles.card,
        {
          width: size.width,
          height: size.height,
          borderRadius: size.radius,
          backgroundColor: bg,
          opacity: dim ? 0.45 : 1,
        },
      ]}
    >
      {isWild ? (
        <View style={styles.wildGrid}>
          <View style={[styles.q, { backgroundColor: CARD_COLORS.red }]} />
          <View style={[styles.q, { backgroundColor: CARD_COLORS.blue }]} />
          <View style={[styles.q, { backgroundColor: CARD_COLORS.yellow }]} />
          <View style={[styles.q, { backgroundColor: CARD_COLORS.green }]} />
        </View>
      ) : null}
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, { color: fg, fontSize: size.font }]}>{label}</Text>
      </View>
      {!small ? (
        <Text style={[styles.corner, styles.cornerTL, { color: fg, fontSize: size.corner }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} disabled={disabled} onPress={onPress}>
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
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: { fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  corner: { position: 'absolute', fontWeight: '800' },
  cornerTL: { top: 4, left: 6 },
  wildGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  q: { width: '50%', height: '50%' },
});
