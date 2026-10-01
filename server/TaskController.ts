import { Request, Response } from 'express';
import { db } from './db.js';
import { telegramBot } from './bot.js';
const MAX_TOTAL_SUPPLY = 20000000;
export class TaskController {
  /**
   * GET /api/tasks
   * Dynamic CRUD: Fetch tasks dynamically from config with real-time completion status
   */
  public static async getTasks(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = req.headers['x-telegram-id'] as string;
      const user = telegramId ? db.getUser(telegramId) : null;
      const tasks = db.getUserTasks(user ? user.id : '');
      res.json({ success: true, tasks });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/tasks/start
   * Start cooldown timer when user clicks task link
   */
  public static async startTask(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = req.headers['x-telegram-id'] as string;
      const { taskId } = req.body;
      if (!telegramId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if (!taskId) {
        res.status(400).json({ success: false, error: 'taskId is required' });
        return;
      }

      const result = db.startTask(telegramId, taskId);
      res.json({
        success: true,
        startedAt: result.startedAt,
        claimDelaySeconds: result.claimDelaySeconds,
        claimDelayMinutes: result.claimDelayMinutes,
        message: result.claimDelaySeconds > 0
          ? `Task countdown initiated. Cooldown: ${result.claimDelaySeconds} seconds.`
          : 'Task started. Ready to claim immediately.'
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/tasks/complete and POST /api/tasks/claim
   * Enforces cooldown delay time and single claim rules
   */
  public static async completeTask(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = req.headers['x-telegram-id'] as string;
      const { taskId, elapsedSeconds } = req.body;
      if (!telegramId) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' });
        return;
      }
      if (!taskId) {
        res.status(400).json({ success: false, code: 'TASK_ID_REQUIRED', error: 'taskId is required' });
        return;
      }

      const config = db.getConfig();
      const allTasks = (config.tasks && config.tasks.length > 0) ? config.tasks : [];
      const task = allTasks.find(t => t.id === taskId);

      // Strict server-side verification for Telegram channel membership
      if (task && task.category === 'telegram' && task.requiresVerification) {
        const channelToCheck = config.mandatoryTelegramChannel || '@PopCornUSA_BOT';
        const isMember = await telegramBot.checkChatMember(channelToCheck, telegramId);
        if (!isMember) {
          res.status(400).json({
            success: false,
            code: 'CHANNEL_REQUIRED',
            error: `Verification failed: You must join the official Telegram Channel (${channelToCheck}) before claiming this reward!`
          });
          return;
        }
      }

// Complete task in database (validates claimDelayMinutes cooldown & single claim) 
const config = db.getConfig();
const foundTask = allTasks.find(t => t.id === taskId);
const rewardAmount = foundTask ? (foundTask.reward || 0) : 0;

const currentDistributed = config.totalDistributed || 0;

if (currentDistributed + rewardAmount > MAX_TOTAL_SUPPLY) {
    return res.status(400).json({ success: false, message: "All POP tokens have been distributed!" });
}

const result = db.completeTask(telegramId, taskId, elapsedSeconds ? Number(elapsedSeconds) : undefined);
res.json({
    success: true,
    user: result.user,
    rewardPOP: result.rewardPOP,
    message: `Task completed! +${result.rewardPOP} POP added to your balance!`
});
    } catch (err: any) {
      const errMsg = err.message || 'Failed to complete task';
      const code = errMsg.includes('COOLDOWN_ACTIVE') ? 'COOLDOWN_ACTIVE' : 'TASK_ERROR';
      res.status(400).json({ success: false, code, error: errMsg });
    }
  }
}