import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Zap, ArrowRight, Wallet, CheckCircle2, Clock, ShieldCheck, Flame, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, AdminConfig, MinerTier, StorageTier } from '../types.js';
import { haptic } from '../services/haptic.js';

interface TabMineProps {
  user: User;
  config: AdminConfig;
  onClaim: () => Promise<void>;
  onNavigateToUpgrade: () => void;
  onOpenWalletModal: () => void;
  onOpenChannelModal: () => void;
  onStartMining: () => Promise<void>;
}

export const TabMine: React.FC<TabMineProps> = ({
  user,
  config,
  onClaim,
  onNavigateToUpgrade,
  onOpenWalletModal,
  onOpenChannelModal,
  onStartMining,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [liveUnclaimed, setLiveUnclaimed] = useState<number>(() => {
    if (!user.hasStartedMining) return 0;
    return typeof user.unclaimedMiningPOP === 'number' ? user.unclaimedMiningPOP : 0;
  });
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  // Sync state whenever user object from DB changes
  useEffect(() => {
    if (!user.hasStartedMining) {
      setLiveUnclaimed(0);
    } else if (typeof user.unclaimedMiningPOP === 'number') {
      setLiveUnclaimed(user.unclaimedMiningPOP);
    }
  }, [user.unclaimedMiningPOP, user.hasStartedMining]);

  // Active Miner & Storage config
  const currentMiner: MinerTier = useMemo(() => {
    return config.minerTiers.find(m => m.level === user.minerLevel) || config.minerTiers[0];
  }, [config.minerTiers, user.minerLevel]);

  const currentStorage: StorageTier = useMemo(() => {
    return config.storageTiers.find(s => s.tier === user.storageTier) || config.storageTiers[0];
  }, [config.storageTiers, user.storageTier]);

  // Real-time ticking client-side increment synchronized with UTC start time
  useEffect(() => {
    const updateTick = () => {
      if (!user.hasStartedMining || !user.lastClaimedAt) {
        setLiveUnclaimed(0);
        return;
      }
      const lastClaim = new Date(user.lastClaimedAt).getTime();
      if (!lastClaim || isNaN(lastClaim)) {
        setLiveUnclaimed(0);
        return;
      }
      const now = Date.now();
      const elapsedHours = Math.max(0, (now - lastClaim) / (1000 * 3600));

      // Storage cap limit (Tier 1 storage duration allows full continuous mining for 6 full hours)
      const effectiveHours = Math.min(elapsedHours, currentStorage.durationHours);
      const accrued = effectiveHours * currentMiner.speedPerHour;
      setLiveUnclaimed(parseFloat(accrued.toFixed(6)));
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [user.lastClaimedAt, user.hasStartedMining, currentMiner.speedPerHour, currentStorage.durationHours]);

  // Storage fill calculations
  const storageCapAmount = currentStorage.durationHours * currentMiner.speedPerHour;
  const storageFillPercent = Math.min(100, Math.round((liveUnclaimed / (storageCapAmount || 1)) * 100));
  const isStorageFull = storageFillPercent >= 100;

  const hasWallet = !!user.tonWalletAddress;
  const hasChannel = !!user.hasJoinedChannel;
  const hasStarted = !!user.hasStartedMining;
  const isFullyUnlocked = hasChannel;

  // Automatically trigger mining start once user joins Telegram channel
  useEffect(() => {
    if (hasChannel && !hasStarted && !isStarting) {
      setIsStarting(true);
      onStartMining()
        .then(() => {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#FFE600', '#00E5FF', '#34D399'],
          });
        })
        .catch((err) => {
          console.warn('Auto-start mining trigger failed:', err);
        })
        .finally(() => {
          setIsStarting(false);
        });
    }
  }, [hasChannel, hasStarted, isStarting, onStartMining]);

  // Format POP and USD calculation (100 POP = $0.10 USDT at rate 0.001)
  const totalBalanceUSD = (user.balancePOP * config.popUsdRate).toFixed(2);
  const unclaimedUSD = (liveUnclaimed * config.popUsdRate).toFixed(4);

  const handleClaimClick = async () => {
    if (!user.hasJoinedChannel) {
      haptic.warning();
      onOpenChannelModal();
      return;
    }

    if (liveUnclaimed <= 0.000001) {
      haptic.warning();
      return;
    }

    try {
      setIsClaiming(true);
      haptic.impact('heavy');
      await onClaim();
      haptic.success();

      // Confetti burst animation
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFE600', '#00E5FF', '#FF0000', '#FFFFFF'],
      });

      setClaimSuccess(`Claimed +${liveUnclaimed.toFixed(6)} POP!`);
      setTimeout(() => setClaimSuccess(null), 3000);
    } catch (err: any) {
      haptic.error();
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="space-y-2.5 pb-20 pt-3 sm:pt-4 px-3.5 max-w-md mx-auto">
      
      {/* 1. COMPACT ASSET HOLDING BANNER */}
      <div className="rounded-2xl bg-gradient-to-r from-[#121824] via-[#161F30] to-[#121824] border border-[#252D3D] px-3.5 py-2.5 shadow-md flex items-center justify-between gap-2.5">
        {/* LEFT: Total POP Balance */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 bg-[#0B0E14] px-2 py-1 rounded-lg border border-[#1E2638] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFE600] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 font-display">
              HOLDING
            </span>
          </div>
          <div className="flex items-baseline gap-1 min-w-0 truncate">
            <span className="text-base sm:text-lg font-black text-white font-mono-digits tracking-tight truncate">
              {user.balancePOP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-black text-[#FFE600] font-display shrink-0">POP</span>
          </div>
        </div>

        {/* RIGHT: Equivalent USD Value */}
        <div className="shrink-0 text-right">
          <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono-digits bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-xl inline-flex items-center whitespace-nowrap shadow-sm">
            ≈ ${totalBalanceUSD} USD
          </span>
        </div>
      </div>

      {/* 2. CENTER REWARD & GLOWING COIN SECTION */}
      <div className="relative rounded-3xl bg-[#121824] border border-[#252D3D] p-3.5 sm:p-4 shadow-xl overflow-hidden flex flex-col items-center text-center">
        
        {/* Glow ambient background lights */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-gradient-to-tr from-[#FFE600]/10 via-[#00E5FF]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Live Unclaimed Mining Balance Text/Counter - Placed directly ABOVE the Golden POP Mining Circle */}
        <div className="w-full z-10 text-center mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
            UNCLAIMED MINING REWARD
          </span>
          
          {/* Neon Digits Display with Live Real-Time Ticking */}
          <div className="flex items-baseline justify-center gap-1.5 my-0.5">
            <span className="text-3xl sm:text-4xl font-black text-[#FFE600] font-mono-digits tracking-tight drop-shadow-[0_0_15px_rgba(255,230,0,0.4)] leading-tight">
              {liveUnclaimed.toFixed(6)}
            </span>
            <span className="text-sm font-black text-[#FFE600] font-display">POP</span>
          </div>
          
          <div className="text-[11px] text-gray-400 font-mono-digits">
            ≈ ${unclaimedUSD} USD
          </div>
        </div>

        {/* 3D-Effect Glowing Popcorn Icon inside Golden Circular Container */}
        <div className="relative my-1 z-10">
          
          {/* Animated Golden Metallic Container with 3D Chamfer Bevel & Ambient Aura */}
          <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-gradient-to-b from-[#FFF59D] via-[#F59E0B] to-[#78350F] p-[3.5px] flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.3),0_8px_20px_rgba(0,0,0,0.6)] transition-all duration-300">
            
            {/* Inner Metallic Golden Coin Disc */}
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#0B0E14] via-[#121927] to-[#0D121D] border-[2.5px] border-[#FFE600]/80 flex flex-col items-center justify-between p-2.5 relative overflow-hidden group shadow-[inset_0_0_30px_rgba(0,0,0,0.85)]">
              
              {/* Radial Cyber Lines & Rotating Tech Rings */}
              <div className="absolute inset-0 bg-[radial-gradient(#FFE600_1px,transparent_1px)] [background-size:10px_10px] opacity-20 pointer-events-none" />
              <div className="absolute inset-2 rounded-full border border-dashed border-[#FFE600]/30 animate-[spin_24s_linear_infinite] pointer-events-none" />
              <div className="absolute inset-3 rounded-full border border-dotted border-[#00E5FF]/20 animate-[spin_16s_linear_infinite_reverse] pointer-events-none" />

              {/* Top Anchor Space (READY TO CLAIM badge cleanly removed) */}
              <div className="h-1" />

              {/* Custom Glowing 3D-Effect Popcorn Icon / Visual */}
              <div className="relative z-10 flex flex-col items-center justify-center my-auto transform group-hover:scale-105 transition-transform duration-300 select-none">
                
                {/* Popcorn Ambient Glowing Aura */}
                <div className="absolute w-24 h-24 bg-[#FFE600]/25 rounded-full blur-xl pointer-events-none animate-pulse" />
                
                {/* 3D Dimensional Popcorn SVG Vector */}
                <svg
                  className="w-20 h-20 sm:w-22 sm:h-22 drop-shadow-[0_8px_16px_rgba(245,158,11,0.5)]"
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <radialGradient id="popGlow" cx="50%" cy="40%" r="50%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="45%" stopColor="#FEF08A" />
                      <stop offset="80%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#92400E" />
                    </radialGradient>
                    <radialGradient id="butterDrop" cx="40%" cy="30%" r="55%">
                      <stop offset="0%" stopColor="#FFFBEB" />
                      <stop offset="35%" stopColor="#FDE047" />
                      <stop offset="80%" stopColor="#D97706" />
                      <stop offset="100%" stopColor="#78350F" />
                    </radialGradient>
                    <linearGradient id="bucketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#DC2626" />
                      <stop offset="50%" stopColor="#EF4444" />
                      <stop offset="100%" stopColor="#991B1B" />
                    </linearGradient>
                    <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FFE600" />
                      <stop offset="50%" stopColor="#FDE047" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <filter id="popShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
                    </filter>
                  </defs>

                  {/* Popcorn Bucket Base with Red & Cream Cyber Stripes */}
                  <g filter="url(#popShadow)">
                    {/* Bucket Body */}
                    <path
                      d="M32 62 L40 102 C40.5 105 44 107 48 107 L72 107 C76 107 79.5 105 80 102 L88 62 Z"
                      fill="url(#bucketGrad)"
                      stroke="#450A0A"
                      strokeWidth="1.5"
                    />
                    {/* Cream Stripes */}
                    <path d="M43 62 L49 107 L54 107 L50 62 Z" fill="#FEF3C7" opacity="0.95" />
                    <path d="M57 62 L59 107 L64 107 L63 62 Z" fill="#FEF3C7" opacity="0.95" />
                    <path d="M70 62 L69 107 L74 107 L77 62 Z" fill="#FEF3C7" opacity="0.95" />
                    
                    {/* Gold Metallic Rim of Bucket */}
                    <ellipse cx="60" cy="62" rx="28" ry="6" fill="url(#goldRim)" stroke="#B45309" strokeWidth="1" />
                    
                    {/* Cyber "POP" Badge on Bucket */}
                    <rect x="47" y="77" width="26" height="15" rx="4" fill="#0B0E14" stroke="#FFE600" strokeWidth="1.2" />
                    <text x="60" y="88" textAnchor="middle" fill="#FFE600" fontSize="9" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">POP</text>
                  </g>

                  {/* 3D Layered Fluffy Popcorn Kernels (Top Overflow) */}
                  <g filter="url(#popShadow)">
                    {/* Back Left Kernel */}
                    <circle cx="36" cy="48" r="13" fill="url(#butterDrop)" />
                    <circle cx="38" cy="44" r="5" fill="#FEF08A" opacity="0.8" />

                    {/* Back Right Kernel */}
                    <circle cx="84" cy="48" r="13" fill="url(#butterDrop)" />
                    <circle cx="82" cy="44" r="5" fill="#FEF08A" opacity="0.8" />

                    {/* Center Base Kernels */}
                    <circle cx="48" cy="42" r="14" fill="url(#popGlow)" />
                    <circle cx="72" cy="42" r="14" fill="url(#popGlow)" />

                    {/* Top Center Sovereign Giant Popcorn Kernel */}
                    <ellipse cx="60" cy="30" rx="16" ry="14" fill="url(#popGlow)" />
                    
                    {/* Secondary Fluffy Bubbles */}
                    <circle cx="51" cy="23" r="8" fill="#FFFBEB" />
                    <circle cx="68" cy="24" r="7.5" fill="#FEF08A" />
                    <circle cx="60" cy="18" r="6" fill="#FFFBEB" />

                    {/* Butter Melted Drizzles */}
                    <path d="M54 28 C57 32, 63 32, 66 28 C64 36, 56 36, 54 28 Z" fill="#F59E0B" />
                    <path d="M42 46 C45 50, 48 50, 50 47" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
                    <path d="M70 47 C72 50, 75 50, 78 46" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />

                    {/* Specular Highlights */}
                    <ellipse cx="57" cy="20" rx="3.5" ry="2" fill="#FFFFFF" opacity="0.9" />
                    <ellipse cx="49" cy="38" rx="3" ry="1.5" fill="#FFFFFF" opacity="0.85" />
                    <ellipse cx="71" cy="38" rx="3" ry="1.5" fill="#FFFFFF" opacity="0.85" />
                  </g>

                  {/* Sparkle Glints */}
                  <polygon points="30,22 32,27 37,29 32,31 30,36 28,31 23,29 28,27" fill="#FFE600" opacity="0.9" />
                  <polygon points="90,26 91.5,29.5 95,31 91.5,32.5 90,36 88.5,32.5 85,31 88.5,29.5" fill="#00E5FF" opacity="0.85" />
                </svg>

                {/* Popcorn Glow Reflection */}
                <div className="mt-0.5 text-[9px] font-black tracking-widest text-[#FFE600] uppercase font-display drop-shadow-[0_0_6px_rgba(255,230,0,0.6)]">
                  POP MINING CORE
                </div>
              </div>

              {/* Speed Display inside Coin Circle */}
              <div className="z-20 mb-0.5">
                <div className="px-2.5 py-0.5 rounded-full bg-[#0B0E14]/90 border border-[#2A354D] text-[9px] sm:text-[10px] font-bold text-gray-200 tracking-wider uppercase font-display flex items-center gap-1 shadow-sm">
                  <Zap className="w-2.5 h-2.5 text-[#FFE600] fill-[#FFE600]" />
                  <span>SPEED: {currentMiner.speedPerHour.toFixed(2)} POP/H</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Compact Storage Progress Bar */}
        <div className="w-full mt-2 bg-[#0B0E14] border border-[#1E2638] rounded-xl px-2.5 py-1.5 z-10">
          <div className="flex justify-between items-center text-[10px] mb-1">
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-[#00E5FF]" /> Storage ({currentStorage.name} • {currentStorage.durationHours}h)
            </span>
            <span className={`font-bold font-mono-digits ${isStorageFull ? 'text-red-400' : 'text-gray-300'}`}>
              {storageFillPercent}% {isStorageFull && '(FULL)'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#1A2234] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isStorageFull
                  ? 'bg-red-500 shadow-[0_0_8px_#FF0000]'
                  : 'bg-gradient-to-r from-[#00E5FF] to-[#FFE600]'
              }`}
              style={{ width: `${storageFillPercent}%` }}
            />
          </div>
        </div>

        {/* Claim Success Notification */}
        {claimSuccess && (
          <div className="mt-2 py-1 px-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{claimSuccess}</span>
          </div>
        )}
      </div>

      {/* 3. DIRECT ACTION BUTTONS: [UPGRADE ->] & [CONNECT WALLET / CLAIM REWARD] (ABOVE FOLD) */}
      <div className="grid grid-cols-2 gap-2.5 pt-0.5">
        
        {/* [UPGRADE ->] Cyan Button */}
        <button
          onClick={() => {
            haptic.impact('medium');
            onNavigateToUpgrade();
          }}
          className="py-3 px-3.5 rounded-2xl bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/60 text-[#00E5FF] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-cyan-500/10 font-display uppercase tracking-wider"
        >
          <span>UPGRADE</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Direct Action Button: Auto-handled Prerequisites -> Claim Reward */}
        {!hasChannel ? (
          /* Join Channel button replaces previously shown Connect Wallet button */
          <button
            onClick={() => {
              haptic.impact('medium');
              onOpenChannelModal();
            }}
            className="py-3 px-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25 font-display tracking-tight animate-pulse"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="truncate">Join Channel</span>
          </button>
        ) : (
          /* Channel Joined & Verified: Claim Reward */
          <button
            onClick={handleClaimClick}
            disabled={isClaiming || liveUnclaimed < 0.000001}
            className={`py-3 px-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg font-display tracking-tight ${
              liveUnclaimed >= 0.000001
                ? 'bg-[#FFE600] hover:bg-[#FFE600]/90 text-black shadow-yellow-500/30 hover:scale-[1.02] active:scale-[0.98] drop-shadow-[0_0_12px_rgba(255,230,0,0.4)]'
                : 'bg-[#1E2638] text-gray-500 border border-[#252D3D] cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isClaiming ? 'Claiming...' : 'Claim Reward'}</span>
          </button>
        )}
      </div>

      {/* 4. SLEEK ONBOARDING PROGRESS STRIP (Only shown if channel join is incomplete) */}
      {!isFullyUnlocked && (
        <div className="p-2.5 bg-[#121824]/90 rounded-2xl border border-[#252D3D] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="text-[11px] text-gray-300 font-medium">
              Join official channel to activate and claim mining rewards
            </span>
          </div>
          <button
            onClick={onOpenChannelModal}
            className="text-[10px] font-bold text-[#00E5FF] uppercase hover:underline shrink-0 ml-2"
          >
            Join →
          </button>
        </div>
      )}
    </div>
  );
};
