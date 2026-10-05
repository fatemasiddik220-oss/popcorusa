import { Request, Response } from 'express';
import { db, isMockOrDummyUser } from './db.js';
import { getMyReferralsFromMongo, getMongoWeeklyReferralLeaderboard, getWeeklyCycleBounds } from './mongoRepo.js';
import { getActiveAdminReferralSettings } from './referralReward.js';

export function calculateLeaderboardWindow(filter?: string, customStart?: string, customEnd?: string): {
  startTime: Date;
  endTime: Date;
  label: string;
  filter: string;
} {
  const normalizedFilter = String(filter || 'weekly').toLowerCase().trim();
  const now = new Date();

  if (normalizedFilter === '7d' || normalizedFilter === '7days') {
    const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endTime = now;
    return {
      startTime,
      endTime,
      label: 'Last 7 Days',
      filter: '7d',
    };
  }

  if (normalizedFilter === '30d' || normalizedFilter === '1m' || normalizedFilter === '30days' || normalizedFilter === '1month') {
    const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endTime = now;
    return {
      startTime,
      endTime,
      label: 'Last 30 Days (1 Month)',
      filter: '30d',
    };
  }

  if (customStart || normalizedFilter === 'custom') {
    if (customStart) {
      const sDate = new Date(customStart);
      sDate.setUTCHours(0, 0, 0, 0);
      const eDate = customEnd ? new Date(customEnd) : new Date(customStart);
      eDate.setUTCHours(23, 59, 59, 999);
      return {
        startTime: isNaN(sDate.getTime()) ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : sDate,
        endTime: isNaN(eDate.getTime()) ? now : eDate,
        label: 'Custom Range',
        filter: 'custom',
      };
    }
  }

  // Default: Saturday-to-Saturday Contest Window (start of current Saturday to end of current Saturday)
  const { startOfCycle, endOfCycle } = getWeeklyCycleBounds(now);
  return {
    startTime: startOfCycle,
    endTime: endOfCycle,
    label: 'Saturday to Saturday Contest',
    filter: 'weekly',
  };
}

