import React, { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useStore } from '@/state/store';
import { parsePayload } from '@/domain/paymentUri';
import { formatUsdt, formatZar } from '@/domain/priceLock';
import { LockedQuote } from '@/domain/types';
import { nfcAvailable, readPayload } from '@/services/nfc';
import { Btn, TLoader, XMark } from '../components';
import { c } from '../theme';

type Phase = { t: 'scan' } | { t: 'confirm'; q: LockedQuote } | { t: 'sending' } | { t: 'done' } | { t: 'declined' };

export default function PayerScreen() {
  const [phase, setPhase] = useState<Phase>({ t: 'scan' });
  const [link, setLink] = useState('');
  const payerPay = useStore((s) => s.payerPay);
  const device = useCameraDevice('back');

  const ingest = (raw: string) => {                       // QR, pasted link and NFC all land here
    const r = parsePayload(raw, Date.now());
    setPhase(r.ok ? { t: 'confirm', q: r.quote } : { t: 'declined' });
  };
  const scanner = useCodeScanner({ codeTypes: ['qr'], onCodeScanned: (codes) => { const v = codes[0]?.value; if (v && phase.t === 'scan') ingest(v); } });

  if (phase.t === 'sending') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><TLoader /><Text>Confirming payment…</Text></View>;
  if (phase.t === 'done') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28, fontWeight: '800' }}>Payment sent</Text><Btn label="Done" onPress={() => setPhase({ t: 'scan' })} /></View>;
  if (phase.t === 'declined') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}><XMark /><Text style={{ fontSize: 28, fontWeight: '800' }}>Payment Declined.</Text><Btn label="Try again" onPress={() => setPhase({ t: 'scan' })} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
      {device && <Camera style={{ height: 320, borderRadius: 16 }} device={device} isActive codeScanner={scanner} />}
      <TextInput placeholder="Or paste a payment link" value={link} onChangeText={setLink} autoCapitalize="none" style={{ borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, marginTop: 12 }} />
      <Btn kind="ghost" label="Open link" onPress={() => ingest(link)} />
      <Btn kind="ghost" label="Tap to pay with NFC" onPress={async () => { if (await nfcAvailable()) { const p = await readPayload(); if (p) ingest(p); } }} />
      <Modal visible={phase.t === 'confirm'} transparent animationType="slide">
        {phase.t === 'confirm' && (
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
            <View style={{ backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <Text style={{ color: c.mute }}>Paying</Text><Text style={{ fontSize: 22, fontWeight: '800' }}>{phase.q.merchantName}</Text>
              <Text style={{ fontSize: 34, fontWeight: '800', marginTop: 8 }}>{formatZar(phase.q.zarCents)}</Text>
              <Text style={{ color: c.red }}>You will be charged {formatUsdt(phase.q.usdtBase)} USDT</Text>
              <Btn label="Authorize with biometrics" onPress={async () => { const q = phase.q; setPhase({ t: 'sending' }); setPhase({ t: (await payerPay(q)) === 'ok' ? 'done' : 'declined' }); }} />
              <Btn kind="ghost" label="Cancel" onPress={() => setPhase({ t: 'scan' })} />
            </View>
          </View>)}
      </Modal>
    </View>
  );
}
