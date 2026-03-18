import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  Unsubscribe 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ShippingRate } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'shipping_rates';

/**
 * [APP] Mengambil Shipping Rates dengan cache 24 jam.
 */
export const getShippingRatesCached = async (
  onUpdate: (rates: ShippingRate[]) => void,
  onError: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<ShippingRate[]>(CACHE_KEY);
  if (cached) {
    onUpdate(cached);
    return () => {};
  }
  try {
    const ratesRef = collection(db, "shipping_rates");
    const q = query(ratesRef, where("isActive", "==", true));
    const snap = await getDocs(q);
    const rates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShippingRate[];
    rates.sort((a, b) => a.countryName.localeCompare(b.countryName));
    setCache(CACHE_KEY, rates);
    onUpdate(rates);
  } catch (error) {
    console.error("Firestore ShippingRates Error:", error);
    onUpdate([]);
    onError(error as Error);
  }
  return () => {};
};

/**
 * [ADMIN] Real-time listener.
 */
export const getShippingRatesRealtime = (
  onUpdate: (rates: ShippingRate[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const ratesRef = collection(db, "shipping_rates");
  const q = query(ratesRef, where("isActive", "==", true));
  return onSnapshot(q, (snapshot: any) => {
    const rates = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as ShippingRate[];
    rates.sort((a, b) => a.countryName.localeCompare(b.countryName));
    onUpdate(rates);
  }, (error: Error) => {
    console.error("Firestore Shipping Rates Stream Error:", error);
    onError(error);
  });
};
