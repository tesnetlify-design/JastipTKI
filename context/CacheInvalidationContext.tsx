/**
 * CacheInvalidationContext.tsx
 *
 * Menyebarkan info "kategori mana yang baru saja di-invalidate"
 * ke seluruh komponen di bawah tree.
 *
 * Hook useProducts, useShippingRates, dll membaca `refreshKeys`
 * sebagai dependency useEffect mereka — sehingga otomatis fetch
 * ulang dari Firestore kalau kategori mereka masuk daftar.
 */

import React, { createContext, useContext } from 'react';

interface CacheInvalidationContextType {
  invalidatedKeys: string[]; // kategori yang cache-nya baru dihapus
}

export const CacheInvalidationContext = createContext<CacheInvalidationContextType>({
  invalidatedKeys: [],
});

export const useCacheInvalidation = () => useContext(CacheInvalidationContext);
