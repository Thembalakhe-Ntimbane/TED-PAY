import React from 'react';
import { FlatList, Text, View, Alert } from 'react-native';
import { useStore } from '@/state/store';
import { formatUsdt, formatZar } from '@/domain/priceLock';
import { savePdfProof, emailInvoice } from '@/services/proof';
import { Btn } from '../components';
import { c } from '../theme';

const label = { pending: 'Pending', completed: 'Completed', failed: 'Failed', expired: 'Failed', refunded: 'Refunded' } as const;

export default function TransactionsScreen() {
  const { ledger, refund } = useStore();
  return (
    <FlatList style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} data={ledger} keyExtractor={(r) => r.quote.txId}
      ListEmptyComponent={<Text style={{ color: c.mute, textAlign: 'center', marginTop: 40 }}>No payments yet.</Text>}
      renderItem={({ item: r }) => (
        <View style={{ backgroundColor: c.card, borderRadius: 14, padding: 16 }}>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>{formatZar(r.quote.zarCents)} · {formatUsdt(r.quote.usdtBase)} USDT</Text>
          <Text style={{ color: r.status === 'completed' ? c.ok : c.mute }}>{label[r.status]} · {new Date(r.quote.lockedAt).toLocaleString()}</Text>
          {r.status === 'completed' && <>
            <Btn label="Issue Refund" kind="ghost" onPress={() => Alert.alert('Refund?', 'Send the full USDT amount back to the payer.', [{ text: 'Cancel' }, { text: 'Refund', style: 'destructive', onPress: () => void refund(r.quote.txId) }])} />
            <Btn label="Download PDF proof" kind="ghost" onPress={() => void savePdfProof(r)} />
            <Btn label="Email invoice" kind="ghost" onPress={() => void emailInvoice(r)} />
          </>}
        </View>)} />
  );
}
