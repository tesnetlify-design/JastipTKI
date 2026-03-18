import { db } from '../firebase';
import { 
  doc, 
  getDoc,
  onSnapshot,
  Unsubscribe 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { FeatureFlags } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'feature_flags';

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableNewCheckout: false,
  enableReferral: false,
  enableBetaFeature: false,
  enableNewVoucherSystem: true
};

/**
 * [APP] Mengambil FeatureFlags dengan cache 24 jam.
 */
export const getFeatureFlagsCached = async (
  onUpdate: (flags: FeatureFlags) => void,
  onError: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<FeatureFlags>(CACHE_KEY);
  if (cached) {
    onUpdate({ ...DEFAULT_FEATURE_FLAGS, ...cached });
    return () => {};
  }
  try {
    const flagsRef = doc(db, "feature_flags", "global");
    const snap = await getDoc(flagsRef);
    if (snap.exists()) {
      const data = snap.data() as FeatureFlags;
      const merged = { ...DEFAULT_FEATURE_FLAGS, ...data };
      setCache(CACHE_KEY, merged);
      onUpdate(merged);
    } else {
      onUpdate(DEFAULT_FEATURE_FLAGS);
    }
  } catch (error) {
    console.error("Firestore FeatureFlags Error:", error);
    onUpdate(DEFAULT_FEATURE_FLAGS);
    onError(error as Error);
  }
  return () => {};
};

/**
 * [ADMIN] Real-time listener.
 */
export const getFeatureFlagsRealtime = (
  onUpdate: (flags: FeatureFlags) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const flagsRef = doc(db, "feature_flags", "global");
  return onSnapshot(flagsRef, (snapshot: any) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as FeatureFlags;
      onUpdate({ ...DEFAULT_FEATURE_FLAGS, ...data });
    } else {
      onUpdate(DEFAULT_FEATURE_FLAGS);
    }
  }, (error: Error) => {
    console.error("Firestore Feature Flags Stream Error:", error);
    onError(error);
  });
};
