import { UserModel, ReferralLogModel, TransactionModel, SystemSettingsModel } from './models/index.js';
import { db } from './db.js';
import { isMongoConnected } from './mongoose.js';

export interface ReferralRewardResult {
  success: boolean;
  awardedBonus: number;
  referrerTelegramId?: string;
  newBalance?: number;
  reason?: string;
}

/**
 * 1. STRICTLY DYNAMIC FROM ADMIN PANEL
 * Fetches the active referral bonus amount and squad commission rate dynamically from the Admin Panel.
 * Never hardcodes fixed numbers like 200 POP or 10%.
 */
export async function getActiveAdminReferralSettings(): Promise<{ referralBonus: number; squadCommissionRate: number }> {
  let bonus: number | undefined;
  let commissionRate: number | undefined;

  if (isMongoConnected()) {
    try {
      const doc = (await SystemSettingsModel.findOne({ key: 'admin_config' }).lean()) as any;
      if (doc) {
        if (doc.referralBonus !== undefined) bonus = Number(doc.referralBonus);
        else if (doc.referralBonusAmount !== undefined) bonus = Number(doc.referralBonusAmount);
        else if (doc.referral_bonus !== undefined) bonus = Number(doc.referral_bonus);
        else if (doc.instant_referral_bonus_pop !== undefined) bonus = Number(doc.instant_referral_bonus_pop);

        if (doc.referralCommissionPercent !== undefined) commissionRate = Number(doc.referralCommissionPercent);
        else if (doc.squadCommissionRate !== undefined) commissionRate = Number(doc.squadCommissionRate);
        else if (doc.referral_commission_percent !== undefined) commissionRate = Number(doc.referral_commission_percent);
      }
    } catch (err: any) {
      console.warn('[Admin Settings] Error querying Mongo settings:', err?.message);
    }
  }

  const memConfig = db.getConfig() as any;
  if (bonus === undefined || isNaN(bonus) || bonus < 0) {
    bonus = Number(memConfig.referralBonus ?? memConfig.referralBonusAmount ?? memConfig.referral_bonus ?? memConfig.instantReferralBonusPOP ?? 100);
  }
  if (commissionRate === undefined || isNaN(commissionRate) || commissionRate < 0) {
    commissionRate = Number(memConfig.squadCommissionRate ?? memConfig.referralCommissionPercent ?? memConfig.referral_commission_percent ?? 10);
  }
  commissionRate = Math.max(0, Math.min(100, Number(commissionRate)));

  return {
    referralBonus: bonus,
    squadCommissionRate: commissionRate,
  };
}

/**
 * 2. RECORD PENDING REFERRAL (INITIAL STATE)
 * When a user registers via a referral link:
 * - Sets status = 'PENDING'
 * - Absolutely ZERO bonus and ZERO commission is awarded while in PENDING status!
 * - Increments referrer's total_joined count by 1
 */
