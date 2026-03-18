import { db } from '../firebase';
import { 
  doc, 
  getDoc,
  onSnapshot,
  Unsubscribe 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AppConfig } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'app_config';

export const DEFAULT_APP_CONFIG: AppConfig = {
  maintenanceMode: false,
  maintenanceMessage: "Kami sedang melakukan pemeliharaan rutin untuk meningkatkan layanan. Silakan kembali lagi nanti.",
  defaultCurrency: "IDR",
  promoBanner: "",
  supportContact: "6281299887766",
  appVersion: "1.6.0",
  minSupportedVersion: "1.5.0",
  enableVoucher: true,
  enableCheckout: true,
  adminWhatsApp: "6281299887766",
  adminEmail: "halo@jastiptki.com",
  hubName: "JastipTKI Hub Cianjur (Bp. Ahmad)",
  hubPhone: "081299887766",
  hubAddress: "Jl. Raya Cianjur No. 123, Kec. Cianjur, Kabupaten Cianjur, Jawa Barat 43211 (Pusat Logistik Cianjur)"
};

/**
 * [APP] Mengambil AppConfig dengan cache 24 jam.
 * Hanya 1 Firestore read per hari per user.
 */
export const getAppConfigCached = async (
  onUpdate: (config: AppConfig) => void,
  onError: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<AppConfig>(CACHE_KEY);
  if (cached) {
    onUpdate({ ...DEFAULT_APP_CONFIG, ...cached });
    return () => {};
  }
  try {
    const configRef = doc(db, "settings", "app_config");
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data() as AppConfig;
      const merged = { ...DEFAULT_APP_CONFIG, ...data };
      setCache(CACHE_KEY, merged);
      onUpdate(merged);
    } else {
      onUpdate(DEFAULT_APP_CONFIG);
    }
  } catch (error) {
    console.error("Firestore AppConfig Error:", error);
    onUpdate(DEFAULT_APP_CONFIG);
    onError(error as Error);
  }
  return () => {};
};

/**
 * [ADMIN] Real-time listener — dipakai di Admin Panel saja.
 */
export const getAppConfigRealtime = (
  onUpdate: (config: AppConfig) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const configRef = doc(db, "settings", "app_config");
  return onSnapshot(configRef, (snapshot: any) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as AppConfig;
      onUpdate({ ...DEFAULT_APP_CONFIG, ...data });
    } else {
      onUpdate(DEFAULT_APP_CONFIG);
    }
  }, (error: Error) => {
    console.error("Firestore Config Stream Error:", error);
    onError(error);
  });
};
