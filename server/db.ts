import fs from 'fs';
import path from 'path';
import {
  User,
  MinerTier,
  StorageTier,
  EcosystemTask,
  ReferralUserItem,
  ReferralStatus,
  WeeklyPodiumUser,
  GlobalLeaderboardUser,
  WithdrawalRequest,
  AdminConfig,
  AuditLog,
  AppTransaction,
  TransactionType
} from '../src/types.js';
import {
  syncUserToMongo,
  logReferralInMongo,
  verifyAndQualifyReferralInMongo,
  adjustUserPointsInMongo,
  saveSystemSettingsToMongo,
  loadSystemSettingsFromMongo,
  getMongoStatus,
  mapMongoDocToUser,
  logTransactionInMongo,
  getTransactionsFromMongo,
  loadMiningLevelsFromMongo,
  saveMiningLevelToMongo,
  saveBulkMiningLevelsToMongo,
  getWeeklyCycleBounds
} from './mongoRepo.js';
import { generateDefaultMiningLevels } from './seedMiningLevels.js';
import { isMongoConnected, onMongoConnected } from './mongoose.js';
import { UserModel, ReferralLogModel, TransactionModel, MiningLevelModel } from './models/index.js';

/**
 * Filter out dummy/mock seed users so protocol stats reflect ONLY real registered accounts.
 */
export function isMockOrDummyUser(u: { telegramId?: string; telegram_id?: string; username?: string; id?: string; firstName?: string }): boolean {
  const tgId = String(u.telegramId || u.telegram_id || '').trim();
  const username = String(u.username || '').toLowerCase().trim().replace(/^@/, '');
  const id = String(u.id || '').trim();

  // Known mock seed Telegram IDs
  const dummyTgIds = new Set([
    '998811223', '111222333', '444555666', '1001', '2002', '3003',
    '8001', '8002', '8003', '111111111', '222222222', '333333333',
    '900000001', '900000002', '900000003', '123456789', '888123456',
    '9876543210', '5559290535', '1234567890', '987654123', '888999111'
  ]);

  if (dummyTgIds.has(tgId) || dummyTgIds.has(id.replace(/^usr-/, ''))) return true;
  if (tgId.startsWith('alice_') || tgId.startsWith('bob_') || tgId.startsWith('charlie_') || tgId.startsWith('test_')) return true;
  if (id.startsWith('usr-alice_') || id.startsWith('usr-bob_') || id.startsWith('usr-charlie_')) return true;

  // Known mock usernames
  const dummyUsernames = new Set([
    'referrer_boss', 'master_miner', 'top_inviter', 'crypto_star_99',
    'satoshi_friend', 'tester_pro', 'test_invited_user', 'crypto_newbie',
    'pop_ton_explorer', 'usera_crypto', 'userb_miner', 'userc_fraud',
    'user_alpha', 'user_beta', 'user_a', 'user_b', 'user_c_clone',
    'alice_miner', 'bob_miner', 'charlie_clone', 'alice_fresh', 'bob_fresh', 'charlie_fresh'
  ]);

  if (dummyUsernames.has(username)) return true;
  if (username.startsWith('user_') && ['user_a', 'user_b', 'user_c', 'user_alpha', 'user_beta', 'user_clone'].some(p => username.includes(p))) {
    return true;
  }

  return false;
}

export const defaultEcosystemTasks: EcosystemTask[] = [
  {
    id: 'task-tg-channel',
    title: 'Join POP Official Telegram Channel',
    category: 'telegram',
    rewardPOP: 5,
    url: 'https://t.me/telegram',
    completed: false,
    requiresVerification: true,
    claimDelaySeconds: 0,
    claimDelayMinutes: 0,
  },
  {
    id: 'task-yt-sub',
    title: 'Subscribe to POP Official YouTube',
    category: 'youtube',
    rewardPOP: 5,
    url: 'https://youtube.com',
    completed: false,
    requiresVerification: true,
    claimDelaySeconds: 0,
    claimDelayMinutes: 0,
  },
  {
    id: 'task-x-follow',
    title: 'Follow POP Ecosystem on X (Twitter)',
    category: 'x',
    rewardPOP: 5,
    url: 'https://x.com',
    completed: false,
    requiresVerification: true,
    claimDelaySeconds: 0,
    claimDelayMinutes: 0,
  },
  {
    id: 'task-roadmap',
    title: 'Read POP Tokenomics & Roadmap v1',
    category: 'announcement',
    rewardPOP: 10,
    url: 'https://t.me/telegram',
    completed: false,
    requiresVerification: true,
    claimDelaySeconds: 0,
    claimDelayMinutes: 0,
  },
  {
    id: 'task-invite-3',
    title: 'Invite 3 Friends to Squad Matrix',
    category: 'telegram',
    rewardPOP: 25,
    url: '#squad',
    completed: false,
    claimDelaySeconds: 0,
    claimDelayMinutes: 0,
  }
];

// Default Admin Configuration (50 Mining Fleet Levels)
export const defaultAdminConfig: AdminConfig = {
  popUsdRate: 0.001, // 100 POP = $0.10 USDT
  minerTiers: generateDefaultMiningLevels(0.001),
  storageTiers: [
    { tier: 1, name: 'Tier 1 Standard Cache', durationHours: 6, pricePOP: 0, priceUSD: 0.00 },
    { tier: 2, name: 'Tier 2 Extended Vault', durationHours: 12, pricePOP: 150, priceUSD: 0.15 },
    { tier: 3, name: 'Tier 3 Reinforced Silo', durationHours: 18, pricePOP: 380, priceUSD: 0.38 },
    { tier: 4, name: 'Tier 4 Cyber Matrix', durationHours: 24, pricePOP: 850, priceUSD: 0.85 },
    { tier: 5, name: 'Tier 5 Deep Cold Bunker', durationHours: 36, pricePOP: 1800, priceUSD: 1.80 },
    { tier: 6, name: 'Tier 6 Quantum Containment', durationHours: 48, pricePOP: 3500, priceUSD: 3.50 },
  ],
  instantReferralBonusPOP: 0,
  referral_bonus: 0,
  referralBonusAmount: 0,
  referralCommissionPercent: 0,
  squadCommissionRate: 0,
  weeklyContestMinThreshold: 40,
  weeklyPrizesUsdt: {
    first: 1.00, // $1.00 USDT value in POP
    second: 0.60, // $0.60 USDT value in POP
    third: 0.30, // $0.30 USDT value in POP
  },
  withdrawalFeePercent: 5,
  minWithdrawAmount: 100,
  maxWithdrawAmount: 50000,
  mandatoryTelegramChannel: process.env.COMMUNITY_URL ? (process.env.COMMUNITY_URL.includes('t.me/') ? '@' + process.env.COMMUNITY_URL.split('t.me/')[1] : process.env.COMMUNITY_URL) : '@PopCornUSA_bot',
  mandatoryChannelLink: process.env.COMMUNITY_URL || 'https://t.me/PopCornUSA_bot',
  channelUrl: process.env.COMMUNITY_URL || 'https://t.me/PopCornUSA_bot',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ? process.env.TELEGRAM_BOT_USERNAME.replace('@', '').trim() : 'PopCornUSA_bot',
  botUsername: process.env.TELEGRAM_BOT_USERNAME ? process.env.TELEGRAM_BOT_USERNAME.replace('@', '').trim() : 'PopCornUSA_bot',
  telegramSupportUsername: process.env.SUPPORT_USERNAME || '@PopCornUSA_BOT',
  telegramSupportUrl: process.env.SUPPORT_USERNAME ? `https://t.me/${process.env.SUPPORT_USERNAME.replace('@', '')}` : 'https://t.me/PopCornUSA_BOT',
  whatsappSupportNumber: '+1 (555) 019-2834',
  whatsappSupportUrl: process.env.WHATSAPP_SUPPORT_URL || 'https://wa.me/15550192834',
  antiCheatEnabled: true,
  tasks: defaultEcosystemTasks,
  adProvider: (process.env.AD_PROVIDER as any) || 'adsgram',
  adProviderSecret: process.env.AD_PROVIDER_SECRET || '50936',
  adsDailyCap: 4,
  interstitialAdIntervalMinutes: 5,
  interstitialAdInitialDelayMinutes: 0,
  adsgramBlockId: process.env.AD_PROVIDER_SECRET || '50936',
  adsgramInitialDelayMinutes: 0,
  adsgramStartupDailyLimit: 1,
  adsgramClaimDailyLimit: 1,
  monetagZoneId: '7894561',
  monetagInitialDelayMinutes: 0,
  monetagStartupDailyLimit: 1,
  monetagClaimDailyLimit: 1,
};

export function generateAlphanumericReferralCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

class DatabaseEngine {
  private users: Map<string, User> = new Map(); // key = telegramId or id
  private referralCodes: Map<string, string> = new Map(); // key = uppercase referral code, value = telegramId or id
  private referrals: Map<string, ReferralUserItem[]> = new Map(); // key = inviterId, value = list of referred users
  private withdrawals: WithdrawalRequest[] = [];
  private transactions: Map<string, AppTransaction[]> = new Map(); // key = userId or telegramId
  private completedTasks: Map<string, Set<string>> = new Map(); // key = userId, value = set of taskIds
  private config: AdminConfig = { ...defaultAdminConfig };
  private auditLogs: AuditLog[] = [];
  private ipHistory: Map<string, string[]> = new Map(); // key = ip, value = userIds
  private fingerprintHistory: Map<string, string[]> = new Map(); // key = fingerprint, value = userIds
  private taskStartTimes: Map<string, number> = new Map(); // key = userId_taskId, value = start timestamp

  private snapshotFilePath = path.join(process.cwd(), '.local_data_store.json');
  private snapshotTimeout: NodeJS.Timeout | null = null;

