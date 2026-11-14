import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, StyleSheet } from 'react-native';
import { c } from './theme';

export const Btn = ({ label, onPress, kind = 'primary', disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean }) => (
  <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[s.btn, kind === 'ghost' && s.ghost, disabled && { opacity: 0.4 }]}>
    <Text style={[s.btnT, kind === 'ghost' && { color: c.ink }]}>{label}</Text>
  </Pressable>
);

/** Brand loader: the "T" assembled from 5 grid blocks that light up sequentially. */
export function TLoader() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(a, { toValue: 5, duration: 1500, useNativeDriver: true })); l.start(); return () => l.stop(); }, [a]);
  const cells = [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] as const;
  return (
    <View style={{ width: 90, height: 90 }}>
      {cells.map(([x, y], i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: x * 30, top: y * 30, width: 28, height: 28, backgroundColor: c.red,
          opacity: a.interpolate({ inputRange: [i, i + 0.5, i + 1, 5], outputRange: [0.15, 1, 1, 0.15], extrapolate: 'clamp' }) }} />
      ))}
    </View>
  );
}

export const XMark = () => <View style={s.x}><Text style={{ color: '#fff', fontSize: 64, fontWeight: '900' }}>✕</Text></View>;

const s = StyleSheet.create({
  btn: { backgroundColor: c.red, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.line },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 16 },
  x: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.bad, alignItems: 'center', justifyContent: 'center' },
});
