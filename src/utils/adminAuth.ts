/**
 * PopCorn Protocol - Admin Security & Identity Verifier
 * Authoritative Telegram Admin ID: 7779827146
 */

export const ADMIN_TELEGRAM_ID =
  (typeof process !== 'undefined' && process.env?.ADMIN_TELEGRAM_ID)
    ? String(process.env.ADMIN_TELEGRAM_ID).trim()
    : '7779827146';

/**
 * Validates whether the active Telegram session belongs strictly to the Admin (7779827146).
 * Priority:
 * 1. window.Telegram.WebApp.initDataUnsafe.user.id
 * 2. Fallback to active authenticated user session telegramId
 *
 * @returns true ONLY if the active user ID matches ADMIN_TELEGRAM_ID
 */
export function isAuthorizedAdmin(userTelegramId?: string | number | null): boolean {
  // 1. Extract directly from Telegram Mini App WebApp context
  const tgWebApp = (window as any).Telegram?.WebApp;
  const tgUserId = tgWebApp?.initDataUnsafe?.user?.id;

  if (tgUserId !== undefined && tgUserId !== null) {
    return String(tgUserId).trim() === ADMIN_TELEGRAM_ID;
  }

  // 2. Fallback to active app user state if running outside direct WebApp iframe
  if (userTelegramId !== undefined && userTelegramId !== null) {
    return String(userTelegramId).trim() === ADMIN_TELEGRAM_ID;
  }

  return false;
}
