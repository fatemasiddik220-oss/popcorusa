import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App.tsx';
import './index.css';

// Dynamically compute the full HTTPS manifest URL for Telegram Wallet / TON Connect
const getManifestUrl = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const origin = window.location.origin;
      if (origin && origin.startsWith('https://')) {
        return `${origin}/tonconnect-manifest.json`;
      }
      if (origin && origin.startsWith('http://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return `${origin.replace('http://', 'https://')}/tonconnect-manifest.json`;
      }
    } catch {
      // fallback
    }
  }
  return 'https://popcron.ai.studio/tonconnect-manifest.json';
};

const manifestUrl = getManifestUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/PopCornUSA_BOT'
      }}
    >
      <App />
    </TonConnectUIProvider>
  </StrictMode>,
);
