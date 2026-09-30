import { connectMongo, isMongoConnected, getMongoStatusDetails, activeMongoUri } from './mongoose.js';
import { UserModel, ReferralLogModel, SystemSettingsModel, TransactionModel, MiningLevelModel, IUserDocument, IReferralLogDocument, ITransactionDocument, IMiningLevelDocument } from './models/index.js';
import { User, ReferralUserItem, AdminConfig, AppTransaction, MinerTier } from '../src/types.js';

let lastMongoError: string | null = null;

// Initial non-blocking connection attempt
connectMongo().catch(() => {});

export function getMongoStatus() {
  const details = getMongoStatusDetails();
  return {
    ...details,
    connected: details.isConnected,
    error: details.error || lastMongoError,
  };
}

/**
 * Maps an internal User object to MongoDB User Document fields
 */
export function mapUserToMongoFields(user: User, isAdmin: boolean = false) {
  return {
    telegram_id: String(user.telegramId),
    referral_code: user.referralCode || null,
    total_joined: user.total_joined || 0,
    username: user.username || '',
    first_name: user.firstName || '',
    points: Math.max(0, Math.floor(user.balancePOP || 0)),
    last_mined_at: user.lastClaimedAt ? new Date(user.lastClaimedAt) : new Date(),
    wallet_address: user.tonWalletAddress || null,
    joined_channel: Boolean(user.hasJoinedChannel),
    referred_by: user.referrerId ? String(user.referrerId).replace(/^usr-/, '').replace(/^ref[_-]/i, '') : null,
    ip_address: user.ipAddress || null,
    device_id: user.deviceFingerprint || null,
    is_admin: isAdmin,
    miner_level: user.minerLevel || 1,
    storage_tier: user.storageTier || 1,
    mining_started_at: user.miningStartedAt ? new Date(user.miningStartedAt) : new Date(),
    daily_streak: user.dailyStreak || 0,
    last_checkin_date: user.lastCheckInDate || null,
    unclaimed_squad_pop: user.unclaimedSquadPOP || 0,
    claimed_squad_pop: user.claimedSquadPOP || 0,
    completed_tasks: user.completedTasks || [],
    is_flagged: Boolean(user.isFlagged),
    flagged_reason: user.flaggedReason || null,
  };
}

/**
 * Maps a MongoDB User document back to the in-app User model
 */
