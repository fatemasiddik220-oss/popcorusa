# POP Telegram Mini App & Bot - Production Deployment Guide

This guide details step-by-step production deployment instructions for **POP (POP BOT)** on **Render**, **VPS (Ubuntu/Debian)**, and **Vercel**.

---

## 1. Environment Variables Configuration

Ensure the following variables are defined in your host's environment settings (or `.env` file):

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="8944178413:AAGx6IvYCbD20tZRDf_YCVBLmmWdpQQZXcE"
TELEGRAM_BOT_USERNAME="PopCornUSA_BOT"
MINI_APP_URL="http://t.me/PopCornUSA_BOT"

# Security & Admin Access
JWT_SECRET="Sujonborsha"
ADMIN_TELEGRAM_ID="7779827146"
TELEGRAM_CHAT_ID="7779827146"
ADMIN_SECRET="Sujonborsha"
ADMIN_SECRET_KEY="Sujonborsha"

# Dynamic Ad Network Defaults (Overridable via Web Admin Panel)
AD_PROVIDER="adsgram"
AD_PROVIDER_SECRET="test_block_12345"

# Channels & Support
COMMUNITY_URL="https://t.me/PopCornUSA_BOT"
SUPPORT_USERNAME="PopCornUSA_BOT"
WHATSAPP_SUPPORT_URL="https://wa.me/15550192834"

# Networking
PORT=3000
NODE_ENV=production
```

---

## 2. Option A: One-Click Deploy on Render (Recommended Full-Stack)

Render handles both the Express backend (Telegram Bot polling/webhooks & API routes) and static assets serving concurrently.

1. Push this repository to **GitHub** or **GitLab**.
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service**.
3. Select your repository.
4. Configure service details:
   - **Name**: `pop-telegram-miniapp`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (or `node dist/server.cjs`)
   - **Plan**: Starter or higher (to avoid cold sleep during bot interactions)
5. Under **Environment Variables**, add the environment variables from Section 1.
6. Click **Deploy Web Service**. Once deployed, copy your Render URL (e.g. `https://pop-miniapp.onrender.com`).

---

## 3. Option B: Self-Hosted Linux VPS (Ubuntu / Debian with PM2 + Nginx)

For full control, zero cold-starts, and lowest latency:

### Step 1: Install Node.js & PM2
```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Install PM2 process manager globally
sudo npm install -g pm2
```

### Step 2: Clone & Build Application
```bash
# Clone your repository
git clone <YOUR_GIT_REPO_URL> /var/www/pop-miniapp
cd /var/www/pop-miniapp

# Copy and edit production environment variables
cp .env.example .env
nano .env

# Install dependencies and build bundle
npm install
npm run build
```

### Step 3: Launch with PM2
```bash
# Start background cluster
pm2 start dist/server.cjs --name "pop-miniapp" -i max

# Save PM2 process list to run on system reboots
pm2 save
pm2 startup
```

### Step 4: Configure Nginx & Free SSL (Certbot)
```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx site configuration
sudo nano /etc/nginx/sites-available/pop-miniapp
```

Paste the following Nginx reverse proxy configuration:
```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and obtain SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/pop-miniapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt SSL
sudo certbot --nginx -d your-domain.com
```

---

## 4. Option C: Split Deployment (Vercel Frontend + Render Backend)

If you prefer hosting the client-side SPA on Vercel:

1. In `vite.config.ts`, ensure client proxy points to your live backend domain.
2. Import project into [Vercel Dashboard](https://vercel.com).
3. Set **Framework Preset**: `Vite`.
4. Set **Build Command**: `npm run build`.
5. Set **Output Directory**: `dist`.
6. Add environment variable:
   - `VITE_API_URL`: `https://your-backend-api.onrender.com`

---

## 5. Linking Mini App in Telegram BotFather

Once your HTTPS domain is live (e.g. `https://your-domain.com`):

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/mybots` and select your bot: **`@PopCornUSA_BOT`**.
3. Select **Bot Settings** → **Menu Button** → **Configure menu button**.
4. Send the HTTPS URL of your deployed app: `https://your-domain.com`.
5. Name the button: **"Open POP"** or **"Mine POP 🍿"**.
6. (Optional) Set up Mini App short name:
   - Run `/newapp`
   - Select `@PopCornUSA_BOT`
   - Title: `POP`
   - Description: `POP Token Mining & Referral Matrix`
   - App URL: `https://your-domain.com`
   - Short Name: `app` (Resulting in `https://t.me/PopCornUSA_BOT/app`)

---

## 6. Accessing the Live Web Admin Command Center

1. Open the Mini App in your browser or Telegram.
2. Click the **Admin** shield icon in the top header (or navigate to `/admin`).
3. Enter your Master Admin Secret Key:
   - `Sujonborsha`
4. From the command center, you can:
   - Toggle **Ad Provider** (Adsgram vs Monetag) in real time with instant database override.
   - Update **Adsgram Block ID** or **Monetag Zone Key**.
   - Modify **Lifetime Referral Commission (%)** and **Qualified Bonus**.
   - Approve, Reject, or Mark Paid any pending TON withdrawal requests.
   - Inspect Anti-Cheat IP & Device Fingerprints and ban/flag suspicious multi-accounting nodes.
