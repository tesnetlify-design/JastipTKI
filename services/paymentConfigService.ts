import { db } from '../firebase';
import { 
  doc, 
  getDoc,
  onSnapshot,
  Unsubscribe 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { PaymentConfig } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'payment_config';

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  adminFee: 25000,
  serviceFee: 0.10,
  exchangeRate: 1,
  minTransaction: 10000,
  maxTransaction: 100000000,
  roundingMode: 'UP_05'
};

/**
 * [APP] Mengambil PaymentConfig dengan cache 24 jam.
 */
export const getPaymentConfigCached = async (
  onUpdate: (config: PaymentConfig) => void,
  onError: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<PaymentConfig>(CACHE_KEY);
  if (cached) {
    // Auto-correct serviceFee
    if (cached.serviceFee && cached.serviceFee > 1) cached.serviceFee = cached.serviceFee / 100;
    onUpdate({ ...DEFAULT_PAYMENT_CONFIG, ...cached });
    return () => {};
  }
  try {
    const configRef = doc(db, "payment_config", "global");
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data() as PaymentConfig;
      if (data.serviceFee && data.serviceFee > 1) data.serviceFee = data.serviceFee / 100;
      const merged = { ...DEFAULT_PAYMENT_CONFIG, ...data };
      setCache(CACHE_KEY, merged);
      onUpdate(merged);
    } else {
      onUpdate(DEFAULT_PAYMENT_CONFIG);
    }
  } catch (error) {
    console.error("Firestore PaymentConfig Error:", error);
    onUpdate(DEFAULT_PAYMENT_CONFIG);
    onError(error as Error);
  }
  return () => {};
};

/**
 * [ADMIN] Real-time listener.
 */
export const getPaymentConfigRealtime = (
  onUpdate: (config: PaymentConfig) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const configRef = doc(db, "payment_config", "global");
  return onSnapshot(configRef, (snapshot: any) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as PaymentConfig;
      if (data.serviceFee && data.serviceFee > 1) data.serviceFee = data.serviceFee / 100;
      onUpdate({ ...DEFAULT_PAYMENT_CONFIG, ...data });
    } else {
      onUpdate(DEFAULT_PAYMENT_CONFIG);
    }
  }, (error: Error) => {
    console.error("Firestore Payment Config Stream Error:", error);
    onError(error);
  });
};
