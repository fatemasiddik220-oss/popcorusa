import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Search,
  Zap,
  Crown,
  Award,
  Medal,
  Calendar,
  Filter,
  Users,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { GlobalLeaderboardUser, WeeklyPodiumUser, AdminConfig, LeaderboardCycleInfo } from '../types.js';
import { haptic } from '../services/haptic.js';
import { api } from '../services/api.js';

interface TabLeaderboardProps {
  leaderboard: GlobalLeaderboardUser[];
  weeklyLeaderboard?: WeeklyPodiumUser[];
  config: AdminConfig;
  currentUsername: string;
  currentTelegramId?: string;
}

export const TabLeaderboard: React.FC<TabLeaderboardProps> = ({
  leaderboard,
  weeklyLeaderboard = [],
  config,
  currentUsername,
  currentTelegramId,
}) => {
  // Mode toggle: Default is 'contest' (Weekly Referral Contest) as requested
  const [activeMode, setActiveMode] = useState<'contest' | 'mining'>('contest');

  // Referral Contest filtering: Default is 'weekly' (Saturday to Saturday)
  const [contestFilter, setContestFilter] = useState<'weekly' | '7d' | '30d' | 'custom'>('weekly');
  const [weeklyUsers, setWeeklyUsers] = useState<WeeklyPodiumUser[]>(weeklyLeaderboard);
  const [cycleInfo, setCycleInfo] = useState<LeaderboardCycleInfo | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Search term
  const [searchTerm, setSearchTerm] = useState('');

  // Sync initial weeklyLeaderboard prop
  useEffect(() => {
    if (weeklyLeaderboard && weeklyLeaderboard.length > 0) {
      setWeeklyUsers(weeklyLeaderboard);
    }
  }, [weeklyLeaderboard]);

  // Fetch or filter weekly contest leaderboard
  const handleContestFilterSelect = async (filter: 'weekly' | '7d' | '30d' | 'custom') => {
    haptic.selection();
    setContestFilter(filter);
    if (filter !== 'custom') {
      try {
        setIsLoading(true);
        const res = await api.getWeeklyLeaderboard({ filter });
        setWeeklyUsers(res.leaderboard);
        if (res.cycle) setCycleInfo(res.cycle);
      } catch (err) {
        console.warn('Failed to filter weekly leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleApplyCustomRange = async () => {
    if (!customStart) return;
    haptic.impact('medium');
    try {
      setIsLoading(true);
      const res = await api.getWeeklyLeaderboard({
        filter: 'custom',
        startDate: customStart,
        endDate: customEnd || customStart,
      });
      setWeeklyUsers(res.leaderboard);
      if (res.cycle) setCycleInfo(res.cycle);
    } catch (err) {
      console.warn('Failed to apply custom date range:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered lists based on search
  const filteredContestUsers = weeklyUsers.filter((u) =>
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMiningUsers = leaderboard.filter((u) =>
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Contest Top 3 Podium
  const rank1 = weeklyUsers.find((u) => u.rank === 1);
  const rank2 = weeklyUsers.find((u) => u.rank === 2);
  const rank3 = weeklyUsers.find((u) => u.rank === 3);
  const restContestRanks = filteredContestUsers.filter((u) => u.rank > 3);

  return (
    <div className="space-y-4 pb-24 pt-2 px-4 max-w-md mx-auto">
      
      {/* 1. TOP DUAL MODE TOGGLE: Weekly Referral Contest (Default) vs Global Mining */}
      <div className="grid grid-cols-2 p-1 bg-[#121824] border border-[#252D3D] rounded-2xl gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            haptic.selection();
            setActiveMode('contest');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeMode === 'contest'
              ? 'bg-[#FFE600] text-black shadow-md font-display'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Referral Contest</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.selection();
            setActiveMode('mining');
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeMode === 'mining'
              ? 'bg-[#00E5FF] text-black shadow-md font-display'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Global Mining</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: WEEKLY REFERRAL CONTEST LEADERBOARD (DEFAULT VIEW)               */}
      {/* ========================================================================= */}
      {activeMode === 'contest' && (
        <div className="space-y-4">
          
          {/* Contest Overview Banner */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-[#182338] via-[#121824] to-[#162032] border border-[#FFE600]/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-[#FFE600]/20 border border-[#FFE600]/50 flex items-center justify-center text-[#FFE600]">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white font-display uppercase tracking-wide">
                    Weekly Referral Contest
                  </h3>
                  <span className="text-[10px] text-gray-400 block font-mono-digits">
                    {cycleInfo?.label || (contestFilter === 'weekly' ? 'Saturday to Saturday Contest' : `${contestFilter.toUpperCase()} Window`)}
                  </span>
                </div>
              </div>

              <span className="text-[9px] font-black text-[#FFE600] bg-[#FFE600]/15 border border-[#FFE600]/40 px-2 py-0.5 rounded-full uppercase tracking-wider font-display">
                Sat - Sat
              </span>
            </div>

            {/* Contest Rules Banner */}
            <div className="p-2.5 bg-[#0B0E14] border border-[#252D3D] rounded-2xl text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-gray-200">
                <span className="text-[#FFE600] font-bold">📜 Contest Rule:</span>
                <span>
                  Minimum <strong className="text-[#FFE600] font-mono-digits">{config.weeklyContestMinThreshold} Qualified Referrals</strong> achieved in current weekly window.
                </span>
              </div>
              <div className="text-[10px] text-gray-400">
                * Qualified criteria: TON Wallet Connected + Official Channel Joined + Mining Started.
              </div>
            </div>

            {/* Prize Pool Display */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Contest Prizes (Manual Offline Distribution)
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

            {/* Notice Footer */}
            <div className="text-[10px] text-gray-400 flex items-center gap-1 pt-0.5">
              <Info className="w-3 h-3 text-[#FFE600] shrink-0" />
              <span>Payouts are handled manually offline by admins following each cycle review.</span>
            </div>
          </div>

          {/* Flexible Contest Filtering Option Bar */}
          <div className="bg-[#121824] p-3 rounded-2xl border border-[#252D3D] space-y-2.5 shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Leaderboard Window:</span>
              </span>
              <span className="text-[10px] font-mono-digits text-cyan-400 font-bold">
                {cycleInfo?.label || (contestFilter === 'weekly' ? 'Saturday to Saturday Contest' : 'Dynamic Range')}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleContestFilterSelect('weekly')}
                className={`py-2 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  contestFilter === 'weekly'
                    ? 'bg-[#FFE600] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                🌟 Sat - Sat
              </button>

              <button
                type="button"
                onClick={() => handleContestFilterSelect('7d')}
                className={`py-2 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  contestFilter === '7d'
                    ? 'bg-[#00E5FF] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                ⏱️ 7 Days
              </button>

              <button
                type="button"
                onClick={() => handleContestFilterSelect('30d')}
                className={`py-2 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  contestFilter === '30d'
                    ? 'bg-[#00E5FF] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                📅 1 Month
              </button>

              <button
                type="button"
                onClick={() => handleContestFilterSelect('custom')}
                className={`py-2 px-1 rounded-xl font-bold transition-all text-center text-[10px] sm:text-xs ${
                  contestFilter === 'custom'
                    ? 'bg-[#00E5FF] text-black shadow-md font-display'
                    : 'bg-[#0B0E14] text-gray-400 hover:text-white border border-[#252D3D]'
                }`}
              >
                🗓️ Custom
              </button>
            </div>

            {/* Custom Range Date Pickers */}
            {contestFilter === 'custom' && (
              <div className="pt-2 border-t border-[#252D3D] flex items-center gap-2 text-xs flex-wrap animate-in fade-in duration-150">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[10px] text-gray-400 block mb-0.5">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-white text-[11px]"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[10px] text-gray-400 block mb-0.5">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-white text-[11px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  className="self-end px-3 py-1.5 bg-gradient-to-r from-[#00E5FF] to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-extrabold rounded-xl text-xs shadow-md"
                >
                  Apply
                </button>
              </div>
            )}

            {isLoading && (
              <div className="text-[10px] text-cyan-400 text-center animate-pulse pt-1">
                Calculating qualified referrals dynamically...
              </div>
            )}
          </div>

          {/* Top 3 Podium Cards: 2nd on Left, 1st Center Crown, 3rd on Right */}
          <div className="grid grid-cols-3 gap-2 items-end pt-2">
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

          {/* Search Bar for Contest Inviters */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search inviter by username..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#121824] border border-[#252D3D] focus:border-[#00E5FF] rounded-2xl text-xs text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>

          {/* Ranks 4 to 50 Ranked List */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase px-1">Ranked Inviters</span>
            {restContestRanks.length === 0 ? (
              <div className="p-5 bg-[#0B0E14] rounded-2xl text-center text-xs text-gray-500 border border-[#1E2638]">
                {searchTerm ? 'No inviters found matching your search.' : 'No other qualified inviters in this window yet.'}
              </div>
            ) : (
              restContestRanks.map((entry) => {
                const isCurrent = entry.isCurrentUser || entry.username === currentUsername;
                return (
                  <div
                    key={entry.rank}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-[#00E5FF]/10 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.15)] ring-1 ring-[#00E5FF]/50'
                        : 'bg-[#121824] border-[#1E2638] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center font-mono-digits text-xs font-bold text-gray-400">
                        #{entry.rank}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${isCurrent ? 'text-[#00E5FF]' : 'text-white'}`}>
                            @{entry.username}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] bg-[#00E5FF] text-black font-extrabold px-1.5 py-0.2 rounded font-display">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono-digits">
                          Earnings: {Math.round(entry.totalPopEarnings || 0)} POP
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-[#FFE600] font-mono-digits block">
                        {entry.referralCount} refs
                      </span>
                      {entry.referralCount >= config.weeklyContestMinThreshold ? (
                        <span className="text-[9px] text-emerald-400 font-semibold">Eligible</span>
                      ) : (
                        <span className="text-[9px] text-gray-500 font-mono-digits">Need {config.weeklyContestMinThreshold - entry.referralCount} more</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: GLOBAL MINING LEADERBOARD (NODE OPERATORS)                        */}
      {/* ========================================================================= */}
      {activeMode === 'mining' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-[#182338] to-[#121824] border border-[#252D3D] shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00E5FF]/20 border border-[#00E5FF]/50 flex items-center justify-center text-[#00E5FF]">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white font-display uppercase tracking-wider">
                  Global Mining Leaderboard
                </h2>
                <p className="text-[11px] text-gray-400">
                  The highest-yielding node operators in the POP network
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search miner by username..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#121824] border border-[#252D3D] focus:border-[#00E5FF] rounded-2xl text-xs text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2">
            {filteredMiningUsers.map((user) => {
              const isTop1 = user.rank === 1;
              const isTop2 = user.rank === 2;
              const isTop3 = user.rank === 3;
              const isCurrent = user.isCurrentUser || user.username === currentUsername;

              return (
                <div
                  key={user.rank}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isCurrent
                      ? 'bg-[#00E5FF]/10 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.15)] ring-1 ring-[#00E5FF]/50'
                      : isTop1
                      ? 'bg-gradient-to-r from-[#1C2538] to-[#121824] border-[#FFE600]/60'
                      : 'bg-[#121824] border-[#252D3D]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div className="w-7 text-center shrink-0">
                      {isTop1 ? (
                        <Crown className="w-5 h-5 text-[#FFE600] mx-auto fill-[#FFE600]" />
                      ) : isTop2 ? (
                        <Medal className="w-5 h-5 text-gray-300 mx-auto" />
                      ) : isTop3 ? (
                        <Award className="w-5 h-5 text-amber-500 mx-auto" />
                      ) : (
                        <span className="font-mono-digits text-xs font-bold text-gray-400">
                          #{user.rank}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isCurrent ? 'text-[#00E5FF]' : 'text-white'}`}>
                          @{user.username}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] bg-[#00E5FF] text-black font-extrabold px-1.5 py-0.2 rounded font-display">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                        <Zap className="w-3 h-3 text-[#FFE600]" />
                        <span>Lvl {user.minerLevel} Miner</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-black text-[#FFE600] font-mono-digits">
                      {user.totalPOP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} POP
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono-digits">
                      ≈ ${(user.totalPOP * config.popUsdRate).toFixed(2)} USD
                    </div>
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
