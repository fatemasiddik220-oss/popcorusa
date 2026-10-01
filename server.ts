import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { telegramBot, bot, User } from './server/bot.js';
import { TaskController } from './server/TaskController.js';
import { AdminController } from './server/AdminController.js';
import { WithdrawalController } from './server/WithdrawalController.js';
import { WalletController } from './server/WalletController.js';
import { SquadController } from './server/SquadController.js';
import { UpgradeController } from './server/UpgradeController.js';
import { AdminMiningConfigController } from './server/AdminMiningConfigController.js';
import { UserInitController } from './server/UserInitController.js';
import { AdminSettingsController } from './server/AdminSettingsController.js';
import { seedMiningLevelsToMongo } from './server/seedMiningLevels.js';
import { getMongoStatusDetails, connectMongo, isMongoConnected } from './server/mongoose.js';
import { getMongoSquadStats, findUserByReferralCodeInMongo, getMongoGlobalLeaderboard } from './server/mongoRepo.js';

export { bot, User };

const app = express();
const PORT = 3000;

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '7779827146';
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_SECRET_KEY || 'Sujonborsha';
const JWT_SECRET = process.env.JWT_SECRET || 'Sujonborsha';
const MAX_TOTAL_SUPPLY = 20000000;
app.use(express.json());

// Helper to extract client IP and generate deterministic device fingerprint (IP + UA + client device token)
function getClientInfo(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  const ua = (req.headers['user-agent'] as string) || 'unknown_ua';
  const clientFp = (req.headers['x-device-fingerprint'] as string) || '';
  const tgPlatform = (req.headers['x-telegram-platform'] as string) || '';

  // Cryptographic hash representing the physical device/browser signature
  const compositeKey = `${ip}::${ua}::${clientFp}::${tgPlatform}`;
  const deviceHash = crypto.createHash('sha256').update(compositeKey).digest('hex').slice(0, 32);
  const fingerprint = `dfp_${deviceHash}`;
  return { ip, fingerprint };
}

