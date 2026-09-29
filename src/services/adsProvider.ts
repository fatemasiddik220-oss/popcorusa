/**
 * POP TELEGRAM MINI APP - DYNAMIC ADS PROVIDER SERVICE
 * Supports: Adsgram, Monetag, GoogleAdSense
 * Dynamic script injection, provider switching, and 10s interstitial lifecycle.
 */

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<{ done: boolean; description?: string; state?: string }>;
      };
    };
    monetag?: any;
    show_native_ad?: any;
  }
}

export type AdProviderType = 'adsgram' | 'monetag' | 'googleadsense' | string;

export function sanitizeAdsgramBlockId(secret?: string): string {
  if (!secret) return '12345';
  const trimmed = String(secret).trim();
  // Valid Adsgram format: purely digits (e.g. "4568") or "int-" followed by digits (e.g. "int-1234")
  if (/^\d+$/.test(trimmed) || /^int-\d+$/.test(trimmed)) {
    return trimmed;
  }
  // If it starts with or contains int-
  if (trimmed.toLowerCase().includes('int-')) {
    const nums = trimmed.replace(/\D/g, '');
    return nums ? `int-${nums}` : 'int-1234';
  }
  // Extract all numeric digits (e.g. test_block_12345 -> 12345)
  const digits = trimmed.replace(/\D/g, '');
  return digits || '12345';
}

export interface AdShowResult {
  success: boolean;
  provider: string;
  blockId: string;
  watchedDurationSeconds: number;
  rewardEarned: boolean;
  error?: string;
}

class AdsProviderService {
  private currentProvider: AdProviderType = 'adsgram';
  private currentSecret: string = '12345';
  private adsgramController: any = null;
  private scriptLoaded: boolean = false;
  private currentUserId: string = '';
  // Daily frequency cap: strictly 3 to 5 ads per day (default 4) across bot sessions & actions
  private dailyCap: number = 4;

  /**
   * Configure dynamic provider, block ID, and optional daily cap in real-time from server / admin config
   */
  public configure(provider: AdProviderType, secret: string, dailyCap?: number) {
    const normalizedProvider = (provider || 'adsgram').toLowerCase();
    const sanitizedSecret = normalizedProvider === 'adsgram' ? sanitizeAdsgramBlockId(secret) : (secret || '12345');
    const isNew = normalizedProvider !== this.currentProvider || sanitizedSecret !== this.currentSecret;

    this.currentProvider = normalizedProvider;
    this.currentSecret = sanitizedSecret;

    if (dailyCap !== undefined && !isNaN(Number(dailyCap))) {
      // Clamp between 3 and 5 ads per day
      this.dailyCap = Math.max(3, Math.min(5, Number(dailyCap)));
    }

    if (isNew) {
      this.loadProviderScript();
    }
  }

  /**
   * Set the active user ID / Telegram ID for user-scoped daily frequency tracking
   */
  public setUserId(userId: string): void {
    if (userId) {
      this.currentUserId = String(userId).trim();
    }
  }

  /**
   * Get the current UTC calendar date string (YYYY-MM-DD)
   */
  private getTodayUtcString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Get the storage key for a user on today's UTC date
   */
  private getStorageKey(userId?: string): string {
    const uid = userId || this.currentUserId || 'default_user';
    const date = this.getTodayUtcString();
    return `pop_adsgram_views_${uid}_${date}`;
  }

  /**
   * Get the count of ads viewed by the user today
   */
  public getDailyAdCount(userId?: string): number {
    if (typeof window === 'undefined') return 0;
    try {
      const key = this.getStorageKey(userId);
      const val = localStorage.getItem(key);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if user is eligible to view an ad today under the daily frequency cap (3-5 ads/day)
   */
  public canShowAdToday(userId?: string): boolean {
    const count = this.getDailyAdCount(userId);
    return count < this.dailyCap;
  }

  /**
   * Increment daily ad view count locally and sync to backend
   */
  public incrementDailyAdCount(userId?: string): number {
    if (typeof window === 'undefined') return 0;
    const uid = userId || this.currentUserId;
    const current = this.getDailyAdCount(uid);
    const next = current + 1;
    try {
      const key = this.getStorageKey(uid);
      localStorage.setItem(key, String(next));
    } catch {}

    // Report to backend in background for cross-session & bot session synchronization
    if (uid) {
      fetch('/api/ads/record-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': uid,
        },
        body: JSON.stringify({ telegramId: uid }),
      }).catch(() => {});
    }

    return next;
  }

  /**
   * Sync daily count from server state if higher
   */
  public syncServerAdViews(serverViews: number, lastDate?: string | null): void {
    if (typeof window === 'undefined') return;
    const today = this.getTodayUtcString();
    if (lastDate && lastDate.slice(0, 10) === today && typeof serverViews === 'number') {
      const local = this.getDailyAdCount();
      if (serverViews > local) {
        try {
          const key = this.getStorageKey();
          localStorage.setItem(key, String(serverViews));
        } catch {}
      }
    }
  }

  public getDailyCap(): number {
    return this.dailyCap;
  }

  public getProvider(): AdProviderType {
    return this.currentProvider;
  }

  public getSecret(): string {
    return this.currentSecret;
  }

