'use client';

import React from 'react';
import { useLightning } from '@/contexts/LightningContext';
import { toast } from '@/components/Toast';

export default function LightningToggle() {
  const { isLightningEnabled, toggleLightning } = useLightning();

  const handleToggle = () => {
    toggleLightning();
    if (!isLightningEnabled) {
      toast.success('⚡ Lightning features enabled! You can now send boosts to artists.');
    } else {
      toast.info('Lightning features disabled');
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
        </svg>
        <span className="text-sm font-medium text-gray-700">Lightning</span>
      </div>
      
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
          isLightningEnabled ? 'bg-yellow-500' : 'bg-gray-300'
        }`}
        aria-pressed={isLightningEnabled}
        aria-label="Toggle Lightning features"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isLightningEnabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}