import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PASS, levelInfo, XP_PER_TIER, PREMIUM_PRICE, MAX_TIER } from '../progression';
import { getSkin } from '../skins';
import { theme, GRAD } from '../theme';

function rewardText(r) {
  if (!r) return '—';
  if (r.cash) return `${r.cash}$`;
  if (r.shards) return `${r.shards}💎`;
  if (r.box) return `🎁×${r.box}`;
  if (r.skin) return getSkin(r.skin).name;
  return '—';
}

export default function ProgressionScreen({ prog, balance, onClaimMission, onClaimTier, onBuyPremium, onBack }) {
  const li = levelInfo(prog.xp);
  const daily = prog.missions.items.filter((m) => m.scope === 'daily');
  const weekly = prog.missions.items.filter((m) => m.scope === 'weekly');

  const Mission = ({ m }) => {
    const done = m.progress >= m.target;
    return (
      <View style={styles.mission}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mDesc}>{m.desc}</Text>
          <View style={styles.mBarBg}>
            <View style={[styles.mBarFill, { width: `${Math.min(100, (m.progress / m.target) * 100)}%` }]} />
          </View>
          <Text style={styles.mProg}>{m.progress}/{m.target} · +{m.cash}$ · +{m.xp} XP</Text>
        </View>
        {m.claimed ? (
          <View style={styles.mDone}><Text style={styles.mDoneText}>✓</Text></View>
        ) : (
          <TouchableOpacity style={[styles.mClaim, !done && styles.mClaimOff]} disabled={!done} onPress={() => onClaimMission(m.id)}>
            <Text style={styles.mClaimText}>{done ? 'Récupérer' : '…'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={GRAD.home} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Passe Saison 1</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.xpBox}>
          <Text style={styles.level}>Palier {li.tier}/{MAX_TIER}</Text>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${li.pct * 100}%` }]} />
          </View>
          <Text style={styles.xpText}>{li.into}/{XP_PER_TIER} XP</Text>
        </View>

        {!prog.premium ? (
          <TouchableOpacity style={[styles.premium, balance < PREMIUM_PRICE && styles.btnDisabled]} disabled={balance < PREMIUM_PRICE} onPress={onBuyPremium}>
            <Text style={styles.premiumText}>⭐ Débloquer le Passe Premium — {PREMIUM_PRICE}$</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.premiumOn}>
            <Text style={styles.premiumOnText}>⭐ Passe Premium actif</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiers}>
          {PASS.map((t) => {
            const unlocked = li.unlocked >= t.tier;
            const freeClaimed = prog.claimedFree.includes(t.tier);
            const premClaimed = prog.claimedPrem.includes(t.tier);
            return (
              <View key={t.tier} style={[styles.tier, unlocked && styles.tierOn]}>
                <Text style={styles.tierNum}>{t.tier}</Text>
                <TierReward label="Gratuit" r={t.free} claimed={freeClaimed} unlocked={unlocked} onClaim={() => onClaimTier(t.tier, 'free')} />
                <TierReward label="Premium" r={t.premium} claimed={premClaimed} unlocked={unlocked && prog.premium} premium onClaim={() => onClaimTier(t.tier, 'premium')} locked={!prog.premium} />
              </View>
            );
          })}
        </ScrollView>

        <Text style={styles.section}>Missions du jour</Text>
        {daily.map((m) => <Mission key={m.id} m={m} />)}
        <Text style={styles.section}>Missions de la semaine</Text>
        {weekly.map((m) => <Mission key={m.id} m={m} />)}
      </ScrollView>
    </LinearGradient>
  );
}

function TierReward({ label, r, claimed, unlocked, onClaim, premium, locked }) {
  return (
    <View style={[styles.reward, premium && styles.rewardPrem, claimed && styles.rewardClaimed]}>
      <Text style={styles.rewardLabel}>{label}</Text>
      <Text style={styles.rewardVal}>{rewardText(r)}</Text>
      {claimed ? (
        <Text style={styles.rewardCheck}>✓</Text>
      ) : unlocked && !locked ? (
        <TouchableOpacity style={styles.rewardBtn} onPress={onClaim}>
          <Text style={styles.rewardBtnText}>OK</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.rewardLock}>{locked ? '🔒' : ''}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  back: { paddingVertical: 6, paddingRight: 10 },
  backText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', color: theme.accent, fontWeight: '900', fontSize: 22, marginRight: 60 },

  xpBox: { margin: 16, marginBottom: 8, backgroundColor: theme.panel, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border },
  level: { color: theme.text, fontWeight: '900', fontSize: 16, marginBottom: 8 },
  xpBarBg: { height: 12, backgroundColor: theme.panel2, borderRadius: 6, overflow: 'hidden' },
  xpBarFill: { height: 12, backgroundColor: theme.accent },
  xpText: { color: theme.sub, fontSize: 12, marginTop: 6, textAlign: 'right' },

  premium: { backgroundColor: '#b45cff', marginHorizontal: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  premiumText: { color: '#fff', fontWeight: '900' },
  premiumOn: { marginHorizontal: 16, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#b45cff' },
  premiumOnText: { color: '#d9a8ff', fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },

  tiers: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  tier: { width: 96, backgroundColor: theme.panel, borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.border, opacity: 0.6 },
  tierOn: { opacity: 1, borderColor: theme.accent },
  tierNum: { color: theme.text, fontWeight: '900', marginBottom: 6 },
  reward: { alignSelf: 'stretch', backgroundColor: theme.panel2, borderRadius: 8, padding: 6, alignItems: 'center', marginBottom: 6 },
  rewardPrem: { backgroundColor: 'rgba(180,92,255,0.18)' },
  rewardClaimed: { opacity: 0.5 },
  rewardLabel: { color: theme.sub, fontSize: 9, fontWeight: '700' },
  rewardVal: { color: theme.text, fontWeight: '800', fontSize: 12, marginVertical: 2 },
  rewardBtn: { backgroundColor: theme.ok, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 3, marginTop: 2 },
  rewardBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  rewardCheck: { color: theme.ok, fontWeight: '900' },
  rewardLock: { color: theme.sub, fontSize: 12, minHeight: 14 },

  section: { color: theme.text, fontWeight: '800', fontSize: 16, marginLeft: 18, marginTop: 14, marginBottom: 6 },
  mission: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.panel, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, gap: 10 },
  mDesc: { color: theme.text, fontWeight: '700' },
  mBarBg: { height: 8, backgroundColor: theme.panel2, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  mBarFill: { height: 8, backgroundColor: theme.ok },
  mProg: { color: theme.sub, fontSize: 11, marginTop: 4 },
  mClaim: { backgroundColor: theme.ok, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  mClaimOff: { backgroundColor: theme.panel2 },
  mClaimText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  mDone: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(51,160,71,0.2)', alignItems: 'center', justifyContent: 'center' },
  mDoneText: { color: theme.ok, fontWeight: '900', fontSize: 18 },
});
