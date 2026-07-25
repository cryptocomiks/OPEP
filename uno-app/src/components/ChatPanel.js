import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../theme';
import { getClan } from '../clans';

// Slide-up chat for multiplayer games.
export default function ChatPanel({ messages, meId, onSend, onClose }) {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>💬 Chat</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 8 }}>
          {messages.length === 0 ? <Text style={styles.empty}>Dis bonjour 👋</Text> : null}
          {messages.map((m) => {
            const mine = m.pid === meId;
            const clan = getClan(m.clan);
            return (
              <View key={m.id} style={[styles.msg, mine && styles.msgMine]}>
                <Text style={[styles.msgName, mine && { color: theme.accent }]}>
                  {clan ? clan.icon + ' ' : ''}{mine ? 'Toi' : m.name}
                </Text>
                <Text style={styles.msgText}>{m.text}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Écris un message…"
            placeholderTextColor={theme.sub}
            maxLength={200}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Text style={styles.sendText}>Envoyer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: { backgroundColor: theme.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', borderWidth: 1, borderColor: theme.border },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { color: theme.text, fontWeight: '900', fontSize: 16 },
  close: { color: theme.sub, fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: 12, minHeight: 120 },
  empty: { color: theme.sub, textAlign: 'center', marginTop: 20 },
  msg: { backgroundColor: theme.panel2, borderRadius: 12, padding: 10, marginBottom: 6, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: '#26407a' },
  msgName: { color: theme.sub, fontWeight: '800', fontSize: 11, marginBottom: 2 },
  msgText: { color: theme.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: theme.border },
  input: { flex: 1, backgroundColor: theme.panel2, color: theme.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtn: { backgroundColor: theme.ok, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  sendText: { color: '#fff', fontWeight: '800' },
});
