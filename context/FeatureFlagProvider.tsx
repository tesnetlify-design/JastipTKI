import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { FeatureFlags } from '../types';
import { getFeatureFlagsCached, DEFAULT_FEATURE_FLAGS } from '../services/featureFlagService';

interface FeatureFlagContextType {
  flags: FeatureFlags;
  loading: boolean;
}

export const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: DEFAULT_FEATURE_FLAGS,
  loading: true
});

export const FeatureFlagProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFeatureFlagsCached(
      (newFlags) => {
        if (!cancelled) {
          setFlags(newFlags);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Failed to load feature flags:", err);
          setLoading(false);
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <FeatureFlagContext.Provider value={{ flags, loading }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};