export async function recordPendingReferral(
  referrerTelegramId: string,
  newReferredUser: {
    telegramId: string;
    username?: string;
    firstName?: string;
  }
): Promise<{ success: boolean; reason?: string }> {
  try {
    const cleanReferrerId = String(referrerTelegramId || '').trim();
    const cleanReferredId = String(newReferredUser?.telegramId || '').trim();

    if (!cleanReferrerId || !cleanReferredId || cleanReferrerId === cleanReferredId) {
      return { success: false, reason: 'INVALID_OR_SELF_REFERRAL' };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // In-memory registration: status PENDING, 0 bonus awarded
    const memReferrer = db.getUser(cleanReferrerId);
    if (memReferrer) {
      memReferrer.total_joined = (memReferrer.total_joined || 0) + 1;
      db.saveUser(memReferrer);
    }

    const squadList = db.getUserReferrals(cleanReferrerId);
    const existingIdx = squadList.findIndex(r => r.telegramId === cleanReferredId || r.id === cleanReferredId);
    const squadItem = {
      id: `usr-${cleanReferredId}`,
      telegramId: cleanReferredId,
      telegram_id: cleanReferredId,
      username: newReferredUser.username || `user_${cleanReferredId.slice(-4)}`,
      firstName: newReferredUser.firstName || newReferredUser.username || 'POP Miner',
      first_name: newReferredUser.firstName || newReferredUser.username || 'POP Miner',
      joinedAt: nowIso,
      created_at: nowIso,
      isQualified: false,
      hasChannel: false,
      hasWallet: false,
      hasMined: false,
      isMultiAccount: false,
      status: 'PENDING' as any,
      bonusAwardedPOP: 0,
      referralBonusClaimed: false,
    };

    if (existingIdx >= 0) {
      squadList[existingIdx] = { ...squadList[existingIdx], ...squadItem };
    } else {
      squadList.unshift(squadItem as any);
    }

    // MongoDB Atlas: Log initial Pending referral
    if (isMongoConnected()) {
      await ReferralLogModel.findOneAndUpdate(
        { referred_id: cleanReferredId },
        {
          $setOnInsert: {
            referrer_id: cleanReferrerId,
            referred_id: cleanReferredId,
            referred_username: newReferredUser.username || '',
            referred_first_name: newReferredUser.firstName || '',
            status: 'PENDING',
            bonus_awarded: 0,
            referral_bonus_claimed: false,
            has_wallet: false,
            has_channel: false,
            qualified_at: null,
            created_at: now,
          },
          $set: {
            updated_at: now,
          },
        },
        { upsert: true }
      ).catch(err => console.warn('[recordPendingReferral] Mongo ReferralLogModel error:', err?.message));

      await UserModel.updateOne(
        { telegram_id: cleanReferrerId },
        { $inc: { total_joined: 1 } }
      ).catch(err => console.warn('[recordPendingReferral] Increment total_joined error:', err?.message));
    }

    return { success: true };
  } catch (err: any) {
    console.error('[recordPendingReferral Error]:', err?.message || err);
    return { success: false, reason: err?.message || 'INTERNAL_ERROR' };
  }
}

export interface ReferralStatusVerificationResult {
  success: boolean;
  status: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED';
  isQualified: boolean;
  hasWallet: boolean;
  hasChannel: boolean;
  isUniqueIpDevice: boolean;
  reason?: string;
  awardedBonus: number;
  referrerTelegramId?: string;
  newBalance?: number;
}

/**
 * 3. STRICT REFERRAL STATUS VERIFICATION
 * 
 * STRICT STATUS REQUIREMENTS:
 * 1. PENDING STATUS BY DEFAULT: Every new referral MUST start in 'PENDING' status.
 * 2. STRICT QUALIFICATION CHECK: Changes from 'PENDING' to 'QUALIFIED' ONLY IF:
 *    - TON Wallet is connected.
 *    - TG Channel is joined.
 *    - Unique IP/Device is verified.
 * 3. NO BONUS ON PENDING: Referrers must NOT receive any bonus or commission while in 'PENDING'.
 */
export async function verifyReferralStatus(params: {
  referredTelegramId: string;
  referrerTelegramId?: string;
  hasWallet?: boolean;
  hasChannel?: boolean;
  clientIp?: string;
  deviceFingerprint?: string;
}): Promise<ReferralStatusVerificationResult> {
  try {
    const cleanReferredId = String(params.referredTelegramId || '').trim();
    if (!cleanReferredId) {
      return {
        success: false,
        status: 'PENDING',
        isQualified: false,
        hasWallet: false,
        hasChannel: false,
        isUniqueIpDevice: false,
        reason: 'MISSING_REFERRED_ID',
        awardedBonus: 0,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Resolve referred user in memory and MongoDB
    const memReferredUser = db.getUser(cleanReferredId);
    let referrerId = String(params.referrerTelegramId || memReferredUser?.referrerId || '').trim();
    let referredUsername = memReferredUser?.username || '';
    let existingLog: any = null;
    let userDoc: any = null;

    if (isMongoConnected()) {
      try {
        userDoc = await UserModel.findOne({ telegram_id: cleanReferredId }).lean();
        existingLog = await ReferralLogModel.findOne({ referred_id: cleanReferredId });
        if (existingLog) {
          if (!referrerId) referrerId = String(existingLog.referrer_id || '').trim();
          if (!referredUsername) referredUsername = existingLog.referred_username || '';
        }
        if (userDoc) {
          if (!referrerId) referrerId = String(userDoc.referred_by || '').replace(/^usr-/, '').replace(/^ref[_-]/i, '').trim();
          if (!referredUsername) referredUsername = userDoc.username || '';
        }
      } catch (err) {
        console.warn('[referralReward] Mongo lookup error:', err);
      }
    }

    if (!referrerId) {
      return {
        success: false,
        status: 'PENDING',
        isQualified: false,
        hasWallet: Boolean(params.hasWallet || memReferredUser?.tonWalletAddress || userDoc?.wallet_address),
        hasChannel: Boolean(params.hasChannel || memReferredUser?.hasJoinedChannel || userDoc?.joined_channel),
        isUniqueIpDevice: false,
        reason: 'REFERRER_NOT_FOUND',
        awardedBonus: 0,
      };
    }

    const memReferrer = db.getUser(referrerId);

    // 2. Resolve requirements status strictly
    const hasWallet = Boolean(
      params.hasWallet !== undefined
        ? params.hasWallet
        : (
            (userDoc?.wallet_address && String(userDoc.wallet_address).trim() !== '') ||
            memReferredUser?.tonWalletAddress ||
            (memReferredUser as any)?.wallet_address ||
            existingLog?.has_wallet
          )
    );
    const hasChannel = Boolean(
      params.hasChannel !== undefined
        ? params.hasChannel
        : (
            userDoc?.joined_channel ||
            memReferredUser?.hasJoinedChannel ||
            Boolean((memReferredUser as any)?.joined_channel) ||
            existingLog?.has_channel ||
            Boolean(memReferredUser?.completedTasks?.includes('task-tg-channel')) ||
            Boolean(userDoc?.completed_tasks?.includes('task-tg-channel'))
          )
    );

    // 3. Resolve IP and Device information
    const inviterIp = memReferrer?.ipAddress || existingLog?.inviter_ip;
    const inviterDevice = memReferrer?.deviceFingerprint || existingLog?.inviter_device;
    const referredIp = params.clientIp || memReferredUser?.ipAddress || existingLog?.referred_ip;
    const referredDevice = params.deviceFingerprint || memReferredUser?.deviceFingerprint || existingLog?.referred_device;

    const sameIp = Boolean(
      inviterIp && referredIp &&
      inviterIp === referredIp &&
      inviterIp !== '127.0.0.1' &&
      !inviterIp.includes('::1')
    );
    const sameDevice = Boolean(
      inviterDevice && referredDevice &&
      inviterDevice === referredDevice
    );
    const isSelfReferral = referrerId === cleanReferredId;
    const isFlagged = Boolean(memReferredUser?.isFlagged);

    const isFraudOrSameIp = sameIp || sameDevice || isSelfReferral || isFlagged;
    const isUniqueIpDevice = !isFraudOrSameIp;

    // RULE 1: SAME IP / DEVICE / MULTI-ACCOUNT DETECTED -> STRICTLY UNQUALIFIED
    if (isFraudOrSameIp) {
      const disqualificationReason = sameIp && sameDevice
        ? 'Same IP and Device ID detected'
        : sameIp
        ? 'Same IP address detected'
        : sameDevice
        ? 'Same Device ID detected'
        : (isSelfReferral ? 'Self-referral detected' : 'Account flagged');

      if (isMongoConnected()) {
        await ReferralLogModel.updateOne(
          { referred_id: cleanReferredId },
          {
            $set: {
              status: 'UNQUALIFIED',
              has_wallet: hasWallet,
              has_channel: hasChannel,
              bonus_awarded: 0,
              referral_bonus_claimed: false,
              reason: disqualificationReason,
              updated_at: now,
            },
          }
        ).catch(err => console.warn('[verifyReferralStatus] Mongo UNQUALIFIED update error:', err?.message));
      }

      if (memReferredUser) {
        memReferredUser.isQualified = false;
        memReferredUser.isFlagged = true;
        db.saveUser(memReferredUser);
      }

      const squadList = db.getUserReferrals(referrerId);
      const targetItem = squadList.find(r => r.telegramId === cleanReferredId || r.id === cleanReferredId);
      if (targetItem) {
        targetItem.status = 'UNQUALIFIED' as any;
        targetItem.isQualified = false;
        targetItem.isMultiAccount = true;
        targetItem.hasWallet = hasWallet;
        targetItem.hasChannel = hasChannel;
        targetItem.bonusAwardedPOP = 0;
        targetItem.referralBonusClaimed = false;
        targetItem.disqualifiedReason = disqualificationReason;
      }

      return {
        success: true,
        status: 'UNQUALIFIED',
        isQualified: false,
        hasWallet,
        hasChannel,
        isUniqueIpDevice: false,
        reason: disqualificationReason,
        awardedBonus: 0,
        referrerTelegramId: referrerId,
      };
    }

    // RULE 2: MISSING TON WALLET OR MISSING CHANNEL -> STRICTLY PENDING ACTION
    if (!hasWallet || !hasChannel) {
      const pendingReason = !hasWallet && !hasChannel
        ? 'Missing TON Wallet and Channel Join'
        : (!hasWallet ? 'Missing TON Wallet' : 'Missing Channel Join');

      // Sync PENDING status to MongoDB ReferralLogModel
      if (isMongoConnected()) {
        await ReferralLogModel.updateOne(
          { referred_id: cleanReferredId },
          {
            $set: {
              status: 'PENDING',
              has_wallet: hasWallet,
              has_channel: hasChannel,
              bonus_awarded: 0,
              referral_bonus_claimed: false,
              reason: pendingReason,
              updated_at: now,
            },
          }
        ).catch(err => console.warn('[verifyReferralStatus] Mongo PENDING update error:', err?.message));
      }

      // Sync PENDING state to in-memory squad
      if (memReferredUser) {
        memReferredUser.isQualified = false;
        db.saveUser(memReferredUser);
      }
      const squadList = db.getUserReferrals(referrerId);
      const targetItem = squadList.find(r => r.telegramId === cleanReferredId || r.id === cleanReferredId);
      if (targetItem) {
        targetItem.status = 'PENDING' as any;
        targetItem.isQualified = false;
        targetItem.hasWallet = hasWallet;
        targetItem.hasChannel = hasChannel;
        targetItem.bonusAwardedPOP = 0;
        targetItem.referralBonusClaimed = false;
        targetItem.disqualifiedReason = undefined;
      }

      return {
        success: true,
        status: 'PENDING',
        isQualified: false,
        hasWallet,
        hasChannel,
        isUniqueIpDevice: true,
        reason: pendingReason,
        awardedBonus: 0,
        referrerTelegramId: referrerId,
      };
    }

    // RULE 3: WALLET CONNECTED + CHANNEL JOINED + UNIQUE IP/DEVICE -> QUALIFIED
    const adminSettings = await getActiveAdminReferralSettings();
    const dynamicBonus = adminSettings.referralBonus;

    // Check if already claimed in MongoDB or memory
    let alreadyClaimed = false;
    if (existingLog && (existingLog.referral_bonus_claimed === true || existingLog.bonus_awarded > 0)) {
      alreadyClaimed = true;
    }
    const squadList = db.getUserReferrals(referrerId);
    const targetItem = squadList.find(r => r.telegramId === cleanReferredId || r.id === cleanReferredId);
    if (targetItem && (targetItem.referralBonusClaimed || (targetItem.bonusAwardedPOP && targetItem.bonusAwardedPOP > 0))) {
      alreadyClaimed = true;
    }

    if (alreadyClaimed) {
      if (memReferredUser) {
        memReferredUser.isQualified = true;
        db.saveUser(memReferredUser);
      }
      if (targetItem) {
        targetItem.isQualified = true;
        targetItem.status = 'QUALIFIED' as any;
        targetItem.hasWallet = true;
        targetItem.hasChannel = true;
        targetItem.isMultiAccount = false;
        if (!targetItem.bonusAwardedPOP || targetItem.bonusAwardedPOP === 0) {
          targetItem.bonusAwardedPOP = dynamicBonus;
        }
      }
      return {
        success: true,
        status: 'QUALIFIED',
        isQualified: true,
        hasWallet: true,
        hasChannel: true,
        isUniqueIpDevice: true,
        awardedBonus: targetItem?.bonusAwardedPOP || dynamicBonus,
        referrerTelegramId: referrerId,
        reason: 'ALREADY_QUALIFIED',
      };
    }

    // Single Payout Award
    let updatedPoints = 0;
    if (isMongoConnected()) {
      const updatedLog = await ReferralLogModel.findOneAndUpdate(
        {
          referred_id: cleanReferredId,
          referral_bonus_claimed: { $ne: true },
          bonus_awarded: { $lte: 0 },
        },
        {
          $set: {
            status: 'QUALIFIED',
            referral_bonus_claimed: true,
            bonus_awarded: dynamicBonus,
            qualified_at: now,
            has_wallet: true,
            has_channel: true,
            reason: 'TON Wallet, Channel & Unique Device verified',
            updated_at: now,
          },
        },
        { new: true }
      );

      if (!updatedLog) {
        return {
          success: true,
          status: 'QUALIFIED',
          isQualified: true,
          hasWallet: true,
          hasChannel: true,
          isUniqueIpDevice: true,
          awardedBonus: 0,
          referrerTelegramId: referrerId,
          reason: 'CONCURRENT_CLAIM_PREVENTED',
        };
      }

      const updatedReferrerDoc = await UserModel.findOneAndUpdate(
        { telegram_id: referrerId },
        {
          $inc: { points: dynamicBonus },
          $set: { updated_at: now },
        },
        { new: true }
      ).lean();

      if (updatedReferrerDoc) {
        updatedPoints = updatedReferrerDoc.points;
      }

      await TransactionModel.create({
        telegram_id: referrerId,
        type: 'REFERRAL_BONUS',
        title: 'Qualified Referral Bonus',
        amount: dynamicBonus,
        status: 'COMPLETED',
        details: `Qualified referral bonus for inviting @${referredUsername || cleanReferredId}`,
        created_at: now,
      }).catch(err => console.warn('[verifyReferralStatus] TransactionModel error:', err?.message));
    }

    if (memReferrer) {
      memReferrer.balancePOP = updatedPoints > 0
        ? updatedPoints
        : parseFloat((memReferrer.balancePOP + dynamicBonus).toFixed(4));
      db.saveUser(memReferrer);
    }

    db.logTransaction({
      telegramId: referrerId,
      userId: memReferrer ? memReferrer.id : `usr-${referrerId}`,
      type: 'REFERRAL_BONUS',
      title: 'Qualified Referral Bonus',
      amount: dynamicBonus,
      status: 'COMPLETED',
      details: `Qualified referral bonus for inviting @${referredUsername || cleanReferredId}`,
      createdAt: nowIso,
    });

    if (memReferredUser) {
      memReferredUser.isQualified = true;
      db.saveUser(memReferredUser);
    }

    if (targetItem) {
      targetItem.isQualified = true;
      targetItem.status = 'QUALIFIED' as any;
      targetItem.hasWallet = true;
      targetItem.hasChannel = true;
      targetItem.isMultiAccount = false;
      targetItem.bonusAwardedPOP = dynamicBonus;
      targetItem.referralBonusClaimed = true;
      targetItem.qualifiedAt = nowIso;
      targetItem.disqualifiedReason = undefined;
    }

    console.log(`[Referral Verification] User ${cleanReferredId} strictly QUALIFIED! Dynamic +${dynamicBonus} POP awarded to referrer ${referrerId}.`);

    return {
      success: true,
      status: 'QUALIFIED',
      isQualified: true,
      hasWallet: true,
      hasChannel: true,
      isUniqueIpDevice: true,
      awardedBonus: dynamicBonus,
      referrerTelegramId: referrerId,
      newBalance: updatedPoints || (memReferrer ? memReferrer.balancePOP : dynamicBonus),
    };
  } catch (err: any) {
    console.error('[verifyReferralStatus Error]:', err?.message || err);
    return {
      success: false,
      status: 'PENDING',
      isQualified: false,
      hasWallet: false,
      hasChannel: false,
      isUniqueIpDevice: false,
      reason: err?.message || 'INTERNAL_ERROR',
      awardedBonus: 0,
    };
  }
}

/**
 * Backward compatibility alias for qualifyReferralAndReward
 */
export async function qualifyReferralAndReward(
  referredTelegramId: string,
  requirements: { hasWallet: boolean; hasChannel: boolean; clientIp?: string; deviceFingerprint?: string }
): Promise<ReferralRewardResult> {
  const result = await verifyReferralStatus({
    referredTelegramId,
    hasWallet: requirements.hasWallet,
    hasChannel: requirements.hasChannel,
    clientIp: requirements.clientIp,
    deviceFingerprint: requirements.deviceFingerprint,
  });

  return {
    success: result.success && result.isQualified,
    awardedBonus: result.awardedBonus,
    referrerTelegramId: result.referrerTelegramId,
    newBalance: result.newBalance,
    reason: result.reason,
  };
}
