import {
  User,
  MinerTier,
  AdminConfig,
  EcosystemTask,
  ReferralUserItem,
  WeeklyPodiumUser,
  GlobalLeaderboardUser,
  WithdrawalRequest,
  AuditLog,
  AdminAnalytics,
  AdminStatsResponse,
  AdminUsersResponse,
  AdminUserListItem,
  TokenSupplyStats
} from '../types.js';

class ApiService {
  private telegramId: string = '998811223';
  private referralCode: string = '';
  private fingerprint: string = '';
  private adminKey: string = 'Sujonborsha';
  private adminToken: string = '';

  public setReferralCode(code: string) {
    this.referralCode = code;
  }

  public getReferralCode(): string {
    return this.referralCode;
  }

  constructor() {
    // Generate or retrieve persistent device fingerprint based on hardware/browser properties
    let fp = localStorage.getItem('pop_device_fp');
    if (!fp) {
      const components = [
        navigator.userAgent || '',
        navigator.language || '',
        screen.width + 'x' + screen.height,
        screen.colorDepth || '',
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        (navigator as any).hardwareConcurrency || '',
        (navigator as any).deviceMemory || ''
      ].join('###');
      
      let hash = 0;
      for (let i = 0; i < components.length; i++) {
        hash = (hash << 5) - hash + components.charCodeAt(i);
        hash |= 0;
      }
      fp = 'dfp_' + Math.abs(hash).toString(16) + '_' + Math.random().toString(36).substring(2, 8);
      try {
        localStorage.setItem('pop_device_fp', fp);
      } catch {}
    }
    this.fingerprint = fp;

    const savedAdminKey = localStorage.getItem('pop_admin_key');
    if (savedAdminKey) {
      this.adminKey = savedAdminKey;
    }

    const savedToken = sessionStorage.getItem('pop_admin_jwt') || localStorage.getItem('pop_admin_jwt');
    if (savedToken) {
      this.adminToken = savedToken;
    }
  }

  public setTelegramId(id: string) {
    this.telegramId = id;
  }

  public getTelegramId(): string {
    return this.telegramId;
  }

  public setAdminKey(key: string) {
    this.adminKey = key;
  }

  public getAdminKey(): string {
    return this.adminKey;
  }

  public setAdminToken(token: string) {
    this.adminToken = token;
    sessionStorage.setItem('pop_admin_jwt', token);
    localStorage.setItem('pop_admin_jwt', token);
  }

  public getAdminToken(): string {
    return this.adminToken;
  }

  public clearAdminToken() {
    this.adminToken = '';
    sessionStorage.removeItem('pop_admin_jwt');
    localStorage.removeItem('pop_admin_jwt');
  }

