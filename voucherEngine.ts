import { Transaction, Voucher, UserType, UserProfile } from './types';

/**
 * Classifies user based on their transaction history
 */
export const getUserType = (transactions: Transaction[]): UserType => {
  const totalCount = transactions.length;
  if (totalCount === 0) return 'new_user';
  const now = new Date();
  const transactionsThisMonth = transactions.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  if (transactionsThisMonth >= 3) return 'active_user';
  if (totalCount >= 10) return 'loyalty_user';
  return 'old_user';
};

export const isVoucherValid = (
  voucher: Voucher,
  userType: UserType,
  now: Date = new Date(),
  currentTransactionAmount?: number
): boolean => {
  if (!voucher.isActive) return false;
  if (voucher.usedCount >= voucher.quota) return false;
  // Guard: jika startDate/endDate tidak valid (data Firestore korup), anggap voucher tidak valid
  const start = new Date(voucher.startDate);
  const end = new Date(voucher.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  if (now < start || now > end) return false;
  if (voucher.minTransaction && currentTransactionAmount !== undefined && currentTransactionAmount < voucher.minTransaction) return false;
  if (voucher.targetUser !== 'all_user' && voucher.targetUser !== userType) return false;
  return true;
};

// ─── Helper: ambil koleksi voucher aktif user (gabung sistem baru + lama) ────
export const getUserVoucherCollection = (user: UserProfile): string[] => {
  const collection = new Set<string>(user.voucherCollection || []);
  // Backward compat: masukkan activeClaimedVoucher lama jika masih claimed
  if (user.activeClaimedVoucher && user.claimStatus === 'claimed') {
    collection.add(user.activeClaimedVoucher);
  }
  return Array.from(collection);
};

// ─── Semua kode yang sudah tidak bisa diklaim lagi (sudah pakai atau koleksi) ─
export const getAllUsedOrOwnedCodes = (user: UserProfile): string[] => {
  const all = new Set<string>();
  (user.claimedVouchers || []).forEach(c => all.add(c));
  (user.usedVouchers || []).forEach(c => all.add(c));
  (user.voucherCollection || []).forEach(c => all.add(c));
  if (user.activeClaimedVoucher) all.add(user.activeClaimedVoucher);
  return Array.from(all);
};

/**
 * getAvailableVouchers — untuk dropdown di checkout.
 * Return SEMUA voucher di koleksi user yang masih valid.
 */
export const getAvailableVouchers = (
  user: UserProfile,
  allVouchers: Voucher[],
  _transactions: Transaction[]
): Voucher[] => {
  const collection = getUserVoucherCollection(user);
  if (collection.length === 0) return [];

  const now = new Date();
  return collection
    .map(code => allVouchers.find(v => v.code === code))
    .filter((v): v is Voucher => {
      if (!v) return false;
      return v.isActive &&
        v.usedCount < v.quota &&
        now >= new Date(v.startDate) &&
        now <= new Date(v.endDate);
    });
};

/**
 * getBestVoucher — untuk kartu promo di Beranda.
 * Tampilkan voucher terbaik yang BISA DIKLAIM (belum dimiliki user).
 * Beranda tetap tampil meski user sudah punya voucher koleksi.
 */
export const getBestVoucher = (
  user: UserProfile,
  allVouchers: Voucher[],
  transactions: Transaction[]
): Voucher | null => {
  const userType = getUserType(transactions);
  const now = new Date();
  const ownedOrUsed = new Set(getAllUsedOrOwnedCodes(user));

  const claimable = allVouchers
    .filter(v => {
      if (!isVoucherValid(v, userType, now)) return false;
      if (ownedOrUsed.has(v.code)) return false; // sudah punya atau sudah pakai
      return true;
    })
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  return claimable.length > 0 ? claimable[0] : null;
};

/**
 * checkVoucherExpired — cek apakah ada voucher koleksi yang expired/nonaktif.
 * Return list kode yang perlu dibersihkan.
 */
export const checkExpiredVouchers = (user: UserProfile, allVouchers: Voucher[]): string[] => {
  const collection = getUserVoucherCollection(user);
  const now = new Date();
  return collection.filter(code => {
    const v = allVouchers.find(v => v.code === code);
    if (!v) return false; // tidak ada di list publik → JANGAN hapus (bisa voucher referral/private)
    if (!v.isActive) return true;
    return now > new Date(v.endDate);
  });
};

/** Backward compat — cek apakah activeClaimedVoucher expired */
export const checkVoucherExpired = (user: UserProfile, allVouchers: Voucher[]): boolean => {
  if (user.activeClaimedVoucher && user.claimStatus === 'claimed') {
    const v = allVouchers.find(v => v.code === user.activeClaimedVoucher);
    if (!v || !v.isActive) return true;
    return new Date() > new Date(v.endDate);
  }
  return false;
};