export function mapMongoDocToUser(doc: any): User {
  const hasWallet = Boolean((doc.wallet_address && String(doc.wallet_address).trim() !== '') || doc.tonWalletAddress);
  const hasChannel = Boolean(doc.joined_channel || doc.hasJoinedChannel || (doc.completed_tasks && doc.completed_tasks.includes('task-tg-channel')));
  const isFlagged = Boolean(doc.is_flagged);
  const isQual = hasWallet && hasChannel && !isFlagged;

  return {
    id: `usr-${doc.telegram_id}`,
    telegramId: String(doc.telegram_id),
    referralCode: doc.referral_code || doc.referralCode || undefined,
    total_joined: doc.total_joined || 0,
    username: doc.username || `user_${String(doc.telegram_id).slice(-4)}`,
    firstName: doc.first_name || 'POP Miner',
    lastName: '',
    photoUrl: '',
    tonWalletAddress: doc.wallet_address || null,
    balancePOP: doc.points ?? 0,
    unclaimedMiningPOP: 0,
    minerLevel: doc.miner_level || 1,
    storageTier: doc.storage_tier || 1,
    miningStartedAt: doc.mining_started_at ? new Date(doc.mining_started_at).toISOString() : new Date().toISOString(),
    lastClaimedAt: doc.last_mined_at ? new Date(doc.last_mined_at).toISOString() : new Date().toISOString(),
    referrerId: doc.referred_by || null,
    isQualified: isQual, // Correctly evaluated from wallet + channel flags
    hasJoinedChannel: hasChannel,
    hasStartedMining: true,
    ipAddress: doc.ip_address || '127.0.0.1',
    deviceFingerprint: doc.device_id || `dfp_${doc.telegram_id}`,
    isFlagged: isFlagged,
    flaggedReason: doc.flagged_reason || undefined,
    dailyStreak: doc.daily_streak || 0,
    lastCheckInDate: doc.last_checkin_date || null,
    totalMined: doc.points ?? 0,
    squadCommissionRate: 10,
    unclaimedSquadPOP: doc.unclaimed_squad_pop || 0,
    claimedSquadPOP: doc.claimed_squad_pop || 0,
    completedTasks: doc.completed_tasks || [],
    createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Persists or updates a User in MongoDB Atlas
 */
export async function syncUserToMongo(user: User, isAdmin: boolean = false): Promise<void> {
  if (!isMongoConnected()) return;
  try {
    const fields = mapUserToMongoFields(user, isAdmin);
    await UserModel.findOneAndUpdate(
      { telegram_id: fields.telegram_id },
      { $set: fields },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] syncUserToMongo error:', err?.message);
  }
}

/**
 * Creates or retrieves a Referral Log in MongoDB with initial status: "Pending"
 */
export async function logReferralInMongo(params: {
  referrerTelegramId: string;
  referredTelegramId: string;
  referredUsername?: string;
  referredFirstName?: string;
  inviterIp?: string;
  inviterDevice?: string;
  referredIp?: string;
  referredDevice?: string;
  bonusAwarded?: number;
}): Promise<IReferralLogDocument | null> {
  if (!isMongoConnected()) return null;
  // Strict Self-Referral Prevention
  if (!params.referrerTelegramId || !params.referredTelegramId || params.referrerTelegramId === params.referredTelegramId) {
    console.log(`[MongoDB Atlas] Rejected self-referral: ${params.referredTelegramId} cannot refer themselves.`);
    return null;
  }

  try {
    // Database uniqueness check: A user can only be referred ONCE
    const existing = await ReferralLogModel.findOne({
      referred_id: params.referredTelegramId,
    });

    if (existing) {
      return existing;
    }

    // ZERO BONUS AT PENDING:
    // When a user launches via a referral link, initial status is PENDING with 0 bonus
    const newLog = new ReferralLogModel({
      referrer_id: params.referrerTelegramId,
      referred_id: params.referredTelegramId,
      status: 'PENDING',
      reason: null,
      bonus_awarded: 0,
      referred_username: params.referredUsername || '',
      referred_first_name: params.referredFirstName || '',
      has_wallet: false,
      has_channel: false,
      inviter_ip: params.inviterIp || null,
      inviter_device: params.inviterDevice || null,
      referred_ip: params.referredIp || null,
      referred_device: params.referredDevice || null,
    });

    await newLog.save();
    // Instantly increment referrer's total_joined count by 1 without credit of bonus points
    await UserModel.updateOne(
      { telegram_id: params.referrerTelegramId },
      { $inc: { total_joined: 1 } }
    ).catch((err: any) => console.warn('[MongoDB Atlas] Increment total_joined error:', err?.message));

    console.log(`[MongoDB Atlas] Logged referral: ${params.referredTelegramId} -> ${params.referrerTelegramId} [STATUS: PENDING, total_joined +1, bonus: 0]`);
    return newLog;
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] logReferralInMongo error:', err?.message);
    return null;
  }
}

/**
 * Searches MongoDB for a user by their 8-character referral code (or legacy telegram_id)
 */
export async function findUserByReferralCodeInMongo(code: string): Promise<User | null> {
  if (!isMongoConnected() || !code) return null;
  try {
    const clean = code.replace(/^ref[_-]/i, '').trim().toUpperCase();
    const doc = await UserModel.findOne({
      $or: [
        { referral_code: clean },
        { referralCode: clean },
        { telegram_id: clean },
      ],
    }).lean();
    if (doc) {
      return mapMongoDocToUser(doc);
    }
    return null;
  } catch (err: any) {
    console.warn('[MongoDB Atlas] findUserByReferralCodeInMongo error:', err?.message);
    return null;
  }
}

/**
 * Verifies referral qualification when user completes wallet & channel requirements
 */
export async function verifyAndQualifyReferralInMongo(params: {
  referredTelegramId: string;
  hasWallet: boolean;
  hasChannel: boolean;
  bonusAmount: number;
}): Promise<{
  success: boolean;
  status: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED';
  reason?: string;
  awardedBonus: number;
  referrerTelegramId?: string;
}> {
  if (!isMongoConnected()) {
    return { success: false, status: 'PENDING', awardedBonus: 0 };
  }

  try {
    const log = await ReferralLogModel.findOne({ referred_id: params.referredTelegramId });
    if (!log) {
      return { success: false, status: 'PENDING', awardedBonus: 0 };
    }

    // Update requirements state
    log.has_wallet = params.hasWallet;
    log.has_channel = params.hasChannel;

    // Check if requirements are met
    if (!params.hasWallet || !params.hasChannel) {
      log.status = 'PENDING';
      await log.save();
      return {
        success: true,
        status: 'PENDING',
        reason: 'Waiting for TON Wallet and Channel Join',
        awardedBonus: 0,
        referrerTelegramId: log.referrer_id,
      };
    }

    // FRAUD CHECK: Compare IP Address and Device ID
    const sameIp =
      log.inviter_ip &&
      log.referred_ip &&
      log.inviter_ip === log.referred_ip &&
      log.inviter_ip !== '127.0.0.1' &&
      !log.inviter_ip.includes('::1');

    const sameDevice =
      log.inviter_device &&
      log.referred_device &&
      log.inviter_device === log.referred_device;

    const isFraud = sameIp || sameDevice || log.referrer_id === log.referred_id;

    if (isFraud) {
      log.status = 'UNQUALIFIED';
      log.reason = sameIp && sameDevice
        ? 'Same IP and Device ID detected'
        : sameIp
        ? 'Same IP address detected'
        : 'Same Device ID detected';
      await log.save();

      console.log(`[MongoDB Atlas] Referral ${log.referred_id} marked UNQUALIFIED: ${log.reason}`);
      return {
        success: true,
        status: 'UNQUALIFIED',
        reason: log.reason,
        awardedBonus: 0,
        referrerTelegramId: log.referrer_id,
      };
    }

    // If already qualified or already claimed, do not double-reward
    if (log.referral_bonus_claimed === true || (log.bonus_awarded && log.bonus_awarded > 0)) {
      return {
        success: true,
        status: 'QUALIFIED',
        awardedBonus: log.bonus_awarded || 0,
        referrerTelegramId: log.referrer_id,
      };
    }

    // Mark as QUALIFIED and claimed
    log.status = 'QUALIFIED';
    log.referral_bonus_claimed = true;
    log.bonus_awarded = params.bonusAmount;
    log.qualified_at = new Date();
    log.reason = 'TON Wallet and Channel verified';
    await log.save();

    // Credit dynamic bonus points to the inviter in MongoDB Atlas
    await UserModel.findOneAndUpdate(
      { telegram_id: log.referrer_id },
      { $inc: { points: params.bonusAmount }, $set: { updated_at: new Date() } }
    ).catch(err => console.warn('[MongoDB Atlas] UserModel points inc error:', err?.message));

    // Save transaction log in MongoDB Atlas
    await TransactionModel.create({
      telegram_id: log.referrer_id,
      type: 'REFERRAL_BONUS',
      title: 'Qualified Referral Bonus',
      amount: params.bonusAmount,
      status: 'COMPLETED',
      details: `Qualified referral bonus for inviting @${log.referred_username || log.referred_id}`,
      created_at: new Date(),
    }).catch(err => console.warn('[MongoDB Atlas] TransactionModel create error:', err?.message));

    console.log(`[MongoDB Atlas] Referral ${log.referred_id} QUALIFIED! Awarded dynamic +${params.bonusAmount} POP to inviter ${log.referrer_id}.`);

    return {
      success: true,
      status: 'QUALIFIED',
      awardedBonus: params.bonusAmount,
      referrerTelegramId: log.referrer_id,
    };
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] verifyAndQualifyReferralInMongo error:', err?.message);
    return { success: false, status: 'PENDING', awardedBonus: 0 };
  }
}

