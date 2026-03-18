import { useState, useEffect, useContext } from 'react';
import { ShippingRate } from '../types';
import { getShippingRatesCached } from '../services/shippingService';
import { CacheInvalidationContext } from '../context/CacheInvalidationContext';

export const useShippingRates = () => {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { invalidatedKeys } = useContext(CacheInvalidationContext);

  // Re-fetch kalau 'shipping' masuk daftar invalidated
  useEffect(() => {
    let cancelled = false;
    getShippingRatesCached(
      (data) => {
        if (!cancelled) {
          setRates(data);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    );
    return () => { cancelled = true; };
  }, [invalidatedKeys]); // ← re-run kalau invalidatedKeys berubah

  return { rates, loading, error };
};
