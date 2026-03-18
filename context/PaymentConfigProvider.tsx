import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { PaymentConfig } from '../types';
import { getPaymentConfigCached, DEFAULT_PAYMENT_CONFIG } from '../services/paymentConfigService';

interface PaymentConfigContextType {
  paymentConfig: PaymentConfig;
  loading: boolean;
}

export const PaymentConfigContext = createContext<PaymentConfigContextType>({
  paymentConfig: DEFAULT_PAYMENT_CONFIG,
  loading: true
});

export const PaymentConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPaymentConfigCached(
      (newConfig) => {
        if (!cancelled) {
          setPaymentConfig(newConfig);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Failed to load payment config:", err);
          setLoading(false);
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <PaymentConfigContext.Provider value={{ paymentConfig, loading }}>
      {children}
    </PaymentConfigContext.Provider>
  );
};