/**
 * Adjusts user points directly in MongoDB Atlas (Admin Action)
 */
export async function adjustUserPointsInMongo(
  telegramId: string,
  amount: number,
  mode: 'add' | 'deduct' | 'set'
): Promise<{ success: boolean; newPoints: number; user?: any }> {
  if (!isMongoConnected()) {
    return { success: false, newPoints: 0 };
  }

  try {
    let updateQuery: any = {};
    if (mode === 'add') {
      updateQuery = { $inc: { points: Math.abs(amount) } };
    } else if (mode === 'deduct') {
      updateQuery = { $inc: { points: -Math.abs(amount) } };
    } else {
      updateQuery = { $set: { points: Math.max(0, amount) } };
    }

    const updated = await UserModel.findOneAndUpdate(
      { telegram_id: String(telegramId) },
      updateQuery,
      { returnDocument: 'after' }
    );

    if (updated && updated.points < 0) {
      updated.points = 0;
      await updated.save();
    }

    console.log(`[MongoDB Atlas] Admin adjusted points for ${telegramId} (${mode} ${amount}) -> New Points: ${updated?.points}`);
    return { success: Boolean(updated), newPoints: updated?.points ?? 0, user: updated };
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] adjustUserPointsInMongo error:', err?.message);
    return { success: false, newPoints: 0 };
  }
}

/**
 * Saves System Settings / Admin Config directly to MongoDB Atlas
 */
