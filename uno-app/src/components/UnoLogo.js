import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Classic UNO wordmark: a tilted red pill with yellow italic "UNO".
export default function UnoLogo({ size = 96, tilt = -12 }) {
  const padV = size * 0.16;
  const padH = size * 0.34;
  return (
    <View style={[styles.wrap, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <View
        style={[
          styles.pill,
          { paddingVertical: padV, paddingHorizontal: padH, borderRadius: size, borderWidth: Math.max(4, size * 0.06) },
        ]}
      >
        {/* faux outline: white text layers behind the yellow face */}
        <View style={styles.stack}>
          <Text style={[styles.outline, { fontSize: size, top: 2, left: 2 }]}>UNO</Text>
          <Text style={[styles.outline, { fontSize: size, top: 2, left: -2 }]}>UNO</Text>
          <Text style={[styles.outline, { fontSize: size, top: -2, left: 2 }]}>UNO</Text>
          <Text style={[styles.outline, { fontSize: size, top: -2, left: -2 }]}>UNO</Text>
          <Text style={[styles.face, { fontSize: size }]}>UNO</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    backgroundColor: '#E4342B',
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  stack: { alignItems: 'center', justifyContent: 'center' },
  face: {
    color: '#F5C518',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2,
    includeFontPadding: false,
  },
  outline: {
    position: 'absolute',
    color: '#fff',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2,
    includeFontPadding: false,
  },
});
