import React from 'react';
import { Pickaxe, Zap, CheckSquare, Users2, Trophy, Wallet2 } from 'lucide-react';
import { haptic } from '../services/haptic.js';

export type ActiveTab = 'mine' | 'upgrade' | 'tasks' | 'squad' | 'wallet' | 'leaderboard';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  unclaimedMining: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  unclaimedMining,
}) => {
  // 5 Primary Navigation Bar Tabs:
  // 1. Mine
  // 2. Upgrade
  // 3. Tasks
  // 4. Squad
  // 5. Wallet
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    {
      id: 'mine',
      label: 'Mine',
      icon: <Pickaxe className="w-5 h-5" />,
      badge: unclaimedMining > 0,
    },
    {
      id: 'upgrade',
      label: 'Upgrade',
      icon: <Zap className="w-5 h-5" />,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <CheckSquare className="w-5 h-5" />,
    },
    {
      id: 'squad',
      label: 'Squad',
      icon: <Users2 className="w-5 h-5" />,
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: <Wallet2 className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 backdrop-blur-xl border-t border-[#1E2638] px-1.5 py-1.5 safe-area-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                haptic.impact('light');
                onChangeTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all ${
                isActive
                  ? 'text-emerald-400 bg-emerald-500/10 font-bold scale-[1.02]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 font-medium'
              }`}
            >
              {/* Badge indicator */}
              {tab.badge && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
              {tab.badge && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
              )}

              <div className={`transition-transform duration-200 ${isActive ? '-translate-y-0.5' : ''}`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 truncate max-w-[54px] ${isActive ? 'text-emerald-400 font-black' : 'text-gray-400 font-medium'}`}>
                {tab.label}
              </span>

              {/* Active Tab Underline Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
