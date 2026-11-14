import * as SecureStore from 'expo-secure-store';

// Android Keystore / iOS Keychain. Only non-seed app secrets go here; the wallet seed is managed by WDK core's encrypted keychain storage.
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const secureSet = (k: string, v: string) => SecureStore.setItemAsync(k, v, opts);
export const secureGet = (k: string) => SecureStore.getItemAsync(k, opts);
export const secureDelete = (k: string) => SecureStore.deleteItemAsync(k, opts);
