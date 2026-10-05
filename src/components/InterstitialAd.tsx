import React, { useEffect } from 'react';
import { adsProvider } from '../services/adsProvider.js';

interface InterstitialAdProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: string;
  secret?: string;
  onCompleted?: () => void;
}

/**
 * InterstitialAd:
 * All placeholder UI screens, waiting overlays, and 10-second timer fallback popups have been eliminated.
 * If an ad is available natively, it is handled by the official Adsgram / Monetag SDK directly.
 * If no ad is available or fails to load, it bypasses smoothly without blocking the user.
 */
export const InterstitialAd: React.FC<InterstitialAdProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Attempt native SDK trigger if available
    adsProvider.showNativeAd().then((shown) => {
      if (shown && onCompleted) {
        onCompleted();
      }
      onClose();
    }).catch(() => {
      // Smooth bypass without blocking the user
      if (onCompleted) onCompleted();
      onClose();
    });
  }, [isOpen, onClose, onCompleted]);

  // Zero placeholder screens or waiting popups rendered
  return null;
};
