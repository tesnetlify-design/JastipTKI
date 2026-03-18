import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { TransactionConfig } from '../types';
import { getTransactionConfigCached, DEFAULT_TRANS_CONFIG } from '../services/transactionConfigService';

interface TransactionConfigContextType {
  config: TransactionConfig;
  loading: boolean;
}

export const TransactionConfigContext = createContext<TransactionConfigContextType>({
  config: DEFAULT_TRANS_CONFIG,
  loading: true
});

export const TransactionConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<TransactionConfig>(DEFAULT_TRANS_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTransactionConfigCached(
      (newConfig) => {
        if (!cancelled) {
          setConfig(newConfig);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Failed to load transaction config:", err);
          setLoading(false);
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <TransactionConfigContext.Provider value={{ config, loading }}>
      {children}
    </TransactionConfigContext.Provider>
  );
};
