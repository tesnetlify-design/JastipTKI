
import { useContext } from 'react';
import { AppConfigContext } from '../context/AppConfigProvider';

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useAppConfig must be used within an AppConfigProvider");
  }
  return context;
};