  /**
   * Load official provider SDK script dynamically into the DOM
   */
  public loadProviderScript(): void {
    if (typeof window === 'undefined') return;

    try {
      if (this.currentProvider === 'adsgram') {
        const existingScript = document.getElementById('adsgram-sdk-script');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'adsgram-sdk-script';
          script.src = 'https://sad.adsgram.ai/js/sad.min.js';
          script.async = true;
          script.onload = () => {
            this.scriptLoaded = true;
            this.initAdsgram();
          };
          document.head.appendChild(script);
        } else if (window.Adsgram) {
          this.initAdsgram();
        }
      } else if (this.currentProvider === 'monetag') {
        // Monetag script injection
        const existingScript = document.getElementById('monetag-sdk-script');
        if (!existingScript && this.currentSecret) {
          const script = document.createElement('script');
          script.id = 'monetag-sdk-script';
          script.src = `https://alwingulla.com/88/tag.min.js?zone=${this.currentSecret}`;
          script.async = true;
          script.setAttribute('data-zone', this.currentSecret);
          document.head.appendChild(script);
        }
      }
    } catch (err) {
      console.warn('[AdsProvider] Failed to load provider script:', err);
    }
  }

  /**
   * Check if running in a Telegram WebApp environment with launch parameters
   */
  public isTelegramEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    const tg = (window as any).Telegram?.WebApp;
    const hasInitData = Boolean(tg?.initData && tg.initData.length > 0);
    const hasUrlParams = window.location.search.includes('tgWebAppData') || window.location.hash.includes('tgWebAppData');
    return hasInitData || hasUrlParams;
  }

  private initAdsgram(): void {
    if (typeof window !== 'undefined' && window.Adsgram) {
      if (!this.isTelegramEnvironment()) {
        console.log('[AdsProvider] App running outside Telegram environment. Adsgram native calls bypassed.');
        this.adsgramController = null;
        return;
      }
      try {
        const validBlockId = sanitizeAdsgramBlockId(this.currentSecret);
        this.adsgramController = window.Adsgram.init({
          blockId: validBlockId,
          debug: false
        });
        console.log(`[AdsProvider] Adsgram initialized with Block ID: ${validBlockId}`);
      } catch (err) {
        console.warn('[AdsProvider] Adsgram init failed or outside Telegram environment:', err);
        this.adsgramController = null;
      }
    }
  }

  /**
   * Show native ad if SDK is available, or return fallback trigger
   */
  public async showNativeAd(): Promise<boolean> {
    if (!this.isTelegramEnvironment()) {
      return false;
    }
    // Daily Frequency Cap check (Maximum 3 to 5 ads per day)
    if (!this.canShowAdToday()) {
      console.log(`[Adsgram] Daily frequency cap reached (${this.getDailyAdCount()}/${this.dailyCap}). Skipping native ad.`);
      return false;
    }

    if (this.currentProvider === 'adsgram' && this.adsgramController) {
      try {
        const res = await this.adsgramController.show();
        if (res?.done) {
          this.incrementDailyAdCount();
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[AdsProvider] Native Adsgram show rejected:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Show Adsgram Rewarded Video Ad.
   * Uses Adsgram SDK's native onReward completion (res.done) to verify video completion automatically (no fixed timer).
   * Enforces a strict daily frequency cap of 3 to 5 ads per day across bot sessions and actions.
   */
  public async showRewardedAd(
    onReward: () => void | Promise<void>,
    onError?: (err: any) => void
  ): Promise<boolean> {
    // 1. Daily Frequency Cap check (3 to 5 ads per day)
    // If the user has already reached the daily limit, smoothly bypass the ad and grant action/reward directly
    if (!this.canShowAdToday()) {
      const currentViews = this.getDailyAdCount();
      console.log(`[Adsgram] Daily frequency cap reached (${currentViews}/${this.dailyCap} ads today). Bypassing ad display and proceeding with action/reward.`);
      await onReward();
      return true;
    }

    // 2. If running outside Telegram, Adsgram cannot retrieve launch parameters
    if (!this.isTelegramEnvironment()) {
      console.log('[Adsgram] Web preview/standalone mode detected. Adsgram requires Telegram environment. Triggering reward directly.');
      await onReward();
      return true;
    }

    // 3. Official Adsgram Rewarded Video Ad flow
    if (typeof window !== 'undefined' && window.Adsgram) {
      if (!this.adsgramController) {
        this.initAdsgram();
      }
      if (this.adsgramController) {
        try {
          const res = await this.adsgramController.show();
          if (res?.done) {
            console.log('[Adsgram] Rewarded video completed! Incrementing daily view count and executing onReward callback.');
            this.incrementDailyAdCount();
            await onReward();
            return true;
          } else {
            console.warn('[Adsgram] Rewarded video closed before completion.');
            if (onError) onError(new Error('Ad not completed'));
            return false;
          }
        } catch (err) {
          console.warn('[Adsgram] Native rewarded ad failed or dismissed:', err);
          // Fallback if ad failed to load so user is not blocked
          if (onError) onError(err);
          await onReward();
          return false;
        }
      }
    }

    // Fallback when Adsgram is unavailable or running outside Telegram
    await onReward();
    return true;
  }
}

export const adsProvider = new AdsProviderService();
