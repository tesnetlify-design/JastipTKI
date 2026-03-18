/**
 * productService.ts — Lazy Load + Cache per Kategori
 *
 * FILOSOFI:
 * User yang benar-benar melihat produk baru kurangi kuota baca.
 *
 * CATATAN PENTING — KENAPA TIDAK PAKAI orderBy DI FIRESTORE:
 * Query where('active','==',true) + orderBy('category') + orderBy('name')
 * membutuhkan Composite Index di Firestore Console.
 * Tanpa index → Firestore return 0 hasil tanpa error yang jelas.
 * Solusi: limit() tetap dipakai untuk pagination, sorting dilakukan
 * di client (JavaScript) setelah data diterima. Aman dan tidak butuh index.
 *
 * STRUKTUR CACHE:
 *   jastip_cache_products_page_1        ← page browse ke-1
 *   jastip_cache_products_page_2        ← page browse ke-2
 *   jastip_cache_products_cat_Makanan   ← semua produk kategori Makanan
 *   jastip_cache_products_category_list ← daftar kategori unik
 */

import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  orderBy,
  limit,
  startAfter,
  Unsubscribe
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Product } from '../types';
import { getCache, setCache } from './cacheService';

// ─── Constants ───────────────────────────────────────────────────────────────
export const PAGE_SIZE = 30;

const CACHE_PREFIX_PAGE  = 'products_page_';
const CACHE_PREFIX_CAT   = 'products_cat_';
const CACHE_CAT_LIST_KEY = 'products_category_list';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ProductPage {
  products: Product[];
  hasMore: boolean;
  lastDocId: string | null;
}

export interface FetchPageResult {
  page: ProductPage;
  lastSnap: any | null;
}

// ─── Sort helper (client-side, tidak butuh Firestore index) ──────────────────
const sortProducts = (products: Product[]): Product[] =>
  [...products].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

// ─── Cache Helpers ────────────────────────────────────────────────────────────
export const clearAllProductCache = (): void => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith(`jastip_cache_${CACHE_PREFIX_PAGE}`) ||
      key.startsWith(`jastip_cache_${CACHE_PREFIX_CAT}`) ||
      key === `jastip_cache_${CACHE_CAT_LIST_KEY}`
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  console.log('[ProductService] Semua cache produk dihapus.');
};

// ─── [APP] Fetch Page — cursor pagination ────────────────────────────────────
/**
 * Fetch 30 produk per halaman menggunakan cursor (startAfter).
 * TIDAK pakai orderBy di Firestore → tidak butuh composite index.
 * Sorting dilakukan di client setelah data diterima.
 */
export const fetchProductsPage = async (
  pageNumber: number,
  lastDocSnap: any | null
): Promise<FetchPageResult> => {
  const cacheKey = `${CACHE_PREFIX_PAGE}${pageNumber}`;
  const cached   = getCache<ProductPage>(cacheKey);
  if (cached) return { page: cached, lastSnap: null };

  try {
    const ref = collection(db, 'products');
    let q;

    if (lastDocSnap) {
      q = query(ref,
        where('active', '==', true),
        startAfter(lastDocSnap),
        limit(PAGE_SIZE)
      );
    } else {
      q = query(ref,
        where('active', '==', true),
        limit(PAGE_SIZE)
      );
    }

    const snap     = await getDocs(q);
    const products = sortProducts(
      snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Product[]
    );
    const hasMore   = snap.docs.length === PAGE_SIZE;
    const lastDocId = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null;
    const lastSnap  = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    const page: ProductPage = { products, hasMore, lastDocId };
    setCache(cacheKey, page);

    return { page, lastSnap };
  } catch (error) {
    console.error('[ProductService] Gagal fetch page:', pageNumber, error);
    return { page: { products: [], hasMore: false, lastDocId: null }, lastSnap: null };
  }
};

// ─── [APP] Fetch semua produk per kategori ────────────────────────────────────
/**
 * Fetch SEMUA produk dalam 1 kategori.
 * Hanya pakai 1 where → tidak butuh composite index.
 */
export const fetchProductsByCategory = async (category: string): Promise<Product[]> => {
  const safeCatKey = category.replace(/[^a-zA-Z0-9]/g, '_');
  const cacheKey   = `${CACHE_PREFIX_CAT}${safeCatKey}`;
  const cached     = getCache<Product[]>(cacheKey);
  if (cached) return cached;

  try {
    const ref = collection(db, 'products');
    const q   = query(ref,
      where('active', '==', true),
      where('category', '==', category)
    );
    const snap     = await getDocs(q);
    const products = sortProducts(
      snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Product[]
    );
    setCache(cacheKey, products);
    return products;
  } catch (error) {
    console.error('[ProductService] Gagal fetch kategori:', category, error);
    return [];
  }
};

// ─── [APP] Fetch daftar kategori ─────────────────────────────────────────────
/**
 * Ambil semua produk aktif → ekstrak kategori unik di client.
 * Hanya 1 where clause → tidak butuh index.
 * Hasil kategori di-cache seumur hidup.
 *
 * Note: ini memang baca semua produk sekali untuk ambil kategori.
 * Optimasi ke depan: simpan kategori sebagai dokumen tersendiri di Firestore.
 */
export const fetchCategoryList = async (): Promise<string[]> => {
  // Cek cache lokal dulu
  const cached = getCache<string[]>(CACHE_CAT_LIST_KEY);
  if (cached && cached.length > 0) return cached;

  try {
    // 1 READ SAJA — ambil dari settings/product_categories
    // Dokumen ini di-update otomatis oleh admin setiap kali ada perubahan produk.
    // Jauh lebih hemat vs baca semua 1.268 produk hanya untuk ambil kategori.
    const snap = await getDoc(doc(db, 'settings', 'product_categories'));
    if (snap.exists()) {
      const cats = (snap.data().categories || []) as string[];
      setCache(CACHE_CAT_LIST_KEY, cats);
      return cats;
    }
    // Fallback: jika dokumen belum ada (fresh deploy sebelum admin save produk apapun)
    // return array kosong — kategori akan tersedia setelah admin sync pertama kali
    return [];
  } catch (error) {
    console.error('[ProductService] Gagal fetch category list:', error);
    return [];
  }
};

// ─── [ADMIN] Real-time listener ──────────────────────────────────────────────
export const getActiveProductsRealtime = (
  onUpdate: (products: Product[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const ref = collection(db, 'products');
  const q   = query(ref, where('active', '==', true));
  return onSnapshot(q, (snapshot: any) => {
    const products = sortProducts(
      snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Product[]
    );
    onUpdate(products);
  }, (error: Error) => {
    console.error('Firestore Product Stream Error:', error);
    onError(error);
  });
};

// ─── Fetch produk tunggal by ID ───────────────────────────────────────────────
export const getProductById = async (productId: string): Promise<Product | null> => {
  try {
    const docRef  = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Product;
    return null;
  } catch (error) {
    console.error('Error getting product by ID:', error);
    return null;
  }
};
