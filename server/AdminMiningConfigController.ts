import { Request, Response } from 'express';
import { db } from './db.js';
import { loadMiningLevelsFromMongo, saveMiningLevelToMongo } from './mongoRepo.js';
import { generateDefaultMiningLevels, seedMiningLevelsToMongo } from './seedMiningLevels.js';

export class AdminMiningConfigController {
  /**
   * GET /api/admin/mining/levels
   * Fetches all 50 mining levels for Admin configuration
   */
  public static async getMiningLevels(req: Request, res: Response): Promise<void> {
    try {
      const mongoLevels = await loadMiningLevelsFromMongo();
      const levels = (mongoLevels && mongoLevels.length > 0)
        ? mongoLevels
        : db.getMiningLevels();

      res.json({
        success: true,
        levels: levels.sort((a, b) => a.level - b.level),
        totalLevels: levels.length,
        message: 'Loaded mining levels for admin management',
      });
    } catch (err: any) {
      console.warn('[AdminMiningConfigController] getMiningLevels error:', err?.message);
      res.json({
        success: true,
        levels: db.getMiningLevels(),
        totalLevels: db.getMiningLevels().length,
      });
    }
  }

  /**
   * POST /api/admin/mining/levels/:level
   * PUT /api/admin/mining/levels/:level
   * Allows admin to dynamically edit Speed (POP/h) and Cost (POP) for ANY level individually
   * and save directly to MongoDB
   */
  public static async updateMiningLevel(req: Request, res: Response): Promise<void> {
    try {
      const levelParam = req.params.level || req.body.level;
      const level = parseInt(String(levelParam), 10);

      if (isNaN(level) || level < 1 || level > 100) {
        res.status(400).json({ success: false, error: 'Invalid level number (must be 1-100)' });
        return;
      }

      const { speedPerHour, pricePOP, name } = req.body;

      if (speedPerHour === undefined || isNaN(Number(speedPerHour)) || Number(speedPerHour) < 0) {
        res.status(400).json({ success: false, error: 'Valid positive numeric speedPerHour is required' });
        return;
      }

      if (pricePOP === undefined || isNaN(Number(pricePOP)) || Number(pricePOP) < 0) {
        res.status(400).json({ success: false, error: 'Valid non-negative numeric pricePOP is required' });
        return;
      }

      const parsedSpeed = Number(parseFloat(String(speedPerHour)).toFixed(2));
      const parsedCost = Math.round(Number(pricePOP));

      // Save directly to MongoDB and in-memory engine
      const updatedLevel = db.updateMiningLevel(level, parsedSpeed, parsedCost, name);

      res.json({
        success: true,
        level: updatedLevel,
        message: `Level ${level} successfully updated: ${parsedSpeed} POP/h @ ${parsedCost} POP (Saved to MongoDB)`,
      });
    } catch (err: any) {
      console.error('[AdminMiningConfigController] updateMiningLevel error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to update mining level' });
    }
  }

  /**
   * POST /api/admin/mining/levels/bulk
   * Bulk updates all mining levels in MongoDB
   */
  public static async bulkUpdateMiningLevels(req: Request, res: Response): Promise<void> {
    try {
      const { levels } = req.body;

      if (!Array.isArray(levels) || levels.length === 0) {
        res.status(400).json({ success: false, error: 'Invalid levels array provided' });
        return;
      }

      const sanitizedLevels = levels.map((lvl: any) => ({
        level: Number(lvl.level),
        name: String(lvl.name || `Level ${lvl.level} Rig`),
        speedPerHour: Number(parseFloat(String(lvl.speedPerHour || 0)).toFixed(2)),
        pricePOP: Math.round(Number(lvl.pricePOP || 0)),
        priceUSD: Number((Number(lvl.pricePOP || 0) * (db.getConfig().popUsdRate || 0.001)).toFixed(2)),
      })).sort((a, b) => a.level - b.level);

      const saved = db.setMiningLevels(sanitizedLevels);

      res.json({
        success: true,
        levels: saved,
        totalUpdated: saved.length,
        message: `Successfully updated ${saved.length} mining levels in MongoDB and runtime engine!`,
      });
    } catch (err: any) {
      console.error('[AdminMiningConfigController] bulkUpdateMiningLevels error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to bulk update mining levels' });
    }
  }

  /**
   * POST /api/admin/mining/levels/reset
   * Resets all 50 levels back to mathematical linear progression default
   * (Level 1: 0.20 POP/h, Level 2: 0.24 POP/h @ 130 POP, Level 50: 1.99 POP/h @ 1130 POP)
   */
  public static async resetDefaultMiningLevels(req: Request, res: Response): Promise<void> {
    try {
      const defaultLevels = generateDefaultMiningLevels(db.getConfig().popUsdRate || 0.001);

      // Force seed into MongoDB Atlas
      await seedMiningLevelsToMongo(true);

      // Update in-memory engine
      db.setMiningLevels(defaultLevels);

      res.json({
        success: true,
        levels: defaultLevels,
        message: 'Successfully reset all 50 mining levels to default linear progression!',
      });
    } catch (err: any) {
      console.error('[AdminMiningConfigController] resetDefaultMiningLevels error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to reset mining levels' });
    }
  }
}
