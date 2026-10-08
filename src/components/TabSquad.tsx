import React, { useState, useEffect } from 'react';
import {
  Users2,
  Crown,
  Copy,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Award,
  Clock,
  Smartphone,
  RefreshCw,
  Send,
  Play,
  X,
  Lock,
  Calendar,
  Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, AdminConfig, ReferralUserItem, WeeklyPodiumUser, SquadCounts, LeaderboardCycleInfo } from '../types.js';
import { haptic } from '../services/haptic.js';
import { api } from '../services/api.js';

export function formatReferralTimestamp(dateStr?: string | Date): string {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

interface TabSquadProps {
  user: User;
  config: AdminConfig;
  referrals: ReferralUserItem[];
  weeklyLeaderboard: WeeklyPodiumUser[];
  counts?: SquadCounts;
  onRefreshSquad?: () => Promise<void>;
  onClaimSquadCommission: () => Promise<void>;
  onOpenWalletModal: () => void;
}

export const TabSquad: React.FC<TabSquadProps> = ({
  user,
  config,
  referrals,
  weeklyLeaderboard,
  counts,
  onRefreshSquad,
  onClaimSquadCommission,
  onOpenWalletModal,
}) => {
  const [listToggle, setListToggle] = useState<'top' | 'my'>('top');
  const [showQualifyModal, setShowQualifyModal] = useState(false);
  const [referralFilter, setReferralFilter] = useState<'ALL' | 'QUALIFIED' | 'PENDING' | 'SAME_IP' | 'UNQUALIFIED'>('ALL');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  // Dynamic Weekly Contest Filtering
  const [activeLeaderboard, setActiveLeaderboard] = useState<WeeklyPodiumUser[]>(weeklyLeaderboard);
  const [activeContestFilter, setActiveContestFilter] = useState<'weekly' | '7d' | '30d' | 'custom'>('weekly');
  const [activeCycleInfo, setActiveCycleInfo] = useState<LeaderboardCycleInfo | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  useEffect(() => {
    setActiveLeaderboard(weeklyLeaderboard);
  }, [weeklyLeaderboard]);

  const handleContestFilterChange = async (filter: 'weekly' | '7d' | '30d' | 'custom') => {
    haptic.selection();
    setActiveContestFilter(filter);
    if (filter !== 'custom') {
      try {
        setIsLeaderboardLoading(true);
        const res = await api.getWeeklyLeaderboard({ filter });
        setActiveLeaderboard(res.leaderboard);
        if (res.cycle) setActiveCycleInfo(res.cycle);
      } catch (e) {
        console.warn('Failed to filter contest leaderboard:', e);
      } finally {
        setIsLeaderboardLoading(false);
      }
    }
  };

  const handleApplyCustomDate = async () => {
    if (!customStart) return;
    haptic.impact('light');
    try {
      setIsLeaderboardLoading(true);
      const res = await api.getWeeklyLeaderboard({
        filter: 'custom',
        startDate: customStart,
        endDate: customEnd || customStart
      });
      setActiveLeaderboard(res.leaderboard);
      if (res.cycle) setActiveCycleInfo(res.cycle);
    } catch (e) {
      console.warn('Failed to apply custom contest dates:', e);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  // User's unique 8-character referral code
  const refCode = (user.referralCode && user.referralCode.trim().length === 8)
    ? user.referralCode.toUpperCase()
    : (user.referralCode || `POP${user.telegramId.slice(-5)}`).toUpperCase();

  // Official Telegram Bot Username & Single Clean Referral Link
  const botUsername = (config.telegramBotUsername || config.botUsername || 'PopCornUSA_bot').replace('@', '').trim() || 'PopCornUSA_bot';
  // Exact single link format: https://t.me/PopCornUSA_bot?start=${user.referralCode}
  const referralLink = `https://t.me/${botUsername}?start=${refCode}`;

  // Automatically refresh squad referrals from MongoDB/API on component mount
  useEffect(() => {
    if (onRefreshSquad) {
      onRefreshSquad().catch(() => {});
    }
  }, [onRefreshSquad]);

  // Dynamic Referral Bonus strictly from Admin Config / Settings (zero synthetic fallback)
  const referralBonus = React.useMemo(() => {
    const raw = (config as any).referralBonusAmount ?? (config as any).referral_bonus ?? config.instantReferralBonusPOP;
    if (raw !== undefined && raw !== null && !isNaN(Number(raw))) {
      return Math.max(0, Number(raw));
    }
    return 0;
  }, [config]);

  // Dynamic Squad Commission Rate strictly from Admin Config / Settings (zero synthetic fallback)
  const commissionRate = React.useMemo(() => {
    const raw = (config as any).squadCommissionRate ?? config.referralCommissionPercent ?? (config as any).referral_commission_percent;
    if (raw !== undefined && raw !== null && !isNaN(Number(raw))) {
      return Math.max(0, Math.min(100, Number(raw)));
    }
    return 0;
  }, [config]);
  const isCapReached = Boolean(config.isCapReached || (config.remainingSupply !== undefined && config.remainingSupply <= 0));

  // Deduplicate referrals array strictly by Telegram ID to prevent any duplicate rows
  const cleanReferrals = React.useMemo(() => {
    const map = new Map<string, ReferralUserItem>();
    for (const r of referrals) {
      const tid = String(r.telegramId || (r as any).telegram_id || r.id).trim();
      if (!tid) continue;
      if (!map.has(tid)) {
        map.set(tid, r);
      }
    }
    return Array.from(map.values());
  }, [referrals]);

  // Helper to strictly categorize referral status matching backend database rules:
  // - PENDING ACTION: user has NOT joined TG Channel OR NOT completed 3 tasks -> PENDING
  // - UNQUALIFIED: same IP / device / multi-account / self-referral -> UNQUALIFIED
  // - QUALIFIED: TG Channel joined = TRUE AND Completed Tasks >= 3 AND Unique User ID (Anti-Sybil) = TRUE -> QUALIFIED
  const getReferralStatus = React.useCallback((r: ReferralUserItem): 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED' => {
    const s = String(r.status || '').toUpperCase();
    const isUnqual = Boolean(
      s === 'UNQUALIFIED' ||
      s.includes('UNQUALIFIED') ||
      s.includes('SAME IP') ||
      s.includes('SAME DEVICE') ||
      r.isMultiAccount ||
      (r.disqualifiedReason && (
        r.disqualifiedReason.toLowerCase().includes('same ip') ||
        r.disqualifiedReason.toLowerCase().includes('same device') ||
        r.disqualifiedReason.toLowerCase().includes('self-referral') ||
        r.disqualifiedReason.toLowerCase().includes('multi-account') ||
        r.disqualifiedReason.toLowerCase().includes('multi account') ||
        r.disqualifiedReason.toLowerCase().includes('flagged')
      ))
    );
    if (isUnqual) return 'UNQUALIFIED';

    const tasksCount = Number(r.tasksCompleted ?? r.completedTasksCount ?? (r as any).tasks_count ?? 0);
    const hasThreeTasks = tasksCount >= 3;
    const hasChannel = Boolean(
      r.hasChannel || 
      (r as any).has_channel || 
      (r as any).joined_channel || 
      (r as any).hasJoinedChannel
    );

    // Rule: If channel is joined and at least 3 tasks completed, user is strictly QUALIFIED!
    if (s === 'QUALIFIED' || r.isQualified === true || (hasChannel && hasThreeTasks)) return 'QUALIFIED';

    return 'PENDING';
  }, []);

  // Squad Breakdown Counters (Dynamic aggregation strictly matching database referral statuses)
  const totalJoined = counts?.total ?? (user.total_joined && user.total_joined > cleanReferrals.length ? user.total_joined : cleanReferrals.length);
  
  const sameIpCount = counts?.same_ip ?? cleanReferrals.filter(r => {
    return getReferralStatus(r) === 'UNQUALIFIED';
  }).length;

  const qualifiedCount = counts?.qualified ?? cleanReferrals.filter(r => {
    return getReferralStatus(r) === 'QUALIFIED';
  }).length;

  const pendingCount = counts?.pending ?? cleanReferrals.filter(r => {
    return getReferralStatus(r) === 'PENDING';
  }).length;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    haptic.success();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(refCode);
    setCopiedCode(true);
    haptic.success();
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareTelegram = () => {
    haptic.impact('medium');
    const shareText = `🍿 Join PopCorn USA ($POP) Miner with my referral link!\nMine $POP tokens directly inside Telegram & earn rewards:`;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

    // Use Telegram WebApp native share dialog if running inside Telegram WebApp
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgShareUrl);
    } else {
      window.open(tgShareUrl, '_blank');
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing || !onRefreshSquad) return;
    try {
      setIsRefreshing(true);
      haptic.selection();
      await onRefreshSquad();
    } catch (e) {
      console.warn('Failed to refresh squad:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClaimCommission = async () => {
    if (isCapReached) {
      haptic.warning();
      return;
    }

    if (!user.tonWalletAddress) {
      haptic.warning();
      onOpenWalletModal();
      return;
    }

    if (user.unclaimedSquadPOP <= 0) {
      haptic.warning();
      return;
    }

    try {
      setIsClaiming(true);
      haptic.impact('heavy');
      await onClaimSquadCommission();
      haptic.success();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#00E5FF', '#FFE600'],
      });

      setClaimSuccess(`Claimed +${user.unclaimedSquadPOP.toFixed(2)} POP Squad Commission!`);
      setTimeout(() => setClaimSuccess(null), 3000);
    } catch (err: any) {
      haptic.error();
    } finally {
      setIsClaiming(false);
    }
  };

  // Top 3 Podium Sort (Podium order: 2nd on Left, 1st in Center, 3rd on Right)
  const rank1 = activeLeaderboard.find(u => u.rank === 1);
  const rank2 = activeLeaderboard.find(u => u.rank === 2);
  const rank3 = activeLeaderboard.find(u => u.rank === 3);
  const ranksRest = activeLeaderboard.filter(u => u.rank > 3);

  const qualifiedReferralsCount = referrals.filter(r => r.isQualified || r.status === 'QUALIFIED' || r.status === 'Qualified').length;

  return (
    <div className="space-y-4 pb-20 pt-2 px-4 max-w-md mx-auto">
      
      {/* 1. USER INFO HEADER */}
      <div className="p-4 rounded-3xl bg-[#121824] border border-[#252D3D] flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          {/* Avatar Placeholder */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00E5FF] to-[#FFE600] p-0.5 shadow-md">
            <div className="w-full h-full rounded-2xl bg-[#0B0E14] flex items-center justify-center font-display font-black text-white text-base uppercase">
              {user.username ? user.username.slice(0, 2) : 'PO'}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold text-white">{user.firstName} {user.lastName}</h3>
              {user.isFlagged ? (
                <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                  <ShieldAlert className="w-2.5 h-2.5" /> FLAGGED
                </span>
              ) : (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> VERIFIED
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">@{user.username || 'unknown'}</span>
          </div>
        </div>

        <div className="text-right flex items-center gap-2">
          {onRefreshSquad && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Squad Data"
              className="p-2 rounded-xl bg-[#1A2234] border border-[#252D3D] text-gray-300 hover:text-white hover:border-[#00E5FF]/40 transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00E5FF]' : ''}`} />
            </button>
          )}
          <div>
            <span className="text-[10px] text-gray-400 block font-semibold">Active Inviter</span>
            <span className="text-xs font-black text-[#FFE600] font-mono-digits">
              {qualifiedCount} Qualified
            </span>
          </div>
        </div>
      </div>

      {/* 2. SQUAD BREAKDOWN COUNTERS (4 DYNAMIC CARDS) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-xs font-extrabold text-white uppercase tracking-wider font-display">
              Squad Breakdown
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono-digits">
            Instant registration & live sync
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Total Joined */}
          <div
            onClick={() => {
              setListToggle('my');
              setReferralFilter('ALL');
              haptic.selection();
            }}
            className={`p-3.5 rounded-2xl bg-[#121824] border transition-all cursor-pointer hover:border-[#00E5FF]/50 shadow-md ${
              listToggle === 'my' && referralFilter === 'ALL'
                ? 'border-[#00E5FF] ring-1 ring-[#00E5FF]/30 bg-[#121824]/90'
                : 'border-[#252D3D]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-400">Total Joined</span>
              <div className="w-6 h-6 rounded-lg bg-[#00E5FF]/15 flex items-center justify-center text-[#00E5FF]">
                <Users2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white font-mono-digits">
              {totalJoined}
            </div>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              All registered referees
            </span>
          </div>

          {/* Card 2: Pending Action */}
          <div
            onClick={() => {
              setListToggle('my');
              setReferralFilter('PENDING');
              haptic.selection();
            }}
            className={`p-3.5 rounded-2xl bg-[#121824] border transition-all cursor-pointer hover:border-amber-400/50 shadow-md ${
              listToggle === 'my' && referralFilter === 'PENDING'
                ? 'border-amber-400 ring-1 ring-amber-400/30 bg-amber-950/10'
                : 'border-[#252D3D]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-400">Pending Action</span>
              <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center text-amber-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono-digits">
              {pendingCount}
            </div>
            <span className="text-[10px] text-amber-400/80 block mt-0.5">
              Waiting: Channel / 3 Tasks
            </span>
          </div>

          {/* Card 3: Qualified */}
          <div
            onClick={() => {
              setListToggle('my');
              setReferralFilter('QUALIFIED');
              haptic.selection();
            }}
            className={`p-3.5 rounded-2xl bg-[#121824] border transition-all cursor-pointer hover:border-emerald-400/50 shadow-md ${
              listToggle === 'my' && referralFilter === 'QUALIFIED'
                ? 'border-emerald-400 ring-1 ring-emerald-400/30 bg-emerald-950/10'
                : 'border-[#252D3D]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-400">Qualified</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono-digits">
              {qualifiedCount}
            </div>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5">
              Unique IP + Completed
            </span>
          </div>

          {/* Card 4: Unqualified (Same IP) */}
          <div
            onClick={() => {
              setListToggle('my');
              setReferralFilter('SAME_IP');
              haptic.selection();
            }}
            className={`p-3.5 rounded-2xl bg-[#121824] border transition-all cursor-pointer hover:border-red-500/50 shadow-md ${
              listToggle === 'my' && referralFilter === 'SAME_IP'
                ? 'border-red-500 ring-1 ring-red-500/30 bg-red-950/10'
                : 'border-[#252D3D]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-400">Unqualified (Same IP)</span>
              <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-red-400 font-mono-digits">
              {sameIpCount}
            </div>
            <span className="text-[10px] text-red-400/80 block mt-0.5">
              Same IP / Device Match
            </span>
          </div>
        </div>
      </div>

      {/* 3. SQUAD MINING CARD (LIFETIME COMMISSION & CLAIM) */}
      <div className="relative overflow-hidden rounded-3xl bg-[#121824] border border-[#252D3D] p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E5FF]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
            Squad Mining Pool
          </span>
          <span className="text-xs font-black text-[#00E5FF] px-2.5 py-0.5 rounded-full bg-[#00E5FF]/15 border border-[#00E5FF]/30 font-mono-digits">
            {commissionRate}% Dynamic Lifetime Commission
          </span>
        </div>

        <div className="my-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 block">Unclaimed Squad Commission</span>
            <span className="text-[10px] text-gray-400 font-mono-digits bg-[#0B0E14] px-2 py-0.5 rounded border border-[#252D3D]">
              Formula: <strong className="text-[#00E5FF]">Mined POP × {commissionRate}%</strong>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black text-[#00E5FF] font-mono-digits">
              {user.unclaimedSquadPOP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm font-black text-white font-display">POP</span>
            <span className="text-xs text-gray-400 font-mono-digits">
              (≈ ${(user.unclaimedSquadPOP * config.popUsdRate).toFixed(2)} USD)
            </span>
          </div>
          <span className="text-[10px] text-gray-500 block mt-0.5">
            Total Claimed to Date: {user.claimedSquadPOP.toLocaleString()} POP
          </span>
        </div>

        {/* Claim Squad Commission Button */}
        {isCapReached ? (
          <button
            disabled
            className="w-full mt-3 py-3 rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 font-display bg-red-950/40 text-red-400 border border-red-500/50 cursor-not-allowed select-none"
          >
            <Lock className="w-4 h-4 text-red-400" />
            <span>10M SUPPLY CAP REACHED</span>
          </button>
        ) : (
          <button
            onClick={handleClaimCommission}
            disabled={isClaiming || user.unclaimedSquadPOP <= 0}
            className={`w-full mt-3 py-3 rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 font-display ${
              user.unclaimedSquadPOP > 0
                ? 'bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black shadow-lg shadow-cyan-500/20 active:scale-95 neon-glow-blue'
                : 'bg-[#1E2638] text-gray-500 border border-[#252D3D] cursor-not-allowed'
            }`}
          >
            {isClaiming ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>CLAIM SQUAD COMMISSION</span>
              </>
            )}
          </button>
        )}

        {isCapReached && (
          <div className="mt-3 p-2.5 bg-red-950/40 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>The 10,000,000 POP total supply cap has been reached. Squad commission claims are locked.</span>
          </div>
        )}

        {claimSuccess && (
          <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{claimSuccess}</span>
          </div>
        )}
      </div>

      {/* 3. REFERRAL LINK & SHARE CONTROLS WITH RICH TELEGRAM PREVIEW */}
      <div className="p-4 rounded-3xl bg-[#121824] border border-[#252D3D] space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#00E5FF]" />
            <h4 className="text-xs font-black text-white font-display uppercase tracking-wide">
              Referral Program
            </h4>
          </div>
          <span className="text-[10px] font-black text-[#FFE600] px-2 py-0.5 rounded-full bg-[#FFE600]/10 border border-[#FFE600]/30 font-mono-digits">
            +{referralBonus} POP / Qualified User
          </span>
        </div>

        {/* 8-Character Referral Code Card alongside Copy Button */}
        <div className="p-3.5 bg-[#0B0E14] border border-[#252D3D] rounded-2xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Your Referral Code</span>
            <span className="text-base font-black text-[#00E5FF] font-mono tracking-widest select-all">{refCode}</span>
          </div>
          <button
            onClick={handleCopyCode}
            className={`py-2 px-3.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 ${
              copiedCode
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-[#1A2234] border-[#252D3D] text-[#00E5FF] hover:border-[#00E5FF]/50'
            }`}
          >
            {copiedCode ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied Code!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Single Clean Referral Link Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold px-1">
            <span>Your Telegram Referral Link</span>
            <span className="text-[#FFE600] font-mono text-[9px]">https://t.me/PopCornUSA_bot?start=...</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 bg-[#0B0E14] border border-[#252D3D] rounded-2xl text-xs text-gray-200 font-mono truncate select-all">
              {referralLink}
            </div>
            <button
              onClick={handleCopyLink}
              className={`py-2.5 px-3.5 rounded-2xl border text-xs font-extrabold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
                copiedLink
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-[#1A2234] border-[#252D3D] text-gray-200 hover:text-white hover:border-[#00E5FF]/40'
              }`}
              title="Copy Referral Link"
            >
              {copiedLink ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Primary "Invite Friends" / "Share Link" Button */}
          <button
            onClick={handleShareTelegram}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#00E5FF] via-[#00C2FF] to-[#FFE600] text-black font-black text-xs font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#00E5FF]/20 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Invite Friends via Telegram</span>
          </button>

          {/* Clean "Qualify Requirement" Button */}
          <button
            onClick={() => {
              haptic.selection();
              setShowQualifyModal(true);
            }}
            className="w-full py-2.5 px-4 rounded-2xl bg-[#161F30] border border-[#00E5FF]/40 text-[#00E5FF] hover:bg-[#00E5FF]/10 font-black text-xs font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4 text-[#00E5FF]" />
            <span>Qualify Requirement</span>
            <span className="text-[10px] text-gray-400 font-mono-digits font-normal ml-auto flex items-center gap-1">
              View 3 Steps & Rules <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>

      {/* 4. WEEKLY CONTEST REWARD NOTICE CARD (100% MANUAL PAYOUT NOTICE & ADMIN CONFIGURED PRIZE POOL) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#161F30] to-[#121824] border border-[#FFE600]/40 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#FFE600]" />
            <h4 className="text-xs font-black text-white font-display uppercase tracking-wide">
              🏆 Weekly Referral Contest (Saturday to Saturday)
            </h4>
          </div>
          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase">
            Manual Review
          </span>
        </div>

        <div className="p-2.5 bg-[#0B0E14] border border-[#252D3D] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-200">
            <span className="text-[#FFE600] font-bold">📜 Contest Rule:</span>
            <span>
              Minimum <strong className="text-[#FFE600] font-mono-digits">{config.weeklyContestMinThreshold} Qualified Referrals</strong> achieved between <strong>Saturday to Saturday</strong> to qualify for prizes.
            </span>
          </div>
          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <span>* Qualified criteria: Official Channel Joined + at least 3 Tasks Completed + Unique User ID (Anti-Sybil).</span>
          </div>
        </div>

        {/* Prize Pool Display */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Weekly Prize Pool (Configured by Admin)
          </span>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="p-2 rounded-xl bg-[#0B0E14] border border-[#FFE600]/50 shadow-sm">
              <span className="text-[#FFE600] block font-extrabold">👑 1st Place</span>
              <span className="text-white font-bold font-mono-digits text-xs">${config.weeklyPrizesUsdt.first.toFixed(2)} USDT</span>
            </div>
            <div className="p-2 rounded-xl bg-[#0B0E14] border border-gray-400/50 shadow-sm">
              <span className="text-gray-300 block font-extrabold">🥈 2nd Place</span>
              <span className="text-white font-bold font-mono-digits text-xs">${config.weeklyPrizesUsdt.second.toFixed(2)} USDT</span>
            </div>
            <div className="p-2 rounded-xl bg-[#0B0E14] border border-amber-600/50 shadow-sm">
              <span className="text-amber-500 block font-extrabold">🥉 3rd Place</span>
              <span className="text-white font-bold font-mono-digits text-xs">${config.weeklyPrizesUsdt.third.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>

        {/* Custom Admin Announcement / Notice if configured */}
        {config.weeklyContestNoticeText && (
          <div className="p-2 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-200 flex items-start gap-1.5">
            <span className="text-amber-400 font-bold shrink-0">📢 Notice:</span>
            <span>{config.weeklyContestNoticeText}</span>
          </div>
        )}

        {/* Transparent Manual Payout Notice */}
        <div className="pt-1 text-[10px] text-gray-400 flex items-center justify-between border-t border-[#1E2638]">
          <span className="flex items-center gap-1 text-gray-300">
            ℹ️ <span className="text-gray-400">Payouts are completely manual: Admins verify rankings & send rewards directly after cycle completion.</span>
          </span>
        </div>
      </div>

      {/* 6. DUAL LIST TOGGLE: [Top Referral List] (Default) & [My Referral List] */}
      <div className="grid grid-cols-2 p-1 bg-[#121824] border border-[#252D3D] rounded-2xl gap-1">
        <button
          onClick={() => {
            haptic.selection();
            setListToggle('top');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            listToggle === 'top'
              ? 'bg-[#FFE600] text-black shadow-md font-display'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🏆 Top Referral List (Weekly)
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setListToggle('my');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            listToggle === 'my'
              ? 'bg-[#00E5FF] text-black shadow-md font-display'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          👥 My Referral List ({referrals.length})
        </button>
      </div>

      {/* VIEW A: TOP 10 WEEKLY REFERRAL LEADERBOARD */}
      {listToggle === 'top' && (
        <div className="space-y-3">
          
          {/* Dynamic Contest Window Filtering Bar */}
          <div className="bg-[#121824] p-2.5 rounded-2xl border border-[#252D3D] space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Leaderboard Window:</span>
              </span>
              <span className="text-[10px] font-mono-digits text-cyan-400 font-bold">
                {activeCycleInfo?.label || (activeContestFilter === 'weekly' ? 'Saturday to Saturday Contest' : activeContestFilter.toUpperCase())}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => handleContestFilterChange('weekly')}
                className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  activeContestFilter === 'weekly'
                    ? 'bg-[#FFE600] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                🌟 Sat-Sat
              </button>
              <button
                type="button"
                onClick={() => handleContestFilterChange('7d')}
                className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  activeContestFilter === '7d'
                    ? 'bg-[#00E5FF] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                ⏱️ 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleContestFilterChange('30d')}
                className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  activeContestFilter === '30d'
                    ? 'bg-[#00E5FF] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                📅 1 Month
              </button>
              <button
                type="button"
                onClick={() => handleContestFilterChange('custom')}
                className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  activeContestFilter === 'custom'
                    ? 'bg-[#00E5FF] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                🗓️ Custom
              </button>
            </div>

            {/* Custom Range Picker */}
            {activeContestFilter === 'custom' && (
              <div className="pt-2 border-t border-[#252D3D] flex items-center gap-1.5 text-xs flex-wrap">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-[#0B0E14] border border-[#252D3D] rounded-lg px-2 py-1 text-white text-[10px] flex-1 min-w-[100px]"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-[#0B0E14] border border-[#252D3D] rounded-lg px-2 py-1 text-white text-[10px] flex-1 min-w-[100px]"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomDate}
                  className="px-2.5 py-1 bg-cyan-400 hover:bg-cyan-300 text-black font-bold rounded-lg text-[10px]"
                >
                  Apply
                </button>
              </div>
            )}

            {isLeaderboardLoading && (
              <div className="text-[10px] text-gray-400 text-center animate-pulse">
                Filtering referrals strictly within window...
              </div>
            )}
          </div>

          {/* Top 3 Podium Cards: 2nd (Left Silver), 1st (Center Golden Crown 👑), 3rd (Right Bronze) */}
          <div className="grid grid-cols-3 gap-2 items-end pt-3">
            
            {/* 2nd Place (Left Silver) */}
            <div className="p-3 rounded-2xl bg-[#121824] border border-gray-400/30 text-center flex flex-col items-center shadow-lg">
              <span className="text-xs font-extrabold text-gray-300">🥈 2nd</span>
              <div className="w-10 h-10 rounded-full bg-[#1A2234] border border-gray-400/50 my-1.5 flex items-center justify-center font-bold text-xs text-white">
                {rank2?.username ? rank2.username.slice(0, 2).toUpperCase() : '2N'}
              </div>
              <span className="text-xs font-bold text-white truncate max-w-full">
                {rank2?.username ? `@${rank2.username}` : 'Open Slot'}
              </span>
              <span className="text-[11px] font-black text-[#FFE600] font-mono-digits mt-1">
                {rank2 ? `${rank2.referralCount} refs` : '-'}
              </span>
              <span className="text-[9px] text-gray-400 font-mono-digits">
                {rank2 ? `${Math.round(rank2.totalPopEarnings || 0)} POP` : '-'}
              </span>
            </div>

            {/* 1st Place (Center Golden Crown 👑) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#1E2638] to-[#121824] border-2 border-[#FFE600] text-center flex flex-col items-center shadow-xl shadow-yellow-500/10 scale-105 z-10">
              <div className="flex items-center gap-1 text-[#FFE600]">
                <Crown className="w-4 h-4 fill-[#FFE600]" />
                <span className="text-xs font-black uppercase font-display">1st Winner</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#FFE600]/20 border-2 border-[#FFE600] my-1.5 flex items-center justify-center font-black text-sm text-[#FFE600]">
                {rank1?.username ? rank1.username.slice(0, 2).toUpperCase() : '1S'}
              </div>
              <span className="text-xs font-black text-white truncate max-w-full">
                {rank1?.username ? `@${rank1.username}` : 'No Leader Yet'}
              </span>
              <span className="text-xs font-black text-[#FFE600] font-mono-digits mt-1">
                {rank1 ? `${rank1.referralCount} refs` : '-'}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono-digits font-bold">
                {rank1 ? `${Math.round(rank1.totalPopEarnings || 0)} POP` : '-'}
              </span>
            </div>

            {/* 3rd Place (Right Bronze) */}
            <div className="p-3 rounded-2xl bg-[#121824] border border-amber-600/30 text-center flex flex-col items-center shadow-lg">
              <span className="text-xs font-extrabold text-amber-500">🥉 3rd</span>
              <div className="w-10 h-10 rounded-full bg-[#1A2234] border border-amber-600/50 my-1.5 flex items-center justify-center font-bold text-xs text-white">
                {rank3?.username ? rank3.username.slice(0, 2).toUpperCase() : '3R'}
              </div>
              <span className="text-xs font-bold text-white truncate max-w-full">
                {rank3?.username ? `@${rank3.username}` : 'Open Slot'}
              </span>
              <span className="text-[11px] font-black text-[#FFE600] font-mono-digits mt-1">
                {rank3 ? `${rank3.referralCount} refs` : '-'}
              </span>
              <span className="text-[9px] text-gray-400 font-mono-digits">
                {rank3 ? `${Math.round(rank3.totalPopEarnings || 0)} POP` : '-'}
              </span>
            </div>
          </div>

          {/* Ranks 4 to 10 Ranked List */}
          <div className="space-y-1.5 mt-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase px-1">Ranks 4 to 10</span>
            {ranksRest.length === 0 ? (
              <div className="p-4 bg-[#0B0E14] rounded-2xl text-center text-xs text-gray-500 border border-[#1E2638]">
                No other qualified inviters in this 7-day cycle yet.
              </div>
            ) : (
              ranksRest.map((entry) => (
                <div
                  key={entry.rank}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    entry.isCurrentUser
                      ? 'bg-[#00E5FF]/10 border-[#00E5FF]/50 text-white'
                      : 'bg-[#121824] border-[#1E2638] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 font-mono-digits text-xs font-bold text-gray-400">
                      #{entry.rank}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white block">@{entry.username}</span>
                      <span className="text-[10px] text-gray-400 font-mono-digits">
                        Earnings: {Math.round(entry.totalPopEarnings || 0)} POP
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-[#FFE600] font-mono-digits block">
                      {entry.referralCount} refs
                    </span>
                    {entry.referralCount >= config.weeklyContestMinThreshold && (
                      <span className="text-[9px] text-emerald-400 font-semibold">Eligible</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW B: MY REFERRAL LIST */}
      {listToggle === 'my' && (
        <div className="space-y-3">
          {/* Referral List Filter Bar */}
          {referrals.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => {
                  haptic.selection();
                  setReferralFilter('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  referralFilter === 'ALL'
                    ? 'bg-[#00E5FF] text-black shadow-md'
                    : 'bg-[#121824] border border-[#252D3D] text-gray-400 hover:text-white'
                }`}
              >
                All ({totalJoined})
              </button>
              <button
                onClick={() => {
                  haptic.selection();
                  setReferralFilter('PENDING');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  referralFilter === 'PENDING'
                    ? 'bg-amber-400 text-black shadow-md'
                    : 'bg-[#121824] border border-[#252D3D] text-gray-400 hover:text-white'
                }`}
              >
                Pending Action ({pendingCount})
              </button>
              <button
                onClick={() => {
                  haptic.selection();
                  setReferralFilter('QUALIFIED');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  referralFilter === 'QUALIFIED'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'bg-[#121824] border border-[#252D3D] text-gray-400 hover:text-white'
                }`}
              >
                Qualified ({qualifiedCount})
              </button>
              <button
                onClick={() => {
                  haptic.selection();
                  setReferralFilter('SAME_IP');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  referralFilter === 'SAME_IP'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-[#121824] border border-[#252D3D] text-gray-400 hover:text-white'
                }`}
              >
                Unqualified (Same IP) ({sameIpCount})
              </button>
            </div>
          )}

          {cleanReferrals.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#121824] border border-[#252D3D] text-center space-y-2">
              <Users2 className="w-8 h-8 text-gray-500 mx-auto" />
              <h4 className="text-xs font-bold text-white">No referrals yet</h4>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                Share your invite link with friends! When they join our channel and complete at least 3 tasks on a separate device, you instantly earn +{referralBonus} POP and {commissionRate}% mining commission.
              </p>
              <button
                onClick={handleShareTelegram}
                className="mt-3 py-2.5 px-5 bg-gradient-to-r from-[#00E5FF] to-[#FFE600] text-black font-extrabold text-xs rounded-xl font-display uppercase tracking-wider flex items-center justify-center gap-2 mx-auto shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Invite Friends via Telegram</span>
              </button>
            </div>
          ) : (
            cleanReferrals
              .filter((ref) => {
                const status = getReferralStatus(ref);
                if (referralFilter === 'QUALIFIED') return status === 'QUALIFIED';
                if (referralFilter === 'SAME_IP' || referralFilter === 'UNQUALIFIED') return status === 'UNQUALIFIED';
                if (referralFilter === 'PENDING') return status === 'PENDING';
                return true;
              })
              .map((ref) => {
                const status = getReferralStatus(ref);
                const isQualified = status === 'QUALIFIED';
                const isPending = status === 'PENDING';
                const isSameIp = status === 'UNQUALIFIED';

                const hasWallet = Boolean(
                  ref.hasWallet || 
                  (ref as any).has_wallet || 
                  (ref as any).wallet_address || 
                  (ref as any).walletAddress || 
                  (ref as any).tonWalletAddress
                );
                const hasChannel = Boolean(
                  ref.hasChannel || 
                  (ref as any).has_channel || 
                  (ref as any).joined_channel || 
                  (ref as any).hasJoinedChannel
                );

                const tasksCount = Number(ref.tasksCompleted ?? ref.completedTasksCount ?? (ref as any).tasks_count ?? 0);
                const hasThreeTasks = tasksCount >= 3;

                const pendingRequirements: string[] = [];
                if (!hasChannel) pendingRequirements.push('Join Official Channel');
                if (!hasThreeTasks) pendingRequirements.push(`Complete 3 Tasks (${tasksCount}/3)`);

                const displayName = ref.username
                  ? `@${ref.username}`
                  : (ref.first_name || ref.firstName || `user_${ref.telegramId}`);

                return (
                  <div
                    key={ref.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSameIp
                        ? 'bg-red-950/20 border-red-500/40 shadow-sm shadow-red-950/20'
                        : isQualified
                        ? 'bg-[#121824] border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                        : 'bg-[#121824] border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex-1 min-w-0">
                        {/* Telegram Username & Dynamic Status Badge DIRECTLY BELOW the Name */}
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-white truncate">
                              {displayName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono-digits">
                              (ID: {ref.telegramId})
                            </span>
                          </div>

                          {/* Dynamic Status Badge directly below username matching database status */}
                          <div className="mt-0.5">
                            {/* 1. GREEN badge: QUALIFIED */}
                            {isQualified && (
                              <span className="inline-flex items-center gap-1.5 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider font-display shadow-sm shadow-emerald-500/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>QUALIFIED</span>
                              </span>
                            )}

                            {/* 2. YELLOW/AMBER badge: PENDING */}
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 text-[9px] bg-[#FFE600]/15 text-[#FFE600] border border-[#FFE600]/50 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider font-display shadow-sm shadow-[#FFE600]/10">
                                <Clock className="w-2.5 h-2.5 shrink-0 text-[#FFE600]" />
                                <span>PENDING</span>
                              </span>
                            )}

                            {/* 3. RED badge: UNQUALIFIED */}
                            {isSameIp && (
                              <span className="inline-flex items-center gap-1.5 text-[9px] bg-red-500/20 text-red-300 border border-red-500/40 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider font-display shadow-sm shadow-red-500/10">
                                <ShieldAlert className="w-2.5 h-2.5 shrink-0 text-red-400" />
                                <span>UNQUALIFIED</span>
                              </span>
                            )}
                          </div>

                          {/* Exact Joined Date & Timestamp Display */}
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1 font-mono-digits">
                            <Calendar className="w-3 h-3 text-[#00E5FF] shrink-0" />
                            <span>Joined: <strong className="text-gray-200">{formatReferralTimestamp(ref.joinedAt || ref.created_at)}</strong></span>
                          </div>
                        </div>

                        {/* Total Bonus Earned Display */}
                        <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
                          <div className="flex items-baseline gap-1">
                            <span className="text-gray-400">Bonus Earned:</span>
                            {isQualified ? (
                              <span className="text-emerald-400 font-black font-mono-digits">
                                +{ref.bonusAwardedPOP !== undefined && ref.bonusAwardedPOP > 0 ? ref.bonusAwardedPOP : referralBonus} POP
                              </span>
                            ) : isSameIp ? (
                              <span className="text-red-400 font-bold font-mono-digits">
                                0 POP
                              </span>
                            ) : (
                              <span className="text-amber-300 font-bold font-mono-digits">
                                Pending (+{referralBonus} POP)
                              </span>
                            )}
                          </div>

                          <span className="text-gray-600">•</span>

                          <div className="flex items-baseline gap-1">
                            <span className="text-gray-400">Mining Commission:</span>
                            {isQualified ? (
                              <span className="text-[#00E5FF] font-bold font-mono-digits">
                                {commissionRate}% Active
                              </span>
                            ) : (
                              <span className="text-gray-500 font-semibold">
                                0% (Inactive)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status detail notes */}
                        {isSameIp && (
                          <div className="mt-2 p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-[10px] text-red-300 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>
                              Detected on same IP / Hotspot / Device. Referral bonus ($0) and mining commissions forfeited.
                            </span>
                          </div>
                        )}

                        {isPending && (
                          <p className="text-[10px] text-amber-300/90 mt-1.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Joined via invite link. Waiting for referee to complete: <strong className="text-white">{pendingRequirements.join(' + ') || 'Channel / 3 Tasks'}</strong>.</span>
                          </p>
                        )}
                      </div>

                      {/* 3 Qualification Verification Checkpoints */}
                      <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                        <span
                          title={hasChannel ? 'TG Channel Joined' : 'TG Channel Pending'}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-mono-digits flex items-center gap-1 ${
                            hasChannel
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                              : 'bg-gray-800/80 text-gray-400 border border-gray-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${hasChannel ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          TG Channel
                        </span>

                        <span
                          title={hasThreeTasks ? '3 Tasks Completed' : `${tasksCount}/3 Tasks Completed`}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-mono-digits flex items-center gap-1 ${
                            hasThreeTasks
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                              : 'bg-gray-800/80 text-gray-400 border border-gray-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${hasThreeTasks ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          {hasThreeTasks ? '3 Tasks Done' : `${tasksCount}/3 Tasks`}
                        </span>

                        <span
                          title={!isSameIp ? 'Unique Device Hardware & User ID' : 'Same IP / Device Match'}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-mono-digits flex items-center gap-1 ${
                            !isSameIp
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30 font-bold'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${!isSameIp ? 'bg-emerald-400' : 'bg-red-500'}`} />
                          {!isSameIp ? 'Unique ID & IP' : 'Same IP'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* QUALIFY REQUIREMENT MODAL / POPUP */}
      {showQualifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#121824] border border-[#2A344A] rounded-3xl p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1E2638] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white font-display uppercase tracking-wide">
                    Qualify Requirement
                  </h3>
                  <span className="text-[10px] text-gray-400">Referral & Anti-Fraud Verification Rules</span>
                </div>
              </div>
              <button
                onClick={() => {
                  haptic.selection();
                  setShowQualifyModal(false);
                }}
                className="w-8 h-8 rounded-full bg-[#1A2234] border border-[#252D3D] text-gray-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overview / Introduction */}
            <p className="text-xs text-gray-300 leading-relaxed">
              When an invited friend joins using your link, they must satisfy all 3 criteria to unlock the{' '}
              <strong className="text-[#FFE600] font-black">+{referralBonus} POP</strong> bonus and{' '}
              <strong className="text-[#00E5FF] font-black">{commissionRate}%</strong> lifetime squad mining commission:
            </p>

            {/* 3 Step Breakdown */}
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex items-start gap-3">
                <span className="w-6 h-6 rounded-xl bg-[#0088CC]/20 text-[#0088CC] flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <span className="text-white font-bold block text-xs">Join Official TG Channel</span>
                  <span className="text-[11px] text-gray-400 leading-tight block mt-0.5">
                    Must be subscribed to the official community Telegram channel.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex items-start gap-3">
                <span className="w-6 h-6 rounded-xl bg-[#00E5FF]/20 text-[#00E5FF] flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <span className="text-white font-bold block text-xs">Complete at Least 3 Tasks</span>
                  <span className="text-[11px] text-gray-400 leading-tight block mt-0.5">
                    Must successfully complete at least 3 ecosystem tasks to verify real engagement.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex items-start gap-3">
                <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <span className="text-white font-bold block text-xs">Unique User ID (Anti-Sybil Check)</span>
                  <span className="text-[11px] text-gray-400 leading-tight block mt-0.5">
                    Maintaining a unique user ID, distinct device hardware & separate IP (No self-referrals or multi-accounts).
                  </span>
                </div>
              </div>
            </div>

            {/* Rewards & Commission Summary */}
            <div className="p-3.5 rounded-2xl bg-[#161F30] border border-[#00E5FF]/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#00E5FF] uppercase font-display">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rewards & Commission System</span>
              </div>
              <ul className="text-xs text-gray-300 space-y-1.5 list-disc pl-4">
                <li>
                  <strong className="text-[#FFE600]">+{referralBonus} POP Instant Bonus:</strong> Distributed directly to the inviter's balance upon referee qualification.
                </li>
                <li>
                  <strong className="text-[#00E5FF]">{commissionRate}% Lifetime Squad Commission:</strong> Distributed on every mining claim made by qualified referrals ({commissionRate}% × mined POP).
                </li>
                <li>
                  <strong className="text-amber-300">Pending Action:</strong> Users who joined via link but haven't joined the official channel or completed 3 tasks generate 0 POP until qualified.
                </li>
              </ul>
            </div>

            {/* Anti-Fraud Protection Details */}
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200/90 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Anti-Fraud & Self-Referral Prevention</span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-300">
                Users creating multiple accounts using the same phone, device, or shared IP address are automatically flagged as <strong className="text-red-400">"Unqualified (Same IP / Device Match)"</strong>. Unqualified or self-referred users generate <strong className="text-red-400">0 POP bonus and 0% mining commissions</strong>.
              </p>
            </div>

            {/* Confirmation Close Button */}
            <button
              onClick={() => {
                haptic.selection();
                setShowQualifyModal(false);
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00E5FF] to-[#00C2FF] hover:brightness-110 text-black font-black text-xs uppercase font-display tracking-wider transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
