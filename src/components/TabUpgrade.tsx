import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Box, Check, Lock, ArrowUpRight, Sparkles, Clock, AlertTriangle, Layers, ChevronRight, Compass } from 'lucide-react';
import { User, AdminConfig, MinerTier } from '../types.js';
import { haptic } from '../services/haptic.js';
import { api } from '../services/api.js';

interface TabUpgradeProps {
  user: User;
  config: AdminConfig;
  onUpgradeMiner: (targetLevel: number) => Promise<void>;
  onUpgradeStorage: (targetTier: number) => Promise<void>;
}

export const TabUpgrade: React.FC<TabUpgradeProps> = ({
  user,
  config,
  onUpgradeMiner,
  onUpgradeStorage,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'speed' | 'storage'>('speed');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  
  // Dynamic 50 Mining Levels State fetched from /api/mining/levels
  const [minerLevels, setMinerLevels] = useState<MinerTier[]>(config.minerTiers || []);
  const [loadingLevels, setLoadingLevels] = useState<boolean>(false);
  const [levelFilter, setLevelFilter] = useState<'all' | 'focus' | 'tier1' | 'tier2' | 'tier3'>('all');

  // Fetch all 50 levels dynamically on mount
  useEffect(() => {
    let isMounted = true;
    const fetchLevels = async () => {
      try {
        setLoadingLevels(true);
        const data = await api.getMiningLevels();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setMinerLevels(data.sort((a, b) => a.level - b.level));
        }
      } catch (err) {
        console.warn('[TabUpgrade] Could not fetch dynamic mining levels, using config default:', err);
        if (isMounted && config.minerTiers) {
          setMinerLevels(config.minerTiers);
        }
      } finally {
        if (isMounted) setLoadingLevels(false);
      }
    };
    fetchLevels();
    return () => {
      isMounted = false;
    };
  }, [config.minerTiers]);

  const handleSpeedUpgrade = async (level: number) => {
    try {
      setLoadingAction(`speed-${level}`);
      setFeedbackMsg(null);
      haptic.impact('heavy');
      await onUpgradeMiner(level);
      haptic.success();
      setFeedbackMsg({ text: `Successfully upgraded to Level ${level} Miner!` });
      setTimeout(() => setFeedbackMsg(null), 3000);
      // Refresh dynamic levels in case server updated speed parameters
      api.getMiningLevels().then(levels => {
        if (levels?.length) setMinerLevels(levels);
      }).catch(() => {});
    } catch (err: any) {
      haptic.error();
      setFeedbackMsg({ text: err.message || 'Upgrade failed', isError: true });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStorageUpgrade = async (tier: number) => {
    try {
      setLoadingAction(`storage-${tier}`);
      setFeedbackMsg(null);
      haptic.impact('heavy');
      await onUpgradeStorage(tier);
      haptic.success();
      setFeedbackMsg({ text: `Successfully upgraded to Tier ${tier} Storage Matrix!` });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      haptic.error();
      setFeedbackMsg({ text: err.message || 'Storage upgrade failed', isError: true });
    } finally {
      setLoadingAction(null);
    }
  };

  // Filtered levels for easy scrolling / mobile usability
  const displayedMinerLevels = useMemo(() => {
    if (!minerLevels || minerLevels.length === 0) return [];
    
    switch (levelFilter) {
      case 'focus': {
        // Focus on active level and next 3 tiers
        const minLvl = Math.max(1, user.minerLevel - 1);
        const maxLvl = Math.min(50, user.minerLevel + 3);
        return minerLevels.filter((t) => t.level >= minLvl && t.level <= maxLvl);
      }
      case 'tier1':
        return minerLevels.filter((t) => t.level >= 1 && t.level <= 15);
      case 'tier2':
        return minerLevels.filter((t) => t.level >= 16 && t.level <= 35);
      case 'tier3':
        return minerLevels.filter((t) => t.level >= 36 && t.level <= 50);
      case 'all':
      default:
        return minerLevels;
    }
  }, [minerLevels, levelFilter, user.minerLevel]);

  // Current active tier specs
  const activeMinerTier = useMemo(() => {
    return minerLevels.find((m) => m.level === user.minerLevel) || minerLevels[0] || {
      level: 1,
      name: 'Level 1 Base Micro Rig',
      speedPerHour: 0.20,
      pricePOP: 0,
      priceUSD: 0,
    };
  }, [minerLevels, user.minerLevel]);

  return (
    <div className="space-y-4 pb-20 pt-2 px-4 max-w-md mx-auto">
      
      {/* Header Info & Balance Reminder */}
      <div className="flex items-center justify-between bg-[#121824] border border-[#252D3D] p-3.5 rounded-2xl shadow-lg shadow-black/40">
        <div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Available Balance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-white font-mono-digits">{user.balancePOP.toLocaleString()}</span>
            <span className="text-xs font-bold text-[#FFE600]">POP</span>
            <span className="text-xs text-gray-400 font-mono-digits">
              (≈ ${(user.balancePOP * config.popUsdRate).toFixed(2)})
            </span>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-[#0B0E14] border border-[#00E5FF]/40 rounded-xl text-right">
          <span className="text-[10px] text-gray-400 block font-semibold">Active Fleet Rig</span>
          <span className="text-xs font-black text-[#00E5FF] flex items-center gap-1 justify-end">
            <Zap className="w-3 h-3 fill-[#00E5FF]" />
            Lvl {user.minerLevel}/50 ({activeMinerTier.speedPerHour} POP/h)
          </span>
        </div>
      </div>

      {/* Sub-Navigation Toggle: [⚡ Speed] and [📦 Storage] */}
      <div className="grid grid-cols-2 p-1 bg-[#121824] border border-[#252D3D] rounded-2xl gap-1">
        <button
          onClick={() => {
            haptic.selection();
            setActiveSubTab('speed');
          }}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'speed'
              ? 'bg-[#FFE600] text-black shadow-md font-display'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>⚡ Speed Fleet (50 Lvl)</span>
        </button>

        <button
          onClick={() => {
            haptic.selection();
            setActiveSubTab('storage');
          }}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'storage'
              ? 'bg-[#00E5FF] text-black shadow-md font-display'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Box className="w-4 h-4 fill-current" />
          <span>📦 Storage Vault</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
          feedbackMsg.isError
            ? 'bg-red-500/15 border-red-500/40 text-red-400'
            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
        }`}>
          {feedbackMsg.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* VIEW 1: SPEED TAB 2-COLUMN GRID VIEW */}
      {activeSubTab === 'speed' && (
        <div className="space-y-3">
          {/* Header updated as required */}
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-xs font-extrabold text-white uppercase tracking-wider block font-display">
                MINER RIG FLEET (50 LEVELS)
              </span>
              <span className="text-[10px] text-gray-400">
                Smooth linear growth • 0.20 POP/h to 1.99 POP/h
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono-digits font-bold">
                50 RIGS SYNCED
              </span>
            </div>
          </div>

          {/* Quick Filter Navigation Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <button
              onClick={() => {
                haptic.selection();
                setLevelFilter('all');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                levelFilter === 'all'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-[#121824] text-gray-400 border border-[#252D3D] hover:text-white'
              }`}
            >
              All (50)
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setLevelFilter('focus');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                levelFilter === 'focus'
                  ? 'bg-[#FFE600] text-black shadow-sm'
                  : 'bg-[#121824] text-gray-400 border border-[#252D3D] hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Next Up ({user.minerLevel + 1})</span>
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setLevelFilter('tier1');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                levelFilter === 'tier1'
                  ? 'bg-[#00E5FF] text-black shadow-sm'
                  : 'bg-[#121824] text-gray-400 border border-[#252D3D] hover:text-white'
              }`}
            >
              Lvl 1-15
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setLevelFilter('tier2');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                levelFilter === 'tier2'
                  ? 'bg-[#00E5FF] text-black shadow-sm'
                  : 'bg-[#121824] text-gray-400 border border-[#252D3D] hover:text-white'
              }`}
            >
              Lvl 16-35
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setLevelFilter('tier3');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                levelFilter === 'tier3'
                  ? 'bg-[#00E5FF] text-black shadow-sm'
                  : 'bg-[#121824] text-gray-400 border border-[#252D3D] hover:text-white'
              }`}
            >
              Lvl 36-50
            </button>
          </div>

          {/* 50 Levels Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {displayedMinerLevels.map((tier) => {
              const isCurrent = user.minerLevel === tier.level;
              const isUnlocked = user.minerLevel > tier.level;
              const isNext = tier.level === user.minerLevel + 1;
              const isLocked = tier.level > user.minerLevel + 1;
              const canAfford = user.balancePOP >= tier.pricePOP;
              const missingPOP = Math.max(0, tier.pricePOP - user.balancePOP);

              return (
                <div
                  key={tier.level}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-b from-[#182338] to-[#121824] border-[#FFE600] shadow-[0_0_15px_rgba(255,230,0,0.18)] ring-1 ring-[#FFE600]/40'
                      : isNext
                      ? 'bg-[#121824] border-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.12)]'
                      : isUnlocked
                      ? 'bg-[#0E131F] border-[#1E2638] opacity-80'
                      : 'bg-[#0B0E14] border-[#182030] opacity-65'
                  }`}
                >
                  <div>
                    {/* Level Title & Status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-white font-display flex items-center gap-1">
                        Lvl {tier.level}
                        {tier.level === 50 && (
                          <span className="text-[9px] text-[#FFE600] font-mono">★ MAX</span>
                        )}
                      </span>
                      {isCurrent ? (
                        <span className="text-[9px] bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/50 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                          CURRENT
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> PASSED
                        </span>
                      ) : isLocked ? (
                        <span className="text-[9px] text-gray-500 font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      ) : (
                        <span className="text-[9px] bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                          NEXT UP
                        </span>
                      )}
                    </div>

                    <h4 className="text-[11px] font-bold text-gray-300 truncate mb-2" title={tier.name}>
                      {tier.name}
                    </h4>

                    {/* Mining Rate */}
                    <div className="p-2 bg-[#0B0E14] rounded-xl border border-[#1E2638] space-y-0.5 mb-2.5">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Speed Rate:</div>
                      <div className="text-xs font-black text-[#FFE600] font-mono-digits flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-[#FFE600]" />
                        <span>{tier.speedPerHour.toFixed(2)} POP/h</span>
                      </div>
                    </div>

                    {/* Price in POP & USD */}
                    <div className="text-[11px] text-gray-400 font-mono-digits mb-3">
                      {tier.pricePOP === 0 ? (
                        <span className="text-emerald-400 font-extrabold text-[10px] uppercase tracking-wider">
                          FREE BASE
                        </span>
                      ) : (
                        <div>
                          <div className="text-white font-extrabold">{tier.pricePOP.toLocaleString()} POP</div>
                          <div className="text-[10px] text-gray-500">≈ ${tier.priceUSD.toFixed(2)} USD</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button: [⚡ ACTIVE] or [⚡ UPGRADE] or [⚡ NEED XX POP] or [LOCKED] */}
                  <div>
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2 bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-default font-display"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>CURRENT RIG</span>
                      </button>
                    ) : isUnlocked ? (
                      <button
                        disabled
                        className="w-full py-2 bg-[#1E2638] text-gray-500 rounded-xl text-xs font-bold cursor-default flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>ACQUIRED</span>
                      </button>
                    ) : isNext ? (
                      <button
                        onClick={() => handleSpeedUpgrade(tier.level)}
                        disabled={!canAfford || loadingAction !== null}
                        className={`w-full py-2 rounded-xl text-xs font-black tracking-tight flex items-center justify-center gap-1 transition-all ${
                          canAfford
                            ? 'bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black shadow-lg shadow-cyan-500/25 active:scale-95 font-display'
                            : 'bg-[#1E2638] text-gray-400 cursor-not-allowed text-[10px]'
                        }`}
                      >
                        {loadingAction === `speed-${tier.level}` ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : canAfford ? (
                          <>
                            <Zap className="w-3 h-3 fill-current" />
                            <span>UPGRADE RIG</span>
                          </>
                        ) : (
                          <span>NEED {missingPOP.toLocaleString()} POP</span>
                        )}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2 bg-[#121824] text-gray-600 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-not-allowed"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Requires Lvl {tier.level - 1}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: STORAGE TAB 2-COLUMN GRID VIEW */}
      {activeSubTab === 'storage' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Offline Storage Matrix (Cap Tiers)
            </span>
            <span className="text-[10px] text-gray-500">Live Sync With Server</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {config.storageTiers.map((tier) => {
              const isCurrent = user.storageTier === tier.tier;
              const isUnlocked = user.storageTier > tier.tier;
              const isNext = tier.tier === user.storageTier + 1;
              const isLocked = tier.tier > user.storageTier + 1;
              const canAfford = user.balancePOP >= tier.pricePOP;
              const missingPOP = Math.max(0, tier.pricePOP - user.balancePOP);

              return (
                <div
                  key={tier.tier}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-b from-[#182338] to-[#121824] border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                      : isNext
                      ? 'bg-[#121824] border-[#FFE600]/50 hover:border-[#FFE600]'
                      : 'bg-[#0B0E14] border-[#1E2638] opacity-75'
                  }`}
                >
                  <div>
                    {/* Tier Title & Status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-extrabold text-white font-display">
                        Tier {tier.tier}
                      </span>
                      {isCurrent ? (
                        <span className="text-[9px] bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                          ACTIVE
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> PASSED
                        </span>
                      ) : isLocked ? (
                        <span className="text-[9px] text-gray-500 font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      ) : (
                        <span className="text-[9px] bg-[#FFE600]/20 text-[#FFE600] px-1.5 py-0.5 rounded font-bold uppercase">
                          NEXT UP
                        </span>
                      )}
                    </div>

                    <h4 className="text-[11px] font-bold text-gray-300 truncate mb-2">{tier.name}</h4>

                    {/* Offline Duration */}
                    <div className="p-2 bg-[#0B0E14] rounded-xl border border-[#1E2638] space-y-1 mb-2.5">
                      <div className="text-[10px] text-gray-400">Offline Duration:</div>
                      <div className="text-xs font-black text-[#00E5FF] font-mono-digits flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#00E5FF]" />
                        <span>{tier.durationHours} Hours</span>
                      </div>
                    </div>

                    {/* Price Equivalent */}
                    <div className="text-[11px] text-gray-400 font-mono-digits mb-3">
                      {tier.pricePOP === 0 ? (
                        <span className="text-emerald-400 font-bold">FREE BASE</span>
                      ) : (
                        <div>
                          <div className="text-white font-bold">{tier.pricePOP.toLocaleString()} POP</div>
                          <div className="text-[10px] text-gray-500">≈ ${tier.priceUSD.toFixed(2)} USD</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div>
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2 bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-default font-display"
                      >
                        <Box className="w-3 h-3 fill-current" />
                        <span>ACTIVE</span>
                      </button>
                    ) : isUnlocked ? (
                      <button
                        disabled
                        className="w-full py-2 bg-[#1E2638] text-gray-500 rounded-xl text-xs font-bold cursor-default"
                      >
                        OWNED
                      </button>
                    ) : isNext ? (
                      <button
                        onClick={() => handleStorageUpgrade(tier.tier)}
                        disabled={!canAfford || loadingAction !== null}
                        className={`w-full py-2 rounded-xl text-xs font-black tracking-tight flex items-center justify-center gap-1 transition-all ${
                          canAfford
                            ? 'bg-[#FFE600] hover:bg-[#FFE600]/90 text-black shadow-lg shadow-yellow-500/20 active:scale-95 font-display'
                            : 'bg-[#1E2638] text-gray-400 cursor-not-allowed text-[10px]'
                        }`}
                      >
                        {loadingAction === `storage-${tier.tier}` ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : canAfford ? (
                          <>
                            <Box className="w-3 h-3 fill-current" />
                            <span>UPGRADE</span>
                          </>
                        ) : (
                          <span>NEED {missingPOP.toLocaleString()} POP</span>
                        )}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2 bg-[#121824] text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed"
                      >
                        <Lock className="w-3 h-3" />
                        <span>LOCKED</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
