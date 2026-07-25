// Simple SFX manager built on expo-av. Loads short WAVs once, replays on demand.
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILES = {
  tap: require('../assets/sounds/tap.wav'),
  play: require('../assets/sounds/play.wav'),
  draw: require('../assets/sounds/draw.wav'),
  plus: require('../assets/sounds/plus.wav'),
  shield: require('../assets/sounds/shield.wav'),
  swap: require('../assets/sounds/swap.wav'),
  steal: require('../assets/sounds/steal.wav'),
  turn: require('../assets/sounds/turn.wav'),
  win: require('../assets/sounds/win.wav'),
  explode: require('../assets/sounds/explode.wav'),
  catch: require('../assets/sounds/catch.wav'),
};

let sounds = {};
let ready = false;
let muted = false;
let loading = null;

export async function initSfx() {
  if (ready) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const m = await AsyncStorage.getItem('uno_muted_v1');
      muted = m === '1';
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
      await Promise.all(
        Object.entries(FILES).map(async ([k, src]) => {
          try {
            const { sound } = await Audio.Sound.createAsync(src, { volume: 0.85 });
            sounds[k] = sound;
          } catch (e) {}
        })
      );
      ready = true;
    } catch (e) {}
  })();
  return loading;
}

export function isMuted() {
  return muted;
}

export async function setMuted(v) {
  muted = !!v;
  try {
    await AsyncStorage.setItem('uno_muted_v1', muted ? '1' : '0');
  } catch (e) {}
  return muted;
}

export function play(name) {
  if (muted || !ready) return;
  const s = sounds[name];
  if (!s) return;
  s.replayAsync().catch(() => {});
}

// ---- background music (mini-game) ----
let music = null;
export async function playMusic() {
  if (muted) return;
  try {
    if (!music) {
      const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/mon_theme.wav'), { isLooping: true, volume: 0.45 });
      music = sound;
    }
    await music.setPositionAsync(0);
    await music.playAsync();
  } catch (e) {}
}
export async function stopMusic() {
  try {
    if (music) await music.stopAsync();
  } catch (e) {}
}
