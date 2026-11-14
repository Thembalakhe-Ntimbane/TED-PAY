import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PosScreen from '@/ui/screens/PosScreen';
import RequestScreen from '@/ui/screens/RequestScreen';
import TransactionsScreen from '@/ui/screens/TransactionsScreen';
import AnalyticsScreen from '@/ui/screens/AnalyticsScreen';
import SettingsScreen from '@/ui/screens/SettingsScreen';
import PayerScreen from '@/ui/screens/PayerScreen';
import { c } from '@/ui/theme';
// Real WDK mode: wrap in <WdkAppProvider bundle={{ bundle }} wdkConfigs={...}> using the generated ./.wdk bundle (see README).

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Merchant() {
  return (
    <Tabs.Navigator screenOptions={{ tabBarActiveTintColor: c.red }}>
      <Tabs.Screen name="Payments" component={PosScreen} />
      <Tabs.Screen name="Transactions" component={TransactionsScreen} />
      <Tabs.Screen name="Analytics" component={AnalyticsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: '⚙ Settings' }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Merchant" component={Merchant} options={{ headerShown: false }} />
        <Stack.Screen name="Request" component={RequestScreen} options={{ title: 'Payment request' }} />
        <Stack.Screen name="Pay" component={PayerScreen} options={{ title: 'Pay a merchant' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
