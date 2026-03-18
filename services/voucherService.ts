import { db } from '../firebase';
import { 
  collection, 
  getDocs,
  onSnapshot,
  Unsubscribe
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Voucher } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'vouchers';

/**
 * [APP] Mengambil voucher dengan cache 24 jam.
 */
export const getVouchersCached = async (
  onUpdate: (vouchers: Voucher[]) => void,
  onError?: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<Voucher[]>(CACHE_KEY);
  if (cached) {
    onUpdate(cached);
    return () => {};
  }
  try {
    const snap = await getDocs(collection(db, "vouchers"));
    const vouchers = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data } as Voucher;
    });
    setCache(CACHE_KEY, vouchers);
    onUpdate(vouchers);
  } catch (error) {
    console.warn("Vouchers access denied or error:", error);
    onUpdate([]);
  }
  return () => {};
};
