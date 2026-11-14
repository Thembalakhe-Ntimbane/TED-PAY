import React, { useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useStore } from '@/state/store';
import { Btn, TLoader } from '../components';
import { c } from '../theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export default function PosScreen({ navigation }: { navigation: { navigate(n: string): void } }) {
  const [digits, setDigits] = useState('');
  const { createRequest, busy } = useStore();
  const press = (k: string) => setDigits((d) => (k === 'C' ? '' : k === '⌫' ? d.slice(0, -1) : (d + k).replace(/^0+/, '').slice(0, 7)));
  const cents = Number(digits || 0) * 100;                         // whole rand entry; extend with decimal key if needed
  if (busy) return <View style={s.center}><TLoader /><Text>Locking your rate…</Text></View>;
  return (
    <View style={s.wrap}>
      <Text style={s.hi}>Let’s take a payment.</Text>
      <View style={s.card}>
        <Text style={s.label}>AMOUNT TO CHARGE</Text>
        <Text style={[s.amt, !digits && { color: c.mute, fontSize: 18, fontWeight: '400' }]}>{digits ? `R ${digits}` : 'Enter amount to charge in ZAR'}</Text>
      </View>
      <View style={s.pad}>{KEYS.map((k) => <Pressable key={k} style={s.key} onPress={() => press(k)}><Text style={s.keyT}>{k}</Text></Pressable>)}</View>
      <Btn label="Create payment request" disabled={!cents} onPress={async () => { await createRequest(cents); navigation.navigate('Request'); }} />
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, padding: 20, backgroundColor: c.bg }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  hi: { fontSize: 28, fontWeight: '800', marginVertical: 12 }, card: { backgroundColor: c.card, borderRadius: 16, padding: 20 },
  label: { color: c.red, fontSize: 12, fontWeight: '700' }, amt: { fontSize: 40, fontWeight: '800', marginTop: 8 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 }, key: { width: '33.33%', paddingVertical: 20, alignItems: 'center' }, keyT: { fontSize: 26 },
});
