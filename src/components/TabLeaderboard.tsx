import React, { useState } from 'react';
import { Trophy, Search, Zap, Crown, Award, Medal } from 'lucide-react';
import { GlobalLeaderboardUser, AdminConfig } from '../types.js';
import { haptic } from '../services/haptic.js';

interface TabLeaderboardProps {
  leaderboard: GlobalLeaderboardUser[];
  config: AdminConfig;
  currentUsername: string;
}

export const TabLeaderboard: React.FC<TabLeaderboardProps> = ({
  leaderboard,
  config,
  currentUsername,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = leaderboard.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20 pt-2 px-4 max-w-md mx-auto">
      
      {/* Header Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-[#182338] to-[#121824] border border-[#252D3D] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFE600]/20 border border-[#FFE600]/50 flex items-center justify-center text-[#FFE600]">
            <Trophy className="w-5 h-5" />
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
        {filtered.map((user) => {
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
  );
};
