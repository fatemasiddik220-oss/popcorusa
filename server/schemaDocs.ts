/**
 * POP TELEGRAM MINI APP - PRODUCTION DATABASE SCHEMAS & ARCHITECTURE
 * 
 * Includes:
 * 1. PostgreSQL Schema (DDL + Indexes + Constraints)
 * 2. MongoDB Schema (Mongoose Types + Validation)
 * 3. System Architecture & Flow
 */

export const POSTGRESQL_SCHEMA_SQL = `-- =====================================================================
-- POP TELEGRAM MINI APP - POSTGRESQL PRODUCTION DDL
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id VARCHAR(64) UNIQUE NOT NULL,
    username VARCHAR(64),
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128),
    photo_url TEXT,
    ton_wallet_address VARCHAR(128),
    balance_pop NUMERIC(18, 4) DEFAULT 0.0000 CHECK (balance_pop >= 0),
    unclaimed_mining_pop NUMERIC(18, 4) DEFAULT 0.0000,
    miner_level INTEGER DEFAULT 1 CHECK (miner_level >= 1),
    storage_tier INTEGER DEFAULT 1 CHECK (storage_tier >= 1),
    mining_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_qualified BOOLEAN DEFAULT FALSE,
    has_joined_channel BOOLEAN DEFAULT FALSE,
    ip_address INET,
    device_fingerprint VARCHAR(128),
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    daily_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,
    total_mined_pop NUMERIC(18, 4) DEFAULT 0.0000,
    squad_commission_rate NUMERIC(5, 2) DEFAULT 10.00,
    unclaimed_squad_pop NUMERIC(18, 4) DEFAULT 0.0000,
    claimed_squad_pop NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referrer_id ON users(referrer_id);
CREATE INDEX idx_users_ip_fingerprint ON users(ip_address, device_fingerprint);
CREATE INDEX idx_users_total_mined ON users(total_mined_pop DESC);

-- 2. Referrals Relation Table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_qualified BOOLEAN DEFAULT FALSE,
    is_multi_account BOOLEAN DEFAULT FALSE,
    bonus_awarded_pop NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    qualified_at TIMESTAMPTZ,
    CONSTRAINT unique_inviter_referred UNIQUE (inviter_id, referred_id)
);

-- 3. Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_pop NUMERIC(18, 4) NOT NULL CHECK (amount_pop > 0),
    fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    fee_amount_pop NUMERIC(18, 4) NOT NULL,
    net_amount_pop NUMERIC(18, 4) NOT NULL,
    ton_address VARCHAR(128) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    tx_hash VARCHAR(256),
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- 4. Tasks & Completions
CREATE TABLE IF NOT EXISTS ecosystem_tasks (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    category VARCHAR(32) NOT NULL,
    reward_pop NUMERIC(18, 4) NOT NULL,
    url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_task_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(64) NOT NULL REFERENCES ecosystem_tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_task UNIQUE (user_id, task_id)
);

-- 5. Dynamic Admin Configurations
CREATE TABLE IF NOT EXISTS admin_configs (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(64) NOT NULL,
    admin_id VARCHAR(64) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export const MONGODB_SCHEMA_DOC = `// =====================================================================
// POP TELEGRAM MINI APP - MONGOOSE (MONGODB) PRODUCTION SCHEMAS
// =====================================================================

import mongoose, { Schema, Document } from 'mongoose';

