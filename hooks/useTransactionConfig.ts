
import { useContext } from 'react';
import { TransactionConfigContext } from '../context/TransactionConfigProvider';

export const useTransactionConfig = () => {
  const context = useContext(TransactionConfigContext);
  if (!context) {
    throw new Error("useTransactionConfig must be used within a TransactionConfigProvider");
  }
  return context;
};