  private getHeaders(adminKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-telegram-id': this.telegramId,
      'x-device-fingerprint': this.fingerprint,
    };
    if (this.referralCode) {
      headers['x-referral-code'] = this.referralCode;
    }
    const tgPlatform = (window as any).Telegram?.WebApp?.platform || '';
    if (tgPlatform) {
      headers['x-telegram-platform'] = tgPlatform;
    }
    if (this.adminToken) {
      headers['Authorization'] = `Bearer ${this.adminToken}`;
      headers['x-admin-token'] = this.adminToken;
    }
    const key = adminKey || this.adminKey;
    if (key) {
      headers['x-admin-key'] = key;
    }
    return headers;
  }

  // Initial user setup API request (/api/user/init)
  public async initUser(params?: { start_param?: string; referrerId?: string; startapp?: string; start?: string; devUser?: Partial<User> }): Promise<{ user: User; isNew: boolean; config: AdminConfig }> {
    const initData = window.Telegram?.WebApp?.initData || '';
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const detectedDevUser = params?.devUser || (tgUser ? {
      id: String(tgUser.id),
      username: tgUser.username || `user_${String(tgUser.id).slice(-4)}`,
      firstName: tgUser.first_name || 'POP Miner',
      lastName: tgUser.last_name || '',
      photoUrl: tgUser.photo_url || '',
    } : undefined);

    if (tgUser?.id) {
      this.telegramId = String(tgUser.id);
    }

    const start_param =
      params?.start_param ||
      params?.referrerId ||
      params?.startapp ||
      params?.start ||
      localStorage.getItem('pop_referral_code') ||
      localStorage.getItem('pop_referrer_id') ||
      undefined;

    const res = await fetch('/api/user/init', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        initData,
        devUser: detectedDevUser,
        start_param,
        referrerId: start_param,
        startapp: start_param,
        start: start_param,
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to initialize user session');
    this.telegramId = data.user.telegramId;
    if (data.user.referralCode) {
      this.referralCode = data.user.referralCode;
    }
    return data;
  }

  // Auth / Session Init & User Registration (calls /api/user/init)
  public async initSession(devUser?: Partial<User>, referrerId?: string): Promise<{ user: User; isNew: boolean; config: AdminConfig }> {
    return this.initUser({ devUser, referrerId, start_param: referrerId });
  }

  // Explicit User Registration endpoint (/api/users/register)
  public async registerUser(devUser?: Partial<User>, referrerId?: string): Promise<{ user: User; isNew: boolean; config: AdminConfig }> {
    const initData = window.Telegram?.WebApp?.initData || '';
    const resolvedReferrerId = referrerId || localStorage.getItem('pop_referrer_id') || undefined;

    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ initData, devUser, referrerId: resolvedReferrerId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to register user');
    this.telegramId = data.user.telegramId;
    return data;
  }

  // Get current user profile
  public async getMe(): Promise<{ user: User; config: AdminConfig }> {
    const res = await fetch('/api/user/me', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get user');
    return data;
  }

  // Connect TON Wallet
  public async connectWallet(tonAddress: string): Promise<User> {
    const res = await fetch('/api/user/wallet/connect', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ tonAddress })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to connect wallet');
    return data.user;
  }

  // Disconnect TON Wallet
  public async disconnectWallet(): Promise<User> {
    const res = await fetch('/api/user/wallet/disconnect', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to disconnect wallet');
    return data.user;
  }

  // Verify Telegram Channel Membership
  public async verifyTelegramChannel(): Promise<{ success: boolean; isMember: boolean; user: User; message: string }> {
    const res = await fetch('/api/user/verify-channel', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Telegram Channel membership verification failed');
    return data;
  }

  // Start Mining (Strictly checks wallet and channel verification)
  public async startMining(): Promise<User> {
    const res = await fetch('/api/mining/start', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to start mining');
    return data.user;
  }

  // Claim Mining Rewards
  public async claimMining(): Promise<{ user: User; claimedAmount: number; message: string }> {
    const res = await fetch('/api/mining/claim', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to claim mining');
    return data;
  }

  // Fetch All 50 Mining Fleet Levels
  public async getMiningLevels(): Promise<MinerTier[]> {
    const res = await fetch('/api/mining/levels', {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch mining levels');
    return data.levels;
  }

  // Upgrade Miner Speed Tier
  public async upgradeMiner(targetLevel: number): Promise<User> {
    const res = await fetch('/api/upgrade/miner', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ targetLevel })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upgrade miner');
    return data.user;
  }

  // Upgrade Storage Duration Matrix Tier
  public async upgradeStorage(targetTier: number): Promise<User> {
    const res = await fetch('/api/upgrade/storage', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ targetTier })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upgrade storage');
    return data.user;
  }

  // 7-Day Streak Daily Check-in
  public async dailyCheckIn(): Promise<{ user: User; rewardPOP: number; streak: number; message: string }> {
    const res = await fetch('/api/tasks/checkin', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Check-in failed');
    return data;
  }

  // Start countdown timer for task
  public async startTask(taskId: string): Promise<{ startedAt: number; claimDelaySeconds?: number; claimDelayMinutes?: number }> {
    const res = await fetch('/api/tasks/start', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ taskId })
    });
    const data = await res.json();
    if (!data.success) {
      const err = new Error(data.error || 'Failed to start task countdown');
      (err as any).code = data.code;
      throw err;
    }
    return data;
  }

  // Claim Ecosystem Task
  public async claimTask(taskId: string, elapsedSeconds?: number): Promise<{ user: User; rewardPOP: number; message: string }> {
    const res = await fetch('/api/tasks/claim', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ taskId, elapsedSeconds })
    });
    const data = await res.json();
    if (!data.success) {
      const err = new Error(data.error || 'Failed to claim task');
      (err as any).code = data.code;
      throw err;
    }
    return data;
  }

  // Complete Ecosystem Task (alias for claimTask)
  public async completeTask(taskId: string, elapsedSeconds?: number): Promise<{ user: User; rewardPOP: number; message: string }> {
    return this.claimTask(taskId, elapsedSeconds);
  }

  // Get Tasks
  public async getTasks(): Promise<EcosystemTask[]> {
    const res = await fetch('/api/tasks', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch tasks');
    return data.tasks;
  }

  // Retrieve & Display Existing/Previous Referrals from DB (/api/squad/my-referrals)
  public async getMyReferrals(filter?: string): Promise<{
    referrals: ReferralUserItem[];
    my_referral_list?: ReferralUserItem[];
    counts?: {
      total: number;
      pending: number;
      qualified: number;
      same_ip: number;
    };
    breakdown?: {
      totalJoined: number;
      pendingAction: number;
      qualified: number;
      unqualifiedSameIp: number;
    };
    total_joined?: number;
    pending_action?: number;
    qualified?: number;
    unqualified_same_ip?: number;
    referral_bonus?: number;
    weeklyLeaderboard: WeeklyPodiumUser[];
    contestConfig: {
      minThreshold: number;
      prizes: { first: number; second: number; third: number };
      commissionRate: number;
      unclaimedCommission: number;
      claimedCommission: number;
    };
  }> {
    const url = filter && filter !== 'ALL'
      ? `/api/squad/my-referrals?status=${encodeURIComponent(filter)}`
      : '/api/squad/my-referrals';
    const res = await fetch(url, {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch squad referrals');
    return data;
  }

  // Get Squad & Weekly Contest (/api/squad/my-referrals)
  public async getSquadData(): Promise<{
    referrals: ReferralUserItem[];
    my_referral_list?: ReferralUserItem[];
    counts?: {
      total: number;
      pending: number;
      qualified: number;
      same_ip: number;
    };
    breakdown?: {
      totalJoined: number;
      pendingAction: number;
      qualified: number;
      unqualifiedSameIp: number;
    };
    total_joined?: number;
    pending_action?: number;
    qualified?: number;
    unqualified_same_ip?: number;
    referral_bonus?: number;
    weeklyLeaderboard: WeeklyPodiumUser[];
    contestConfig: {
      minThreshold: number;
      prizes: { first: number; second: number; third: number };
      commissionRate: number;
      unclaimedCommission: number;
      claimedCommission: number;
    };
  }> {
    return this.getMyReferrals();
  }

  // Explicit Squad Stats endpoint
  public async getSquadStats() {
    return this.getMyReferrals();
  }

  // Claim Squad Commission
  public async claimSquadCommission(): Promise<{ user: User; claimedCommission: number; message: string }> {
    const res = await fetch('/api/squad/claim', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to claim squad commission');
    return data;
  }

  // Get Global Mining Leaderboard
  public async getGlobalLeaderboard(): Promise<GlobalLeaderboardUser[]> {
    const res = await fetch('/api/leaderboard/global', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch leaderboard');
    return data.leaderboard;
  }

  // Get Weekly Top Referral List (Saturday-to-Saturday cycle)
  public async getWeeklyLeaderboard(): Promise<{ cycle: { start: string; end: string }; leaderboard: WeeklyPodiumUser[] }> {
    const res = await fetch('/api/leaderboard/weekly', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch weekly leaderboard');
    return data;
  }

  // Alias for getGlobalLeaderboard returning wrapper object
  public async getLeaderboards(): Promise<{ globalLeaderboard: GlobalLeaderboardUser[] }> {
    const leaderboard = await this.getGlobalLeaderboard();
    return { globalLeaderboard: leaderboard };
  }

  // Submit Withdrawal
  public async submitWithdrawal(amountPOP: number, tonAddress: string): Promise<{ withdrawal: WithdrawalRequest; user: User; message: string }> {
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amountPOP, tonAddress })
    });
    const data = await res.json();
    if (!data.success) {
      const err = new Error(data.error || 'Failed to submit withdrawal');
      (err as any).code = data.code;
      throw err;
    }
    return data;
  }

  // Alias for submitWithdrawal
  public async requestWithdrawal(amountPOP: number, tonAddress: string): Promise<{ withdrawal: WithdrawalRequest; user: User; message: string }> {
    return this.submitWithdrawal(amountPOP, tonAddress);
  }

  // Get Withdrawals
  public async getWithdrawals(): Promise<WithdrawalRequest[]> {
    const res = await fetch('/api/withdrawals', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch withdrawals');
    return data.withdrawals;
  }

  // Admin APIs
  public async adminLogin(secretKey: string, telegramId?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const tid = telegramId || this.telegramId;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-telegram-id': tid
      },
      body: JSON.stringify({ secretKey, password: secretKey, telegramId: tid })
    });
    const data = await res.json();
    if (data.success && data.token) {
      this.setAdminToken(data.token);
      this.setAdminKey(secretKey);
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'Admin authentication failed' };
  }

  public async getAdminOverview(adminKey?: string): Promise<{
    config: AdminConfig;
    users: User[];
    withdrawals: WithdrawalRequest[];
    auditLogs: AuditLog[];
    analytics: AdminAnalytics;
  }> {
    const res = await fetch('/api/admin/overview', {
      headers: this.getHeaders(adminKey)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Admin fetch failed');
    return data;
  }

  // GET /api/admin/stats: Real-time protocol metrics { totalUsers, activeMiners, totalMined, totalWithdrawals }
  public async getAdminStats(adminKey?: string): Promise<AdminStatsResponse> {
    const res = await fetch('/api/admin/stats', {
      headers: this.getHeaders(adminKey)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Admin stats fetch failed');
    return data;
  }

  // GET /api/admin/token-stats: Real-time token supply metrics
  public async getTokenStats(adminKey?: string): Promise<TokenSupplyStats> {
    try {
      const res = await fetch('/api/admin/token-stats', {
        headers: this.getHeaders(adminKey)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Token stats fetch failed');
      return data;
    } catch {
      return {
        success: true,
        maxTotalSupply: 10000000,
        totalDistributed: 0,
        remainingSupply: 10000000,
        isCapReached: false,
      };
    }
  }

  // GET /api/admin/users: Paginated user management with search query
  public async getAdminUsers(
    params: { q?: string; page?: number; limit?: number },
    adminKey?: string
  ): Promise<AdminUsersResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetch(`/api/admin/users?${query.toString()}`, {
      headers: this.getHeaders(adminKey)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Admin users fetch failed');
    return data;
  }

  public async updateAdminConfig(config: Partial<AdminConfig>, adminKey?: string): Promise<AdminConfig> {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Admin update config failed');
    return data.config;
  }

  public async processWithdrawal(withdrawalId: string, action: 'approve' | 'reject' | 'paid'): Promise<WithdrawalRequest> {
    const status = action === 'approve' ? 'APPROVED' : action === 'paid' ? 'PAID' : 'REJECTED';
    return this.adminProcessWithdrawal(this.adminKey, {
      withdrawalId,
      status,
      adminNote: `Processed via Admin Command Center as ${status}`,
    });
  }

  public async toggleUserFlag(userId: string, isFlagged: boolean, reason?: string): Promise<User> {
    return this.adminToggleUserFlag(this.adminKey, {
      targetId: userId,
      isFlagged,
      reason: reason || (isFlagged ? 'Flagged via Admin' : 'Unflagged via Admin'),
    });
  }

  public async adminAdjustBalance(adminKey: string, params: {
    targetId: string;
    amountPOP: number;
    reasonNote: string;
    isBonusNotification?: boolean;
  }): Promise<User> {
    const res = await fetch('/api/admin/user/balance', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to adjust balance');
    return data.user;
  }

  public async adminBroadcastBonus(adminKey: string, params: {
    amountPOP: number;
    reasonNote: string;
  }): Promise<{ success: boolean; count: number; message: string }> {
    const res = await fetch('/api/admin/bonus/broadcast', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to broadcast bonus');
    return data;
  }

  public async adminToggleUserFlag(adminKey: string, params: {
    targetId: string;
    isFlagged: boolean;
    reason: string;
  }): Promise<User> {
    const res = await fetch('/api/admin/user/flag', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to toggle flag');
    return data.user;
  }

  public async adminProcessWithdrawal(adminKey: string, params: {
    withdrawalId: string;
    status: 'APPROVED' | 'REJECTED' | 'PAID' | 'COMPLETED';
    adminNote?: string;
    txHash?: string;
  }): Promise<WithdrawalRequest> {
    const res = await fetch('/api/admin/withdrawals/process', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to process withdrawal');
    return data.withdrawal;
  }

  public async adminGetMongoStatus(): Promise<{
    success: boolean;
    isConnected: boolean;
    status: 'connected' | 'connecting' | 'whitelist_required' | 'disconnected';
    error: string | null;
    cluster: string;
    containerIp: string | null;
    activeUri: string;
    database?: string;
  }> {
    const res = await fetch('/api/admin/mongodb/status', {
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  public async adminReconnectMongo(customUri?: string): Promise<{
    success: boolean;
    connected: boolean;
    message: string;
    containerIp?: string | null;
    status: string;
    error: string | null;
  }> {
    const res = await fetch('/api/admin/mongodb/reconnect', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ customUri }),
    });
    return await res.json();
  }

  // -------------------------------------------------------------------
  // ADMIN MINING LEVELS CONFIG (50 LEVELS)
  // -------------------------------------------------------------------

  public async adminGetMiningLevels(adminKey?: string): Promise<MinerTier[]> {
    const res = await fetch('/api/admin/mining/levels', {
      method: 'GET',
      headers: this.getHeaders(adminKey),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch admin mining levels');
    return data.levels;
  }

  public async adminUpdateMiningLevel(
    adminKey: string,
    level: number,
    payload: { speedPerHour: number; pricePOP: number; name?: string }
  ): Promise<MinerTier> {
    const res = await fetch(`/api/admin/mining/levels/${level}`, {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `Failed to update Level ${level}`);
    return data.level;
  }

  public async adminBulkUpdateMiningLevels(adminKey: string, levels: MinerTier[]): Promise<MinerTier[]> {
    const res = await fetch('/api/admin/mining/levels/bulk', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
      body: JSON.stringify({ levels }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to bulk update mining levels');
    return data.levels;
  }

  public async adminResetMiningLevels(adminKey?: string): Promise<MinerTier[]> {
    const res = await fetch('/api/admin/mining/levels/reset', {
      method: 'POST',
      headers: this.getHeaders(adminKey),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to reset mining levels');
    return data.levels;
  }
}

export const api = new ApiService();
