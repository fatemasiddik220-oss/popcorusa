-- =====================================================================
-- POP TELEGRAM MINI APP - PRODUCTION POSTGRESQL SCHEMA DDL
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
    has_started_mining BOOLEAN DEFAULT FALSE,
    has_joined_channel BOOLEAN DEFAULT FALSE,
    is_qualified BOOLEAN DEFAULT FALSE,
    referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_ip_fingerprint ON users(ip_address, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_total_mined ON users(total_mined_pop DESC);

-- 2. Referrals & Squad Table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_qualified BOOLEAN DEFAULT FALSE,
    is_multi_account BOOLEAN DEFAULT FALSE,
    bonus_awarded_pop NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_inviter_referred UNIQUE (inviter_id, referred_id)
);

-- 3. Withdrawal Requests Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    telegram_id VARCHAR(64) NOT NULL,
    username VARCHAR(64),
    amount_pop NUMERIC(18, 4) NOT NULL CHECK (amount_pop >= 500),
    fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    fee_amount_pop NUMERIC(18, 4) NOT NULL,
    net_amount_pop NUMERIC(18, 4) NOT NULL,
    ton_address VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'COMPLETED')),
    admin_note TEXT,
    tx_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);

-- 4. User Completed Tasks Table
CREATE TABLE IF NOT EXISTS user_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(64) NOT NULL,
    reward_pop NUMERIC(18, 4) NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_task UNIQUE (user_id, task_id)
);

-- 5. Audit & Admin Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_user_id UUID,
    amount_pop NUMERIC(18, 4),
    reason_note TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
