'use client';

import { useEffect } from 'react';

// Core Web Vitals thresholds
const THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint (good < 2.5s)
  FID: 100,  // First Input Delay (good < 100ms)
  CLS: 0.1,  // Cumulative Layout Shift (good < 0.1)
  FCP: 1800, // First Contentful Paint (good < 1.8s)
  TTFB: 600, // Time to First Byte (good < 600ms)
};

interface WebVital {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

export default function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Temporarily disable performance monitoring to debug refresh loop
    console.log('🔍 Performance monitoring temporarily disabled - debugging refresh loop');
    return;

    let clsValue = 0;

    const logWebVital = (vital: WebVital) => {
      const emoji = vital.rating === 'good' ? '✅' : vital.rating === 'needs-improvement' ? '⚠️' : '❌';
      console.log(`${emoji} ${vital.name}: ${vital.value.toFixed(2)}${vital.name === 'CLS' ? '' : 'ms'} (${vital.rating})`);
    };

    const getRating = (name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
      if (name === 'CLS') {
        return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
      }
      
      const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
      if (!threshold) return 'good';
      
      const goodThreshold = threshold;
      const needsImprovementThreshold = threshold * 1.5;
      
      return value <= goodThreshold ? 'good' : 
             value <= needsImprovementThreshold ? 'needs-improvement' : 'poor';
    };

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          const vital: WebVital = {
            name: 'LCP',
            value: entry.startTime,
            rating: getRating('LCP', entry.startTime),
            delta: entry.startTime,
            id: `${Date.now()}-${Math.random()}`
          };
          logWebVital(vital);
        } else if (entry.entryType === 'first-input' && 'duration' in entry) {
          const vital: WebVital = {
            name: 'FID',
            value: (entry as any).duration,
            rating: getRating('FID', (entry as any).duration),
            delta: (entry as any).duration,
            id: `${Date.now()}-${Math.random()}`
          };
          logWebVital(vital);
        } else if (entry.entryType === 'layout-shift' && 'value' in entry) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            const vital: WebVital = {
              name: 'CLS',
              value: clsValue,
              rating: getRating('CLS', clsValue),
              delta: clsValue,
              id: `${Date.now()}-${Math.random()}`
            };
            logWebVital(vital);
          }
        } else if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          const vital: WebVital = {
            name: 'FCP',
            value: entry.startTime,
            rating: getRating('FCP', entry.startTime),
            delta: entry.startTime,
            id: `${Date.now()}-${Math.random()}`
          };
          logWebVital(vital);
        } else if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          const ttfb = navEntry.responseStart - navEntry.requestStart;
          const vital: WebVital = {
            name: 'TTFB',
            value: ttfb,
            rating: getRating('TTFB', ttfb),
            delta: ttfb,
            id: `${Date.now()}-${Math.random()}`
          };
          logWebVital(vital);
        }
      }
    });

    try {
      observer.observe({ 
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint', 'navigation'] 
      });
    } catch (e) {
      console.warn('Performance monitoring not fully supported:', e);
    }

    // Monitor memory usage if available
    const logMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        console.log('💾 Memory usage:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
        });
      }
    };

    // Log memory usage every 30 seconds in development
    const memoryInterval = process.env.NODE_ENV === 'development' 
      ? setInterval(logMemoryUsage, 30000) 
      : null;

    if (process.env.NODE_ENV === 'development') {
      logMemoryUsage(); // Initial log
    }

    return () => {
      observer.disconnect();
      if (memoryInterval) clearInterval(memoryInterval);
    };
  }, []);

  return null;
} 