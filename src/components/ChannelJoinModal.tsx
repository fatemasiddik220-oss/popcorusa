import React, { useState } from 'react';
import { X, Send, ShieldAlert, CheckCircle2, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import { haptic } from '../services/haptic.js';
import { api } from '../services/api.js';
import { User } from '../types.js';

interface ChannelJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  channelLink: string;
  onVerified: (user: User) => void;
}

export const ChannelJoinModal: React.FC<ChannelJoinModalProps> = ({
  isOpen,
  onClose,
  channelName,
  channelLink,
  onVerified,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const displayName = channelName.startsWith('@') ? channelName : `@${channelName.replace('https://t.me/', '')}`;
  const directLink = channelLink || `https://t.me/${displayName.replace('@', '')}`;

  const handleOpenChannel = () => {
    haptic.impact('medium');
    setHasClickedJoin(true);
    setErrorMsg('');
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(directLink);
    } else {
      window.open(directLink, '_blank');
    }
  };

  const handleVerify = async () => {
    try {
      haptic.impact('heavy');
      setLoading(true);
      setErrorMsg('');

      const result = await api.verifyTelegramChannel();
      if (result.success && result.isMember) {
        setSuccess(true);
        haptic.success();
        setTimeout(() => {
          onVerified(result.user);
          onClose();
        }, 1200);
      } else {
        throw new Error(result.message || 'Please join the channel and try again.');
      }
    } catch (err: any) {
      haptic.error();
      setErrorMsg(err.message || 'Verification failed. Please ensure you joined the channel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-[#161B22] border border-emerald-500/30 text-white rounded-t-[32px] sm:rounded-3xl shadow-2xl z-10 p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-3 border-b border-gray-800 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-black shadow-lg shadow-emerald-500/20">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                Mandatory Prerequisite
              </span>
              <h3 className="text-base font-black text-white">
                Official Telegram Channel
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 space-y-4 relative z-10">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-black text-white tracking-tight">
              Join <span className="text-emerald-400">{displayName}</span> to Unlock Mining
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
              To prevent bot farming and ensure fair token distribution, all miners must join the official POP announcements channel before mining or claiming.
            </p>
          </div>

          {/* Channel Card */}
          <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                📢
              </div>
              <div className="text-left">
                <span className="font-bold text-sm text-white block">
                  POP Official Announcements
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  {displayName}
                </span>
              </div>
            </div>

            <button
              onClick={handleOpenChannel}
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
            >
              <span>Join Channel</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Membership verified! Unlocking POP mining engine...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleVerify}
              disabled={loading || success}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Membership...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Verify Membership</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors"
            >
              I'll do this later
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
