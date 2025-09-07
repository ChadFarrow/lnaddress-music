'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BitcoinConnectContextType {
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  checkConnection: () => void;
}

const BitcoinConnectContext = createContext<BitcoinConnectContextType | undefined>(undefined);

export function BitcoinConnectProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);

  const checkConnection = async () => {
    try {
      // Check for WebLN (Alby, etc.)
      const weblnExists = !!(window as any).webln;
      const weblnEnabled = weblnExists && !!(window as any).webln?.enabled;
      
      // Check Bitcoin Connect state
      const bcConnected = localStorage.getItem('bc:connectorType');
      const nwcConnected = localStorage.getItem('nwc_connection_string');
      
      // Try to enable WebLN if it exists but isn't enabled
      if (weblnExists && !weblnEnabled) {
        try {
          await (window as any).webln.enable();
          console.log('🔗 WebLN enabled successfully');
        } catch (error) {
          console.log('🔗 WebLN enable failed or cancelled by user');
        }
      }
      
      // Re-check after potential enable
      const weblnEnabledAfter = !!(window as any).webln?.enabled;
      
      // Initialize NWC service if connection string exists
      let nwcServiceConnected = false;
      try {
        const { getNWCService } = await import('../lib/nwc-service');
        const nwcService = getNWCService();
        
        // If we have an NWC connection string but service isn't connected, try to connect
        if (nwcConnected && !nwcService.isConnected()) {
          console.log('🔄 Initializing NWC service with connection string');
          await nwcService.connect(nwcConnected);
        }
        
        nwcServiceConnected = nwcService.isConnected();
      } catch (error) {
        console.warn('NWC service connection failed:', error);
        nwcServiceConnected = false;
      }
      
      const anyConnection = weblnEnabledAfter || bcConnected || nwcConnected || nwcServiceConnected;
      
      // Debug logging
      console.log('🔍 Connection check:', {
        webln: weblnEnabledAfter,
        bcConnected: !!bcConnected,
        nwcConnected: !!nwcConnected,
        nwcServiceConnected,
        anyConnection
      });
      
      // Only log if connection status actually changed to reduce console spam
      const currentStatus = !!anyConnection;
      if (isConnected !== currentStatus) {
        console.log('🔄 Bitcoin Connect status changed:', currentStatus ? 'connected' : 'disconnected');
      }
      
      setIsConnected(currentStatus);
      return !!anyConnection;
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  };

  useEffect(() => {
    // Initial check
    checkConnection();
    
    // Listen for Bitcoin Connect events
    const handleConnected = () => {
      console.log('🔗 Global Bitcoin Connect wallet connected');
      checkConnection();
    };
    
    const handleDisconnected = () => {
      console.log('🔗 Global Bitcoin Connect wallet disconnected');
      checkConnection();
    };

    window.addEventListener('bc:connected', handleConnected);
    window.addEventListener('bc:disconnected', handleDisconnected);

    // Check connection status periodically (less frequently to avoid performance issues)
    const interval = setInterval(checkConnection, 30000); // Every 30 seconds instead of 2

    return () => {
      window.removeEventListener('bc:connected', handleConnected);
      window.removeEventListener('bc:disconnected', handleDisconnected);
      clearInterval(interval);
    };
  }, []);

  return (
    <BitcoinConnectContext.Provider value={{ isConnected, setIsConnected, checkConnection }}>
      {children}
    </BitcoinConnectContext.Provider>
  );
}

export function useBitcoinConnect() {
  const context = useContext(BitcoinConnectContext);
  if (context === undefined) {
    throw new Error('useBitcoinConnect must be used within a BitcoinConnectProvider');
  }
  return context;
}