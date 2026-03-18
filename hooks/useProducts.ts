/**
 * useProducts.ts — Hook Lazy Load Produk
 *
 * FILOSOFI:
 * User yang benar-benar melihat produk baru kurangi kuota baca.
 *
 * Mode:
 *   browse   → Firestore pagination 30 per klik (cursor-based)
 *   category → Fetch semua produk 1 kategori, cache seumur hidup
 *   search   → Filter di dalam data yang sudah di-cache (0 reads)
 *
 * Reads Firestore per skenario:
 *   Buka katalog                    = 30 reads
 *   Klik "Muat Lebih" sekali        = 30 reads tambahan
 *   Pilih kategori "Makanan"        = N reads (N = jumlah produk Makanan)
 *   Search dalam kategori           = 0 reads (filter lokal)
 *   Buka lagi besok (tidak update)  = 0 reads (semua dari cache)
 */

import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { Product } from '../types';
import {
  fetchProductsPage,
  fetchProductsByCategory,
  fetchCategoryList,
  clearAllProductCache,
  PAGE_SIZE,
  ProductPage
} from '../services/productService';
import { CacheInvalidationContext } from '../context/CacheInvalidationContext';

export type ProductMode = 'browse' | 'category' | 'search';

export interface UseProductsReturn {
  products: Product[];
  categories: string[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  mode: ProductMode;
  loadMore: () => void;
  setCategory: (cat: string | null) => void;
  setSearch: (q: string) => void;
  resetFilters: () => void;
}

export const useProducts = (): UseProductsReturn => {
  const { invalidatedKeys } = useContext(CacheInvalidationContext);

  // ─── State ────────────────────────────────────────────────────────────────
  const [categories, setCategories]   = useState<string[]>([]);
  const [browsePages, setBrowsePages] = useState<ProductPage[]>([]);
  const [catCache, setCatCache]       = useState<Record<string, Product[]>>({});

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [searchQ, setSearchQ]         = useState<string>('');

  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [hasMore, setHasMore]         = useState(true);

  // Simpan snapshot doc terakhir untuk cursor Firestore
  const lastSnapRef = useRef<any>(null);
  const currentPageRef = useRef<number>(0);

  // ─── Mode ─────────────────────────────────────────────────────────────────
  const mode: ProductMode =
    searchQ.trim().length > 0 ? 'search' :
    selectedCat !== null       ? 'category' :
    'browse';

  // ─── Reset saat admin invalidasi ──────────────────────────────────────────
  useEffect(() => {
    if (invalidatedKeys.includes('products')) {
      clearAllProductCache();
      setBrowsePages([]);
      setCatCache({});
      lastSnapRef.current = null;
      currentPageRef.current = 0;
      setHasMore(true);
      setSelectedCat(null);
      setSearchQ('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidatedKeys]);

  // ─── Load kategori list ────────────────────────────────────────────────────
  useEffect(() => {
    fetchCategoryList().then(setCategories).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidatedKeys]);

  // ─── Load page pertama saat mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBrowsePages([]);
    lastSnapRef.current = null;
    currentPageRef.current = 0;

    fetchProductsPage(1, null).then(({ page, lastSnap }) => {
      if (cancelled) return;
      setBrowsePages([page]);
      lastSnapRef.current = lastSnap;
      currentPageRef.current = 1;
      setHasMore(page.hasMore);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('Gagal memuat katalog produk. Silakan coba lagi.');
      setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidatedKeys]);

  // ─── Load kategori saat dipilih ───────────────────────────────────────────
  useEffect(() => {
    if (selectedCat === null || catCache[selectedCat]) return;
    let cancelled = false;
    setLoading(true);

    fetchProductsByCategory(selectedCat).then(products => {
      if (cancelled) return;
      setCatCache(prev => ({ ...prev, [selectedCat]: products }));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('Gagal memuat produk kategori ini.');
      setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCat]);

  // ─── loadMore ─────────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (mode !== 'browse' || !hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = currentPageRef.current + 1;
    const cursor = lastSnapRef.current;

    fetchProductsPage(nextPage, cursor).then(({ page, lastSnap }) => {
      setBrowsePages(prev => [...prev, page]);
      lastSnapRef.current = lastSnap;
      currentPageRef.current = nextPage;
      setHasMore(page.hasMore);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [mode, hasMore, loadingMore]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const setCategory = useCallback((cat: string | null) => {
    setSearchQ('');
    setSelectedCat(cat);
    setError(null);
  }, []);

  const setSearch = useCallback((q: string) => {
    setSearchQ(q);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedCat(null);
    setSearchQ('');
    setError(null);
  }, []);

  // ─── Derived products ─────────────────────────────────────────────────────
  let displayProducts: Product[] = [];
  let finalHasMore = false;

  if (mode === 'browse') {
    displayProducts = browsePages.flatMap(p => p.products);
    finalHasMore = hasMore;
  } else if (mode === 'category') {
    displayProducts = selectedCat ? (catCache[selectedCat] || []) : [];
  } else {
    // search: filter dari pool yang sudah di-cache
    const pool = selectedCat
      ? (catCache[selectedCat] || [])
      : browsePages.flatMap(p => p.products);
    const q = searchQ.toLowerCase();
    displayProducts = pool.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  const isLoading = loading ||
    (mode === 'category' && selectedCat !== null && !catCache[selectedCat]);

  return {
    products: displayProducts,
    categories,
    loading: isLoading,
    loadingMore,
    error,
    hasMore: finalHasMore,
    mode,
    loadMore,
    setCategory,
    setSearch,
    resetFilters,
  };
};
