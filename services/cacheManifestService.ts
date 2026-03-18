/**
 * cacheManifestService.ts — Jastip App Side
 *
 * "Pembaca papan pengumuman" — dipanggil sekali saat app pertama load.
 *
 * Cara kerja:
 * 1. Baca settings/cache_manifest dari Firestore  → 1 read kecil
 * 2. Bandingkan tiap field dengan yang tersimpan di localStorage
 * 3. Kalau berbeda → hapus cache kategori itu → provider re-fetch otomatis
 * 4. Kalau sama → tidak ada yang dihapus, pakai cache lama
 *
 * Produk menggunakan multi-key cache (page_1, page_2, cat_Makanan, dst)
 * sehingga invalidasinya menggunakan clearAllProductCache() bukan removeItem biasa.
 */

import { db } from '../firebase';
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { clearAllProductCache } from './productService';

const LOCAL_MANIFEST_KEY = 'jastip_cache_manifest';

const MANIFEST_TO_CACHE_KEY: Record<string, string> = {
  products:           'products',
  shipping:           'shipping_rates',
  vouchers:           'vouchers',
  app_config:         'app_config',
  feature_flags:      'feature_flags',
  payment_config:     'payment_config',
  transaction_config: 'transaction_config',
};

const getLocalManifest = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(LOCAL_MANIFEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveLocalManifest = (manifest: Record<string, number>): void => {
  try { localStorage.setItem(LOCAL_MANIFEST_KEY, JSON.stringify(manifest)); } catch {}
};

/**
 * Invalidasi cache berdasarkan key.
 * Produk pakai clearAllProductCache() karena multi-key system.
 * Yang lain cukup removeItem biasa.
 */
const invalidateCacheKey = (cacheKey: string): void => {
  if (cacheKey === 'products') {
    clearAllProductCache();
    return;
  }
  try { localStorage.removeItem(`jastip_cache_${cacheKey}`); } catch {}
};

const invalidateAllCache = (): void => {
  Object.values(MANIFEST_TO_CACHE_KEY).forEach(invalidateCacheKey);
};

export const checkAndInvalidateCache = async (): Promise<string[]> => {
  const invalidated: string[] = [];
  try {
    const snap = await getDoc(doc(db, 'settings', 'cache_manifest'));

    if (!snap.exists()) {
      invalidateAllCache();
      console.log('[CacheManifest] Manifest belum ada, semua cache dihapus.');
      return Object.keys(MANIFEST_TO_CACHE_KEY);
    }

    const remoteManifest = snap.data() as Record<string, number>;
    const localManifest  = getLocalManifest();
    const newLocal: Record<string, number> = { ...localManifest };

    for (const [manifestKey, cacheKey] of Object.entries(MANIFEST_TO_CACHE_KEY)) {
      const remoteVer = remoteManifest[manifestKey];
      const localVer  = localManifest[manifestKey];

      if (remoteVer && remoteVer !== localVer) {
        invalidateCacheKey(cacheKey);
        invalidated.push(manifestKey);
        newLocal[manifestKey] = remoteVer;
      }
    }

    saveLocalManifest(newLocal);

    if (invalidated.length > 0) {
      console.log('[CacheManifest] Cache dihapus untuk:', invalidated.join(', '));
    }
  } catch (err) {
    console.warn('[CacheManifest] Gagal cek manifest, pakai cache lama:', err);
  }
  return invalidated;
};
