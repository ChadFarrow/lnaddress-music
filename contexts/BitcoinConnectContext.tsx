'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useLightning } from './LightningContext';

interface BitcoinConnectContextType {
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  checkConnection: () => void;
}

const BitcoinConnectContext = createContext<BitcoinConnectContextType | undefined>(undefined);

export function BitcoinConnectProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const { isLightningEnabled } = useLightning();
  const lastCheckRef = useRef<number>(0);
  const checkInProgressRef = useRef<boolean>(false);

  const checkConnection = async () => {
    try {
      // Don't check connections if Lightning is disabled
      if (!isLightningEnabled) {
        setIsConnected(false);
        return false;
      }
      
      // Prevent concurrent checks and rate limit to once per 5 seconds
      if (checkInProgressRef.current) {
        return isConnected;
      }
      
      const now = Date.now();
      if (now - lastCheckRef.current < 5000) {
        return isConnected;
      }
      
      checkInProgressRef.current = true;
      lastCheckRef.current = now;
      // Check for WebLN (Alby, etc.)
      const weblnExists = !!(window as any).webln;
      const weblnEnabled = weblnExists && !!(window as any).webln?.enabled;
      
      // Check Bitcoin Connect state - enhanced for AlbyGo detection
      const bcConnected = localStorage.getItem('bc:connectorType');
      let bcConfig = null;
      let nwcConnected = localStorage.getItem('nwc_connection_string');
      
      try {
        const bcConfigRaw = localStorage.getItem('bc:config');
        if (bcConfigRaw) {
          // Clean up potential JSON formatting issues
          const cleanConfigRaw = bcConfigRaw.trim();
          if (cleanConfigRaw.startsWith('{') && cleanConfigRaw.endsWith('}')) {
            bcConfig = JSON.parse(cleanConfigRaw);
            // AlbyGo might store NWC URL in bc:config
            if (bcConfig && bcConfig.nwcUrl && !nwcConnected) {
              nwcConnected = bcConfig.nwcUrl;
            }
          } else {
            console.warn('bc:config is not valid JSON format:', bcConfigRaw);
            bcConfig = null;
          }
        }
      } catch (error) {
        console.warn('Failed to parse bc:config:', error, 'Raw value:', localStorage.getItem('bc:config'));
        bcConfig = null;
      }
      
      // Debug: Log all Bitcoin Connect related localStorage items
      console.log('🔍 Bitcoin Connect localStorage debug:', {
        bcConnectorType: bcConnected,
        bcConfig: bcConfig,
        nwcConnectionString: nwcConnected,
        allLocalStorageKeys: Object.keys(localStorage).filter(k => k.startsWith('bc') || k.includes('nwc') || k.includes('alby')),
        allLocalStorageData: Object.fromEntries(
          Object.keys(localStorage)
            .filter(k => k.startsWith('bc') || k.includes('nwc') || k.includes('alby'))
            .map(k => [k, localStorage.getItem(k)])
        )
      });
      
      // Try to enable WebLN if it exists but isn't enabled
      let weblnEnabledAfter = weblnEnabled;
      if (weblnExists && !weblnEnabled) {
        try {
          await (window as any).webln.enable();
          // Wait a moment for the state to update
          await new Promise(resolve => setTimeout(resolve, 100));
          weblnEnabledAfter = !!(window as any).webln?.enabled;
          console.log('🔗 WebLN enabled successfully, new state:', weblnEnabledAfter);
        } catch (error) {
          console.log('🔗 WebLN enable failed or cancelled by user:', error);
          weblnEnabledAfter = false;
        }
      } else {
        weblnEnabledAfter = weblnEnabled;
      }
      
      // Check NWC service status without trying to import it here
      // to avoid chunk loading issues
      let nwcServiceConnected = false;
      try {
        // Only check if we have window and NWC connection
        if (typeof window !== 'undefined' && nwcConnected) {
          // Try to get the service if it's already loaded
          const nwcService = (window as any).__nwcService;
          if (nwcService && nwcService.isConnected) {
            nwcServiceConnected = nwcService.isConnected();
          }
        }
      } catch (error) {
        console.warn('NWC service check failed:', error);
        nwcServiceConnected = false;
      }
      
      // More strict WebLN checks - methods must exist AND be enabled
      const hasWeblnMethods = weblnExists && (
        typeof (window as any).webln?.makeInvoice === 'function' ||
        typeof (window as any).webln?.sendPayment === 'function' ||
        typeof (window as any).webln?.keysend === 'function'
      );
      
      // Only consider WebLN "connected" if it's actually enabled, not just if methods exist
      const finalWeblnStatus = weblnEnabledAfter && hasWeblnMethods;

      // Check if AlbyGo or other BC connectors are properly connected
      const bcConnectorConnected = !!(bcConnected || (bcConfig && (bcConfig.connectorType || bcConfig.nwcUrl)));
      
      const anyConnection = finalWeblnStatus || bcConnectorConnected || nwcConnected || nwcServiceConnected;

      // Debug logging
      console.log('🔍 Connection check:', {
        weblnExists,
        weblnEnabled: weblnEnabledAfter, 
        hasWeblnMethods,
        finalWeblnStatus,
        bcConnected: !!bcConnected,
        bcConnectorConnected,
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
    } finally {
      checkInProgressRef.current = false;
    }
  };

  useEffect(() => {
    // Initial check
    checkConnection();
    
    // Listen for Bitcoin Connect events
    const handleConnected = () => {
      console.log('🔗 Global Bitcoin Connect wallet connected');
      // Auto-refresh: Check immediately, then again after a delay to ensure state is settled
      checkConnection();
      setTimeout(() => {
        console.log('🔄 Auto-refresh: Re-checking connection after wallet action');
        checkConnection();
      }, 1000);
    };
    
    const handleDisconnected = () => {
      console.log('🔗 Global Bitcoin Connect wallet disconnected');
      // Auto-refresh: Check immediately, then again after a delay
      checkConnection();
      setTimeout(() => {
        console.log('🔄 Auto-refresh: Re-checking connection after disconnect');
        checkConnection();
      }, 1000);
    };

    window.addEventListener('bc:connected', handleConnected);
    window.addEventListener('bc:disconnected', handleDisconnected);
    
    // Listen for storage changes (in case BC updates localStorage from another tab/component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('bc:') || e.key.includes('nwc') || e.key.includes('alby'))) {
        console.log('🔄 Bitcoin Connect storage changed:', e.key, 'new value:', e.newValue);
        // Auto-refresh: Check immediately, then again after a delay for storage changes
        checkConnection();
        setTimeout(() => {
          console.log('🔄 Auto-refresh: Re-checking connection after storage change');
          checkConnection();
        }, 1500);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for WebLN enable events (Alby extension connections)
    const handleWeblnEnabled = () => {
      console.log('🔗 WebLN enabled event detected');
      // Auto-refresh: Check immediately, then again after a delay for WebLN
      checkConnection();
      setTimeout(() => {
        console.log('🔄 Auto-refresh: Re-checking connection after WebLN enable');
        checkConnection();
      }, 1000);
    };
    
    // Monitor for WebLN changes if available
    if (typeof window !== 'undefined' && (window as any).webln) {
      window.addEventListener('webln:enabled', handleWeblnEnabled);
    }

    // Listen for visibility changes (when user returns to tab after wallet action)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Tab became visible - checking wallet connection status');
        // Auto-refresh: Check connection when user returns to tab
        setTimeout(checkConnection, 500);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for focus events (when user clicks back into the app)
    const handleFocus = () => {
      console.log('🔄 Window focused - checking wallet connection status');
      // Auto-refresh: Check connection when window gains focus
      setTimeout(checkConnection, 500);
    };
    window.addEventListener('focus', handleFocus);

    // Check connection status periodically (less frequently to avoid rate limiting)
    const interval = setInterval(checkConnection, 60000); // Every 60 seconds to avoid rate limits

    return () => {
      window.removeEventListener('bc:connected', handleConnected);
      window.removeEventListener('bc:disconnected', handleDisconnected);
      window.removeEventListener('storage', handleStorageChange);
      if (typeof window !== 'undefined' && (window as any).webln) {
        window.removeEventListener('webln:enabled', handleWeblnEnabled);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [isLightningEnabled]);

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