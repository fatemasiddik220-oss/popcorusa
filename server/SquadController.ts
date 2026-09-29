import { Request, Response } from 'express';
import { db, isMockOrDummyUser } from './db.js';
import { getMyReferralsFromMongo, getMongoWeeklyReferralLeaderboard, getWeeklyCycleBounds } from './mongoRepo.js';
import { getActiveAdminReferralSettings } from './referralReward.js';

export const SquadController = {
  /**
   * Resolves the real-time weekly top referral list from MongoDB and reconciles with active in-memory state.
   * Strictly adheres to Saturday-to-Saturday cycle, qualified referrals only, and real-time accuracy.
   */
  resolveWeeklyLeaderboard: async (currentTelegramId?: string, currentUser?: any, currentQualifiedCount?: number) => {
    const config = db.getConfig();
    const minThreshold = config.weeklyContestMinThreshold || 40;
    const prizes = config.weeklyPrizesUsdt || { first: 50, second: 30, third: 20 };
    const adminSettings = await getActiveAdminReferralSettings();
    const dynamicBonus = adminSettings.referralBonus;

    // 1. Fetch from MongoDB Atlas using the aggregation pipeline
    const mongoLeaderboard = await getMongoWeeklyReferralLeaderboard(currentTelegramId, minThreshold, prizes);

    // 2. Fetch from in-memory engine (Saturday-to-Saturday cycle)
    const memLeaderboard = db.getWeeklyReferralLeaderboard(currentUser ? currentUser.id : currentTelegramId);

    // 3. Reconcile both lists to guarantee real-time accuracy and zero lag:
    const combinedMap = new Map<string, any>();

    if (mongoLeaderboard && mongoLeaderboard.length > 0) {
      for (const item of mongoLeaderboard) {
        const tid = String(item.telegramId).trim();
        if (tid) {
          const count = item.qualifiedReferralCount ?? item.referralCount ?? 0;
          combinedMap.set(tid, {
            ...item,
            referralCount: count,
            qualifiedReferralCount: count,
            totalPopEarnings: count * dynamicBonus,
          });
        }
      }
    }

    for (const mItem of memLeaderboard) {
      const tid = String(mItem.telegramId).trim();
      if (!tid) continue;
      const mCount = mItem.qualifiedReferralCount ?? mItem.referralCount ?? 0;
      const existing = combinedMap.get(tid);
      if (!existing) {
        combinedMap.set(tid, {
          ...mItem,
          referralCount: mCount,
          qualifiedReferralCount: mCount,
          totalPopEarnings: mCount * dynamicBonus,
        });
      } else {
        const existCount = existing.qualifiedReferralCount ?? existing.referralCount ?? 0;
        if (mCount > existCount) {
          existing.referralCount = mCount;
          existing.qualifiedReferralCount = mCount;
        }
        existing.totalPopEarnings = (existing.qualifiedReferralCount ?? existCount) * dynamicBonus;
        if (mItem.username && (!existing.username || existing.username.startsWith('user_'))) {
          existing.username = mItem.username;
        }
      }
    }

    // 4. Ensure current user's real-time qualified referrals for the current cycle are strictly synchronized
    const targetTgId = currentTelegramId || (currentUser?.telegramId ? String(currentUser.telegramId).trim() : '');
    if (targetTgId) {
      const tid = targetTgId;
      const userRefs = currentUser ? db.getUserReferrals(currentUser.id) : db.getUserReferrals(targetTgId);
      const { startOfCycle, endOfCycle } = getWeeklyCycleBounds();
      const currentCycleQualifiedRefs = userRefs.filter(r => {
        const dateStr = (r as any).qualifiedAt || (r as any).created_at || (r as any).joinedAt;
        if (dateStr) {
          const t = new Date(dateStr).getTime();
          if (!isNaN(t) && (t < startOfCycle.getTime() || t >= endOfCycle.getTime())) {
            return false;
          }
        }
        const s = String(r.status || '').toUpperCase();
        return s === 'QUALIFIED' || r.isQualified === true;
      });

      const effectiveCount = Math.max(
        currentCycleQualifiedRefs.length,
        currentQualifiedCount ?? 0
      );

      if (effectiveCount > 0) {
        const existing = combinedMap.get(tid);
        const myCount = effectiveCount;
        const myPop = myCount * dynamicBonus;
        const earliestDate = currentCycleQualifiedRefs[0]?.qualifiedAt || currentCycleQualifiedRefs[0]?.created_at || currentCycleQualifiedRefs[0]?.joinedAt;

        if (!existing) {
          combinedMap.set(tid, {
            rank: 0,
            username: currentUser?.username || `user_${tid.slice(-4)}`,
            telegramId: tid,
            referralCount: myCount,
            qualifiedReferralCount: myCount,
            totalPopEarnings: myPop,
            earliestQualifiedDate: earliestDate,
            prizeUsdt: 0,
            isCurrentUser: true,
          });
        } else {
          const existCount = existing.qualifiedReferralCount ?? existing.referralCount ?? 0;
          if (myCount > existCount) {
            existing.qualifiedReferralCount = myCount;
            existing.referralCount = myCount;
          }
          existing.totalPopEarnings = (existing.qualifiedReferralCount ?? myCount) * dynamicBonus;
          existing.isCurrentUser = true;
        }
      }
    }

    // 5. Pure Dynamic Descending Ranking:
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

    // 6. Dynamically Assign Rank based on Sorted Position
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
        totalPopEarnings: Math.round(count * dynamicBonus),
        prizeUsdt: prize,
        isCurrentUser: currentTelegramId ? String(u.telegramId) === String(currentTelegramId) : Boolean(u.isCurrentUser),
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

      const leaderboard = await SquadController.resolveWeeklyLeaderboard(telegramId, user);
      const { startOfCycle, endOfCycle } = getWeeklyCycleBounds();

      res.json({
        success: true,
        cycle: {
          start: startOfCycle.toISOString(),
          end: endOfCycle.toISOString(),
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
          weeklyLeaderboard: db.getWeeklyReferralLeaderboard(),
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
            existing.bonusAwardedPOP = dynamicBonus;
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
            bonusAwardedPOP: isQual ? dynamicBonus : 0,
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

        return {
          ...r,
          status,
          isQualified: isQual,
          isMultiAccount: isUnqual,
          hasWallet,
          hasChannel,
          bonusAwardedPOP: isQual ? (r.bonusAwardedPOP > 0 ? r.bonusAwardedPOP : dynamicBonus) : 0,
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

      const weeklyLeaderboard = await SquadController.resolveWeeklyLeaderboard(telegramId, user, qualifiedCount);

      res.json({
        success: true,
        total_joined: totalJoined,
        pending_action: pendingCount,
        qualified: qualifiedCount,
        unqualified_same_ip: sameIpCount,
        referral_bonus: dynamicBonus,
        referralBonusAmount: dynamicBonus,
        squadCommissionRate: dynamicCommissionRate,
        referralCommissionPercent: dynamicCommissionRate,
        counts,
        breakdown,
        referrals: filteredReferrals,
        my_referral_list: filteredReferrals,
        weeklyLeaderboard,
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
