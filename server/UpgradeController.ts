import { Request, Response } from 'express';
import { db } from './db.js';
import { loadMiningLevelsFromMongo } from './mongoRepo.js';

export class UpgradeController {
  /**
   * GET /api/mining/levels
   * Fetches all 50 miner rig fleet levels
   */
  public static async getMiningLevels(req: Request, res: Response): Promise<void> {
    try {
      // 1. Try to load directly from MongoDB Atlas for real-time synchronization
      const mongoLevels = await loadMiningLevelsFromMongo();
      const levels = (mongoLevels && mongoLevels.length > 0)
        ? mongoLevels
        : db.getMiningLevels();

      res.json({
        success: true,
        levels: levels.sort((a, b) => a.level - b.level),
        totalLevels: levels.length,
        maxLevel: levels.length > 0 ? Math.max(...levels.map((l) => l.level)) : 50,
      });
    } catch (err: any) {
      console.warn('[UpgradeController] getMiningLevels error:', err?.message);
      const fallbackLevels = db.getMiningLevels();
      res.json({
        success: true,
        levels: fallbackLevels,
        totalLevels: fallbackLevels.length,
        maxLevel: 50,
      });
    }
  }

  /**
   * POST /api/upgrade/miner
   * Upgrades the user's miner fleet tier sequentially
   */
  public static async upgradeMiner(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = (req.headers['x-telegram-id'] as string) || (req.body?.telegramId as string);
      const { targetLevel } = req.body;

      if (!telegramId) {
        res.status(401).json({ success: false, error: 'Unauthorized: missing Telegram ID' });
        return;
      }

      if (!targetLevel || isNaN(Number(targetLevel))) {
        res.status(400).json({ success: false, error: 'Valid numeric targetLevel is required' });
        return;
      }

      const user = db.upgradeMiner(telegramId, Number(targetLevel));
      res.json({
        success: true,
        user,
        targetLevel: Number(targetLevel),
        message: `Miner fleet successfully upgraded to Level ${targetLevel}!`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Miner upgrade failed' });
    }
  }

  /**
   * POST /api/upgrade/storage
   * Upgrades the user's offline storage vault tier sequentially
   */
  public static async upgradeStorage(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = (req.headers['x-telegram-id'] as string) || (req.body?.telegramId as string);
      const { targetTier } = req.body;

      if (!telegramId) {
        res.status(401).json({ success: false, error: 'Unauthorized: missing Telegram ID' });
        return;
      }

      if (!targetTier || isNaN(Number(targetTier))) {
        res.status(400).json({ success: false, error: 'Valid numeric targetTier is required' });
        return;
      }

      const user = db.upgradeStorage(telegramId, Number(targetTier));
      res.json({
        success: true,
        user,
        targetTier: Number(targetTier),
        message: `Storage Matrix successfully upgraded to Tier ${targetTier}!`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Storage upgrade failed' });
    }
  }
}
