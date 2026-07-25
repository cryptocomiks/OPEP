// Persistent local store: cash wallet + owned/equipped card sleeves.
import AsyncStorage from '@react-native-async-storage/async-storage';

const BAL = 'uno_wallet_v1';
const OWNED = 'uno_skins_v1';
const EQ = 'uno_equip_v1';
const START = 500;

// ---------- cash ----------
export async function getBalance() {
  try {
    const v = await AsyncStorage.getItem(BAL);
    if (v == null) {
      await AsyncStorage.setItem(BAL, String(START));
      return START;
    }
    return parseInt(v, 10) || 0;
  } catch (e) {
    return START;
  }
}

export async function setBalance(v) {
  const nv = Math.max(0, Math.round(v));
  try {
    await AsyncStorage.setItem(BAL, String(nv));
  } catch (e) {}
  return nv;
}

export async function addBalance(amount) {
  const b = await getBalance();
  return setBalance(b + Math.round(amount));
}

// ---------- skins ----------
export async function getOwned() {
  try {
    const v = await AsyncStorage.getItem(OWNED);
    const arr = v ? JSON.parse(v) : [];
    if (!arr.includes('classic')) arr.unshift('classic');
    return arr;
  } catch (e) {
    return ['classic'];
  }
}

export async function addOwned(id) {
  const owned = await getOwned();
  if (!owned.includes(id)) {
    owned.push(id);
    try {
      await AsyncStorage.setItem(OWNED, JSON.stringify(owned));
    } catch (e) {}
  }
  return owned;
}

export async function getEquipped() {
  try {
    return (await AsyncStorage.getItem(EQ)) || 'classic';
  } catch (e) {
    return 'classic';
  }
}

export async function setEquipped(id) {
  try {
    await AsyncStorage.setItem(EQ, id);
  } catch (e) {}
  return id;
}
