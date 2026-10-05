import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Cpu,
  Save,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  DollarSign,
  Zap,
  Box,
  Award,
  AlertTriangle,
  Send,
  BarChart3,
  Gift,
  RefreshCw,
  Search,
  Check,
  TrendingUp,
  Sliders,
  Wallet,
  Tv,
  Radio,
  Play,
  Lock,
  Key,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  Calendar,
  Eye,
  Copy,
  UserCheck,
  UserX,
  Activity,
  Percent,
  ShieldCheck,
  Database,
  Coins,
  Sparkles
} from 'lucide-react';
import {
  AdminConfig,
  WithdrawalRequest,
  User,
  EcosystemTask,
  AdminAnalytics,
  AdminUserListItem,
  AdminStatsResponse,
  TokenSupplyStats,
  WeeklyPodiumUser
} from '../types.js';
import { api } from '../services/api.js';
import { haptic } from '../services/haptic.js';
import { ADMIN_TELEGRAM_ID, isAuthorizedAdmin } from '../utils/adminAuth.js';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: AdminConfig;
  onConfigUpdated: (newConfig: AdminConfig) => void;
  user?: User | null;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
  user,
}) => {
  const isAuthorizedTelegram = isAuthorizedAdmin(user?.telegramId);

  const [adminSecretKey, setAdminSecretKey] = useState(api.getAdminKey() || 'Sujonborsha');
  const [isAuthenticated, setIsAuthenticated] = useState(!!api.getAdminToken());
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeAdminTab, setActiveAdminTab] = useState<
    'dashboard' | 'analytics' | 'supply' | 'users' | 'adNetwork' | 'balance' | 'referrals' | 'mining' | 'storage' | 'tasks' | 'contest' | 'withdrawals' | 'antiCheat' | 'botSupport'
  >('dashboard');
  
  // Local mutable config state
  const [editableConfig, setEditableConfig] = useState<AdminConfig>(JSON.parse(JSON.stringify(config)));
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [statsData, setStatsData] = useState<AdminStatsResponse | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenSupplyStats | null>(null);
  const [monetizeSubTab, setMonetizeSubTab] = useState<'adsgram' | 'monetag' | 'dual'>('adsgram');
  const [weeklyContestLeaderboard, setWeeklyContestLeaderboard] = useState<WeeklyPodiumUser[]>([]);
  const [isContestLoading, setIsContestLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // User Management State (Real-time search, pagination, detailed profile modal)
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(10);
  const [paginatedUsers, setPaginatedUsers] = useState<AdminUserListItem[]>([]);
  const [usersPagination, setUsersPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<AdminUserListItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // MongoDB Atlas status & connection tester state
  const [mongoStatus, setMongoStatus] = useState<{
    isConnected: boolean;
    status: 'connected' | 'connecting' | 'whitelist_required' | 'disconnected';
    error: string | null;
    cluster: string;
    containerIp: string | null;
    activeUri: string;
    database?: string;
  } | null>(null);
  const [mongoTesting, setMongoTesting] = useState(false);
  const [mongoFeedback, setMongoFeedback] = useState<string | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);

  // Format date helper: DD/MM/YYYY
  const formatDateDDMMYYYY = (isoString?: string): string => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'N/A';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return 'N/A';
    }
  };

  const handleCopyText = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      haptic.success();
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Scroll to top when active admin tab changes
  useEffect(() => {
    const el = document.getElementById('admin-content-scroll');
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeAdminTab]);

  // Fetch paginated users
  const fetchUsersList = async (search = usersSearchQuery, page = usersPage) => {
    if (!isAuthorizedTelegram) return;
    try {
      setIsUsersLoading(true);
      const res = await api.getAdminUsers({ q: search, page, limit: usersLimit });
      if (res.success) {
        setPaginatedUsers(res.users || []);
        setUsersPagination(res.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      }
    } catch (err: any) {
      console.error('Failed to fetch admin users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'telegram' | 'youtube' | 'x' | 'announcement'>('telegram');
  const [newTaskReward, setNewTaskReward] = useState('5');
  const [newTaskUrl, setNewTaskUrl] = useState('https://t.me/PopCornUSA_BOT');
  const [newTaskClaimDelaySeconds, setNewTaskClaimDelaySeconds] = useState('0');

  // Edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskCategory, setEditTaskCategory] = useState<'telegram' | 'youtube' | 'x' | 'announcement'>('telegram');
  const [editTaskReward, setEditTaskReward] = useState('5');
  const [editTaskUrl, setEditTaskUrl] = useState('');
  const [editTaskClaimDelaySeconds, setEditTaskClaimDelaySeconds] = useState('0');

  // Balance Management State
  const [selectedUserSearch, setSelectedUserSearch] = useState('');
  const [selectedTargetUser, setSelectedTargetUser] = useState<User | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceMode, setBalanceMode] = useState<'bonus' | 'deduct'>('bonus');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceSuccess, setBalanceSuccess] = useState<string | null>(null);

  // Broadcast Bonus State
  const [broadcastAmount, setBroadcastAmount] = useState('');
  const [broadcastReason, setBroadcastReason] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Withdrawal Filter & Action State
  const [withdrawalFilter, setWithdrawalFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'REJECTED'>('ALL');
  const [withdrawalTxHash, setWithdrawalTxHash] = useState<{ [id: string]: string }>({});

  // Mining Levels Config (50 Levels Dynamic) State
  const [savingLevelId, setSavingLevelId] = useState<number | null>(null);
  const [levelSaveFeedback, setLevelSaveFeedback] = useState<Record<number, string>>({});
  const [adminMiningFilter, setAdminMiningFilter] = useState<'all' | '1-10' | '11-20' | '21-30' | '31-40' | '41-50'>('all');
  const [adminMiningSearch, setAdminMiningSearch] = useState('');
  const [isResettingMiningLevels, setIsResettingMiningLevels] = useState(false);
  const [miningBulkSuccess, setMiningBulkSuccess] = useState(false);

  useEffect(() => {
    setEditableConfig(JSON.parse(JSON.stringify(config)));
  }, [config]);

  const loadAdminData = async () => {
    if (!isAuthorizedTelegram) return;
    try {
      setLoading(true);
      setActionError(null);
      const [overviewData, statsRes, tokenStatsRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminStats().catch(() => null),
        api.getTokenStats().catch(() => null)
      ]);
      setWithdrawals(overviewData.withdrawals || []);
      setUsersList(overviewData.users || []);
      if (overviewData.analytics) {
        setAnalytics(overviewData.analytics);
      }
      if (overviewData.config) {
        setEditableConfig(JSON.parse(JSON.stringify(overviewData.config)));
      }
      if (statsRes) {
        setStatsData(statsRes);
      }
      if (tokenStatsRes) {
        setTokenStats(tokenStatsRes);
      } else if (statsRes?.tokenStats) {
        setTokenStats(statsRes.tokenStats);
      }
      await fetchUsersList(usersSearchQuery, usersPage);
      // Fetch Live Weekly Referral Contest Leaderboard
      fetchWeeklyContestLeaderboard();
      // Fetch MongoDB Atlas Cluster Status
      api.adminGetMongoStatus().then(res => {
        if (res && res.success) setMongoStatus(res);
      }).catch(() => {});
    } catch (err: any) {
      if (err.message?.includes('Unauthorized') || err.message?.includes('expired') || err.message?.includes('token')) {
        api.clearAdminToken();
        setIsAuthenticated(false);
      }
      setActionError(err.message || 'Failed to authenticate admin');
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyContestLeaderboard = async () => {
    try {
      setIsContestLoading(true);
      const res = await api.getWeeklyLeaderboard();
      if (res && res.leaderboard) {
        setWeeklyContestLeaderboard(res.leaderboard);
      }
    } catch (e) {
      console.warn('Failed to fetch contest leaderboard for admin:', e);
    } finally {
      setIsContestLoading(false);
    }
  };

  const handleTestMongo = async () => {
    try {
      setMongoTesting(true);
      setMongoFeedback(null);
      const res = await api.adminReconnectMongo();
      if (res.connected) {
        haptic.success();
        setMongoFeedback('Connected successfully to MongoDB Atlas cluster!');
      } else {
        haptic.error();
        setMongoFeedback(res.message || 'Could not connect. Ensure IP 0.0.0.0/0 is whitelisted in Atlas Network Access.');
      }
      const updated = await api.adminGetMongoStatus();
      if (updated && updated.success) setMongoStatus(updated);
    } catch (err: any) {
      haptic.error();
      setMongoFeedback(err.message || 'Connection test failed');
    } finally {
      setMongoTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthorizedTelegram && isAuthenticated) {
      loadAdminData();
    }
  }, [isOpen, isAuthorizedTelegram, isAuthenticated]);

  // Real-time search debounce for Users tab
  useEffect(() => {
    if (isOpen && isAuthorizedTelegram && isAuthenticated) {
      const timer = setTimeout(() => {
        fetchUsersList(usersSearchQuery, usersPage);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [usersSearchQuery, usersPage, isOpen, isAuthorizedTelegram, isAuthenticated]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthLoading(true);
      setAuthError(null);
      const res = await api.adminLogin(passwordInput, ADMIN_TELEGRAM_ID);
      if (res.success && res.token) {
        setIsAuthenticated(true);
        setPasswordInput('');
        haptic.success();
      } else {
        haptic.error();
        setAuthError(res.error || 'Invalid Admin Secret Key. Access denied.');
      }
    } catch (err: any) {
      haptic.error();
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    api.clearAdminToken();
    setIsAuthenticated(false);
    haptic.impact('medium');
  };

  if (!isOpen) return null;

  // 1. Strict Telegram ID Security Lock - Privacy 403 Screen
  if (!isAuthorizedTelegram) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-md bg-[#121824] border border-[#252D3D] rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-white font-display uppercase tracking-wider">
            403 ACCESS DENIED
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed font-sans">
            You do not have permission to access the administrative dashboard.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#1A2234] hover:bg-[#252D3D] text-white font-bold text-xs rounded-xl font-display uppercase tracking-wider transition-colors"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  // 2. Strict Password Authentication & JWT Gateway
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-md bg-[#0F1420] border-2 border-[#FFE600]/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FFE600]/15 border border-[#FFE600]/30 flex items-center justify-center mx-auto text-[#FFE600]">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white font-display uppercase tracking-wider">
              Admin Security Gateway
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Authorized Telegram Identity Verified</span>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Enter the Admin Secret Key to authorize administrative access and issue a short-lived JWT token:
          </p>

          {authError && (
            <div className="p-2.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl text-xs font-semibold">
              {authError}
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter Admin Secret / Password"
              className="w-full px-4 py-3 bg-[#0B0E14] border border-[#252D3D] focus:border-[#FFE600] rounded-xl text-xs text-white outline-none font-mono tracking-widest text-center"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 bg-[#1A2234] text-gray-400 font-bold text-xs rounded-xl hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={authLoading || !passwordInput}
                className="py-2.5 bg-[#FFE600] hover:bg-[#FFE600]/90 text-black font-extrabold text-xs rounded-xl uppercase tracking-wider font-display transition-all"
              >
                {authLoading ? 'Authenticating...' : 'Unlock Terminal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      setActionError(null);
      haptic.impact('heavy');

      const updated = await api.updateAdminConfig(editableConfig);
      onConfigUpdated(updated);
      haptic.success();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSingleMiningLevel = async (levelNumber: number) => {
    try {
      const tier = editableConfig.minerTiers.find((t) => t.level === levelNumber);
      if (!tier) return;
      setSavingLevelId(levelNumber);
      setLevelSaveFeedback((prev) => ({ ...prev, [levelNumber]: 'Saving...' }));
      haptic.impact('heavy');

      const updated = await api.adminUpdateMiningLevel(adminSecretKey, levelNumber, {
        speedPerHour: tier.speedPerHour,
        pricePOP: tier.pricePOP,
        name: tier.name,
      });

      // Update editable config with returned level
      setEditableConfig((prev) => {
        const next = [...prev.minerTiers];
        const idx = next.findIndex((t) => t.level === levelNumber);
        if (idx >= 0) next[idx] = updated;
        return { ...prev, minerTiers: next };
      });

      haptic.success();
      setLevelSaveFeedback((prev) => ({ ...prev, [levelNumber]: 'Saved to MongoDB!' }));
      setTimeout(() => {
        setLevelSaveFeedback((prev) => {
          const c = { ...prev };
          delete c[levelNumber];
          return c;
        });
      }, 3000);
    } catch (err: any) {
      haptic.error();
      setLevelSaveFeedback((prev) => ({ ...prev, [levelNumber]: `Error: ${err.message || 'Failed'}` }));
    } finally {
      setSavingLevelId(null);
    }
  };

  const handleBulkSaveMiningLevels = async () => {
    try {
      setLoading(true);
      haptic.impact('heavy');
      const saved = await api.adminBulkUpdateMiningLevels(adminSecretKey, editableConfig.minerTiers);
      setEditableConfig((prev) => ({ ...prev, minerTiers: saved }));
      setMiningBulkSuccess(true);
      haptic.success();
      setTimeout(() => setMiningBulkSuccess(false), 3000);
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Bulk save of mining levels failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetMiningLevelsToDefaults = async () => {
    if (!window.confirm('Are you sure you want to reset all 50 mining levels back to standard linear progression defaults (0.20 to 1.99 POP/h, 0 to 1130 POP)? This will save directly to MongoDB.')) {
      return;
    }
    try {
      setIsResettingMiningLevels(true);
      haptic.impact('heavy');
      const resetLevels = await api.adminResetMiningLevels(adminSecretKey);
      setEditableConfig((prev) => ({ ...prev, minerTiers: resetLevels }));
      haptic.success();
      setMiningBulkSuccess(true);
      setTimeout(() => setMiningBulkSuccess(false), 3000);
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Reset failed');
    } finally {
      setIsResettingMiningLevels(false);
    }
  };

  const handleProcessWithdrawal = async (
    withdrawalId: string,
    action: 'approve' | 'reject' | 'paid' | 'completed'
  ) => {
    try {
      setLoading(true);
      haptic.impact('medium');
      const status = action === 'reject' ? 'REJECTED' : 'PAID';
      const txHash = withdrawalTxHash[withdrawalId] || undefined;
      await api.adminProcessWithdrawal(adminSecretKey, {
        withdrawalId,
        status,
        txHash,
        adminNote: `Processed by admin via command center (${action})`,
      });
      haptic.success();
      await loadAdminData();
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserFlag = async (userId: string, currentFlagged: boolean) => {
    try {
      setLoading(true);
      haptic.impact('medium');
      await api.toggleUserFlag(userId, !currentFlagged, currentFlagged ? undefined : 'Flagged manually via Admin Command Center');
      haptic.success();
      await loadAdminData();
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Flag toggle failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySingleBalance = async () => {
    if (!selectedTargetUser) {
      setActionError('Please select a target user first.');
      return;
    }
    const num = parseFloat(balanceAmount);
    if (!num || isNaN(num) || num <= 0) {
      setActionError('Please enter a valid non-zero POP amount.');
      return;
    }
    if (!balanceReason.trim()) {
      setActionError('Mandatory: Please provide a Reason/Note for this balance change.');
      return;
    }

    try {
      setLoading(true);
      setActionError(null);
      haptic.impact('heavy');

      const delta = balanceMode === 'bonus' ? num : -num;
      await api.adminAdjustBalance(adminSecretKey, {
        targetId: selectedTargetUser.id,
        amountPOP: delta,
        reasonNote: balanceReason.trim(),
        isBonusNotification: balanceMode === 'bonus',
      });

      haptic.success();
      setBalanceSuccess(
        `Successfully ${balanceMode === 'bonus' ? 'credited' : 'deducted'} ${num} POP to @${selectedTargetUser.username || selectedTargetUser.telegramId}! Telegram notification dispatched.`
      );
      setBalanceAmount('');
      setBalanceReason('');
      setTimeout(() => setBalanceSuccess(null), 4000);
      await loadAdminData();
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Failed to adjust balance');
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcastBonus = async () => {
    const num = parseFloat(broadcastAmount);
    if (!num || isNaN(num) || num <= 0) {
      setActionError('Please enter a valid broadcast POP amount per user.');
      return;
    }
    if (!broadcastReason.trim()) {
      setActionError('Mandatory: Please provide a Reason/Note for broadcasting this bonus.');
      return;
    }

    if (!window.confirm(`Are you sure you want to broadcast +${num} POP to ALL registered users?`)) {
      return;
    }

    try {
      setLoading(true);
      setActionError(null);
      haptic.impact('heavy');

      const res = await api.adminBroadcastBonus(adminSecretKey, {
        amountPOP: num,
        reasonNote: broadcastReason.trim(),
      });

      haptic.success();
      setBroadcastSuccess(`Broadcast success! Credited ${num} POP to ${res.count} users.`);
      setBroadcastAmount('');
      setBroadcastReason('');
      setTimeout(() => setBroadcastSuccess(null), 4000);
      await loadAdminData();
    } catch (err: any) {
      haptic.error();
      setActionError(err.message || 'Failed to broadcast bonus');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle) return;
    const delaySecs = Math.max(0, parseInt(newTaskClaimDelaySeconds || '0', 10) || 0);
    const newTask: EcosystemTask = {
      id: `task_${Date.now()}`,
      title: newTaskTitle,
      category: newTaskCategory,
      rewardPOP: parseFloat(newTaskReward) || 5,
      url: newTaskUrl,
      claimDelaySeconds: delaySecs,
      claimDelayMinutes: Math.ceil(delaySecs / 60),
      completed: false,
    };

    const updatedConfig = {
      ...editableConfig,
      tasks: [...(editableConfig.tasks || []), newTask],
    };

    setEditableConfig(updatedConfig);
    setNewTaskTitle('');
    setNewTaskClaimDelaySeconds('0');

    // Instant User Task Sync: auto-save immediately to backend so users see it in real-time
    try {
      const saved = await api.updateAdminConfig(updatedConfig);
      onConfigUpdated(saved);
      haptic.success();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to auto-sync new task:', err);
    }
  };

  const handleStartEditTask = (task: EcosystemTask) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskCategory(task.category);
    setEditTaskReward(String(task.rewardPOP));
    setEditTaskUrl(task.url);
    const existingSecs = typeof task.claimDelaySeconds === 'number'
      ? task.claimDelaySeconds
      : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);
    setEditTaskClaimDelaySeconds(String(existingSecs));
  };

  const handleSaveEditedTask = async (taskId: string) => {
    const delaySecs = Math.max(0, parseInt(editTaskClaimDelaySeconds || '0', 10) || 0);
    const updatedTasks = (editableConfig.tasks || []).map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        title: editTaskTitle,
        category: editTaskCategory,
        rewardPOP: parseFloat(editTaskReward) || t.rewardPOP,
        url: editTaskUrl,
        claimDelaySeconds: delaySecs,
        claimDelayMinutes: Math.ceil(delaySecs / 60),
      };
    });

    const updatedConfig = {
      ...editableConfig,
      tasks: updatedTasks,
    };

    setEditableConfig(updatedConfig);
    setEditingTaskId(null);

    // Instant User Task Sync
    try {
      const saved = await api.updateAdminConfig(updatedConfig);
      onConfigUpdated(saved);
      haptic.success();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to auto-sync edited task:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const updatedConfig = {
      ...editableConfig,
      tasks: (editableConfig.tasks || []).filter((t: EcosystemTask) => t.id !== id),
    };

    setEditableConfig(updatedConfig);

    // Instant User Task Sync
    try {
      const saved = await api.updateAdminConfig(updatedConfig);
      onConfigUpdated(saved);
      haptic.impact('medium');
    } catch (err: any) {
      console.error('Failed to auto-sync task deletion:', err);
    }
  };

  const filteredUsers = usersList.filter(u =>
    u.username?.toLowerCase().includes(selectedUserSearch.toLowerCase()) ||
    u.telegramId.includes(selectedUserSearch) ||
    u.firstName?.toLowerCase().includes(selectedUserSearch.toLowerCase())
  );

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');
  const filteredWithdrawals = withdrawals.filter(w => {
    if (withdrawalFilter === 'ALL') return true;
    return w.status === withdrawalFilter;
  });

  const effectiveMaxSupply = tokenStats?.maxSupply ?? statsData?.maxTotalSupply ?? config.maxTotalSupply ?? 10000000;
  const effectiveDistributed = tokenStats?.totalDistributed ?? statsData?.totalDistributed ?? config.totalDistributed ?? 
    (usersList.reduce((acc, u) => acc + (u.balancePOP || 0), 0) + withdrawals.filter(w => w.status !== 'REJECTED').reduce((acc, w) => acc + (w.amountPOP || 0), 0));
  const effectiveRemaining = tokenStats?.remainingSupply ?? statsData?.remainingSupply ?? Math.max(0, effectiveMaxSupply - effectiveDistributed);
  const effectivePercent = effectiveMaxSupply > 0 ? Math.min(100, Math.max(0, (effectiveDistributed / effectiveMaxSupply) * 100)) : 0;
  const effectiveIsCapReached = effectiveRemaining <= 0 || Boolean(tokenStats?.isCapReached ?? statsData?.isCapReached ?? config.isCapReached);

  const adminNavItems = [
    {
      id: 'supply',
      title: '10,000,000 POP Supply Cap & Circulation',
      shortTitle: 'Supply Cap (10M)',
      description: 'Strict 10M token distribution cap, claimed coins & remaining balance',
      badge: `${effectiveRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} POP Left`,
      badgeClass: effectiveIsCapReached ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: <Coins className="w-6 h-6 text-amber-400" />,
      cardGradient: 'from-amber-950/40 via-[#121824] to-[#0E131F] border-amber-500/30 hover:border-amber-400',
    },
    {
      id: 'analytics',
      title: 'Analytics & KPIs',
      shortTitle: 'Analytics',
      description: 'Live protocol KPIs, active miners & token velocity',
      badge: `${statsData?.totalUsers ?? usersList.length} Users`,
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      icon: <BarChart3 className="w-6 h-6 text-blue-400" />,
      cardGradient: 'from-blue-950/40 via-[#121824] to-[#0E131F] border-blue-500/30 hover:border-blue-400',
    },
    {
      id: 'users',
      title: 'User Management',
      shortTitle: 'Users',
      description: 'Inspect accounts, flags, balances & TON addresses',
      badge: `${usersList.length} Accounts`,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: <Users className="w-6 h-6 text-emerald-400" />,
      cardGradient: 'from-emerald-950/40 via-[#121824] to-[#0E131F] border-emerald-500/30 hover:border-emerald-400',
    },
    {
      id: 'withdrawals',
      title: 'Withdrawal Requests',
      shortTitle: 'Withdrawals',
      description: 'Review requests, verify TON hashes & process payouts',
      badge: pendingWithdrawals.length > 0 ? `${pendingWithdrawals.length} Pending` : '0 Pending',
      badgeClass: pendingWithdrawals.length > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' : 'bg-gray-800/40 text-gray-400 border-gray-700/40',
      icon: <Clock className="w-6 h-6 text-amber-400" />,
      cardGradient: pendingWithdrawals.length > 0
        ? 'from-amber-950/50 via-[#121824] to-[#0E131F] border-amber-500/50 hover:border-amber-400 shadow-amber-500/5'
        : 'from-amber-950/30 via-[#121824] to-[#0E131F] border-amber-500/30 hover:border-amber-400',
    },
    {
      id: 'balance',
      title: 'Balance & Broadcasting',
      shortTitle: 'Balance & Bonus',
      description: 'Manual token balance adjustments & broadcast bonuses',
      badge: 'Live Credit',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: <Gift className="w-6 h-6 text-purple-400" />,
      cardGradient: 'from-purple-950/40 via-[#121824] to-[#0E131F] border-purple-500/30 hover:border-purple-400',
    },
    {
      id: 'tasks',
      title: 'Tasks & Quests',
      shortTitle: 'Tasks',
      description: 'Ecosystem partner tasks, rewards & link verification',
      badge: `${editableConfig.tasks?.length || 0} Tasks`,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: <Award className="w-6 h-6 text-rose-400" />,
      cardGradient: 'from-rose-950/40 via-[#121824] to-[#0E131F] border-rose-500/30 hover:border-rose-400',
    },
    {
      id: 'botSupport',
      title: 'System Settings',
      shortTitle: 'System Settings',
      description: 'Min/max limits, POP price, fee % & support desk',
      badge: `${editableConfig.withdrawalFeePercent}% Fee`,
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      icon: <Sliders className="w-6 h-6 text-cyan-400" />,
      cardGradient: 'from-cyan-950/40 via-[#121824] to-[#0E131F] border-cyan-500/30 hover:border-cyan-400',
    },
    {
      id: 'adNetwork',
      title: 'Monetize & Ad Networks',
      shortTitle: 'Monetize',
      description: 'Dynamic Adsgram & Monitag settings, delay timers & daily frequency control',
      badge: (editableConfig.adProvider || 'adsgram').toUpperCase(),
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      icon: <Tv className="w-6 h-6 text-sky-400" />,
      cardGradient: 'from-sky-950/40 via-[#121824] to-[#0E131F] border-sky-500/30 hover:border-sky-400',
    },
    {
      id: 'mining',
      title: 'Mining Levels Config',
      shortTitle: 'Mining Levels (50 Lvl)',
      description: 'Dynamic mining speed rates (POP/h), upgrade costs & MongoDB sync',
      badge: `${editableConfig.minerTiers?.length || 50} Levels`,
      badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      cardGradient: 'from-yellow-950/40 via-[#121824] to-[#0E131F] border-yellow-500/30 hover:border-yellow-400',
    },
    {
      id: 'storage',
      title: 'Storage Matrix',
      shortTitle: 'Storage Tiers',
      description: 'Storage capacity volumes, max offline hours & tier costs',
      badge: `${editableConfig.storageTiers?.length || 0} Tiers`,
      badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      icon: <Box className="w-6 h-6 text-teal-400" />,
      cardGradient: 'from-teal-950/40 via-[#121824] to-[#0E131F] border-teal-500/30 hover:border-teal-400',
    },
    {
      id: 'contest',
      title: 'Weekly Contest',
      shortTitle: 'Contest & Prizes',
      description: 'Leaderboard threshold & USDT prizes for top miners',
      badge: `$${((editableConfig.weeklyPrizesUsdt?.first || 1) + (editableConfig.weeklyPrizesUsdt?.second || 0.6) + (editableConfig.weeklyPrizesUsdt?.third || 0.3)).toFixed(2)} USDT`,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: <DollarSign className="w-6 h-6 text-emerald-400" />,
      cardGradient: 'from-emerald-950/40 via-[#121824] to-[#0E131F] border-emerald-500/30 hover:border-emerald-400',
    },
    {
      id: 'referrals',
      title: 'Referral Engine',
      shortTitle: 'Referrals',
      description: 'Direct invitation bonuses & squad passive commissions',
      badge: `${editableConfig.referralCommissionPercent}% Squad`,
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      icon: <TrendingUp className="w-6 h-6 text-indigo-400" />,
      cardGradient: 'from-indigo-950/40 via-[#121824] to-[#0E131F] border-indigo-500/30 hover:border-indigo-400',
    },
    {
      id: 'antiCheat',
      title: 'Anti-Cheat & Security',
      shortTitle: 'Anti-Cheat',
      description: 'Duplicate IP detection, device fingerprinting & bot bans',
      badge: `${usersList.filter(u => u.isFlagged).length} Flagged`,
      badgeClass: usersList.filter(u => u.isFlagged).length > 0 ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-gray-800/40 text-gray-400 border-gray-700/40',
      icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
      cardGradient: 'from-red-950/40 via-[#121824] to-[#0E131F] border-red-500/30 hover:border-red-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-[#0F1420] border-2 border-[#252D3D] rounded-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Admin Header */}
        <div className="p-4 bg-gradient-to-r from-red-950/40 via-[#121824] to-[#0F1420] border-b border-[#1E2638] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase font-display tracking-wider">
                  POP Admin Command Center
                </h2>
                <span className="text-[10px] bg-red-600 text-white font-black px-1.5 py-0.2 rounded uppercase">LIVE</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> TG 7779827146 • JWT
                </span>
              </div>
              <span className="text-[11px] text-gray-400">Real-time analytics, balance management & dynamic configuration</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                haptic.selection();
                setActiveAdminTab('dashboard');
              }}
              title="Return to Main Dashboard Grid"
              className={`p-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all ${
                activeAdminTab === 'dashboard'
                  ? 'bg-[#FFE600] text-black border-[#FFE600] font-bold shadow-md shadow-amber-500/20'
                  : 'bg-[#1A2234] hover:bg-[#252D3D] text-gray-300 border-[#252D3D]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={loadAdminData}
              disabled={loading}
              title="Refresh Data"
              className="p-1.5 bg-[#1A2234] hover:bg-[#252D3D] text-gray-300 rounded-xl border border-[#252D3D]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all font-display uppercase"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveSuccess ? 'Saved!' : 'Save Config'}</span>
            </button>
            <button
              onClick={handleAdminLogout}
              title="Lock Admin Terminal (Logout)"
              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-red-300 rounded-xl flex items-center gap-1 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Global Alerts */}
        {actionError && (
          <div className="m-3 p-2.5 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {balanceSuccess && (
          <div className="m-3 p-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{balanceSuccess}</span>
          </div>
        )}
        {broadcastSuccess && (
          <div className="m-3 p-2.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs flex items-center gap-2">
            <Send className="w-4 h-4 shrink-0" />
            <span>{broadcastSuccess}</span>
          </div>
        )}

        {/* Section Navigation Header (Visible when in a specific section) */}
        {activeAdminTab !== 'dashboard' && (
          <div className="flex items-center justify-between px-3 py-2 bg-[#0B0E14] border-b border-[#1E2638] text-xs gap-2">
            <button
              onClick={() => {
                haptic.impact('light');
                setActiveAdminTab('dashboard');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A2234] hover:bg-[#252D3D] text-white font-bold border border-[#2A344A] transition-all active:scale-[0.97] shadow-sm shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#FFE600]" />
              <span>← Back to Dashboard</span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {adminNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    haptic.selection();
                    setActiveAdminTab(item.id as any);
                  }}
                  className={`px-2.5 py-1 rounded-xl whitespace-nowrap text-[11px] font-semibold transition-all shrink-0 ${
                    activeAdminTab === item.id
                      ? 'bg-red-600/20 text-red-400 border border-red-500/40 font-bold'
                      : 'text-gray-400 hover:text-white hover:bg-[#121824]'
                  }`}
                >
                  {item.shortTitle}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div id="admin-content-scroll" className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 0: MAIN DASHBOARD 2-COLUMN NAVIGATION GRID */}
          {activeAdminTab === 'dashboard' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Quick Protocol Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Miners</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black font-mono-digits text-white">{statsData?.totalUsers ?? usersList.length}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">● Active</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Withdrawals</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black font-mono-digits text-amber-400">{pendingWithdrawals.length}</span>
                    <span className="text-[10px] text-gray-400 font-medium">Pending</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mined POP</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black font-mono-digits text-[#FFE600] truncate">
                      {statsData?.totalMined ? Math.floor(statsData.totalMined).toLocaleString() : '0'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono-digits">POP</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638] flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ad Network</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-sky-400 uppercase">
                      {editableConfig.adProvider || 'Adsgram'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">Live</span>
                  </div>
                </div>
              </div>

              {/* 10,000,000 POP STRICT SUPPLY CAP & CIRCULATION REAL-TIME DASHBOARD CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#121824] via-[#0E131F] to-[#161D2B] border border-amber-500/40 shadow-xl shadow-amber-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#1E2638] relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider font-display">
                          POP Token Supply Cap & Circulation
                        </h4>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          effectiveIsCapReached
                            ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {effectiveIsCapReached ? '● 10M CAP REACHED (MINTING LOCKED)' : '● POOL ACTIVE (10M HARD CAP)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Strict 10,000,000 POP maximum distribution pool across mining, referrals, quests & bonuses.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        haptic.impact('light');
                        loadAdminData();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#0B0E14] border border-[#252D3D] text-[11px] text-gray-300 hover:text-white flex items-center gap-1.5 font-bold transition-all hover:bg-[#1A2234]"
                      title="Refresh real-time token statistics"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-gray-400'}`} />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => {
                        haptic.impact('medium');
                        setActiveAdminTab('supply');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold transition-all flex items-center gap-1 shadow-md shadow-amber-500/10"
                    >
                      <span>Full Breakdown</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Primary Real-Time Metric Display: Claimed vs Remaining vs Max Cap */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5 relative z-10">
                  {/* Claimed / Circulated POP */}
                  <div className="p-3.5 rounded-xl bg-[#0B0E14]/80 border border-[#1E2638] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                      <span className="font-bold uppercase tracking-wider text-amber-400">Claimed & Circulated</span>
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono-digits tracking-tight drop-shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                      {effectiveDistributed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-gray-400 font-mono-digits">
                        ≈ ${((effectiveDistributed) * (config.popUsdRate || 0.001)).toFixed(2)} USD
                      </span>
                      <span className="text-amber-400 font-bold font-mono-digits">
                        {effectivePercent.toFixed(2)}% of cap
                      </span>
                    </div>
                  </div>

                  {/* Remaining Unclaimed Supply */}
                  <div className="p-3.5 rounded-xl bg-[#0B0E14]/80 border border-[#1E2638] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                      <span className="font-bold uppercase tracking-wider text-emerald-400">Remaining in Pool</span>
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-digits tracking-tight drop-shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                      {effectiveRemaining.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-gray-400 font-mono-digits">
                        ≈ ${((effectiveRemaining) * (config.popUsdRate || 0.001)).toFixed(2)} USD
                      </span>
                      <span className="text-emerald-400 font-bold font-mono-digits">
                        {(100 - effectivePercent).toFixed(2)}% left
                      </span>
                    </div>
                  </div>

                  {/* Max Hard Supply Cap */}
                  <div className="p-3.5 rounded-xl bg-[#0B0E14]/80 border border-[#1E2638] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                      <span className="font-bold uppercase tracking-wider text-blue-400">Total Hard Cap</span>
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-mono-digits tracking-tight">
                      {effectiveMaxSupply.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-gray-400 font-mono-digits">POP Tokens</span>
                      <span className="text-blue-400 font-bold font-mono-digits">10M Limit</span>
                    </div>
                  </div>
                </div>

                {/* Live Real-time Distribution Progress Bar */}
                <div className="mt-3.5 pt-3 border-t border-[#1E2638] relative z-10">
                  <div className="flex items-center justify-between text-[11px] mb-1.5 font-mono">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <span>Distribution Progress:</span>
                      <strong className="text-amber-400 font-bold">{effectivePercent.toFixed(2)}% Claimed</strong>
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {effectiveRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} POP Available
                    </span>
                  </div>
                  <div className="w-full h-3 bg-[#0B0E14] rounded-full overflow-hidden border border-[#252D3D] p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        effectiveIsCapReached
                          ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-500'
                          : 'bg-gradient-to-r from-amber-500 via-[#FFE600] to-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, effectivePercent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-1">
                    <span>0 POP (Genesis)</span>
                    <span>2.5M (25%)</span>
                    <span>5.0M (50%)</span>
                    <span>7.5M (75%)</span>
                    <span className="text-amber-400 font-bold">10M POP (Hard Cap)</span>
                  </div>
                </div>
              </div>

              {/* MongoDB Atlas Database Cluster Health & IP Whitelist Banner */}
              <div className={`p-4 rounded-2xl border transition-all ${
                mongoStatus?.isConnected
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-amber-950/25 border-amber-500/40'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      mongoStatus?.isConnected
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">
                          MongoDB Atlas Database Cluster
                        </h4>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          mongoStatus?.isConnected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {mongoStatus?.isConnected ? '● CONNECTED' : '⚠ IP WHITELIST PENDING'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                        {mongoStatus?.isConnected
                          ? `Real-time synchronization active for Users, Referral Logs, and System Settings on cluster0.7ng5wwb.mongodb.net/${mongoStatus?.database || 'PopcornUS'}.`
                          : 'Fail-safe local persistence is active. To enable live MongoDB Atlas cloud sync, ensure 0.0.0.0/0 is whitelisted in your Atlas Network Access.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleTestMongo}
                      disabled={mongoTesting}
                      className="px-3 py-1.5 bg-[#1A2234] hover:bg-[#252D3D] text-white border border-[#2A344A] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.97]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#FFE600] ${mongoTesting ? 'animate-spin' : ''}`} />
                      <span>{mongoTesting ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                    <a
                      href="https://cloud.mongodb.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#FFE600] hover:bg-amber-400 text-black rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      <span>Atlas Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {mongoFeedback && (
                  <div className={`mt-3 p-2 rounded-xl text-xs flex items-center gap-2 border ${
                    mongoFeedback.includes('successfully')
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{mongoFeedback}</span>
                  </div>
                )}

                {/* Whitelist step-by-step guidance when disconnected */}
                {!mongoStatus?.isConnected && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 text-[11px] text-gray-300 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <span>How to whitelist your container IP:</span>
                      </span>
                      {mongoStatus?.containerIp && (
                        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-lg border border-amber-500/30">
                          <span className="text-gray-400 text-[10px]">Cloud Container IP:</span>
                          <span className="font-mono text-amber-300 font-bold">{mongoStatus.containerIp}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(mongoStatus.containerIp || '');
                              setCopiedIp(true);
                              haptic.success();
                              setTimeout(() => setCopiedIp(false), 2000);
                            }}
                            className="text-gray-400 hover:text-white ml-1"
                          >
                            {copiedIp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400">
                      <li>Log in to <strong className="text-white">cloud.mongodb.com</strong> and select your project.</li>
                      <li>In the left sidebar, click <strong className="text-white">Security → Network Access</strong>.</li>
                      <li>Click <strong className="text-[#FFE600]">+ Add IP Address</strong>.</li>
                      <li>Click <strong className="text-white">"Allow Access from Anywhere"</strong> (adds <code className="bg-black/50 text-amber-300 px-1 rounded">0.0.0.0/0</code>) or enter your container IP above.</li>
                      <li>Click <strong className="text-white">Confirm</strong>. Once active (approx. 30s), tap <strong className="text-white">"Test Connection"</strong> above.</li>
                    </ol>
                    <div className="text-[10px] text-emerald-400/90 font-medium pt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>Zero data loss: All user balances, miners, and referral logs are securely cached locally and will auto-upload as soon as Atlas connects.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dashboard Section Heading */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-[#FFE600]" />
                    <span>Admin Operations Matrix</span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Tap any module below to open its dedicated management center
                  </p>
                </div>
                <span className="text-[10px] font-mono-digits bg-[#121824] border border-[#252D3D] text-gray-300 px-2 py-0.5 rounded-full font-bold">
                  {adminNavItems.length} Modules
                </span>
              </div>

              {/* 2-COLUMN NAVIGATION GRID */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {adminNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      haptic.impact('medium');
                      setActiveAdminTab(item.id as any);
                    }}
                    className={`group relative text-left p-3.5 sm:p-4 rounded-2xl border bg-gradient-to-b ${item.cardGradient} transition-all duration-200 active:scale-[0.97] hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between min-h-[140px] sm:min-h-[155px] cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors shrink-0">
                        {item.icon}
                      </div>
                      <span className={`text-[10px] font-mono-digits font-bold px-2 py-0.5 rounded-full border shrink-0 ${item.badgeClass}`}>
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-white group-hover:text-[#FFE600] transition-colors leading-snug flex items-center justify-between">
                        <span>{item.title}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#FFE600] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Action: Pending Withdrawals Alert Card */}
              {pendingWithdrawals.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-900/15 to-[#121824] border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>Action Required: {pendingWithdrawals.length} Pending Withdrawal{pendingWithdrawals.length > 1 ? 's' : ''}</span>
                      </h4>
                      <p className="text-[11px] text-gray-300">
                        Miners are waiting for payout approval and TON blockchain distribution.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      haptic.impact('medium');
                      setActiveAdminTab('withdrawals');
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-[#FFE600] text-black font-extrabold text-xs rounded-xl shadow-md hover:brightness-110 active:scale-[0.97] transition-all flex items-center gap-1.5 uppercase font-display shrink-0"
                  >
                    <span>Review Payouts</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* TAB 0.5: 10,000,000 POP TOTAL SUPPLY CAP & CIRCULATION COMMAND CENTER */}
          {activeAdminTab === 'supply' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Header with Navigation and Refresh */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121824] p-4 rounded-2xl border border-[#252D3D]">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      haptic.impact('light');
                      setActiveAdminTab('dashboard');
                    }}
                    className="p-2 rounded-xl bg-[#0B0E14] border border-[#252D3D] text-gray-300 hover:text-white transition-all hover:bg-[#1A2234]"
                    title="Back to Dashboard"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider font-display flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>10,000,000 POP Total Supply Protocol</span>
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Real-time supply cap audit, circulating tokens & remaining pool reserve
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                    effectiveIsCapReached
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {effectiveIsCapReached ? '● 10M CAP REACHED (MINTING LOCKED)' : '● POOL ACTIVE (10M HARD CAP)'}
                  </span>
                  <button
                    onClick={() => {
                      haptic.impact('light');
                      loadAdminData();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#252D3D] text-[11px] text-gray-300 hover:text-white flex items-center gap-1.5 font-bold transition-all hover:bg-[#1A2234]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-gray-400'}`} />
                    <span>Refresh Data</span>
                  </button>
                </div>
              </div>

              {/* Main Token Supply Statistics KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Metric 1: Claimed & Circulated Tokens */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-[#121824] to-[#0E131F] border border-amber-500/40 shadow-lg relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                    <span className="font-bold uppercase tracking-wider text-amber-400">Claimed & Circulated</span>
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono-digits tracking-tight drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                    {effectiveDistributed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-amber-400/90 font-mono-digits mt-1 flex items-center justify-between">
                    <span>≈ ${((effectiveDistributed) * (config.popUsdRate || 0.001)).toFixed(2)} USD</span>
                    <span className="font-bold">{effectivePercent.toFixed(2)}% of Cap</span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-2 block">
                    All tokens minted across mining, quests, referrals & bonuses
                  </span>
                </div>

                {/* Metric 2: Remaining Supply in Pool */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-[#121824] to-[#0E131F] border border-emerald-500/40 shadow-lg relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                    <span className="font-bold uppercase tracking-wider text-emerald-400">Remaining in Pool</span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono-digits tracking-tight drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                    {effectiveRemaining.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-emerald-400/90 font-mono-digits mt-1 flex items-center justify-between">
                    <span>≈ ${((effectiveRemaining) * (config.popUsdRate || 0.001)).toFixed(2)} USD</span>
                    <span className="font-bold">{(100 - effectivePercent).toFixed(2)}% Available</span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-2 block">
                    Unclaimed tokens remaining before hard supply cutoff
                  </span>
                </div>

                {/* Metric 3: Strict Total Supply Cap */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/30 via-[#121824] to-[#0E131F] border border-blue-500/40 shadow-lg relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                    <span className="font-bold uppercase tracking-wider text-blue-400">Total Hard Cap</span>
                    <Lock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono-digits tracking-tight">
                    {effectiveMaxSupply.toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-400/90 font-mono-digits mt-1 flex items-center justify-between">
                    <span>POP Tokens</span>
                    <span className="font-bold">100.00% Maximum</span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-2 block">
                    Strict mathematical ceiling: zero inflation permitted
                  </span>
                </div>
              </div>

              {/* Real-Time Progress Bar & Milestones */}
              <div className="p-5 rounded-2xl bg-[#121824] border border-[#252D3D] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-300 font-bold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>10,000,000 POP Distribution Barometer</span>
                  </span>
                  <span className="text-amber-400 font-bold">
                    {effectiveDistributed.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {effectiveMaxSupply.toLocaleString()} POP ({effectivePercent.toFixed(2)}%)
                  </span>
                </div>

                <div className="w-full h-4 bg-[#0B0E14] rounded-full overflow-hidden border border-[#1E2638] p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      effectiveIsCapReached
                        ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-500'
                        : 'bg-gradient-to-r from-amber-500 via-[#FFE600] to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, effectivePercent))}%` }}
                  />
                </div>

                <div className="grid grid-cols-5 text-center text-[10px] text-gray-500 font-mono pt-1">
                  <div>
                    <span className="block text-gray-400 font-bold">0 POP</span>
                    <span>Genesis</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-bold">2.5M POP</span>
                    <span>25% Pool</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-bold">5.0M POP</span>
                    <span>50% Halving</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-bold">7.5M POP</span>
                    <span>75% Pool</span>
                  </div>
                  <div>
                    <span className="block text-amber-400 font-bold">10M POP</span>
                    <span>Hard Limit</span>
                  </div>
                </div>
              </div>

              {/* Token Breakdown: Balances vs Withdrawn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                      Circulating in User Wallets
                    </span>
                    <div className="text-xl font-black text-emerald-400 font-mono-digits mt-1">
                      {(tokenStats?.totalCirculating ?? statsData?.totalCirculating ?? usersList.reduce((acc, u) => acc + (u.balancePOP || 0), 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} POP
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono-digits">
                      Active balances held by registered users in app
                    </span>
                  </div>
                  <Wallet className="w-8 h-8 text-emerald-400/50" />
                </div>

                <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                      Claimed & Withdrawn to TON
                    </span>
                    <div className="text-xl font-black text-blue-400 font-mono-digits mt-1">
                      {(tokenStats?.totalWithdrawn ?? withdrawals.filter(w => w.status !== 'REJECTED').reduce((acc, w) => acc + (w.amountPOP || 0), 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} POP
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono-digits">
                      Tokens successfully paid out or pending TON transfer
                    </span>
                  </div>
                  <ExternalLink className="w-8 h-8 text-blue-400/50" />
                </div>
              </div>

              {/* Distribution Channels: All 5 Sources Contributing to 10M Cap */}
              <div className="p-5 rounded-2xl bg-[#121824] border border-[#252D3D] space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider font-display flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Token Distribution Channels Contributing to 10,000,000 Cap</span>
                </h4>
                <p className="text-[11px] text-gray-400">
                  Every distribution channel strictly draws from the same authoritative 10,000,000 POP supply pool.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {/* Channel 1 */}
                  <div className="p-3 bg-[#0B0E14] rounded-xl border border-[#1E2638] flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">1. Mining Engine Claims</h5>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Hourly mining accrual based on 50 rig fleet tiers. Users claim accrued POP after connecting TON wallet and joining official Telegram channel.
                      </p>
                      <span className="text-[10px] text-yellow-400 font-mono font-bold mt-1 block">
                        Lifetime Mined: {(statsData?.totalMined ?? analytics?.totalMinedPOP ?? 0).toLocaleString()} POP
                      </span>
                    </div>
                  </div>

                  {/* Channel 2 */}
                  <div className="p-3 bg-[#0B0E14] rounded-xl border border-[#1E2638] flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">2. Squad & Referral Network</h5>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Single dynamic referral bonus upon referee qualification + passive lifetime mining commission (e.g. 10%–15%) on all mining claims.
                      </p>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold mt-1 block">
                        Qualified Invites: {statsData?.totalQualifiedReferrals ?? analytics?.totalQualifiedReferrals ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Channel 3 */}
                  <div className="p-3 bg-[#0B0E14] rounded-xl border border-[#1E2638] flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">3. Ecosystem Tasks & Quests</h5>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Partner channel follows, video views, and sponsored promotional quests with strict verification cooldown timers.
                      </p>
                      <span className="text-[10px] text-rose-400 font-mono font-bold mt-1 block">
                        Active Quests: {editableConfig.tasks?.length || 0} tasks configured
                      </span>
                    </div>
                  </div>

                  {/* Channel 4 */}
                  <div className="p-3 bg-[#0B0E14] rounded-xl border border-[#1E2638] flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">4. Daily Check-in Streaks</h5>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Ascending 7-day streak rewards (+5 to +15 POP). Users must maintain uninterrupted daily logins to claim rewards.
                      </p>
                      <span className="text-[10px] text-teal-400 font-mono font-bold mt-1 block">
                        Cycle Scale: 5, 6, 7, 8, 10, 12, 15 POP
                      </span>
                    </div>
                  </div>

                  {/* Channel 5 */}
                  <div className="p-3 bg-[#0B0E14] rounded-xl border border-[#1E2638] flex items-start gap-3 sm:col-span-2">
                    <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">5. Admin Manual Credits & Broadcast Bonuses</h5>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Direct administrative bonus credits and universal community broadcasts. Each operation is strictly checked against the remaining 10,000,000 POP supply reserve.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protocol Enforcement Notice Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                effectiveIsCapReached
                  ? 'bg-red-950/20 border-red-500/40 text-red-200'
                  : 'bg-emerald-950/15 border-emerald-500/30 text-emerald-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    effectiveIsCapReached ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {effectiveIsCapReached ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-white">
                      Strict Hard Cap Protocol Enforcement Rules
                    </h5>
                    <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                      • When the circulating supply reaches exactly <strong>10,000,000 POP</strong>, the server automatically rejects any further claims with code <code className="text-amber-300 bg-[#0B0E14] px-1 py-0.5 rounded">TOTAL_SUPPLY_CAP_REACHED</code>.<br />
                      • If an earned reward exceeds the remaining pool balance, the user is awarded only the remaining balance and the cap is closed.<br />
                      • Users cannot bypass the limit through client-side manipulation, as all distribution calculations are server-authoritative.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* TAB 1: LIVE ANALYTICS DASHBOARD */}
          {activeAdminTab === 'analytics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Protocol KPI & Live Metrics</h3>
                  <span className="text-[11px] text-gray-400">Real-time metrics computed directly from database documents</span>
                </div>
                <button
                  onClick={loadAdminData}
                  className="px-2.5 py-1 rounded-lg bg-[#121824] border border-[#252D3D] text-[10px] text-gray-300 flex items-center gap-1 hover:text-white"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {/* Top 4 Metric KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                {/* Metric 1: Total Registered Users */}
                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                    <span className="font-bold uppercase">Total Users</span>
                    <Users className="w-3.5 h-3.5 text-[#00E5FF]" />
                  </div>
                  <div className="text-xl font-black text-white font-mono-digits">
                    {statsData?.totalUsers ?? analytics?.totalUsers ?? usersList.length}
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-0.5 mt-0.5 font-semibold">
                    <TrendingUp className="w-2.5 h-2.5" /> Live accounts
                  </div>
                </div>

                {/* Metric 2: Active Miners (Wallet + Channel + Mining) */}
                <div className="p-3 bg-[#121824] border border-[#FFE600]/30 bg-gradient-to-br from-[#FFE600]/5 to-transparent rounded-2xl">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                    <span className="font-bold uppercase text-[#FFE600]">Active Miners</span>
                    <Zap className="w-3.5 h-3.5 text-[#FFE600]" />
                  </div>
                  <div className="text-xl font-black text-[#FFE600] font-mono-digits">
                    {statsData?.activeMiners ?? analytics?.activeMiners ?? 0}
                  </div>
                  <div className="text-[10px] text-amber-300/80 mt-0.5 font-medium truncate">
                    Wallet + Channel + Mining
                  </div>
                </div>

                {/* Metric 3: Lifetime Mined $POP */}
                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                    <span className="font-bold uppercase">Lifetime Mined</span>
                    <Award className="w-3.5 h-3.5 text-[#FFE600]" />
                  </div>
                  <div className="text-xl font-black text-[#FFE600] font-mono-digits">
                    {(statsData?.totalMined ?? analytics?.totalMinedPOP ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono-digits mt-0.5">
                    $POP produced
                  </div>
                </div>

                {/* Metric 4: Total Withdrawals */}
                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                    <span className="font-bold uppercase">Withdrawals</span>
                    <Clock className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <div className="text-xl font-black text-red-400 font-mono-digits">
                    {statsData?.totalWithdrawals ?? withdrawals.length}
                  </div>
                  <div className="text-[10px] text-red-300 font-mono-digits mt-0.5">
                    {analytics?.totalPendingWithdrawalsCount ?? pendingWithdrawals.length} Pending ({(analytics?.totalPendingWithdrawalsAmount ?? pendingWithdrawals.reduce((a, b) => a + b.amountPOP, 0)).toFixed(2)} POP)
                  </div>
                </div>
              </div>

              {/* Second Row: Circulating Supply & Mining Sessions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Circulating $POP Supply</span>
                    <div className="text-lg font-black text-emerald-400 font-mono-digits">
                      {(statsData?.totalCirculating ?? analytics?.totalCirculatingPOP ?? usersList.reduce((acc, u) => acc + u.balancePOP, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} POP
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono-digits">
                      ≈ ${(((statsData?.totalCirculating ?? analytics?.totalCirculatingPOP ?? 0)) * config.popUsdRate).toFixed(2)} USD
                    </span>
                  </div>
                  <DollarSign className="w-6 h-6 text-emerald-400/60" />
                </div>

                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Active Mining Sessions</span>
                    <div className="text-lg font-black text-[#00E5FF] font-mono-digits">
                      {analytics?.totalActiveMiningSessions ?? 0} Sessions
                    </div>
                    <span className="text-[10px] text-gray-500">Storage unexpired / actively accruing</span>
                  </div>
                  <Zap className="w-6 h-6 text-[#00E5FF]/60" />
                </div>
              </div>

              {/* Protocol Summary Card */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Ecosystem Status</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-[#0B0E14] rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block">Total Users</span>
                    <span className="text-sm font-bold text-white font-mono-digits">{statsData?.totalUsers ?? usersList.length} Accounts</span>
                  </div>
                  <div className="p-2.5 bg-[#0B0E14] rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block">Active Miners</span>
                    <span className="text-sm font-bold text-[#FFE600] font-mono-digits">
                      {statsData?.activeMiners ?? analytics?.activeMiners ?? 0} Active
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0B0E14] rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block">Verified TON Wallets</span>
                    <span className="text-sm font-bold text-[#00E5FF] font-mono-digits">
                      {usersList.filter(u => !!u.tonWalletAddress).length} Connected
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0B0E14] rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block">Flagged Sybil Accounts</span>
                    <span className="text-sm font-bold text-red-400 font-mono-digits">
                      {usersList.filter(u => u.isFlagged).length} Flagged
                    </span>
                  </div>
                </div>
              </div>

              {/* Referral Analytics & Anti-Fraud Verification Metrics */}
              <div className="p-4 bg-gradient-to-br from-[#121824] to-[#0D121C] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#00E5FF]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Referral & Anti-Fraud Metrics</h4>
                  </div>
                  <button
                    onClick={() => setActiveAdminTab('referrals')}
                    className="text-[10px] text-[#00E5FF] hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Configure Settings</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 bg-[#0B0E14] rounded-xl border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block font-semibold">Total Referrals</span>
                    <div className="text-base font-black text-white font-mono-digits mt-0.5">
                      {(statsData?.totalQualifiedReferrals || 0) + (statsData?.totalUnqualifiedReferrals || 0)}
                    </div>
                    <span className="text-[10px] text-gray-500">All registered referee nodes</span>
                  </div>

                  <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 block font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Qualified Referrals
                    </span>
                    <div className="text-base font-black text-emerald-400 font-mono-digits mt-0.5">
                      {statsData?.totalQualifiedReferrals ?? analytics?.totalQualifiedReferrals ?? 0}
                    </div>
                    <span className="text-[10px] text-emerald-500/80">Wallet + Channel + Unique Device</span>
                  </div>

                  <div className="p-3 bg-red-950/20 rounded-xl border border-red-500/30">
                    <span className="text-[10px] text-red-400 block font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-red-400" />
                      Unqualified / Same Device
                    </span>
                    <div className="text-base font-black text-red-400 font-mono-digits mt-0.5">
                      {statsData?.totalUnqualifiedReferrals ?? analytics?.totalUnqualifiedReferrals ?? 0}
                    </div>
                    <span className="text-[10px] text-red-500/80">Multi-Account detected (0 Bonus)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DEDICATED USER DIRECTORY & MANAGEMENT */}
          {activeAdminTab === 'users' && (
            <div className="space-y-4">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121824] border border-[#252D3D] p-3.5 rounded-2xl">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">User Directory & Management</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-[#00E5FF] font-semibold border border-cyan-500/30 font-mono-digits">
                      {usersPagination.total} Registered
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    Real-time search by Name, Telegram Username, or Telegram ID. Click any row to view detailed profile logs.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchUsersList(usersSearchQuery, usersPage)}
                    disabled={isUsersLoading}
                    className="px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#252D3D] text-[11px] text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUsersLoading ? 'animate-spin text-[#00E5FF]' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usersSearchQuery}
                  onChange={(e) => {
                    setUsersSearchQuery(e.target.value);
                    setUsersPage(1);
                  }}
                  placeholder="Search by Name, Telegram Username, or Telegram ID in real-time..."
                  className="w-full bg-[#0B0E14] border border-[#252D3D] focus:border-[#00E5FF] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 transition-colors outline-none"
                />
                {usersSearchQuery && (
                  <button
                    onClick={() => {
                      setUsersSearchQuery('');
                      setUsersPage(1);
                    }}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Users List / Table */}
              {isUsersLoading && paginatedUsers.length === 0 ? (
                <div className="p-8 text-center bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <RefreshCw className="w-6 h-6 text-[#00E5FF] animate-spin mx-auto mb-2" />
                  <span className="text-xs text-gray-400">Fetching user accounts from live database...</span>
                </div>
              ) : paginatedUsers.length === 0 ? (
                <div className="p-8 text-center bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <Users className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">No users found</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {usersSearchQuery
                      ? `No accounts matching "${usersSearchQuery}". Try another name, handle, or ID.`
                      : 'No users registered in database yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Table View */}
                  <div className="bg-[#121824] border border-[#252D3D] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#0B0E14] border-b border-[#252D3D] text-[10px] uppercase tracking-wider text-gray-400">
                            <th className="py-2.5 px-3">Name / User</th>
                            <th className="py-2.5 px-3">Telegram ID</th>
                            <th className="py-2.5 px-3">TON Wallet Status</th>
                            <th className="py-2.5 px-3">Total Mined $POP</th>
                            <th className="py-2.5 px-3">Referrals</th>
                            <th className="py-2.5 px-3">Miner Status</th>
                            <th className="py-2.5 px-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E2638] text-xs">
                          {paginatedUsers.map((u) => {
                            const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Miner';
                            const initial = fullName.charAt(0).toUpperCase() || 'M';
                            const isWalletConnected = !!u.tonWalletAddress;

                            return (
                              <tr
                                key={u.id || u.telegramId}
                                onClick={() => {
                                  haptic.selection();
                                  setSelectedUserProfile(u);
                                }}
                                className="hover:bg-[#161F2E] cursor-pointer transition-colors group"
                              >
                                {/* User Info */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00E5FF]/20 to-blue-600/30 border border-[#00E5FF]/30 flex items-center justify-center font-bold text-white text-xs shrink-0">
                                      {initial}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-white group-hover:text-[#00E5FF] transition-colors truncate max-w-[140px]">
                                        {fullName}
                                      </div>
                                      <div className="text-[11px] text-gray-400 truncate">
                                        {u.username ? `@${u.username}` : 'No handle'}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Telegram ID */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5 font-mono-digits text-gray-300">
                                    <span>{u.telegramId}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyText(u.telegramId, `tg-${u.telegramId}`);
                                      }}
                                      className="p-1 hover:text-[#00E5FF] text-gray-500 rounded transition-colors"
                                      title="Copy Telegram ID"
                                    >
                                      {copiedId === `tg-${u.telegramId}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </td>

                                {/* TON Wallet Status */}
                                <td className="py-3 px-3">
                                  {isWalletConnected ? (
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono-digits">
                                      <Wallet className="w-3 h-3 shrink-0" />
                                      <span>
                                        {u.tonWalletAddress!.slice(0, 4)}...{u.tonWalletAddress!.slice(-4)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-800 text-gray-400 text-[10px] border border-gray-700">
                                      Not Connected
                                    </span>
                                  )}
                                </td>

                                {/* Total Mined $POP */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1 font-mono-digits font-bold text-[#FFE600]">
                                    <Award className="w-3.5 h-3.5 shrink-0 text-[#FFE600]" />
                                    <span>{(u.totalMined || 0).toFixed(2)} $POP</span>
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-mono-digits">
                                    Bal: {(u.balancePOP || 0).toFixed(2)}
                                  </span>
                                </td>

                                {/* Referrals */}
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-semibold font-mono-digits">
                                    <Users className="w-3 h-3" />
                                    <span>{u.referrals?.length ?? u.referralCount ?? 0}</span>
                                  </span>
                                </td>

                                {/* Miner Status */}
                                <td className="py-3 px-3">
                                  {u.isActiveMiner ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFE600]/15 border border-[#FFE600]/40 text-[#FFE600] text-[10px] font-bold">
                                      <Zap className="w-3 h-3" />
                                      <span>Active Miner</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-400 text-[10px]">
                                      Standard
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      haptic.selection();
                                      setSelectedUserProfile(u);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30 text-[#00E5FF] text-[11px] font-bold transition-all"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#121824] border border-[#252D3D] rounded-2xl text-xs">
                    <div className="text-gray-400 text-[11px]">
                      Showing{' '}
                      <span className="font-bold text-white font-mono-digits">
                        {usersPagination.total === 0 ? 0 : (usersPagination.page - 1) * usersPagination.limit + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-bold text-white font-mono-digits">
                        {Math.min(usersPagination.page * usersPagination.limit, usersPagination.total)}
                      </span>{' '}
                      of <span className="font-bold text-white font-mono-digits">{usersPagination.total}</span> users
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPagination.page <= 1 || isUsersLoading}
                        className="px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#252D3D] text-gray-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <div className="px-3 py-1 bg-[#0B0E14] border border-[#252D3D] rounded-xl font-mono-digits text-xs text-white">
                        {usersPagination.page} / {usersPagination.totalPages || 1}
                      </div>

                      <button
                        onClick={() => setUsersPage((p) => Math.min(usersPagination.totalPages, p + 1))}
                        disabled={usersPagination.page >= usersPagination.totalPages || isUsersLoading}
                        className="px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#252D3D] text-gray-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition-colors"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BALANCE & CUSTOM BONUSES */}
          {activeAdminTab === 'balance' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">User Balance & Bonus Management</h3>
                <span className="text-[11px] text-gray-400">
                  Credit or deduct POP with mandatory reason notes. Automatically dispatches Telegram Bot direct messages!
                </span>
              </div>

              {/* SECTION A: TARGETED USER BALANCE ADJUSTMENT */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-[#FFE600] uppercase tracking-wide flex items-center gap-1.5">
                  <Gift className="w-4 h-4" /> Single User Balance Adjustment
                </h4>

                {/* Search / Select User */}
                <div>
                  <label className="text-[11px] text-gray-300 block mb-1 font-semibold">1. Search & Select User</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search username or telegram ID..."
                      value={selectedUserSearch}
                      onChange={(e) => setSelectedUserSearch(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl pl-8 pr-3 py-2 text-xs text-white"
                    />
                  </div>

                  {selectedUserSearch && (
                    <div className="mt-1.5 max-h-32 overflow-y-auto bg-[#0B0E14] border border-[#252D3D] rounded-xl divide-y divide-[#1E2638]">
                      {filteredUsers.slice(0, 5).map(u => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedTargetUser(u);
                            setSelectedUserSearch('');
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#1E2638] flex items-center justify-between"
                        >
                          <span className="font-bold text-white">@{u.username || 'unknown'} ({u.telegramId})</span>
                          <span className="text-gray-400 font-mono-digits">{u.balancePOP.toFixed(2)} POP</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedTargetUser && (
                    <div className="mt-2 p-2.5 bg-[#1A2234] border border-[#00E5FF]/40 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#00E5FF]">Selected: @{selectedTargetUser.username || selectedTargetUser.telegramId}</span>
                        <div className="text-[10px] text-gray-300">
                          Current Balance: <span className="font-mono-digits font-bold text-white">{selectedTargetUser.balancePOP.toFixed(2)} POP</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTargetUser(null)}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount & Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">2. Action Mode</label>
                    <div className="grid grid-cols-2 gap-1 bg-[#0B0E14] p-1 rounded-xl border border-[#252D3D]">
                      <button
                        type="button"
                        onClick={() => setBalanceMode('bonus')}
                        className={`py-1 rounded-lg text-xs font-bold transition-all ${
                          balanceMode === 'bonus' ? 'bg-emerald-600 text-white' : 'text-gray-400'
                        }`}
                      >
                        + Add Bonus
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceMode('deduct')}
                        className={`py-1 rounded-lg text-xs font-bold transition-all ${
                          balanceMode === 'deduct' ? 'bg-red-600 text-white' : 'text-gray-400'
                        }`}
                      >
                        - Deduct POP
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">3. Amount (POP)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits"
                    />
                  </div>
                </div>

                {/* Mandatory Reason */}
                <div>
                  <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                    4. Reason / Audit Note <span className="text-red-400 font-bold">*Mandatory</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Weekly contest prize, Community giveaway, Bug bounty reward"
                    value={balanceReason}
                    onChange={(e) => setBalanceReason(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    This note is sent directly to the user's Telegram PM: "🎉 Bonus Received! You earned [X] POP. Reason: [Reason]"
                  </span>
                </div>

                <button
                  onClick={handleApplySingleBalance}
                  disabled={loading || !selectedTargetUser || !balanceAmount || !balanceReason}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FFE600] to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute Balance Adjustment & Send PM</span>
                </button>
              </div>

              {/* SECTION B: BROADCAST BONUS TO ALL USERS */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-[#00E5FF] uppercase tracking-wide flex items-center gap-1.5">
                  <Send className="w-4 h-4" /> Broadcast Custom Bonus to ALL Users
                </h4>
                <p className="text-[11px] text-gray-400">
                  Credit all {usersList.length} active registered users at once with an announcement notification.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">Amount POP Per User</label>
                    <input
                      type="number"
                      placeholder="e.g. 25"
                      value={broadcastAmount}
                      onChange={(e) => setBroadcastAmount(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      Broadcast Note / Celebration <span className="text-red-400 font-bold">*Mandatory</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Celebration of 10,000 Miners milestone!"
                      value={broadcastReason}
                      onChange={(e) => setBroadcastReason(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  onClick={handleBroadcastBonus}
                  disabled={loading || !broadcastAmount || !broadcastReason}
                  className="w-full py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Bonus to All ({usersList.length}) Users</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DYNAMIC REFERRAL COMMISSION */}
          {activeAdminTab === 'referrals' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Dynamic Referral Commission Protocol</h3>
                <span className="text-[11px] text-gray-400">
                  Adjust lifetime referral commission % and instant qualification bonuses in real-time
                </span>
              </div>

              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <label className="text-xs font-bold text-white block">
                  Lifetime Squad Referral Commission Rate (%)
                </label>
                
                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setEditableConfig(prev => ({
                        ...prev,
                        referralCommissionPercent: rate,
                        squadCommissionRate: rate,
                      }))}
                      className={`py-2 rounded-xl text-xs font-extrabold transition-all ${
                        (editableConfig.squadCommissionRate ?? editableConfig.referralCommissionPercent) === rate
                          ? 'bg-[#00E5FF] text-black shadow-lg shadow-cyan-500/25'
                          : 'bg-[#0B0E14] text-gray-300 border border-[#252D3D] hover:text-white'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-[11px] text-gray-300 block mb-1">Custom Commission % (Exact):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editableConfig.squadCommissionRate ?? editableConfig.referralCommissionPercent ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditableConfig(prev => ({
                        ...prev,
                        referralCommissionPercent: val,
                        squadCommissionRate: val,
                      }));
                    }}
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-white font-mono-digits"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    When changed and saved, all future claims and the "Squad" tab dynamically sync with this commission percentage.
                  </p>
                </div>

                <div className="pt-3 border-t border-[#1E2638]">
                  <label className="text-[11px] text-gray-300 block mb-1">Instant Referral Bonus (POP on qualification):</label>
                  <input
                    type="number"
                    min="0"
                    value={editableConfig.referralBonusAmount ?? editableConfig.referral_bonus ?? editableConfig.instantReferralBonusPOP ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditableConfig({
                        ...editableConfig,
                        instantReferralBonusPOP: val,
                        referral_bonus: val,
                        referralBonusAmount: val,
                      });
                    }}
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-[#FFE600] font-mono-digits"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WITHDRAWAL APPROVALS */}
          {activeAdminTab === 'withdrawals' && (
            <div className="space-y-3">
              {/* Withdrawal Settings & Policy Controls */}
              <div className="p-3.5 bg-gradient-to-r from-[#121824] via-[#161F2F] to-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#FFE600]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Withdrawal Policy & Limit Controls
                    </h4>
                  </div>
                  <span className="text-[10px] text-[#00E5FF] font-mono-digits bg-[#00E5FF]/10 px-2 py-0.5 rounded-full border border-[#00E5FF]/20">
                    Live System Config
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="bg-[#0B0E14] p-2.5 rounded-xl border border-[#1E2638]">
                    <label className="text-[10px] text-gray-300 block mb-1 font-semibold uppercase">
                      Minimum Withdrawal Amount ($POP)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editableConfig.minWithdrawAmount ?? 100}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        minWithdrawAmount: Math.max(1, parseFloat(e.target.value) || 100),
                      })}
                      className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1 text-xs text-white font-mono-digits"
                    />
                    <div className="text-[9px] text-[#FFE600] mt-1 font-mono-digits">
                      ≈ ${((editableConfig.minWithdrawAmount ?? 100) * (editableConfig.popUsdRate || 0.001)).toFixed(2)} USDT
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-xl border border-[#1E2638]">
                    <label className="text-[10px] text-gray-300 block mb-1 font-semibold uppercase">
                      Maximum Withdrawal Amount ($POP)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editableConfig.maxWithdrawAmount ?? 50000}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        maxWithdrawAmount: Math.max(1, parseFloat(e.target.value) || 50000),
                      })}
                      className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1 text-xs text-white font-mono-digits"
                    />
                    <div className="text-[9px] text-[#00E5FF] mt-1 font-mono-digits">
                      ≈ ${((editableConfig.maxWithdrawAmount ?? 50000) * (editableConfig.popUsdRate || 0.001)).toFixed(2)} USDT
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-xl border border-[#1E2638]">
                    <label className="text-[10px] text-gray-300 block mb-1 font-semibold uppercase">
                      Dynamic Withdrawal Fee (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editableConfig.withdrawalFeePercent}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        withdrawalFeePercent: parseFloat(e.target.value) || 5,
                      })}
                      className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1 text-xs text-white font-mono-digits"
                    />
                    <div className="text-[9px] text-red-400 mt-1 font-mono-digits">
                      Current: {editableConfig.withdrawalFeePercent}% per withdrawal
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all font-display uppercase"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saveSuccess ? 'Saved to Database!' : 'Save Withdrawal Settings'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">User Withdrawal Pipeline</h3>
                  <span className="text-[11px] text-gray-400">Review pending withdrawals, verify on TON, approve or reject with bot alerts</span>
                </div>

                {/* Filter Selector */}
                <div className="flex gap-1 bg-[#0B0E14] p-1 rounded-xl border border-[#252D3D] text-[10px]">
                  {(['ALL', 'PENDING', 'PAID', 'REJECTED'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setWithdrawalFilter(status)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                        withdrawalFilter === status ? 'bg-[#1E2638] text-white' : 'text-gray-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {filteredWithdrawals.length === 0 ? (
                <div className="p-6 bg-[#121824] rounded-2xl text-center text-xs text-gray-500 border border-[#1E2638]">
                  No withdrawal requests found matching filter.
                </div>
              ) : (
                filteredWithdrawals.map((wd) => {
                  const grossAmount = wd.grossAmount ?? wd.amountPOP;
                  const feePercent = wd.feePercentage ?? wd.feePercent ?? (editableConfig.withdrawalFeePercent || 5);
                  const feeInPop = wd.feeAmount ?? wd.feeAmountPOP ?? parseFloat(((grossAmount * feePercent) / 100).toFixed(4));
                  const netPop = wd.netAmount ?? wd.netAmountPOP ?? parseFloat((grossAmount - feeInPop).toFixed(4));
                  const popRate = editableConfig.popUsdRate || 0.001;
                  const netUsdt = wd.netUsdtValue ?? parseFloat((netPop * popRate).toFixed(4));
                  const feeUsdt = wd.feeUsdtValue ?? parseFloat((feeInPop * popRate).toFixed(4));

                  const fmtUsdt = (val: number) => {
                    const s = val.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
                    if (/^\d+\.\d$/.test(s)) return s + '0';
                    if (!s.includes('.')) return s + '.00';
                    return s;
                  };

                  return (
                    <div
                      key={wd.id}
                      className="p-3.5 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2.5 text-xs"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-xs">
                              {wd.username ? `@${wd.username.replace(/^@/, '')}` : `User ${wd.telegramId}`}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono-digits">
                              (TG: {wd.telegramId})
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono-digits">
                            {formatDateDDMMYYYY(wd.createdAt)}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                          wd.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : wd.status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {wd.status}
                        </span>
                      </div>

                      {/* Fee Calculation & Net Payable Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0B0E14] border border-[#1E2638] p-2.5 rounded-xl text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold block">Gross Request</span>
                          <div className="font-mono-digits font-bold text-white text-xs">
                            {grossAmount.toLocaleString()} POP
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                            Admin Fee ({feePercent}%)
                          </span>
                          <div className="font-mono-digits font-bold text-red-400 text-xs">
                            -{feeInPop.toLocaleString()} POP <span className="text-[10px] text-red-400/80">(${fmtUsdt(feeUsdt)})</span>
                          </div>
                        </div>

                        <div className="border-t sm:border-t-0 sm:border-l border-[#1E2638] pt-1.5 sm:pt-0 sm:pl-2.5">
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Net Payable
                          </span>
                          <div className="font-mono-digits font-black text-emerald-400 text-xs">
                            {netPop.toLocaleString()} POP
                          </div>
                        </div>

                        <div className="border-t sm:border-t-0 sm:border-l border-[#1E2638] pt-1.5 sm:pt-0 sm:pl-2.5">
                          <span className="text-[10px] text-[#00E5FF] uppercase font-semibold block">Net Value</span>
                          <div className="font-mono-digits font-bold text-[#00E5FF] text-xs">
                            ${fmtUsdt(netUsdt)} USDT
                          </div>
                        </div>
                      </div>

                    <div className="p-2 bg-[#0B0E14] rounded-xl text-[10px] font-mono-digits text-[#00E5FF] flex items-center justify-between">
                      <span className="truncate">{wd.tonAddress}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wd.tonAddress);
                          haptic.selection();
                        }}
                        className="text-[9px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-[#1E2638]"
                      >
                        Copy
                      </button>
                    </div>

                    {wd.status === 'PENDING' && (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          placeholder="Optional TON Tx Hash (e.g. 0xabc...)"
                          value={withdrawalTxHash[wd.id] || ''}
                          onChange={(e) => setWithdrawalTxHash({ ...withdrawalTxHash, [wd.id]: e.target.value })}
                          className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1 text-[10px] text-gray-300 font-mono-digits"
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleProcessWithdrawal(wd.id, 'reject')}
                            disabled={loading}
                            className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold rounded-xl text-xs flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject & Refund</span>
                          </button>
                          <button
                            onClick={() => handleProcessWithdrawal(wd.id, 'paid')}
                            disabled={loading}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Paid & Dispatch PM</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            </div>
          )}

          {/* TAB 5: MINING LEVELS CONFIG (50 LEVELS DYNAMIC MANAGEMENT) */}
          {activeAdminTab === 'mining' && (
            <div className="space-y-4">
              {/* Header with Title & Bulk Actions */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#FFE600]/15 text-[#FFE600] rounded-xl border border-[#FFE600]/30">
                      <Zap className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider font-display">
                        Mining Levels Config (50 Levels)
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        Dynamic Speed (POP/h) & Cost (POP) controls synced directly to MongoDB Atlas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleBulkSaveMiningLevels}
                    disabled={loading}
                    className="px-4 py-2 bg-[#FFE600] hover:bg-[#FFE600]/90 text-black font-extrabold text-xs rounded-xl uppercase tracking-wider font-display transition-all flex items-center gap-1.5 shadow-md shadow-yellow-500/20 active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{miningBulkSuccess ? 'Saved All to MongoDB!' : 'Save All 50 Levels'}</span>
                  </button>

                  <button
                    onClick={handleResetMiningLevelsToDefaults}
                    disabled={isResettingMiningLevels}
                    className="px-3.5 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50"
                    title="Reset all 50 levels back to 0.20-1.99 POP/h & 0-1130 POP"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResettingMiningLevels ? 'animate-spin' : ''}`} />
                    <span>Reset 50 Defaults</span>
                  </button>
                </div>
              </div>

              {/* Protocol Spec Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#0B0E14] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Level 1 (Base Rig)</span>
                  <div className="text-sm font-extrabold text-[#FFE600] font-mono-digits mt-0.5">
                    0.20 POP/h
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">Cost: 0 POP (Free)</span>
                </div>

                <div className="p-3 bg-[#0B0E14] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Level 2 (Cyber Rig)</span>
                  <div className="text-sm font-extrabold text-[#00E5FF] font-mono-digits mt-0.5">
                    0.24 POP/h
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono-digits">Cost: 130 POP</span>
                </div>

                <div className="p-3 bg-[#0B0E14] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Level 50 (Apex)</span>
                  <div className="text-sm font-extrabold text-[#FFE600] font-mono-digits mt-0.5">
                    1.99 POP/h
                  </div>
                  <span className="text-[10px] text-[#FFE600] font-mono-digits">Cost: 1,130 POP</span>
                </div>

                <div className="p-3 bg-[#0B0E14] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Fleet Range</span>
                  <div className="text-sm font-extrabold text-white font-mono-digits mt-0.5">
                    50 Tiers
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> MongoDB Synced
                  </span>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                    {(['all', '1-10', '11-20', '21-30', '31-40', '41-50'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        onClick={() => {
                          haptic.selection();
                          setAdminMiningFilter(filterKey);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                          adminMiningFilter === filterKey
                            ? 'bg-[#FFE600] text-black shadow-sm font-display'
                            : 'bg-[#0B0E14] text-gray-400 border border-[#252D3D] hover:text-white'
                        }`}
                      >
                        {filterKey === 'all' ? 'All (50)' : `Lvl ${filterKey}`}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search level # or rig name..."
                      value={adminMiningSearch}
                      onChange={(e) => setAdminMiningSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#0B0E14] border border-[#252D3D] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                    />
                  </div>
                </div>
              </div>

              {/* 50 Mining Levels List / Cards */}
              <div className="space-y-2">
                {editableConfig.minerTiers
                  .filter((miner) => {
                    if (adminMiningSearch.trim()) {
                      const q = adminMiningSearch.toLowerCase().trim();
                      const matchLvl = miner.level.toString().includes(q);
                      const matchName = miner.name && miner.name.toLowerCase().includes(q);
                      if (!matchLvl && !matchName) return false;
                    }
                    if (adminMiningFilter === '1-10') return miner.level >= 1 && miner.level <= 10;
                    if (adminMiningFilter === '11-20') return miner.level >= 11 && miner.level <= 20;
                    if (adminMiningFilter === '21-30') return miner.level >= 21 && miner.level <= 30;
                    if (adminMiningFilter === '31-40') return miner.level >= 31 && miner.level <= 40;
                    if (adminMiningFilter === '41-50') return miner.level >= 41 && miner.level <= 50;
                    return true;
                  })
                  .map((miner) => {
                    const index = editableConfig.minerTiers.findIndex((m) => m.level === miner.level);
                    const isSaving = savingLevelId === miner.level;
                    const feedback = levelSaveFeedback[miner.level];

                    return (
                      <div
                        key={miner.level}
                        className="p-3.5 bg-[#121824] border border-[#252D3D] hover:border-[#384358] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-all shadow-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-[#FFE600]/15 text-[#FFE600] border border-[#FFE600]/30 rounded-lg font-black text-xs font-mono-digits">
                              Lvl {miner.level}
                            </span>
                            <span className="font-extrabold text-white text-sm font-display truncate">
                              {miner.name || `Level ${miner.level} Rig`}
                            </span>
                            {miner.level === 1 && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold uppercase">
                                Free Base
                              </span>
                            )}
                            {miner.level === 50 && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded font-bold uppercase">
                                Apex Max
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                            <span>
                              Speed: <strong className="text-[#00E5FF] font-mono-digits">{miner.speedPerHour} POP/h</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Cost: <strong className="text-[#FFE600] font-mono-digits">{miner.pricePOP.toLocaleString()} POP</strong>
                              <span className="text-gray-500 ml-1">(≈ ${(miner.pricePOP * editableConfig.popUsdRate).toFixed(2)})</span>
                            </span>
                          </div>
                        </div>

                        {/* Editable Inputs for Speed & Cost */}
                        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                          <div>
                            <label className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider mb-0.5">
                              Speed (POP/h)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={miner.speedPerHour}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...editableConfig.minerTiers];
                                updated[index] = { ...updated[index], speedPerHour: Number(val.toFixed(2)) };
                                setEditableConfig({ ...editableConfig, minerTiers: updated });
                              }}
                              className="w-24 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-white font-mono-digits font-bold focus:border-[#00E5FF] outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider mb-0.5">
                              Cost (POP)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={miner.pricePOP}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                const updated = [...editableConfig.minerTiers];
                                updated[index] = {
                                  ...updated[index],
                                  pricePOP: val,
                                  priceUSD: Number((val * editableConfig.popUsdRate).toFixed(2)),
                                };
                                setEditableConfig({ ...editableConfig, minerTiers: updated });
                              }}
                              className="w-28 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-[#FFE600] font-mono-digits font-bold focus:border-[#FFE600] outline-none"
                            />
                          </div>

                          {/* Individual Save to MongoDB Button */}
                          <div className="pt-3.5">
                            <button
                              onClick={() => handleSaveSingleMiningLevel(miner.level)}
                              disabled={isSaving}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                                feedback?.includes('Saved')
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-[#1E2638] hover:bg-[#FFE600] hover:text-black text-gray-200 border border-[#252D3D]'
                              }`}
                              title={`Save Level ${miner.level} directly to MongoDB`}
                            >
                              {isSaving ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : feedback?.includes('Saved') ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Saved</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 6: STORAGE MATRIX */}
          {activeAdminTab === 'storage' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Storage Vault Durations</h3>
                <span className="text-[11px] text-gray-400">Configure offline claiming duration caps across tiers</span>
              </div>

              <div className="space-y-2">
                {editableConfig.storageTiers.map((storage, index) => (
                  <div
                    key={storage.tier}
                    className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">Tier {storage.tier}: {storage.name}</span>
                      <div className="text-[10px] text-[#00E5FF] font-mono-digits">
                        Duration Cap: {storage.durationHours} Hours
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div>
                        <label className="text-[9px] text-gray-400 block font-semibold">Hours</label>
                        <input
                          type="number"
                          value={storage.durationHours}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            const updated = [...editableConfig.storageTiers];
                            updated[index] = { ...updated[index], durationHours: val };
                            setEditableConfig({ ...editableConfig, storageTiers: updated });
                          }}
                          className="w-16 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2 py-1 text-white font-mono-digits"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 block font-semibold">Cost (POP)</label>
                        <input
                          type="number"
                          value={storage.pricePOP}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...editableConfig.storageTiers];
                            updated[index] = { ...updated[index], pricePOP: val, priceUSD: val * editableConfig.popUsdRate };
                            setEditableConfig({ ...editableConfig, storageTiers: updated });
                          }}
                          className="w-20 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2 py-1 text-[#FFE600] font-mono-digits"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: ECOSYSTEM TASKS */}
          {activeAdminTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Ecosystem Tasks & Social Missions</h3>
                  <span className="text-[11px] text-gray-400">Deploy dynamic tasks with instant rewards and cooldown timers</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Real-time Sync Active
                </span>
              </div>

              {/* Add New Task Card */}
              <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2.5">
                <span className="text-xs font-bold text-white block">Create New Mission</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Task Title (e.g., Subscribe on YouTube)"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value as any)}
                      className="bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2 py-1.5 text-xs text-gray-300 flex-1"
                    >
                      <option value="telegram">Telegram</option>
                      <option value="youtube">YouTube</option>
                      <option value="x">X (Twitter)</option>
                      <option value="announcement">Announcement</option>
                    </select>
                    <input
                      type="number"
                      placeholder="POP"
                      value={newTaskReward}
                      onChange={(e) => setNewTaskReward(e.target.value)}
                      className="w-20 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2 py-1.5 text-xs text-[#FFE600] font-mono-digits"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Task URL Link (e.g. https://t.me/...)"
                    value={newTaskUrl}
                    onChange={(e) => setNewTaskUrl(e.target.value)}
                    className="sm:col-span-2 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-1.5 text-xs text-gray-300"
                  />
                  <div className="flex items-center gap-1 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                    <input
                      type="number"
                      min="0"
                      placeholder="Delay (secs)"
                      value={newTaskClaimDelaySeconds}
                      onChange={(e) => setNewTaskClaimDelaySeconds(e.target.value)}
                      className="w-full bg-transparent text-xs text-[#00E5FF] font-mono-digits focus:outline-none"
                      title="Claim Delay / Timer in seconds (0 = instant claim, e.g. 10 for 10s, 60 for 1 min)"
                    />
                    <span className="text-[10px] text-gray-400 shrink-0">secs</span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400">
                  ⚡ <strong className="text-gray-300">Claim Delay / Timer:</strong> Set to <code className="text-[#00E5FF]">0</code> for instant claim, or enter seconds (e.g., <code className="text-[#00E5FF]">10</code> for 10s, <code className="text-[#00E5FF]">60</code> for 1 min).
                </p>

                <button
                  onClick={handleAddTask}
                  className="w-full py-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#00E5FF]/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Mission & Sync Instantly to Users</span>
                </button>
              </div>

              {/* Task List */}
              <div className="space-y-2">
                {editableConfig.tasks?.map((task) => {
                  const taskDelaySecs = typeof task.claimDelaySeconds === 'number'
                    ? task.claimDelaySeconds
                    : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);

                  return (
                  <div
                    key={task.id}
                    className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl text-xs space-y-2"
                  >
                    {editingTaskId === task.id ? (
                      /* Inline Task Edit Form */
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-[#00E5FF] block">Edit Mission: {task.id}</span>
                        <input
                          type="text"
                          value={editTaskTitle}
                          onChange={(e) => setEditTaskTitle(e.target.value)}
                          className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-1.5 text-xs text-white"
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <select
                            value={editTaskCategory}
                            onChange={(e) => setEditTaskCategory(e.target.value as any)}
                            className="bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2 py-1.5 text-xs text-gray-300"
                          >
                            <option value="telegram">Telegram</option>
                            <option value="youtube">YouTube</option>
                            <option value="x">X (Twitter)</option>
                            <option value="announcement">Announcement</option>
                          </select>
                          <input
                            type="number"
                            value={editTaskReward}
                            onChange={(e) => setEditTaskReward(e.target.value)}
                            placeholder="Reward POP"
                            className="bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2 py-1.5 text-xs text-[#FFE600] font-mono-digits"
                          />
                          <div className="col-span-2 sm:col-span-1 flex items-center gap-1 bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                            <input
                              type="number"
                              min="0"
                              value={editTaskClaimDelaySeconds}
                              onChange={(e) => setEditTaskClaimDelaySeconds(e.target.value)}
                              className="w-full bg-transparent text-xs text-[#00E5FF] font-mono-digits focus:outline-none"
                              title="Claim Delay in seconds"
                            />
                            <span className="text-[10px] text-gray-400">secs</span>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editTaskUrl}
                          onChange={(e) => setEditTaskUrl(e.target.value)}
                          placeholder="Task URL"
                          className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-1.5 text-xs text-gray-300"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingTaskId(null)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEditedTask(task.id)}
                            className="px-3 py-1 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold rounded-lg text-xs flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Save & Sync
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Task Display Item */
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="font-bold text-white block">{task.title}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-[#FFE600] font-mono-digits font-semibold">
                              +{task.rewardPOP} POP
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                              {task.category}
                            </span>
                            <span className="text-gray-500">•</span>
                            {taskDelaySecs > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono-digits flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {taskDelaySecs}s Cooldown
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono-digits flex items-center gap-1">
                                ⚡ Instant Claim (0s)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditTask(task)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                            title="Edit Mission"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg"
                            title="Delete Mission"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* TAB 8: WEEKLY CONTEST & MANUAL PAYOUT DASHBOARD */}
          {activeAdminTab === 'contest' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#FFE600]" />
                    Weekly Referral Contest & Manual Payouts
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    Saturday-to-Saturday cycle rules, prize pool amounts, and manual payout review
                  </span>
                </div>
                <button
                  onClick={fetchWeeklyContestLeaderboard}
                  disabled={isContestLoading}
                  className="px-3 py-1.5 rounded-xl bg-[#1E2638] hover:bg-[#252D3D] text-gray-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isContestLoading ? 'animate-spin text-[#FFE600]' : ''}`} />
                  <span>Refresh Rankings</span>
                </button>
              </div>

              {/* 1. 100% MANUAL PAYOUT PROTOCOL ENFORCEMENT BANNER */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                      100% Manual Payout Protocol Enforced
                    </span>
                    <span className="text-[9px] font-bold bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Zero Automated Transfers
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    The bot does <strong>NOT</strong> automatically send or distribute any bonus tokens or USD rewards to winners. 
                    Admins manually review the verified rankings on the leaderboard below at the conclusion of each Saturday cycle and execute prize distribution directly.
                  </p>
                </div>
              </div>

              {/* 2. CONTEST RULES & PRIZE POOL CONFIGURATION */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#FFE600]" />
                  Contest Rules & Prize Pool Settings
                </h4>

                <div>
                  <label className="text-[11px] text-gray-300 block font-semibold mb-1">
                    Minimum Qualified Referrals Requirement (Saturday to Saturday)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editableConfig.weeklyContestMinThreshold}
                    onChange={(e) => setEditableConfig({
                      ...editableConfig,
                      weeklyContestMinThreshold: parseInt(e.target.value, 10) || 40,
                    })}
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-white font-mono-digits"
                    placeholder="e.g. 40"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Users must achieve at least this many verified qualified referrals within the 7-day cycle to qualify for prizes.
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-[#FFE600] font-bold block mb-1">👑 1st Prize ($ USDT)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editableConfig.weeklyPrizesUsdt.first}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        weeklyPrizesUsdt: { ...editableConfig.weeklyPrizesUsdt, first: parseFloat(e.target.value) || 0 },
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-white font-mono-digits"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-300 font-bold block mb-1">🥈 2nd Prize ($ USDT)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editableConfig.weeklyPrizesUsdt.second}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        weeklyPrizesUsdt: { ...editableConfig.weeklyPrizesUsdt, second: parseFloat(e.target.value) || 0 },
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-white font-mono-digits"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-500 font-bold block mb-1">🥉 3rd Prize ($ USDT)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editableConfig.weeklyPrizesUsdt.third}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        weeklyPrizesUsdt: { ...editableConfig.weeklyPrizesUsdt, third: parseFloat(e.target.value) || 0 },
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-white font-mono-digits"
                    />
                  </div>
                </div>

                {/* Custom Notice Text shown in user frontend */}
                <div>
                  <label className="text-[11px] text-gray-300 block font-semibold mb-1">
                    Frontend Contest Notice / Rules Announcement Banner (Optional)
                  </label>
                  <input
                    type="text"
                    value={editableConfig.weeklyContestNoticeText || ''}
                    onChange={(e) => setEditableConfig({
                      ...editableConfig,
                      weeklyContestNoticeText: e.target.value,
                    })}
                    placeholder="e.g. Winners will be manually contacted & paid every Saturday at 23:59 UTC!"
                    className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    This message appears directly inside the Weekly Contest information card on user devices.
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-[#FFE600] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:bg-yellow-400 transition-all font-display uppercase tracking-wide"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Contest Settings</span>
                  </button>
                </div>
              </div>

              {/* 3. LIVE SATURDAY-TO-SATURDAY LEADERBOARD REVIEW FOR MANUAL PAYOUT */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Live Weekly Leaderboard (Manual Review Table)
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono-digits">
                    {weeklyContestLeaderboard.length} Ranked Users
                  </span>
                </div>

                {weeklyContestLeaderboard.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs bg-[#0B0E14] rounded-xl border border-[#1E2638]">
                    No qualified referrals recorded yet in the current Saturday-to-Saturday cycle.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#252D3D] text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                          <th className="py-2 px-2">Rank</th>
                          <th className="py-2 px-2">User / Telegram ID</th>
                          <th className="py-2 px-2 text-center">Qualified Invites</th>
                          <th className="py-2 px-2 text-right">POP Earned</th>
                          <th className="py-2 px-2 text-center">Prize Pool</th>
                          <th className="py-2 px-2 text-right">Manual Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2234]">
                        {weeklyContestLeaderboard.map((item, idx) => {
                          const meetsThreshold = (item.qualifiedReferralCount ?? item.referralCount ?? 0) >= (editableConfig.weeklyContestMinThreshold || 40);
                          const isTop3 = idx < 3;
                          return (
                            <tr key={item.telegramId || idx} className="hover:bg-[#161F30] transition-colors">
                              <td className="py-2.5 px-2 font-mono-digits font-bold">
                                {idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="font-bold text-white flex items-center gap-1">
                                  <span>@{item.username || 'user'}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono-digits flex items-center gap-1">
                                  <span>ID: {item.telegramId}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard?.writeText(item.telegramId);
                                      setCopiedId(item.telegramId);
                                      setTimeout(() => setCopiedId(null), 2000);
                                    }}
                                    className="text-gray-500 hover:text-white"
                                    title="Copy Telegram ID"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono-digits ${
                                  meetsThreshold 
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40' 
                                    : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {item.qualifiedReferralCount ?? item.referralCount ?? 0} {meetsThreshold ? '✓' : `/${editableConfig.weeklyContestMinThreshold}`}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono-digits text-gray-300">
                                {Math.round(item.totalPopEarnings ?? 0).toLocaleString()} POP
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {isTop3 && meetsThreshold ? (
                                  <span className="text-[#FFE600] font-black font-mono-digits text-xs">
                                    ${(idx === 0 ? editableConfig.weeklyPrizesUsdt.first : idx === 1 ? editableConfig.weeklyPrizesUsdt.second : editableConfig.weeklyPrizesUsdt.third).toFixed(2)} USDT
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-[10px]">
                                    {meetsThreshold ? 'Eligible' : 'Below 40'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <button
                                  onClick={() => {
                                    navigator.clipboard?.writeText(`Telegram ID: ${item.telegramId}, Username: @${item.username}, Rank: #${idx + 1}, Qualified: ${item.qualifiedReferralCount}`);
                                    haptic.success();
                                    setCopiedId(item.telegramId);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="px-2 py-1 bg-[#1E2638] hover:bg-[#252D3D] text-[10px] text-gray-300 rounded font-semibold transition-all inline-flex items-center gap-1"
                                >
                                  {copiedId === item.telegramId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedId === item.telegramId ? 'Copied' : 'Copy Info'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4. WITHDRAWAL LIMITS & FEE PROTOCOL */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Withdrawal Parameters & Fee
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-300 block font-semibold">Min Withdrawal ($POP)</label>
                    <input
                      type="number"
                      min="1"
                      value={editableConfig.minWithdrawAmount ?? 100}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        minWithdrawAmount: Math.max(1, parseFloat(e.target.value) || 100),
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono-digits"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-300 block font-semibold">Max Withdrawal ($POP)</label>
                    <input
                      type="number"
                      min="1"
                      value={editableConfig.maxWithdrawAmount ?? 50000}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        maxWithdrawAmount: Math.max(1, parseFloat(e.target.value) || 50000),
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono-digits"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-300 block font-semibold">Withdrawal Fee (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editableConfig.withdrawalFeePercent}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        withdrawalFeePercent: parseFloat(e.target.value) || 5,
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono-digits"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REFERRAL SYSTEM & ANTI-FRAUD CONFIGURATION */}
          {activeAdminTab === 'referrals' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Referral System & Anti-Fraud Engine
                </h3>
                <span className="text-[11px] text-gray-400">
                  Configure Flat POP bonuses, mining commission rates, and monitor real-time anti-fraud device verification
                </span>
              </div>

              {/* 1. Referral Protocol Live Analytics */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#00E5FF]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Referral Protocol Analytics
                    </h4>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono-digits">
                    Live Database Metrics
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total Referrals */}
                  <div className="p-3.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">
                      Total Referrals
                    </span>
                    <div className="text-xl font-black text-white font-mono-digits">
                      {(statsData?.totalQualifiedReferrals || 0) + (statsData?.totalUnqualifiedReferrals || 0)}
                    </div>
                    <span className="text-[10px] text-gray-500 block">
                      Total registered invites across protocol
                    </span>
                  </div>

                  {/* Qualified Referrals */}
                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Qualified Referrals
                    </span>
                    <div className="text-xl font-black text-emerald-400 font-mono-digits">
                      {statsData?.totalQualifiedReferrals ?? analytics?.totalQualifiedReferrals ?? 0}
                    </div>
                    <span className="text-[10px] text-emerald-500/80 block">
                      Wallet + Channel + Unique Device
                    </span>
                  </div>

                  {/* Unqualified / Same Device */}
                  <div className="p-3.5 bg-red-950/20 border border-red-500/30 rounded-xl space-y-1">
                    <span className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      Unqualified / Same Device
                    </span>
                    <div className="text-xl font-black text-red-400 font-mono-digits">
                      {statsData?.totalUnqualifiedReferrals ?? analytics?.totalUnqualifiedReferrals ?? 0}
                    </div>
                    <span className="text-[10px] text-red-500/80 block">
                      Same device / multi-account detected (0 bonus)
                    </span>
                  </div>
                </div>

                {/* Conversion rate indicator */}
                <div className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between text-xs font-mono-digits">
                  <span className="text-gray-400 text-[11px]">Qualification Conversion Rate:</span>
                  <span className="text-[#00E5FF] font-bold">
                    {(
                      ((statsData?.totalQualifiedReferrals || 0) /
                        Math.max(
                          (statsData?.totalQualifiedReferrals || 0) + (statsData?.totalUnqualifiedReferrals || 0),
                          1
                        )) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </div>

              {/* 2. Referral Configuration Settings */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#FFE600]" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Referral Reward & Commission Configuration
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Flat POP Referral Bonus */}
                  <div className="space-y-1.5 p-3.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl">
                    <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-[#FFE600]" />
                      Flat POP Referral Bonus (Per Qualified Referral)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={editableConfig.referralBonusAmount ?? editableConfig.referral_bonus ?? editableConfig.instantReferralBonusPOP ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditableConfig({
                          ...editableConfig,
                          instantReferralBonusPOP: val,
                          referral_bonus: val,
                          referralBonusAmount: val,
                        });
                      }}
                      placeholder="e.g. 0"
                      className="w-full bg-[#121824] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits focus:border-[#00E5FF] outline-none"
                    />
                    <span className="text-[10px] text-gray-500 block leading-tight">
                      Awarded instantly to User A when User B completes TON Wallet + TG Channel verification on a unique device.
                    </span>
                  </div>

                  {/* Referral Mining Commission % */}
                  <div className="space-y-1.5 p-3.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl">
                    <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-[#00E5FF]" />
                      Referral Mining Commission % (Per Claim)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={editableConfig.squadCommissionRate ?? editableConfig.referralCommissionPercent ?? 0}
                      onChange={(e) =>
                        setEditableConfig({
                          ...editableConfig,
                          referralCommissionPercent: parseFloat(e.target.value) || 0,
                          squadCommissionRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="e.g. 10"
                      className="w-full bg-[#121824] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits focus:border-[#00E5FF] outline-none"
                    />
                    <span className="text-[10px] text-gray-500 block leading-tight">
                      Percentage of mined POP User A earns each time User B claims their storage container.
                    </span>
                  </div>
                </div>

                {/* Multi-Account & Anti-Fraud Protocol Enforcement Rules */}
                <div className="p-3.5 bg-gradient-to-r from-[#161F30] to-[#0D121C] border border-[#00E5FF]/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-xs font-bold text-white">Active Anti-Fraud Verification Gate</span>
                  </div>
                  <div className="text-[11px] text-gray-300 space-y-1.5 leading-relaxed">
                    <p>
                      • <strong className="text-white">Referral Display Guarantee:</strong> Once User B completes TON Wallet connection & joins the Official TG Channel, User B immediately appears in User A's Squad List regardless of device.
                    </p>
                    <p>
                      • <strong className="text-emerald-400">Case 1 (Different Device):</strong> User B is marked as <span className="text-emerald-400 font-bold font-mono">"QUALIFIED"</span>. User A receives the Flat POP Bonus (+{editableConfig.referralBonusAmount ?? editableConfig.referral_bonus ?? editableConfig.instantReferralBonusPOP ?? 0} POP) and starts earning the {editableConfig.squadCommissionRate ?? editableConfig.referralCommissionPercent ?? 0}% mining commission.
                    </p>
                    <p>
                      • <strong className="text-red-400">Case 2 (Same Device / Multi-Account):</strong> User B appears in User A's Squad List marked as <span className="text-red-400 font-bold font-mono">"UNQUALIFIED - SAME DEVICE"</span>. User A receives NO Flat POP bonus and NO mining commission.
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-blue-600 hover:from-[#00E5FF]/90 hover:to-blue-500 text-black font-black text-xs flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Referral & Commission Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: BOT, CHANNELS & SUPPORT SETUP */}
          {activeAdminTab === 'botSupport' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Mandatory Channel Verification & Community Support Desk
                </h3>
                <span className="text-[11px] text-gray-400">
                  Update official Telegram channels and customer support contact links in real-time
                </span>
              </div>

              {/* 1. Mandatory Telegram Channel Configuration */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#00E5FF]" />
                    <h4 className="text-xs font-bold text-white uppercase">
                      Mandatory Telegram Channel Prerequisite
                    </h4>
                  </div>
                  <span className="text-[10px] bg-[#00E5FF]/15 text-[#00E5FF] px-2 py-0.5 rounded-full font-bold">
                    Anti-Sybil Gate
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Users are strictly required to join this channel before mining is activated or referral bonuses are granted. The bot verifies membership via <code className="text-[#FFE600] font-mono">getChatMember</code>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      Telegram Channel Handle / ID
                    </label>
                    <input
                      type="text"
                      value={editableConfig.mandatoryTelegramChannel || ''}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        mandatoryTelegramChannel: e.target.value.trim(),
                      })}
                      placeholder="@PopCornUSA_BOT"
                      className="w-full bg-[#0B0E14] border border-[#252D3D] focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      Direct Channel Invite Link / URL
                    </label>
                    <input
                      type="text"
                      value={editableConfig.mandatoryChannelLink || ''}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        mandatoryChannelLink: e.target.value.trim(),
                      })}
                      placeholder="https://t.me/PopCornUSA_BOT"
                      className="w-full bg-[#0B0E14] border border-[#252D3D] focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Official Support Contact Links */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                    💬
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase">
                    Official Support Desk Links
                  </h4>
                </div>

                <p className="text-[11px] text-gray-400">
                  Displayed inside the Dedicated Support Card on the Wallet screen for user assistance.
                </p>

                <div className="space-y-3">
                  {/* Telegram Support Desk */}
                  <div className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-[#0088CC] block">Telegram Admin / Support Desk</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Username / Tag</label>
                        <input
                          type="text"
                          value={editableConfig.telegramSupportUsername || ''}
                          onChange={(e) => setEditableConfig({
                            ...editableConfig,
                            telegramSupportUsername: e.target.value.trim(),
                          })}
                          placeholder="@POP_Support_Bot"
                          className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Direct URL</label>
                        <input
                          type="text"
                          value={editableConfig.telegramSupportUrl || ''}
                          onChange={(e) => setEditableConfig({
                            ...editableConfig,
                            telegramSupportUrl: e.target.value.trim(),
                          })}
                          placeholder="https://t.me/POP_Support_Bot"
                          className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Support Desk */}
                  <div className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-[#25D366] block">WhatsApp Customer Helpdesk</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">WhatsApp Phone Number</label>
                        <input
                          type="text"
                          value={editableConfig.whatsappSupportNumber || ''}
                          onChange={(e) => setEditableConfig({
                            ...editableConfig,
                            whatsappSupportNumber: e.target.value.trim(),
                          })}
                          placeholder="+1 555-019-2834"
                          className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Direct wa.me Link</label>
                        <input
                          type="text"
                          value={editableConfig.whatsappSupportUrl || ''}
                          onChange={(e) => setEditableConfig({
                            ...editableConfig,
                            whatsappSupportUrl: e.target.value.trim(),
                          })}
                          placeholder="https://wa.me/15550192834"
                          className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Economic & Valuation Config */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#FFE600]" />
                    <span>POP Token Valuation & Withdrawal Settings</span>
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono-digits">
                    Rate: 1 POP = ${editableConfig.popUsdRate} USD
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      POP USD Rate (1 POP in USD)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={editableConfig.popUsdRate}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        popUsdRate: parseFloat(e.target.value) || 0.001,
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits"
                    />
                    <span className="text-[10px] text-[#FFE600] mt-1 block font-mono-digits">
                      Current: 100 POP = ${(100 * editableConfig.popUsdRate).toFixed(2)} USDT
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      Dynamic Withdrawal Fee (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editableConfig.withdrawalFeePercent}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        withdrawalFeePercent: parseFloat(e.target.value) || 5,
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block font-mono-digits">
                      Current: {editableConfig.withdrawalFeePercent}% deducted per withdrawal
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      Minimum Withdrawal Amount ($POP)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editableConfig.minWithdrawAmount ?? 100}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        minWithdrawAmount: Math.max(1, parseFloat(e.target.value) || 100),
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits"
                    />
                    <span className="text-[10px] text-[#00E5FF] mt-1 block font-mono-digits">
                      Min Value: ≈ ${((editableConfig.minWithdrawAmount ?? 100) * editableConfig.popUsdRate).toFixed(2)} USDT
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                      Maximum Withdrawal Amount ($POP)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editableConfig.maxWithdrawAmount ?? 50000}
                      onChange={(e) => setEditableConfig({
                        ...editableConfig,
                        maxWithdrawAmount: Math.max(1, parseFloat(e.target.value) || 50000),
                      })}
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2 text-xs text-white font-mono-digits"
                    />
                    <span className="text-[10px] text-[#00E5FF] mt-1 block font-mono-digits">
                      Max Value: ≈ ${((editableConfig.maxWithdrawAmount ?? 50000) * editableConfig.popUsdRate).toFixed(2)} USDT per transaction
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button for this tab */}
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-red-600/30 active:scale-[0.99]"
              >
                <Save className="w-4 h-4" />
                <span>Save Channel & Support Settings</span>
              </button>
            </div>
          )}

          {/* TAB: DYNAMIC AD NETWORK SETTINGS (MONETIZE) */}
          {activeAdminTab === 'adNetwork' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tv className="w-4 h-4 text-sky-400" />
                  <span>Monetization Engine & Ad Networks</span>
                </h3>
                <span className="text-[11px] text-gray-400">
                  Configure Adsgram and Monitag dual ad systems with startup delay and daily frequency control
                </span>
              </div>

              {/* Active Provider Selector Bar */}
              <div className="p-4 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase">Active Primary Ad Provider</span>
                  <span className="text-[10px] font-mono font-bold bg-[#00E5FF]/20 text-[#00E5FF] px-2.5 py-0.5 rounded-full border border-[#00E5FF]/30">
                    ACTIVE: {(editableConfig.adProvider || 'adsgram').toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setEditableConfig({
                        ...editableConfig,
                        adProvider: 'adsgram',
                        adProviderSecret: editableConfig.adsgramBlockId || editableConfig.adProviderSecret || '50936'
                      });
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                      editableConfig.adProvider === 'adsgram'
                        ? 'bg-gradient-to-br from-cyan-950/50 via-[#121824] to-[#0E131F] border-[#00E5FF] text-white shadow-lg shadow-cyan-500/20'
                        : 'bg-[#0B0E14] border-[#252D3D] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black font-display tracking-tight text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
                        Adsgram
                      </span>
                      {editableConfig.adProvider === 'adsgram' && (
                        <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-snug">
                      Official Telegram Mini App native non-skippable 10s video interstitial ads.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setEditableConfig({
                        ...editableConfig,
                        adProvider: 'monetag',
                        adProviderSecret: editableConfig.monetagZoneId || editableConfig.adProviderSecret || '7894561'
                      });
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                      editableConfig.adProvider === 'monetag'
                        ? 'bg-gradient-to-br from-amber-950/50 via-[#121824] to-[#0E131F] border-[#FFE600] text-white shadow-lg shadow-amber-500/20'
                        : 'bg-[#0B0E14] border-[#252D3D] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black font-display tracking-tight text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        Monetag
                      </span>
                      {editableConfig.adProvider === 'monetag' && (
                        <CheckCircle2 className="w-4 h-4 text-[#FFE600]" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-snug">
                      Global programmatic in-app video & interstitial high-eCPM tags.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sub-Tab Navigation inside Monetize section */}
              <div className="flex items-center gap-2 p-1.5 bg-[#0B0E14] rounded-2xl border border-[#252D3D]">
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setMonetizeSubTab('adsgram');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    monetizeSubTab === 'adsgram'
                      ? 'bg-cyan-500/20 text-[#00E5FF] border border-cyan-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Adsgram Settings</span>
                  {editableConfig.adProvider === 'adsgram' && (
                    <span className="text-[9px] bg-cyan-500 text-black px-1.5 py-0.2 rounded font-black">ACTIVE</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setMonetizeSubTab('monetag');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    monetizeSubTab === 'monetag'
                      ? 'bg-amber-500/20 text-[#FFE600] border border-amber-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Monetag Settings</span>
                  {editableConfig.adProvider === 'monetag' && (
                    <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-black">ACTIVE</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setMonetizeSubTab('dual');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    monetizeSubTab === 'dual'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dual View</span>
                </button>
              </div>

              {/* 3. DEDICATED ADSGRAM SECTION */}
              {(monetizeSubTab === 'adsgram' || monetizeSubTab === 'dual') && (
                <div className="p-4 bg-[#121824] border border-cyan-500/30 rounded-2xl space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#252D3D] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                        <Tv className="w-4 h-4 text-[#00E5FF]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                          <span>Adsgram Configuration</span>
                          {editableConfig.adProvider === 'adsgram' ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                              ● ACTIVE DEFAULT
                            </span>
                          ) : (
                            <span className="text-[9px] bg-gray-500/20 text-gray-400 border border-gray-500/40 px-2 py-0.5 rounded-full font-mono">
                              STANDBY
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-gray-400">
                          Official Telegram Mini App SDK integration parameters
                        </span>
                      </div>
                    </div>

                    {editableConfig.adProvider !== 'adsgram' && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic.impact('medium');
                          setEditableConfig({
                            ...editableConfig,
                            adProvider: 'adsgram',
                            adProviderSecret: editableConfig.adsgramBlockId || editableConfig.adProviderSecret || '50936'
                          });
                        }}
                        className="py-1 px-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-[#00E5FF] text-[10px] font-bold border border-cyan-500/40 transition-all"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>

                  {/* Adsgram Block / Zone ID */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-white uppercase flex items-center gap-1">
                        <span>Adsgram Ad Block / Zone ID</span>
                        <span className="text-red-400">*</span>
                      </label>
                      <span className="text-[10px] text-cyan-400 font-mono">window.Adsgram.init</span>
                    </div>
                    <input
                      type="text"
                      value={editableConfig.adsgramBlockId || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setEditableConfig({
                          ...editableConfig,
                          adsgramBlockId: val,
                          adProviderSecret: editableConfig.adProvider === 'adsgram' ? val : editableConfig.adProviderSecret
                        });
                      }}
                      placeholder="e.g. 50936 or int-12345"
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-[#00E5FF] focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Obtained from your official @AdsgramBot or publisher portal (e.g. 50936).
                    </span>
                  </div>

                  {/* Delay time & Frequency controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Bot Open Delay */}
                    <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#252D3D]">
                      <label className="text-[11px] font-bold text-white block mb-1">
                        Bot Open Delay (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editableConfig.adsgramInitialDelayMinutes ?? 3}
                        onChange={(e) => setEditableConfig({
                          ...editableConfig,
                          adsgramInitialDelayMinutes: Math.max(1, parseInt(e.target.value) || 3),
                          interstitialAdInitialDelayMinutes: Math.max(1, parseInt(e.target.value) || 3)
                        })}
                        className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-digits"
                      />
                      <span className="text-[10px] text-cyan-300 mt-1 block">
                        Strict 3-min rule: Ad displays ONLY after 3 minutes.
                      </span>
                    </div>

                    {/* Startup Ad Daily Limit */}
                    <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#252D3D]">
                      <label className="text-[11px] font-bold text-white block mb-1">
                        Startup Daily Limit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editableConfig.adsgramStartupDailyLimit ?? 1}
                        onChange={(e) => setEditableConfig({
                          ...editableConfig,
                          adsgramStartupDailyLimit: Math.max(0, parseInt(e.target.value) || 0)
                        })}
                        className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-digits"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        Max startup ad views per user / day (default: 1).
                      </span>
                    </div>

                    {/* Claim Mining Reward Ad Daily Limit */}
                    <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#252D3D]">
                      <label className="text-[11px] font-bold text-white block mb-1">
                        Claim Ad Daily Limit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editableConfig.adsgramClaimDailyLimit ?? 1}
                        onChange={(e) => setEditableConfig({
                          ...editableConfig,
                          adsgramClaimDailyLimit: Math.max(0, parseInt(e.target.value) || 0)
                        })}
                        className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-digits"
                      />
                      <span className="text-[10px] text-emerald-400 mt-1 block font-semibold">
                        Default 1: Ad shows ONLY on 1st claim of day!
                      </span>
                    </div>
                  </div>

                  {/* Adsgram Specific Rule Summary */}
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-1.5 text-[11px] text-gray-300">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Active Adsgram Protocol Rules</span>
                    </div>
                    <ul className="space-y-1 text-[10px] text-gray-300 pl-4 list-disc">
                      <li>
                        <strong className="text-white">Bot Open Ad:</strong> Triggers strictly after {editableConfig.adsgramInitialDelayMinutes || 3} minutes of opening the bot, frequency-capped at {editableConfig.adsgramStartupDailyLimit ?? 1} view(s)/day.
                      </li>
                      <li>
                        <strong className="text-white">Claim Reward Ad:</strong> Triggers strictly on the <em>first</em> mining claim of the day (limit: {editableConfig.adsgramClaimDailyLimit ?? 1}/day). If user claims 3-4 times later in the day, ZERO ads are shown!
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 4. DEDICATED MONETAG SECTION */}
              {(monetizeSubTab === 'monetag' || monetizeSubTab === 'dual') && (
                <div className="p-4 bg-[#121824] border border-amber-500/30 rounded-2xl space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#252D3D] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-[#FFE600]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                          <span>Monetag Configuration</span>
                          {editableConfig.adProvider === 'monetag' ? (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono">
                              ● ACTIVE DEFAULT
                            </span>
                          ) : (
                            <span className="text-[9px] bg-gray-500/20 text-gray-400 border border-gray-500/40 px-2 py-0.5 rounded-full font-mono">
                              STANDBY
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-gray-400">
                          Programmatic ad tag and web fallback parameters
                        </span>
                      </div>
                    </div>

                    {editableConfig.adProvider !== 'monetag' && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic.impact('medium');
                          setEditableConfig({
                            ...editableConfig,
                            adProvider: 'monetag',
                            adProviderSecret: editableConfig.monetagZoneId || editableConfig.adProviderSecret || '7894561'
                          });
                        }}
                        className="py-1 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[#FFE600] text-[10px] font-bold border border-amber-500/40 transition-all"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>

                  {/* Monetag Zone ID / Tag Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-white uppercase flex items-center gap-1">
                        <span>Monetag Ad ID / Zone Key</span>
                        <span className="text-red-400">*</span>
                      </label>
                      <span className="text-[10px] text-[#FFE600] font-mono">Publisher Zone</span>
                    </div>
                    <input
                      type="text"
                      value={editableConfig.monetagZoneId || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setEditableConfig({
                          ...editableConfig,
                          monetagZoneId: val,
                          adProviderSecret: editableConfig.adProvider === 'monetag' ? val : editableConfig.adProviderSecret
                        });
                      }}
                      placeholder="e.g. 7894561"
                      className="w-full bg-[#0B0E14] border border-[#252D3D] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-[#FFE600] focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Publisher Zone ID from your Monetag dashboard.
                    </span>
                  </div>

                  {/* Delay time & Frequency controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Bot Open Delay */}
                    <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#252D3D]">
                      <label className="text-[11px] font-bold text-white block mb-1">
                        Bot Open Delay (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editableConfig.monetagInitialDelayMinutes ?? 3}
                        onChange={(e) => setEditableConfig({
                          ...editableConfig,
                          monetagInitialDelayMinutes: Math.max(1, parseInt(e.target.value) || 3)
                        })}
                        className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-digits"
                      />
                      <span className="text-[10px] text-amber-300 mt-1 block">
                        Delay after entering bot (default: 3 minutes).
                      </span>
                    </div>

                    {/* Startup Ad Daily Limit */}
                    <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#252D3D]">
                      <label className="text-[11px] font-bold text-white block mb-1">
                        Startup Daily Limit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editableConfig.monetagStartupDailyLimit ?? 1}
                        onChange={(e) => setEditableConfig({
                          ...editableConfig,
                          monetagStartupDailyLimit: Math.max(0, parseInt(e.target.value) || 0)
                        })}
                        className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-digits"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        Max startup impressions per user/day.
                      </span>
                    </div>

                    {/* Claim Reward Ad Daily Limit */}
                    <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#252D3D]">
                      <label className="text-[11px] font-bold text-white block mb-1">
                        Claim Ad Daily Limit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editableConfig.monetagClaimDailyLimit ?? 1}
                        onChange={(e) => setEditableConfig({
                          ...editableConfig,
                          monetagClaimDailyLimit: Math.max(0, parseInt(e.target.value) || 0)
                        })}
                        className="w-full bg-[#121824] border border-[#252D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-digits"
                      />
                      <span className="text-[10px] text-amber-400 mt-1 block font-semibold">
                        Daily frequency cap for claim reward ad.
                      </span>
                    </div>
                  </div>

                  {/* Monetag Specific Rule Summary */}
                  <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-1.5 text-[11px] text-gray-300">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Monetag Programmatic Policy</span>
                    </div>
                    <ul className="space-y-1 text-[10px] text-gray-300 pl-4 list-disc">
                      <li>
                        Independent delay timer ({editableConfig.monetagInitialDelayMinutes || 3} min) and daily impression cap ({editableConfig.monetagStartupDailyLimit ?? 1} startup + {editableConfig.monetagClaimDailyLimit ?? 1} claim).
                      </li>
                      <li>
                        Can be toggled as primary or used seamlessly in multi-platform campaigns.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Quick Actions & Reset */}
              <div className="flex items-center justify-between p-3 bg-[#0B0E14] rounded-xl border border-[#252D3D]">
                <span className="text-[11px] text-gray-400">
                  Restore standard rules (3 min startup delay, 1x/day startup ad, 1st claim only)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    haptic.impact('medium');
                    setEditableConfig({
                      ...editableConfig,
                      adsgramInitialDelayMinutes: 3,
                      adsgramStartupDailyLimit: 1,
                      adsgramClaimDailyLimit: 1,
                      monetagInitialDelayMinutes: 3,
                      monetagStartupDailyLimit: 1,
                      monetagClaimDailyLimit: 1,
                      interstitialAdInitialDelayMinutes: 3,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-bold border border-gray-600 transition-all"
                >
                  Reset Defaults
                </button>
              </div>

              {/* Live Database Sync notice */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/30 to-[#0B0E14] border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-gray-300 leading-relaxed">
                  <span className="font-bold text-emerald-300 block">Live Database Override & Real-Time Sync:</span>
                  Saving ad settings immediately updates MongoDB Atlas and broadcasts active ad parameters to all connected Mini App sessions without server restart or downtime.
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-blue-600 hover:from-[#00E5FF]/90 hover:to-blue-500 text-black font-black text-xs flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-[0.99]"
              >
                <Save className="w-4 h-4" />
                <span>Save Monetization Settings</span>
              </button>
            </div>
          )}

          {/* TAB 9: ANTI-CHEAT & REGISTERED USERS */}
          {activeAdminTab === 'antiCheat' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Anti-Cheat & Node Registry</h3>
                <span className="text-[11px] text-gray-400">Inspect device fingerprints, IP protocols, and toggle account sanctions</span>
              </div>

              <div className="space-y-2">
                {usersList.map((u) => (
                  <div
                    key={u.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                      u.isFlagged
                        ? 'bg-red-950/20 border-red-500/50'
                        : 'bg-[#121824] border-[#252D3D]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">@{u.username || 'unknown'}</span>
                        <span className="text-[10px] text-gray-400 font-mono-digits">(ID: {u.telegramId})</span>
                        {u.isFlagged && (
                          <span className="text-[9px] bg-red-500 text-white font-black px-1.5 py-0.2 rounded uppercase">
                            FLAGGED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 space-x-2 font-mono-digits">
                        <span>Balance: {u.balancePOP.toFixed(2)} POP</span>
                        <span>•</span>
                        <span>IP: {u.ipAddress}</span>
                        <span>•</span>
                        <span>FP: {u.deviceFingerprint.slice(0, 10)}...</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleUserFlag(u.id, u.isFlagged)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                        u.isFlagged
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
                          : 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30'
                      }`}
                    >
                      {u.isFlagged ? 'Unflag Account' : 'Flag Cheat'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* DETAILED USER PROFILE MODAL */}
        {selectedUserProfile && (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <div className="w-full max-w-2xl bg-[#0F1420] border-2 border-[#252D3D] rounded-3xl p-5 shadow-2xl overflow-y-auto max-h-[90vh] space-y-4 text-xs">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-[#1E2638] pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-blue-600/30 border border-[#00E5FF]/40 flex items-center justify-center text-white font-black text-base shrink-0">
                    {(selectedUserProfile.firstName || selectedUserProfile.username || 'M').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        {[selectedUserProfile.firstName, selectedUserProfile.lastName].filter(Boolean).join(' ') || selectedUserProfile.username || 'Miner'}
                      </h3>
                      {selectedUserProfile.isFlagged && (
                        <span className="text-[9px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded uppercase">
                          FLAGGED
                        </span>
                      )}
                      {selectedUserProfile.isActiveMiner && (
                        <span className="text-[9px] bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/40 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" /> ACTIVE MINER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-gray-400 font-mono-digits text-[11px]">
                      <span>@{selectedUserProfile.username || 'no_username'}</span>
                      <span>•</span>
                      <span>TG ID: {selectedUserProfile.telegramId}</span>
                      <button
                        onClick={() => handleCopyText(selectedUserProfile.telegramId, `modal-tg-${selectedUserProfile.telegramId}`)}
                        className="p-1 hover:text-[#00E5FF] text-gray-500 rounded"
                        title="Copy Telegram ID"
                      >
                        {copiedId === `modal-tg-${selectedUserProfile.telegramId}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUserProfile(null)}
                  className="p-1.5 text-gray-400 hover:text-white bg-[#121824] border border-[#252D3D] rounded-xl"
                >
                  ✕
                </button>
              </div>

              {/* Balances & Mining Metric Row */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Lifetime Mined</span>
                  <div className="text-base font-black text-[#FFE600] font-mono-digits mt-0.5">
                    {(selectedUserProfile.totalMined || 0).toFixed(2)} $POP
                  </div>
                  <span className="text-[10px] text-gray-500 block mt-0.5 font-mono-digits">
                    Fleet Level: {selectedUserProfile.minerLevel || 1}
                  </span>
                </div>

                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Claimed Balance</span>
                  <div className="text-base font-black text-emerald-400 font-mono-digits mt-0.5">
                    {(selectedUserProfile.balancePOP || 0).toFixed(2)} $POP
                  </div>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Available for withdrawal
                  </span>
                </div>

                <div className="p-3 bg-[#121824] border border-[#252D3D] rounded-2xl">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Unclaimed Balance</span>
                  <div className="text-base font-black text-[#00E5FF] font-mono-digits mt-0.5">
                    {((selectedUserProfile.unclaimedMiningPOP || 0) + (selectedUserProfile.unclaimedSquadPOP || 0)).toFixed(2)} $POP
                  </div>
                  <span className="text-[10px] text-gray-500 block mt-0.5 font-mono-digits">
                    Tier {selectedUserProfile.storageTier || 1} Storage
                  </span>
                </div>
              </div>

              {/* Account Credentials & Protocol Status */}
              <div className="p-3.5 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2.5">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Account Credentials & Verification</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  
                  {/* Joining Date */}
                  <div className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between">
                    <span className="text-gray-400 text-[11px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>Joining Date:</span>
                    </span>
                    <span className="font-mono-digits font-bold text-white">
                      {formatDateDDMMYYYY(selectedUserProfile.createdAt)}
                    </span>
                  </div>

                  {/* Channel Status */}
                  <div className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between">
                    <span className="text-gray-400 text-[11px] flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Channel Status:</span>
                    </span>
                    {selectedUserProfile.isChannelJoined ? (
                      <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Joined & Verified
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Not Joined
                      </span>
                    )}
                  </div>

                  {/* Mining Status */}
                  <div className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between">
                    <span className="text-gray-400 text-[11px] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#FFE600]" />
                      <span>Mining Activity:</span>
                    </span>
                    {selectedUserProfile.isMining ? (
                      <span className="text-[#FFE600] font-bold text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#FFE600] animate-pulse" />
                        Actively Mining
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">
                        Idle / Storage Filled
                      </span>
                    )}
                  </div>

                  {/* Active Miner Status */}
                  <div className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between">
                    <span className="text-gray-400 text-[11px] flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-purple-400" />
                      <span>Protocol Status:</span>
                    </span>
                    {selectedUserProfile.isActiveMiner ? (
                      <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Active Miner Qualified
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">
                        Standard Member
                      </span>
                    )}
                  </div>
                </div>

                {/* TON Wallet Address Box */}
                <div className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-[11px] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Connected TON Wallet:</span>
                    </span>
                    {selectedUserProfile.tonWalletAddress ? (
                      <button
                        onClick={() => handleCopyText(selectedUserProfile.tonWalletAddress!, 'modal-wallet')}
                        className="text-[10px] text-[#00E5FF] hover:underline flex items-center gap-1 font-semibold"
                      >
                        {copiedId === 'modal-wallet' ? (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Copied
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <Copy className="w-3 h-3" /> Copy Address
                          </span>
                        )}
                      </button>
                    ) : null}
                  </div>
                  {selectedUserProfile.tonWalletAddress ? (
                    <div className="font-mono-digits text-[11px] text-white break-all bg-[#121824] p-2 rounded-lg border border-[#252D3D]">
                      {selectedUserProfile.tonWalletAddress}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 italic">
                      No TON Wallet connected yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Lifetime Referrals Section */}
              <div className="p-3.5 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Lifetime Referrals ({selectedUserProfile.referrals?.length ?? selectedUserProfile.referralCount ?? 0})</span>
                  </h4>
                  <span className="text-[10px] text-gray-400">
                    Earns {editableConfig.referralCommissionPercent}% mining commission
                  </span>
                </div>

                {!selectedUserProfile.referrals || selectedUserProfile.referrals.length === 0 ? (
                  <div className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-center text-gray-500 text-[11px]">
                    No referred users recorded for this account.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {selectedUserProfile.referrals.map((ref, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#0B0E14] border border-[#1E2638] rounded-xl flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-mono-digits">{idx + 1}.</span>
                          <div>
                            <span className="font-bold text-white">
                              {ref.username ? `@${ref.username}` : 'Referred Miner'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono-digits ml-1.5">
                              (TG: {ref.telegramId})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-mono-digits text-[10px]">
                            {formatDateDDMMYYYY(ref.joinedAt)}
                          </span>
                          {ref.isQualified ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                              Qualified
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Withdrawal Logs Section */}
              <div className="p-3.5 bg-[#121824] border border-[#252D3D] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-red-400" />
                    <span>Withdrawal Logs ({selectedUserProfile.withdrawals?.length || 0})</span>
                  </h4>
                </div>

                {!selectedUserProfile.withdrawals || selectedUserProfile.withdrawals.length === 0 ? (
                  <div className="p-3 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-center text-gray-500 text-[11px]">
                    No withdrawal requests submitted by this user.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {selectedUserProfile.withdrawals.map((w, idx) => (
                      <div
                        key={w.id || idx}
                        className="p-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl space-y-1 text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-mono-digits flex-wrap">
                            <span className="font-bold text-white">{w.grossAmount ?? w.amountPOP} POP</span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              (Net: {w.netAmount ?? w.netAmountPOP} POP)
                            </span>
                            <span className="text-[10px] text-[#00E5FF]">
                              (${((w.netUsdtValue ?? ((w.netAmount ?? w.netAmountPOP) * (editableConfig.popUsdRate || 0.001)))).toFixed(3)} USDT)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-mono-digits">
                              {formatDateDDMMYYYY(w.createdAt)}
                            </span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                w.status === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : w.status === 'APPROVED'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                  : w.status === 'REJECTED'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {w.status}
                            </span>
                          </div>
                        </div>

                        {w.txHash && (
                          <div className="text-[10px] text-gray-400 font-mono-digits break-all">
                            TX: {w.txHash}
                          </div>
                        )}
                        {w.adminNote && (
                          <div className="text-[10px] text-gray-400 italic">
                            Note: {w.adminNote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1E2638]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const userObj = usersList.find((u) => u.telegramId === selectedUserProfile.telegramId) || (selectedUserProfile as any);
                      setSelectedTargetUser(userObj);
                      setActiveAdminTab('balance');
                      setSelectedUserProfile(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#FFE600] text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 hover:brightness-110 transition-all"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Adjust Balance / Bonus</span>
                  </button>

                  <button
                    onClick={async () => {
                      await handleToggleUserFlag(selectedUserProfile.id, selectedUserProfile.isFlagged);
                      setSelectedUserProfile((prev) => prev ? { ...prev, isFlagged: !prev.isFlagged } : null);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      selectedUserProfile.isFlagged
                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                        : 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
                    }`}
                  >
                    {selectedUserProfile.isFlagged ? 'Unflag Account' : 'Flag Sybil Cheat'}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedUserProfile(null)}
                  className="px-4 py-2 rounded-xl bg-[#121824] border border-[#252D3D] text-gray-300 hover:text-white font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
