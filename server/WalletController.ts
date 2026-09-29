import { Request, Response } from 'express';
import { db } from './db.js';
import { getTransactionsFromMongo } from './mongoRepo.js';
import { AppTransaction } from '../src/types.js';

export const WalletController = {
  /**
   * GET /api/wallet/history and /api/wallet/transactions
   * Retrieves all dynamic activity & transaction logs for the logged-in user
   * sorted by createdAt descending.
   */
  getHistory: async (req: Request, res: Response) => {
    try {
      const headerTgId = (req.headers['x-telegram-id'] as string) || '';
      const queryTgId = (req.query.telegramId as string) || (req.query.telegram_id as string) || '';
      const headerUserId = (req.headers['x-user-id'] as string) || '';
      const queryUserId = (req.query.userId as string) || '';

      const targetId = headerTgId || queryTgId || headerUserId || queryUserId;

      if (!targetId) {
        return res.json({ success: true, history: [], transactions: [] });
      }

      const user = db.getUser(targetId);
      const effectiveTgId = user?.telegramId || targetId.replace(/^usr-/, '');
      const effectiveUserId = user?.id || `usr-${effectiveTgId}`;

      // 1. Fetch from MongoDB Atlas
      const mongoLogs: AppTransaction[] = await getTransactionsFromMongo(effectiveTgId);

      // 2. Fetch from in-memory engine
      const memoryLogs: AppTransaction[] = [
        ...db.getTransactions(effectiveUserId),
        ...db.getTransactions(effectiveTgId),
      ];

      // 3. Deduplicate transaction logs across MongoDB Atlas and in-memory engine
      const deduplicated: AppTransaction[] = [];
      const seenFingerprints = new Set<string>();
      const seenIds = new Set<string>();

      // Merge and sort all candidate logs
      const allCandidateLogs = [...mongoLogs, ...memoryLogs];
      allCandidateLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      for (const tx of allCandidateLogs) {
        if (!tx) continue;
        // 10-second bucket fingerprint for identical type + title + rounded amount
        const timeBucket = Math.floor(new Date(tx.createdAt).getTime() / 10000);
        const fingerprint = `${tx.type}_${tx.title}_${Number(tx.amount).toFixed(2)}_${timeBucket}`;

        if (!seenFingerprints.has(fingerprint) && !seenIds.has(tx.id)) {
          seenFingerprints.add(fingerprint);
          seenIds.add(tx.id);
          deduplicated.push(tx);
        }
      }

      let history = deduplicated;

      // If user has no transaction logs yet, provide initial Account Initialized record
      if (history.length === 0 && user) {
        const initTx: AppTransaction = {
          id: `tx-init-${effectiveTgId}`,
          userId: user.id,
          telegramId: user.telegramId,
          type: 'TASK_REWARD',
          title: 'Account Initialized',
          amount: 0,
          status: 'COMPLETED',
          createdAt: user.createdAt || new Date().toISOString(),
          details: 'POP Miner wallet and account registered',
        };
        history.push(initTx);
      }

      // Sort strictly by createdAt descending
      history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({
        success: true,
        history,
        transactions: history,
      });
    } catch (err: any) {
      console.warn('[WalletController] getHistory error:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch history' });
    }
  },
};
