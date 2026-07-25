import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardBack } from './Card';
import { SKINS } from '../skins';
import { theme, GRAD } from '../theme';

// Card-sleeve marketplace. Buy with cash, then equip.
export default function MarketScreen({ balance, owned, equipped, onBuy, onEquip, onBack }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Boutique</Text>
        <View style={styles.wallet}>
          <Text style={styles.walletText}>💰 {balance}$</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>Sleeves de cartes · anime le dos de tes cartes en jeu</Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {SKINS.map((s) => {
          const isOwned = owned.includes(s.id);
          const isEquipped = equipped === s.id;
          const affordable = balance >= s.price;
          return (
            <View key={s.id} style={[styles.tile, isEquipped && styles.tileEquipped]}>
              <View style={styles.preview}>
                <CardBack skin={s.id} animated />
              </View>
              <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
              {s.price === 0 ? (
                <Text style={styles.free}>Offert</Text>
              ) : (
                <Text style={styles.price}>{s.price}$</Text>
              )}

              {isEquipped ? (
                <View style={[styles.btn, styles.btnEquipped]}>
                  <Text style={styles.btnEquippedText}>✓ Équipé</Text>
                </View>
              ) : isOwned ? (
                <TouchableOpacity style={[styles.btn, styles.btnEquip]} onPress={() => onEquip(s.id)}>
                  <Text style={styles.btnText}>Équiper</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.btn, affordable ? styles.btnBuy : styles.btnDisabled]}
                  disabled={!affordable}
                  onPress={() => onBuy(s)}
                >
                  <Text style={styles.btnText}>{affordable ? 'Acheter' : 'Trop cher'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  back: { paddingVertical: 6, paddingRight: 10 },
  backText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22 },
  wallet: { backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  walletText: { color: theme.accent, fontWeight: '900', fontSize: 13 },
  subtitle: { color: theme.sub, textAlign: 'center', fontSize: 12, marginTop: 6, marginBottom: 6, paddingHorizontal: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 16, gap: 14 },
  tile: { width: '46%', backgroundColor: theme.panel, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: theme.border },
  tileEquipped: { borderColor: theme.ok },
  preview: { marginVertical: 6 },
  name: { color: theme.text, fontWeight: '800', marginTop: 8 },
  price: { color: theme.accent, fontWeight: '800', marginTop: 2 },
  free: { color: theme.sub, fontWeight: '700', marginTop: 2 },
  btn: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18, alignItems: 'center', marginTop: 10, alignSelf: 'stretch' },
  btnBuy: { backgroundColor: theme.danger },
  btnEquip: { backgroundColor: '#2277CC' },
  btnEquipped: { backgroundColor: 'rgba(51,160,71,0.2)', borderWidth: 1, borderColor: theme.ok },
  btnEquippedText: { color: theme.ok, fontWeight: '800' },
  btnDisabled: { backgroundColor: theme.panel2 },
  btnText: { color: '#fff', fontWeight: '800' },
});
