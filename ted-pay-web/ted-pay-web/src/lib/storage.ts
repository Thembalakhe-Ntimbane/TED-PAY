import localforage from 'localforage';

// IndexedDB (falls back to WebSQL/localStorage automatically). Replaces react-native-mmkv.
const db = localforage.createInstance({ name: 'ted-pay', storeName: 'app' });
export const store = {
  get: <T>(k: string) => db.getItem<T>(k),
  set: <T>(k: string, v: T) => db.setItem<T>(k, v),
  del: (k: string) => db.removeItem(k),
  clear: () => db.clear(),
};
