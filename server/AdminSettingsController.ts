import { Request, Response } from 'express';
import { db } from './db.js';
import { saveSystemSettingsToMongo } from './mongoRepo.js';
import { getActiveAdminReferralSettings } from './referralReward.js';

export class AdminSettingsController {
  /**
   * GET /api/settings
   * Returns active public protocol settings including dynamic referral bonus amount and commission rate
   */
  public static async getPublicSettings(req: Request, res: Response): Promise<void> {
    try {
      const config = db.getConfig();
      const adminSettings = await getActiveAdminReferralSettings();
      const referralBonusAmount = adminSettings.referralBonus;
      const squadCommissionRate = adminSettings.squadCommissionRate;

      res.json({
        success: true,
        settings: {
          referralBonusAmount,
          instantReferralBonusPOP: referralBonusAmount,
          referral_bonus: referralBonusAmount,
          squadCommissionRate,
          popUsdRate: config.popUsdRate || 0.001,
          mandatoryTelegramChannel: config.mandatoryTelegramChannel || '@PopCornUSA_bot',
          mandatoryChannelLink: config.mandatoryChannelLink || 'https://t.me/PopCornUSA_bot',
          channelUrl: config.channelUrl || 'https://t.me/PopCornUSA_bot',
          supportUsername: config.telegramSupportUsername || '@PopCornUSA_BOT',
          welcomeBannerUrl: config.welcomeBannerUrl || 'https://raw.githubusercontent.com/sbsujon213/Image/main/1789792124086.png',
          minWithdrawAmount: config.minWithdrawAmount || 100,
          maxWithdrawAmount: config.maxWithdrawAmount || 50000,
          withdrawalFeePercent: config.withdrawalFeePercent || 5,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to load settings' });
    }
  }

  /**
   * GET /api/admin/settings
   * Returns all admin settings
   */
  public static async getAdminSettings(req: Request, res: Response): Promise<void> {
    try {
      const config = db.getConfig();
      const adminSettings = await getActiveAdminReferralSettings();
      res.json({
        success: true,
        settings: {
          ...config,
          instantReferralBonusPOP: adminSettings.referralBonus,
          referral_bonus: adminSettings.referralBonus,
          referralBonusAmount: adminSettings.referralBonus,
          squadCommissionRate: adminSettings.squadCommissionRate,
          referralCommissionPercent: adminSettings.squadCommissionRate,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to load admin settings' });
    }
  }

  /**
   * POST /api/admin/settings
   * Updates admin settings dynamically and persists directly to MongoDB Atlas
   */
  public static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const updates = req.body || {};

      // Normalize referral parameters
      if (updates.referralBonusAmount !== undefined) {
        const bonus = Math.max(0, Number(updates.referralBonusAmount));
        updates.instantReferralBonusPOP = bonus;
        updates.referral_bonus = bonus;
        updates.referralBonusAmount = bonus;
      } else if (updates.referral_bonus !== undefined) {
        const bonus = Math.max(0, Number(updates.referral_bonus));
        updates.instantReferralBonusPOP = bonus;
        updates.referralBonusAmount = bonus;
      } else if (updates.instantReferralBonusPOP !== undefined) {
        const bonus = Math.max(0, Number(updates.instantReferralBonusPOP));
        updates.referral_bonus = bonus;
        updates.referralBonusAmount = bonus;
      }

      if (updates.squadCommissionRate !== undefined) {
        const rate = Math.max(0, Math.min(100, Number(updates.squadCommissionRate)));
        updates.referralCommissionPercent = rate;
        updates.squadCommissionRate = rate;
      } else if (updates.referralCommissionPercent !== undefined) {
        const rate = Math.max(0, Math.min(100, Number(updates.referralCommissionPercent)));
        updates.squadCommissionRate = rate;
      }

      const updated = db.updateConfig(updates, 'admin_master');
      await saveSystemSettingsToMongo(updated);

      res.json({
        success: true,
        settings: {
          ...updated,
          referralBonusAmount: (updated as any).referralBonusAmount ?? updated.instantReferralBonusPOP,
          squadCommissionRate: (updated as any).squadCommissionRate ?? updated.referralCommissionPercent,
        },
        message: 'Admin settings successfully updated and synced with MongoDB Atlas!',
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update settings' });
    }
  }
}
