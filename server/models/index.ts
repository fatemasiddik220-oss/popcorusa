import mongoose, { Schema, Document } from 'mongoose';

// =====================================================================
// 1. USER SCHEMA & MODEL
// =====================================================================

export interface IUserDocument extends Document {
  telegram_id: string;
  referral_code?: string;
  referralCode?: string;
  total_joined?: number;
  username?: string;
  first_name?: string;
  points: number;
  last_mined_at?: Date;
  wallet_address?: string;
  joined_channel: boolean;
  referred_by?: string;
  ip_address?: string;
  device_id?: string;
  is_admin: boolean;
  // Extended fields for Mini App rich capabilities & state
  miner_level: number;
  storage_tier: number;
  mining_started_at?: Date;
  daily_streak: number;
  last_checkin_date?: string;
  unclaimed_squad_pop: number;
  claimed_squad_pop: number;
  completed_tasks: string[];
  is_flagged: boolean;
  flagged_reason?: string;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    telegram_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    referral_code: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    total_joined: {
      type: Number,
      default: 0,
    },
    username: {
      type: String,
      default: '',
      trim: true,
    },
    first_name: {
      type: String,
      default: '',
      trim: true,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_mined_at: {
      type: Date,
      default: Date.now,
    },
    wallet_address: {
      type: String,
      default: null,
      trim: true,
    },
    joined_channel: {
      type: Boolean,
      default: false,
    },
    referred_by: {
      type: String,
      default: null,
      index: true,
    },
    ip_address: {
      type: String,
      default: null,
    },
    device_id: {
      type: String,
      default: null,
      index: true,
    },
    is_admin: {
      type: Boolean,
      default: false,
    },
    miner_level: {
      type: Number,
      default: 1,
    },
    storage_tier: {
      type: Number,
      default: 1,
    },
    mining_started_at: {
      type: Date,
      default: Date.now,
    },
    daily_streak: {
      type: Number,
      default: 0,
    },
    last_checkin_date: {
      type: String,
      default: null,
    },
    unclaimed_squad_pop: {
      type: Number,
      default: 0,
    },
    claimed_squad_pop: {
      type: Number,
      default: 0,
    },
    completed_tasks: {
      type: [String],
      default: [],
    },
    is_flagged: {
      type: Boolean,
      default: false,
    },
    flagged_reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const UserModel = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

// =====================================================================
// 2. REFERRAL LOG SCHEMA & MODEL
// =====================================================================

export type ReferralStatusType =
  | 'Pending'
  | 'Qualified'
  | 'Unqualified'
  | 'PENDING (Missing Wallet / Channel)'
  | 'Unqualified (Same IP / Device Match)'
  | 'QUALIFIED'
  | 'UNQUALIFIED - SAME IP';

export interface IReferralLogDocument extends Document {
  referrer_id: string;
  referred_id: string;
  status: string;
  reason?: string;
  bonus_awarded: number;
  referral_bonus_claimed?: boolean;
  qualified_at?: Date;
  referred_username?: string;
  referred_first_name?: string;
  has_wallet: boolean;
  has_channel: boolean;
  inviter_ip?: string;
  inviter_device?: string;
  referred_ip?: string;
  referred_device?: string;
  created_at: Date;
  updated_at: Date;
}

const ReferralLogSchema = new Schema<IReferralLogDocument>(
  {
    referrer_id: {
      type: String,
      required: true,
      index: true,
    },
    referred_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      default: 'Pending',
      index: true,
    },
    reason: {
      type: String,
      default: null,
    },
    bonus_awarded: {
      type: Number,
      default: 0,
    },
    referral_bonus_claimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    qualified_at: {
      type: Date,
      default: null,
      index: true,
    },
    referred_username: {
      type: String,
      default: '',
    },
    referred_first_name: {
      type: String,
      default: '',
    },
    has_wallet: {
      type: Boolean,
      default: false,
    },
    has_channel: {
      type: Boolean,
      default: false,
    },
    inviter_ip: {
      type: String,
      default: null,
    },
    inviter_device: {
      type: String,
      default: null,
    },
    referred_ip: {
      type: String,
      default: null,
    },
    referred_device: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const ReferralLogModel =
  mongoose.models.ReferralLog || mongoose.model<IReferralLogDocument>('ReferralLog', ReferralLogSchema);

// =====================================================================
// 3. SYSTEM SETTINGS SCHEMA & MODEL
// =====================================================================

export interface ISystemSettingsDocument extends Document {
  key: string;
  mandatory_telegram_channel: string;
  mandatory_channel_link: string;
  channel_url: string;
  instant_referral_bonus_pop: number;
  referralBonusAmount: number;
  referral_bonus?: number;
  referralBonus?: number;
  referral_commission_percent: number;
  squadCommissionRate: number;
  pop_usd_rate: number;
  anti_cheat_enabled: boolean;
  miner_tiers: any[];
  storage_tiers: any[];
  weekly_contest_min_threshold: number;
  weekly_prizes_usdt: {
    first: number;
    second: number;
    third: number;
  };
  support_username: string;
  telegram_bot_username?: string;
  welcome_banner_url: string;
  raw_config?: any;
  updated_at: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'admin_config',
    },
    mandatory_telegram_channel: {
      type: String,
      default: '@PopCornUSA_BOT',
    },
    mandatory_channel_link: {
      type: String,
      default: 'https://t.me/PopCornUSA_BOT',
    },
    channel_url: {
      type: String,
      default: 'https://t.me/PopCornUSA_bot',
    },
    instant_referral_bonus_pop: {
      type: Number,
      default: 100,
    },
    referralBonusAmount: {
      type: Number,
      default: 100,
    },
    referral_bonus: {
      type: Number,
      default: 100,
    },
    referral_commission_percent: {
      type: Number,
      default: 10,
    },
    squadCommissionRate: {
      type: Number,
      default: 10,
    },
    pop_usd_rate: {
      type: Number,
      default: 0.001,
    },
    anti_cheat_enabled: {
      type: Boolean,
      default: true,
    },
    miner_tiers: {
      type: [Schema.Types.Mixed] as any,
      default: [],
    },
    storage_tiers: {
      type: [Schema.Types.Mixed] as any,
      default: [],
    },
    weekly_contest_min_threshold: {
      type: Number,
      default: 40,
    },
    weekly_prizes_usdt: {
      type: Schema.Types.Mixed,
      default: { first: 1.0, second: 0.6, third: 0.3 },
    },
    support_username: {
      type: String,
      default: '@PopCornUSA_BOT',
    },
    telegram_bot_username: {
      type: String,
      default: 'PopCornUSA_bot',
    },
    welcome_banner_url: {
      type: String,
      default: 'https://i.postimg.cc/8c4vM4H8/banner.jpg',
    },
    raw_config: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const SystemSettingsModel =
  mongoose.models.SystemSettings || mongoose.model<ISystemSettingsDocument>('SystemSettings', SystemSettingsSchema);

// =====================================================================
// 4. TRANSACTION / ACTIVITY LOG SCHEMA & MODEL
// =====================================================================

export interface ITransactionDocument extends Document {
  userId: string;
  telegramId?: string;
  type: string;
  title: string;
  amount: number;
  status: string;
  details?: string;
  createdAt: Date;
  created_at?: Date;
  updated_at?: Date;
}

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    telegramId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['MINING_CLAIM', 'REFERRAL_BONUS', 'TASK_REWARD', 'DAILY_BONUS', 'WITHDRAWAL', 'SQUAD_COMMISSION', 'ADMIN_BONUS'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: 'COMPLETED',
      index: true,
    },
    details: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updated_at' },
  }
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ telegramId: 1, createdAt: -1 });

export const TransactionModel =
  mongoose.models.Transaction || mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

// =====================================================================
// 5. MINING LEVEL SCHEMA & MODEL (50 LEVELS)
// =====================================================================

export { MiningLevelModel } from './MiningLevel.js';
export type { IMiningLevelDocument } from './MiningLevel.js';