export const SquadController = {
  /**
   * Resolves the real-time weekly top referral list from MongoDB and reconciles with active in-memory state.
   * Strictly adheres to Saturday-to-Saturday cycle (or user filtered date range), qualified referrals only, and real-time accuracy.
   */
  resolveWeeklyLeaderboard: async (
    currentTelegramId?: string,
    currentUser?: any,
    options?: { filter?: string; startDate?: string; endDate?: string }
  ) => {
    const config = db.getConfig();
    const minThreshold = config.weeklyContestMinThreshold || 40;
    const prizes = config.weeklyPrizesUsdt || { first: 50, second: 30, third: 20 };

    const { startTime, endTime } = calculateLeaderboardWindow(
      options?.filter,
      options?.startDate,
      options?.endDate
    );

    // 1. Fetch from MongoDB Atlas using the aggregation pipeline with active window
    const mongoLeaderboard = await getMongoWeeklyReferralLeaderboard(
      currentTelegramId,
      minThreshold,
      prizes,
      startTime,
      endTime
    );

    // 2. Fetch from in-memory engine using active date window
    const memLeaderboard = db.getWeeklyReferralLeaderboard(
      currentUser?.id || currentTelegramId,
      startTime,
      endTime
    );

    // 3. Reconcile both lists into a single canonical global map (strictly deduplicated by telegramId)
    const combinedMap = new Map<string, any>();

    if (mongoLeaderboard && mongoLeaderboard.length > 0) {
      for (const item of mongoLeaderboard) {
        const tid = String(item.telegramId).trim();
        if (tid) {
          const count = item.qualifiedReferralCount ?? item.referralCount ?? 0;
          // Strictly only include if qualified referrals exist within the active window
          if (count > 0) {
            combinedMap.set(tid, {
              ...item,
              telegramId: tid,
              referralCount: count,
              qualifiedReferralCount: count,
              totalPopEarnings: Number(item.totalBonusPop ?? 0),
              earliestQualifiedDate: item.earliestQualifiedDate || item.qualifiedDate,
            });
          }
        }
      }
    }

    if (memLeaderboard && memLeaderboard.length > 0) {
      for (const mItem of memLeaderboard) {
        const tid = String(mItem.telegramId).trim();
        if (!tid) continue;
        const mCount = mItem.qualifiedReferralCount ?? mItem.referralCount ?? 0;
        // Strictly only include if qualified referrals exist within the active window
        if (mCount <= 0) continue;
        const existing = combinedMap.get(tid);
        if (!existing) {
          combinedMap.set(tid, {
            ...mItem,
            telegramId: tid,
            referralCount: mCount,
            qualifiedReferralCount: mCount,
            totalPopEarnings: Number(mItem.totalPopEarnings ?? 0),
          });
        } else {
          // If in-memory count is higher (e.g. freshly verified referral in same window), adopt it
          const existCount = existing.qualifiedReferralCount ?? existing.referralCount ?? 0;
          if (mCount > existCount) {
            existing.referralCount = mCount;
            existing.qualifiedReferralCount = mCount;
          }
          existing.totalPopEarnings = Math.max(Number(existing.totalPopEarnings) || 0, Number(mItem.totalPopEarnings) || 0);
          if (mItem.username && (!existing.username || existing.username.startsWith('user_'))) {
            existing.username = mItem.username;
          }
        }
      }
    }

    // 4. Pure Dynamic Global Descending Ranking across ALL users:
    // - Primary: Number of Qualified Referrals (Descending: qualifiedReferralCount: -1)
    // - Secondary: Total POP earned from referrals (Descending: totalPopEarnings: -1)
    // - Tertiary: Earliest qualified date (Ascending - first to reach wins tie)
    const sortedList = Array.from(combinedMap.values()).sort((a, b) => {
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

    // 5. Assign exact same global rank to all users, highlighting isCurrentUser cleanly
    const normalizedTgId = currentTelegramId ? String(currentTelegramId).trim() : (currentUser?.telegramId ? String(currentUser.telegramId).trim() : '');

    return sortedList.slice(0, 50).map((u, idx) => {
      const count = u.qualifiedReferralCount ?? u.referralCount ?? 0;
      let prize = 0;
      if (count >= minThreshold) {
        if (idx === 0) prize = prizes.first;
        else if (idx === 1) prize = prizes.second;
        else if (idx === 2) prize = prizes.third;
      }
      return {
        ...u,
        rank: idx + 1,
        referralCount: count,
        qualifiedReferralCount: count,
        totalPopEarnings: Number((Number(u.totalPopEarnings) || 0).toFixed(4)),
        prizeUsdt: prize,
        isCurrentUser: Boolean(normalizedTgId && String(u.telegramId).trim() === normalizedTgId),
      };
    });
  },

  /**
   * GET /api/leaderboard/weekly and /api/squad/weekly-leaderboard
   * Returns the Saturday-to-Saturday cycle leaderboard.
   */
  getWeeklyLeaderboard: async (req: Request, res: Response) => {
    try {
      const headerTgId = (req.headers['x-telegram-id'] as string) || '';
      const queryTgId = (req.query.telegramId as string) || (req.query.telegram_id as string) || '';
      const telegramId = headerTgId || queryTgId;
      const user = telegramId ? db.getUser(telegramId) : undefined;

      const filter = (req.query.timeRange as string) || (req.query.dateFilter as string) || (req.query.filter as string) || 'weekly';
      const startDate = (req.query.startDate as string) || (req.query.start as string) || (req.query.from as string);
      const endDate = (req.query.endDate as string) || (req.query.end as string) || (req.query.to as string);

      const windowInfo = calculateLeaderboardWindow(filter, startDate, endDate);
      const leaderboard = await SquadController.resolveWeeklyLeaderboard(telegramId, user, {
        filter: windowInfo.filter,
        startDate: windowInfo.startTime.toISOString(),
        endDate: windowInfo.endTime.toISOString(),
      });

      res.json({
        success: true,
        filter: windowInfo.filter,
        cycle: {
          start: windowInfo.startTime.toISOString(),
          end: windowInfo.endTime.toISOString(),
          label: windowInfo.label,
          filter: windowInfo.filter,
        },
        leaderboard,
      });
    } catch (err: any) {
      console.error('[SquadController.getWeeklyLeaderboard Error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
  /**
   * GET /api/squad/my-referrals and /api/squad/stats
   * Strictly returns ONLY users who were invited by the requesting user.
   * Under NO CIRCUMSTANCES will the referrer appear in the child user's referral list.
   */
  getMyReferrals: async (req: Request, res: Response) => {
    try {
      const headerTgId = (req.headers['x-telegram-id'] as string) || '';
      const queryTgId = (req.query.telegramId as string) || (req.query.telegram_id as string) || '';
      const headerRefCode = (req.headers['x-referral-code'] as string) || '';
      const queryRefCode = (req.query.referralCode as string) || (req.query.referral_code as string) || '';
      const queryUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';

      let telegramId = headerTgId || queryTgId;
      let referralCode = headerRefCode || queryRefCode;

      // Resolve user from database
      let user = telegramId ? db.getUser(telegramId) : undefined;
      if (!user && referralCode) {
        user = db.getUserByReferralCode(referralCode);
      }

      const config = db.getConfig();
      const adminSettings = await getActiveAdminReferralSettings();
      const dynamicBonus = adminSettings.referralBonus;
      const dynamicCommissionRate = adminSettings.squadCommissionRate;

      // If no authorized user could be identified, return empty list (NEVER fall back to first registered user!)
      if (!user && !telegramId) {
        return res.json({
          success: true,
          total_joined: 0,
          pending_action: 0,
          qualified: 0,
          unqualified_same_ip: 0,
          referral_bonus: dynamicBonus,
          referralBonusAmount: dynamicBonus,
          squadCommissionRate: dynamicCommissionRate,
          counts: { total: 0, pending: 0, qualified: 0, same_ip: 0 },
          breakdown: { totalJoined: 0, pendingAction: 0, qualified: 0, unqualifiedSameIp: 0 },
          referrals: [],
          my_referral_list: [],
          weeklyLeaderboard: await SquadController.resolveWeeklyLeaderboard(),
          contestConfig: {
            minThreshold: config.weeklyContestMinThreshold,
            prizes: config.weeklyPrizesUsdt,
            commissionRate: dynamicCommissionRate,
            referralBonus: dynamicBonus,
            unclaimedCommission: 0,
            claimedCommission: 0,
          },
        });
      }

      if (user) {
        telegramId = user.telegramId;
        if (!referralCode && user.referralCode) {
          referralCode = user.referralCode;
        }
      }

      // The user's own referrer/parent ID (if this user was invited by someone)
      const parentReferrerId = user?.referrerId ? String(user.referrerId).trim() : null;
      let parentTelegramId: string | null = parentReferrerId;
      let parentReferralCode: string | null = null;
      let parentUsername: string | null = null;

      if (parentReferrerId) {
        const parentUser = db.getUser(parentReferrerId) || db.getUserByReferralCode(parentReferrerId);
        if (parentUser) {
          parentTelegramId = String(parentUser.telegramId).trim();
          parentReferralCode = parentUser.referralCode ? parentUser.referralCode.toUpperCase().trim() : null;
          parentUsername = parentUser.username ? parentUser.username.toLowerCase().trim() : null;
        }
      }

      // 1. Query MongoDB for referrals invited by this user
      const mongoResult = await getMyReferralsFromMongo({
        telegramId,
        referralCode: referralCode || user?.referralCode,
        userId: user?.id || queryUserId || `usr-${telegramId}`,
      });

      // 2. Fetch in-memory referrals for immediate real-time sync
      const memoryReferrals = user ? db.getUserReferrals(user.id) : [];

      // 3. Merge MongoDB referrals and in-memory referrals without duplicates
      const mergedMap = new Map<string, any>();

      // Populate from MongoDB first
      if (mongoResult && mongoResult.referrals) {
        for (const item of mongoResult.referrals) {
          const tId = String(item.telegram_id || item.telegramId).trim();
          const itemRefCode = (item.referralCode || item.referral_code || '').toUpperCase().trim();
          const itemUsername = (item.username || '').toLowerCase().trim();

          // STRICT EXCLUSIONS:
          // a. Never include self
          if (!tId || tId === telegramId || (user && (item.id === user.id || tId === user.telegramId))) {
            continue;
          }
          // b. Under NO CIRCUMSTANCES should the referrer/parent appear in the child user's 'My Referral List'
          if (
            (parentReferrerId && (tId === parentReferrerId || item.id === parentReferrerId || item.id === `usr-${parentReferrerId}`)) ||
            (parentTelegramId && tId === parentTelegramId) ||
            (parentReferralCode && itemRefCode === parentReferralCode) ||
            (parentUsername && itemUsername === parentUsername)
          ) {
            console.log(`[SquadController] Excluded parent referrer ${tId} from child ${telegramId}'s referral list`);
            continue;
          }
          if (isMockOrDummyUser({ telegram_id: tId, username: item.username })) {
            continue;
          }

          mergedMap.set(tId, item);
        }
      }

      // Merge memory referrals
      for (const mItem of memoryReferrals) {
        const tId = String(mItem.telegramId || (mItem as any).telegram_id).trim();
        const itemRefCode = ((mItem as any).referralCode || (mItem as any).referral_code || '').toUpperCase().trim();
        const itemUsername = (mItem.username || '').toLowerCase().trim();

        // STRICT EXCLUSIONS:
        if (!tId || tId === telegramId || (user && (mItem.id === user.id || tId === user.telegramId))) {
          continue;
        }
        if (
          (parentReferrerId && (tId === parentReferrerId || mItem.id === parentReferrerId || mItem.id === `usr-${parentReferrerId}`)) ||
          (parentTelegramId && tId === parentTelegramId) ||
          (parentReferralCode && itemRefCode === parentReferralCode) ||
          (parentUsername && itemUsername === parentUsername)
        ) {
          continue;
        }
        if (isMockOrDummyUser(mItem)) continue;

        const hasWallet = Boolean(
          mItem.hasWallet ||
          (mItem as any).has_wallet ||
          (mItem as any).wallet_address ||
          (mItem as any).walletAddress ||
          (mItem as any).tonWalletAddress
        );
        const hasChannel = Boolean(
          mItem.hasChannel ||
          (mItem as any).has_channel ||
          (mItem as any).joined_channel ||
          (mItem as any).hasJoinedChannel
        );
        const mReason = (mItem.disqualifiedReason || '').toLowerCase();
        const isUnqual = Boolean(
          mItem.status === 'Unqualified' ||
          mItem.status === 'Unqualified (Same IP / Device Match)' ||
          mItem.status === 'UNQUALIFIED - SAME IP' ||
          mItem.status === 'UNQUALIFIED - SAME DEVICE' ||
          (mItem as any).status === 'UNQUALIFIED' ||
          mItem.isMultiAccount ||
          (mReason && (
            mReason.includes('same ip') ||
            mReason.includes('same device') ||
            mReason.includes('self-referral') ||
            mReason.includes('multi-account') ||
            mReason.includes('multi account') ||
            mReason.includes('flagged')
          ))
        );
        const isQual = !isUnqual && hasWallet && hasChannel;

        let normalizedStatus: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED' = 'PENDING';
        if (isUnqual) normalizedStatus = 'UNQUALIFIED';
        else if (isQual) normalizedStatus = 'QUALIFIED';
        else normalizedStatus = 'PENDING';

        const existing = mergedMap.get(tId);
        if (existing) {
          if (mItem.username && (!existing.username || existing.username.startsWith('user_'))) {
            existing.username = mItem.username;
          }
          if (mItem.firstName && (!existing.first_name || existing.first_name === 'POP Miner')) {
            existing.first_name = mItem.firstName;
            existing.firstName = mItem.firstName;
          }
          existing.status = normalizedStatus;
          existing.isQualified = isQual;
          existing.isMultiAccount = isUnqual;
          existing.hasWallet = hasWallet;
          existing.hasChannel = hasChannel;
          if (isQual) {
            existing.bonusAwardedPOP = Number(existing.bonusAwardedPOP) || 0;
          } else {
            existing.bonusAwardedPOP = 0;
          }
        } else {
          mergedMap.set(tId, {
            telegram_id: tId,
            telegramId: tId,
            id: mItem.id || `usr-${tId}`,
            username: mItem.username || `user_${tId.slice(-4)}`,
            first_name: mItem.firstName || mItem.username || 'POP Miner',
            firstName: mItem.firstName || mItem.username || 'POP Miner',
            status: normalizedStatus,
            isQualified: isQual,
            hasWallet,
            hasChannel,
            hasMined: Boolean(mItem.hasMined),
            isMultiAccount: isUnqual,
            bonusAwardedPOP: isQual ? (Number(mItem.bonusAwardedPOP) || 0) : 0,
            disqualifiedReason: mItem.disqualifiedReason,
            created_at: mItem.joinedAt || (mItem as any).created_at || new Date().toISOString(),
            joinedAt: mItem.joinedAt || (mItem as any).created_at || new Date().toISOString(),
          });
        }
      }

      // Convert to sorted list (newest first) with strictly normalized status
      const formattedReferrals = Array.from(mergedMap.values()).map(r => {
        const s = String(r.status || '').toUpperCase();
        const hasWallet = Boolean(
          r.hasWallet || 
          r.has_wallet || 
          r.wallet_address || 
          r.walletAddress || 
          r.tonWalletAddress
        );
        const hasChannel = Boolean(
          r.hasChannel || 
          r.has_channel || 
          r.joined_channel || 
          r.hasJoinedChannel
        );
        const rReason = (r.disqualifiedReason || '').toLowerCase();
        const isUnqual = Boolean(
          s.includes('UNQUALIFIED') ||
          s.includes('SAME IP') ||
          s.includes('SAME DEVICE') ||
          r.isMultiAccount ||
          (rReason && (
            rReason.includes('same ip') ||
            rReason.includes('same device') ||
            rReason.includes('self-referral') ||
            rReason.includes('multi-account') ||
            rReason.includes('multi account') ||
            rReason.includes('flagged')
          ))
        );
        const isQual = !isUnqual && hasWallet && hasChannel;

        let status: 'PENDING' | 'QUALIFIED' | 'UNQUALIFIED' = 'PENDING';
        if (isUnqual) status = 'UNQUALIFIED';
        else if (isQual) status = 'QUALIFIED';
        else status = 'PENDING';

        const joinedAt = r.joinedAt || r.created_at || (r as any).joined_at || new Date().toISOString();
        const created_at = r.created_at || r.joinedAt || (r as any).created_at || new Date().toISOString();

        return {
          ...r,
          joinedAt,
          created_at,
          status,
          isQualified: isQual,
          isMultiAccount: isUnqual,
          hasWallet,
          hasChannel,
          bonusAwardedPOP: isQual ? (Number(r.bonusAwardedPOP) || 0) : 0,
        };
      }).sort(
        (a, b) => new Date(b.created_at || b.joinedAt).getTime() - new Date(a.created_at || a.joinedAt).getTime()
      );

      // Compute dynamic breakdown & counts strictly matching database statuses:
      // - Pending Action = Count where status === 'PENDING'
      // - Qualified = Count where status === 'QUALIFIED'
      // - Unqualified = Count where status === 'UNQUALIFIED'
      let qualifiedCount = 0;
      let pendingCount = 0;
      let sameIpCount = 0;

      for (const r of formattedReferrals) {
        if (r.status === 'QUALIFIED') {
          qualifiedCount++;
        } else if (r.status === 'UNQUALIFIED') {
          sameIpCount++;
        } else {
          pendingCount++;
        }
      }

      const totalJoined = formattedReferrals.length;
      const counts = {
        total: totalJoined,
        pending: pendingCount,
        qualified: qualifiedCount,
        same_ip: sameIpCount,
      };

      const breakdown = {
        totalJoined,
        pendingAction: pendingCount,
        qualified: qualifiedCount,
        unqualifiedSameIp: sameIpCount,
      };

      // Contest time window filtering:
      const contestFilter = String(
        req.query.timeRange ||
        req.query.dateFilter ||
        (['weekly', '7d', '30d', 'custom'].includes(String(req.query.filter || '').toLowerCase()) ? req.query.filter : 'weekly')
      ).toLowerCase().trim();
      const startDate = (req.query.startDate as string) || (req.query.start as string) || (req.query.from as string);
      const endDate = (req.query.endDate as string) || (req.query.end as string) || (req.query.to as string);
      const windowInfo = calculateLeaderboardWindow(contestFilter, startDate, endDate);

      // Support dynamic filtering parameter (All, Pending Action, Qualified, Unqualified)
      const filterParam = String(req.query.status || req.query.filter || 'ALL').toUpperCase().trim();
      let filteredReferrals = formattedReferrals;
      if (filterParam === 'PENDING' || filterParam === 'PENDING_ACTION') {
        filteredReferrals = formattedReferrals.filter(r => r.status === 'PENDING');
      } else if (filterParam === 'QUALIFIED') {
        filteredReferrals = formattedReferrals.filter(r => r.status === 'QUALIFIED');
      } else if (filterParam === 'UNQUALIFIED' || filterParam === 'SAME_IP') {
        filteredReferrals = formattedReferrals.filter(r => r.status === 'UNQUALIFIED');
      }

      // If an explicit date range is filtered, filter referral rows strictly by joined timestamp
      const hasDateFilter = Boolean(req.query.startDate || req.query.endDate || req.query.timeRange || req.query.dateFilter);
      if (hasDateFilter) {
        filteredReferrals = filteredReferrals.filter(r => {
          const joinedVal = (r as any).joined || r.joinedAt || (r as any).joined_at || r.created_at;
          if (!joinedVal) return false;
          const t = new Date(joinedVal).getTime();
          return !isNaN(t) && t >= windowInfo.startTime.getTime() && t <= windowInfo.endTime.getTime();
        });
      }

      let dynamicTotalJoined = totalJoined;
      let dynamicPendingCount = pendingCount;
      let dynamicQualifiedCount = qualifiedCount;
      let dynamicSameIpCount = sameIpCount;

      if (hasDateFilter) {
        dynamicQualifiedCount = filteredReferrals.filter(r => r.status === 'QUALIFIED').length;
        dynamicSameIpCount = filteredReferrals.filter(r => r.status === 'UNQUALIFIED').length;
        dynamicPendingCount = filteredReferrals.filter(r => r.status === 'PENDING').length;
        dynamicTotalJoined = filteredReferrals.length;
      }

      const countsOutput = {
        total: dynamicTotalJoined,
        pending: dynamicPendingCount,
        qualified: dynamicQualifiedCount,
        same_ip: dynamicSameIpCount,
      };

      const breakdownOutput = {
        totalJoined: dynamicTotalJoined,
        pendingAction: dynamicPendingCount,
        qualified: dynamicQualifiedCount,
        unqualifiedSameIp: dynamicSameIpCount,
      };

      const weeklyLeaderboard = await SquadController.resolveWeeklyLeaderboard(telegramId, user, {
        filter: windowInfo.filter,
        startDate: windowInfo.startTime.toISOString(),
        endDate: windowInfo.endTime.toISOString(),
      });

      res.json({
        success: true,
        total_joined: dynamicTotalJoined,
        pending_action: dynamicPendingCount,
        qualified: dynamicQualifiedCount,
        unqualified_same_ip: dynamicSameIpCount,
        referral_bonus: dynamicBonus,
        referralBonusAmount: dynamicBonus,
        squadCommissionRate: dynamicCommissionRate,
        referralCommissionPercent: dynamicCommissionRate,
        counts: countsOutput,
        breakdown: breakdownOutput,
        referrals: filteredReferrals,
        my_referral_list: filteredReferrals,
        weeklyLeaderboard,
        cycle: {
          start: windowInfo.startTime.toISOString(),
          end: windowInfo.endTime.toISOString(),
          label: windowInfo.label,
          filter: windowInfo.filter,
        },
        contestConfig: {
          minThreshold: config.weeklyContestMinThreshold,
          prizes: config.weeklyPrizesUsdt,
          commissionRate: dynamicCommissionRate,
          squadCommissionRate: dynamicCommissionRate,
          referralCommissionPercent: dynamicCommissionRate,
          referralBonus: dynamicBonus,
          unclaimedCommission: user?.unclaimedSquadPOP || 0,
          claimedCommission: user?.claimedSquadPOP || 0,
        },
      });
    } catch (err: any) {
      console.error('[SquadController.getMyReferrals Error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/squad/claim
   * Claims accumulated passive squad mining commission for user.
   * Stores transaction log: Title="Squad Mining Commission Claimed", Type="SQUAD_COMMISSION".
   */
  claimCommission: (req: Request, res: Response) => {
    try {
      const telegramId = req.headers['x-telegram-id'] as string;
      if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized: Missing Telegram ID' });

      const result = db.claimSquadCommission(telegramId);
      res.json({
        success: true,
        user: result.user,
        claimedCommission: result.claimedCommission,
        message: `Successfully claimed +${result.claimedCommission} POP squad mining commission!`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
};
