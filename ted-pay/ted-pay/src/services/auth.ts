import * as LocalAuthentication from 'expo-local-authentication';

/** Biometric first; OS PIN/passcode fallback is allowed (disableDeviceFallback:false). */
export async function authorizePayment(reason: string): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason, disableDeviceFallback: false, cancelLabel: 'Cancel',
  });
  return res.success;
}
