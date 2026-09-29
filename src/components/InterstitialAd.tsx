import React, { useState, useEffect } from 'react';
import { X, Sparkles, ExternalLink, ShieldCheck, CheckCircle2, Tv, Play } from 'lucide-react';
import { haptic } from '../services/haptic.js';
import { adsProvider } from '../services/adsProvider.js';

interface InterstitialAdProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: string;
  secret?: string;
  onCompleted?: () => void;
}

export const InterstitialAd: React.FC<InterstitialAdProps> = ({
  isOpen,
  onClose,
  provider = 'adsgram',
  secret = '12345',
  onCompleted,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const [canDismiss, setCanDismiss] = useState(false);
  const [progressPercent, setProgressPercent] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(10);
      setCanDismiss(false);
      setProgressPercent(100);
      return;
    }

    setSecondsRemaining(10);
    setCanDismiss(false);
    setProgressPercent(100);

    // Also attempt native SDK trigger if Adsgram SDK is loaded
    adsProvider.showNativeAd().catch((e) => console.log('Ads native check:', e));

    const totalSeconds = 10;
    const interval = 100; // 100ms smooth updates
    let elapsedMs = 0;

    const timer = setInterval(() => {
      elapsedMs += interval;
      const remainingSec = Math.max(0, Math.ceil((totalSeconds * 1000 - elapsedMs) / 1000));
      const remainingPercent = Math.max(0, ((totalSeconds * 1000 - elapsedMs) / (totalSeconds * 1000)) * 100);

      setSecondsRemaining(remainingSec);
      setProgressPercent(remainingPercent);

      if (elapsedMs >= totalSeconds * 1000) {
        clearInterval(timer);
        setCanDismiss(true);
        haptic.success();
        if (onCompleted) {
          onCompleted();
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, onCompleted]);

  if (!isOpen) return null;

  const normalizedProvider = (provider || 'adsgram').toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#182338] via-[#121824] to-[#0B0E14] border-2 border-[#00E5FF]/40 rounded-3xl p-6 shadow-2xl text-center space-y-4 overflow-hidden">
        
        {/* Glow ambient light */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#00E5FF]/20 rounded-full blur-3xl pointer-events-none" />

        {/* 10s Non-Skippable Progress Bar */}
        <div className="w-full bg-[#0B0E14] h-1.5 rounded-full overflow-hidden border border-[#252D3D]">
          <div
            className="h-full bg-gradient-to-r from-[#00E5FF] to-blue-500 transition-all duration-100 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header with Ad Provider Tag & Non-skippable Countdown */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-[#0B0E14] px-3 py-1 rounded-full border border-[#252D3D]">
            <Tv className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-300">
              {normalizedProvider} AD
            </span>
          </div>

          {canDismiss ? (
            <button
              onClick={() => {
                haptic.impact('medium');
                onClose();
              }}
              className="flex items-center gap-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-full transition-all shadow-lg shadow-emerald-500/30"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>CLAIM & CLOSE</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-xs font-mono-digits text-amber-400 font-bold bg-[#0B0E14] px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
              <Play className="w-3 h-3 fill-current" />
              <span>Ad ends in {secondsRemaining}s</span>
            </div>
          )}
        </div>

        {/* Interactive Video / Sponsored Creative Visual */}
        <div className="my-2 py-6 px-4 rounded-2xl bg-gradient-to-br from-[#0F1420] via-[#161F30] to-[#0A0D14] border border-[#252D3D] flex flex-col items-center justify-center relative overflow-hidden group">
          {/* Subtle animated scanline */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-50 animate-pulse pointer-events-none" />

          <div className="text-5xl mb-2 select-none filter drop-shadow-[0_0_15px_rgba(255,230,0,0.6)]">
            🍿⚡💎
          </div>

          <h3 className="text-lg font-black text-white font-display tracking-tight">
            POP Token Ecosystem & Staking
          </h3>
          <p className="text-xs text-gray-300 mt-1.5 max-w-xs leading-relaxed">
            High-yield automated mining on TON Blockchain. Connect your TON wallet to claim your allocation.
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B0E14]/80 border border-[#252D3D] text-[10px] font-mono text-gray-400">
            <span className="text-[#00E5FF] font-bold">Block / Zone:</span>
            <span className="truncate max-w-[120px]">{secret || '12345'}</span>
          </div>
        </div>

        {/* Action Button */}
        {canDismiss ? (
          <button
            onClick={() => {
              haptic.impact('heavy');
              onClose();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 uppercase tracking-wider"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Claim Mining Reward & Return</span>
          </button>
        ) : (
          <button
            onClick={() => {
              haptic.impact('light');
              window.open('https://ton.org', '_blank');
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00E5FF] to-blue-500 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 uppercase tracking-wider"
          >
            <Sparkles className="w-4 h-4" />
            <span>Learn More (Opens in TON)</span>
          </button>
        )}

        {/* Footer Guarantee */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Non-skippable 10-second sponsor verification active</span>
        </div>
      </div>
    </div>
  );
};