export async function saveSystemSettingsToMongo(config: AdminConfig): Promise<void> {
  if (!isMongoConnected()) return;
  try {
    const configuredBonus = (config as any).referralBonus ??
      (config as any).referralBonusAmount ??
      (config as any).referral_bonus ??
      config.instantReferralBonusPOP;
    const configuredCommissionRate = (config as any).squadCommissionRate ?? config.referralCommissionPercent;
    const referralBonus = Number.isFinite(Number(configuredBonus)) && Number(configuredBonus) >= 0
      ? Number(configuredBonus)
      : 0;
    const commissionRate = Number.isFinite(Number(configuredCommissionRate))
      ? Math.max(0, Math.min(100, Number(configuredCommissionRate)))
      : 0;

    await SystemSettingsModel.findOneAndUpdate(
      { key: 'admin_config' },
      {
        $set: {
          key: 'admin_config',
          mandatory_telegram_channel: config.mandatoryTelegramChannel || '@PopCornUSA_BOT',
          mandatory_channel_link: config.mandatoryChannelLink || 'https://t.me/PopCornUSA_BOT',
          channel_url: config.channelUrl || 'https://t.me/PopCornUSA_bot',
          telegram_bot_username: (config.telegramBotUsername || config.botUsername || 'PopCornUSA_bot').replace('@', '').trim(),
          instant_referral_bonus_pop: referralBonus,
          referral_bonus: referralBonus,
          referralBonusAmount: referralBonus,
          referral_commission_percent: commissionRate,
          squadCommissionRate: commissionRate,
          pop_usd_rate: config.popUsdRate ?? 0.001,
          anti_cheat_enabled: config.antiCheatEnabled ?? true,
          miner_tiers: config.minerTiers || [],
          storage_tiers: config.storageTiers || [],
          weekly_contest_min_threshold: config.weeklyContestMinThreshold ?? 40,
          weekly_prizes_usdt: config.weeklyPrizesUsdt || { first: 1.0, second: 0.6, third: 0.3 },
          support_username: config.telegramSupportUsername || '@PopCornUSA_BOT',
          welcome_banner_url: config.welcomeBannerUrl || 'https://i.postimg.cc/8c4vM4H8/banner.jpg',
          raw_config: config,
          updated_at: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('[MongoDB Atlas] Successfully saved system settings & admin config.');
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] saveSystemSettingsToMongo error:', err?.message);
  }
}

/**
 * Loads System Settings from MongoDB Atlas on startup
 */
export async function loadSystemSettingsFromMongo(): Promise<Partial<AdminConfig> | null> {
  if (!isMongoConnected()) return null;
  try {
    const doc = await SystemSettingsModel.findOne({ key: 'admin_config' });
    if (!doc) return null;

    let botUser = (doc.telegram_bot_username || 'PopCornUSA_bot').replace('@', '').trim();
    if (botUser.toLowerCase() === 'popcornusa_bot') {
      botUser = 'PopCornUSA_bot';
    }
    const rawComm = doc.referral_commission_percent ??
      (doc as any).squadCommissionRate ??
      (doc.raw_config as any)?.squadCommissionRate ??
      (doc.raw_config as any)?.referralCommissionPercent;
    const commRate = Number.isFinite(Number(rawComm))
      ? Math.max(0, Math.min(100, Number(rawComm)))
      : 0;
    return {
      mandatoryTelegramChannel: doc.mandatory_telegram_channel || '@PopCornUSA_BOT',
      mandatoryChannelLink: doc.mandatory_channel_link || 'https://t.me/PopCornUSA_BOT',
      channelUrl: doc.channel_url || 'https://t.me/PopCornUSA_bot',
      telegramBotUsername: botUser,
      botUsername: botUser,
      instantReferralBonusPOP: doc.instant_referral_bonus_pop,
      referral_bonus: doc.instant_referral_bonus_pop,
      referralCommissionPercent: commRate,
      squadCommissionRate: commRate,
      popUsdRate: doc.pop_usd_rate,
      antiCheatEnabled: doc.anti_cheat_enabled,
      minerTiers: doc.miner_tiers?.length ? doc.miner_tiers : undefined,
      storageTiers: doc.storage_tiers?.length ? doc.storage_tiers : undefined,
      weeklyContestMinThreshold: doc.weekly_contest_min_threshold,
      weeklyPrizesUsdt: doc.weekly_prizes_usdt,
      telegramSupportUsername: doc.support_username,
      welcomeBannerUrl: doc.welcome_banner_url,
      ...(doc.raw_config || {}),
    };
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] loadSystemSettingsFromMongo error:', err?.message);
    return null;
  }
}

/**
 * Retrieves all referral logs for a given referrer
 */
export async function getReferralLogsForReferrer(referrerTelegramId: string): Promise<IReferralLogDocument[]> {
  if (!isMongoConnected()) return [];
  try {
    return await ReferralLogModel.find({ referrer_id: String(referrerTelegramId) }).sort({ created_at: -1 });
  } catch (err: any) {
    console.warn('[MongoDB Atlas] getReferralLogsForReferrer error:', err?.message);
    return [];
  }
}

/**
 * Retrieves all existing and previous referrals from MongoDB by querying UserModel where referred_by matches
 * the current user's telegram_id, referral_code, or user ID, and merges with ReferralLogModel.
 */
export async function getMyReferralsFromMongo(identifier: {
  telegramId?: string;
  referralCode?: string;
  userId?: string;
}): Promise<{
  counts: { total: number; pending: number; qualified: number; same_ip: number };
  referrals: any[];
} | null> {
  if (!isMongoConnected()) return null;
  // Trigger background reconciliation to ensure users with wallet and channel are QUALIFIED in MongoDB logs
  autoReconcileReferralsInMongo().catch(() => {});
  try {
    const rawTgId = identifier.telegramId ? String(identifier.telegramId).trim() : '';
    let rawRefCode = identifier.referralCode ? String(identifier.referralCode).trim() : '';
    const rawUserId = identifier.userId ? String(identifier.userId).trim() : '';

    // If referral code is missing, look up the user in MongoDB or in-memory
    if (!rawRefCode && rawTgId) {
      try {
        const uDoc = await UserModel.findOne({ telegram_id: rawTgId }).lean();
        if (uDoc && (uDoc.referral_code || (uDoc as any).referralCode)) {
          rawRefCode = (uDoc.referral_code || (uDoc as any).referralCode) as string;
        }
      } catch {}
    }

    // Build exhaustive list of matching keys for referred_by
    const searchKeysSet = new Set<string>();
    if (rawTgId) {
      searchKeysSet.add(rawTgId);
      searchKeysSet.add(`usr-${rawTgId}`);
      searchKeysSet.add(`ref_${rawTgId}`);
      searchKeysSet.add(`ref-${rawTgId}`);
    }
    if (rawUserId) {
      searchKeysSet.add(rawUserId);
      searchKeysSet.add(rawUserId.replace(/^usr-/, ''));
    }
    if (rawRefCode) {
      const codeUpper = rawRefCode.toUpperCase();
      const codeLower = rawRefCode.toLowerCase();
      searchKeysSet.add(rawRefCode);
      searchKeysSet.add(codeUpper);
      searchKeysSet.add(codeLower);
      searchKeysSet.add(`ref_${codeUpper}`);
      searchKeysSet.add(`ref_${rawRefCode}`);
    }

    const searchKeys = Array.from(searchKeysSet).filter(Boolean);
    if (searchKeys.length === 0) {
      return { counts: { total: 0, pending: 0, qualified: 0, same_ip: 0 }, referrals: [] };
    }

    let adminBonus = 0;
    try {
      const configDoc = await SystemSettingsModel.findOne({ key: 'admin_config' }).lean();
      if (configDoc) {
        const configuredBonus = Number(
          configDoc.referral_bonus ??
          configDoc.instant_referral_bonus_pop ??
          (configDoc as any).referralBonusAmount ??
          0
        );
        adminBonus = Number.isFinite(configuredBonus) && configuredBonus >= 0 ? configuredBonus : 0;
      }
    } catch {}

    // 1. Query all users from MongoDB whose referred_by matches any of the user's IDs or referral codes
    const userDocs = await UserModel.find({
      referred_by: { $in: searchKeys }
    }).sort({ created_at: -1 }).lean();

    // 2. Query all referral logs from MongoDB for this referrer
    const logDocs = await ReferralLogModel.find({
      referrer_id: { $in: searchKeys }
    }).sort({ created_at: -1 }).lean();

    const referralMap = new Map<string, any>();

    // Process UserModel results: evaluate completion flags (wallet + channel)
    for (const u of userDocs) {
      const tgId = String(u.telegram_id);
      if (!tgId || (rawTgId && tgId === rawTgId)) continue; // skip self

      const hasWallet = Boolean((u.wallet_address && String(u.wallet_address).trim() !== '') || (u as any).tonWalletAddress || (u as any).walletAddress);
      const hasChannel = Boolean(u.joined_channel || (u as any).hasJoinedChannel || (u.completed_tasks && u.completed_tasks.includes('task-tg-channel')));
      const isUnqual = Boolean(u.is_flagged);
      const isQual = !isUnqual && hasWallet && hasChannel;
      const status: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED' = isUnqual ? 'UNQUALIFIED' : (isQual ? 'QUALIFIED' : 'PENDING');

      referralMap.set(tgId, {
        telegram_id: tgId,
        telegramId: tgId,
        id: `usr-${tgId}`,
        username: u.username || `user_${tgId.slice(-4)}`,
        first_name: u.first_name || u.username || 'POP Miner',
        firstName: u.first_name || u.username || 'POP Miner',
        status,
        isQualified: isQual,
        hasWallet,
        hasChannel,
        hasMined: true,
        isMultiAccount: isUnqual,
        bonusAwardedPOP: isQual ? adminBonus : 0,
        disqualifiedReason: u.flagged_reason || undefined,
        created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
        joinedAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
      });
    }

    // Process & merge ReferralLogModel entries (authoritative verification)
    for (const log of logDocs) {
      const refTgId = String(log.referred_id);
      if (!refTgId || (rawTgId && refTgId === rawTgId)) continue;

      const logStatusUpper = String(log.status || '').toUpperCase();
      const existing = referralMap.get(refTgId);
      const hasWallet = Boolean(
        (log.has_wallet !== undefined && log.has_wallet !== null ? Boolean(log.has_wallet) : false) ||
        Boolean(existing?.hasWallet)
      );
      const hasChannel = Boolean(
        (log.has_channel !== undefined && log.has_channel !== null ? Boolean(log.has_channel) : false) ||
        Boolean(existing?.hasChannel)
      );

      const logReason = (log.reason || '').toLowerCase();
      const existReason = (existing?.disqualifiedReason || '').toLowerCase();
      const isUnqual =
        logStatusUpper.includes('UNQUALIFIED') ||
        logStatusUpper.includes('SAME IP') ||
        logStatusUpper.includes('SAME DEVICE') ||
        Boolean(logReason && (
          logReason.includes('same ip') ||
          logReason.includes('same device') ||
          logReason.includes('self-referral') ||
          logReason.includes('multi-account') ||
          logReason.includes('multi account') ||
          logReason.includes('flagged')
        )) ||
        Boolean(existing?.isMultiAccount) ||
        Boolean(existReason && (
          existReason.includes('same ip') ||
          existReason.includes('same device') ||
          existReason.includes('self-referral') ||
          existReason.includes('multi-account')
        ));
      
      // Fully evaluate completion flags: if both tasks are completed and not flagged/unqualified, user is QUALIFIED!
      const isQual = !isUnqual && hasWallet && hasChannel;

      let normalizedStatus: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED' = 'PENDING';
      if (isUnqual) normalizedStatus = 'UNQUALIFIED';
      else if (isQual) normalizedStatus = 'QUALIFIED';
      else normalizedStatus = 'PENDING';

      const earnedBonus = (log.bonus_awarded && log.bonus_awarded > 0) ? log.bonus_awarded : (isQual ? adminBonus : 0);

      if (existing) {
        // Overlay log verification specifics
        existing.status = normalizedStatus;
        existing.isQualified = isQual;
        existing.isMultiAccount = isUnqual;
        existing.hasWallet = hasWallet;
        existing.hasChannel = hasChannel;
        existing.bonusAwardedPOP = earnedBonus;
        if (log.referred_username && (!existing.username || existing.username.startsWith('user_'))) {
          existing.username = log.referred_username;
        }
        if (log.referred_first_name && (!existing.first_name || existing.first_name === 'POP Miner')) {
          existing.first_name = log.referred_first_name;
          existing.firstName = log.referred_first_name;
        }
        if (log.reason) existing.disqualifiedReason = log.reason;
      } else {
        referralMap.set(refTgId, {
          telegram_id: refTgId,
          telegramId: refTgId,
          id: `usr-${refTgId}`,
          username: log.referred_username || `user_${refTgId.slice(-4)}`,
          first_name: log.referred_first_name || log.referred_username || 'POP Miner',
          firstName: log.referred_first_name || log.referred_username || 'POP Miner',
          status: normalizedStatus,
          isQualified: isQual,
          hasWallet,
          hasChannel,
          hasMined: true,
          isMultiAccount: isUnqual,
          bonusAwardedPOP: earnedBonus,
          disqualifiedReason: log.reason,
          created_at: log.created_at ? new Date(log.created_at).toISOString() : new Date().toISOString(),
          joinedAt: log.created_at ? new Date(log.created_at).toISOString() : new Date().toISOString(),
        });
      }

      // Automatically sync and upgrade the log in MongoDB if requirements are completed
      if (isQual && log.status !== 'QUALIFIED') {
        ReferralLogModel.updateOne(
          { _id: (log as any)._id },
          {
            $set: {
              status: 'QUALIFIED',
              has_wallet: true,
              has_channel: true,
              bonus_awarded: earnedBonus,
              referral_bonus_claimed: true,
              qualified_at: new Date(),
              reason: 'TON Wallet and Channel verified',
            }
          }
        ).catch(() => {});
      }
    }

    const mergedList = Array.from(referralMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let qualifiedCount = 0;
    let pendingCount = 0;
    let sameIpCount = 0;

    for (const item of mergedList) {
      if (item.status === 'QUALIFIED') qualifiedCount++;
      else if (item.status === 'UNQUALIFIED') sameIpCount++;
      else pendingCount++;
    }

    return {
      counts: {
        total: mergedList.length,
        pending: pendingCount,
        qualified: qualifiedCount,
        same_ip: sameIpCount,
      },
      referrals: mergedList,
    };
  } catch (err: any) {
    console.warn('[MongoDB Atlas] getMyReferralsFromMongo error:', err?.message);
    return null;
  }
}

/**
 * Calculates and returns real-time squad statistics and formatted referrals from MongoDB
 */
export async function getMongoSquadStats(
  referrerTelegramId: string,
  referralCode?: string
): Promise<{
  counts: { total: number; pending: number; qualified: number; same_ip: number };
  referrals: any[];
} | null> {
  return getMyReferralsFromMongo({ telegramId: referrerTelegramId, referralCode });
}

// Known dummy test Telegram IDs and usernames to filter out
const EXCLUDED_DUMMY_IDS = [
  '998811223', '111222333', '444555666', '1001', '2002', '3003',
  '8001', '8002', '8003', '111111111', '222222222', '333333333',
  '900000001', '900000002', '900000003', '123456789', '888123456',
  '9876543210', '5559290535', '1234567890', '987654123', '888999111'
];

const EXCLUDED_DUMMY_USERNAMES = [
  'referrer_boss', 'master_miner', 'top_inviter', 'crypto_star_99',
  'satoshi_friend', 'tester_pro', 'test_invited_user', 'crypto_newbie',
  'pop_ton_explorer', 'usera_crypto', 'userb_miner', 'userc_fraud',
  'user_alpha', 'user_beta', 'user_a', 'user_b', 'user_c_clone',
  'alice_miner', 'bob_miner', 'charlie_clone', 'alice_fresh', 'bob_fresh', 'charlie_fresh'
];

/**
 * Retrieves global leaderboard from MongoDB using aggregation with distinct $group on telegram_id
 * to ensure zero duplicate entries and zero dummy accounts.
 */
export async function getMongoGlobalLeaderboard(currentTelegramId?: string): Promise<any[] | null> {
  if (!isMongoConnected()) return null;
  try {
    const pipeline: any[] = [
      {
        $match: {
          telegram_id: { $nin: EXCLUDED_DUMMY_IDS },
          username: { $nin: EXCLUDED_DUMMY_USERNAMES },
          is_flagged: { $ne: true }
        }
      },
      // Distinct user filtering: $group by unique telegram_id
      {
        $group: {
          _id: '$telegram_id',
          telegram_id: { $first: '$telegram_id' },
          username: { $first: '$username' },
          points: { $max: '$points' },
          miner_level: { $first: '$miner_level' },
          total_mined: { $max: '$points' },
        }
      },
      {
        $sort: { points: -1 }
      },
      {
        $limit: 50
      }
    ];

    const results = await UserModel.aggregate(pipeline);
    if (!results || results.length === 0) return null;

    return results.map((doc, idx) => ({
      rank: idx + 1,
      username: doc.username || `user_${String(doc.telegram_id).slice(-4)}`,
      minerLevel: doc.miner_level || 1,
      totalPOP: doc.points || 0,
      isCurrentUser: currentTelegramId ? String(doc.telegram_id) === String(currentTelegramId) : false,
    }));
  } catch (err: any) {
    console.warn('[MongoDB Atlas] getMongoGlobalLeaderboard aggregation error:', err?.message);
    return null;
  }
}

/**
 * Calculates the current weekly cycle window strictly for the Saturday-to-Saturday UTC cycle.
 * Saturday is the culmination/contest day of the 7-day cycle, ensuring all referrals made during
 * the week (including Saturday) are strictly synchronized and never prematurely cleared.
 */
export function getWeeklyCycleBounds(now: Date = new Date()): { startOfCycle: Date; endOfCycle: Date } {
  const current = new Date(now);
  const day = current.getUTCDay(); // 0 is Sunday, 6 is Saturday
  // Saturday (6) is culmination day of the cycle: look back 7 days to previous Saturday.
  // Sunday (0) is day 1 of new cycle: look back 1 day to Saturday, etc.
  const diffToSaturday = day === 6 ? 7 : (day + 1);

  const startOfCycle = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() - diffToSaturday,
    0, 0, 0, 0
  ));

  // End of cycle is end of Saturday 23:59:59.999 UTC (i.e. Sunday 00:00:00.000 UTC)
  const endOfCycle = new Date(startOfCycle.getTime() + 8 * 24 * 60 * 60 * 1000);

  return { startOfCycle, endOfCycle };
}

