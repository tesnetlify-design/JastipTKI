import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AppConfig } from '../types';
import { getAppConfigCached, DEFAULT_APP_CONFIG } from '../services/appConfigService';

interface AppConfigContextType {
  config: AppConfig;
  loading: boolean;
  error: string | null;
}

export const AppConfigContext = createContext<AppConfigContextType>({
  config: DEFAULT_APP_CONFIG,
  loading: true,
  error: null
});

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppConfigCached(
      (newConfig) => {
        if (!cancelled) {
          setConfig(newConfig);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Failed to load app config:", err);
          setError(err.message);
          setLoading(false);
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <AppConfigContext.Provider value={{ config, loading, error }}>
      {children}
    </AppConfigContext.Provider>
  );
};
