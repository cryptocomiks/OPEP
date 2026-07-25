// Persistent local cash wallet (survives app restarts).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'uno_wallet_v1';
const START = 500;

export async function getBalance() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v == null) {
      await AsyncStorage.setItem(KEY, String(START));
      return START;
    }
    return parseInt(v, 10) || 0;
  } catch (e) {
    return START;
  }
}

export async function addBalance(amount) {
  try {
    const b = await getBalance();
    const nb = Math.max(0, b + Math.round(amount));
    await AsyncStorage.setItem(KEY, String(nb));
    return nb;
  } catch (e) {
    return amount;
  }
}
