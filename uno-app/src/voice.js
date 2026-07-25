// Push-to-talk voice notes. Records a short clip, returns base64 to send over the
// broker; recipients play it back. Not live streaming (Expo Go has no WebRTC),
// but works everywhere with no extra infra.
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

let recording = null;
let permission = null;

export async function ensurePermission() {
  if (permission !== null) return permission;
  try {
    const r = await Audio.requestPermissionsAsync();
    permission = !!r.granted;
  } catch (e) {
    permission = false;
  }
  return permission;
}

export async function startRecording() {
  const ok = await ensurePermission();
  if (!ok) return false;
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    await rec.startAsync();
    recording = rec;
    return true;
  } catch (e) {
    recording = null;
    return false;
  }
}

// Stops and returns base64 audio (or null).
export async function stopRecording() {
  if (!recording) return null;
  const rec = recording;
  recording = null;
  try {
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    if (!uri) return null;
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    // guard against oversized clips (broker limits)
    if (!b64 || b64.length > 180000) return null;
    return b64;
  } catch (e) {
    return null;
  }
}

export async function playBase64(b64) {
  try {
    const uri = FileSystem.cacheDirectory + `voice_${Date.now()}.m4a`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri }, { volume: 1 });
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.didJustFinish) sound.unloadAsync().catch(() => {});
    });
    await sound.playAsync();
  } catch (e) {}
}