  public generateUniqueReferralCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const code = generateAlphanumericReferralCode().toUpperCase();
      if (code.length === 8 && !this.referralCodes.has(code)) {
        return code;
      }
    }
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let fallback = '';
    for (let i = 0; i < 8; i++) {
      fallback += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return fallback;
  }

  public getUserByReferralCode(rawCode: string | null | undefined): User | undefined {
    if (!rawCode) return undefined;
    const clean = String(rawCode).replace(/^ref[_-]/i, '').trim().toUpperCase();
    if (!clean) return undefined;

    // 1. Direct indexed referral code lookup
    const targetId = this.referralCodes.get(clean);
    if (targetId) {
      const user = this.getUser(targetId);
      if (user) return user;
    }

    // 2. Linear scan of loaded users for matching referral code
    for (const u of this.users.values()) {
      if (u.referralCode && u.referralCode.toUpperCase() === clean) {
        this.referralCodes.set(clean, u.telegramId);
        return u;
      }
    }

    // 3. Fallback to Telegram ID or internal ID for legacy referral links
    const byId = this.getUser(clean) || this.getUser(String(rawCode).replace(/^ref[_-]/i, '').trim());
    if (byId) return byId;

    return undefined;
  }

  public addUserFromMongo(user: User): User {
    if (!user.referralCode || user.referralCode.length !== 8) {
      user.referralCode = this.generateUniqueReferralCode();
    }
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    this.referralCodes.set(user.referralCode.toUpperCase(), user.telegramId);
    return user;
  }

  public saveUser(user: User): User {
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    if (user.referralCode) {
      this.referralCodes.set(user.referralCode.toUpperCase(), user.telegramId);
    }
    return user;
  }

  constructor() {
    this.seedInitialData();
    this.loadLocalSnapshot();
    
    // Attempt initial MongoDB sync if already connected
    if (isMongoConnected()) {
      this.initMongoSync();
    }

    // Automatically sync when MongoDB connects or reconnects
    onMongoConnected(() => {
      console.log('[DB Engine] MongoDB Atlas is online. Syncing database records...');
      this.initMongoSync().then(() => {
        this.syncAllLocalToMongo();
      });
    });
  }

  // Load offline persistent snapshot from disk
  private loadLocalSnapshot() {
    try {
      if (fs.existsSync(this.snapshotFilePath)) {
        const raw = fs.readFileSync(this.snapshotFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.users && Array.isArray(data.users)) {
          for (const u of data.users) {
            // Strictly exclude mock/dummy seed users from memory cache
            if (isMockOrDummyUser(u)) continue;
            if (!u.referralCode) {
              u.referralCode = this.generateUniqueReferralCode();
            }
            this.referralCodes.set(u.referralCode.toUpperCase(), u.telegramId);
            this.users.set(u.telegramId, u);
            this.users.set(u.id, u);
          }
          console.log(`[DB Engine] Loaded ${this.getAllUsers().length} real registered users from offline disk snapshot.`);
        }
        if (data.referrals && typeof data.referrals === 'object') {
          for (const [key, list] of Object.entries(data.referrals)) {
            if (isMockOrDummyUser({ telegramId: key })) continue;
            const cleanList = (list as ReferralUserItem[]).filter(r => !isMockOrDummyUser(r));
            this.referrals.set(key, cleanList);
          }
        }
        if (data.transactions && typeof data.transactions === 'object') {
          for (const [key, list] of Object.entries(data.transactions)) {
            if (isMockOrDummyUser({ telegramId: key })) continue;
            this.transactions.set(key, list as AppTransaction[]);
          }
        }
        if (data.config && typeof data.config === 'object') {
          this.config = { ...this.config, ...data.config };
        }
      }
    } catch (e: any) {
      console.warn('[DB Engine] Notice loading disk snapshot:', e?.message || e);
    }
  }

  // Debounced snapshot saving to ensure zero data loss across restarts
  public scheduleSnapshot() {
    if (this.snapshotTimeout) clearTimeout(this.snapshotTimeout);
    this.snapshotTimeout = setTimeout(() => {
      try {
        const uniqueUsers: User[] = [];
        const seen = new Set<string>();
        for (const user of this.users.values()) {
          if (!seen.has(user.telegramId) && !isMockOrDummyUser(user)) {
            seen.add(user.telegramId);
            uniqueUsers.push(user);
          }
        }
        const refObj: Record<string, ReferralUserItem[]> = {};
        for (const [key, val] of this.referrals.entries()) {
          if (isMockOrDummyUser({ telegramId: key })) continue;
          refObj[key] = (val || []).filter(r => !isMockOrDummyUser(r));
        }
        const txObj: Record<string, AppTransaction[]> = {};
        for (const [key, val] of this.transactions.entries()) {
          if (isMockOrDummyUser({ telegramId: key })) continue;
          txObj[key] = val || [];
        }
        const snapshot = {
          users: uniqueUsers,
          referrals: refObj,
          transactions: txObj,
          config: this.config,
          savedAt: new Date().toISOString(),
        };
        fs.writeFileSync(this.snapshotFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[DB Engine] Error saving disk snapshot:', err);
      }
    }, 500);
  }

  // Sync all local in-memory users & settings to MongoDB Atlas
  public async syncAllLocalToMongo() {
    if (!isMongoConnected()) return;
    try {
      console.log('[DB Engine] Synchronizing real registered users to MongoDB Atlas...');
      saveSystemSettingsToMongo(this.config).catch(() => {});
      const seen = new Set<string>();
      for (const user of this.users.values()) {
        if (!seen.has(user.telegramId)) {
          seen.add(user.telegramId);
          if (isMockOrDummyUser(user)) continue;
          await syncUserToMongo(user);
        }
      }
      console.log(`[DB Engine] Successfully synced ${seen.size} real registered users to MongoDB Atlas!`);
    } catch (err) {
      console.warn('[DB Engine] syncAllLocalToMongo notice:', err);
    }
  }

  public async initMongoSync() {
    if (!isMongoConnected()) {
      return;
    }
    try {
      // 1. Load system settings from MongoDB Atlas
      const savedConfig = await loadSystemSettingsFromMongo();
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
        console.log('[DB Engine] Loaded system settings from MongoDB Atlas');
      }

      // 1b. Load 50 mining levels from MongoDB Atlas
      const mongoMiningLevels = await loadMiningLevelsFromMongo();
      if (mongoMiningLevels && mongoMiningLevels.length > 0) {
        this.config.minerTiers = mongoMiningLevels;
        console.log(`[DB Engine] Loaded ${mongoMiningLevels.length} active mining levels from MongoDB Atlas.`);
      }

      // 2. Load existing real users from MongoDB Atlas
      const mongoUsers = await UserModel.find({}).lean();
      if (mongoUsers && mongoUsers.length > 0) {
        for (const doc of mongoUsers) {
          if (isMockOrDummyUser({ telegram_id: doc.telegram_id, username: doc.username })) {
            // Delete legacy mock/dummy users directly from Mongo
            UserModel.deleteOne({ _id: doc._id }).catch(() => {});
            continue;
          }
          const user = mapMongoDocToUser(doc);
          this.users.set(user.telegramId, user);
          this.users.set(user.id, user);
          if (user.referralCode) {
            this.referralCodes.set(user.referralCode.toUpperCase(), user.telegramId);
          }
        }
        console.log(`[DB Engine] Loaded ${this.getAllUsers().length} real registered users from MongoDB Atlas.`);
      }

      // 3. Load referral logs from MongoDB Atlas
      const referralLogs = await ReferralLogModel.find({}).lean();
      if (referralLogs && referralLogs.length > 0) {
        for (const rLog of referralLogs) {
          const inviterTgId = String(rLog.referrer_id);
          const referredTgId = String(rLog.referred_id);
          if (isMockOrDummyUser({ telegram_id: inviterTgId }) || isMockOrDummyUser({ telegram_id: referredTgId, username: rLog.referred_username })) {
            ReferralLogModel.deleteOne({ _id: rLog._id }).catch(() => {});
            continue;
          }
          const currentList = this.referrals.get(inviterTgId) || [];
          const exists = currentList.some(r => r.telegramId === referredTgId);
          if (!exists) {
            const statusMapped = rLog.status === 'Qualified'
              ? 'QUALIFIED'
              : rLog.status === 'Unqualified'
              ? 'UNQUALIFIED - SAME IP'
              : 'PENDING WALLET / CHANNEL';

            currentList.push({
              id: `usr-${rLog.referred_id}`,
              telegramId: referredTgId,
              username: rLog.referred_username || `user_${referredTgId.slice(-4)}`,
              joinedAt: rLog.created_at ? new Date(rLog.created_at).toISOString() : new Date().toISOString(),
              isQualified: rLog.status === 'Qualified',
              hasChannel: Boolean(rLog.has_channel),
              hasWallet: Boolean(rLog.has_wallet),
              hasMined: true,
              isMultiAccount: rLog.status === 'Unqualified',
              status: statusMapped,
              disqualifiedReason: rLog.reason || (rLog.status === 'Unqualified' ? 'Same IP/Device detected' : undefined),
              bonusAwardedPOP: rLog.bonus_awarded || 0,
            });
            this.referrals.set(inviterTgId, currentList);
          }
        }
      }
    } catch (e: any) {
      console.warn('[DB Engine] Mongo sync init notice:', e?.message || e);
    }
  }

  private seedInitialData() {
    // Real-time Database: No hardcoded, mock, or seeded user accounts.
    // User documents are created live as users register via Telegram Bot (/start) or web app authentication.
  }

  // Get Admin Configuration
  public getConfig(): AdminConfig {
    const rawBonus = (this.config as any).referralBonus ?? (this.config as any).referralBonusAmount ?? (this.config as any).referral_bonus ?? this.config.instantReferralBonusPOP;
    const bonus = rawBonus !== undefined && rawBonus !== null && Number.isFinite(Number(rawBonus)) && Number(rawBonus) >= 0
      ? Number(rawBonus)
      : 0;
    const rawComm = (this.config as any).squadCommissionRate ?? this.config.referralCommissionPercent;
    const commRate = rawComm !== undefined && rawComm !== null && Number.isFinite(Number(rawComm))
      ? Math.max(0, Math.min(100, Number(rawComm)))
      : 0;

    let botUser = (this.config.telegramBotUsername || this.config.botUsername || process.env.TELEGRAM_BOT_USERNAME || 'PopCornUSA_bot').replace('@', '').trim() || 'PopCornUSA_bot';
    if (botUser.toLowerCase() === 'popcornusa_bot') {
      botUser = 'PopCornUSA_bot';
    }
    let secret = this.config.adProviderSecret || '12345';
    if (secret === 'test_block_12345') {
      secret = '12345';
    }
    return {
      ...this.config,
      adProviderSecret: secret,
      telegramBotUsername: botUser,
      botUsername: botUser,
      instantReferralBonusPOP: bonus,
      referral_bonus: bonus,
      referralBonusAmount: bonus,
      referralCommissionPercent: commRate,
      squadCommissionRate: commRate,
    };
  }

  // Update Admin Configuration
  public updateConfig(newConfig: Partial<AdminConfig> & { referral_bonus?: number; referralBonusAmount?: number }, adminId: string): AdminConfig {
    const bonus = newConfig.referralBonusAmount !== undefined
      ? Number(newConfig.referralBonusAmount)
      : (newConfig.referral_bonus !== undefined
        ? Number(newConfig.referral_bonus)
        : (newConfig.instantReferralBonusPOP !== undefined ? Number(newConfig.instantReferralBonusPOP) : undefined));

    const rawComm = (newConfig as any).squadCommissionRate !== undefined
      ? (newConfig as any).squadCommissionRate
      : (newConfig.referralCommissionPercent !== undefined ? newConfig.referralCommissionPercent : undefined);

    this.config = { ...this.config, ...newConfig };
    if (bonus !== undefined) {
      this.config.instantReferralBonusPOP = bonus;
      (this.config as any).referral_bonus = bonus;
      (this.config as any).referralBonusAmount = bonus;
    }
    if (rawComm !== undefined && rawComm !== null && !isNaN(Number(rawComm))) {
      const commRate = Math.max(0, Math.min(100, Number(rawComm)));
      this.config.referralCommissionPercent = commRate;
      (this.config as any).squadCommissionRate = commRate;
    }
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'UPDATE_ADMIN_CONFIG',
      adminId,
      details: `Updated config keys: ${Object.keys(newConfig).join(', ')} (Referral Bonus: ${this.config.instantReferralBonusPOP} POP, Commission: ${(this.config as any).squadCommissionRate}%)`
    });
    // Immediately persist settings to MongoDB Atlas
    saveSystemSettingsToMongo(this.config).catch(err => console.warn('saveSystemSettingsToMongo error:', err));
    this.scheduleSnapshot();
    return this.getConfig();
  }

  // Find or Create User
  public getOrCreateUser(params: {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    referrerId?: string | null;
    ipAddress?: string;
    deviceFingerprint?: string;
  }): { user: User; isNew: boolean } {
    const existing = this.users.get(params.telegramId);
    const clientIp = params.ipAddress || '127.0.0.1';
    const fingerprint = params.deviceFingerprint || 'fp_unknown';

    if (existing) {
      if (!existing.referralCode) {
        existing.referralCode = this.generateUniqueReferralCode();
        this.referralCodes.set(existing.referralCode.toUpperCase(), existing.telegramId);
      }

      // Update metadata
      if (params.username) existing.username = params.username;
      if (params.firstName) existing.firstName = params.firstName;
      if (params.photoUrl) existing.photoUrl = params.photoUrl;
      existing.ipAddress = clientIp;
      existing.deviceFingerprint = fingerprint;

      // Anti-Cheat check: detect if same device/IP has multiple accounts
      if (this.config.antiCheatEnabled && !existing.isFlagged) {
        const ipUsers = this.ipHistory.get(clientIp) || [];
        const fpUsers = this.fingerprintHistory.get(fingerprint) || [];
        const otherIpUsers = ipUsers.filter(id => id !== existing.id);
        const otherFpUsers = fpUsers.filter(id => id !== existing.id);

        if (otherIpUsers.length > 2 || otherFpUsers.length > 1) {
          existing.isFlagged = true;
          existing.flaggedReason = 'MULTIPLE ACCOUNT / FLAGGED - Shared IP/Device detected';
        }
      }

      // Link referrer if not yet linked (Strict Self-Referral Prevention & Uniqueness: can only be referred ONCE)
      const cleanRefId = params.referrerId ? params.referrerId.replace(/^ref[_-]/i, '').trim() : '';
      const isSelf = Boolean(
        cleanRefId && (
          cleanRefId === params.telegramId ||
          cleanRefId === existing.id ||
          (existing.referralCode && cleanRefId.toUpperCase() === existing.referralCode.toUpperCase()) ||
          (existing.username && cleanRefId.toLowerCase() === existing.username.toLowerCase())
        )
      );

      if (!existing.referrerId && cleanRefId && !isSelf) {
        let inviter = this.getUserByReferralCode(cleanRefId) || 
          this.users.get(cleanRefId) || 
          Array.from(this.users.values()).find(u => u.telegramId === cleanRefId || u.id === cleanRefId);

        // Disallow self-referral if inviter is the same person
        if (inviter && (
          inviter.id === existing.id ||
          inviter.telegramId === existing.telegramId ||
          (existing.username && inviter.username && inviter.username.toLowerCase() === existing.username.toLowerCase()) ||
          (existing.referralCode && inviter.referralCode && inviter.referralCode.toUpperCase() === existing.referralCode.toUpperCase())
        )) {
          inviter = undefined;
        }

        // Ensure inviter exists in memory if valid non-self ID
        if (!inviter && cleanRefId && cleanRefId !== existing.telegramId && cleanRefId !== existing.id) {
          inviter = {
            id: `usr-${cleanRefId}`,
            telegramId: cleanRefId,
            username: `user_${cleanRefId.slice(-4)}`,
            firstName: `Miner_${cleanRefId.slice(-4)}`,
            lastName: '',
            photoUrl: '',
            tonWalletAddress: null,
            balancePOP: 0,
            unclaimedMiningPOP: 0,
            minerLevel: 1,
            storageTier: 1,
            miningStartedAt: new Date().toISOString(),
            lastClaimedAt: new Date().toISOString(),
            referrerId: null,
            isQualified: false,
            hasJoinedChannel: false,
            hasStartedMining: false,
            ipAddress: '127.0.0.1',
            deviceFingerprint: `dfp_${cleanRefId}`,
            isFlagged: false,
            dailyStreak: 0,
            lastCheckInDate: null,
            totalMined: 0,
            squadCommissionRate: this.config.referralCommissionPercent,
            unclaimedSquadPOP: 0,
            claimedSquadPOP: 0,
            completedTasks: [],
            createdAt: new Date().toISOString(),
          };
          this.users.set(inviter.id, inviter);
          this.users.set(inviter.telegramId, inviter);
        }

        if (inviter && inviter.id !== existing.id && inviter.telegramId !== existing.telegramId) {
          existing.referrerId = inviter.telegramId;
          let squadList = this.referrals.get(inviter.id) || this.referrals.get(inviter.telegramId) || [];
          const exists = squadList.some(r => r.id === existing.id || r.telegramId === existing.telegramId);
          if (!exists) {
            // PAY ONLY WHEN QUALIFIED: Referrer gets ZERO bonus and ZERO commission while in PENDING status
            inviter.total_joined = (inviter.total_joined || 0) + 1;
            this.users.set(inviter.id, inviter);
            this.users.set(inviter.telegramId, inviter);
            syncUserToMongo(inviter).catch(() => {});

            const refItem: ReferralUserItem = {
              id: existing.id,
              telegramId: existing.telegramId,
              username: existing.username,
              firstName: existing.firstName,
              first_name: existing.firstName,
              telegram_id: existing.telegramId,
              joinedAt: existing.createdAt || new Date().toISOString(),
              created_at: existing.createdAt || new Date().toISOString(),
              isQualified: false,
              hasChannel: !!existing.hasJoinedChannel,
              hasWallet: !!existing.tonWalletAddress,
              hasMined: !!existing.hasStartedMining,
              isMultiAccount: false,
              status: 'Pending' as any,
              disqualifiedReason: undefined,
              bonusAwardedPOP: 0,
              referralBonusClaimed: false,
            };
            squadList.unshift(refItem);
            this.referrals.set(inviter.id, squadList);
            this.referrals.set(inviter.telegramId, squadList);
            if (cleanRefId !== inviter.id && cleanRefId !== inviter.telegramId) {
              this.referrals.set(cleanRefId, squadList);
            }

            logReferralInMongo({
              referrerTelegramId: inviter.telegramId,
              referredTelegramId: existing.telegramId,
              referredUsername: existing.username,
              referredFirstName: existing.firstName,
              inviterIp: inviter.ipAddress,
              inviterDevice: inviter.deviceFingerprint,
              referredIp: existing.ipAddress,
              referredDevice: existing.deviceFingerprint,
              bonusAwarded: 0,
            }).catch(err => console.warn('[Mongo] logReferralInMongo error:', err));
          }
          this.checkAndApplyReferralQualification(existing);
        }
      }

      this.users.set(existing.telegramId, existing);
      this.users.set(existing.id, existing);
      syncUserToMongo(existing).catch(err => console.warn('syncUserToMongo error:', err));
      return { user: this.calculateCurrentMiningState(existing), isNew: false };
    }

    // Creating new user
    const newId = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    // Anti-cheat verification on registration
    // Loosen strict same-IP anti-cheat blocks during local/staging tests so multiple devices on the same local network register referrals properly.
    let isFlagged = false;
    let flaggedReason: string | undefined = undefined;

    const isLocalOrStaging = clientIp === '127.0.0.1' || 
      clientIp === '::1' || 
      clientIp.startsWith('192.168.') || 
      clientIp.startsWith('10.') || 
      clientIp.startsWith('172.') || 
      process.env.NODE_ENV !== 'production';

    const existingIpUsers = this.ipHistory.get(clientIp) || [];
    const existingFpUsers = this.fingerprintHistory.get(fingerprint) || [];

    // STRICT DEVICE ANTI-FRAUD & MULTI-ACCOUNT DETECTION:
    // If a new account is registered from a device/browser fingerprint that was ALREADY used to create another account:
    const isDeviceAlreadyUsed = existingFpUsers.length > 0;
    if (this.config.antiCheatEnabled && isDeviceAlreadyUsed) {
      isFlagged = true;
      flaggedReason = 'DISQUALIFIED / FRAUD DETECTED - Device already registered to another account';
    }

    // Also flag if excessive accounts from same IP (>10)
    if (this.config.antiCheatEnabled && !isLocalOrStaging && existingIpUsers.length >= 10) {
      isFlagged = true;
      flaggedReason = flaggedReason || 'MULTIPLE ACCOUNT / FLAGGED - Shared IP limit exceeded';
    }

    const referralCode = this.generateUniqueReferralCode();

    const newUser: User = {
      id: newId,
      telegramId: params.telegramId,
      referralCode,
      username: params.username || `user_${params.telegramId.slice(-4)}`,
      firstName: params.firstName || 'POP Miner',
      lastName: params.lastName || '',
      photoUrl: params.photoUrl || '',
      tonWalletAddress: null,
      balancePOP: 0,
      unclaimedMiningPOP: 0,
      minerLevel: 1,
      storageTier: 1,
      miningStartedAt: now,
      lastClaimedAt: now,
      referrerId: (params.referrerId && params.referrerId !== params.telegramId) ? params.referrerId : null,
      isQualified: false,
      hasJoinedChannel: false,
      hasStartedMining: false,
      ipAddress: clientIp,
      deviceFingerprint: fingerprint,
      isFlagged,
      flaggedReason,
      dailyStreak: 0,
      lastCheckInDate: null,
      totalMined: 0,
      squadCommissionRate: this.config.referralCommissionPercent,
      unclaimedSquadPOP: 0,
      claimedSquadPOP: 0,
      completedTasks: [],
      createdAt: now,
    };

    // Track IP & fingerprint history
    existingIpUsers.push(newId);
    this.ipHistory.set(clientIp, existingIpUsers);
    existingFpUsers.push(newId);
    this.fingerprintHistory.set(fingerprint, existingFpUsers);

    this.referralCodes.set(referralCode.toUpperCase(), newUser.telegramId);
    this.users.set(newUser.telegramId, newUser);
    this.users.set(newUser.id, newUser);

    // Handle Referral association
    // RULE: A referred user is strictly marked as "UNQUALIFIED" upon sign up.
    // Flat Referral POP Bonus & Mining Commission % will ONLY be rewarded once the user becomes "QUALIFIED".
    let awardedReferralBonus = 0;
    let inviterTelegramId: string | null = null;
    let inviterUser: User | null = null;

    if (params.referrerId && params.referrerId !== params.telegramId) {
      const cleanRefId = params.referrerId.replace(/^ref[_-]/i, '').trim();
      const isSelf = cleanRefId === params.telegramId ||
        cleanRefId === newUser.id ||
        (cleanRefId.toUpperCase() === referralCode.toUpperCase()) ||
        (params.username && cleanRefId.toLowerCase() === params.username.toLowerCase());

      if (!isSelf && cleanRefId) {
        let inviter = this.getUserByReferralCode(cleanRefId) || 
          this.users.get(cleanRefId) || 
          Array.from(this.users.values()).find(u => u.telegramId === cleanRefId || u.id === cleanRefId);

        // Disallow self-referral if inviter matches new user
        if (inviter && (
          inviter.id === newUser.id ||
          inviter.telegramId === newUser.telegramId ||
          (params.username && inviter.username && inviter.username.toLowerCase() === params.username.toLowerCase()) ||
          (inviter.referralCode && inviter.referralCode.toUpperCase() === referralCode.toUpperCase())
        )) {
          inviter = undefined;
        }

        // Auto-create inviter placeholder if not present in memory so referral is never lost
        if (!inviter && cleanRefId && cleanRefId !== newUser.telegramId && cleanRefId !== newUser.id) {
          inviter = {
            id: `usr-${cleanRefId}`,
            telegramId: cleanRefId,
            username: `user_${cleanRefId.slice(-4)}`,
            firstName: `Miner_${cleanRefId.slice(-4)}`,
            lastName: '',
            photoUrl: '',
            tonWalletAddress: null,
            balancePOP: 0,
            unclaimedMiningPOP: 0,
            minerLevel: 1,
            storageTier: 1,
            miningStartedAt: now,
            lastClaimedAt: now,
            referrerId: null,
            isQualified: false,
            hasJoinedChannel: false,
            hasStartedMining: false,
            ipAddress: '127.0.0.1',
            deviceFingerprint: `dfp_${cleanRefId}`,
            isFlagged: false,
            dailyStreak: 0,
            lastCheckInDate: null,
            totalMined: 0,
            squadCommissionRate: this.config.referralCommissionPercent,
            unclaimedSquadPOP: 0,
            claimedSquadPOP: 0,
            completedTasks: [],
            createdAt: now,
          };
          this.users.set(inviter.id, inviter);
          this.users.set(inviter.telegramId, inviter);
        }

        if (inviter && inviter.id !== newUser.id && inviter.telegramId !== newUser.telegramId) {
          inviterUser = inviter;
          inviterTelegramId = inviter.telegramId;
          newUser.referrerId = inviter.telegramId;

          // PAY ONLY WHEN QUALIFIED:
          // Strictly ZERO bonus or commission while in "PENDING" status!
          awardedReferralBonus = 0;
          inviter.total_joined = (inviter.total_joined || 0) + 1;
          this.users.set(inviter.id, inviter);
          this.users.set(inviter.telegramId, inviter);
          syncUserToMongo(inviter).catch(() => {});

          const squadList = this.referrals.get(inviter.id) || this.referrals.get(inviter.telegramId) || [];

          // Squad item with PENDING status, 0 bonus awarded, referralBonusClaimed = false
          const refItem: ReferralUserItem = {
            id: newUser.id,
            telegramId: newUser.telegramId,
            username: newUser.username || `user_${newUser.telegramId.slice(-4)}`,
            firstName: newUser.firstName || newUser.username || 'POP Miner',
            first_name: newUser.firstName || newUser.username || 'POP Miner',
            telegram_id: newUser.telegramId,
            joinedAt: now,
            created_at: now,
            isQualified: false,
            hasChannel: false,
            hasWallet: false,
            hasMined: false,
            isMultiAccount: false,
            status: 'Pending' as any,
            disqualifiedReason: undefined,
            bonusAwardedPOP: 0,
            referralBonusClaimed: false,
          };

          squadList.unshift(refItem);
          this.referrals.set(inviter.id, squadList);
          this.referrals.set(inviter.telegramId, squadList);
          if (cleanRefId !== inviter.id && cleanRefId !== inviter.telegramId) {
            this.referrals.set(cleanRefId, squadList);
          }

          // Persistent MongoDB Referral Log (Initial Status: Pending, 0 bonus awarded)
          logReferralInMongo({
            referrerTelegramId: inviter.telegramId,
            referredTelegramId: newUser.telegramId,
            referredUsername: newUser.username,
            referredFirstName: newUser.firstName,
            inviterIp: inviter.ipAddress,
            inviterDevice: inviter.deviceFingerprint,
            referredIp: newUser.ipAddress,
            referredDevice: newUser.deviceFingerprint,
            bonusAwarded: 0,
          }).catch(err => console.warn('[Mongo] logReferralInMongo error:', err));
        }
      }
    }

    // Persist new user to MongoDB Atlas & local snapshot
    syncUserToMongo(newUser).catch(err => console.warn('[Mongo] syncUserToMongo error:', err));
    this.scheduleSnapshot();

    return { 
      user: newUser, 
      isNew: true, 
      awardedReferralBonus, 
      inviterTelegramId, 
      inviterUser 
    } as any;
  }

  // Get User by Telegram ID or Internal ID
  public getUser(idOrTelegramId: string): User | undefined {
    const user = this.users.get(idOrTelegramId);
    if (!user) return undefined;
    return this.calculateCurrentMiningState(user);
  }

  // Server-Side Mining Calculation (UTC Authoritative)
  public calculateCurrentMiningState(user: User): User {
    // If user has not started mining yet, balance must strictly be 0 (no hardcoded starting default)
    if (!user.hasStartedMining) {
      user.unclaimedMiningPOP = 0;
      return user;
    }

    const miner = this.config.minerTiers.find(m => m.level === user.minerLevel) || this.config.minerTiers[0];
    const storage = this.config.storageTiers.find(s => s.tier === user.storageTier) || this.config.storageTiers[0];

    const lastClaimTime = user.lastClaimedAt ? new Date(user.lastClaimedAt).getTime() : 0;
    if (!lastClaimTime || isNaN(lastClaimTime)) {
      user.unclaimedMiningPOP = 0;
      return user;
    }

    const now = Date.now();
    const elapsedHours = Math.max(0, (now - lastClaimTime) / (1000 * 60 * 60));

    // Storage cap limit: strictly continuous mining based on hourly rate up to storage limit (Tier 1 is 6 full hours)
    const effectiveHours = Math.min(elapsedHours, storage.durationHours);
    const newMined = effectiveHours * miner.speedPerHour;

    user.unclaimedMiningPOP = parseFloat(newMined.toFixed(6));
    return user;
  }

  // Connect TON Wallet
  public connectTonWallet(telegramId: string, walletAddress: string): User {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    user.tonWalletAddress = walletAddress;
    // Auto-start mining if both TON wallet is connected and official channel is joined
    if (user.tonWalletAddress && user.hasJoinedChannel && !user.hasStartedMining) {
      const now = new Date().toISOString();
      user.hasStartedMining = true;
      user.miningStartedAt = now;
      user.lastClaimedAt = now;
      user.unclaimedMiningPOP = 0;
    }
    this.checkAndApplyReferralQualification(user);

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo on connectTonWallet error:', err));
    return user;
  }

  // Disconnect TON Wallet
  public disconnectTonWallet(telegramId: string): User {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    user.tonWalletAddress = null;
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo on disconnectTonWallet error:', err));
    return user;
  }

  // Mark Telegram Channel as Verified & Joined
  public markChannelJoined(telegramId: string): User {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    user.hasJoinedChannel = true;
    const userTasks = this.completedTasks.get(user.id) || new Set();
    userTasks.add('task-tg-channel');
    this.completedTasks.set(user.id, userTasks);

    // Auto-start mining if both TON wallet is connected and official channel is joined
    if (user.tonWalletAddress && user.hasJoinedChannel && !user.hasStartedMining) {
      const now = new Date().toISOString();
      user.hasStartedMining = true;
      user.miningStartedAt = now;
      user.lastClaimedAt = now;
      user.unclaimedMiningPOP = 0;
    }
    this.checkAndApplyReferralQualification(user);

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo on markChannelJoined error:', err));
    return user;
  }

  // Start Mining (Strictly Mandates Wallet Connection & Channel Membership)
  public startMining(telegramId: string): User {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    if (!user.tonWalletAddress) {
      throw new Error('WALLET_REQUIRED: Users MUST connect a TON-compatible wallet before starting mining.');
    }
    if (!user.hasJoinedChannel) {
      throw new Error('CHANNEL_REQUIRED: Users MUST join the official Telegram Channel before starting mining.');
    }

    const now = new Date().toISOString();
    user.hasStartedMining = true;
    user.miningStartedAt = now;
    user.lastClaimedAt = now;
    user.unclaimedMiningPOP = 0;
    this.checkAndApplyReferralQualification(user);
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo on startMining error:', err));
    return user;
  }

  // Check and apply referral qualification rule
  // Rule: Qualified ONLY after completing BOTH:
  // 1. TON Wallet Connection
  // 2. Joining the Official Telegram Channel
  public checkAndApplyReferralQualification(user: User): void {
    const hasJoinedChannel = Boolean(
      user.hasJoinedChannel ||
      (user as any).joined_channel ||
      (this.completedTasks.get(user.id)?.has('task-tg-channel') ?? false)
    );
    const hasWallet = Boolean(
      (user.tonWalletAddress && String(user.tonWalletAddress).trim() !== '') ||
      (user as any).wallet_address ||
      (user as any).walletAddress
    );
    const hasMined = Boolean(user.hasStartedMining || user.totalMined > 0);
    const bothStepsCompleted = hasJoinedChannel && hasWallet;

    if (user.referrerId) {
      const inviter = this.getUserByReferralCode(user.referrerId) || 
        this.users.get(user.referrerId) || 
        Array.from(this.users.values()).find(u => u.telegramId === user.referrerId || u.id === user.referrerId);

      if (inviter) {
        let squad = this.referrals.get(inviter.id) || this.referrals.get(inviter.telegramId) || [];
        let target = squad.find(s => s.id === user.id || s.telegramId === user.telegramId);

        if (!target) {
          target = {
            id: user.id,
            telegramId: user.telegramId,
            telegram_id: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            first_name: user.firstName,
            joinedAt: user.createdAt || new Date().toISOString(),
            created_at: user.createdAt || new Date().toISOString(),
            isQualified: false,
            hasChannel: hasJoinedChannel,
            hasWallet: hasWallet,
            hasMined: hasMined,
            isMultiAccount: false,
            status: 'Pending' as any,
            bonusAwardedPOP: 0,
            referralBonusClaimed: false,
          };
          squad.unshift(target);
        }

        target.hasChannel = hasJoinedChannel;
        target.hasWallet = hasWallet;
        target.hasMined = hasMined;

        // Strict Unique IP and Device verification
        const sameIp = Boolean(
          inviter.ipAddress && user.ipAddress &&
          inviter.ipAddress === user.ipAddress &&
          inviter.ipAddress !== '127.0.0.1' &&
          !inviter.ipAddress.includes('::1')
        );
        const sameDevice = Boolean(
          inviter.deviceFingerprint && user.deviceFingerprint &&
          inviter.deviceFingerprint === user.deviceFingerprint
        );
        const isSelf = inviter.id === user.id || inviter.telegramId === user.telegramId;
        const isFlagged = Boolean(user.isFlagged);
        const isFraudOrSameIp = sameIp || sameDevice || isSelf || isFlagged;

        if (isFraudOrSameIp) {
          // 1. UNQUALIFIED: Same IP / Device Match -> UNQUALIFIED
          const reason = sameIp && sameDevice
            ? 'Same IP and Device ID detected'
            : sameIp
            ? 'Same IP address detected'
            : sameDevice
            ? 'Same Device ID detected'
            : (isSelf ? 'Self-referral detected' : 'Account flagged');

          user.isQualified = false;
          user.isFlagged = true;
          target.isQualified = false;
          target.isMultiAccount = true;
          target.status = 'UNQUALIFIED' as any;
          target.bonusAwardedPOP = 0;
          target.referralBonusClaimed = false;
          target.disqualifiedReason = reason;

          verifyAndQualifyReferralInMongo({
            referredTelegramId: user.telegramId,
            hasWallet: hasWallet,
            hasChannel: hasJoinedChannel,
            bonusAmount: 0,
          }).catch(err => console.warn('[Mongo] verifyAndQualifyReferralInMongo error:', err));
        } else if (!bothStepsCompleted) {
          // 2. PENDING ACTION: Missing TON Wallet OR missing Channel -> PENDING
          user.isQualified = false;
          target.isQualified = false;
          target.status = 'PENDING' as any;
          target.bonusAwardedPOP = 0;
          target.referralBonusClaimed = false;
          target.disqualifiedReason = undefined;

          verifyAndQualifyReferralInMongo({
            referredTelegramId: user.telegramId,
            hasWallet: hasWallet,
            hasChannel: hasJoinedChannel,
            bonusAmount: 0,
          }).catch(err => console.warn('[Mongo] verifyAndQualifyReferralInMongo error:', err));
        } else {
          // 3. QUALIFIED: Wallet + Channel + Unique IP -> QUALIFIED
          user.isQualified = true;
          target.isQualified = true;
          target.isMultiAccount = false;
          target.status = 'QUALIFIED';
          target.disqualifiedReason = undefined;

          // SINGLE PAYOUT ONLY (NO DUPLICATES):
          // Check if referralBonusClaimed === true or bonusAwardedPOP > 0
          if (!target.referralBonusClaimed && (!target.bonusAwardedPOP || target.bonusAwardedPOP === 0)) {
            const configuredBonus = (
              (this.config as any).referralBonus ??
              (this.config as any).referralBonusAmount ??
              (this.config as any).referral_bonus ??
              this.config.instantReferralBonusPOP
            );
            const dynamicBonus = Number.isFinite(Number(configuredBonus)) && Number(configuredBonus) >= 0
              ? Number(configuredBonus)
              : 0;

            target.bonusAwardedPOP = dynamicBonus;
            target.referralBonusClaimed = true;
            target.qualifiedAt = new Date().toISOString();

            inviter.balancePOP = parseFloat((inviter.balancePOP + dynamicBonus).toFixed(4));
            this.users.set(inviter.id, inviter);
            this.users.set(inviter.telegramId, inviter);

            this.logTransaction({
              userId: inviter.id,
              telegramId: inviter.telegramId,
              type: 'REFERRAL_BONUS',
              title: 'Qualified Referral Bonus',
              amount: dynamicBonus,
              status: 'COMPLETED',
              details: `Qualified referral bonus for inviting @${user.username || user.telegramId}`,
              createdAt: new Date().toISOString(),
            });

            this.auditLogs.unshift({
              id: `audit-${Date.now()}`,
              timestamp: new Date().toISOString(),
              action: 'QUALIFIED_REFERRAL_BONUS',
              adminId: 'SYSTEM_REFERRAL',
              details: `Awarded +${dynamicBonus} POP dynamic referral bonus to ${inviter.username} (${inviter.telegramId}) - Referral @${user.username} is QUALIFIED.`,
            });

            // Sync qualification and single bonus reward to MongoDB Atlas
            verifyAndQualifyReferralInMongo({
              referredTelegramId: user.telegramId,
              hasWallet: true,
              hasChannel: true,
              bonusAmount: dynamicBonus,
            }).catch(err => console.warn('[Mongo] verifyAndQualifyReferralInMongo error:', err));
          }
        }

        this.referrals.set(inviter.id, squad);
        this.referrals.set(inviter.telegramId, squad);
        syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo error:', err));
      }
    }
  }

  // Claim Mining Reward (MANDATORY WALLET & CHANNEL REQUIREMENT)
  public claimMiningReward(telegramId: string): { user: User; claimedAmount: number } {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    // Mandate 1: Wallet must be connected!
    if (!user.tonWalletAddress) {
      throw new Error('WALLET_REQUIRED: Users MUST connect a TON-compatible wallet before claiming rewards.');
    }

    // Mandate 2: Official Telegram Channel must be joined!
    if (!user.hasJoinedChannel) {
      throw new Error('CHANNEL_REQUIRED: Users MUST join the official Telegram Channel before claiming rewards.');
    }

    this.calculateCurrentMiningState(user);
    const amountToClaim = user.unclaimedMiningPOP;
    if (amountToClaim <= 0) {
      throw new Error('No unclaimed mining rewards accumulated yet.');
    }

    user.balancePOP = parseFloat((user.balancePOP + amountToClaim).toFixed(4));
    user.totalMined = parseFloat((user.totalMined + amountToClaim).toFixed(4));
    user.unclaimedMiningPOP = 0;
    user.lastClaimedAt = new Date().toISOString();
    user.hasStartedMining = true;

    // Check and update referral qualification so inviter receives qualification bonus and commission immediately
    this.checkAndApplyReferralQualification(user);

    // Squad Commission: Referrer earns % Mining Commission ONLY IF this referral is QUALIFIED on a DIFFERENT DEVICE!
    // Accurately multiplies the referred user's actual mined amount by the dynamic percentage configured in the Admin Panel.
    if (user.referrerId) {
      const inviter = this.getUserByReferralCode(user.referrerId) || 
        this.users.get(user.referrerId) || 
        Array.from(this.users.values()).find(u => u.telegramId === user.referrerId || u.id === user.referrerId);

      if (inviter && !inviter.isFlagged) {
        const squad = this.referrals.get(inviter.id) || this.referrals.get(inviter.telegramId) || [];
        const target = squad.find(s => s.id === user.id || s.telegramId === user.telegramId);

        // Strictly verify target is QUALIFIED on different device (not multi-account)
        const isQualified = target && (
          target.status === 'Qualified' || 
          target.status === 'QUALIFIED' || 
          target.isQualified ||
          (Boolean(user.tonWalletAddress) && Boolean(user.hasJoinedChannel) && !target.isMultiAccount && target.status !== 'Unqualified (Same IP / Device Match)')
        );
        const isMultiAccount = Boolean(target?.isMultiAccount || target?.status === 'Unqualified (Same IP / Device Match)');

        if (isQualified && !isMultiAccount) {
          // Read dynamic commission rate strictly from Admin Panel configuration (e.g. 10%, 15%, etc.)
          const rawRate = (this.config as any).squadCommissionRate ?? this.config.referralCommissionPercent;
          const commissionRate = rawRate !== undefined && rawRate !== null && !isNaN(Number(rawRate))
            ? Math.max(0, Math.min(100, Number(rawRate)))
            : 0;

          // Multiply referred user's actual mined amount by the exact dynamic admin percentage
          const commission = parseFloat(((amountToClaim * commissionRate) / 100).toFixed(4));
          if (commission > 0) {
            inviter.unclaimedSquadPOP = parseFloat((inviter.unclaimedSquadPOP + commission).toFixed(4));
            inviter.squadCommissionRate = commissionRate;
            this.users.set(inviter.telegramId, inviter);
            this.users.set(inviter.id, inviter);
            syncUserToMongo(inviter).catch(err => console.warn('[Mongo] syncUserToMongo inviter commission error:', err));
          }
        }
      }
    }

    this.logTransaction({
      userId: user.id,
      telegramId: user.telegramId,
      type: 'MINING_CLAIM',
      title: 'Mining Claimed',
      amount: amountToClaim,
      status: 'COMPLETED',
      details: `Claimed ${amountToClaim} POP from level ${user.minerLevel} rig`,
    });

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo claimMiningReward error:', err));
    return { user, claimedAmount: amountToClaim };
  }

  // Claim Squad Referral Commission
  public claimSquadCommission(telegramId: string): { user: User; claimedCommission: number } {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    // Mandate: Wallet must be connected!
    if (!user.tonWalletAddress) {
      throw new Error('WALLET_REQUIRED: Users MUST connect a TON-compatible wallet before claiming squad commissions.');
    }

    const commission = user.unclaimedSquadPOP;
    if (commission <= 0) {
      throw new Error('No squad commission available to claim.');
    }

    user.balancePOP = parseFloat((user.balancePOP + commission).toFixed(4));
    user.claimedSquadPOP = parseFloat((user.claimedSquadPOP + commission).toFixed(4));
    user.unclaimedSquadPOP = 0;

    this.logTransaction({
      userId: user.id,
      telegramId: user.telegramId,
      type: 'SQUAD_COMMISSION',
      title: 'Squad Mining Commission Claimed',
      amount: commission,
      status: 'COMPLETED',
      details: `Claimed ${commission} POP passive squad mining commission`,
    });

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo claimSquadCommission error:', err));
    return { user, claimedCommission: commission };
  }

  // Upgrade Miner Speed Tier
  public upgradeMiner(telegramId: string, targetLevel: number): User {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    const targetTier = this.config.minerTiers.find(m => m.level === targetLevel);
    if (!targetTier) throw new Error(`Invalid miner tier level: ${targetLevel}`);

    if (targetLevel <= user.minerLevel) {
      throw new Error('Target miner level is already active or lower than current.');
    }

    if (targetLevel !== user.minerLevel + 1) {
      throw new Error('Upgrades must be acquired sequentially.');
    }

    if (user.balancePOP < targetTier.pricePOP) {
      throw new Error(`Insufficient POP balance. Need ${targetTier.pricePOP} POP (have ${user.balancePOP} POP).`);
    }

    // Auto-accrue current mining before changing speed
    this.calculateCurrentMiningState(user);

    user.balancePOP = parseFloat((user.balancePOP - targetTier.pricePOP).toFixed(4));
    user.minerLevel = targetLevel;
    user.lastClaimedAt = new Date().toISOString(); // Reset start clock for new speed rate

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);

    // Record activity transaction log
    this.logTransaction({
      userId: user.id,
      telegramId: user.telegramId,
      type: 'TASK_REWARD',
      title: `Upgraded to Level ${targetLevel} Miner Rig`,
      amount: -targetTier.pricePOP,
      status: 'COMPLETED',
      details: `Purchased Level ${targetLevel} (${targetTier.speedPerHour} POP/h) for ${targetTier.pricePOP} POP`,
    });

    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo upgradeMiner error:', err));
    return user;
  }

  // Get Mining Levels (50 levels)
  public getMiningLevels(): MinerTier[] {
    return this.config.minerTiers;
  }

  // Set Mining Levels in Memory & Sync to MongoDB
  public setMiningLevels(tiers: MinerTier[]): MinerTier[] {
    this.config.minerTiers = tiers;
    saveBulkMiningLevelsToMongo(tiers, this.config.popUsdRate).catch(err => console.warn('[DB] saveBulkMiningLevelsToMongo error:', err));
    saveSystemSettingsToMongo(this.config).catch(err => console.warn('[DB] saveSystemSettingsToMongo error:', err));
    this.scheduleSnapshot();
    return this.config.minerTiers;
  }

  // Update a single mining level (Speed POP/h and Cost POP)
  public updateMiningLevel(level: number, speedPerHour: number, pricePOP: number, name?: string): MinerTier {
    const existingIndex = this.config.minerTiers.findIndex(m => m.level === level);
    const priceUSD = Number((pricePOP * this.config.popUsdRate).toFixed(2));
    
    let updatedTier: MinerTier;
    if (existingIndex >= 0) {
      this.config.minerTiers[existingIndex] = {
        ...this.config.minerTiers[existingIndex],
        speedPerHour,
        pricePOP,
        priceUSD,
        ...(name ? { name } : {})
      };
      updatedTier = this.config.minerTiers[existingIndex];
    } else {
      updatedTier = {
        level,
        name: name || `Level ${level} Mining Rig`,
        speedPerHour,
        pricePOP,
        priceUSD
      };
      this.config.minerTiers.push(updatedTier);
      this.config.minerTiers.sort((a, b) => a.level - b.level);
    }

    saveMiningLevelToMongo(level, speedPerHour, pricePOP, name, this.config.popUsdRate).catch(err => console.warn('[DB] saveMiningLevelToMongo error:', err));
    saveSystemSettingsToMongo(this.config).catch(err => console.warn('[DB] saveSystemSettingsToMongo error:', err));
    this.scheduleSnapshot();
    return updatedTier;
  }

  // Upgrade Storage Duration Matrix Tier
  public upgradeStorage(telegramId: string, targetTierNum: number): User {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    const targetTier = this.config.storageTiers.find(s => s.tier === targetTierNum);
    if (!targetTier) throw new Error(`Invalid storage tier: ${targetTierNum}`);

    if (targetTierNum <= user.storageTier) {
      throw new Error('Target storage tier is already active or lower than current.');
    }

    if (targetTierNum !== user.storageTier + 1) {
      throw new Error('Storage matrix upgrades must be acquired sequentially.');
    }

    if (user.balancePOP < targetTier.pricePOP) {
      throw new Error(`Insufficient POP balance. Need ${targetTier.pricePOP} POP (have ${user.balancePOP} POP).`);
    }

    this.calculateCurrentMiningState(user);

    user.balancePOP = parseFloat((user.balancePOP - targetTier.pricePOP).toFixed(4));
    user.storageTier = targetTierNum;

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo upgradeStorage error:', err));
    return user;
  }

  // 7-Day Daily Check-in Streak
  public dailyCheckIn(telegramId: string): { user: User; rewardPOP: number; streak: number } {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    const todayDateStr = new Date().toISOString().split('T')[0];
    if (user.lastCheckInDate === todayDateStr) {
      throw new Error('Already checked in today. Please return tomorrow!');
    }

    let nextStreak = 1;
    if (user.lastCheckInDate) {
      const lastDate = new Date(user.lastCheckInDate);
      const today = new Date(todayDateStr);
      const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        nextStreak = (user.dailyStreak % 7) + 1;
      } else {
        nextStreak = 1; // Streak broken
      }
    }

    // 7-day reward scale: +5, +6, +7, +8, +10, +12, +15
    const streakRewards = [5, 6, 7, 8, 10, 12, 15];
    const reward = streakRewards[Math.min(nextStreak - 1, 6)];

    user.dailyStreak = nextStreak;
    user.lastCheckInDate = todayDateStr;
    user.balancePOP = parseFloat((user.balancePOP + reward).toFixed(4));

    this.logTransaction({
      userId: user.id,
      telegramId: user.telegramId,
      type: 'DAILY_BONUS',
      title: `Day ${nextStreak} Check-in Bonus`,
      amount: reward,
      status: 'COMPLETED',
      details: `Claimed daily check-in streak reward for day ${nextStreak}`,
    });

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo dailyCheckIn error:', err));
    return { user, rewardPOP: reward, streak: nextStreak };
  }

  // Record Task Start Time for Cooldown / Delay Verification (Seconds-based)
  public startTask(telegramId: string, taskId: string): { startedAt: number; claimDelaySeconds: number; claimDelayMinutes: number } {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');
    const now = Date.now();
    this.taskStartTimes.set(`${user.id}_${taskId}`, now);

    const allTasks = (this.config.tasks && this.config.tasks.length > 0)
      ? this.config.tasks
      : defaultEcosystemTasks;
    const task = allTasks.find(t => t.id === taskId);
    const claimDelaySeconds = typeof task?.claimDelaySeconds === 'number'
      ? task.claimDelaySeconds
      : (typeof task?.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);
    const claimDelayMinutes = Math.round(claimDelaySeconds / 60);

    return { startedAt: now, claimDelaySeconds, claimDelayMinutes };
  }

  // Complete Ecosystem Task (Enforces claimDelaySeconds countdown & Single Claim)
  public completeTask(telegramId: string, taskId: string, clientElapsedSeconds?: number): { user: User; rewardPOP: number } {
    const user = this.getUser(telegramId);
    if (!user) throw new Error('User not found');

    if (!user.completedTasks) {
      user.completedTasks = [];
    }

    let userTasks = this.completedTasks.get(user.id);
    if (!userTasks) {
      userTasks = new Set(user.completedTasks);
      this.completedTasks.set(user.id, userTasks);
    }

    // 1. Single Claim Rules: strictly enforce one-time claims via user.completedTasks
    if (user.completedTasks.includes(taskId) || userTasks.has(taskId)) {
      throw new Error('Task already completed.');
    }

    // Lookup task configuration
    const allTasks = (this.config.tasks && this.config.tasks.length > 0)
      ? this.config.tasks
      : defaultEcosystemTasks;

    const task = allTasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    // 2. Cooldown Delay Verification:
    // If claimDelaySeconds > 0, strictly enforce on server-side that the required delay time has elapsed
    const claimDelaySeconds = typeof task.claimDelaySeconds === 'number'
      ? task.claimDelaySeconds
      : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);
    const key = `${user.id}_${taskId}`;
    const startedAt = this.taskStartTimes.get(key);
    const now = Date.now();

    if (claimDelaySeconds > 0) {
      if (!startedAt) {
        throw new Error(`COOLDOWN_ACTIVE: You must open this task link and wait ${claimDelaySeconds} seconds before claiming.`);
      }
      const requiredMs = claimDelaySeconds * 1000;
      const elapsedMs = now - startedAt;
      // 1.5-second grace leeway for network latency
      if (elapsedMs < requiredMs - 1500) {
        const remainingSec = Math.ceil((requiredMs - elapsedMs) / 1000);
        throw new Error(`COOLDOWN_ACTIVE: Cooldown active! Wait ${remainingSec}s before claiming this task reward.`);
      }
    }

    // Register completion in both Set and user.completedTasks array
    userTasks.add(taskId);
    if (!user.completedTasks.includes(taskId)) {
      user.completedTasks.push(taskId);
    }

    user.balancePOP = parseFloat((user.balancePOP + task.rewardPOP).toFixed(4));

    // If channel task, check qualification
    if (taskId === 'task-tg-channel' || task.category === 'telegram') {
      user.hasJoinedChannel = true;
      this.checkAndApplyReferralQualification(user);
    }

    this.logTransaction({
      userId: user.id,
      telegramId: user.telegramId,
      type: 'TASK_REWARD',
      title: task.title ? `Task: ${task.title}` : 'Task Completed',
      amount: task.rewardPOP,
      status: 'COMPLETED',
      details: `Completed task ${taskId}`,
    });

    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo completeTask error:', err));
    return { user, rewardPOP: task.rewardPOP };
  }

  // Get User's Task Statuses (Dynamically synchronized with claimDelaySeconds & startedAt)
  public getUserTasks(userId: string): EcosystemTask[] {
    const user = this.users.get(userId);
    const completedArr = user?.completedTasks || [];
    const completedSet = new Set([...(this.completedTasks.get(userId) || []), ...completedArr]);
    const allTasks = (this.config.tasks && this.config.tasks.length > 0)
      ? this.config.tasks
      : defaultEcosystemTasks;

    return allTasks.map(task => {
      const startedAt = user ? this.taskStartTimes.get(`${user.id}_${task.id}`) : undefined;
      const claimDelaySeconds = typeof task.claimDelaySeconds === 'number'
        ? task.claimDelaySeconds
        : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);
      return {
        ...task,
        claimDelaySeconds,
        claimDelayMinutes: Math.round(claimDelaySeconds / 60),
        completed: completedSet.has(task.id),
        startedAt,
      };
    });
  }

  // Submit Withdrawal Request with strict server-side validation
  public submitWithdrawal(params: {
    telegramId: string;
    amountPOP: number;
    tonAddress: string;
  }): WithdrawalRequest {
    const user = this.getUser(params.telegramId);
    if (!user) throw new Error('UNAUTHORIZED: User not found');

    if (!user.tonWalletAddress || user.tonWalletAddress.trim().length < 10) {
      throw new Error('WALLET_REQUIRED: Must connect a valid TON wallet before submitting a withdrawal.');
    }

    if (!user.hasJoinedChannel) {
      throw new Error('CHANNEL_REQUIRED: Must join official Telegram channel before submitting a withdrawal.');
    }

    const minWithdrawAmount = typeof this.config.minWithdrawAmount === 'number' ? this.config.minWithdrawAmount : 100;
    const maxWithdrawAmount = typeof this.config.maxWithdrawAmount === 'number' ? this.config.maxWithdrawAmount : 50000;
    const popToUsdtRate = Number(process.env.POP_PRICE) || this.config.popUsdRate || 0.001;

    if (params.amountPOP < minWithdrawAmount) {
      throw new Error(`BELOW_MIN_LIMIT: Minimum withdrawal is ${minWithdrawAmount.toLocaleString()} POP (Your request: ${params.amountPOP.toLocaleString()} POP).`);
    }

    if (params.amountPOP > maxWithdrawAmount) {
      throw new Error(`EXCEEDS_MAX_LIMIT: Maximum withdrawal per request is ${maxWithdrawAmount.toLocaleString()} POP.`);
    }

    if (user.balancePOP < params.amountPOP) {
      throw new Error(`INSUFFICIENT_BALANCE: Insufficient POP balance. You do not have enough POP balance including network fees.`);
    }

    // Dynamic Fee Calculation & Net Payout Logic
    const grossAmount = params.amountPOP;
    const feePercentage = typeof this.config.withdrawalFeePercent === 'number' ? this.config.withdrawalFeePercent : 5;
    const feeInPop = parseFloat(((grossAmount * feePercentage) / 100).toFixed(4));
    const netPop = parseFloat((grossAmount - feeInPop).toFixed(4));
    const netUsdtValue = parseFloat((netPop * popToUsdtRate).toFixed(4));
    const feeUsdtValue = parseFloat((feeInPop * popToUsdtRate).toFixed(4));

    // Deduct user balance
    user.balancePOP = parseFloat((user.balancePOP - grossAmount).toFixed(4));
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);

    const withdrawal: WithdrawalRequest = {
      id: `wd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: user.id,
      username: user.username,
      telegramId: user.telegramId,
      amountPOP: grossAmount,
      grossAmount,
      feePercent: feePercentage,
      feePercentage,
      feeAmountPOP: feeInPop,
      feeAmount: feeInPop,
      netAmountPOP: netPop,
      netAmount: netPop,
      netUsdtValue,
      feeUsdtValue,
      tonAddress: params.tonAddress,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    this.withdrawals.unshift(withdrawal);

    this.logTransaction({
      userId: user.id,
      telegramId: user.telegramId,
      type: 'WITHDRAWAL',
      title: 'POP Token Withdrawal',
      amount: -grossAmount,
      status: 'PENDING',
      details: `Withdrawal request for ${grossAmount} POP to ${params.tonAddress}`,
    });

    return withdrawal;
  }

  // Get Withdrawals (All or by user)
  public getWithdrawals(userId?: string): WithdrawalRequest[] {
    if (userId) {
      return this.withdrawals.filter(w => w.userId === userId || w.telegramId === userId);
    }
    return [...this.withdrawals];
  }

  // Admin: Process Withdrawal (Approve, Reject, Paid, Completed)
  public processWithdrawal(params: {
    withdrawalId: string;
    status: 'APPROVED' | 'REJECTED' | 'PAID' | 'COMPLETED';
    adminId: string;
    adminNote?: string;
    txHash?: string;
  }): WithdrawalRequest {
    const wd = this.withdrawals.find(w => w.id === params.withdrawalId);
    if (!wd) throw new Error('Withdrawal request not found');

    const previousStatus = wd.status;
    wd.status = params.status;
    wd.processedAt = new Date().toISOString();
    if (params.adminNote) wd.adminNote = params.adminNote;
    if (params.txHash) wd.txHash = params.txHash;

    // If rejected, refund the POP balance to user
    if (params.status === 'REJECTED' && previousStatus !== 'REJECTED') {
      const user = this.getUser(wd.userId);
      if (user) {
        user.balancePOP = parseFloat((user.balancePOP + wd.amountPOP).toFixed(4));
        this.users.set(user.telegramId, user);
        this.users.set(user.id, user);
      }
    }

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: `WITHDRAWAL_${params.status}`,
      adminId: params.adminId,
      targetUserId: wd.userId,
      details: `Processed withdrawal ${wd.id} for ${wd.amountPOP} POP as ${params.status}. TX: ${params.txHash || 'N/A'}`
    });

    return wd;
  }

  // Admin: Broadcast Custom Bonus to All Users
  public broadcastBonusToAll(params: {
    amountPOP: number;
    reasonNote: string;
    adminId: string;
  }): { count: number; users: User[] } {
    if (!params.reasonNote || params.reasonNote.trim().length === 0) {
      throw new Error('Mandatory bonus reason/note is required.');
    }
    if (params.amountPOP <= 0) {
      throw new Error('Bonus amount must be greater than 0.');
    }

    const creditedUsers: User[] = [];
    const uniqueUsers = this.getAllUsers();

    for (const user of uniqueUsers) {
      user.balancePOP = parseFloat((user.balancePOP + params.amountPOP).toFixed(4));
      this.users.set(user.telegramId, user);
      this.users.set(user.id, user);
      syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo broadcast error:', err));
      creditedUsers.push(user);
    }

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'BROADCAST_BONUS',
      adminId: params.adminId,
      details: `Broadcasted +${params.amountPOP} POP to ${creditedUsers.length} users. Reason: ${params.reasonNote}`,
      note: params.reasonNote
    });

    return { count: creditedUsers.length, users: creditedUsers };
  }

  // Admin: Manual User Balance Adjustment (Add or Deduct)
  public adjustUserBalance(params: {
    targetId: string;
    amountPOP: number; // positive = add, negative = deduct
    reasonNote: string;
    adminId: string;
    isBonusNotification?: boolean;
  }): User {
    if (!params.reasonNote || params.reasonNote.trim().length === 0) {
      throw new Error('Mandatory note/reason is required for manual balance adjustments.');
    }

    const user = this.getUser(params.targetId);
    if (!user) throw new Error('Target user not found');

    const newBalance = user.balancePOP + params.amountPOP;
    if (newBalance < 0) {
      throw new Error(`Cannot deduct more than user's available balance (${user.balancePOP} POP).`);
    }

    user.balancePOP = parseFloat(newBalance.toFixed(4));
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);

    // Persist directly to MongoDB Atlas
    adjustUserPointsInMongo(user.telegramId, Math.abs(params.amountPOP), params.amountPOP >= 0 ? 'add' : 'deduct')
      .catch(err => console.warn('[Mongo] adjustUserPointsInMongo error:', err));
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo adjustUserBalance error:', err));

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: params.amountPOP >= 0 ? 'MANUAL_BALANCE_ADD' : 'MANUAL_BALANCE_DEDUCT',
      adminId: params.adminId,
      targetUserId: user.id,
      details: `Adjusted balance by ${params.amountPOP >= 0 ? '+' : ''}${params.amountPOP} POP. Note: ${params.reasonNote}`,
      note: params.reasonNote
    });

    return user;
  }

  // Admin: Toggle Flagged Status for Anti-Cheat
  public toggleUserFlag(targetId: string, isFlagged: boolean, reason: string, adminId: string): User {
    const user = this.getUser(targetId);
    if (!user) throw new Error('User not found');

    user.isFlagged = isFlagged;
    user.flaggedReason = isFlagged ? reason : undefined;
    this.users.set(user.telegramId, user);
    this.users.set(user.id, user);
    syncUserToMongo(user).catch(err => console.warn('[Mongo] syncUserToMongo toggleUserFlag error:', err));

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: isFlagged ? 'USER_FLAGGED_ANTI_CHEAT' : 'USER_UNFLAGGED',
      adminId,
      targetUserId: user.id,
      details: `User flagged set to ${isFlagged}. Reason: ${reason}`
    });

    return user;
  }

  // Get User's Squad Referrals List
  public getUserReferrals(inviterId: string): ReferralUserItem[] {
    const inviter = this.getUser(inviterId);
    let list = (inviter ? this.referrals.get(inviter.id) : null) || 
               (inviter ? this.referrals.get(inviter.telegramId) : null) || 
               this.referrals.get(inviterId) || [];

    // Also auto-sync any registered users that have referrerId set to this inviter
    if (inviter) {
      const allUsers = this.getAllUsers();
      for (const u of allUsers) {
        if (u.referrerId === inviter.id || u.referrerId === inviter.telegramId) {
          const exists = list.some(r => r.id === u.id || r.telegramId === u.telegramId);
          if (!exists) {
            list.push({
              id: u.id,
              telegramId: u.telegramId,
              telegram_id: u.telegramId,
              username: u.username,
              firstName: u.firstName,
              first_name: u.firstName || u.username || 'POP Miner',
              joinedAt: u.createdAt || new Date().toISOString(),
              created_at: u.createdAt || new Date().toISOString(),
              isQualified: false,
              hasChannel: !!u.hasJoinedChannel,
              hasWallet: !!u.tonWalletAddress,
              hasMined: !!u.hasStartedMining || u.totalMined > 0,
              isMultiAccount: false,
              status: 'Pending' as any,
              bonusAwardedPOP: 0,
              referralBonusClaimed: false,
            });
          }
        }
      }
      this.referrals.set(inviter.id, list);
      this.referrals.set(inviter.telegramId, list);
    }

    return list.map(ref => {
      const u = this.users.get(ref.id) || this.users.get(ref.telegramId);
      const hasWallet = u
        ? Boolean((u.tonWalletAddress && String(u.tonWalletAddress).trim() !== '') || (u as any).wallet_address || (u as any).walletAddress)
        : Boolean(ref.hasWallet || (ref as any).has_wallet || (ref as any).wallet_address || (ref as any).tonWalletAddress);
      const hasChannel = u
        ? Boolean(u.hasJoinedChannel || (u as any).joined_channel || (this.completedTasks.get(u.id)?.has('task-tg-channel') ?? false))
        : Boolean(ref.hasChannel || (ref as any).has_channel || (ref as any).joined_channel || (ref as any).hasJoinedChannel);
      const hasMined = u ? (!!u.hasStartedMining || u.totalMined > 0) : Boolean(ref.hasMined);

      const sameIp = Boolean(
        inviter && u && inviter.ipAddress && u.ipAddress &&
        inviter.ipAddress === u.ipAddress &&
        inviter.ipAddress !== '127.0.0.1' &&
        !inviter.ipAddress.includes('::1')
      );
      const sameDevice = Boolean(
        inviter && u && inviter.deviceFingerprint && u.deviceFingerprint &&
        inviter.deviceFingerprint === u.deviceFingerprint
      );
      const isSameIpMatch = Boolean(
        sameIp || sameDevice || ref.isMultiAccount || u?.isFlagged ||
        ref.status === 'Unqualified (Same IP / Device Match)' ||
        ref.status === 'UNQUALIFIED - SAME IP' ||
        ref.status === 'UNQUALIFIED - SAME DEVICE' ||
        ref.status === 'Unqualified' ||
        (ref as any).status === 'UNQUALIFIED'
      );

      const isBothDone = hasWallet && hasChannel;
      let finalStatus: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED' = 'PENDING';
      let isQual = false;

      if (!isBothDone) {
        // STRICT REQUIREMENT 1: Missing TON Wallet OR missing Channel -> PENDING
        finalStatus = 'PENDING';
        isQual = false;
      } else if (isSameIpMatch) {
        // STRICT REQUIREMENT 1: Same IP / Device Match -> UNQUALIFIED
        finalStatus = 'UNQUALIFIED';
        isQual = false;
      } else {
        // STRICT REQUIREMENT 1: Wallet + Channel + Unique IP -> QUALIFIED
        finalStatus = 'QUALIFIED';
        isQual = true;
      }

      return {
        ...ref,
        username: u ? u.username : ref.username,
        firstName: u ? (u.firstName || u.username) : (ref.firstName || ref.username || 'POP Miner'),
        first_name: u ? (u.firstName || u.username) : (ref.firstName || ref.username || 'POP Miner'),
        telegram_id: String(ref.telegramId),
        created_at: ref.created_at || ref.joinedAt || (u ? u.createdAt : new Date().toISOString()),
        joinedAt: ref.joinedAt || ref.created_at || (u ? u.createdAt : new Date().toISOString()),
        hasWallet,
        hasChannel,
        hasMined,
        isMultiAccount: isSameIpMatch,
        isQualified: isQual,
        status: finalStatus as any,
        bonusAwardedPOP: isQual ? (Number(ref.bonusAwardedPOP) || 0) : 0,
        referralBonusClaimed: isQual ? (ref.referralBonusClaimed ?? (ref.bonusAwardedPOP > 0)) : false,
        disqualifiedReason: isSameIpMatch ? (ref.disqualifiedReason || 'Same IP or Device match detected') : undefined,
      };
    }).filter(item => {
      // STRICT FILTER:
      // a. Exclude self
      if (inviter && (item.telegramId === inviter.telegramId || item.id === inviter.id)) {
        return false;
      }
      // b. Under NO CIRCUMSTANCES should the referrer appear in the child user's 'My Referral List'
      if (inviter && inviter.referrerId) {
        const pId = String(inviter.referrerId).trim();
        if (item.telegramId === pId || item.id === pId || item.id === `usr-${pId}`) {
          return false;
        }
      }
      return true;
    });
  }

  // Get Squad Breakdown Counts
  public getSquadCounts(inviterId: string): {
    total: number;
    pending: number;
    qualified: number;
    same_ip: number;
  } {
    const referrals = this.getUserReferrals(inviterId);
    let qualified = 0;
    let pending = 0;
    let sameIp = 0;

    for (const r of referrals) {
      const s = String(r.status || '').toUpperCase();
      if (s === 'QUALIFIED') {
        qualified++;
      } else if (s === 'UNQUALIFIED' || s.includes('UNQUALIFIED') || s.includes('SAME IP') || r.isMultiAccount) {
        sameIp++;
      } else {
        pending++;
      }
    }

    return {
      total: referrals.length,
      pending,
      qualified,
      same_ip: sameIp,
    };
  }

  // Get Weekly Referral Contest Leaderboard (Saturday-to-Saturday Cycle, strictly deduplicated by Telegram ID)
  public getWeeklyReferralLeaderboard(currentUserId?: string, filterStart?: Date, filterEnd?: Date): WeeklyPodiumUser[] {
    const list: WeeklyPodiumUser[] = [];
    const seenInviters = new Set<string>();
    const defaultBounds = getWeeklyCycleBounds();
    const startTime = filterStart || defaultBounds.startOfCycle;
    const endTime = filterEnd || defaultBounds.endOfCycle;

    // Calculate referral counts across all users
    this.referrals.forEach((referredList, inviterId) => {
      const inviter = this.users.get(inviterId) || this.getUser(inviterId);
      if (!inviter || inviter.isFlagged || isMockOrDummyUser(inviter)) return;

      const tid = String(inviter.telegramId).trim();
      if (!tid || seenInviters.has(tid)) return;
      seenInviters.add(tid);

      // Filter out dummy referrals and only count referrals made in current weekly cycle/filter window
      const cycleReferredList = referredList.filter(r => {
        if (isMockOrDummyUser(r)) return false;
        const dateStr = (r as any).qualifiedAt || (r as any).created_at || (r as any).joinedAt;
        if (!dateStr) return false;
        const t = new Date(dateStr).getTime();
        if (isNaN(t) || t < startTime.getTime() || t >= endTime.getTime()) {
          return false;
        }
        return true;
      });

      // ONLY QUALIFIED REFERRALS (status === 'QUALIFIED' or isQualified)
      const qualifiedList = cycleReferredList.filter(r => {
        const s = String(r.status || '').toUpperCase();
        return s === 'QUALIFIED' || r.isQualified === true;
      });

      const qualifiedCount = qualifiedList.length;
      if (qualifiedCount === 0) return;

      const totalPop = qualifiedList.reduce(
        (total, referral) => total + (Number(referral.bonusAwardedPOP) || 0),
        0
      );
      const earliestDate = qualifiedList[0]?.qualifiedAt || qualifiedList[0]?.created_at || qualifiedList[0]?.joinedAt;

      list.push({
        rank: 0,
        username: inviter.username,
        telegramId: inviter.telegramId,
        referralCount: qualifiedCount,
        qualifiedReferralCount: qualifiedCount,
        totalPopEarnings: Math.round(totalPop),
        prizeUsdt: 0,
        isCurrentUser: inviter.id === currentUserId || inviter.telegramId === currentUserId,
        earliestQualifiedDate: earliestDate,
      });
    });

    // Pure Dynamic Descending Ranking:
    // - Primary: Number of Qualified Referrals (Descending)
    // - Secondary: Total POP earned from referrals (Descending)
    // - Tertiary: Earliest qualified date (Ascending)
    list.sort((a, b) => {
      const countA = a.qualifiedReferralCount ?? a.referralCount ?? 0;
      const countB = b.qualifiedReferralCount ?? b.referralCount ?? 0;
      if (countB !== countA) return countB - countA;

      const popA = a.totalPopEarnings ?? 0;
      const popB = b.totalPopEarnings ?? 0;
      if (popB !== popA) return popB - popA;

      const timeA = new Date(a.earliestQualifiedDate || 0).getTime();
      const timeB = new Date(b.earliestQualifiedDate || 0).getTime();
      return timeA - timeB;
    });

    // Assign prizes to top 3 if threshold reached
    const threshold = this.config.weeklyContestMinThreshold;
    return list.slice(0, 50).map((u, idx) => {
      let prize = 0;
      if (u.referralCount >= threshold) {
        if (idx === 0) prize = this.config.weeklyPrizesUsdt.first;
        else if (idx === 1) prize = this.config.weeklyPrizesUsdt.second;
        else if (idx === 2) prize = this.config.weeklyPrizesUsdt.third;
      }
      return {
        ...u,
        rank: idx + 1,
        prizeUsdt: prize
      };
    });
  }

  // Get Global Mining Ranks (Total Mined POP) - STRICT UNIQUE TELEGRAM ID DEDUPLICATION & ZERO DUMMY ACCOUNTS
  public getGlobalLeaderboard(currentUserId?: string): GlobalLeaderboardUser[] {
    const userMap = new Map<string, User>();
    for (const u of this.users.values()) {
      if (isMockOrDummyUser(u) || u.isFlagged) continue;
      const tid = String(u.telegramId).trim();
      if (!tid) continue;
      if (!userMap.has(tid)) {
        userMap.set(tid, u);
      } else {
        const prev = userMap.get(tid)!;
        if ((u.totalMined + u.balancePOP) > (prev.totalMined + prev.balancePOP)) {
          userMap.set(tid, u);
        }
      }
    }

    const sorted = Array.from(userMap.values())
      .sort((a, b) => (b.totalMined + b.balancePOP) - (a.totalMined + a.balancePOP));

    return sorted.slice(0, 50).map((u, idx) => ({
      rank: idx + 1,
      username: u.username || `user_${u.telegramId.slice(-4)}`,
      minerLevel: u.minerLevel || 1,
      totalPOP: parseFloat((u.totalMined + u.balancePOP).toFixed(2)),
      isCurrentUser: u.id === currentUserId || u.telegramId === currentUserId
    }));
  }

  // Get All Users (Admin audit view - strictly real registered users, zero mock accounts, unique by Telegram ID)
  public getAllUsers(includeMock: boolean = false): User[] {
    const userMap = new Map<string, User>();
    for (const u of this.users.values()) {
      const tid = String(u.telegramId).trim();
      if (!tid) continue;
      if (!includeMock && isMockOrDummyUser(u)) continue;
      if (!userMap.has(tid)) {
        userMap.set(tid, u);
      }
    }
    return Array.from(userMap.values()).sort((a, b) => (b.balancePOP + b.totalMined) - (a.balancePOP + a.totalMined));
  }

  // Active Miners: users who have:
  // a) wallet connected (walletAddress / tonWalletAddress exists and is not empty)
  // b) official channel task completed (isChannelJoined / hasJoinedChannel == true or 'task-tg-channel' in completedTasks)
  // c) mining active (isMining / hasStartedMining == true or lastMinedAt / lastClaimedAt / miningStartedAt recorded)
  public isUserActiveMiner(user: User): boolean {
    const rawWallet = user.tonWalletAddress || (user as any).walletAddress;
    const hasWallet = Boolean(rawWallet && typeof rawWallet === 'string' && rawWallet.trim().length > 0);
    const isChannelJoined = Boolean(
      user.hasJoinedChannel ||
      (user as any).isChannelJoined === true ||
      user.completedTasks?.includes('task-tg-channel')
    );
    const isMining = Boolean(
      user.hasStartedMining === true ||
      (user as any).isMining === true ||
      Boolean((user as any).lastMinedAt) ||
      Boolean(user.lastClaimedAt) ||
      Boolean(user.miningStartedAt)
    );
    return hasWallet && isChannelJoined && isMining;
  }

  // Real-time Admin Stats: { totalUsers, activeMiners, totalMined, totalWithdrawals }
  public getAdminStats(): {
    totalUsers: number;
    activeMiners: number;
    totalMined: number;
    totalWithdrawals: number;
    totalCirculating: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsAmount: number;
    totalQualifiedReferrals: number;
    totalUnqualifiedReferrals: number;
  } {
    const allUsers = this.getAllUsers();
    const activeMiners = allUsers.filter(u => this.isUserActiveMiner(u)).length;
    const totalMined = allUsers.reduce((sum, u) => sum + (u.totalMined || 0), 0);
    const totalCirculating = allUsers.reduce((sum, u) => sum + (u.balancePOP || 0), 0);
    const pendingWds = this.withdrawals.filter(w => w.status === 'PENDING');
    const pendingAmount = pendingWds.reduce((sum, w) => sum + w.amountPOP, 0);

    let totalQualifiedReferrals = 0;
    let totalUnqualifiedReferrals = 0;
    this.referrals.forEach((squad) => {
      squad.forEach((ref) => {
        if (isMockOrDummyUser(ref)) return;
        if (ref.status === 'QUALIFIED' || (ref.isQualified && !ref.isMultiAccount)) {
          totalQualifiedReferrals++;
        } else {
          totalUnqualifiedReferrals++;
        }
      });
    });

    return {
      totalUsers: allUsers.length,
      activeMiners,
      totalMined: parseFloat(totalMined.toFixed(4)),
      totalWithdrawals: this.withdrawals.length,
      totalCirculating: parseFloat(totalCirculating.toFixed(4)),
      pendingWithdrawalsCount: pendingWds.length,
      pendingWithdrawalsAmount: parseFloat(pendingAmount.toFixed(4)),
      totalQualifiedReferrals,
      totalUnqualifiedReferrals
    };
  }

  // Real-time Paginated User Management with Search & Profile Histories
  public getAdminUsersPaginated(params: {
    search?: string;
    page?: number;
    limit?: number;
  }): {
    users: Array<User & {
      referralCount: number;
      referrals: ReferralUserItem[];
      withdrawals: WithdrawalRequest[];
      isChannelJoined: boolean;
      isMining: boolean;
      walletAddress: string | null;
      lastMinedAt: string;
      isActiveMiner: boolean;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  } {
    const search = (params.search || '').trim().toLowerCase();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));

    let all = this.getAllUsers();

    if (search) {
      all = all.filter(u => {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const username = (u.username || '').toLowerCase();
        const tid = String(u.telegramId || '').toLowerCase();
        const wallet = String(u.tonWalletAddress || (u as any).walletAddress || '').toLowerCase();
        return name.includes(search) || username.includes(search) || tid.includes(search) || wallet.includes(search);
      });
    }

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIdx = (page - 1) * limit;
    const paginated = all.slice(startIdx, startIdx + limit);

    const enrichedUsers = paginated.map(u => {
      const refs = this.referrals.get(u.id) || this.referrals.get(u.telegramId) || [];
      const userWds = this.withdrawals.filter(w => w.userId === u.id || w.telegramId === u.telegramId);
      const isChannelJoined = Boolean(
        u.hasJoinedChannel ||
        (u as any).isChannelJoined === true ||
        u.completedTasks?.includes('task-tg-channel')
      );
      const isMining = Boolean(
        u.hasStartedMining === true ||
        (u as any).isMining === true ||
        Boolean(u.lastClaimedAt) ||
        Boolean((u as any).lastMinedAt)
      );
      const walletAddress = u.tonWalletAddress || (u as any).walletAddress || null;
      const lastMinedAt = u.lastClaimedAt || (u as any).lastMinedAt || u.miningStartedAt || u.createdAt;
      const isActiveMiner = this.isUserActiveMiner(u);

      return {
        ...u,
        walletAddress,
        isChannelJoined,
        isMining,
        lastMinedAt,
        isActiveMiner,
        referralCount: refs.length,
        referrals: refs,
        withdrawals: userWds
      };
    });

    return {
      users: enrichedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  // Get Live Analytics Dashboard Data (Real-time counts, zero hardcoded/mock data)
  public getAnalytics(): {
    totalActiveUsers24h: number;
    totalActiveMiningSessions: number;
    activeMiners: number;
    totalPendingWithdrawalsCount: number;
    totalPendingWithdrawalsAmount: number;
    totalUsers: number;
    totalMinedPOP: number;
    totalCirculatingPOP: number;
    totalQualifiedReferrals: number;
    totalUnqualifiedReferrals: number;
  } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const allUsers = this.getAllUsers();

    // 1. Total Active Users (Users who logged in / active within last 24h)
    const activeUsers24h = allUsers.filter(u => {
      const claimTime = u.lastClaimedAt ? new Date(u.lastClaimedAt).getTime() : 0;
      const createTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      return claimTime >= oneDayAgo || createTime >= oneDayAgo;
    }).length;

    // 2. Active Miners computed by strict criteria
    const activeMiners = allUsers.filter(u => this.isUserActiveMiner(u)).length;

    // 3. Total Active Mining Sessions (Users actively mining / accruing within storage limit)
    const activeMiningSessions = allUsers.filter(u => {
      const storage = this.config.storageTiers.find(s => s.tier === u.storageTier) || this.config.storageTiers[0];
      const lastClaim = u.lastClaimedAt ? new Date(u.lastClaimedAt).getTime() : 0;
      const elapsedHours = Math.max(0, (now - lastClaim) / (1000 * 3600));
      return elapsedHours < (storage?.durationHours || 24);
    }).length;

    // 4. Pending Withdrawals and Amount
    const pendingWds = this.withdrawals.filter(w => w.status === 'PENDING');
    const pendingAmount = pendingWds.reduce((sum, w) => sum + w.amountPOP, 0);

    const totalMined = allUsers.reduce((sum, u) => sum + (u.totalMined || 0), 0);
    const totalCirculating = allUsers.reduce((sum, u) => sum + (u.balancePOP || 0), 0);

    let totalQualifiedReferrals = 0;
    let totalUnqualifiedReferrals = 0;
    this.referrals.forEach((squad) => {
      squad.forEach((ref) => {
        if (isMockOrDummyUser(ref)) return;
        if (ref.status === 'QUALIFIED' || (ref.isQualified && !ref.isMultiAccount)) {
          totalQualifiedReferrals++;
        } else {
          totalUnqualifiedReferrals++;
        }
      });
    });

    return {
      totalActiveUsers24h: activeUsers24h,
      totalActiveMiningSessions: activeMiningSessions,
      activeMiners,
      totalPendingWithdrawalsCount: pendingWds.length,
      totalPendingWithdrawalsAmount: parseFloat(pendingAmount.toFixed(4)),
      totalUsers: allUsers.length,
      totalMinedPOP: parseFloat(totalMined.toFixed(4)),
      totalCirculatingPOP: parseFloat(totalCirculating.toFixed(4)),
      totalQualifiedReferrals,
      totalUnqualifiedReferrals
    };
  }

  // ---------------------------------------------------------------------
  // Universal Transaction / Activity Logging
  // ---------------------------------------------------------------------
  public logTransaction(params: {
    userId: string;
    telegramId?: string;
    type: TransactionType;
    title: string;
    amount: number;
    status?: 'COMPLETED' | 'PENDING' | 'REJECTED' | 'ACTIVE';
    details?: string;
    createdAt?: string;
  }): AppTransaction {
    const formattedAmount = parseFloat(Number(params.amount).toFixed(4));

    // Deduplication check: prevent same log within 5 seconds
    const targetKey = params.telegramId || params.userId;
    const existingList = this.transactions.get(targetKey) || [];
    const recentDuplicate = existingList.find(t =>
      t.type === params.type &&
      t.title === params.title &&
      t.amount === formattedAmount &&
      (Date.now() - new Date(t.createdAt).getTime()) < 5000
    );
    if (recentDuplicate) {
      return recentDuplicate;
    }

    const tx: AppTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: params.userId,
      telegramId: params.telegramId,
      type: params.type,
      title: params.title,
      amount: formattedAmount,
      status: params.status || 'COMPLETED',
      details: params.details,
      createdAt: params.createdAt || new Date().toISOString(),
    };

    const keys = new Set<string>();
    if (params.userId) keys.add(params.userId);
    if (params.telegramId) keys.add(params.telegramId);

    keys.forEach(k => {
      const list = this.transactions.get(k) || [];
      list.unshift(tx);
      this.transactions.set(k, list.slice(0, 100));
    });

    this.scheduleSnapshot();

    // Async write to MongoDB Atlas
    logTransactionInMongo({
      userId: params.userId,
      telegramId: params.telegramId,
      type: params.type,
      title: params.title,
      amount: params.amount,
      status: params.status || 'COMPLETED',
      details: params.details,
      createdAt: tx.createdAt,
    }).catch(err => console.warn('[DB Engine] logTransactionInMongo async error:', err?.message || err));

    return tx;
  }

  public getTransactions(userIdOrTelegramId: string): AppTransaction[] {
    if (!userIdOrTelegramId) return [];
    const cleanId = String(userIdOrTelegramId).trim();
    const list = this.transactions.get(cleanId) ||
                 this.transactions.get(`usr-${cleanId}`) ||
                 this.transactions.get(cleanId.replace(/^usr-/, '')) ||
                 [];

    // Ensure distinct transactions sorted descending by createdAt
    const seen = new Set<string>();
    const unique = list.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Get Audit Logs
  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }
}

export const db = new DatabaseEngine();
