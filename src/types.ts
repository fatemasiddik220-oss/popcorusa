export interface User {
  id: string;
  telegramId: string;
  referralCode?: string; // Unique 8-character alphanumeric referral code (e.g. Z5F2IL8R)
  total_joined?: number; // Total count of users registered through this user's referral code
  username: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  tonWalletAddress: string | null;
  balancePOP: number;
  unclaimedMiningPOP: number;
  minerLevel: number;
  storageTier: number;
  miningStartedAt: string; // ISO string UTC
  lastClaimedAt: string;   // ISO string UTC
  referrerId: string | null;
  isQualified: boolean;    // Channel joined + TON wallet connected + started mining
  hasJoinedChannel: boolean; // Verified Telegram Channel member
  hasStartedMining: boolean; // Active mining session initiated
  ipAddress: string;
  deviceFingerprint: string;
  isFlagged: boolean;      // True if multiple accounts from same IP/device
  flaggedReason?: string;
  dailyStreak: number;
  lastCheckInDate: string | null;
  dailyAdViews?: number;
  lastAdViewDate?: string | null;
  totalMined: number;
  squadCommissionRate: number; // e.g. 10 (%)
  unclaimedSquadPOP: number;
  claimedSquadPOP: number;
  completedTasks?: string[];
  createdAt: string;
}

export interface MinerTier {
  level: number;
  name: string;
  speedPerHour: number;
  pricePOP: number;
  priceUSD: number;
}

export interface StorageTier {
  tier: number;
  name: string;
  durationHours: number;
  pricePOP: number;
  priceUSD: number;
}

export interface EcosystemTask {
  id: string;
  title: string;
  category: 'telegram' | 'youtube' | 'x' | 'announcement';
  rewardPOP: number;
  url: string;
  completed: boolean;
  requiresVerification?: boolean;
  claimDelaySeconds?: number; // Claim delay / timer (in SECONDS, e.g. 10, 30, 60 seconds)
  claimDelayMinutes?: number; // Legacy fallback in minutes
  startedAt?: number; // UTC timestamp (ms) when task was started
}

export type ReferralStatus = 
  | 'QUALIFIED' 
  | 'Qualified'
  | 'PENDING WALLET / CHANNEL' 
  | 'Pending'
  | 'PENDING (Missing Wallet / Channel)'
  | 'UNQUALIFIED - SAME IP'
  | 'UNQUALIFIED - SAME DEVICE' 
  | 'Unqualified (Same IP / Device Match)'
  | 'Unqualified'
  | 'PENDING_REQUIREMENTS' 
  | 'PENDING WALLET/CHANNEL' 
  | 'DISQUALIFIED'
  | string;

export interface SquadCounts {
  total: number;
  pending: number;
  qualified: number;
  same_ip: number;
}

export interface SquadBreakdown {
  totalJoined: number;
  pendingAction: number;
  qualified: number;
  unqualifiedSameIp: number;
}

export interface ReferralUserItem {
  id: string;
  telegramId: string;
  telegram_id?: string;
  username: string;
  firstName?: string;
  first_name?: string;
  joinedAt: string;
  created_at?: string;
  isQualified: boolean;
  hasChannel: boolean;
  hasWallet: boolean;
  hasMined: boolean;
  isMultiAccount: boolean;
  status?: ReferralStatus;
  disqualifiedReason?: string;
  bonusAwardedPOP: number;
  referralBonusClaimed?: boolean;
  qualifiedAt?: string;
}

export interface WeeklyPodiumUser {
  rank: number;
  username: string;
  telegramId: string;
  referralCount: number;
  qualifiedReferralCount?: number;
  totalPopEarnings: number;
  prizeUsdt: number;
  isCurrentUser?: boolean;
  earliestQualifiedDate?: string | Date;
}

export interface GlobalLeaderboardUser {
  rank: number;
  username: string;
  minerLevel: number;
  totalPOP: number;
  isCurrentUser?: boolean;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  telegramId: string;
  amountPOP: number; // Gross amount requested
  grossAmount?: number;
  feePercent: number;
  feePercentage?: number;
  feeAmountPOP: number;
  feeAmount?: number;
  netAmountPOP: number;
  netAmount?: number;
  netUsdtValue?: number;
  feeUsdtValue?: number;
  tonAddress: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'COMPLETED';
  createdAt: string;
  processedAt?: string;
  adminNote?: string;
  txHash?: string;
}