// ---------------------------------------------------------------------
// 1. PUBLIC & SYSTEM API ROUTES
// ---------------------------------------------------------------------

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'POP Telegram Mini App Engine', timestamp: new Date().toISOString() });
});
app.get('/api/admin/token-stats', async (req, res) => {
    try {
        const totalDistributed = 0; 
        const remainingSupply = MAX_TOTAL_SUPPLY - totalDistributed;

        res.json({
            success: true,
            maxSupply: MAX_TOTAL_SUPPLY,
            totalDistributed: totalDistributed,
            remainingSupply: remainingSupply
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
// Dynamic TON Connect Manifest with Full CORS Support
app.get(['/tonconnect-manifest.json', '/api/tonconnect-manifest.json'], (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    url: 'https://popcorusa-production.up.railway.app/',
    name: 'PopCorn USA Miner',
    iconUrl: 'https://raw.githubusercontent.com/sbsujon213/Connect-Image/main/20261001_101834-removebg-preview.png',
    termsOfDeliveryUrl: 'https://popcorusa-production.up.railway.app/',
    privacyPolicyUrl: 'https://popcorusa-production.up.railway.app/'
  });
});

// Codebase ZIP Download Endpoint
app.get(['/api/download/project.zip', '/project-source.zip', '/download-zip'], (req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'public', 'project-source.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'popcorn-bot-full-source.zip');
  } else {
    res.status(404).json({ error: 'Zip archive not found' });
  }
});

// Telegram Bot Webhook endpoint
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    await telegramBot.handleWebhookUpdate(req.body);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Dynamic Configuration
app.get('/api/config', (req: Request, res: Response) => {
  res.json({ success: true, config: db.getConfig() });
});

// ---------------------------------------------------------------------
// 2. AUTHENTICATION & USER SESSIONS (WITH REFERRAL PARSING & ALERTS)
// ---------------------------------------------------------------------

const handleUserAuth = async (req: Request, res: Response) => {
  try {
    const { initData, devUser, referrerId } = req.body;
    const { ip, fingerprint } = getClientInfo(req);

    let telegramUser: any = null;
    let extractedStartParam: string | undefined = undefined;

    if (initData) {
      const validation = telegramBot.validateInitData(initData);
      if (validation.user) {
        telegramUser = validation.user;
      }
      if (validation.startParam) {
        extractedStartParam = validation.startParam;
      }
    }

    // Direct URLSearchParams fallback for initData
    if (!extractedStartParam && initData && typeof initData === 'string') {
      try {
        const uParams = new URLSearchParams(initData);
        extractedStartParam =
          uParams.get('start_param') ||
          uParams.get('startParam') ||
          uParams.get('tgWebAppStartParam') ||
          uParams.get('startapp') ||
          uParams.get('start') ||
          undefined;
      } catch {}
    }

    // Dev/Preview fallback if not inside native Telegram client
    if (!telegramUser && devUser) {
      telegramUser = {
        id: devUser.id || 998811223,
        username: devUser.username || 'pop_ton_explorer',
        firstName: devUser.firstName || 'POP',
        lastName: devUser.lastName || 'Pioneer',
        photo_url: devUser.photoUrl || ''
      };
    }

    if (!telegramUser) {
      telegramUser = {
        id: 998811223,
        username: 'pop_ton_explorer',
        firstName: 'POP',
        lastName: 'Pioneer'
      };
    }

    // Clean referrerId (e.g. from "ref_7779827146", "ref-7779827146", "FGZQU5K7", etc.)
    let cleanReferrerId: string | null = null;
    const rawRef =
      extractedStartParam ||
      referrerId ||
      req.body?.start_param ||
      req.body?.startParam ||
      req.body?.startapp ||
      req.body?.start ||
      req.body?.tgWebAppStartParam ||
      req.query?.referrerId ||
      req.query?.start_param ||
      req.query?.startParam ||
      req.query?.tgWebAppStartParam ||
      req.query?.startapp ||
      req.query?.start;

    if (rawRef && typeof rawRef === 'string') {
      const parsed = rawRef.replace(/^ref[_-]/i, '').trim();
      const currentTgId = String(telegramUser.id);
      const currentUsername = telegramUser.username ? String(telegramUser.username).toLowerCase().trim() : '';

      // Check if user already exists
      const existingUser = db.getUser(currentTgId);
      const isSelf =
        parsed === currentTgId ||
        (currentUsername && parsed.toLowerCase() === currentUsername) ||
        (existingUser?.referralCode && parsed.toUpperCase() === existingUser.referralCode.toUpperCase()) ||
        (existingUser?.id && parsed === existingUser.id);

      if (!isSelf && parsed) {
        let resolvedInviter = db.getUserByReferralCode(parsed);
        if (!resolvedInviter && isMongoConnected()) {
          try {
            const mongoUser = await findUserByReferralCodeInMongo(parsed);
            if (mongoUser) {
              resolvedInviter = db.addUserFromMongo(mongoUser);
            }
          } catch (mErr) {
            console.warn('[handleUserAuth] Mongo referral lookup error:', mErr);
          }
        }

        if (resolvedInviter) {
          const inviterTgId = String(resolvedInviter.telegramId).trim();
          const inviterUsername = resolvedInviter.username ? String(resolvedInviter.username).toLowerCase().trim() : '';
          if (
            inviterTgId !== currentTgId &&
            inviterUsername !== currentUsername &&
            resolvedInviter.id !== currentTgId &&
            (!existingUser || !existingUser.referralCode || resolvedInviter.referralCode?.toUpperCase() !== existingUser.referralCode.toUpperCase())
          ) {
            cleanReferrerId = resolvedInviter.telegramId;
          }
        } else if (parsed !== currentTgId) {
          cleanReferrerId = parsed;
        }
      }
    }

    const result = db.getOrCreateUser({
      telegramId: String(telegramUser.id),
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      photoUrl: telegramUser.photo_url,
      referrerId: cleanReferrerId,
      ipAddress: ip,
      deviceFingerprint: fingerprint
    }) as any;

    const { user, isNew, awardedReferralBonus, inviterTelegramId } = result;

    // If new user registered with a valid referrer, dispatch direct Telegram PM alert to referrer!
    if (isNew && awardedReferralBonus > 0 && inviterTelegramId) {
      telegramBot.notifyReferrerBonus({
        referrerTelegramId: inviterTelegramId,
        referredUsername: user.username || user.firstName || 'POP Miner',
        bonusAmountPOP: awardedReferralBonus
      }).catch((err) => {
        console.warn(`[TELEGRAM BOT] Failed to dispatch referral alert to ${inviterTelegramId}:`, err);
      });
    }

    res.json({ success: true, user, isNew, config: db.getConfig() });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};

app.post('/api/user/init', handleUserAuth);
app.post('/api/users/register', handleUserAuth);
app.post('/api/user/register', handleUserAuth);
app.post('/api/auth', handleUserAuth);
app.post('/api/auth/telegram', handleUserAuth);
app.post('/api/user/auth', handleUserAuth);

// Telegram Webhook Handler (Dual mode support alongside polling)
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    if (req.body) {
      await bot.handleUpdate(req.body);
    }
    res.sendStatus(200);
  } catch (err: any) {
    console.error('[Telegraf Webhook Handler Error]:', err);
    res.sendStatus(200);
  }
});

