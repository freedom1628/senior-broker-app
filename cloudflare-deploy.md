# Cloudflare Pages Deployment Walkthrough

This guide walks you through deploying the **Senior Broker Multi-AI Swing Trading Platform** directly to **Cloudflare Pages** (no local 24/7 server required).

Cloudflare will host your frontend, edge API routes, and background intelligence globally with free automatic SSL, DDoS protection, and 100% uptime.

---

## 🌟 Method 1: Git Integration (Recommended — Continuous Auto-Deploy)

This is the standard, zero-maintenance method. Whenever you push updates, Cloudflare automatically builds and deploys.

### Step 1: Push Code to GitHub (Private or Public)
Open PowerShell in `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app`:

```bash
git add .
git commit -m "Senior Broker Multi-AI Platform"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/senior-broker-app.git
git push -u origin main
```

---

### Step 2: Connect Repository in Cloudflare Dashboard
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, click **Compute (Workers & Pages)** > **Create Application** > Select the **Pages** tab.
3. Click **Connect to Git** and authorize your GitHub account.
4. Select your `senior-broker-app` repository and click **Begin setup**.

---

### Step 3: Configure Build Settings
Fill in the deployment settings:
- **Project Name**: `senior-broker` (or any name you prefer)
- **Production Branch**: `main`
- **Framework Preset**: `Next.js`
- **Build Command**: `npx @opennextjs/cloudflare build`
- **Build Output Directory**: `.open-next/assets`
- **Root Directory**: `/`

---

### Step 4: Add Environment Variables
Scroll down to **Environment Variables (Advanced)** and add:

| Variable Name | Value | Note |
|---|---|---|
| `NODE_VERSION` | `20` | Ensures Node 20 runtime |
| `NEXTAUTH_SECRET` | `senior-broker-super-secret-key-2026` | Random secure string |
| `NEXTAUTH_URL` | `https://senior-broker.pages.dev` | Your Cloudflare URL or custom domain |
| `GOOGLE_CLIENT_ID` | `your-google-client-id.apps.googleusercontent.com` | Optional for Google OAuth |
| `GOOGLE_CLIENT_SECRET` | `your-google-secret` | Optional for Google OAuth |

Click **Save and Deploy**!

Cloudflare will compile the Next.js app and provide your live URL: **`https://senior-broker.pages.dev`**.

---

## ⚡ Method 2: Direct CLI Deployment (Deploy in 60 Seconds Without Git)

If you prefer to deploy directly from your computer right now:

### Step 1: Authenticate with Cloudflare
```bash
cd C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
npx wrangler login
```
A browser window will open asking you to click **"Authorize"**.

### Step 2: Build & Deploy
```bash
npm run cf:deploy
```
Wrangler will package the assets, upload them to Cloudflare Pages, and output your live production URL!

---

## 🌐 Adding Your Custom Domain (e.g. `broker.yourdomain.com`)

1. In Cloudflare Dashboard, go to **Workers & Pages** > click **`senior-broker`**.
2. Click the **Custom domains** tab > **Set up a custom domain**.
3. Type your subdomain (e.g., `broker.yourdomain.com`) and click **Activate domain**.
4. Cloudflare will automatically configure DNS and issue an SSL certificate in ~60 seconds.

---

## 📱 Mobile App Setup (iPhone & Android)

Once your Cloudflare Pages URL is live:
1. Open `https://senior-broker.pages.dev` (or `https://broker.yourdomain.com`) on your phone.
2. Sign in via the **Sign-In Gate** with Google or your desk passcode.
3. Tap **Share / Browser Options** > **"Add to Home Screen"**.
4. The app installs as a native full-screen app with audio chimes and live trigger tracking.
