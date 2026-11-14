import React from 'react';
import { Text, View } from 'react-native';
import { useStore } from '@/state/store';
import { formatZar } from '@/domain/priceLock';
import { c } from '../theme';

/** Weekly performance from real ledger data (completed payments only). */
export default function AnalyticsScreen() {
  const ledger = useStore((s) => s.ledger);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const totals = days.map((d) => ledger.filter((r) => r.status === 'completed' && new Date(r.quote.lockedAt).toDateString() === d.toDateString()).reduce((a, r) => a + r.quote.zarCents, 0));
  const max = Math.max(1, ...totals);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
      <Text style={{ fontSize: 14, color: c.mute }}>Weekly performance</Text>
      <Text style={{ fontSize: 32, fontWeight: '800' }}>{formatZar(totals.reduce((a, b) => a + b, 0))}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 8, marginTop: 24 }}>
        {totals.map((t, i) => <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: '100%', height: Math.max(4, (t / max) * 150), backgroundColor: c.red, borderRadius: 6 }} />
          <Text style={{ fontSize: 11, color: c.mute }}>{days[i]!.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text></View>)}
      </View>
    </View>
  );
}
