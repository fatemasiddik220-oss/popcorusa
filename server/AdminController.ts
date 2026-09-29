import { Request, Response } from 'express';
import { db } from './db.js';
import { telegramBot } from './bot.js';

export class AdminController {
  /**
   * POST /api/admin/user/balance
   * Adjust User Balance (Add Bonus or Deduct Tokens) with automated Bot PM notification
   */
  public static async adjustUserBalance(req: Request, res: Response): Promise<void> {
    try {
      const { targetId, amountPOP, reasonNote } = req.body;
      if (!reasonNote || String(reasonNote).trim() === '') {
        res.status(400).json({ success: false, error: 'Mandatory Bonus Reason / Note is required.' });
        return;
      }

      const numAmount = Number(amountPOP);
      if (isNaN(numAmount) || numAmount === 0) {
        res.status(400).json({ success: false, error: 'Valid non-zero amount is required.' });
        return;
      }

      const user = db.adjustUserBalance({
        targetId,
        amountPOP: numAmount,
        reasonNote: String(reasonNote).trim(),
        adminId: 'admin_master'
      });

      const displayName = user.username ? `@${user.username}` : (user.firstName || 'Miner');

      // Automated Bot PM Notifications:
      if (numAmount > 0) {
        // Bonus Added:
        await telegramBot.notifyUserBonusAdded({
          telegramId: user.telegramId,
          userName: displayName,
          amount: numAmount,
          newBalance: user.balancePOP
        }).catch(e => console.warn(`Failed to send bonus PM to ${user.telegramId}:`, e));
      } else {
        // Token Deducted:
        await telegramBot.notifyUserTokenDeducted({
          telegramId: user.telegramId,
          userName: displayName,
          amount: Math.abs(numAmount),
          newBalance: user.balancePOP,
          reason: String(reasonNote).trim()
        }).catch(e => console.warn(`Failed to send deduction PM to ${user.telegramId}:`, e));
      }

      res.json({
        success: true,
        user,
        message: numAmount > 0
          ? `Successfully added +${numAmount} POP bonus to ${displayName} and sent Telegram PM!`
          : `Successfully deducted -${Math.abs(numAmount)} POP from ${displayName} and sent Telegram PM!`
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/bonus/broadcast
   * Broadcast Bonus to all active users with automated Bot PM notifications
   */
  public static async broadcastBonus(req: Request, res: Response): Promise<void> {
    try {
      const { amountPOP, reasonNote } = req.body;
      if (!reasonNote || String(reasonNote).trim() === '') {
        res.status(400).json({ success: false, error: 'Mandatory Bonus Reason / Note is required for broadcasting.' });
        return;
      }
      const bonusNum = Number(amountPOP);
      if (!bonusNum || bonusNum <= 0) {
        res.status(400).json({ success: false, error: 'Bonus amount must be greater than 0.' });
        return;
      }

      const result = db.broadcastBonusToAll({
        amountPOP: bonusNum,
        reasonNote: String(reasonNote).trim(),
        adminId: 'admin_master'
      });

      // Dispatch Telegram Bot PM notifications asynchronously
      for (const user of result.users) {
        const displayName = user.username ? `@${user.username}` : (user.firstName || 'Miner');
        telegramBot.notifyUserBonusAdded({
          telegramId: user.telegramId,
          userName: displayName,
          amount: bonusNum,
          newBalance: user.balancePOP
        }).catch(e => console.warn(`Failed to send broadcast bonus PM to ${user.telegramId}:`, e));
      }

      res.json({
        success: true,
        count: result.count,
        message: `Successfully credited +${bonusNum} POP bonus to all ${result.count} active users and dispatched Telegram PMs!`
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/withdrawals/process
   * Process withdrawal request. If PAID/COMPLETED, dispatch automated Bot PM notification
   */
  public static async processWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const { withdrawalId, status, adminNote, txHash } = req.body;
      const wd = db.processWithdrawal({
        withdrawalId,
        status,
        adminId: 'admin_master',
        adminNote,
        txHash
      });

      // If approved and marked PAID or COMPLETED, notify user via Telegram Bot
      if (status === 'PAID' || status === 'COMPLETED') {
        const config = db.getConfig();
        const popUsdRate = config.popUsdRate || 0.01;
        const usdtAmount = Number((wd.netAmountPOP * popUsdRate).toFixed(2));
        const displayName = wd.username ? `@${wd.username}` : 'Miner';

        await telegramBot.notifyUserWithdrawalApproved({
          telegramId: wd.telegramId,
          userName: displayName,
          popAmount: wd.netAmountPOP,
          usdtAmount,
          walletAddress: wd.tonAddress
        }).catch(e => console.warn(`Failed to send withdrawal approval PM to ${wd.telegramId}:`, e));
      }

      res.json({ success: true, withdrawal: wd });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
