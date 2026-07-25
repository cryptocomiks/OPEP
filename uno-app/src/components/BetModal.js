import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';

const CHIPS = [25, 50, 100, 250];

// Place a local wager on who will win. Payout = amount * odds (odds = nb of players).
export default function BetModal({ players, meId, balance, onConfirm, onSkip }) {
  const odds = Math.max(2, players.length);
  const [on, setOn] = useState(meId);
  const [amount, setAmount] = useState(0);
  const canBet = amount > 0 && amount <= balance;

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>💵 Parier ?</Text>
        <Text style={styles.sub}>Mise sur le vainqueur · cote ×{odds}</Text>

        <Text style={styles.label}>Je parie sur</Text>
        <View style={styles.players}>
          {players.map((p) => (
            <TouchableOpacity key={p.id} style={[styles.player, on === p.id && styles.playerOn]} onPress={() => setOn(p.id)}>
              <Text style={[styles.playerText, on === p.id && styles.playerTextOn]} numberOfLines={1}>
                {p.id === meId ? 'Moi' : p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Montant (solde : {balance}$)</Text>
        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, amount === c && styles.chipOn, c > balance && styles.chipOff]}
              disabled={c > balance}
              onPress={() => setAmount(c)}
            >
              <Text style={[styles.chipText, amount === c && styles.chipTextOn]}>{c}$</Text>
            </TouchableOpacity>
          ))}
        </View>

        {canBet ? (
          <Text style={styles.payout}>
            Gain potentiel : <Text style={{ color: theme.accent }}>+{amount * odds}$</Text>
          </Text>
        ) : (
          <Text style={styles.payoutMuted}>Choisis un montant pour parier</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, canBet ? styles.btnPrimary : styles.btnDisabled]}
          disabled={!canBet}
          onPress={() => onConfirm({ on, amount, odds })}
        >
          <Text style={styles.btnText}>Parier & jouer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipText}>Jouer sans parier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: theme.panel, borderRadius: 20, padding: 22, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  sub: { color: theme.sub, textAlign: 'center', marginTop: 2, marginBottom: 12 },
  label: { color: theme.text, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.panel2, borderWidth: 1, borderColor: theme.border },
  playerOn: { backgroundColor: theme.ok, borderColor: '#7be0a0' },
  playerText: { color: theme.sub, fontWeight: '800', maxWidth: 100 },
  playerTextOn: { color: '#fff' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.panel2, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  chipOn: { backgroundColor: theme.accent, borderColor: '#fff' },
  chipOff: { opacity: 0.35 },
  chipText: { color: theme.text, fontWeight: '800' },
  chipTextOn: { color: '#1a1a1a' },
  payout: { color: theme.text, textAlign: 'center', marginTop: 14, fontWeight: '700' },
  payoutMuted: { color: theme.sub, textAlign: 'center', marginTop: 14, fontSize: 12 },
  btn: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 14 },
  btnPrimary: { backgroundColor: theme.danger },
  btnDisabled: { backgroundColor: theme.panel2 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  skip: { padding: 12, alignItems: 'center' },
  skipText: { color: theme.sub, fontWeight: '700' },
});
