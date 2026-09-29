// Telegram Native Haptic Feedback Provider

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: any;
        colorScheme?: string;
        themeParams?: any;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export const haptic = {
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
      } else if (navigator.vibrate) {
        navigator.vibrate(style === 'heavy' ? 30 : 15);
      }
    } catch {
      // ignore
    }
  },

  success: () => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else if (navigator.vibrate) {
        navigator.vibrate([20, 50, 20]);
      }
    } catch {
      // ignore
    }
  },

  warning: () => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
      } else if (navigator.vibrate) {
        navigator.vibrate([30, 30]);
      }
    } catch {
      // ignore
    }
  },

  error: () => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      } else if (navigator.vibrate) {
        navigator.vibrate([40, 40, 40]);
      }
    } catch {
      // ignore
    }
  },

  selection: () => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    } catch {
      // ignore
    }
  }
};
