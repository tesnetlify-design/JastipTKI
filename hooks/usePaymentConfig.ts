
import { useContext } from 'react';
import { PaymentConfigContext } from '../context/PaymentConfigProvider';

export const usePaymentConfig = () => {
  const context = useContext(PaymentConfigContext);
  if (!context) {
    throw new Error("usePaymentConfig must be used within a PaymentConfigProvider");
  }
  return context;
};
