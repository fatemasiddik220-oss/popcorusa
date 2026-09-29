import { Request, Response } from 'express';
import { db } from './db.js';
import { telegramBot } from './bot.js';

export class WithdrawalController {
  /**
   * POST /api/withdraw and POST /api/withdrawals
   * Submit a new withdrawal request and send instant Admin Telegram PM alert
   */
  public static async submitWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = (req.headers['x-telegram-id'] as string) || req.body.telegramId;
      const { amountPOP, tonAddress } = req.body;

      if (!telegramId) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized: Missing telegramId header' });
        return;
      }

      const user = db.getUser(telegramId);
      if (!user) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'User not found in system' });
        return;
      }

      // Check 1: Strict TON Wallet verification
      const registeredWallet = user.tonWalletAddress || tonAddress;
      if (!registeredWallet || String(registeredWallet).trim().length < 10) {
        res.status(400).json({
          success: false,
          code: 'WALLET_REQUIRED',
          error: '⚠️ Wallet Not Connected: Please connect your TON wallet first to receive payouts.'
        });
        return;
      }

      // Check 2: Strict Mandatory Telegram Channel membership check
      if (!user.hasJoinedChannel) {
        res.status(400).json({
          success: false,
          code: 'CHANNEL_REQUIRED',
          error: '⚠️ Channel Join Required: Please join our official Telegram channel to unlock withdrawals.'
        });
        return;
      }

      const numAmount = Number(amountPOP);
      if (isNaN(numAmount) || numAmount <= 0) {
        res.status(400).json({
          success: false,
          code: 'INVALID_AMOUNT',
          error: 'Please enter a valid withdrawal amount in POP.'
        });
        return;
      }

      const config = db.getConfig();
      const minWithdrawAmount = typeof config.minWithdrawAmount === 'number' ? config.minWithdrawAmount : 100;
      const maxWithdrawAmount = typeof config.maxWithdrawAmount === 'number' ? config.maxWithdrawAmount : 50000;

      // Check 3: Below Minimum Limit
      if (numAmount < minWithdrawAmount) {
        res.status(400).json({
          success: false,
          code: 'BELOW_MIN_LIMIT',
          minLimit: minWithdrawAmount,
          requestAmount: numAmount,
          error: `⚠️ Below Minimum Limit: Minimum withdrawal is ${minWithdrawAmount.toLocaleString()} POP (Your request: ${numAmount.toLocaleString()} POP).`
        });
        return;
      }

      // Check 4: Exceeds Maximum Limit
      if (numAmount > maxWithdrawAmount) {
        res.status(400).json({
          success: false,
          code: 'EXCEEDS_MAX_LIMIT',
          maxLimit: maxWithdrawAmount,
          requestAmount: numAmount,
          error: `⚠️ Exceeds Maximum Limit: Maximum withdrawal per request is ${maxWithdrawAmount.toLocaleString()} POP.`
        });
        return;
      }

      // Check 5: Insufficient Balance
      if (user.balancePOP < numAmount) {
        res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          balance: user.balancePOP,
          requestAmount: numAmount,
          error: '⚠️ Insufficient Balance: You do not have enough POP balance including network fees.'
        });
        return;
      }

      const targetAddress = String(registeredWallet).trim();

      // Record withdrawal in database
      const wd = db.submitWithdrawal({
        telegramId,
        amountPOP: numAmount,
        tonAddress: targetAddress
      });

      const popToUsdtRate = Number(process.env.POP_PRICE) || config.popUsdRate || 0.001;
      const grossAmount = wd.grossAmount ?? wd.amountPOP;
      const feePercentage = wd.feePercentage ?? wd.feePercent ?? (typeof config.withdrawalFeePercent === 'number' ? config.withdrawalFeePercent : 5);
      const feeInPop = wd.feeAmount ?? wd.feeAmountPOP ?? parseFloat(((grossAmount * feePercentage) / 100).toFixed(4));
      const netPop = wd.netAmount ?? wd.netAmountPOP ?? parseFloat((grossAmount - feeInPop).toFixed(4));
      const netUsdtValue = wd.netUsdtValue ?? parseFloat((netPop * popToUsdtRate).toFixed(4));
      const feeUsdtValue = wd.feeUsdtValue ?? parseFloat((feeInPop * popToUsdtRate).toFixed(4));

      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      const displayName = fullName || wd.username || 'Miner';
      const usernameHandle = user.username ? user.username.replace(/^@/, '') : (wd.username ? wd.username.replace(/^@/, '') : '');
      const nowFormatted = new Date().toUTCString();

      // ======================================================================
      // 1. INSTANT ADMIN NOTIFICATION ON NEW WITHDRAWAL REQUEST
      // ======================================================================
      // Trigger: Instant Telegram PM to Admin Telegram ID "7779827146"
      await telegramBot.notifyAdminNewWithdrawal({
        userName: displayName,
        username: usernameHandle,
        telegramId: wd.telegramId,
        grossAmount,
        feePercentage,
        feeInPop,
        netPop,
        netUsdtValue,
        feeUsdtValue,
        walletAddress: wd.tonAddress,
        timestamp: nowFormatted
      }).catch(err => {
        console.error('[WithdrawalController] Failed to send instant admin alert PM:', err);
      });

      res.json({
        success: true,
        withdrawal: wd,
        user: db.getUser(telegramId),
        message: `Withdrawal request for ${wd.amountPOP} POP submitted! Admin notified.`
      });
    } catch (err: any) {
      const msg = err.message || 'Withdrawal failed';
      let code = 'WITHDRAWAL_FAILED';
      if (msg.includes('WALLET_REQUIRED')) code = 'WALLET_REQUIRED';
      else if (msg.includes('CHANNEL_REQUIRED')) code = 'CHANNEL_REQUIRED';
      else if (msg.includes('BELOW_MIN_LIMIT')) code = 'BELOW_MIN_LIMIT';
      else if (msg.includes('EXCEEDS_MAX_LIMIT')) code = 'EXCEEDS_MAX_LIMIT';
      else if (msg.includes('INSUFFICIENT_BALANCE')) code = 'INSUFFICIENT_BALANCE';
      res.status(400).json({ success: false, code, error: msg.replace(/^[A-Z_]+:\s*/, '') });
    }
  }

  /**
   * GET /api/withdrawals
   * Fetch current user's withdrawal requests
   */
  public static async getWithdrawals(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = req.headers['x-telegram-id'] as string;
      const user = telegramId ? db.getUser(telegramId) : null;
      const withdrawals = user ? db.getWithdrawals(user.id) : [];
      res.json({ success: true, withdrawals });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/withdrawals/process
   * Process withdrawal payout and notify user on approval (Status = "Paid")
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

      // Automated User PM on Withdrawal Approval (Status = "Paid" / "COMPLETED")
      if (status === 'PAID' || status === 'COMPLETED' || status === 'Paid') {
        const config = db.getConfig();
        const popUsdRate = Number(process.env.POP_PRICE) || config.popUsdRate || 0.001;
        const usdtAmount = wd.netUsdtValue ?? Number(((wd.netAmount ?? wd.netAmountPOP) * popUsdRate).toFixed(4));
        const user = db.getUser(wd.telegramId);
        const displayName = user?.firstName || wd.username || 'Miner';

        await telegramBot.notifyUserWithdrawalApproved({
          telegramId: wd.telegramId,
          userName: displayName,
          popAmount: wd.netAmount ?? wd.netAmountPOP,
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
