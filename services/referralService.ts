import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  increment,
  serverTimestamp,
  arrayUnion,
  runTransaction,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReferralData {
  code: string;
  referredBy?: string;
  referredUsers: string[];
  totalReward: number;
  pendingReward: number;
  redeemedReward: number;
  createdAt?: any;
}

export interface ReferralConfig {
  rewardAmount: number;
  voucherCode: string;
  referrerVoucherCode: string;
  minRedeemAmount: number;
  maxReferrals: number;
  isActive: boolean;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  rewardAmount: 10000,
  voucherCode: 'REFERRAL2026',
  referrerVoucherCode: 'REFERRAL2026',
  minRedeemAmount: 10000,
  maxReferrals: 0,
  isActive: true,
};

export const generateReferralCode = (uid: string, displayName: string): string => {
  const namePart = (displayName || 'USER')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const uidPart = uid.slice(-4).toUpperCase();
  return `${namePart}-${uidPart}`;
};

export const getOrCreateReferral = async (
  uid: string,
  displayName: string,
): Promise<ReferralData> => {
  const code = generateReferralCode(uid, displayName);
  try {
    const refDocRef = doc(db, 'referrals', uid);
    const snap = await getDoc(refDocRef);
    if (snap.exists()) {
      const data = snap.data() as ReferralData;
      if (data.redeemedReward === undefined) {
        await updateDoc(refDocRef, { redeemedReward: 0 });
        return { ...data, redeemedReward: 0 };
      }
      return data;
    }
    const newData: ReferralData = {
      code,
      referredUsers: [],
      totalReward: 0,
      pendingReward: 0,
      redeemedReward: 0,
    };
    await setDoc(refDocRef, { ...newData, createdAt: serverTimestamp() });
    return newData;
  } catch (err) {
    console.error('getOrCreateReferral error:', err);
    return { code, referredUsers: [], totalReward: 0, pendingReward: 0, redeemedReward: 0 };
  }
};

// User B daftar pakai kode → User B dapat voucher langsung, User A dapat pendingReward
export const processReferralReward = async (
  newUserUid: string,
  referrerCode: string,
  config: ReferralConfig = DEFAULT_REFERRAL_CONFIG
): Promise<boolean> => {
  try {
    if (!config.isActive) return false;

    let referrerUid: string | null = null;
    let referrerData: any = null;

    try {
      const q = query(collection(db, 'referrals'), where('code', '==', referrerCode.toUpperCase()));
      const res = await getDocs(q);
      if (!res.empty) {
        referrerUid = res.docs[0].id;
        referrerData = res.docs[0].data();
      }
    } catch (err) {
      console.warn('[Referral] Query gagal:', err);
      return false;
    }

    if (!referrerUid || !referrerData) {
      console.warn('[Referral] Referrer tidak ditemukan untuk kode:', referrerCode);
      return false;
    }
    if (referrerUid === newUserUid) return false;
    if (referrerData.referredUsers?.includes(newUserUid)) return false;
    if (config.maxReferrals > 0 && (referrerData.referredUsers?.length ?? 0) >= config.maxReferrals) return false;

    await runTransaction(db, async (tx) => {
      // User A: pendingReward bertambah (belum jadi voucher)
      tx.set(doc(db, 'referrals', referrerUid!), {
        referredUsers: arrayUnion(newUserUid),
        pendingReward: increment(config.rewardAmount),
        totalReward: increment(config.rewardAmount),
        redeemedReward: referrerData.redeemedReward ?? 0,
      }, { merge: true });

      // User B: tandai sudah direferral
      tx.set(doc(db, 'referrals', newUserUid), {
        referredBy: referrerUid,
        redeemedReward: 0,
      }, { merge: true });

      // User B: masukkan voucher ke koleksi (bisa punya banyak voucher)
      tx.set(doc(db, 'users', newUserUid), {
        voucherCollection: arrayUnion(config.voucherCode),
        claimedVouchers: arrayUnion(config.voucherCode),
      }, { merge: true });

      // User A: TIDAK dapat voucher otomatis — harus cairkan manual
    });

    console.log('[Referral] Berhasil:', referrerUid, 'referred', newUserUid);
    return true;
  } catch (err) {
    console.error('[Referral] processReferralReward error:', err);
    return false;
  }
};

// User A cairkan reward → jadi voucher
export const redeemReferralReward = async (
  uid: string,
  config: ReferralConfig = DEFAULT_REFERRAL_CONFIG
): Promise<{ success: boolean; message: string }> => {
  try {
    const snap = await getDoc(doc(db, 'referrals', uid));
    if (!snap.exists()) return { success: false, message: 'Data referral tidak ditemukan' };

    const data = snap.data() as ReferralData;
    const pending = data.pendingReward ?? 0;

    if (pending < config.minRedeemAmount) {
      return {
        success: false,
        message: `Minimal saldo Rp ${config.minRedeemAmount.toLocaleString('id-ID')} untuk cairkan`
      };
    }

    await runTransaction(db, async (tx) => {
      tx.set(doc(db, 'referrals', uid), {
        pendingReward: 0,
        redeemedReward: increment(pending),
      }, { merge: true });
      tx.set(doc(db, 'users', uid), {
        voucherCollection: arrayUnion(config.referrerVoucherCode),
        claimedVouchers: arrayUnion(config.referrerVoucherCode),
      }, { merge: true });
    });

    return { success: true, message: `Berhasil cairkan Rp ${pending.toLocaleString('id-ID')} menjadi voucher!` };
  } catch (err) {
    console.error('[Referral] redeemReferralReward error:', err);
    return { success: false, message: 'Gagal mencairkan reward. Coba lagi.' };
  }
};

export const getReferralConfig = async (): Promise<ReferralConfig> => {
  try {
    const snap = await getDoc(doc(db, 'feature_flags', 'referral_config'));
    if (snap.exists()) return { ...DEFAULT_REFERRAL_CONFIG, ...snap.data() };
  } catch {}
  return DEFAULT_REFERRAL_CONFIG;
};

export const getReferralCodeFromURL = (): string | null => {
  try { return new URLSearchParams(window.location.search).get('ref'); } catch { return null; }
};
export const saveReferralCodeToSession = (code: string) => {
  try { localStorage.setItem('jastip_referral', code); } catch {}
};
export const getReferralCodeFromSession = (): string | null => {
  try { return localStorage.getItem('jastip_referral'); } catch { return null; }
};
export const clearReferralSession = () => {
  try { localStorage.removeItem('jastip_referral'); } catch {}
};
