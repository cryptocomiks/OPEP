// Persistence for the catching mini-game: dex, party, items.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'uno_mon_v1';

function defaults() {
  return { dex: ['feuillu'], party: ['feuillu'], balls: 5, superballs: 0, potions: 2, started: true };
}

export async function loadMon() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const d = defaults();
    if (!raw) {
      await AsyncStorage.setItem(KEY, JSON.stringify(d));
      return d;
    }
    return { ...d, ...JSON.parse(raw) };
  } catch (e) {
    return defaults();
  }
}

export async function saveMon(m) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(m));
  } catch (e) {}
  return m;
}
