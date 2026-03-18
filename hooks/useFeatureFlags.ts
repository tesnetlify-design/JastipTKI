
import { useContext } from 'react';
import { FeatureFlagContext } from '../context/FeatureFlagProvider';

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagProvider");
  }
  return context;
};
