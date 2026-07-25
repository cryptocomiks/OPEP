import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardBack } from './Card';
import { SKINS, RARITY } from '../skins';
import { BOX_PRICE, craftCost } from '../gacha';
import { theme, GRAD } from '../theme';

// Sleeve marketplace: mystery boxes, direct buy, craft from shards, collection.
export default function MarketScreen({ balance, shards, boxes, owned, equipped, onBuy, onEquip, onOpenBox, onCraft, onBack }) {
  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Boutique</Text>
      </View>
      <View style={styles.balances}>
        <Text style={styles.bal}>💰 {balance}$</Text>
        <Text style={styles.balShard}>💎 {shards}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Mystery box */}
        <View style={styles.boxCard}>
          <Text style={styles.boxEmoji}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.boxTitle}>Mystery Box</Text>
            <Text style={styles.boxSub}>Un skin aléatoire · doublons → 💎 éclats</Text>
            <Text style={styles.boxOdds}>
              {Object.values(RARITY).map((r) => `${r.name} ${r.weight}%`).join(' · ')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.boxBtn, balance < BOX_PRICE && boxes <= 0 && styles.btnDisabled]}
            disabled={balance < BOX_PRICE && boxes <= 0}
            onPress={onOpenBox}
          >
            <Text style={styles.boxBtnText}>{boxes > 0 ? `Ouvrir (${boxes} 🎁)` : `Ouvrir ${BOX_PRICE}$`}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Collection de sleeves</Text>
        <View style={styles.grid}>
          {SKINS.map((s) => {
            const isOwned = owned.includes(s.id);
            const isEquipped = equipped === s.id;
            const affordable = balance >= s.price;
            const cCost = craftCost(s.id);
            const canCraft = !isOwned && shards >= cCost;
            const rar = RARITY[s.rarity] || RARITY.common;
            return (
              <View key={s.id} style={[styles.tile, isEquipped && styles.tileEquipped]}>
                <View style={[styles.rarStrip, { backgroundColor: rar.color }]} />
                <View style={styles.preview}>
                  <CardBack skin={s.id} animated />
                </View>
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                <Text style={[styles.rar, { color: rar.color }]}>{rar.name}</Text>

                {isEquipped ? (
                  <View style={[styles.btn, styles.btnEquipped]}>
                    <Text style={styles.btnEquippedText}>✓ Équipé</Text>
                  </View>
                ) : isOwned ? (
                  <TouchableOpacity style={[styles.btn, styles.btnEquip]} onPress={() => onEquip(s.id)}>
                    <Text style={styles.btnText}>Équiper</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ alignSelf: 'stretch', gap: 6 }}>
                    <TouchableOpacity style={[styles.btn, affordable ? styles.btnBuy : styles.btnDisabled]} disabled={!affordable} onPress={() => onBuy(s)}>
                      <Text style={styles.btnText}>{s.price}$</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnCraft, !canCraft && styles.btnDisabled]} disabled={!canCraft} onPress={() => onCraft(s)}>
                      <Text style={styles.btnCraftText}>Craft {cCost}💎</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  back: { paddingVertical: 6, paddingRight: 10 },
  backText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22, marginRight: 60 },
  balances: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 6, marginBottom: 8 },
  bal: { color: theme.accent, fontWeight: '900', backgroundColor: 'rgba(245,197,24,0.14)', borderColor: theme.accent, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 },
  balShard: { color: '#8be9ff', fontWeight: '900', backgroundColor: 'rgba(139,233,255,0.12)', borderColor: '#8be9ff', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 },

  boxCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.panel, margin: 16, marginBottom: 8, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border },
  boxEmoji: { fontSize: 46 },
  boxTitle: { color: theme.text, fontWeight: '900', fontSize: 18 },
  boxSub: { color: theme.sub, fontSize: 12, marginTop: 2 },
  boxOdds: { color: '#8890c0', fontSize: 10, marginTop: 4 },
  boxBtn: { backgroundColor: '#b45cff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  boxBtnText: { color: '#fff', fontWeight: '900' },

  section: { color: theme.text, fontWeight: '800', fontSize: 16, marginLeft: 18, marginTop: 12, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, gap: 14 },
  tile: { width: '46%', backgroundColor: theme.panel, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: theme.border, overflow: 'hidden' },
  tileEquipped: { borderColor: theme.ok },
  rarStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  preview: { marginVertical: 8 },
  name: { color: theme.text, fontWeight: '800', marginTop: 6 },
  rar: { fontWeight: '800', fontSize: 11, margintop: 2, marginBottom: 6 },
  btn: { borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 8, alignSelf: 'stretch' },
  btnBuy: { backgroundColor: theme.danger },
  btnEquip: { backgroundColor: '#2277CC' },
  btnEquipped: { backgroundColor: 'rgba(51,160,71,0.2)', borderWidth: 1, borderColor: theme.ok },
  btnEquippedText: { color: theme.ok, fontWeight: '800' },
  btnCraft: { borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#8be9ff' },
  btnCraftText: { color: '#8be9ff', fontWeight: '800', fontSize: 12 },
  btnDisabled: { backgroundColor: theme.panel2, borderColor: theme.border, opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800' },
});
