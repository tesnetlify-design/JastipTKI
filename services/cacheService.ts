/**
 * Cache Service — Sistem cache localStorage SEUMUR HIDUP
 *
 * Filosofi:
 * - Data statis (produk, tarif, config, dll) di-cache SEUMUR HIDUP.
 * - Cache TIDAK punya expiry otomatis.
 * - Cache hanya dihapus jika:
 *   1. Admin mengubah data → bumpCacheManifest() → user cek manifest saat
 *      buka app → cache kategori itu dihapus → fetch ulang dari Firestore.
 *   2. User hard refresh / hapus data browser secara manual.
 * - Transaksi user TIDAK di-cache (selalu real-time onSnapshot).
 *
 * Keuntungan:
 * - 0 Firestore reads untuk data yang tidak berubah, sesedikit apapun
 *   selang waktu antar sesi user.
 * - Hemat kuota drastis dibanding expiry 24 jam.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  // Tidak ada expiresAt — cache seumur hidup sampai di-invalidate
}

/**
 * Simpan data ke localStorage tanpa waktu kedaluwarsa.
 */
export const setCache = <T>(key: string, data: T): void => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`jastip_cache_${key}`, JSON.stringify(entry));
  } catch (e) {
    // Jika localStorage penuh, abaikan (tidak crash)
    console.warn('[Cache] Gagal menyimpan cache:', key, e);
  }
};

/**
 * Ambil data dari cache.
 * Return null hanya jika tidak ada data (belum pernah di-cache atau sudah dihapus).
 * Tidak ada pengecekan expiry — data valid selamanya sampai dihapus.
 */
export const getCache = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(`jastip_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch (e) {
    return null;
  }
};

/**
 * Hapus cache tertentu (dipanggil saat manifest invalidation).
 */
export const clearCache = (key: string): void => {
  localStorage.removeItem(`jastip_cache_${key}`);
};

/**
 * Hapus semua cache jastip (dipanggil saat fresh install / force reset).
 */
export const clearAllCache = (): void => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('jastip_cache_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
};

/**
 * Cek apakah cache ada (bukan cek validitas waktu — cache selalu valid jika ada).
 */
export const isCacheValid = (key: string): boolean => {
  return getCache(key) !== null;
};

/**
 * Info cache (untuk debugging).
 */
export const getCacheInfo = (key: string): { valid: boolean; age?: string } => {
  try {
    const raw = localStorage.getItem(`jastip_cache_${key}`);
    if (!raw) return { valid: false };
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    const ageMs = Date.now() - entry.timestamp;
    const fmt = (ms: number) => {
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      if (d > 0) return `${d}h ${h}j lalu`;
      if (h > 0) return `${h}j ${m}m lalu`;
      return `${m}m lalu`;
    };
    return { valid: true, age: fmt(ageMs) };
  } catch {
    return { valid: false };
  }
};

// Backward compat — durasi tidak dipakai lagi tapi signature tetap agar tidak ada error compile
export const CACHE_DURATION_24H = 0;
export const CACHE_DURATION_5MIN = 0;