// 1. User Schema
export const UserSchema = new Schema({
  telegramId: { type: String, required: true, unique: true, index: true },
  username: { type: String, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  photoUrl: { type: String },
  tonWalletAddress: { type: String, default: null, index: true },
  balancePOP: { type: Number, default: 0, min: 0 },
  unclaimedMiningPOP: { type: Number, default: 0 },
  minerLevel: { type: Number, default: 1, min: 1 },
  storageTier: { type: Number, default: 1, min: 1 },
  miningStartedAt: { type: Date, default: Date.now },
  lastClaimedAt: { type: Date, default: Date.now },
  referrerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isQualified: { type: Boolean, default: false },
  hasJoinedChannel: { type: Boolean, default: false },
  ipAddress: { type: String, index: true },
  deviceFingerprint: { type: String, index: true },
  isFlagged: { type: Boolean, default: false },
  flaggedReason: { type: String },
  dailyStreak: { type: Number, default: 0 },
  lastCheckInDate: { type: String, default: null }, // YYYY-MM-DD
  totalMined: { type: Number, default: 0, index: -1 },
  squadCommissionRate: { type: Number, default: 10 },
  unclaimedSquadPOP: { type: Number, default: 0 },
  claimedSquadPOP: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserSchema.index({ ipAddress: 1, deviceFingerprint: 1 });

// 2. Withdrawal Schema
export const WithdrawalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  telegramId: { type: String, required: true },
  amountPOP: { type: Number, required: true, min: 1 },
  feePercent: { type: Number, required: true, default: 5 },
  feeAmountPOP: { type: Number, required: true },
  netAmountPOP: { type: Number, required: true },
  tonAddress: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID'], default: 'PENDING', index: true },
  adminNote: { type: String },
  txHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

// 3. Referral Schema
export const ReferralSchema = new Schema({
  inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referredId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  isQualified: { type: Boolean, default: false },
  isMultiAccount: { type: Boolean, default: false },
  bonusAwardedPOP: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  qualifiedAt: { type: Date }
});

// 4. Admin Config Schema
export const AdminConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});
`;

export const DIRECTORY_STRUCTURE_DOC = `
======================================================================
POP TELEGRAM MINI APP - COMPLETE ARCHITECTURE
======================================================================

├── server.ts                    # Main Express Entry Point, Telegram WebApp initData HMAC Auth, API Router
├── server/
│   ├── db.ts                    # In-Memory + Persistent Engine, Anti-Cheat, Mining Logic, Seed
│   ├── bot.ts                   # Telegram Bot Engine (Telegraf / Direct HTTP), DM alerts & Inline Keyboard
│   └── schemaDocs.ts            # PostgreSQL DDL & MongoDB Schema Specs
├── src/
│   ├── App.tsx                  # Main Mini App Component with Tab Controller & Dynamic Nav
│   ├── main.tsx                 # React App Entry Point with Global Providers
│   ├── index.css                # Tailwind CSS, Cyberpunk Neon Glow & Typography Styles
│   ├── types.ts                 # Shared TypeScript Data Contracts
│   ├── services/
│   │   ├── api.ts               # Authenticated API Client communicating with /api/*
│   │   ├── tonConnect.ts        # TON Connect UI Controller & Bottom Sheet Provider
│   │   └── haptic.ts            # Telegram Native Haptic Feedback Provider
│   └── components/
│       ├── Header.tsx           # Strictly "POP" Title Header, Wallet Chip, Admin Switch
│       ├── BottomNav.tsx        # 7-Tab Futuristic Navigation Bar
│       ├── TabMine.tsx          # Core Mining Dashboard with 3D Coin, Live Ticking, Claim Logic
│       ├── TabUpgrade.tsx       # Speed & Storage Matrix Tiers Grid & Upgrade Actions
│       ├── TabEarn.tsx          # 7-Day Streak Daily Check-in & Ecosystem Partner Tasks
│       ├── TabSquad.tsx         # Squad Commission, Anti-Fraud Box, 3-Podium Weekly Leaderboard
│       ├── TabLeaderboard.tsx   # Global Mining Ranks & Total POP Hall of Fame
│       ├── TabWallet.tsx        # In-App POP Holdings, TON Connect, Dynamic Fee Withdrawals
│       ├── TabProfile.tsx       # User Metadata, Anti-Cheat Fingerprint, Bot Link, Docs
│       ├── AdminPanel.tsx       # 8-Suite Dynamic Admin Command Center
│       ├── InterstitialAdModal.tsx # 3-Min First Delay, 5-Min Recurring, 10s Non-Skippable Timer
│       └── TonWalletModal.tsx   # Native @tonconnect/ui Bottom-Sheet Modal Component
`;
