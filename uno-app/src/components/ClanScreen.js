import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CLANS } from '../clans';
import { theme, GRAD } from '../theme';

// Pick a clan. Grants a signature power card in your hand + a banner on your chip.
export default function ClanScreen({ current, onChoose, onBack }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choisis ton clan</Text>
      </View>
      <Text style={styles.subtitle}>Ton clan te donne une carte-pouvoir signature au début de chaque partie.</Text>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {CLANS.map((c) => {
          const active = current === c.id;
          return (
            <TouchableOpacity key={c.id} style={[styles.clan, { borderColor: active ? c.color : theme.border }, active && styles.clanOn]} onPress={() => onChoose(c.id)}>
              <View style={[styles.badge, { backgroundColor: c.color }]}>
                <Text style={styles.badgeIcon}>{c.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.desc}>{c.desc}</Text>
              </View>
              {active ? <Text style={[styles.check, { color: c.color }]}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.none} onPress={() => onChoose(null)}>
          <Text style={styles.noneText}>Jouer sans clan</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  back: { paddingVertical: 6, paddingRight: 10 },
  backText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22, marginRight: 60 },
  subtitle: { color: theme.sub, textAlign: 'center', fontSize: 13, marginTop: 6, paddingHorizontal: 20 },
  clan: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.panel, borderRadius: 16, padding: 16, borderWidth: 2 },
  clanOn: { backgroundColor: theme.panel2 },
  badge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 28 },
  name: { color: theme.text, fontWeight: '900', fontSize: 18 },
  desc: { color: theme.sub, fontSize: 13, marginTop: 2 },
  check: { fontSize: 24, fontWeight: '900' },
  none: { padding: 14, alignItems: 'center' },
  noneText: { color: theme.sub, fontWeight: '700' },
});
