import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { c } from '../theme';

// Cape Town tourism languages first, then the secondary global list.
export const LANGUAGES = ['English', 'Deutsch', 'Nederlands', 'Français', '中文 (Mandarin)', 'Afrikaans', 'isiXhosa', 'isiZulu', 'Español', 'Português', 'Italiano', 'العربية', 'हिन्दी', '日本語'];

export default function SettingsScreen() {
  const [lang, setLang] = useState('English');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
      {['Profile management', 'Security'].map((t) => <Text key={t} style={{ paddingVertical: 16, fontSize: 17, borderBottomWidth: 1, borderColor: c.line }}>{t}</Text>)}
      <Text style={{ marginTop: 20, fontWeight: '700' }}>Language</Text>
      {LANGUAGES.map((l, i) => (
        <Pressable key={l} onPress={() => setLang(l)} style={{ paddingVertical: 12, borderTopWidth: i === 5 ? 8 : 0, borderColor: c.bg }}>
          <Text style={{ color: lang === l ? c.red : c.ink, fontWeight: lang === l ? '700' : '400' }}>{l}</Text>
        </Pressable>))}
    </View>
  );
}
