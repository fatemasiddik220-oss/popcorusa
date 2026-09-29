import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Headphones,
  MessageSquare,
  Send,
  RefreshCw
} from 'lucide-react';
import { User, AdminConfig, WithdrawalRequest, AppTransaction } from '../types.js';
import { haptic } from '../services/haptic.js';

interface TabWalletProps {
  user: User;
  config: AdminConfig;
  withdrawals: WithdrawalRequest[];
  onOpenWalletModal: () => void;
  onDisconnectWallet: () => Promise<void>;
  onSubmitWithdrawal: (amountPOP: number, tonAddress: string) => Promise<void>;
  onOpenChannelModal?: () => void;
}

export const TabWallet: React.FC<TabWalletProps> = ({
  user,
  config,
  withdrawals,
  onOpenWalletModal,
  onDisconnectWallet,
  onSubmitWithdrawal,
  onOpenChannelModal,
}) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDexModal, setShowDexModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState(user.tonWalletAddress || '');
  const [isSubmittingWd, setIsSubmittingWd] = useState(false);
  const [wdError, setWdError] = useState<string | null>(null);
  const [structuredError, setStructuredError] = useState<{
    code: 'WALLET_REQUIRED' | 'CHANNEL_REQUIRED' | 'BELOW_MIN_LIMIT' | 'EXCEEDS_MAX_LIMIT' | 'INSUFFICIENT_BALANCE' | 'GENERIC';
    title: string;
    message: string;
  } | null>(null);
  const [wdSuccess, setWdSuccess] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Accordion state
  const [expandWdHistory, setExpandWdHistory] = useState(true);
  const [expandAppHistory, setExpandAppHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<AppTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'REFERRALS' | 'MINING' | 'WITHDRAWALS'>('ALL');

  const fetchWalletHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch('/api/wallet/history', {
        headers: {
          'x-telegram-id': String(user.telegramId || ''),
          'x-user-id': String(user.id || ''),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setHistoryLogs(data.history);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch wallet history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user.telegramId, user.id]);

  useEffect(() => {
    fetchWalletHistory();
  }, [fetchWalletHistory, user.balancePOP, withdrawals.length]);

  // Calculation for withdrawal
  const numAmount = parseFloat(withdrawAmount) || 0;
  const feePercent = config.withdrawalFeePercent;
  const minWd = typeof config.minWithdrawAmount === 'number' ? config.minWithdrawAmount : 100;
  const maxWd = typeof config.maxWithdrawAmount === 'number' ? config.maxWithdrawAmount : 50000;
  const popUsdRate = config.popUsdRate || 0.001;
  const calculatedFee = (numAmount * feePercent) / 100;
  const netOutput = Math.max(0, numAmount - calculatedFee);

  const handleCopy = () => {
    if (!user.tonWalletAddress) return;
    navigator.clipboard.writeText(user.tonWalletAddress);
    setCopiedAddr(true);
    haptic.selection();
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleOpenWithdrawModal = () => {
    haptic.impact('medium');
    setStructuredError(null);
    setWdError(null);

    // Initial pre-flight checks
    if (!user.tonWalletAddress) {
      setStructuredError({
        code: 'WALLET_REQUIRED',
        title: 'TON Wallet Required',
        message: 'You must connect a verified TON wallet address before requesting a withdrawal.'
      });
      setShowWithdrawModal(true);
      return;
    }

    if (!user.hasJoinedChannel) {
      setStructuredError({
        code: 'CHANNEL_REQUIRED',
        title: 'Channel Verification Required',
        message: 'You must join our official Telegram channel (@PopCornUSA_BOT) to qualify for withdrawals.'
      });
    }

    setWithdrawAddress(user.tonWalletAddress);
    setShowWithdrawModal(true);
  };

  const handleSubmitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setStructuredError(null);
    setWdError(null);

    if (!user.tonWalletAddress || !withdrawAddress || withdrawAddress.trim().length < 10) {
      setStructuredError({
        code: 'WALLET_REQUIRED',
        title: 'TON Wallet Required',
        message: 'A valid connected TON wallet address is required to receive your POP payout.'
      });
      haptic.error();
      return;
    }

    if (!user.hasJoinedChannel) {
      setStructuredError({
        code: 'CHANNEL_REQUIRED',
        title: 'Channel Verification Required',
        message: 'Mandatory requirement: You must join @PopCornUSA_BOT official Telegram channel to unlock payouts.'
      });
      haptic.error();
      return;
    }

    if (numAmount < minWd) {
      setStructuredError({
        code: 'BELOW_MIN_LIMIT',
        title: 'Below Minimum Limit',
        message: `Minimum withdrawal amount is ${minWd.toLocaleString()} POP ($${(minWd * popUsdRate).toFixed(2)} USD).`
      });
      haptic.error();
      return;
    }

    if (numAmount > maxWd) {
      setStructuredError({
        code: 'EXCEEDS_MAX_LIMIT',
        title: 'Exceeds Maximum Limit',
        message: `Maximum withdrawal limit is ${maxWd.toLocaleString()} POP ($${(maxWd * popUsdRate).toFixed(2)} USD) per transaction.`
      });
      haptic.error();
      return;
    }

    if (numAmount > user.balancePOP) {
      setStructuredError({
        code: 'INSUFFICIENT_BALANCE',
        title: 'Insufficient Balance',
        message: `Insufficient POP balance. You have ${user.balancePOP.toFixed(2)} POP available.`
      });
      haptic.error();
      return;
    }

    try {
      setIsSubmittingWd(true);
      setWdError(null);
      setStructuredError(null);
      haptic.impact('heavy');
      await onSubmitWithdrawal(numAmount, withdrawAddress);
      haptic.success();
      setWdSuccess(`Withdrawal request for ${numAmount.toLocaleString()} POP submitted! Admin notified.`);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setTimeout(() => setWdSuccess(null), 4000);
    } catch (err: any) {
      haptic.error();
      const rawCode = err.code || '';
      const rawMsg = err.message || '';
      
      let code: 'WALLET_REQUIRED' | 'CHANNEL_REQUIRED' | 'BELOW_MIN_LIMIT' | 'EXCEEDS_MAX_LIMIT' | 'INSUFFICIENT_BALANCE' | 'GENERIC' = 'GENERIC';
      let title = 'Withdrawal Rejected';

      if (rawCode === 'WALLET_REQUIRED' || rawMsg.includes('WALLET_REQUIRED')) {
        code = 'WALLET_REQUIRED';
        title = 'TON Wallet Required';
      } else if (rawCode === 'CHANNEL_REQUIRED' || rawMsg.includes('CHANNEL_REQUIRED') || rawMsg.toLowerCase().includes('channel')) {
        code = 'CHANNEL_REQUIRED';
        title = 'Official Channel Required';
      } else if (rawCode === 'BELOW_MIN_LIMIT' || rawMsg.includes('BELOW_MIN_LIMIT') || rawMsg.toLowerCase().includes('minimum')) {
        code = 'BELOW_MIN_LIMIT';
        title = 'Below Minimum Limit';
      } else if (rawCode === 'EXCEEDS_MAX_LIMIT' || rawMsg.includes('EXCEEDS_MAX_LIMIT') || rawMsg.toLowerCase().includes('maximum')) {
        code = 'EXCEEDS_MAX_LIMIT';
        title = 'Exceeds Maximum Limit';
      } else if (rawCode === 'INSUFFICIENT_BALANCE' || rawMsg.includes('INSUFFICIENT_BALANCE') || rawMsg.toLowerCase().includes('insufficient')) {
        code = 'INSUFFICIENT_BALANCE';
        title = 'Insufficient Balance';
      }

      setStructuredError({
        code,
        title,
        message: rawMsg.replace(/^(WALLET_REQUIRED|CHANNEL_REQUIRED|BELOW_MIN_LIMIT|EXCEEDS_MAX_LIMIT|INSUFFICIENT_BALANCE):\s*/, '') || 'Withdrawal request could not be processed. Please try again.'
      });
      setWdError(rawMsg || 'Withdrawal failed');
    } finally {
      setIsSubmittingWd(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 pt-2 px-4 max-w-md mx-auto">
      
      {/* 1. WALLET CARD: Active In-App POP Balance, USD Value & Total Holdings */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#182338] via-[#121824] to-[#0B0E14] border border-[#252D3D] p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#00E5FF]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Asset Holdings
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#121824] border border-[#252D3D] text-[#00E5FF] font-semibold">
            TON Network
          </span>
        </div>

        <div className="my-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono-digits">
              {user.balancePOP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-base font-black text-[#FFE600] font-display">POP</span>
          </div>
          <div className="text-xs text-gray-400 font-mono-digits mt-0.5">
            ≈ ${(user.balancePOP * config.popUsdRate).toFixed(2)} USD
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1E2638] text-xs">
          <div>
            <span className="text-[10px] text-gray-400 block font-medium">Lifetime Mined</span>
            <span className="font-bold text-gray-200 font-mono-digits">{user.totalMined.toFixed(2)} POP</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block font-medium">Unclaimed Mining</span>
            <span className="font-bold text-[#FFE600] font-mono-digits">{user.unclaimedMiningPOP.toFixed(2)} POP</span>
          </div>
        </div>

        {/* Action Buttons: [BUY / DEX] and [WITHDRAW] */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => {
              haptic.impact('medium');
              setShowDexModal(true);
            }}
            className="py-3 px-4 rounded-2xl bg-[#1A2234] hover:bg-[#252D3D] border border-[#252D3D] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all font-display uppercase tracking-wider"
          >
            <ArrowDownLeft className="w-4 h-4 text-[#00E5FF]" />
            <span>BUY / DEX</span>
          </button>

          <button
            onClick={handleOpenWithdrawModal}
            className="py-3 px-4 rounded-2xl bg-[#FFE600] hover:bg-[#FFE600]/90 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-yellow-500/20 active:scale-95 font-display uppercase tracking-wider"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>WITHDRAW</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {wdSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{wdSuccess}</span>
        </div>
      )}

      {/* 2. WITHDRAWAL PREREQUISITES & ELIGIBILITY PANEL */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FFE600]" />
            Withdrawal Prerequisites
          </span>
          <span className="text-[10px] text-gray-500 font-mono-digits">
            Min: {minWd.toLocaleString()} POP • Max: {maxWd.toLocaleString()} POP
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Requirement 1: TON Wallet */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            user.tonWalletAddress
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              {user.tonWalletAddress ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>TON Wallet</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-1 truncate">
              {user.tonWalletAddress ? 'Connected' : 'Not Connected'}
            </div>
            {!user.tonWalletAddress && (
              <button
                onClick={onOpenWalletModal}
                className="mt-2 py-1 px-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[10px] font-bold transition-all text-center"
              >
                Connect Wallet →
              </button>
            )}
          </div>

          {/* Requirement 2: Official Channel */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            user.hasJoinedChannel
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              {user.hasJoinedChannel ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>Telegram Channel</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-1 truncate">
              {user.hasJoinedChannel ? '@PopCornUSA_BOT' : 'Join Required'}
            </div>
            {!user.hasJoinedChannel && (
              <button
                onClick={() => {
                  if (onOpenChannelModal) onOpenChannelModal();
                  else window.open('https://t.me/PopCornUSA_BOT', '_blank');
                }}
                className="mt-2 py-1 px-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition-all text-center"
              >
                Join Channel →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. CONNECTION BAR (Connected TON Wallet Address, Copy & Disconnect) */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-400">Connected TON Wallet</span>
          {user.tonWalletAddress ? (
            <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> READY
            </span>
          ) : (
            <span className="text-amber-400 font-bold text-[10px]">DISCONNECTED</span>
          )}
        </div>

        {user.tonWalletAddress ? (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl">
            <span className="font-mono-digits text-xs text-[#00E5FF] truncate">
              {user.tonWalletAddress}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopy}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-[#1A2234] transition-colors"
                title="Copy Address"
              >
                {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={async () => {
                  haptic.impact('heavy');
                  await onDisconnectWallet();
                }}
                className="px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 rounded-lg font-semibold transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenWalletModal}
            className="w-full py-2.5 px-3 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#00E5FF]/25 transition-all font-display"
          >
            <Wallet className="w-4 h-4" />
            <span>Connect TON Wallet Now</span>
          </button>
        )}
      </div>

      {/* 3. ACCORDION HISTORY: WITHDRAWAL HISTORY */}
      <div className="rounded-2xl bg-[#121824] border border-[#252D3D] overflow-hidden">
        <button
          onClick={() => setExpandWdHistory(!expandWdHistory)}
          className="w-full p-4 flex items-center justify-between text-xs font-bold text-white hover:bg-[#161F30] transition-colors"
        >
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[#FFE600]" />
            <span>Withdrawal History ({withdrawals.length})</span>
          </div>
          {expandWdHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandWdHistory && (
          <div className="p-4 pt-0 space-y-2 border-t border-[#1E2638]">
            {withdrawals.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500">
                No withdrawal requests submitted yet.
              </div>
            ) : (
              withdrawals.map((wd) => {
                const isPaid = wd.status === 'PAID';
                const isPending = wd.status === 'PENDING';
                const isRejected = wd.status === 'REJECTED';

                return (
                  <div
                    key={wd.id}
                    className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-digits text-xs font-black text-white">
                          {wd.amountPOP.toLocaleString()} POP
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono-digits">
                          (Net: {wd.netAmountPOP} POP)
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : isRejected
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-yellow-500/20 text-[#FFE600] border-yellow-500/40'
                      }`}>
                        {wd.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-500 font-mono-digits flex items-center justify-between">
                      <span>{new Date(wd.createdAt).toLocaleString()}</span>
                      <span>Fee: {wd.feePercent}%</span>
                    </div>

                    {wd.txHash && (
                      <div className="pt-1 flex items-center gap-1 text-[10px] text-[#00E5FF]">
                        <ExternalLink className="w-3 h-3" />
                        <a
                          href={`https://tonviewer.com/transaction/${wd.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline font-mono-digits truncate"
                        >
                          TX: {wd.txHash.slice(0, 16)}...
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 4. ACCORDION HISTORY: APP MINING & REWARD LOGS */}
      <div className="rounded-2xl bg-[#121824] border border-[#252D3D] overflow-hidden">
        <button
          onClick={() => {
            const next = !expandAppHistory;
            setExpandAppHistory(next);
            if (next) fetchWalletHistory();
          }}
          className="w-full p-4 flex items-center justify-between text-xs font-bold text-white hover:bg-[#161F30] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00E5FF]" />
            <span>App History & Logs {historyLogs.length > 0 && `(${historyLogs.length})`}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingHistory && <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF] animate-spin" />}
            {expandAppHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        {expandAppHistory && (
          <div className="p-4 pt-0 space-y-2.5 border-t border-[#1E2638] text-xs text-gray-400">
            {/* Quick Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 scrollbar-none text-[10px]">
              {(['ALL', 'REFERRALS', 'MINING', 'WITHDRAWALS'] as const).map((filterKey) => {
                const label =
                  filterKey === 'ALL'
                    ? 'All Logs'
                    : filterKey === 'REFERRALS'
                    ? 'Referrals & Squad'
                    : filterKey === 'MINING'
                    ? 'Mining Claims'
                    : 'Withdrawals';
                const isActive = historyFilter === filterKey;
                return (
                  <button
                    key={filterKey}
                    onClick={() => {
                      haptic.selection();
                      setHistoryFilter(filterKey);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#00E5FF] text-black shadow-sm'
                        : 'bg-[#0B0E14] text-gray-400 border border-[#1E2638] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {isLoadingHistory && historyLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#00E5FF] animate-spin" />
                <span>Loading activity logs...</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500">
                No activity logs recorded yet.
              </div>
            ) : (
              historyLogs
                .filter((tx) => {
                  if (historyFilter === 'REFERRALS') {
                    return tx.type === 'REFERRAL_BONUS' || tx.type === 'SQUAD_COMMISSION';
                  }
                  if (historyFilter === 'MINING') {
                    return tx.type === 'MINING_CLAIM';
                  }
                  if (historyFilter === 'WITHDRAWALS') {
                    return tx.type === 'WITHDRAWAL';
                  }
                  return true;
                })
                .map((tx) => {
                  const isPositive = tx.amount > 0;
                  const isNegative = tx.amount < 0;
                  const formattedAmount = isPositive
                    ? `+${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} POP`
                    : isNegative
                    ? `${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} POP`
                    : '0.00 POP';

                  // Dynamic Category Tag Details
                  let catBadge = { label: 'Activity', className: 'bg-gray-500/20 text-gray-300 border-gray-500/40' };
                  if (tx.type === 'REFERRAL_BONUS') {
                    catBadge = { label: 'Referral Bonus', className: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
                  } else if (tx.type === 'SQUAD_COMMISSION') {
                    catBadge = { label: 'Squad Mining', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
                  } else if (tx.type === 'MINING_CLAIM') {
                    catBadge = { label: 'Mining Reward', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' };
                  } else if (tx.type === 'DAILY_BONUS') {
                    catBadge = { label: 'Daily Streak', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
                  } else if (tx.type === 'TASK_REWARD') {
                    catBadge = { label: 'Ecosystem Task', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
                  } else if (tx.type === 'WITHDRAWAL') {
                    catBadge = { label: 'Withdrawal', className: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
                  }

                  return (
                    <div
                      key={tx.id}
                      className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between gap-3 hover:border-[#2A344A] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border ${catBadge.className}`}>
                            {catBadge.label}
                          </span>
                          <span className="font-semibold text-white truncate text-xs block">
                            {tx.title}
                          </span>
                          {tx.status && tx.status !== 'COMPLETED' && (
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                              tx.status === 'PENDING'
                                ? 'bg-yellow-500/20 text-[#FFE600] border-yellow-500/40'
                                : 'bg-red-500/20 text-red-400 border-red-500/40'
                            }`}>
                              {tx.status}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono-digits mt-1">
                          <span>
                            {new Date(tx.createdAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                          {tx.details && <span className="truncate text-gray-400">• {tx.details}</span>}
                        </div>
                      </div>
                      <span
                        className={`font-mono-digits font-bold text-xs shrink-0 ${
                          isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-gray-400'
                        }`}
                      >
                        {formattedAmount}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* 5. DEDICATED OFFICIAL SUPPORT & HELPDESK CARD */}
      <div className="rounded-2xl bg-gradient-to-b from-[#121824] to-[#0D121D] border border-emerald-500/30 p-4 shadow-xl space-y-3 relative overflow-hidden">
        {/* Glow ambient accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-black shadow-lg shadow-emerald-500/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Official POP Support Hub
              </h4>
              <span className="text-[10px] text-gray-400">
                Direct assistance for withdrawals & inquiries
              </span>
            </div>
          </div>
          <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
            24/7 Active
          </span>
        </div>

        <p className="text-[11px] text-gray-300 leading-relaxed relative z-10">
          Need help with TON wallet connection, withdrawal confirmations, or DEX swapping? Contact official POP administrators directly:
        </p>

        {/* Dynamic Support Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 relative z-10">
          {/* Telegram Support Button */}
          <a
            href={config.telegramSupportUrl || `https://t.me/${(config.telegramSupportUsername || '@PopCornUSA_BOT').replace('@', '')}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => haptic.impact('light')}
            className="p-3 rounded-xl bg-[#0088CC]/15 hover:bg-[#0088CC]/25 border border-[#0088CC]/40 text-white flex items-center justify-between transition-all group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0088CC] flex items-center justify-center text-white shadow-sm">
                <Send className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-xs block group-hover:text-cyan-300 transition-colors">
                  Telegram Admin
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {config.telegramSupportUsername || '@PopCornUSA_BOT'}
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" />
          </a>

          {/* WhatsApp Support Button */}
          <a
            href={config.whatsappSupportUrl || `https://wa.me/${(config.whatsappSupportNumber || '15550192834').replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => haptic.impact('light')}
            className="p-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-white flex items-center justify-between transition-all group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center text-white shadow-sm">
                <MessageSquare className="w-3.5 h-3.5 fill-current" />
              </div>
              <div className="text-left">
                <span className="font-bold text-xs block group-hover:text-emerald-300 transition-colors">
                  WhatsApp Support
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {config.whatsappSupportNumber || '+1 555-019-2834'}
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" />
          </a>
        </div>
      </div>

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#121824] border border-[#252D3D] rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E2638] pb-3">
              <h3 className="text-base font-black text-white font-display uppercase tracking-wide">
                Withdraw POP Tokens
              </h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Structured Notice / Restriction Resolution Banner */}
            {structuredError ? (
              <div className={`p-3 rounded-2xl border text-xs space-y-2 ${
                structuredError.code === 'WALLET_REQUIRED'
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : structuredError.code === 'CHANNEL_REQUIRED'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : structuredError.code === 'INSUFFICIENT_BALANCE'
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FFE600]" />
                  <div>
                    <span className="font-bold block text-white text-[11px] uppercase tracking-wider">
                      {structuredError.title}
                    </span>
                    <p className="text-[11px] leading-relaxed text-gray-200 mt-0.5">
                      {structuredError.message}
                    </p>
                  </div>
                </div>

                {/* Direct Action Resolution Buttons */}
                <div className="pt-1 flex gap-2">
                  {structuredError.code === 'WALLET_REQUIRED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowWithdrawModal(false);
                        onOpenWalletModal();
                      }}
                      className="w-full py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 shadow"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Connect TON Wallet Now</span>
                    </button>
                  )}

                  {structuredError.code === 'CHANNEL_REQUIRED' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenChannelModal) onOpenChannelModal();
                        else window.open('https://t.me/PopCornUSA_BOT', '_blank');
                      }}
                      className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1.5 shadow"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Join @PopCornUSA_BOT Channel</span>
                    </button>
                  )}

                  {structuredError.code === 'BELOW_MIN_LIMIT' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawAmount(String(minWd));
                        setStructuredError(null);
                        setWdError(null);
                      }}
                      className="w-full py-1.5 px-3 bg-[#FFE600] text-black font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <span>Auto-Fill Minimum ({minWd.toLocaleString()} POP)</span>
                    </button>
                  )}

                  {structuredError.code === 'EXCEEDS_MAX_LIMIT' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawAmount(String(maxWd));
                        setStructuredError(null);
                        setWdError(null);
                      }}
                      className="w-full py-1.5 px-3 bg-[#FFE600] text-black font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <span>Auto-Fill Maximum ({maxWd.toLocaleString()} POP)</span>
                    </button>
                  )}

                  {structuredError.code === 'INSUFFICIENT_BALANCE' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawAmount(Math.min(user.balancePOP, maxWd).toString());
                        setStructuredError(null);
                        setWdError(null);
                      }}
                      className="w-full py-1.5 px-3 bg-[#FFE600] text-black font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <span>Set to Max Available ({Math.min(user.balancePOP, maxWd).toFixed(2)} POP)</span>
                    </button>
                  )}
                </div>
              </div>
            ) : wdError ? (
              <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{wdError}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmitWithdraw} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Destination TON Address
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="EQB..."
                  className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#252D3D] focus:border-[#00E5FF] rounded-xl text-xs text-white font-mono-digits outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 mb-1">
                  <span>Withdraw Amount (POP)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono-digits">
                      Balance: {user.balancePOP.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(Math.min(user.balancePOP, maxWd).toString())}
                      className="text-[#00E5FF] hover:underline"
                    >
                      Max: {Math.min(user.balancePOP, maxWd).toFixed(2)}
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={minWd}
                  max={Math.min(user.balancePOP, maxWd)}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Min ${minWd} - Max ${maxWd.toLocaleString()} POP`}
                  className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#252D3D] focus:border-[#FFE600] rounded-xl text-xs text-white font-mono-digits outline-none"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono-digits">
                  <span>Min: {minWd.toLocaleString()} POP (${(minWd * popUsdRate).toFixed(2)})</span>
                  <span>Max: {maxWd.toLocaleString()} POP (${(maxWd * popUsdRate).toFixed(2)})</span>
                </div>
              </div>

              {/* Dynamic Fee & Net Calculation Breakdown */}
              <div className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Withdrawal Amount:</span>
                  <span className="font-mono-digits text-white">{numAmount.toFixed(2)} POP</span>
                </div>
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Dynamic Admin Fee ({feePercent}%):</span>
                  <span className="font-mono-digits text-red-400">-{calculatedFee.toFixed(2)} POP</span>
                </div>
                <div className="flex justify-between font-bold text-white pt-1.5 border-t border-[#1E2638]">
                  <span>Net Output to Wallet:</span>
                  <span className="font-mono-digits text-[#FFE600]">{netOutput.toFixed(2)} POP</span>
                </div>
                <div className="text-[10px] text-gray-500 text-right font-mono-digits">
                  ≈ ${(netOutput * config.popUsdRate).toFixed(2)} USD
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="w-1/3 py-2.5 bg-[#1A2234] text-gray-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWd || numAmount < minWd || numAmount > maxWd}
                  className="flex-1 py-2.5 bg-[#FFE600] text-black font-extrabold text-xs rounded-xl hover:bg-[#FFE600]/90 transition-all font-display uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingWd ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUY / DEX MODAL */}
      {showDexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#121824] border border-[#252D3D] rounded-3xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/20 border border-[#00E5FF]/50 flex items-center justify-center mx-auto text-[#00E5FF]">
              <ArrowDownLeft className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-white font-display uppercase">
              POP DEX Liquidity Pools
            </h3>

            <p className="text-xs text-gray-400 leading-relaxed">
              POP Tokens trade on decentralized TON Automated Market Makers (AMMs) like DeDust and STON.fi.
            </p>

            <div className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-left text-xs space-y-1">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">Verified Pair:</div>
              <div className="font-bold text-white">POP / TON & POP / USDT</div>
              <div className="text-[11px] text-[#FFE600] font-mono-digits">Fixed Initial Peg: 100 POP = $0.10 USDT</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://dedust.io"
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-[#1A2234] hover:bg-[#252D3D] border border-[#252D3D] text-xs font-bold text-white flex items-center justify-center gap-1"
              >
                <span>DeDust</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://ston.fi"
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-[#1A2234] hover:bg-[#252D3D] border border-[#252D3D] text-xs font-bold text-white flex items-center justify-center gap-1"
              >
                <span>STON.fi</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <button
              onClick={() => setShowDexModal(false)}
              className="w-full py-2 bg-[#161F30] text-gray-400 hover:text-white rounded-xl text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
