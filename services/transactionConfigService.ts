import { db } from '../firebase';
import { 
  doc, 
  getDoc,
  onSnapshot,
  Unsubscribe 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { TransactionConfig } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'transaction_config';

export const DEFAULT_TRANS_CONFIG: TransactionConfig = {
  statusLabel: {
    'PENDING': 'Menunggu',
    'PROCESSING': 'Diproses',
    'SHIPPING': 'Dikirim',
    'DELIVERED': 'Selesai'
  },
  statusColor: {
    'PENDING': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    'PROCESSING': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'SHIPPING': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'DELIVERED': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  },
  allowedStatusTransition: {
    'PENDING': ['PROCESSING'],
    'PROCESSING': ['SHIPPING'],
    'SHIPPING': ['DELIVERED'],
    'DELIVERED': []
  }
};

/**
 * [APP] Mengambil TransactionConfig dengan cache 24 jam.
 */
export const getTransactionConfigCached = async (
  onUpdate: (config: TransactionConfig) => void,
  onError: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<TransactionConfig>(CACHE_KEY);
  if (cached) {
    onUpdate({ ...DEFAULT_TRANS_CONFIG, ...cached });
    return () => {};
  }
  try {
    const configRef = doc(db, "transaction_config", "status_flow");
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data() as TransactionConfig;
      const merged = { ...DEFAULT_TRANS_CONFIG, ...data };
      setCache(CACHE_KEY, merged);
      onUpdate(merged);
    } else {
      onUpdate(DEFAULT_TRANS_CONFIG);
    }
  } catch (error) {
    console.error("Firestore TransactionConfig Error:", error);
    onUpdate(DEFAULT_TRANS_CONFIG);
    onError(error as Error);
  }
  return () => {};
};

/**
 * [ADMIN] Real-time listener.
 */
export const getTransactionConfigRealtime = (
  onUpdate: (config: TransactionConfig) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const configRef = doc(db, "transaction_config", "status_flow");
  return onSnapshot(configRef, (snapshot: any) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as TransactionConfig;
      onUpdate({ ...DEFAULT_TRANS_CONFIG, ...data });
    } else {
      onUpdate(DEFAULT_TRANS_CONFIG);
    }
  }, (error: Error) => {
    console.error("Firestore Transaction Config Stream Error:", error);
    onError(error);
  });
};
