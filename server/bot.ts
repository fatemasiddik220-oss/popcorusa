import crypto from 'crypto';
import { Telegraf } from 'telegraf';
import { db } from './db.js';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8944178413:AAGx6IvYCbD20tZRDf_YCVBLmmWdpQQZXcE';
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_ID || '7779827146';
const WELCOME_BANNER_URL = process.env.WELCOME_BANNER || process.env.WELCOME_BANNER_URL || 'https://raw.githubusercontent.com/sbsujon213/Image/main/1789792124086.png';

// ======================================================================
// TELEGRAF BOT INSTANCE & NON-BLOCKING DB HELPERS
// ======================================================================

/**
 * User database interface helper for non-blocking asynchronous user persistence
 */
export const User = {
  findOneAndUpdate: (
    filter: { telegramId: string },
    update: { telegramId?: string; name?: string; username?: string; referrerId?: string; [key: string]: any },
    _options?: { upsert?: boolean; [key: string]: any }
  ) => ({
    exec: async () => {
      const telegramId = filter.telegramId || update.telegramId || '';
      const name = update.name || update.firstName || 'Miner';
      const username = update.username;
      const referrerId = update.referrerId;
      return db.getOrCreateUser({
        telegramId: telegramId.toString(),
        firstName: name,
        username,
        referrerId
      });
    }
  })
};

export const bot = new Telegraf(BOT_TOKEN);

// Global bot error boundary to handle network errors and 409 conflicts gracefully
bot.catch((err: any) => {
  const errMsg = err?.message || String(err);
  if (errMsg.includes('409') || errMsg.includes('Conflict') || errMsg.includes('getUpdates')) {
    console.warn('[Telegraf] Notice: 409 Conflict detected. Another session or instance is actively handling updates.');
    return;
  }
  console.warn('[Telegraf] Handled error in bot context:', errMsg);
});

