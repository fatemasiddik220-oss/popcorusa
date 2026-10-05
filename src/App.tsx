import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { Header } from './components/Header.js';
import { BottomNav, ActiveTab } from './components/BottomNav.js';
import { TabMine } from './components/TabMine.js';
import { TabUpgrade } from './components/TabUpgrade.js';
import { TabEarn } from './components/TabEarn.js';
import { TabSquad } from './components/TabSquad.js';
import { TabLeaderboard } from './components/TabLeaderboard.js';
import { TabWallet } from './components/TabWallet.js';
import { ChannelJoinModal } from './components/ChannelJoinModal.js';
import { AdminPanel } from './components/AdminPanel.js';
import { api } from './services/api.js';
import { haptic } from './services/haptic.js';
import { adsProvider } from './services/adsProvider.js';
import { isAuthorizedAdmin } from './utils/adminAuth.js';
import {
  User,
  AdminConfig,
  EcosystemTask,
  ReferralUserItem,
  WeeklyPodiumUser,
  GlobalLeaderboardUser,
  WithdrawalRequest,
  SquadCounts,
} from './types.js';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mine');
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [tasks, setTasks] = useState<EcosystemTask[]>([]);
  const [referrals, setReferrals] = useState<ReferralUserItem[]>([]);
  const [squadCounts, setSquadCounts] = useState<SquadCounts | undefined>(undefined);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<WeeklyPodiumUser[]>([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardUser[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  // Native TON Connect UI hook
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();

  // Modals
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const claimAdLoadingRef = useRef(false);

  // Loading & Error
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Open native bottom-sheet TON Connect modal
  const handleOpenWalletModal = useCallback(() => {
    haptic.impact('light');
    tonConnectUI.openModal();
  }, [tonConnectUI]);

  // 1. Initial Telegram WebApp expansion, Referral Parsing & Bootstrapping
  const bootstrapAppData = useCallback(async () => {
    try {
      setLoading(true);
      setInitError(null);

      // Telegram WebApp full screen & expand if running inside Telegram
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        try {
          const tg = window.Telegram.WebApp as any;
          if (
            typeof tg.isVersionAtLeast === 'function' &&
            tg.isVersionAtLeast('8.0') &&
            typeof tg.requestFullscreen === 'function'
          ) {
            tg.requestFullscreen();
          }
        } catch {}
      }

      // Frontend Referral Parsing & Telegram Deep-Link Extraction:
      // On Mini App launch, extract the code via Telegram.WebApp.initDataUnsafe?.start_param or URL query:
      const tgWebApp = (window as any).Telegram?.WebApp;
      let rawInitStartParam: string | null = null;
      if (tgWebApp?.initData && typeof tgWebApp.initData === 'string') {
        try {
          const initSearchParams = new URLSearchParams(tgWebApp.initData);
          rawInitStartParam = initSearchParams.get('start_param') || initSearchParams.get('startapp') || initSearchParams.get('start');
        } catch {}
      }

      const startParam =
        tgWebApp?.initDataUnsafe?.start_param ||
        rawInitStartParam ||
        new URLSearchParams(window.location.search).get('tgWebAppStartParam') ||
        new URLSearchParams(window.location.search).get('startapp') ||
        new URLSearchParams(window.location.search).get('start_param') ||
        new URLSearchParams(window.location.search).get('start') ||
        (typeof window !== 'undefined' && window.location.hash
          ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tgWebAppStartParam') ||
            new URLSearchParams(window.location.hash.replace(/^#/, '')).get('start_param') ||
            new URLSearchParams(window.location.hash.replace(/^#/, '')).get('startapp') ||
            new URLSearchParams(window.location.hash.replace(/^#/, '')).get('start')
          : null);

      // Clean prefix if any (e.g. "ref_A9X72K1M" -> "A9X72K1M")
      let cleanStartParam: string | null = null;
      if (startParam && typeof startParam === 'string' && startParam.trim()) {
        cleanStartParam = startParam.replace(/^ref[_-]/i, '').trim();
      }

      // Store referral code in localStorage immediately upon first launch so it isn't lost
      const REFERRER_STORAGE_KEY = 'pop_referral_code';
      if (cleanStartParam) {
        try {
          localStorage.setItem(REFERRER_STORAGE_KEY, cleanStartParam);
          localStorage.setItem('pop_referrer_id', cleanStartParam);
        } catch (storageErr) {
          console.warn('Unable to persist referral code in localStorage:', storageErr);
        }
      } else {
        try {
          cleanStartParam = localStorage.getItem(REFERRER_STORAGE_KEY) || localStorage.getItem('pop_referrer_id');
        } catch {}
      }

      // Initial user setup API request (/api/user/init) sending start_param (8-character referral code)
      const authData = await api.initUser({
        start_param: cleanStartParam || undefined,
        referrerId: cleanStartParam || undefined,
        startapp: cleanStartParam || undefined,
        start: cleanStartParam || undefined,
      });
      setUser(authData.user);
      setConfig(authData.config);

      if (authData.user) {
        adsProvider.setUserId(authData.user.telegramId || authData.user.id);
        if (authData.user.dailyAdViews !== undefined) {
          adsProvider.syncServerAdViews(authData.user.dailyAdViews, authData.user.lastAdViewDate);
        }
      }

      if (authData.config) {
        adsProvider.configure(authData.config.adProvider, authData.config.adProviderSecret, authData.config.adsDailyCap);
      }

      // Mandatory Onboarding Check:
      // Prompt native wallet bottom-sheet if not connected
      if (!authData.user.tonWalletAddress) {
        // Will prompt via UI
      } else if (!authData.user.hasJoinedChannel) {
        setIsChannelModalOpen(true);
      }

      // 2. Fetch ancillary data in parallel
      const [squadData, ranksData, wdData, taskList] = await Promise.all([
        api.getSquadData(),
        api.getLeaderboards(),
        api.getWithdrawals(),
        api.getTasks(),
      ]);

      setTasks(taskList || []);
      setReferrals(squadData.my_referral_list || squadData.referrals || []);
      setWeeklyLeaderboard(squadData.weeklyLeaderboard || []);
      if (squadData.counts) setSquadCounts(squadData.counts);
      setGlobalLeaderboard(ranksData.globalLeaderboard || []);
      setWithdrawals(wdData || []);
    } catch (err: any) {
      console.error('Failed to load application data:', err);
      setInitError(err.message || 'Failed to connect to POP server.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshSquad = useCallback(async () => {
    try {
      const squadData = await api.getSquadData();
      setReferrals(squadData.my_referral_list || squadData.referrals || []);
      setWeeklyLeaderboard(squadData.weeklyLeaderboard || []);
      if (squadData.counts) setSquadCounts(squadData.counts);
      if (squadData.contestConfig) {
        setUser(prev => {
          if (!prev) return prev;
          const freshUnclaimed = Number(squadData.contestConfig.unclaimedCommission ?? prev.unclaimedSquadPOP ?? 0);
          const freshClaimed = Number(squadData.contestConfig.claimedCommission ?? prev.claimedSquadPOP ?? 0);
          if (freshUnclaimed !== prev.unclaimedSquadPOP || freshClaimed !== prev.claimedSquadPOP) {
            return {
              ...prev,
              unclaimedSquadPOP: freshUnclaimed,
              claimedSquadPOP: freshClaimed,
            };
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('Failed to refresh squad:', e);
    }
  }, []);

  useEffect(() => {
    bootstrapAppData();
  }, [bootstrapAppData]);

  useEffect(() => {
    if (activeTab === 'squad' && user) {
      handleRefreshSquad();
    }
  }, [activeTab, user, handleRefreshSquad]);

  // ------------------------------------------------------------------
  // MULTI-ACCOUNT WALLET CACHE FIX
  // ------------------------------------------------------------------
  // 1. Extract user ID on app startup (window.Telegram.WebApp.initDataUnsafe.user.id).
  // 2. Clear leftover @tonconnect/ui-react storage if connected wallet doesn't match DB.
  // 3. Call tonConnectUI.disconnect() automatically if user has no registered wallet.
  useEffect(() => {
    try {
      const activeTelegramUserId =
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ||
        api.getTelegramId();

      const lastUserKey = 'pop_active_telegram_user_id';
      const prevUserId = localStorage.getItem(lastUserKey);

      if (activeTelegramUserId && prevUserId && prevUserId !== activeTelegramUserId) {
        // Account switch detected across Telegram sessions
        Object.keys(localStorage).forEach((key) => {
          if (key.toLowerCase().includes('ton-connect') || key.toLowerCase().includes('tonconnect')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach((key) => {
          if (key.toLowerCase().includes('ton-connect') || key.toLowerCase().includes('tonconnect')) {
            sessionStorage.removeItem(key);
          }
        });
        if (tonConnectUI.connected) {
          tonConnectUI.disconnect().catch(console.warn);
        }
      }

      if (activeTelegramUserId) {
        localStorage.setItem(lastUserKey, activeTelegramUserId);
      }
    } catch (e) {
      console.warn('Error checking multi-account wallet cache:', e);
    }
  }, [tonConnectUI]);

  // Sync DB user wallet state with TON Connect UI state
  useEffect(() => {
    if (!user) return;

    // Disconnect if user has no registered wallet in DB, but TonConnect reports connected
    if (!user.tonWalletAddress && tonConnectUI.connected) {
      tonConnectUI.disconnect().catch(console.warn);
      Object.keys(localStorage).forEach((key) => {
        if (key.toLowerCase().includes('ton-connect') || key.toLowerCase().includes('tonconnect')) {
          localStorage.removeItem(key);
        }
      });
      return;
    }

    // Disconnect if wallet in TonConnect does not match the active user's DB record
    if (user.tonWalletAddress && tonAddress && user.tonWalletAddress !== tonAddress) {
      tonConnectUI.disconnect().catch(console.warn);
      Object.keys(localStorage).forEach((key) => {
        if (key.toLowerCase().includes('ton-connect') || key.toLowerCase().includes('tonconnect')) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [user, tonAddress, tonConnectUI]);

  // Automatically capture and sync newly connected TON address to user document via API
  useEffect(() => {
    if (tonAddress && user && !user.tonWalletAddress) {
      api.connectWallet(tonAddress)
        .then(async (updatedUser) => {
          setUser(updatedUser);
          try {
            const squadData = await api.getSquadData();
            setReferrals(squadData.referrals || []);
            setWeeklyLeaderboard(squadData.weeklyLeaderboard || []);
          } catch {}
          if (!updatedUser.hasJoinedChannel) {
            setTimeout(() => {
              setIsChannelModalOpen(true);
            }, 350);
          }
        })
        .catch((err) => {
          console.error('Failed to auto-sync connected TON address:', err);
        });
    }
  }, [tonAddress, user]);

  // Real-time Squad List synchronization whenever activeTab becomes 'squad'
  useEffect(() => {
    if (activeTab === 'squad' && user) {
      api.getSquadData()
        .then((squadData) => {
          setReferrals(squadData.my_referral_list || squadData.referrals || []);
          setWeeklyLeaderboard(squadData.weeklyLeaderboard || []);
          if (squadData.counts) setSquadCounts(squadData.counts);
        })
        .catch((err) => console.warn('Failed to refresh squad on tab switch:', err));
    }
  }, [activeTab, user?.id]);

  // 1. Dynamic Startup Ad strictly following Admin Panel configurations (Adsgram & Monetag)
  useEffect(() => {
    if (!user) return;
    const userId = String(user.telegramId || user.id || '').trim();
    if (!userId) return;

    const activeProvider = (config?.adProvider || 'adsgram').toLowerCase();
    // Dynamically retrieve configured delay from Admin Panel without hardcoded fallbacks
    const delayMinutes = activeProvider === 'adsgram'
      ? (config?.adsgramInitialDelayMinutes ?? config?.interstitialAdInitialDelayMinutes ?? 0)
      : (config?.monetagInitialDelayMinutes ?? config?.interstitialAdInitialDelayMinutes ?? 0);

    const startupDailyLimit = activeProvider === 'adsgram'
      ? (config?.adsgramStartupDailyLimit ?? 1)
      : (config?.monetagStartupDailyLimit ?? 1);

    if (startupDailyLimit <= 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `pop_startup_ad_${userId}_${today}`;
    let viewedToday = 0;
    try {
      viewedToday = parseInt(localStorage.getItem(storageKey) || '0', 10) || 0;
    } catch {}

    if (viewedToday >= startupDailyLimit) {
      console.log(`[Ad System] Startup ad daily limit reached (${viewedToday}/${startupDailyLimit}) for today.`);
      return;
    }

    const delayMs = Math.max(1000, Number(delayMinutes) * 60 * 1000);
    const timer = setTimeout(() => {
      console.log(`[Ad System] Triggering startup ad after ${delayMinutes}m delay...`);
      adsProvider.showRewardedAd(
        () => {
          try {
            localStorage.setItem(storageKey, String(viewedToday + 1));
          } catch {}
          console.log('[Ad System] Startup ad completed and recorded.');
        },
        (err) => {
          console.log('[Ad System] Startup ad dismissed or skipped smoothly:', err);
        }
      ).catch(() => {});
    }, delayMs);

    return () => clearTimeout(timer);
  }, [user?.id, user?.telegramId, config?.adProvider, config?.adsgramInitialDelayMinutes, config?.adsgramStartupDailyLimit, config?.monetagInitialDelayMinutes, config?.monetagStartupDailyLimit]);

  // Handlers for App Actions
  // Automatically trigger mining start once a user connects TON Wallet AND joins official Telegram channel
  useEffect(() => {
    if (user && user.tonWalletAddress && user.hasJoinedChannel && !user.hasStartedMining) {
      api.startMining()
        .then((updated) => {
          setUser(updated);
        })
        .catch((err) => {
          console.warn('Auto-start mining error:', err);
        });
    }
  }, [user?.tonWalletAddress, user?.hasJoinedChannel, user?.hasStartedMining]);

  // Dynamic Claim Mining Reward handler:
  // - Fixed 2-hour cooldown is COMPLETELY REMOVED.
  // - Users can tap and claim freely according to the admin panel ad limit.
  // - When ads are available under the daily limit, tapping claim shows the ad.
  // - When the ad limit is exhausted, tapping claim allows claiming without any forced cooldown or error blocking them.
  const handleClaimMining = async () => {
    if (claimAdLoadingRef.current) return;

    const userId = String(user?.telegramId || user?.id || '').trim();
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `pop_claim_ad_limit_${userId}_${today}`;

    // Dynamic claim ad limit from Admin Panel (adsgramClaimDailyLimit / monetagClaimDailyLimit)
    const activeProvider = (config?.adProvider || 'adsgram').toLowerCase();
    const claimDailyLimit = activeProvider === 'adsgram'
      ? (config?.adsgramClaimDailyLimit ?? 1)
      : (config?.monetagClaimDailyLimit ?? 1);

    let claimAdCount = 0;
    try {
      const savedCount = localStorage.getItem(storageKey);
      if (savedCount) {
        claimAdCount = parseInt(savedCount, 10) || 0;
      }
    } catch {
      claimAdCount = 0;
    }

    claimAdLoadingRef.current = true;

    const executeClaim = async () => {
      try {
        const res = await api.claimMining();
        setUser(res.user);
      } catch (err: any) {
        console.warn('Mining claim failed:', err);
        // Do not throw generic blocking alert
      } finally {
        claimAdLoadingRef.current = false;
      }
    };

    // If ad limit is exhausted or disabled (<= 0), claim immediately without showing ad or cooldown
    if (claimDailyLimit <= 0 || claimAdCount >= claimDailyLimit) {
      console.log(`[Claim Reward] Ad limit exhausted (${claimAdCount}/${claimDailyLimit}). Claiming directly without ad.`);
      await executeClaim();
      return;
    }

    // Ads are available based on the limit: show rewarded ad, then claim
    try {
      await adsProvider.showRewardedAd(
        async () => {
          try {
            localStorage.setItem(storageKey, String(claimAdCount + 1));
          } catch (storageErr) {
            console.warn('Unable to persist claim ad count:', storageErr);
          }
          await executeClaim();
        },
        async (err) => {
          console.warn('Reward ad dismissed or unavailable, proceeding to claim:', err);
          // If ad could not be shown/completed, still allow user to claim without blocking them
          await executeClaim();
        }
      );
    } catch (err) {
      console.warn('Ad provider error on claim:', err);
      await executeClaim();
    }
  };

  const handleUpgradeMiner = async (targetLevel: number) => {
    await adsProvider.showRewardedAd(async () => {
      const updated = await api.upgradeMiner(targetLevel);
      setUser(updated);
    });
  };

  const handleUpgradeStorage = async (targetTier: number) => {
    await adsProvider.showRewardedAd(async () => {
      const updated = await api.upgradeStorage(targetTier);
      setUser(updated);
    });
  };

  const handleDailyCheckIn = async () => {
    const res = await api.dailyCheckIn();
    setUser(res.user);
  };

  const handleCompleteTask = async (taskId: string, elapsedSeconds?: number) => {
    const res = await api.completeTask(taskId, elapsedSeconds);
    setUser(res.user);
    try {
      const freshTasks = await api.getTasks();
      setTasks(freshTasks);
    } catch {
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, completed: true } : t)));
    }
  };

  const handleRefreshTasks = async () => {
    const freshTasks = await api.getTasks();
    setTasks(freshTasks);
  };

  const handleClaimSquadCommission = async () => {
    const res = await api.claimSquadCommission();
    setUser(res.user);
  };

  const handleConnectWallet = async (address: string) => {
    const updated = await api.connectWallet(address);
    setUser(updated);
    if (!updated.hasJoinedChannel) {
      setTimeout(() => {
        setIsChannelModalOpen(true);
      }, 350);
    }
  };

  const handleStartMining = async () => {
    const updatedUser = await api.startMining();
    setUser(updatedUser);
  };

  const handleDisconnectWallet = async () => {
    try {
      if (tonConnectUI.connected) {
        await tonConnectUI.disconnect();
      }
    } catch (e) {
      console.warn('TonConnect disconnect error:', e);
    }
    const updated = await api.disconnectWallet();
    setUser(updated);
  };

  const handleSubmitWithdrawal = async (amountPOP: number, tonAddress: string) => {
    const res = await api.requestWithdrawal(amountPOP, tonAddress);
    setUser(res.user);
    setWithdrawals(prev => [res.withdrawal, ...prev]);
  };

  const handleConfigUpdated = (newConfig: AdminConfig) => {
    setConfig(newConfig);
    setTasks(newConfig.tasks || []);
    adsProvider.configure(newConfig.adProvider, newConfig.adProviderSecret, newConfig.adsDailyCap);
  };

  // Loading Screen with Cyberpunk Neon Aesthetic
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#FFE600] to-[#00E5FF] p-1 animate-spin">
            <div className="w-full h-full rounded-full bg-[#0B0E14] flex items-center justify-center text-3xl">
              🍿
            </div>
          </div>
          <div className="absolute inset-0 rounded-full blur-xl bg-[#00E5FF]/20 pointer-events-none" />
        </div>
        <h1 className="text-3xl font-black text-white font-display tracking-tight">POP</h1>
        <p className="text-xs text-[#00E5FF] font-mono-digits mt-1 tracking-wider uppercase">
          Initializing TON High-Yield Mining Node...
        </p>
      </div>
    );
  }

  // Fatal Initial Error Screen with Retry
  if (initError && !user) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-white mb-1 font-display">Connection Error</h2>
        <p className="text-xs text-red-400 mb-4 max-w-xs">{initError}</p>
        <button
          onClick={bootstrapAppData}
          className="py-2.5 px-5 bg-[#FFE600] text-black font-extrabold text-xs rounded-xl font-display uppercase tracking-wider shadow-lg"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!user || !config) return null;

  // Check active user's Telegram ID (window.Telegram.WebApp.initDataUnsafe.user.id)
  // Show Admin Panel strictly if user is 7779827146; completely hidden for regular users
  const isAdmin = isAuthorizedAdmin(user?.telegramId);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col selection:bg-[#00E5FF] selection:text-black">
      
      {/* Sleek Header with POP title, exchange rate pill and admin terminal access (Admin strictly for 7779827146) */}
      <Header
        popUsdRate={config.popUsdRate}
        onOpenAdmin={() => {
          if (!isAdmin) return;
          haptic.impact('medium');
          setIsAdminOpen(true);
        }}
        isAdminActive={isAdminOpen}
        isAdmin={isAdmin}
      />

      {/* Main Content Area Routing 7 Tabs */}
      <main className="flex-1 w-full overflow-y-auto">
        {activeTab === 'mine' && (
          <TabMine
            user={user}
            config={config}
            onClaim={handleClaimMining}
            onNavigateToUpgrade={() => setActiveTab('upgrade')}
            onOpenWalletModal={handleOpenWalletModal}
            onOpenChannelModal={() => setIsChannelModalOpen(true)}
            onStartMining={handleStartMining}
          />
        )}

        {activeTab === 'upgrade' && (
          <TabUpgrade
            user={user}
            config={config}
            onUpgradeMiner={handleUpgradeMiner}
            onUpgradeStorage={handleUpgradeStorage}
          />
        )}

        {activeTab === 'tasks' && (
          <TabEarn
            user={user}
            tasks={tasks}
            config={config}
            onDailyCheckIn={handleDailyCheckIn}
            onCompleteTask={handleCompleteTask}
            onRefreshTasks={handleRefreshTasks}
          />
        )}

        {activeTab === 'squad' && (
          <TabSquad
            user={user}
            config={config}
            referrals={referrals}
            weeklyLeaderboard={weeklyLeaderboard}
            counts={squadCounts}
            onRefreshSquad={handleRefreshSquad}
            onClaimSquadCommission={handleClaimSquadCommission}
            onOpenWalletModal={handleOpenWalletModal}
          />
        )}

        {activeTab === 'leaderboard' && (
          <TabLeaderboard
            leaderboard={globalLeaderboard}
            weeklyLeaderboard={weeklyLeaderboard}
            config={config}
            currentUsername={user.username || 'unknown'}
            currentTelegramId={user.telegramId}
          />
        )}

        {activeTab === 'wallet' && (
          <TabWallet
            user={user}
            config={config}
            withdrawals={withdrawals}
            onOpenWalletModal={handleOpenWalletModal}
            onDisconnectWallet={handleDisconnectWallet}
            onSubmitWithdrawal={handleSubmitWithdrawal}
            onOpenChannelModal={() => setIsChannelModalOpen(true)}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation (7 Tabs) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        unclaimedMining={user.unclaimedMiningPOP}
      />

      {/* Mandatory Telegram Channel Verification Modal */}
      <ChannelJoinModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        channelName={config.mandatoryTelegramChannel || '@PopCornUSA_BOT'}
        channelLink={config.mandatoryChannelLink || 'https://t.me/PopCornUSA_BOT'}
        onVerified={async (updatedUser) => {
          setUser(updatedUser);
          try {
            const squadData = await api.getSquadData();
            setReferrals(squadData.referrals || []);
            setWeeklyLeaderboard(squadData.weeklyLeaderboard || []);
            if (squadData.counts) setSquadCounts(squadData.counts);
          } catch {}
        }}
      />

      {/* Live Web Admin Command Center Protected by Telegram ID & JWT - Strictly rendered ONLY for Admin 7779827146 */}
      {isAdmin && (
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          config={config}
          onConfigUpdated={handleConfigUpdated}
          user={user}
        />
      )}
    </div>
  );
}

export default App;
