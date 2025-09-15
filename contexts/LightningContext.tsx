'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LightningContextType {
  isLightningEnabled: boolean;
  toggleLightning: () => void;
  setLightningEnabled: (enabled: boolean) => void;
}

const LightningContext = createContext<LightningContextType | undefined>(undefined);

export function LightningProvider({ children }: { children: ReactNode }) {
  const [isLightningEnabled, setIsLightningEnabled] = useState(false);

  // Load Lightning setting from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('lightning_enabled');
    if (saved === 'true') {
      setIsLightningEnabled(true);
    }
  }, []);

  // Save to localStorage when setting changes
  useEffect(() => {
    localStorage.setItem('lightning_enabled', isLightningEnabled.toString());
  }, [isLightningEnabled]);

  const toggleLightning = () => {
    setIsLightningEnabled(prev => !prev);
  };

  const setLightningEnabled = (enabled: boolean) => {
    setIsLightningEnabled(enabled);
  };

  return (
    <LightningContext.Provider value={{
      isLightningEnabled,
      toggleLightning,
      setLightningEnabled
    }}>
      {children}
    </LightningContext.Provider>
  );
}

export function useLightning() {
  const context = useContext(LightningContext);
  if (context === undefined) {
    throw new Error('useLightning must be used within a LightningProvider');
  }
  return context;
}