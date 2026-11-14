import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { env } from '@/config/env';
import { useStore } from '@/state/store';
import { buildPayLink, buildPayUri } from '@/domain/paymentUri';
import { formatUsdt, formatZar, remainingMs } from '@/domain/priceLock';
import { nfcAvailable, emulatePayload } from '@/services/nfc';
import { Btn, TLoader, XMark } from '../components';
import { c } from '../theme';

export default function RequestScreen({ navigation }: { navigation: { goBack(): void } }) {
  const { active, outcome, expireActive, cancelActive, clearOutcome } = useStore();
  const [left, setLeft] = useState(60_000);

  useEffect(() => {                                   // 1 Hz countdown driven by the locked absolute expiry
    if (!active) return;
    const t = setInterval(() => { const r = remainingMs(active.quote, Date.now()); setLeft(r); if (r === 0) expireActive(); }, 250);
    return () => clearInterval(t);
  }, [active, expireActive]);

  useEffect(() => {                                   // NFC HCE while the request is live
    if (!active) return;
    const ac = new AbortController();
    nfcAvailable().then((ok) => ok && emulatePayload(buildPayUri(active.quote), ac.signal)).catch(() => undefined);
    return () => ac.abort();
  }, [active]);

  if (outcome?.kind === 'received') return (
    <View style={s.center}><Text style={s.big}>Payment Received</Text>
      <Text>{formatZar(outcome.record.quote.zarCents)} · {formatUsdt(outcome.record.quote.usdtBase)} USDT</Text>
      <Btn label="Back to dashboard" onPress={() => { clearOutcome(); navigation.goBack(); }} /></View>);

  if (!active) return (
    <View style={s.center}><XMark /><Text style={s.big}>Quote expired</Text><Text>The 60-second rate lock ended. Start again for a fresh rate.</Text>
      <Btn label="New payment" onPress={navigation.goBack} /></View>);

  const q = active.quote;
  return (
    <View style={s.center}>
      <Text style={s.big}>{formatZar(q.zarCents)}</Text>
      <Text style={{ color: c.red }}>{formatUsdt(q.usdtBase)} USDT</Text>
      <Text style={[s.timer, left < 10_000 && { color: c.bad }]}>{Math.ceil(left / 1000)}s</Text>
      <QRCode value={buildPayUri(q)} size={220} backgroundColor="#fff" color="#000" ecl="M" />
      <Btn kind="ghost" label="Copy payment link" onPress={() => Clipboard.setStringAsync(buildPayLink(env.payLinkBase, q))} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}><TLoader /><Text>Waiting for on-chain confirmation…</Text></View>
      <Btn kind="ghost" label="Cancel" onPress={() => { cancelActive(); navigation.goBack(); }} />
    </View>);
}
const s = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8, backgroundColor: c.bg },
  big: { fontSize: 34, fontWeight: '800' }, timer: { fontSize: 22, fontWeight: '700', marginBottom: 8 } });