// Get Current User Profile with Real-Time Mining Accrual
app.get('/api/user/me', (req: Request, res: Response) => {
  const telegramId = (req.headers['x-telegram-id'] as string) || '998811223';
  const fingerprint = (req.headers['x-device-fingerprint'] as string) || 'device_fp_default';
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  let user = db.getUser(telegramId);
  if (!user) {
    const created = db.getOrCreateUser({
      telegramId,
      username: 'pop_miner',
      firstName: 'POP',
      lastName: 'Miner',
      ipAddress: clientIp,
      deviceFingerprint: fingerprint
    });
    user = created.user;
  }

  res.json({ success: true, user, config: db.getConfig() });
});

// ---------------------------------------------------------------------
// 3. TON WALLET INTEGRATION
// ---------------------------------------------------------------------

const handleWalletConnect = (req: Request, res: Response) => {
  try {
    const telegramId = req.headers['x-telegram-id'] as string;
    const tonAddress = req.body.tonAddress || req.body.tonWalletAddress || req.body.walletAddress;

    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!tonAddress || typeof tonAddress !== 'string' || tonAddress.length < 10) {
      return res.status(400).json({ success: false, error: 'Invalid TON address format' });
    }

    const prevUser = db.getUser(telegramId);
    const wasQualified = prevUser?.isQualified;

    const user = db.connectTonWallet(telegramId, tonAddress);

    // If referral just became qualified, notify referrer
    if (!wasQualified && user.isQualified && user.referrerId) {
      const inviter = db.getUser(user.referrerId);
      if (inviter) {
        const bonus = 100;
        telegramBot.notifyReferrerBonus({
          referrerTelegramId: inviter.telegramId,
          referredUsername: user.username || user.firstName || 'POP Miner',
          bonusAmountPOP: bonus
        }).catch((err) => {
          console.warn('[TELEGRAM BOT] Failed to dispatch referral qualification alert to inviter:', err);
        });
      }
    }

    res.json({ success: true, user, message: 'TON Wallet connected successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};

app.post('/api/user/wallet/connect', handleWalletConnect);
app.post('/api/user/wallet', handleWalletConnect);

app.post('/api/user/wallet/disconnect', (req: Request, res: Response) => {
  try {
    const telegramId = req.headers['x-telegram-id'] as string;
    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = db.disconnectTonWallet(telegramId);
    res.json({ success: true, user, message: 'TON Wallet disconnected' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Verify Mandatory Telegram Channel Membership
app.post('/api/user/verify-channel', async (req: Request, res: Response) => {
  try {
    const telegramId = req.headers['x-telegram-id'] as string;
    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const config = db.getConfig();
    const isMember = await telegramBot.checkChatMember(config.mandatoryTelegramChannel, telegramId);

    if (isMember) {
      const prevUser = db.getUser(telegramId);
      const wasQualified = prevUser?.isQualified;

      const user = db.markChannelJoined(telegramId);

      // If referral just became qualified, notify referrer
      if (!wasQualified && user.isQualified && user.referrerId) {
        const inviter = db.getUser(user.referrerId);
        if (inviter) {
          const bonus = db.getConfig().instantReferralBonusPOP || 25;
          telegramBot.notifyReferrerBonus({
            referrerTelegramId: inviter.telegramId,
            referredUsername: user.username || user.firstName || 'POP Miner',
            bonusAmountPOP: bonus
          }).catch((err) => {
            console.warn('[TELEGRAM BOT] Failed to dispatch referral qualification alert to inviter:', err);
          });
        }
      }

      return res.json({
        success: true,
        isMember: true,
        user,
        message: 'Telegram Channel membership verified successfully!'
      });
    } else {
      return res.status(400).json({
        success: false,
        isMember: false,
        message: `Please join official channel ${config.mandatoryTelegramChannel} first!`
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// 4. MINING & UPGRADES (SERVER-AUTHORITATIVE & WALLET-MANDATED)
// ---------------------------------------------------------------------

// Start Mining (Mandatory Wallet & Channel Membership Check)
app.post('/api/mining/start', (req: Request, res: Response) => {
  try {
    const telegramId = req.headers['x-telegram-id'] as string;
    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = db.startMining(telegramId);
    res.json({
      success: true,
      user,
      message: 'POP Mining started successfully!'
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Claim Mining Rewards (MANDATORY WALLET REQUIREMENT)
app.post('/api/mining/claim', (req: Request, res: Response) => {
  try {
    const telegramId = req.headers['x-telegram-id'] as string;
    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { user, claimedAmount } = db.claimMiningReward(telegramId);
    res.json({
      success: true,
      user,
      claimedAmount,
      message: `Successfully claimed +${claimedAmount} POP!`
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// 4. MINING & FLEET UPGRADES (50 LEVELS DYNAMIC)
// ---------------------------------------------------------------------

// Get All 50 Mining Fleet Levels
app.get('/api/mining/levels', UpgradeController.getMiningLevels);

// Upgrade Miner Speed Tier (1 to 50)
app.post('/api/upgrade/miner', UpgradeController.upgradeMiner);

// Upgrade Storage Matrix Tier
app.post('/api/upgrade/storage', UpgradeController.upgradeStorage);

// ---------------------------------------------------------------------
// 5. EARN & TASKS (DAILY CHECK-IN + ECOSYSTEM)
// ---------------------------------------------------------------------

app.post('/api/tasks/checkin', (req: Request, res: Response) => {
  try {
    const telegramId = req.headers['x-telegram-id'] as string;
    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const result = db.dailyCheckIn(telegramId);
    res.json({
      success: true,
      user: result.user,
      rewardPOP: result.rewardPOP,
      streak: result.streak,
      message: `Day ${result.streak} Check-in successful! +${result.rewardPOP} POP earned!`
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// 5. ECOSYSTEM TASKS & 7-SECOND VALIDATION TIMER
// ---------------------------------------------------------------------

app.get('/api/tasks', TaskController.getTasks);
app.post('/api/tasks/start', TaskController.startTask);
app.post('/api/tasks/complete', TaskController.completeTask);
app.post('/api/tasks/claim', TaskController.completeTask);

// ---------------------------------------------------------------------
// 6. SQUAD / FRIENDS, COMMISSIONS & WEEKLY CONTEST (/api/squad/my-referrals, /api/squad/stats)
// ---------------------------------------------------------------------

app.get('/api/squad/my-referrals', SquadController.getMyReferrals);
app.get('/api/squad/stats', SquadController.getMyReferrals);
app.get('/api/referrals/squad', SquadController.getMyReferrals);
app.get('/api/squad', SquadController.getMyReferrals);
app.get('/api/squad/weekly-leaderboard', SquadController.getWeeklyLeaderboard);
app.get('/api/leaderboard/weekly', SquadController.getWeeklyLeaderboard);
app.post('/api/squad/claim', SquadController.claimCommission);

// ---------------------------------------------------------------------
// 7. GLOBAL LEADERBOARD
// ---------------------------------------------------------------------

app.get('/api/leaderboard/global', async (req: Request, res: Response) => {
  try {
    const telegramId = (req.headers['x-telegram-id'] as string) || '';
    const user = telegramId ? db.getUser(telegramId) : null;

    // 1. Fetch distinct MongoDB leaderboard if MongoDB is online
    let leaderboard = await getMongoGlobalLeaderboard(telegramId || user?.telegramId);

    // 2. Fallback to memory engine (which is also strictly deduplicated by unique telegramId)
    if (!leaderboard || leaderboard.length === 0) {
      leaderboard = db.getGlobalLeaderboard(user ? user.id : undefined);
    }

    res.json({ success: true, leaderboard });
  } catch (err: any) {
    console.warn('[Leaderboard] Global leaderboard error:', err);
    res.json({ success: true, leaderboard: db.getGlobalLeaderboard() });
  }
});

// ---------------------------------------------------------------------
// 8. WALLET & WITHDRAWAL OPERATIONS
// ---------------------------------------------------------------------

app.get('/api/wallet/history', WalletController.getHistory);
app.get('/api/wallet/transactions', WalletController.getHistory);
app.get('/api/withdrawals', WithdrawalController.getWithdrawals);
app.post('/api/withdrawals', WithdrawalController.submitWithdrawal);
app.post('/api/withdraw', WithdrawalController.submitWithdrawal);

// ---------------------------------------------------------------------
// 9. DYNAMIC ADMIN COMMAND CENTER (STRICT TELEGRAM ID & JWT SECURITY LOCK)
// ---------------------------------------------------------------------

// Universal Security Gateway: Secure ALL /api/admin/* endpoints
// Rejects ANY request with a 403 Forbidden unless the Telegram ID making the request is 7779827146
app.use('/api/admin', (req: Request, res: Response, next: Function) => {
  const reqTelegramId = String(
    req.headers['x-telegram-id'] ||
    req.body?.telegramId ||
    req.query?.telegramId ||
    ''
  ).trim();

  // If a Telegram ID is explicitly passed and it is NOT 7779827146 -> REJECT 403 IMMEDIATELY
  if (reqTelegramId && reqTelegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({
      success: false,
      error: `403 Forbidden: Telegram ID '${reqTelegramId}' is not authorized. Only Telegram ID ${ADMIN_TELEGRAM_ID} has administrative access.`
    });
  }

  // If no Telegram ID header was provided, check if a valid JWT token identifies 7779827146
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : (req.headers['x-admin-token'] as string);

  let verifiedTelegramId = '';
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      verifiedTelegramId = String(decoded?.telegramId || '').trim();
    } catch {
      // invalid token
    }
  }

  const effectiveTelegramId = reqTelegramId || verifiedTelegramId;

  // Strict check: Reject unless Telegram ID is 7779827146
  if (!effectiveTelegramId || effectiveTelegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({
      success: false,
      error: `403 Forbidden: Access Denied. Telegram ID '${effectiveTelegramId || 'Anonymous'}' is not authorized. Only Admin Telegram ID ${ADMIN_TELEGRAM_ID} is permitted.`
    });
  }

  next();
});

// Admin Auth Middleware: Verifies Telegram ID 7779827146 & Valid JWT Token
function checkAdminAuth(req: Request, res: Response, next: Function) {
  const reqTelegramId = String(req.headers['x-telegram-id'] || '').trim();
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : (req.headers['x-admin-token'] as string);
  const masterKey = req.headers['x-admin-key'] as string;

  // 1. Strict Telegram ID check: Reject any user other than ADMIN_TELEGRAM_ID (7779827146)
  if (reqTelegramId && reqTelegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({
      success: false,
      error: `403 Forbidden: Telegram ID '${reqTelegramId}' is not authorized. Only Telegram ID ${ADMIN_TELEGRAM_ID} has administrative access.`
    });
  }

  // 2. Validate JWT Session Token
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.telegramId || String(decoded.telegramId) !== ADMIN_TELEGRAM_ID) {
        return res.status(403).json({
          success: false,
          error: `403 Forbidden: Token was issued to Telegram ID '${decoded.telegramId}'. Authorized admin ID is ${ADMIN_TELEGRAM_ID}.`
        });
      }
      (req as any).adminUser = decoded;
      return next();
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Admin Session Token. Please re-authenticate with your Admin Secret.'
      });
    }
  }

  // 3. Fallback for direct CLI/tools with exact master key AND matching Telegram ID
  if (masterKey && masterKey === ADMIN_SECRET && reqTelegramId === ADMIN_TELEGRAM_ID) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: `403 Forbidden: Admin authentication required. Only Telegram ID ${ADMIN_TELEGRAM_ID} is authorized.`
  });
}

// Admin Login Endpoint: Verifies Telegram ID + Secret Key -> Issues short-lived JWT
app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { secretKey, adminSecret, password, telegramId } = req.body;
    const providedTelegramId = String(telegramId || req.headers['x-telegram-id'] || '').trim();
    const providedKey = String(secretKey || adminSecret || password || '').trim();

    // 1. Strict Telegram ID check: Must match ADMIN_TELEGRAM_ID ("7779827146")
    if (!providedTelegramId || providedTelegramId !== ADMIN_TELEGRAM_ID) {
      return res.status(403).json({
        success: false,
        error: `403 Forbidden: Telegram ID '${providedTelegramId || 'Anonymous'}' is not authorized. Only Telegram ID ${ADMIN_TELEGRAM_ID} has administrative access.`
      });
    }

    // 2. Verify password against ADMIN_SECRET ("Sujonborsha")
    if (providedKey !== ADMIN_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Admin Secret Key. Access denied.'
      });
    }

    // 3. Issue secure short-lived JWT token (expires in 2 hours)
    const token = jwt.sign(
      {
        telegramId: ADMIN_TELEGRAM_ID,
        role: 'admin',
        iss: 'pop_admin_auth',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      success: true,
      token,
      adminTelegramId: ADMIN_TELEGRAM_ID,
      expiresIn: '2 hours',
      message: 'Admin authenticated successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protect direct /admin GET endpoint with Telegram ID check
app.get('/admin', (req: Request, res: Response, next: Function) => {
  const reqTelegramId = String(req.headers['x-telegram-id'] || '').trim();
  if (!reqTelegramId || reqTelegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>403 ACCESS DENIED</title></head>
        <body style="background:#0B0E14;color:#ff4d4f;font-family:sans-serif;padding:60px 20px;text-align:center;">
          <h1 style="font-size:24px;font-weight:900;letter-spacing:1px;">⛔ 403 ACCESS DENIED</h1>
          <p style="color:#94a3b8;font-size:14px;margin-top:12px;">You do not have permission to access the administrative dashboard.</p>
        </body>
      </html>
    `);
  }
  next();
});

app.get('/api/admin/overview', checkAdminAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    config: db.getConfig(),
    users: db.getAllUsers(),
    withdrawals: db.getWithdrawals(),
    auditLogs: db.getAuditLogs(),
    analytics: db.getAnalytics()
  });
});

// GET /api/admin/stats: Real-time protocol metrics { totalUsers, activeMiners, totalMined, totalWithdrawals }
app.get('/api/admin/stats', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const stats = db.getAdminStats();
    res.json({
      success: true,
      totalUsers: stats.totalUsers,
      activeMiners: stats.activeMiners,
      totalMined: stats.totalMined,
      totalWithdrawals: stats.totalWithdrawals,
      totalCirculating: stats.totalCirculating,
      pendingWithdrawalsCount: stats.pendingWithdrawalsCount,
      pendingWithdrawalsAmount: stats.pendingWithdrawalsAmount,
      totalQualifiedReferrals: stats.totalQualifiedReferrals,
      totalUnqualifiedReferrals: stats.totalUnqualifiedReferrals
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/users: Paginated user management with real-time search & history logs
app.get('/api/admin/users', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const search = String(req.query.q || req.query.search || '');
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = parseInt(String(req.query.limit || '10'), 10) || 10;

    const result = db.getAdminUsersPaginated({ search, page, limit });
    res.json({
      success: true,
      users: result.users,
      pagination: result.pagination
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/config', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const updated = db.updateConfig(req.body, 'admin_master');
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Mining Levels Management (50 Levels Config)
app.get('/api/admin/mining/levels', checkAdminAuth, AdminMiningConfigController.getMiningLevels);
app.post('/api/admin/mining/levels/bulk', checkAdminAuth, AdminMiningConfigController.bulkUpdateMiningLevels);
app.post('/api/admin/mining/levels/reset', checkAdminAuth, AdminMiningConfigController.resetDefaultMiningLevels);
app.post('/api/admin/mining/levels/:level', checkAdminAuth, AdminMiningConfigController.updateMiningLevel);
app.put('/api/admin/mining/levels/:level', checkAdminAuth, AdminMiningConfigController.updateMiningLevel);

app.post('/api/admin/user/balance', checkAdminAuth, AdminController.adjustUserBalance);

// Broadcast Custom Bonus to All Users
app.post('/api/admin/bonus/broadcast', checkAdminAuth, AdminController.broadcastBonus);

app.post('/api/admin/user/flag', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const { targetId, isFlagged, reason } = req.body;
    const user = db.toggleUserFlag(targetId, Boolean(isFlagged), reason || 'Flagged by Admin', 'admin_master');
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/withdrawals/process', checkAdminAuth, WithdrawalController.processWithdrawal);

// MongoDB Atlas Status & Reconnect
app.get(['/api/admin/mongodb/status', '/api/admin/mongo-status'], checkAdminAuth, (req: Request, res: Response) => {
  const status = getMongoStatusDetails();
  res.json({ success: true, ...status });
});

app.post(['/api/admin/mongodb/reconnect', '/api/admin/reconnect-mongo'], checkAdminAuth, async (req: Request, res: Response) => {
  try {
    const { customUri } = req.body || {};
    const conn = await connectMongo(customUri);
    const status = getMongoStatusDetails();
    if (conn) {
      db.initMongoSync().then(() => db.syncAllLocalToMongo());
    }
    res.json({
      success: !!conn,
      message: conn ? 'Connected to MongoDB Atlas cluster!' : 'Unable to connect to MongoDB Atlas. Ensure 0.0.0.0/0 is whitelisted in Atlas Network Access.',
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({ ...getMongoStatusDetails(), success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// 10. VITE MIDDLEWARE & STATIC FALLBACK
// ---------------------------------------------------------------------

async function startServer() {
  // Connect to MongoDB Atlas live database immediately at server startup
  connectMongo()
    .then(async (m) => {
      if (m) {
        console.log('[POP SERVER] Connected to MongoDB Atlas cluster live.');
        await db.initMongoSync();
        seedMiningLevelsToMongo().catch((err) => console.warn('[POP SERVER] seedMiningLevelsToMongo notice:', err?.message));
      }
    })
    .catch((err) => {
      console.warn('[POP SERVER] Initial Mongo connection attempt notice:', err?.message || err);
    });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[POP SERVER] Running on port ${PORT} (0.0.0.0:${PORT})`);
  });
}

startServer();