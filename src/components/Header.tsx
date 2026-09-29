import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { haptic } from '../services/haptic.js';

interface HeaderProps {
  tonWalletAddress?: string | null;
  onOpenWalletModal?: () => void;
  onOpenAdmin: () => void;
  isAdminActive: boolean;
  popUsdRate?: number;
  isAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAdmin,
  isAdminActive,
  popUsdRate = 0.001,
  isAdmin = false,
}) => {
  const rateText = (100 * (popUsdRate || 0.001)).toFixed(2);

  return (
    <header
      className="sticky top-0 z-40 w-full bg-[#0B0E14]/95 backdrop-blur-md border-b border-[#1E2638] px-4 pb-3"
      style={{
        paddingTop: 'max(56px, calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 52px), var(--tg-content-safe-area-inset-top, 0px))',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
        
        {/* Left: Sleek Mini Exchange Rate Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#121824] border border-[#252D3D] text-[10px] font-mono-digits text-gray-300 shadow-sm shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-gray-200">100 POP</span>
          <span className="text-gray-400">=</span>
          <span className="text-[#FFE600] font-bold">${rateText}</span>
        </div>

        {/* Center: App Title strictly "POP" centered */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white font-display select-none drop-shadow-[0_0_12px_rgba(255,230,0,0.35)] truncate">
            POP
          </h1>
        </div>

        {/* Right: Discreet Admin Command Center Access (Strictly hidden for regular users, visible ONLY for Telegram ID 7779827146) */}
        <div className="flex items-center justify-end shrink-0 min-w-[60px]">
          {isAdmin ? (
            <button
              onClick={() => {
                haptic.impact('light');
                onOpenAdmin();
              }}
              title="Admin Command Center"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${
                isAdminActive
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                  : 'bg-[#121824] hover:bg-[#1A2234] border-[#252D3D] text-amber-400 hover:text-amber-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">ADMIN</span>
            </button>
          ) : (
            <div className="w-14" />
          )}
        </div>
      </div>
    </header>
  );
};