// ======================================================================
// 1. INSTANT WELCOME MESSAGE WITH PHOTO BANNER & TEXT FALLBACK (bot.start)
// ======================================================================
bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  const userName = ctx.from?.first_name || 'Miner';

  // Extract start payload (e.g. 8-character referral code "A9X72K1M", "ref_A9X72K1M", or legacy ID)
  const rawPayload = (ctx as any).payload || (ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ')[1] : '');
  let referralCode: string | undefined = undefined;
  if (rawPayload && typeof rawPayload === 'string') {
    const cleaned = rawPayload.replace(/^ref[_-]/i, '').trim();
    if (cleaned && cleaned !== chatId.toString()) {
      referralCode = cleaned;
    }
  }

  // Immediate registration and referral binding in database & memory
  try {
    db.getOrCreateUser({
      telegramId: chatId.toString(),
      firstName: ctx.from?.first_name || 'Miner',
      lastName: ctx.from?.last_name || '',
      username: ctx.from?.username,
      referrerId: referralCode,
    });
  } catch (err: any) {
    console.error('[Telegraf] Error in db.getOrCreateUser on bot start:', err);
  }

  // Non-blocking async DB update
  User.findOneAndUpdate(
    { telegramId: chatId.toString() },
    { telegramId: chatId.toString(), name: userName, username: ctx.from?.username, referrerId: referralCode },
    { upsert: true }
  ).exec().catch((err: any) => console.error('DB Update Error:', err));

  const welcomeCaption = `👋 *Welcome to PopCorn USA Miner!*\n\n` +
    `⛏️ Mine $POP tokens directly inside Telegram.\n` +
    `🚀 Tap, mine, and invite friends to earn rewards.\n` +
    `👛 Connect your TON Wallet for seamless payouts!\n\n` +
    `Click below to start mining or join our official channel:`;

  const baseWebAppUrl = process.env.WEBAPP_URL || 'https://popcorusa-production.up.railway.app/';
  const webAppLaunchUrl = referralCode
    ? `${baseWebAppUrl}${baseWebAppUrl.includes('?') ? '&' : '?'}startapp=${referralCode}&tgWebAppStartParam=${referralCode}&start_param=${referralCode}&start=${referralCode}`
    : baseWebAppUrl;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🚀 Open Mining', web_app: { url: webAppLaunchUrl } }],
      [{ text: '📢 Official Channel', url: 'https://t.me/popcorn_officials' }]
    ]
  };

  const imageUrl = process.env.WELCOME_BANNER && process.env.WELCOME_BANNER.startsWith('http')
    ? process.env.WELCOME_BANNER
    : (process.env.WELCOME_BANNER_URL || 'https://raw.githubusercontent.com/sbsujon213/Image/main/1789792124086.png');

  try {
    await ctx.replyWithPhoto(imageUrl, {
      caption: welcomeCaption,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (photoErr) {
    console.error('Photo Error:', photoErr);
    // If custom image failed, try reliable direct CDN banner
    if (imageUrl !== 'https://raw.githubusercontent.com/sbsujon213/Image/main/1789792124086.png') {
      try {
        await ctx.replyWithPhoto('https://raw.githubusercontent.com/sbsujon213/Image/main/1789792124086.png', {
          caption: welcomeCaption,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        return;
      } catch (retryErr) {
        console.error('Direct CDN Photo Error:', retryErr);
      }
    }
    await ctx.reply(welcomeCaption, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
});

// Additional Bot Commands
bot.command(['mine', 'balance'], async (ctx) => {
  const webAppUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || 'https://popcorusa-production.up.railway.app/';
  return ctx.replyWithHTML(`🍿 <b>POP Mining Status</b>\n\nTo view real-time unclaimed mining rewards and adjust your miner speed, open the Mini App:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚡ Open Mining Dashboard', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

bot.command('squad', async (ctx) => {
  const chatId = ctx.chat.id;
  const webAppUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || 'https://popcorusa-production.up.railway.app/';
  let user = db.getUser(chatId.toString());
  if (!user) {
    user = db.getOrCreateUser({
      telegramId: chatId.toString(),
      firstName: ctx.from?.first_name || 'Miner',
      username: ctx.from?.username,
    }).user;
  }
  const refCode = user?.referralCode || db.generateUniqueReferralCode();
  const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'PopCornUSA_bot').replace('@', '').trim();
  const singleRefLink = `https://t.me/${botUsername}?start=${refCode}`;

  return ctx.replyWithHTML(
    `👥 <b>POP Squad Referral Program</b>\n\n` +
    `Your unique 8-character referral code: <code>${refCode}</code>\n\n` +
    `Share your personal referral link to earn <b>10% lifetime mining commission</b> + instant qualified bonus!\n\n` +
    `🔗 <b>Your Referral Link:</b>\n<code>${singleRefLink}</code>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Open Mining App', web_app: { url: `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}startapp=${refCode}` } }],
          [{ text: '🏆 Squad & Weekly Contest', web_app: { url: webAppUrl } }]
        ]
      }
    }
  );
});

// ======================================================================
// CONFLICT-FREE BOT LAUNCH (Clear old webhook first before polling)
// ======================================================================
let isPollingActive = false;
let pollingRetryTimeout: NodeJS.Timeout | null = null;

async function startBotService() {
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here' || BOT_TOKEN.includes('PLACEHOLDER')) {
    console.log('[Telegraf] No valid bot token provided, skipping polling.');
    return;
  }

  if (process.env.DISABLE_BOT_POLLING === 'true') {
    console.log('[Telegraf] Polling disabled via DISABLE_BOT_POLLING. Using webhook mode.');
    return;
  }

  try {
    // 1. Clear old webhooks and wait a moment for Telegram to release previous long-poll session
    console.log('[Telegraf] Clearing any existing webhooks before polling...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch((err) => {
      console.warn('[Telegraf] deleteWebhook notice:', err?.message || err);
    });

    // 2. Delay to allow Telegram servers to drop hanging getUpdates connections from previous container/restart
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Launch polling mode safely
    await bot.launch({
      dropPendingUpdates: true,
    });
    isPollingActive = true;
    console.log('[Telegraf] Bot polling initialized and listening for updates.');
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('409') || errMsg.includes('Conflict') || errMsg.includes('terminated by other getUpdates')) {
      console.warn(
        '[Telegraf] Notice: Another bot instance or process is currently active with this bot token (409 Conflict). ' +
        'Switching to standby mode. WebApp and webhook routes (/api/telegram/webhook) remain active and functional.'
      );
      try {
        bot.stop('Standby due to active external session');
      } catch {}

      // Retry after 60s in case the other instance was temporary
      if (pollingRetryTimeout) clearTimeout(pollingRetryTimeout);
      pollingRetryTimeout = setTimeout(() => {
        if (!isPollingActive) {
          console.log('[Telegraf] Retrying bot polling after standby period...');
          startBotService().catch(() => {});
        }
      }, 60000);
    } else {
      console.warn('[Telegraf] Bot launch warning:', errMsg);
    }
  }
}

startBotService();

// Graceful stop listeners
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ======================================================================
// TELEGRAM BOT SERVICE CLASS (Comprehensive API & Alerts)
// ======================================================================
export class TelegramBotService {
  public bot: Telegraf = bot;
  private token: string;
  private adminChatId: string;
  private appUrl: string;

  constructor() {
    this.token = BOT_TOKEN;
    this.adminChatId = ADMIN_CHAT_ID;
    this.appUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || 'https://popcorusa-production.up.railway.app/';
  }

  /**
   * Validate Telegram WebApp initData string cryptographically using HMAC-SHA256
   * and extract start_param (referral code) and user information.
   */
  public validateInitData(initData: string): { isValid: boolean; user?: TelegramUser; startParam?: string } {
    if (!initData) {
      return { isValid: false };
    }

    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      const startParam =
        urlParams.get('start_param') ||
        urlParams.get('startParam') ||
        urlParams.get('tgWebAppStartParam') ||
        urlParams.get('startapp') ||
        urlParams.get('start') ||
        undefined;

      const userStr = urlParams.get('user');
      let user: TelegramUser | undefined = undefined;
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch {}
      }

      if (!hash) {
        return { isValid: false, user, startParam };
      }

      urlParams.delete('hash');
      const paramsArray: string[] = [];
      urlParams.forEach((val, key) => {
        paramsArray.push(`${key}=${val}`);
      });
      paramsArray.sort();
      const dataCheckString = paramsArray.join('\n');

      // Fallback for dev / mock testing
      if (!this.token || this.token === 'your_bot_token_here') {
        return { isValid: true, user, startParam };
      }

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(this.token).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      const isValid = calculatedHash === hash;
      return { isValid, user, startParam };
    } catch (err) {
      console.error('Error validating Telegram initData:', err);
      return { isValid: false };
    }
  }

  /**
   * Verify if a user is a member of the mandatory Telegram channel using getChatMember API
   */
  public async checkChatMember(channelUsernameOrId: string, telegramId: string | number): Promise<boolean> {
    if (!channelUsernameOrId) return true;
    if (!this.token || this.token === 'your_bot_token_here') {
      return true;
    }

    try {
      let formattedChannel = channelUsernameOrId.trim();
      if (formattedChannel.startsWith('https://t.me/')) {
        formattedChannel = '@' + formattedChannel.replace('https://t.me/', '');
      } else if (!formattedChannel.startsWith('@') && !formattedChannel.startsWith('-100')) {
        formattedChannel = '@' + formattedChannel;
      }

      // If configured target is a bot rather than a channel, skip to avoid Telegram API 400 Bad Request
      if (formattedChannel.toLowerCase().endsWith('_bot') || formattedChannel.toLowerCase().endsWith('bot')) {
        return true;
      }

      const member = await bot.telegram.getChatMember(formattedChannel, Number(telegramId));
      if (member) {
        return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
      }
      return false;
    } catch (err: any) {
      // Direct fallback via fetch if Telegraf throws
      try {
        let formatted = channelUsernameOrId.trim();
        if (formatted.startsWith('https://t.me/')) {
          formatted = '@' + formatted.replace('https://t.me/', '');
        } else if (!formatted.startsWith('@') && !formatted.startsWith('-100')) {
          formatted = '@' + formatted;
        }

        if (formatted.toLowerCase().endsWith('_bot') || formatted.toLowerCase().endsWith('bot')) {
          return true;
        }

        const endpoint = `https://api.telegram.org/bot${this.token}/getChatMember?chat_id=${encodeURIComponent(formatted)}&user_id=${telegramId}`;
        const response = await fetch(endpoint);
        const data = await response.json();
        if (data.ok && data.result) {
          return ['creator', 'administrator', 'member', 'restricted'].includes(data.result.status);
        }
      } catch (innerErr) {
        console.warn('[TELEGRAM BOT] checkChatMember fallback failed:', innerErr);
      }
      return false;
    }
  }

  public async checkChannelMembership(channelUsernameOrId: string, telegramId: string | number): Promise<boolean> {
    return this.checkChatMember(channelUsernameOrId, telegramId);
  }

  /**
   * Send Direct Message (PM) to a Telegram User or Admin via Telegraf or API
   */
  public async sendDirectMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<boolean> {
    if (!this.token || this.token === 'your_bot_token_here') {
      console.log(`[TELEGRAM BOT PM MOCK to ${chatId}]:\n${text}`);
      return true;
    }

    try {
      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
      return true;
    } catch (error) {
      // Fallback via HTTP fetch if needed
      try {
        const endpoint = `https://api.telegram.org/bot${this.token}/sendMessage`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          })
        });
        const data = await response.json();
        return Boolean(data.ok);
      } catch (innerError) {
        console.error(`[TELEGRAM BOT] Error sending DM to ${chatId}:`, innerError);
        return false;
      }
    }
  }

  // ======================================================================
  // 1. INSTANT ADMIN NOTIFICATION ON NEW WITHDRAWAL REQUEST
  // ======================================================================
  /**
   * Send instant Telegram PM alert to the Admin Telegram ID "7779827146"
   */
  public async notifyAdminNewWithdrawal(params: {
    userName: string;
    username?: string;
    telegramId: string;
    grossAmount?: number;
    feePercentage?: number;
    feeInPop?: number;
    netPop?: number;
    netUsdtValue?: number;
    feeUsdtValue?: number;
    walletAddress: string;
    timestamp?: string;
    popAmount?: number;
    usdtAmount?: number;
  }): Promise<boolean> {
    const grossAmount = params.grossAmount ?? params.popAmount ?? 0;
    const feePercentage = params.feePercentage ?? 5;
    const feeInPop = params.feeInPop ?? parseFloat(((grossAmount * feePercentage) / 100).toFixed(4));
    const netPop = params.netPop ?? parseFloat((grossAmount - feeInPop).toFixed(4));
    const popToUsdtRate = Number(process.env.POP_PRICE) || 0.001;
    const netUsdtValue = params.netUsdtValue ?? parseFloat((netPop * popToUsdtRate).toFixed(4));
    const feeUsdtValue = params.feeUsdtValue ?? parseFloat((feeInPop * popToUsdtRate).toFixed(4));

    const timestampStr = params.timestamp || new Date().toUTCString();
    const cleanUsername = params.username && params.username !== 'n/a'
      ? params.username.replace(/^@/, '')
      : '';
    const userDisplay = cleanUsername
      ? `${params.userName} (@${cleanUsername})`
      : `${params.userName}`;

    // Format currency string cleanly
    const fmtUsdt = (num: number) => {
      const fixed = num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      if (/^\d+\.\d$/.test(fixed)) return fixed + '0';
      if (!fixed.includes('.')) return fixed + '.00';
      return fixed;
    };

    const feeUsdtStr = fmtUsdt(feeUsdtValue);
    const netUsdtStr = fmtUsdt(netUsdtValue);

    const message = `🚨 <b>NEW WITHDRAWAL REQUEST RECEIVED!</b>\n\n` +
      `👤 User: ${userDisplay}\n` +
      `🆔 User ID: <code>${params.telegramId}</code>\n` +
      `🪙 Gross Request: ${grossAmount} POP\n` +
      `📉 Admin Fee (${feePercentage}%): -${feeInPop} POP ($${feeUsdtStr} USDT)\n` +
      `✅ Net Payable: ${netPop} POP\n` +
      `💵 Net Value: $${netUsdtStr} USDT\n` +
      `👛 Wallet Address: <code>${params.walletAddress}</code>\n` +
      `📅 Time: ${timestampStr}\n\n` +
      `⚡ Please review and process this payout in the Admin Dashboard!`;

    const webappUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || this.appUrl;
    const adminChatId = this.adminChatId || '7779827146';

    return await this.sendDirectMessage(adminChatId, message, {
      inline_keyboard: [
        [{ text: '⚡ Open Admin Dashboard', web_app: { url: webappUrl } }]
      ]
    });
  }

  // ======================================================================
  // 2. AUTOMATED USER BOT PM NOTIFICATIONS (Withdrawals & Balance Changes)
  // ======================================================================
  /**
   * On Withdrawal Approval (Status = "Paid"):
   */
  public async notifyUserWithdrawalApproved(params: {
    telegramId: string;
    userName: string;
    popAmount: number;
    usdtAmount: number;
    walletAddress: string;
  }): Promise<boolean> {
    const message = `🎉 <b>Withdrawal Successful!</b>\n\n` +
      `Hello ${params.userName}, your payout of $${params.usdtAmount.toFixed(2)} USDT for ${params.popAmount.toLocaleString()} POP has been sent to your wallet:\n` +
      `<code>${params.walletAddress}</code>\n\n` +
      `Status: Paid ✅`;

    const webappUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || this.appUrl;

    return await this.sendDirectMessage(params.telegramId, message, {
      inline_keyboard: [
        [{ text: '🚀 Open Mining', web_app: { url: webappUrl } }]
      ]
    });
  }

  /**
   * On Admin Balance Adjustment (Add Bonus):
   */
  public async notifyUserBonusAdded(params: {
    telegramId: string;
    userName: string;
    amount: number;
    newBalance: number;
  }): Promise<boolean> {
    const message = `🎉 <b>Bonus Credited!</b>\n\n` +
      `Hello ${params.userName}, the Admin has added bonus tokens to your account!\n\n` +
      `➕ Added Amount: +${params.amount.toLocaleString()} POP\n` +
      `💰 New Total Balance: ${params.newBalance.toLocaleString()} POP\n\n` +
      `Keep mining with PopCorn USA!`;

    const webappUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || this.appUrl;

    return await this.sendDirectMessage(params.telegramId, message, {
      inline_keyboard: [
        [{ text: '🍿 Check Balance in POP', web_app: { url: webappUrl } }]
      ]
    });
  }

  /**
   * On Admin Balance Adjustment (Deduct Tokens):
   */
  public async notifyUserTokenDeducted(params: {
    telegramId: string;
    userName: string;
    amount: number;
    newBalance: number;
    reason?: string;
  }): Promise<boolean> {
    const message = `⚠️ <b>Balance Adjustment Notice</b>\n\n` +
      `Hello ${params.userName}, an adjustment was made to your account balance.\n\n` +
      `➖ Deducted Amount: -${params.amount.toLocaleString()} POP\n` +
      `💰 Remaining Balance: ${params.newBalance.toLocaleString()} POP\n` +
      `📝 Reason: ${params.reason || 'Administrative correction'}`;

    const webappUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || this.appUrl;

    return await this.sendDirectMessage(params.telegramId, message, {
      inline_keyboard: [
        [{ text: '🍿 Open POP App', web_app: { url: webappUrl } }]
      ]
    });
  }

  /**
   * Manual Bonus Notification with reason note
   */
  public async notifyUserManualBonus(params: {
    telegramId: string;
    bonusAmountPOP: number;
    reasonNote: string;
  }): Promise<boolean> {
    const message = `🎉 <b>Bonus Received!</b> You earned ${params.bonusAmountPOP.toLocaleString()} POP.\nReason: ${params.reasonNote}`;

    const webappUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || this.appUrl;

    return await this.sendDirectMessage(params.telegramId, message, {
      inline_keyboard: [
        [{ text: '🍿 Check Balance in POP', web_app: { url: webappUrl } }]
      ]
    });
  }

  /**
   * Send notification to Referrer when a new squad referral joins
   */
  public async notifyReferrerBonus(params: {
    referrerTelegramId: string;
    referredUsername: string;
    bonusAmountPOP: number;
  }): Promise<boolean> {
    const message = `👥 <b>NEW SQUAD REFERRAL JOINED!</b>\n\n` +
      `User <b>@${params.referredUsername || 'POP Miner'}</b> joined using your personal referral link!\n\n` +
      `🎁 <b>Instant Bonus:</b> +${params.bonusAmountPOP} POP has been credited to your balance.\n` +
      `⚡ <b>Lifetime Earning:</b> You will receive <b>10% commission</b> on every POP token they mine!`;

    const webappUrl = process.env.WEBAPP_URL || process.env.MINI_APP_URL || this.appUrl;

    return await this.sendDirectMessage(params.referrerTelegramId, message, {
      inline_keyboard: [
        [{ text: '👥 Open Squad Dashboard', web_app: { url: webappUrl } }]
      ]
    });
  }

  /**
   * Forward incoming webhook updates to Telegraf
   */
  public async handleWebhookUpdate(update: any): Promise<void> {
    if (!update) return;
    try {
      await bot.handleUpdate(update);
    } catch (err: any) {
      console.error('[Telegraf] Error processing update:', err);
    }
  }
}

export const telegramBot = new TelegramBotService();