export interface AdminAnalytics {
  totalActiveUsers24h: number;
  totalActiveMiningSessions: number;
  activeMiners?: number;
  totalPendingWithdrawalsCount: number;
  totalPendingWithdrawalsAmount: number;
  totalUsers: number;
  totalMinedPOP: number;
  totalCirculatingPOP: number;
  totalQualifiedReferrals?: number;
  totalUnqualifiedReferrals?: number;
}

export interface AdminUserListItem extends User {
  referralCount: number;
  referrals: ReferralUserItem[];
  withdrawals: WithdrawalRequest[];
  isChannelJoined: boolean;
  isMining: boolean;
  walletAddress: string | null;
  lastMinedAt: string;
  isActiveMiner: boolean;
}

export interface TokenSupplyStats {
  success?: boolean;
  maxTotalSupply?: number;
  maxSupply?: number;
  totalDistributed?: number;
  remainingSupply?: number;
  isCapReached?: boolean;
  circulatingSupply?: number;
  totalCirculating?: number;
  totalMined?: number;
  totalWithdrawn?: number;
  error?: string;
}

export interface AdminStatsResponse {
  success: boolean;
  totalUsers: number;
  activeMiners: number;
  totalMined: number;
  totalWithdrawals: number;
  totalCirculating?: number;
  pendingWithdrawalsCount?: number;
  pendingWithdrawalsAmount?: number;
  totalQualifiedReferrals?: number;
  totalUnqualifiedReferrals?: number;
  tokenStats?: TokenSupplyStats;
  maxTotalSupply?: number;
  totalDistributed?: number;
  remainingSupply?: number;
  isCapReached?: boolean;
  error?: string;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminUserListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminConfig {
  popUsdRate: number; // 0.001 (100 POP = $0.10)
  minerTiers: MinerTier[];
  storageTiers: StorageTier[];
  instantReferralBonusPOP: number;
  referral_bonus?: number; // Dynamic Admin referral bonus parameter
  referralBonusAmount?: number; // Dynamic Admin referral bonus amount
  referralCommissionPercent: number;
  squadCommissionRate?: number; // Dynamic squad mining commission percent (e.g. 10%, 15%)
  weeklyContestMinThreshold: number; // 40
  weeklyPrizesUsdt: {
    first: number;  // 1.00
    second: number; // 0.60
    third: number;  // 0.30
  };
  weeklyContestNoticeText?: string;
  withdrawalFeePercent: number; // e.g. 5%
  minWithdrawAmount: number; // Minimum withdrawal amount in POP (e.g. 100)
  maxWithdrawAmount: number; // Maximum withdrawal amount in POP (e.g. 50000)
  mandatoryTelegramChannel: string;
  mandatoryChannelLink: string;
  channelUrl?: string;
  telegramBotUsername?: string;
  botUsername?: string;
  telegramSupportUsername: string; // e.g. @POP_Support_Bot
  telegramSupportUrl: string;      // e.g. https://t.me/POP_Support_Bot
  whatsappSupportNumber: string;   // e.g. +1 234 567 8900
  whatsappSupportUrl: string;      // e.g. https://wa.me/12345678900
  antiCheatEnabled: boolean;
  welcomeBannerUrl?: string;
  tasks: EcosystemTask[];
  adProvider: 'adsgram' | 'monetag' | string;
  adProviderSecret: string;
  adsDailyCap?: number; // Daily frequency cap (e.g. 4, range 3 to 5)
  interstitialAdIntervalMinutes: number; // default 5
  interstitialAdInitialDelayMinutes: number; // default 3
  adsgramBlockId?: string;
  adsgramInitialDelayMinutes?: number;
  adsgramStartupDailyLimit?: number;
  adsgramClaimDailyLimit?: number;
  monetagZoneId?: string;
  monetagInitialDelayMinutes?: number;
  monetagStartupDailyLimit?: number;
  monetagClaimDailyLimit?: number;
  maxTotalSupply?: number;
  totalDistributed?: number;
  remainingSupply?: number;
  isCapReached?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  adminId: string;
  targetUserId?: string;
  details: string;
  note?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'bonus' | 'withdrawal' | 'claim' | 'system';
  timestamp: string;
  read: boolean;
}

export type TransactionType =
  | 'MINING_CLAIM'
  | 'REFERRAL_BONUS'
  | 'TASK_REWARD'
  | 'DAILY_BONUS'
  | 'WITHDRAWAL'
  | 'SQUAD_COMMISSION'
  | 'ADMIN_BONUS';

export interface AppTransaction {
  id: string;
  userId: string;
  telegramId?: string;
  type: TransactionType;
  title: string;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED' | 'ACTIVE';
  createdAt: string;
  details?: string;
}
