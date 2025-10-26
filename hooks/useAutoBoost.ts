import { useState, useCallback, useEffect } from 'react';
import { PAYMENT_AMOUNTS } from '@/lib/constants';

/**
 * Hook for managing auto-boost feature
 */
export function useAutoBoost() {
  const [isAutoBoostEnabled, setIsAutoBoostEnabled] = useState(false);
  const [autoBoostAmount, setAutoBoostAmountState] = useState<number>(
    PAYMENT_AMOUNTS.AUTO_BOOST_DEFAULT
  );

  const toggleAutoBoost = useCallback(() => {
    setIsAutoBoostEnabled(prev => !prev);
  }, []);

  const setAutoBoostAmount = useCallback((amount: number) => {
    setAutoBoostAmountState(amount);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoBoostAmount', amount.toString());
    }
  }, []);

  // Load saved settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAmount = localStorage.getItem('autoBoostAmount');
      if (savedAmount) {
        const parsedAmount = parseInt(savedAmount, 10);
        if (!isNaN(parsedAmount)) {
          setAutoBoostAmountState(parsedAmount);
        }
      }

      const savedEnabled = localStorage.getItem('autoBoostEnabled');
      if (savedEnabled === 'true') {
        setIsAutoBoostEnabled(true);
      }
    }
  }, []);

  // Save enabled state when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoBoostEnabled', isAutoBoostEnabled.toString());
    }
  }, [isAutoBoostEnabled]);

  return {
    isAutoBoostEnabled,
    autoBoostAmount,
    toggleAutoBoost,
    setAutoBoostAmount
  };
}
