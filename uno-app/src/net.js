// Realtime transport over a public MQTT broker (WebSocket).
// No backend to deploy: works out of the box inside Expo Go.
// Host is authoritative — it owns the game state and is the single writer.
//
// Privacy note: the host broadcasts full game state on a public broker, so a
// determined snooper on the same room code could read hands. Fine for a casual
// game with friends. Room codes are random enough to avoid collisions.

import mqtt from 'precompiled-mqtt';

export const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

export function makeCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

export function makeId() {
  return (
    'p' +
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36).slice(-4)
  );
}

// Robustly turn an MQTT payload into a UTF-8 string across implementations.
// precompiled-mqtt hands us a (polyfilled) Buffer whose toString('utf8') works,
// but we guard against plain Uint8Array (whose toString() yields "1,2,3").
function decodePayload(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.toString === 'function') {
    let s;
    try {
      s = payload.toString('utf8');
    } catch (e) {
      s = payload.toString();
    }
    // a real Buffer returns proper text; a Uint8Array returns "12,34,..."
    if (s && !/^[0-9]+(,[0-9]+)*$/.test(s)) return s;
  }
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder('utf-8').decode(payload);
    } catch (e) {}
  }
  // last resort: manual UTF-8 decode
  let bytes = '';
  for (let i = 0; i < payload.length; i++) bytes += String.fromCharCode(payload[i]);
  try {
    return decodeURIComponent(escape(bytes));
  } catch (e) {
    return bytes;
  }
}

function topics(code) {
  const base = `unoexpo/v1/${code}`;
  return {
    base,
    lobby: `${base}/lobby`,
    state: `${base}/state`,
    action: `${base}/action`,
    join: `${base}/join`,
    chat: `${base}/chat`,
    voice: `${base}/voice`,
  };
}

// A thin pub/sub client. The game orchestration lives in App.js.
export class GameClient {
  constructor(code, { onLobby, onState, onAction, onJoin, onStatus, onChat, onVoice } = {}) {
    this.code = code;
    this.t = topics(code);
    this.cb = { onLobby, onState, onAction, onJoin, onStatus, onChat, onVoice };
    this.client = null;
    this.connected = false;
  }

  connect() {
    const clientId = 'uno_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
    const client = mqtt.connect(BROKER_URL, {
      clientId,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      keepalive: 30,
    });
    this.client = client;

    client.on('connect', () => {
      this.connected = true;
      this.cb.onStatus && this.cb.onStatus('connected');
    });
    client.on('reconnect', () => this.cb.onStatus && this.cb.onStatus('reconnecting'));
    client.on('close', () => {
      this.connected = false;
      this.cb.onStatus && this.cb.onStatus('offline');
    });
    client.on('error', (e) => this.cb.onStatus && this.cb.onStatus('error:' + (e && e.message)));

    client.on('message', (topic, payload) => {
      let data;
      try {
        data = JSON.parse(decodePayload(payload));
      } catch (e) {
        return;
      }
      if (topic === this.t.lobby) this.cb.onLobby && this.cb.onLobby(data);
      else if (topic === this.t.state) this.cb.onState && this.cb.onState(data);
      else if (topic === this.t.action) this.cb.onAction && this.cb.onAction(data);
      else if (topic === this.t.join) this.cb.onJoin && this.cb.onJoin(data);
      else if (topic === this.t.chat) this.cb.onChat && this.cb.onChat(data);
      else if (topic === this.t.voice) this.cb.onVoice && this.cb.onVoice(data);
    });

    return client;
  }

  sub(topic) {
    this.client && this.client.subscribe(topic, { qos: 0 });
  }

  pub(topic, obj, retain = false) {
    this.client && this.client.publish(topic, JSON.stringify(obj), { qos: 0, retain });
  }

  // ---- role helpers ----
  subscribeAsHost() {
    this.sub(this.t.join);
    this.sub(this.t.action);
    this.sub(this.t.chat);
    this.sub(this.t.voice);
  }
  subscribeAsGuest() {
    this.sub(this.t.lobby);
    this.sub(this.t.state);
    this.sub(this.t.chat);
    this.sub(this.t.voice);
  }
  sendChat(msg) {
    this.pub(this.t.chat, msg, false);
  }
  sendVoice(msg) {
    this.pub(this.t.voice, msg, false);
  }
  publishLobby(lobby) {
    this.pub(this.t.lobby, lobby, true); // retained so late joiners sync
  }
  publishState(state) {
    this.pub(this.t.state, state, true); // retained
  }
  sendJoin(player) {
    this.pub(this.t.join, player, false);
  }
  sendAction(action) {
    this.pub(this.t.action, action, false);
  }

  end() {
    try {
      this.client && this.client.end(true);
    } catch (e) {}
    this.client = null;
    this.connected = false;
  }
}