/**
 * Automatically syncs and reconciles qualified referrals from UserModel into ReferralLogModel.
 * Ensures any referred user who completed wallet connection and channel join is marked QUALIFIED
 * in ReferralLogModel, and circular parent-child logs are removed, ensuring 100% synchronization
 * between Squad breakdown and Weekly Leaderboard.
 */
export async function autoReconcileReferralsInMongo(): Promise<void> {
  if (!isMongoConnected()) return;
  try {
    let adminBonus = 0;
    try {
      const configDoc = await SystemSettingsModel.findOne({ key: 'admin_config' }).lean();
      if (configDoc) {
        const configuredBonus = Number(
          configDoc.referral_bonus ??
          configDoc.instant_referral_bonus_pop ??
          (configDoc as any).referralBonusAmount ??
          0
        );
        adminBonus = Number.isFinite(configuredBonus) && configuredBonus >= 0 ? configuredBonus : 0;
      }
    } catch {}

    const verifiedUsers = await UserModel.find({
      referred_by: { $exists: true, $ne: null },
      wallet_address: { $exists: true, $ne: null },
      joined_channel: true,
      is_flagged: { $ne: true },
    }).lean();

    for (const u of verifiedUsers) {
      const refId = String(u.referred_by).replace(/^usr-/, '').replace(/^ref[_-]/i, '').trim();
      const tgId = String(u.telegram_id).trim();
      if (!refId || !tgId || refId === tgId) continue;

      // Check if referrer's referred_by is this user (prevent circular parent log)
      const inviterDoc = await UserModel.findOne({ telegram_id: refId }).lean();
      if (inviterDoc && inviterDoc.referred_by && String(inviterDoc.referred_by).replace(/^usr-/, '').replace(/^ref[_-]/i, '').trim() === tgId) {
        continue;
      }

      await ReferralLogModel.findOneAndUpdate(
        { referrer_id: refId, referred_id: tgId },
        {
          $set: {
            referrer_id: refId,
            referred_id: tgId,
            referred_username: u.username || `user_${tgId.slice(-4)}`,
            referred_first_name: u.first_name || u.username || 'POP Miner',
            has_wallet: true,
            has_channel: true,
            status: 'QUALIFIED',
            reason: 'TON Wallet and Channel verified',
            bonus_awarded: adminBonus,
            referral_bonus_claimed: true,
            qualified_at: u.updated_at || u.created_at || new Date(),
          },
          $setOnInsert: {
            created_at: u.created_at || new Date(),
          }
        },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('[MongoDB Atlas] autoReconcileReferralsInMongo error:', err?.message);
  }
}

/**
 * Retrieves the Weekly Top Referral List from MongoDB using an aggregation pipeline.
 * Adheres strictly to:
 * 1. SATURDAY-TO-SATURDAY CYCLE: Referrals marked as QUALIFIED within startOfCycle and endOfCycle.
 * 2. ONLY QUALIFIED REFERRALS: status === 'QUALIFIED' / 'Qualified'.
 * 3. REAL-TIME ACCURACY: Dynamic aggregation over ReferralLogModel joined with UserModel.
 * 4. SORTING: Primary = qualifiedReferralCount (DESC), Secondary = totalPopEarnings (DESC), Tertiary = earliestQualifiedDate (ASC).
 * 5. EXCLUSIVE REFERRAL BONUS DISPLAY (NO COMMISSIONS): qualifiedReferralCount * adminSettings.referralBonus.
 */
export async function getMongoWeeklyReferralLeaderboard(
  currentTelegramId?: string,
  minThreshold: number = 40,
  prizes: { first: number; second: number; third: number } = { first: 50, second: 30, third: 20 }
): Promise<any[] | null> {
  if (!isMongoConnected()) return null;

  try {
    // 1. Auto-reconcile any verified referrals from UserModel to guarantee zero lag
    await autoReconcileReferralsInMongo();

    const { startOfCycle, endOfCycle } = getWeeklyCycleBounds();

    const pipeline: any[] = [
      // 1. Match ONLY referrals marked as QUALIFIED within current Saturday-to-Saturday weekly cycle
      {
        $match: {
          $or: [
            { status: 'QUALIFIED' },
            { status: 'Qualified' },
            { status: { $regex: /^qualified$/i } },
          ],
          referrer_id: { $nin: EXCLUDED_DUMMY_IDS },
          $expr: {
            $and: [
              {
                $gte: [
                  { $ifNull: ['$qualified_at', { $ifNull: ['$updated_at', '$created_at'] }] },
                  startOfCycle,
                ],
              },
              {
                $lt: [
                  { $ifNull: ['$qualified_at', { $ifNull: ['$updated_at', '$created_at'] }] },
                  endOfCycle,
                ],
              },
            ],
          },
        },
      },
      // 2. Deduplicate: Group by referred_id per referrer to count 1 unique referral per invitee
      {
        $group: {
          _id: { referrer_id: '$referrer_id', referred_id: '$referred_id' },
          referrer_id: { $first: '$referrer_id' },
          bonus_awarded: { $first: '$bonus_awarded' },
          qualifiedDate: { $first: { $ifNull: ['$qualified_at', { $ifNull: ['$updated_at', '$created_at'] }] } },
        },
      },
      // 3. Aggregate count and total bonus earned per referrer, and track earliest qualification date
      {
        $group: {
          _id: '$referrer_id',
          referrer_id: { $first: '$referrer_id' },
          qualifiedReferralCount: { $sum: 1 },
          totalBonusPop: { $sum: { $ifNull: ['$bonus_awarded', 0] } },
          earliestQualifiedDate: { $min: '$qualifiedDate' },
        },
      },
      // 4. Lookup inviter in UserModel to retrieve username
      {
        $lookup: {
          from: 'users',
          localField: 'referrer_id',
          foreignField: 'telegram_id',
          as: 'inviterDoc',
        },
      },
      {
        $unwind: {
          path: '$inviterDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      // 5. Exclude dummy or flagged accounts
      {
        $match: {
          'inviterDoc.username': { $nin: EXCLUDED_DUMMY_USERNAMES },
          'inviterDoc.is_flagged': { $ne: true },
        },
      },
      // 6. Project the actual recorded referral bonuses. Do not synthesize
      // earnings by multiplying the referral count by a configured amount.
      {
        $project: {
          _id: 0,
          telegramId: '$referrer_id',
          username: {
            $ifNull: [
              '$inviterDoc.username',
              { $concat: ['user_', { $substrCP: ['$referrer_id', { $max: [0, { $subtract: [{ $strLenCP: '$referrer_id' }, 4] }] }, 4] }] },
            ],
          },
          qualifiedReferralCount: '$qualifiedReferralCount',
          referralCount: '$qualifiedReferralCount',
          earliestQualifiedDate: '$earliestQualifiedDate',
          totalBonusPop: '$totalBonusPop',
          totalPopEarnings: '$totalBonusPop',
        },
      },
      // 7. Pure Dynamic Descending Ranking:
      // Primary: Number of Qualified Referrals (Descending)
      // Secondary: Total POP earned from referrals (Descending)
      // Tertiary: Earliest qualified date (Ascending - first to reach wins tie)
      {
        $sort: {
          qualifiedReferralCount: -1,
          totalPopEarnings: -1,
          earliestQualifiedDate: 1,
        },
      },
      // 8. Limit to top 50
      {
        $limit: 50,
      },
    ];

    const results = await ReferralLogModel.aggregate(pipeline);
    if (!results) return null;

    return results.map((item, idx) => {
      let prize = 0;
      if (item.qualifiedReferralCount >= minThreshold) {
        if (idx === 0) prize = prizes.first;
        else if (idx === 1) prize = prizes.second;
        else if (idx === 2) prize = prizes.third;
      }
      return {
        rank: idx + 1,
        username: item.username,
        telegramId: item.telegramId,
        referralCount: item.qualifiedReferralCount,
        qualifiedReferralCount: item.qualifiedReferralCount,
        totalBonusPop: Number(item.totalBonusPop ?? 0),
        totalPopEarnings: Number(item.totalBonusPop ?? 0),
        earliestQualifiedDate: item.earliestQualifiedDate,
        prizeUsdt: prize,
        isCurrentUser: currentTelegramId ? String(item.telegramId) === String(currentTelegramId) : false,
      };
    });
  } catch (err: any) {
    console.warn('[MongoDB Atlas] getMongoWeeklyReferralLeaderboard aggregation error:', err?.message);
    return null;
  }
}

/**
 * Retrieves deduplicated admin users from MongoDB using aggregation pipeline
 */
export async function getMongoAdminUsers(): Promise<any[] | null> {
  if (!isMongoConnected()) return null;
  try {
    const pipeline: any[] = [
      {
        $match: {
          telegram_id: { $nin: EXCLUDED_DUMMY_IDS },
          username: { $nin: EXCLUDED_DUMMY_USERNAMES }
        }
      },
      {
        $group: {
          _id: '$telegram_id',
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      },
      {
        $sort: { points: -1 }
      }
    ];

    const results = await UserModel.aggregate(pipeline);
    if (!results || results.length === 0) return null;

    return results.map(doc => mapMongoDocToUser(doc));
  } catch (err: any) {
    console.warn('[MongoDB Atlas] getMongoAdminUsers aggregation error:', err?.message);
    return null;
  }
}

/**
 * Creates and logs a user transaction/activity log directly into MongoDB Atlas
 */
export async function logTransactionInMongo(params: {
  userId: string;
  telegramId?: string;
  type: string;
  title: string;
  amount: number;
  status?: string;
  details?: string;
  createdAt?: Date | string;
}): Promise<ITransactionDocument | null> {
  if (!isMongoConnected()) return null;
  try {
    const txDate = params.createdAt ? new Date(params.createdAt) : new Date();

    // Prevent duplicated log entries in MongoDB (10-second window for same user/type/title/amount)
    const tenSecAgo = new Date(Date.now() - 10000);
    const existing = await TransactionModel.findOne({
      $or: [
        { userId: String(params.userId) },
        ...(params.telegramId ? [{ telegramId: String(params.telegramId) }] : []),
      ],
      type: params.type,
      title: params.title,
      amount: Number(params.amount),
      createdAt: { $gte: tenSecAgo },
    });
    if (existing) {
      console.log(`[MongoDB Atlas] Skipped duplicate transaction log: [${params.type}] "${params.title}" (${params.amount} POP)`);
      return existing;
    }

    const tx = new TransactionModel({
      userId: String(params.userId),
      telegramId: params.telegramId ? String(params.telegramId) : undefined,
      type: params.type,
      title: params.title,
      amount: Number(params.amount),
      status: params.status || 'COMPLETED',
      details: params.details || null,
      createdAt: txDate,
      created_at: txDate,
    });

    await tx.save();
    console.log(`[MongoDB Atlas] Logged transaction: [${params.type}] "${params.title}" ${params.amount > 0 ? '+' : ''}${params.amount} POP for user ${params.userId}`);
    return tx;
  } catch (err: any) {
    lastMongoError = err?.message || String(err);
    console.warn('[MongoDB Atlas] logTransactionInMongo error:', err?.message);
    return null;
  }
}

/**
 * Retrieves all activity / transaction logs for a user from MongoDB Atlas sorted by createdAt descending
 */
export async function getTransactionsFromMongo(userIdOrTelegramId: string): Promise<AppTransaction[]> {
  if (!isMongoConnected() || !userIdOrTelegramId) return [];
  try {
    const cleanId = String(userIdOrTelegramId).trim();
    const query = {
      $or: [
        { userId: cleanId },
        { telegramId: cleanId },
        { userId: `usr-${cleanId}` },
        { telegramId: cleanId.replace(/^usr-/, '') },
      ]
    };

    const docs = await TransactionModel.find(query).sort({ createdAt: -1, created_at: -1 }).limit(100).lean();

    return docs.map((doc: any) => ({
      id: doc._id?.toString() || `tx-${Date.now()}`,
      userId: String(doc.userId),
      telegramId: doc.telegramId ? String(doc.telegramId) : undefined,
      type: doc.type as any,
      title: doc.title,
      amount: doc.amount,
      status: doc.status as any,
      details: doc.details || undefined,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : (doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString()),
    }));
  } catch (err: any) {
    console.warn('[MongoDB Atlas] getTransactionsFromMongo error:', err?.message);
    return [];
  }
}

/**
 * Loads all active Mining Levels from MongoDB Atlas
 */
export async function loadMiningLevelsFromMongo(): Promise<MinerTier[] | null> {
  if (!isMongoConnected()) return null;
  try {
    const docs = await MiningLevelModel.find({ isActive: true }).sort({ level: 1 }).lean();
    if (!docs || docs.length === 0) return null;

    return docs.map((d: any) => ({
      level: Number(d.level),
      name: String(d.name || `Level ${d.level} Miner`),
      speedPerHour: Number(d.speedPerHour),
      pricePOP: Number(d.pricePOP),
      priceUSD: Number(d.priceUSD || 0),
    }));
  } catch (err: any) {
    console.warn('[MongoDB Atlas] loadMiningLevelsFromMongo error:', err?.message);
    return null;
  }
}

/**
 * Updates a single mining level directly in MongoDB Atlas
 */
export async function saveMiningLevelToMongo(
  level: number,
  speedPerHour: number,
  pricePOP: number,
  name?: string,
  popUsdRate: number = 0.001
): Promise<MinerTier | null> {
  if (!isMongoConnected()) return null;
  try {
    const priceUSD = Number((pricePOP * popUsdRate).toFixed(2));
    const updateData: any = {
      level,
      speedPerHour,
      pricePOP,
      priceUSD,
      isActive: true,
      updatedAt: new Date(),
    };
    if (name) updateData.name = name;

    const doc = await MiningLevelModel.findOneAndUpdate(
      { level },
      { $set: updateData },
      { new: true, upsert: true }
    ).lean();

    return {
      level: doc.level,
      name: doc.name,
      speedPerHour: doc.speedPerHour,
      pricePOP: doc.pricePOP,
      priceUSD: doc.priceUSD,
    };
  } catch (err: any) {
    console.warn(`[MongoDB Atlas] saveMiningLevelToMongo (level ${level}) error:`, err?.message);
    return null;
  }
}

/**
 * Bulk updates mining levels in MongoDB Atlas
 */
export async function saveBulkMiningLevelsToMongo(
  levels: MinerTier[],
  popUsdRate: number = 0.001
): Promise<MinerTier[]> {
  if (!isMongoConnected() || !levels || levels.length === 0) return levels;
  try {
    const ops = levels.map((lvl) => ({
      updateOne: {
        filter: { level: lvl.level },
        update: {
          $set: {
            level: lvl.level,
            name: lvl.name || `Level ${lvl.level} Rig`,
            speedPerHour: Number(lvl.speedPerHour),
            pricePOP: Number(lvl.pricePOP),
            priceUSD: Number((lvl.pricePOP * popUsdRate).toFixed(2)),
            isActive: true,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await MiningLevelModel.bulkWrite(ops);
    console.log(`[MongoDB Atlas] Successfully bulk saved ${levels.length} mining levels`);
    return levels;
  } catch (err: any) {
    console.warn('[MongoDB Atlas] saveBulkMiningLevelsToMongo error:', err?.message);
    return levels;
  }
}



